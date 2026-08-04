import { pool, withTransaction } from '../../db/pool.js';
import { registrarBitacora } from '../../lib/audit.js';
import { siguienteFolio } from '../../lib/folio.js';

async function cargarOcCompleta(client, id) {
  const { rows: cab } = await client.query(
    `SELECT oc.*, pr.razon_social AS proveedor_nombre, pr.rfc AS proveedor_rfc,
            pc.folio AS cotizacion_folio, u.nombre AS comprador_nombre
     FROM ordenes_compra oc
     JOIN proveedores pr ON pr.id = oc.proveedor_id
     LEFT JOIN procesos_cotizacion pc ON pc.id = oc.proceso_cotizacion_id
     JOIN usuarios u ON u.id = oc.usuario_compra_id
     WHERE oc.id = $1`,
    [id]
  );
  if (!cab[0]) return null;

  const { rows: detalle } = await client.query(
    `SELECT od.id, od.insumo_id, od.cantidad_pedida, od.precio_negociado, od.cantidad_surtida,
            i.clave, i.descripcion, i.unidad, COALESCE(fi.tolerancia_recepcion_pct, 0) AS tolerancia_recepcion_pct
     FROM oc_detalle od
     JOIN insumos i ON i.id = od.insumo_id
     LEFT JOIN familias_insumo fi ON fi.id = i.familia_id
     WHERE od.oc_id = $1 ORDER BY i.descripcion`,
    [id]
  );

  const { rows: requisiciones } = await client.query(
    `SELECT r.id, r.folio FROM oc_requisicion ocr JOIN requisiciones r ON r.id = ocr.requisicion_id
     WHERE ocr.oc_id = $1 ORDER BY r.folio`,
    [id]
  );

  return { ...cab[0], detalle, requisiciones };
}

