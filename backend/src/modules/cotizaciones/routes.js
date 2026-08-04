import { pool, withTransaction } from '../../db/pool.js';
import { registrarBitacora } from '../../lib/audit.js';
import { siguienteFolio } from '../../lib/folio.js';

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
    `SELECT insumo_id, cotizacion_detalle_id FROM proceso_cotizacion_ganador WHERE proceso_id = $1`,
    [id]
  );

  return {
    ...cab[0],
    requisiciones,
    insumos,
    proveedores: proveedores.map((p) => ({ ...p, detalle: detalle.filter((d) => d.cotizacion_proveedor_id === p.id) })),
    ganadores,
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
      `SELECT cd.id FROM cotizacion_detalle cd
       JOIN cotizaciones_proveedor cp ON cp.id = cd.cotizacion_proveedor_id
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

    return cargarProcesoCompleto(pool, id);
  });

  app.post('/api/cotizaciones/:id/cerrar', { preHandler: app.requireRole('comprador', 'direccion') }, async (request, reply) => {
    const { id } = request.params;
    const resultado = await withTransaction(async (client) => {
      const { rows: procRows } = await client.query('SELECT estatus FROM procesos_cotizacion WHERE id = $1 FOR UPDATE', [id]);
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
