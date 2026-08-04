import { pool, withTransaction } from '../../db/pool.js';
import { registrarBitacora } from '../../lib/audit.js';
import { siguienteFolio } from '../../lib/folio.js';
import { guardarArchivo } from '../../lib/storage.js';

async function disponibleParaFacturar(client, ocId) {
  const { rows } = await client.query(
    `SELECT od.insumo_id, i.clave, i.descripcion, i.unidad, od.cantidad_pedida, od.precio_negociado,
            COALESCE((
              SELECT SUM(ed.cantidad_recibida) FROM entrada_detalle ed
              JOIN entradas_almacen ea ON ea.id = ed.entrada_id
              WHERE ea.oc_id = od.oc_id AND ed.insumo_id = od.insumo_id
            ), 0) AS recibido,
            COALESCE((
              SELECT SUM(fd.cantidad) FROM factura_detalle fd
              JOIN facturas f ON f.id = fd.factura_id
              WHERE f.oc_id = od.oc_id AND fd.insumo_id = od.insumo_id
            ), 0) AS facturado
     FROM oc_detalle od JOIN insumos i ON i.id = od.insumo_id
     WHERE od.oc_id = $1`,
    [ocId]
  );
  return rows.map((r) => ({ ...r, disponible: Number(r.recibido) - Number(r.facturado) }));
}

async function actualizarEstatusPagoFactura(client, facturaId) {
  const { rows: fac } = await client.query('SELECT total FROM facturas WHERE id = $1', [facturaId]);
  const { rows: pagos } = await client.query(
    'SELECT COALESCE(SUM(monto_aplicado), 0) AS aplicado FROM pago_factura WHERE factura_id = $1',
    [facturaId]
  );
  const aplicado = Number(pagos[0].aplicado);
  const total = Number(fac[0].total);
  const estatus = aplicado <= 0 ? 'pendiente' : aplicado >= total ? 'pagada_total' : 'pagada_parcial';
  await client.query('UPDATE facturas SET estatus_pago = $2 WHERE id = $1', [facturaId, estatus]);
}

async function cargarFacturaCompleta(client, id) {
  const { rows: cab } = await client.query(
    `SELECT f.*, pr.razon_social AS proveedor_nombre, oc.folio AS oc_folio, u.nombre AS captura_nombre,
            (SELECT COALESCE(SUM(monto_aplicado), 0) FROM pago_factura WHERE factura_id = f.id) AS monto_pagado
     FROM facturas f
     JOIN proveedores pr ON pr.id = f.proveedor_id
     JOIN ordenes_compra oc ON oc.id = f.oc_id
     JOIN usuarios u ON u.id = f.usuario_captura_id
     WHERE f.id = $1`,
    [id]
  );
  if (!cab[0]) return null;

  const { rows: detalle } = await client.query(
    `SELECT fd.*, i.clave, i.descripcion, i.unidad FROM factura_detalle fd JOIN insumos i ON i.id = fd.insumo_id WHERE fd.factura_id = $1`,
    [id]
  );

  return { ...cab[0], detalle };
}