export default async function ordenesCompraRoutes(app) {
  app.addHook('preHandler', app.authenticate);

  app.get('/api/ordenes-compra', async (request) => {
    const { estatus } = request.query;
    const condiciones = [];
    const valores = [];
    if (estatus) { valores.push(estatus); condiciones.push(`oc.estatus = $${valores.length}`); }
    const where = condiciones.length ? `WHERE ${condiciones.join(' AND ')}` : '';

    const { rows } = await pool.query(
      `SELECT oc.id, oc.folio, oc.estatus, oc.moneda, oc.creado_en, pr.razon_social AS proveedor_nombre,
              (SELECT COALESCE(SUM(cantidad_pedida * precio_negociado), 0) FROM oc_detalle WHERE oc_id = oc.id) AS importe_total
       FROM ordenes_compra oc
       JOIN proveedores pr ON pr.id = oc.proveedor_id
       ${where}
       ORDER BY oc.creado_en DESC LIMIT 200`,
      valores
    );
    return rows;
  });

  app.get('/api/ordenes-compra/:id', async (request, reply) => {
    const data = await cargarOcCompleta(pool, request.params.id);
    if (!data) return reply.code(404).send({ error: 'Orden de compra no encontrada' });
    return data;
  });

  app.post('/api/ordenes-compra/generar/:procesoId', { preHandler: app.requireRole('comprador', 'direccion') }, async (request, reply) => {
    const { procesoId } = request.params;

    try {
      const resultado = await withTransaction(async (client) => {
        const { rows: procRows } = await client.query('SELECT estatus FROM procesos_cotizacion WHERE id = $1 FOR UPDATE', [procesoId]);
        if (!procRows[0]) throw Object.assign(new Error('NOT_FOUND'), { code: 404 });
        if (procRows[0].estatus !== 'cerrado') throw Object.assign(new Error('NO_CERRADO'), { code: 409 });

        const { rows: existentes } = await client.query(
          `SELECT id FROM ordenes_compra WHERE proceso_cotizacion_id = $1 AND estatus != 'cancelada'`,
          [procesoId]
        );
        if (existentes.length > 0) throw Object.assign(new Error('YA_GENERADAS'), { code: 409 });

        const { rows: ganadores } = await client.query(
          `SELECT g.insumo_id, cd.precio_unitario, cp.proveedor_id, pr.moneda
           FROM proceso_cotizacion_ganador g
           JOIN cotizacion_detalle cd ON cd.id = g.cotizacion_detalle_id
           JOIN cotizaciones_proveedor cp ON cp.id = cd.cotizacion_proveedor_id
           JOIN proveedores pr ON pr.id = cp.proveedor_id
           WHERE g.proceso_id = $1`,
          [procesoId]
        );

        const porProveedor = new Map();
        for (const g of ganadores) {
          if (!porProveedor.has(g.proveedor_id)) porProveedor.set(g.proveedor_id, { moneda: g.moneda, items: [] });
          porProveedor.get(g.proveedor_id).items.push(g);
        }

        const ocsCreadas = [];
        for (const [proveedorId, grupo] of porProveedor) {
          const folio = await siguienteFolio(client, 'OC', 'oc_folio_seq');
          const { rows: ocRows } = await client.query(
            `INSERT INTO ordenes_compra (folio, proveedor_id, proceso_cotizacion_id, moneda, usuario_compra_id)
             VALUES ($1, $2, $3, $4, $5) RETURNING id`,
            [folio, proveedorId, procesoId, grupo.moneda, request.user.sub]
          );
          const ocId = ocRows[0].id;

          const insumoIds = grupo.items.map((i) => i.insumo_id);
          const { rows: cantidades } = await client.query(
            `SELECT rd.insumo_id, SUM(rd.cantidad_aprobada) AS cantidad
             FROM proceso_cotizacion_requisicion pcr
             JOIN requisicion_detalle rd ON rd.requisicion_id = pcr.requisicion_id
             WHERE pcr.proceso_id = $1 AND rd.insumo_id = ANY($2::int[])
             GROUP BY rd.insumo_id`,
            [procesoId, insumoIds]
          );
          const cantidadPorInsumo = new Map(cantidades.map((c) => [c.insumo_id, c.cantidad]));

          for (const item of grupo.items) {
            await client.query(
              `INSERT INTO oc_detalle (oc_id, insumo_id, cantidad_pedida, precio_negociado) VALUES ($1, $2, $3, $4)`,
              [ocId, item.insumo_id, cantidadPorInsumo.get(item.insumo_id) ?? 0, item.precio_unitario]
            );
          }

          const { rows: reqsInvolucradas } = await client.query(
            `SELECT DISTINCT pcr.requisicion_id
             FROM proceso_cotizacion_requisicion pcr
             JOIN requisicion_detalle rd ON rd.requisicion_id = pcr.requisicion_id
             WHERE pcr.proceso_id = $1 AND rd.insumo_id = ANY($2::int[])`,
            [procesoId, insumoIds]
          );
          for (const r of reqsInvolucradas) {
            await client.query('INSERT INTO oc_requisicion (oc_id, requisicion_id) VALUES ($1, $2)', [ocId, r.requisicion_id]);
          }

          await registrarBitacora(client, {
            tabla: 'ordenes_compra', registroId: ocId, usuarioId: request.user.sub,
            accion: 'generar_desde_cotizacion', despues: { folio, procesoId, proveedorId },
          });

          ocsCreadas.push(await cargarOcCompleta(client, ocId));
        }

        return ocsCreadas;
      });

      return reply.code(201).send(resultado);
    } catch (err) {
      if (err.code === 404) return reply.code(404).send({ error: 'Proceso de cotización no encontrado' });
      if (err.code === 409 && err.message === 'NO_CERRADO') return reply.code(409).send({ error: 'El proceso de cotización debe estar cerrado para generar la(s) Orden(es) de Compra' });
      if (err.code === 409 && err.message === 'YA_GENERADAS') return reply.code(409).send({ error: 'Ya se generaron órdenes de compra para este proceso' });
      request.log.error(err);
      return reply.code(500).send({ error: 'No se pudo(eron) generar la(s) Orden(es) de Compra' });
    }
  });

  app.post('/api/ordenes-compra/:id/confirmar', { preHandler: app.requireRole('comprador', 'direccion') }, async (request, reply) => {
    const { id } = request.params;
    const resultado = await withTransaction(async (client) => {
      const { rows } = await client.query('SELECT estatus FROM ordenes_compra WHERE id = $1 FOR UPDATE', [id]);
      if (!rows[0]) return { error: 404 };
      if (rows[0].estatus !== 'borrador') return { error: 409, mensaje: 'Solo una OC en borrador puede confirmarse' };

      await client.query(
        "UPDATE ordenes_compra SET estatus = 'confirmada', confirmada_en = now() WHERE id = $1",
        [id]
      );
      await registrarBitacora(client, {
        tabla: 'ordenes_compra', registroId: id, usuarioId: request.user.sub, accion: 'confirmar',
        antes: { estatus: 'borrador' }, despues: { estatus: 'confirmada' },
      });
      return { ok: true };
    });

    if (resultado.error === 404) return reply.code(404).send({ error: 'Orden de compra no encontrada' });
    if (resultado.error === 409) return reply.code(409).send({ error: resultado.mensaje });
    return cargarOcCompleta(pool, id);
  });
}
