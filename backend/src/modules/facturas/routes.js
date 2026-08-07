import { pool, withTransaction } from '../../db/pool.js';
import { registrarBitacora } from '../../lib/audit.js';
import { siguienteFolio } from '../../lib/folio.js';
import { guardarArchivo } from '../../lib/storage.js';
import { registrarFirma } from '../../lib/firma.js';
import { notificarPorRol } from '../../lib/notificaciones.js';

// Bloque 16: cambio de precio. 5% de desviación ARRIBA de lo negociado en la OC dispara la
// alerta y requiere autorización de Dirección antes de poder aplicarle un pago a la factura.
const UMBRAL_VARIACION_PRECIO = 0.05;

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
    `SELECT fd.*, i.clave, i.descripcion, i.unidad, od.precio_negociado,
            CASE WHEN od.precio_negociado > 0
                 THEN round(((fd.precio_unitario - od.precio_negociado) / od.precio_negociado) * 100, 2)
                 ELSE NULL END AS variacion_pct,
            COALESCE(od.precio_negociado > 0 AND fd.precio_unitario > od.precio_negociado * (1 + $2::numeric), false) AS excede_variacion_precio
     FROM factura_detalle fd
     JOIN insumos i ON i.id = fd.insumo_id
     LEFT JOIN oc_detalle od ON od.oc_id = $3 AND od.insumo_id = fd.insumo_id
     WHERE fd.factura_id = $1`,
    [id, UMBRAL_VARIACION_PRECIO, cab[0].oc_id]
  );

  // Bloque de trazabilidad (07/08/2026): entradas de almacén (remisiones) que el usuario ligó
  // a esta factura al capturarla — no es parte del three-way matching (que sigue comparando
  // factura vs. OC), es información adicional de a qué recepción física corresponde.
  const { rows: entradas } = await client.query(
    `SELECT ea.id, ea.folio, ea.remision_proveedor, ea.fecha
     FROM factura_entrada fe JOIN entradas_almacen ea ON ea.id = fe.entrada_id
     WHERE fe.factura_id = $1 ORDER BY ea.fecha`,
    [id]
  );

  return {
    ...cab[0],
    detalle,
    entradas,
    hayVariacionSinAutorizar: detalle.some((d) => d.excede_variacion_precio) && !cab[0].variacion_precio_autorizada,
  };
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
    let entradaIds;
    try {
      entradaIds = JSON.parse(fields.entradaIds || '[]');
    } catch {
      return reply.code(400).send({ error: 'Entradas relacionadas inválidas' });
    }

    if (!ocId || !subtotal || !Array.isArray(detalle) || detalle.length === 0) {
      return reply.code(400).send({ error: 'OC, subtotal y al menos un renglón facturado son obligatorios' });
    }

    try {
      const resultado = await withTransaction(async (client) => {
        const { rows: ocRows } = await client.query('SELECT proveedor_id, folio FROM ordenes_compra WHERE id = $1 FOR UPDATE', [ocId]);
        if (!ocRows[0]) throw Object.assign(new Error('NOT_FOUND'), { code: 404 });

        let entradaIdsValidos = [];
        if (Array.isArray(entradaIds) && entradaIds.length > 0) {
          const { rows: entradasOc } = await client.query(
            'SELECT id FROM entradas_almacen WHERE oc_id = $1 AND id = ANY($2::int[])',
            [ocId, entradaIds]
          );
          if (entradasOc.length !== entradaIds.length) {
            throw Object.assign(new Error('ENTRADA_FUERA_DE_OC'), { code: 400 });
          }
          entradaIdsValidos = entradasOc.map((e) => e.id);
        }

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

        const excedeVariacion = detalle.some((item) => {
          const linea = porInsumo.get(item.insumoId);
          const negociado = Number(linea?.precio_negociado || 0);
          return negociado > 0 && Number(item.precioUnitario) > negociado * (1 + UMBRAL_VARIACION_PRECIO);
        });

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

        for (const entradaId of entradaIdsValidos) {
          await client.query(
            `INSERT INTO factura_entrada (factura_id, entrada_id) VALUES ($1, $2) ON CONFLICT DO NOTHING`,
            [facturaId, entradaId]
          );
        }

        await registrarBitacora(client, {
          tabla: 'facturas', registroId: facturaId, usuarioId: request.user.sub,
          accion: 'crear', despues: { folio, ocId, total, detalle },
        });

        if (excedeVariacion) {
          await notificarPorRol(client, {
            roles: ['direccion'],
            categoria: 'cambio_precio',
            entidadTipo: 'factura',
            entidadId: facturaId,
            titulo: `Variación de precio en factura ${folio}`,
            mensaje: `Uno o más insumos facturados están 5% o más arriba de lo negociado en ${ocRows[0].folio}. Requiere tu autorización antes de poder pagarse.`,
          });
        }

        return cargarFacturaCompleta(client, facturaId);
      });

      return reply.code(201).send(resultado);
    } catch (err) {
      if (err.code === 404) return reply.code(404).send({ error: 'Orden de compra no encontrada' });
      if (err.code === 400) return reply.code(400).send({ error: 'Una de las entradas seleccionadas no pertenece a esta Orden de Compra' });
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

  // Bloque 16: Dirección autoriza explícitamente la variación de precio de una factura antes de
  // que se le pueda aplicar un pago.
  app.post('/api/facturas/:id/autorizar-variacion', { preHandler: app.requireRole('direccion') }, async (request, reply) => {
    const { id } = request.params;
    const { firma } = request.body ?? {};
    try {
      const resultado = await withTransaction(async (client) => {
        const { rows } = await client.query('SELECT id FROM facturas WHERE id = $1 FOR UPDATE', [id]);
        if (!rows[0]) throw Object.assign(new Error('NOT_FOUND'), { code: 404 });

        await registrarFirma(client, { request, entidadTipo: 'factura_variacion_precio', entidadId: id, firma });
        await client.query(
          `UPDATE facturas SET variacion_precio_autorizada = true, variacion_precio_autorizada_por = $2, variacion_precio_autorizada_en = now() WHERE id = $1`,
          [id, request.user.sub]
        );
        await registrarBitacora(client, {
          tabla: 'facturas', registroId: id, usuarioId: request.user.sub, accion: 'autorizar_variacion_precio',
        });
        return cargarFacturaCompleta(client, id);
      });
      return resultado;
    } catch (err) {
      if (err.code === 404) return reply.code(404).send({ error: 'Factura no encontrada' });
      if (err.message === 'FIRMA_REQUERIDA') return reply.code(400).send({ error: 'Se requiere firma (táctil o PIN) para autorizar' });
      if (err.message === 'SIN_PIN_CONFIGURADO') return reply.code(400).send({ error: 'Aún no configuras tu PIN de firma. Ve a tu perfil para crearlo.' });
      if (err.message === 'PIN_INCORRECTO') return reply.code(422).send({ error: 'PIN incorrecto' });
      if (err.message === 'FIRMA_TACTIL_INVALIDA') return reply.code(400).send({ error: 'La firma táctil capturada no es válida, intenta de nuevo' });
      request.log.error(err);
      return reply.code(500).send({ error: 'No se pudo registrar la autorización' });
    }
  });

}

export { actualizarEstatusPagoFactura };
