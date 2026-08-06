import { pool, withTransaction } from '../../db/pool.js';
import { registrarBitacora } from '../../lib/audit.js';
import { siguienteFolio } from '../../lib/folio.js';
import { registrarFirma } from '../../lib/firma.js';
import { notificarPorRol } from '../../lib/notificaciones.js';

// Bloque 16: cambio de precio. 5% de desviación ARRIBA del presupuestado dispara la alerta y
// requiere autorización de Dirección antes de poder cerrar el cuadro comparativo (y así generar
// la Orden de Compra) — regla confirmada por el usuario.
const UMBRAL_VARIACION_PRECIO = 0.05;

async function cargarProcesoCompleto(client, id) {
  const { rows: cab } = await client.query(
    `SELECT pc.*, o.nombre AS obra_nombre, u.nombre AS creado_por_nombre
     FROM procesos_cotizacion pc
     JOIN obras o ON o.id = pc.obra_id
     JOIN usuarios u ON u.id = pc.creado_por
     WHERE pc.id = $1`,
    [id]
  );
  if (!cab[0]) return null;

  const { rows: requisiciones } = await client.query(
    `SELECT r.id, r.folio, p.nombre AS partida_nombre, f.nombre AS frente_nombre
     FROM proceso_cotizacion_requisicion pcr
     JOIN requisiciones r ON r.id = pcr.requisicion_id
     JOIN partidas p ON p.id = r.partida_id
     JOIN frentes f ON f.id = r.frente_id
     WHERE pcr.proceso_id = $1
     ORDER BY r.folio`,
    [id]
  );

  const { rows: insumos } = await client.query(
    `SELECT i.id, i.clave, i.descripcion, i.unidad, SUM(rd.cantidad_aprobada) AS cantidad_total
     FROM proceso_cotizacion_requisicion pcr
     JOIN requisicion_detalle rd ON rd.requisicion_id = pcr.requisicion_id
     JOIN insumos i ON i.id = rd.insumo_id
     WHERE pcr.proceso_id = $1
     GROUP BY i.id, i.clave, i.descripcion, i.unidad
     ORDER BY i.descripcion`,
    [id]
  );

  const { rows: proveedores } = await client.query(
    `SELECT cp.id, cp.proveedor_id, pr.razon_social, pr.moneda, cp.condiciones_pago, cp.tiempo_entrega_dias
     FROM cotizaciones_proveedor cp
     JOIN proveedores pr ON pr.id = cp.proveedor_id
     WHERE cp.proceso_id = $1
     ORDER BY pr.razon_social`,
    [id]
  );

  const { rows: detalle } = await client.query(
    `SELECT cd.id, cd.cotizacion_proveedor_id, cd.insumo_id, cd.precio_unitario
     FROM cotizacion_detalle cd
     JOIN cotizaciones_proveedor cp ON cp.id = cd.cotizacion_proveedor_id
     WHERE cp.proceso_id = $1`,
    [id]
  );

  const { rows: ganadores } = await client.query(
    `SELECT g.insumo_id, g.cotizacion_detalle_id, cd.precio_unitario, poi.costo_unitario AS costo_presupuestado,
            CASE WHEN poi.costo_unitario > 0
                 THEN round(((cd.precio_unitario - poi.costo_unitario) / poi.costo_unitario) * 100, 2)
                 ELSE NULL END AS variacion_pct,
            COALESCE(poi.costo_unitario > 0 AND cd.precio_unitario > poi.costo_unitario * (1 + $2::numeric), false) AS excede_variacion_precio
     FROM proceso_cotizacion_ganador g
     JOIN cotizacion_detalle cd ON cd.id = g.cotizacion_detalle_id
     LEFT JOIN presupuesto_obra_insumo poi ON poi.insumo_id = g.insumo_id AND poi.obra_id = (SELECT obra_id FROM procesos_cotizacion WHERE id = $1)
     WHERE g.proceso_id = $1`,
    [id, UMBRAL_VARIACION_PRECIO]
  );

  return {
    ...cab[0],
    requisiciones,
    insumos,
    proveedores: proveedores.map((p) => ({ ...p, detalle: detalle.filter((d) => d.cotizacion_proveedor_id === p.id) })),
    ganadores,
    hayVariacionSinAutorizar: ganadores.some((g) => g.excede_variacion_precio) && !cab[0].variacion_precio_autorizada,
  };
}

