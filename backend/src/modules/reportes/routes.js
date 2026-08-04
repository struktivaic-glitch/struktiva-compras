import { pool } from '../../db/pool.js';

export default async function reportesRoutes(app) {
  app.addHook('preHandler', app.authenticate);

  app.get('/api/reportes/explosion-vs-real', async (request, reply) => {
    const { obraId } = request.query;
    if (!obraId) return reply.code(400).send({ error: 'obraId es obligatorio' });

    const { rows } = await pool.query(
      `WITH presupuesto AS (
         SELECT poi.insumo_id, poi.cantidad_presupuestada AS cant_presupuestada,
                poi.cantidad_presupuestada * poi.costo_unitario AS presupuestado
         FROM presupuesto_obra_insumo poi
         WHERE poi.obra_id = $1
       ),
       requerido AS (
         SELECT rd.insumo_id, SUM(rd.cantidad_aprobada) AS cant, SUM(rd.cantidad_aprobada * poi.costo_unitario) AS importe
         FROM requisicion_detalle rd
         JOIN requisiciones r ON r.id = rd.requisicion_id
         JOIN presupuesto_obra_insumo poi ON poi.obra_id = r.obra_id AND poi.insumo_id = rd.insumo_id
         WHERE r.obra_id = $1 AND r.estatus IN ('autorizada', 'atendida_parcial', 'atendida_total')
         GROUP BY rd.insumo_id
       ),
       oc_scope AS (
         SELECT DISTINCT ocr.oc_id FROM oc_requisicion ocr JOIN requisiciones r ON r.id = ocr.requisicion_id WHERE r.obra_id = $1
       ),
       comprado AS (
         SELECT od.insumo_id, SUM(od.cantidad_pedida) AS cant, SUM(od.cantidad_pedida * od.precio_negociado) AS importe
         FROM oc_detalle od WHERE od.oc_id IN (SELECT oc_id FROM oc_scope) GROUP BY od.insumo_id
       ),
       recibido AS (
         SELECT ed.insumo_id, SUM(ed.cantidad_recibida) AS cant
         FROM entrada_detalle ed JOIN entradas_almacen ea ON ea.id = ed.entrada_id
         WHERE ea.oc_id IN (SELECT oc_id FROM oc_scope) GROUP BY ed.insumo_id
       ),
       facturado AS (
         SELECT fd.insumo_id, SUM(fd.cantidad) AS cant, SUM(fd.cantidad * fd.precio_unitario) AS importe
         FROM factura_detalle fd JOIN facturas f ON f.id = fd.factura_id
         WHERE f.oc_id IN (SELECT oc_id FROM oc_scope) GROUP BY fd.insumo_id
       )
       SELECT i.id AS insumo_id, i.clave, i.descripcion, i.unidad, fi.nombre AS familia_nombre,
              COALESCE(pr.cant_presupuestada, 0) AS cant_presupuestada, COALESCE(pr.presupuestado, 0) AS presupuestado,
              COALESCE(rq.cant, 0) AS cant_requerida, COALESCE(rq.importe, 0) AS importe_requerido,
              COALESCE(cp.cant, 0) AS cant_comprada, COALESCE(cp.importe, 0) AS importe_comprado,
              COALESCE(rc.cant, 0) AS cant_recibida,
              COALESCE(fa.cant, 0) AS cant_facturada, COALESCE(fa.importe, 0) AS importe_facturado
       FROM insumos i
       JOIN presupuesto pr ON pr.insumo_id = i.id
       LEFT JOIN familias_insumo fi ON fi.id = i.familia_id
       LEFT JOIN requerido rq ON rq.insumo_id = i.id
       LEFT JOIN comprado cp ON cp.insumo_id = i.id
       LEFT JOIN recibido rc ON rc.insumo_id = i.id
       LEFT JOIN facturado fa ON fa.insumo_id = i.id
       ORDER BY fi.nombre, i.descripcion`,
      [obraId]
    );
    return rows;
  });

  app.get('/api/reportes/variacion-precios', async (request, reply) => {
    const { obraId } = request.query;
    if (!obraId) return reply.code(400).send({ error: 'obraId es obligatorio' });

    const { rows } = await pool.query(
      `WITH oc_scope AS (
         SELECT DISTINCT ocr.oc_id FROM oc_requisicion ocr JOIN requisiciones r ON r.id = ocr.requisicion_id WHERE r.obra_id = $1
       )
       SELECT od.insumo_id, i.clave, i.descripcion, i.unidad, oc.folio AS oc_folio, pr.razon_social AS proveedor_nombre,
              poi.costo_unitario AS costo_presupuesto, od.precio_negociado AS costo_real,
              (od.precio_negociado - poi.costo_unitario) AS variacion_absoluta,
              CASE WHEN poi.costo_unitario > 0 THEN (od.precio_negociado - poi.costo_unitario) / poi.costo_unitario * 100 ELSE NULL END AS variacion_pct
       FROM oc_detalle od
       JOIN ordenes_compra oc ON oc.id = od.oc_id
       JOIN proveedores pr ON pr.id = oc.proveedor_id
       JOIN insumos i ON i.id = od.insumo_id
       LEFT JOIN presupuesto_obra_insumo poi ON poi.obra_id = $1 AND poi.insumo_id = od.insumo_id
       WHERE od.oc_id IN (SELECT oc_id FROM oc_scope)
       ORDER BY i.descripcion`,
      [obraId]
    );
    return rows;
  });
}
