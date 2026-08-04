import { pool } from '../../db/pool.js';

export default async function expedienteRoutes(app) {
  app.addHook('preHandler', app.authenticate);

  app.get('/api/expediente/requisicion/:id', async (request, reply) => {
    const { id } = request.params;

    const { rows: reqRows } = await pool.query(
      `SELECT r.id, r.folio, r.estatus, r.creado_en, r.frente_id,
              o.nombre AS obra_nombre, f.nombre AS frente_nombre, p.nombre AS partida_nombre,
              us.nombre AS solicitante_nombre
       FROM requisiciones r
       JOIN obras o ON o.id = r.obra_id JOIN frentes f ON f.id = r.frente_id
       JOIN partidas p ON p.id = r.partida_id JOIN usuarios us ON us.id = r.usuario_solicitante_id
       WHERE r.id = $1`,
      [id]
    );
    const requisicion = reqRows[0];
    if (!requisicion) return reply.code(404).send({ error: 'Requisición no encontrada' });

    const { rows: insumosReq } = await pool.query(
      `SELECT insumo_id FROM requisicion_detalle WHERE requisicion_id = $1`,
      [id]
    );
    const insumoIds = insumosReq.map((r) => r.insumo_id);

    const { rows: cotizaciones } = await pool.query(
      `SELECT pc.id, pc.folio, pc.estatus
       FROM proceso_cotizacion_requisicion pcr JOIN procesos_cotizacion pc ON pc.id = pcr.proceso_id
       WHERE pcr.requisicion_id = $1`,
      [id]
    );

    const { rows: ordenesCompra } = await pool.query(
      `SELECT oc.id, oc.folio, oc.estatus, pr.razon_social AS proveedor_nombre,
              (SELECT COALESCE(SUM(cantidad_pedida * precio_negociado), 0) FROM oc_detalle WHERE oc_id = oc.id) AS importe_total
       FROM oc_requisicion ocr JOIN ordenes_compra oc ON oc.id = ocr.oc_id JOIN proveedores pr ON pr.id = oc.proveedor_id
       WHERE ocr.requisicion_id = $1
       ORDER BY oc.creado_en`,
      [id]
    );
    const ocIds = ordenesCompra.map((o) => o.id);

    let entradas = [];
    let facturas = [];
    if (ocIds.length > 0) {
      const { rows } = await pool.query(
        `SELECT ea.id, ea.folio, ea.remision_proveedor, ea.fecha, ea.oc_id,
                EXISTS (SELECT 1 FROM entrada_detalle ed WHERE ed.entrada_id = ea.id AND ed.cantidad_excedente > 0) AS tiene_excedente
         FROM entradas_almacen ea WHERE ea.oc_id = ANY($1::int[]) ORDER BY ea.creado_en`,
        [ocIds]
      );
      entradas = rows;

      const { rows: facRows } = await pool.query(
        `SELECT f.id, f.folio, f.total, f.moneda, f.estatus_pago, f.oc_id,
                (SELECT COALESCE(SUM(monto_aplicado), 0) FROM pago_factura WHERE factura_id = f.id) AS monto_pagado
         FROM facturas f WHERE f.oc_id = ANY($1::int[]) ORDER BY f.creado_en`,
        [ocIds]
      );
      facturas = facRows;
    }

    const facturaIds = facturas.map((f) => f.id);
    let pagos = [];
    if (facturaIds.length > 0) {
      const { rows } = await pool.query(
        `SELECT DISTINCT p.id, p.folio, p.monto, p.moneda, p.fecha, p.forma_pago
         FROM pago_factura pf JOIN pagos_proveedor p ON p.id = pf.pago_id
         WHERE pf.factura_id = ANY($1::int[]) ORDER BY p.fecha`,
        [facturaIds]
      );
      pagos = rows;
    }

    // Salidas de almacén no están ligadas 1:1 a una requisición en el modelo actual (ver NOTAS.md);
    // se muestran como "relacionadas" por coincidir frente + alguno de los insumos de esta requisición.
    let salidasRelacionadas = [];
    if (insumoIds.length > 0) {
      const { rows } = await pool.query(
        `SELECT DISTINCT sa.id, sa.folio, sa.fecha, sa.usuario_recibe_nombre
         FROM salidas_almacen sa JOIN salida_detalle sd ON sd.salida_id = sa.id
         WHERE sa.frente_id = $1 AND sd.insumo_id = ANY($2::int[])
         ORDER BY sa.fecha`,
        [requisicion.frente_id, insumoIds]
      );
      salidasRelacionadas = rows;
    }

    return { requisicion, cotizaciones, ordenesCompra, entradas, salidasRelacionadas, facturas, pagos };
  });
}