export default async function cotizacionesRoutes(app) {
  app.addHook('preHandler', app.authenticate);

  app.get('/api/cotizaciones', async (request) => {
    const { obraId, estatus } = request.query;
    const condiciones = [];
    const valores = [];
    if (obraId) { valores.push(obraId); condiciones.push(`pc.obra_id = $${valores.length}`); }
    if (estatus) { valores.push(estatus); condiciones.push(`pc.estatus = $${valores.length}`); }
    const where = condiciones.length ? `WHERE ${condiciones.join(' AND ')}` : '';

    const { rows } = await pool.query(
      `SELECT pc.id, pc.folio, pc.estatus, pc.creado_en, o.nombre AS obra_nombre,
              (SELECT COUNT(*) FROM cotizaciones_proveedor cp WHERE cp.proceso_id = pc.id) AS num_proveedores
       FROM procesos_cotizacion pc
       JOIN obras o ON o.id = pc.obra_id
       ${where}
       ORDER BY pc.creado_en DESC LIMIT 200`,
      valores
    );
    return rows;
  });

  app.get('/api/cotizaciones/:id', async (request, reply) => {
    const data = await cargarProcesoCompleto(pool, request.params.id);
    if (!data) return reply.code(404).send({ error: 'Proceso de cotización no encontrado' });
    return data;
  });

  app.post('/api/cotizaciones', { preHandler: app.requireRole('comprador', 'direccion') }, async (request, reply) => {
    const { obraId, requisicionIds } = request.body ?? {};
    if (!obraId || !Array.isArray(requisicionIds) || requisicionIds.length === 0) {
      return reply.code(400).send({ error: 'Obra y al menos una requisición autorizada son obligatorias' });
    }

    try {
      const resultado = await withTransaction(async (client) => {
        const { rows: reqs } = await client.query(
          `SELECT id, estatus, obra_id FROM requisiciones WHERE id = ANY($1::int[])`,
          [requisicionIds]
        );
        if (reqs.length !== requisicionIds.length) throw Object.assign(new Error('REQ_NO_ENCONTRADA'), { code: 400 });
        if (reqs.some((r) => r.estatus !== 'autorizada' || r.obra_id !== Number(obraId))) {
          throw Object.assign(new Error('REQ_NO_ELEGIBLE'), { code: 422 });
        }

        const { rows: yaLigadas } = await client.query(
          `SELECT pcr.requisicion_id FROM proceso_cotizacion_requisicion pcr
           JOIN procesos_cotizacion pc ON pc.id = pcr.proceso_id
           WHERE pcr.requisicion_id = ANY($1::int[]) AND pc.estatus != 'cancelado'`,
          [requisicionIds]
        );
        if (yaLigadas.length > 0) throw Object.assign(new Error('REQ_YA_COTIZADA'), { code: 409 });

        const folio = await siguienteFolio(client, 'COT', 'cotizaciones_folio_seq');
        const { rows: pcRows } = await client.query(
          `INSERT INTO procesos_cotizacion (folio, obra_id, creado_por) VALUES ($1, $2, $3) RETURNING id`,
          [folio, obraId, request.user.sub]
        );
        const procesoId = pcRows[0].id;

        for (const reqId of requisicionIds) {
          await client.query(
            `INSERT INTO proceso_cotizacion_requisicion (proceso_id, requisicion_id) VALUES ($1, $2)`,
            [procesoId, reqId]
          );
        }

        await registrarBitacora(client, {
          tabla: 'procesos_cotizacion', registroId: procesoId, usuarioId: request.user.sub,
          accion: 'crear', despues: { folio, requisicionIds },
        });

        return cargarProcesoCompleto(client, procesoId);
      });

      return reply.code(201).send(resultado);
    } catch (err) {
      if (err.code === 400) return reply.code(400).send({ error: 'Una o más requisiciones no existen' });
      if (err.code === 422) return reply.code(422).send({ error: 'Todas las requisiciones deben pertenecer a la obra y estar Autorizadas' });
      if (err.code === 409) return reply.code(409).send({ error: 'Una o más requisiciones ya están en otro proceso de cotización' });
      request.log.error(err);
      return reply.code(500).send({ error: 'No se pudo crear el proceso de cotización' });
    }
  });

  app.post('/api/cotizaciones/:id/proveedores', { preHandler: app.requireRole('comprador', 'direccion') }, async (request, reply) => {
    const { id } = request.params;
    const { proveedorId, condicionesPago, tiempoEntregaDias, detalle } = request.body ?? {};
    if (!proveedorId || !Array.isArray(detalle) || detalle.length === 0) {
      return reply.code(400).send({ error: 'Proveedor y al menos un precio por insumo son obligatorios' });
    }

    try {
      const resultado = await withTransaction(async (client) => {
        const { rows: procRows } = await client.query('SELECT estatus FROM procesos_cotizacion WHERE id = $1 FOR UPDATE', [id]);
        if (!procRows[0]) throw Object.assign(new Error('NOT_FOUND'), { code: 404 });
        if (procRows[0].estatus !== 'en_cotizacion') throw Object.assign(new Error('CERRADO'), { code: 409 });

        const { rows: cpRows } = await client.query(
          `INSERT INTO cotizaciones_proveedor (proceso_id, proveedor_id, condiciones_pago, tiempo_entrega_dias)
           VALUES ($1, $2, $3, $4) RETURNING id`,
          [id, proveedorId, condicionesPago || null, tiempoEntregaDias || null]
        );
        const cotizacionProveedorId = cpRows[0].id;

        for (const item of detalle) {
          await client.query(
            `INSERT INTO cotizacion_detalle (cotizacion_proveedor_id, insumo_id, precio_unitario) VALUES ($1, $2, $3)`,
            [cotizacionProveedorId, item.insumoId, item.precioUnitario]
          );
        }

        await registrarBitacora(client, {
          tabla: 'cotizaciones_proveedor', registroId: cotizacionProveedorId, usuarioId: request.user.sub,
          accion: 'agregar_cotizacion', despues: { proveedorId, detalle },
        });

        return cargarProcesoCompleto(client, id);
      });

      return reply.code(201).send(resultado);
    } catch (err) {
      if (err.code === 404) return reply.code(404).send({ error: 'Proceso de cotización no encontrado' });
      if (err.code === 409) return reply.code(409).send({ error: 'Este proceso ya está cerrado' });
      if (err.code === '23505') return reply.code(409).send({ error: 'Este proveedor ya cotizó en este proceso' });
      request.log.error(err);
      return reply.code(500).send({ error: 'No se pudo agregar la cotización del proveedor' });
    }
  });

  app.post('/api/cotizaciones/:id/ganador', { preHandler: app.requireRole('comprador', 'direccion') }, async (request, reply) => {
    const { id } = request.params;
    const { insumoId, cotizacionDetalleId } = request.body ?? {};
    if (!insumoId || !cotizacionDetalleId) {
      return reply.code(400).send({ error: 'Insumo y la cotización ganadora son obligatorios' });
    }

    const { rows: valido } = await pool.query(
      `SELECT cd.id, cd.precio_unitario, i.clave, i.descripcion,
              pc.obra_id, pc.folio, poi.costo_unitario AS costo_presupuestado
       FROM cotizacion_detalle cd
       JOIN cotizaciones_proveedor cp ON cp.id = cd.cotizacion_proveedor_id
       JOIN procesos_cotizacion pc ON pc.id = cp.proceso_id
       JOIN insumos i ON i.id = cd.insumo_id
       LEFT JOIN presupuesto_obra_insumo poi ON poi.insumo_id = cd.insumo_id AND poi.obra_id = pc.obra_id
       WHERE cd.id = $1 AND cp.proceso_id = $2 AND cd.insumo_id = $3`,
      [cotizacionDetalleId, id, insumoId]
    );
    if (!valido[0]) return reply.code(400).send({ error: 'Esa cotización no corresponde a este insumo/proceso' });

    await pool.query(
      `INSERT INTO proceso_cotizacion_ganador (proceso_id, insumo_id, cotizacion_detalle_id)
       VALUES ($1, $2, $3)
       ON CONFLICT (proceso_id, insumo_id) DO UPDATE SET cotizacion_detalle_id = EXCLUDED.cotizacion_detalle_id`,
      [id, insumoId, cotizacionDetalleId]
    );

    const g = valido[0];
    const costo = Number(g.costo_presupuestado || 0);
    if (costo > 0 && Number(g.precio_unitario) > costo * (1 + UMBRAL_VARIACION_PRECIO)) {
      const pct = (((Number(g.precio_unitario) - costo) / costo) * 100).toFixed(1);
      await notificarPorRol(pool, {
        roles: ['direccion'],
        categoria: 'cambio_precio',
        entidadTipo: 'cotizacion',
        entidadId: id,
        titulo: `Variación de precio en ${g.folio}`,
        mensaje: `${g.clave} · ${g.descripcion} cotizado ${pct}% arriba del presupuesto. Requiere tu autorización antes de cerrar.`,
      });
    }

    return cargarProcesoCompleto(pool, id);
  });

  // Bloque 16: Dirección autoriza explícitamente la variación de precio antes de poder cerrar
  // el cuadro comparativo cuando algún ganador excede el 5% sobre el presupuesto.
  app.post('/api/cotizaciones/:id/autorizar-variacion', { preHandler: app.requireRole('direccion') }, async (request, reply) => {
    const { id } = request.params;
    const { firma } = request.body ?? {};
    try {
      const resultado = await withTransaction(async (client) => {
        const { rows } = await client.query('SELECT estatus FROM procesos_cotizacion WHERE id = $1 FOR UPDATE', [id]);
        if (!rows[0]) throw Object.assign(new Error('NOT_FOUND'), { code: 404 });
        if (rows[0].estatus !== 'en_cotizacion') throw Object.assign(new Error('CERRADO'), { code: 409 });

        await registrarFirma(client, { request, entidadTipo: 'cotizacion_variacion_precio', entidadId: id, firma });
        await client.query(
          `UPDATE procesos_cotizacion SET variacion_precio_autorizada = true, variacion_precio_autorizada_por = $2, variacion_precio_autorizada_en = now() WHERE id = $1`,
          [id, request.user.sub]
        );
        await registrarBitacora(client, {
          tabla: 'procesos_cotizacion', registroId: id, usuarioId: request.user.sub, accion: 'autorizar_variacion_precio',
        });
        return cargarProcesoCompleto(client, id);
      });
      return resultado;
    } catch (err) {
      if (err.code === 404) return reply.code(404).send({ error: 'Proceso de cotización no encontrado' });
      if (err.code === 409) return reply.code(409).send({ error: 'Este proceso ya está cerrado' });
      if (err.message === 'FIRMA_REQUERIDA') return reply.code(400).send({ error: 'Se requiere firma (táctil o PIN) para autorizar' });
      if (err.message === 'SIN_PIN_CONFIGURADO') return reply.code(400).send({ error: 'Aún no configuras tu PIN de firma. Ve a tu perfil para crearlo.' });
      if (err.message === 'PIN_INCORRECTO') return reply.code(422).send({ error: 'PIN incorrecto' });
      if (err.message === 'FIRMA_TACTIL_INVALIDA') return reply.code(400).send({ error: 'La firma táctil capturada no es válida, intenta de nuevo' });
      request.log.error(err);
      return reply.code(500).send({ error: 'No se pudo registrar la autorización' });
    }
  });

  app.post('/api/cotizaciones/:id/cerrar', { preHandler: app.requireRole('comprador', 'direccion') }, async (request, reply) => {
    const { id } = request.params;
    const resultado = await withTransaction(async (client) => {
      const { rows: procRows } = await client.query('SELECT estatus, variacion_precio_autorizada FROM procesos_cotizacion WHERE id = $1 FOR UPDATE', [id]);
      if (!procRows[0]) return { error: 404 };
      if (procRows[0].estatus !== 'en_cotizacion') return { error: 409, mensaje: 'Este proceso ya está cerrado' };

      const { rows: insumos } = await client.query(
        `SELECT DISTINCT rd.insumo_id
         FROM proceso_cotizacion_requisicion pcr
         JOIN requisicion_detalle rd ON rd.requisicion_id = pcr.requisicion_id
         WHERE pcr.proceso_id = $1`,
        [id]
      );
      const { rows: ganadores } = await client.query('SELECT insumo_id FROM proceso_cotizacion_ganador WHERE proceso_id = $1', [id]);
      const insumosConGanador = new Set(ganadores.map((g) => g.insumo_id));
      const faltantes = insumos.filter((i) => !insumosConGanador.has(i.insumo_id));
      if (faltantes.length > 0) {
        return { error: 422, mensaje: 'Falta elegir proveedor ganador para todos los insumos antes de cerrar' };
      }

      const { rows: variacionRows } = await client.query(
        `SELECT COALESCE(bool_or(poi.costo_unitario > 0 AND cd.precio_unitario > poi.costo_unitario * (1 + $2::numeric)), false) AS excede
         FROM proceso_cotizacion_ganador g
         JOIN cotizacion_detalle cd ON cd.id = g.cotizacion_detalle_id
         LEFT JOIN presupuesto_obra_insumo poi ON poi.insumo_id = g.insumo_id AND poi.obra_id = (SELECT obra_id FROM procesos_cotizacion WHERE id = $1)
         WHERE g.proceso_id = $1`,
        [id, UMBRAL_VARIACION_PRECIO]
      );
      if (variacionRows[0].excede && !procRows[0].variacion_precio_autorizada) {
        return { error: 422, mensaje: 'Hay insumos con precio 5% o más arriba del presupuesto, pendientes de autorización de Dirección' };
      }

      await client.query("UPDATE procesos_cotizacion SET estatus = 'cerrado', cerrado_en = now() WHERE id = $1", [id]);
      await registrarBitacora(client, {
        tabla: 'procesos_cotizacion', registroId: id, usuarioId: request.user.sub, accion: 'cerrar',
        antes: { estatus: 'en_cotizacion' }, despues: { estatus: 'cerrado' },
      });
      return { ok: true };
    });

    if (resultado.error === 404) return reply.code(404).send({ error: 'Proceso de cotización no encontrado' });
    if (resultado.error === 409) return reply.code(409).send({ error: resultado.mensaje });
    if (resultado.error === 422) return reply.code(422).send({ error: resultado.mensaje });
    return cargarProcesoCompleto(pool, id);
  });
}