export default async function facturasRoutes(app) {
  app.addHook('preHandler', app.authenticate);

  app.get('/api/facturas/disponible/:ocId', async (request) => {
    return disponibleParaFacturar(pool, request.params.ocId);
  });

  app.get('/api/facturas', async (request) => {
    const { proveedorId, estatusPago } = request.query;
    const condiciones = [];
    const valores = [];
    if (proveedorId) { valores.push(proveedorId); condiciones.push(`f.proveedor_id = $${valores.length}`); }
    if (estatusPago) { valores.push(estatusPago); condiciones.push(`f.estatus_pago = $${valores.length}`); }
    const where = condiciones.length ? `WHERE ${condiciones.join(' AND ')}` : '';

    const { rows } = await pool.query(
      `SELECT f.id, f.folio, f.serie_folio, f.total, f.moneda, f.fecha, f.estatus_pago,
              pr.razon_social AS proveedor_nombre, oc.folio AS oc_folio,
              (SELECT COALESCE(SUM(monto_aplicado), 0) FROM pago_factura WHERE factura_id = f.id) AS monto_pagado
       FROM facturas f
       JOIN proveedores pr ON pr.id = f.proveedor_id
       JOIN ordenes_compra oc ON oc.id = f.oc_id
       ${where}
       ORDER BY f.creado_en DESC LIMIT 200`,
      valores
    );
    return rows;
  });

  app.get('/api/facturas/:id', async (request, reply) => {
    const data = await cargarFacturaCompleta(pool, request.params.id);
    if (!data) return reply.code(404).send({ error: 'Factura no encontrada' });
    return data;
  });

  app.post('/api/facturas', { preHandler: app.requireRole('comprador', 'direccion') }, async (request, reply) => {
    const fields = {};
    const archivos = {};
    for await (const part of request.parts()) {
      if (part.type === 'file') {
        archivos[part.fieldname] = { buffer: await part.toBuffer(), filename: part.filename };
      } else {
        fields[part.fieldname] = part.value;
      }
    }

    const ocId = Number(fields.ocId);
    const subtotal = Number(fields.subtotal);
    const iva = Number(fields.iva || 0);
    let detalle;
    try {
      detalle = JSON.parse(fields.detalle || '[]');
    } catch {
      return reply.code(400).send({ error: 'Detalle de factura inválido' });
    }

    if (!ocId || !subtotal || !Array.isArray(detalle) || detalle.length === 0) {
      return reply.code(400).send({ error: 'OC, subtotal y al menos un renglón facturado son obligatorios' });
    }

    try {
      const resultado = await withTransaction(async (client) => {
        const { rows: ocRows } = await client.query('SELECT proveedor_id FROM ordenes_compra WHERE id = $1 FOR UPDATE', [ocId]);
        if (!ocRows[0]) throw Object.assign(new Error('NOT_FOUND'), { code: 404 });

        const disponible = await disponibleParaFacturar(client, ocId);
        const porInsumo = new Map(disponible.map((d) => [d.insumo_id, d]));

        const excedidos = [];
        for (const item of detalle) {
          const linea = porInsumo.get(item.insumoId);
          const disp = linea ? linea.disponible : 0;
          if (!linea || Number(item.cantidad) > disp) {
            excedidos.push({ insumoId: item.insumoId, disponible: disp });
          }
        }
        if (excedidos.length > 0) {
          throw Object.assign(new Error('ANTIFRAUDE'), { code: 422, detalle: excedidos });
        }

        let xmlUrl = null;
        let pdfUrl = null;
        if (archivos.xml) xmlUrl = await guardarArchivo(archivos.xml.buffer, archivos.xml.filename, 'facturas');
        if (archivos.pdf) pdfUrl = await guardarArchivo(archivos.pdf.buffer, archivos.pdf.filename, 'facturas');

        const folio = await siguienteFolio(client, 'FAC', 'facturas_folio_seq');
        const total = subtotal + iva;
        const { rows: facRows } = await client.query(
          `INSERT INTO facturas (folio, folio_fiscal_uuid, serie_folio, proveedor_id, oc_id, subtotal, iva, total, moneda, fecha, xml_url, pdf_url, usuario_captura_id)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, COALESCE($10, current_date), $11, $12, $13) RETURNING id`,
          [
            folio, fields.folioFiscalUuid || null, fields.serieFolio || null, ocRows[0].proveedor_id, ocId,
            subtotal, iva, total, fields.moneda || 'MXN', fields.fecha || null, xmlUrl, pdfUrl, request.user.sub,
          ]
        );
        const facturaId = facRows[0].id;

        for (const item of detalle) {
          await client.query(
            `INSERT INTO factura_detalle (factura_id, insumo_id, cantidad, precio_unitario) VALUES ($1, $2, $3, $4)`,
            [facturaId, item.insumoId, item.cantidad, item.precioUnitario]
          );
        }

        await registrarBitacora(client, {
          tabla: 'facturas', registroId: facturaId, usuarioId: request.user.sub,
          accion: 'crear', despues: { folio, ocId, total, detalle },
        });

        return cargarFacturaCompleta(client, facturaId);
      });

      return reply.code(201).send(resultado);
    } catch (err) {
      if (err.code === 404) return reply.code(404).send({ error: 'Orden de compra no encontrada' });
      if (err.code === 422) {
        return reply.code(422).send({
          error: 'Validación antifraude: uno o más insumos facturan más de lo físicamente recibido y no vinculado a factura previa',
          detalle: err.detalle,
        });
      }
      request.log.error(err);
      return reply.code(500).send({ error: 'No se pudo registrar la factura' });
    }
  });

}

export { actualizarEstatusPagoFactura };
