import { pool, withTransaction } from '../../db/pool.js';
import { registrarBitacora } from '../../lib/audit.js';
import { siguienteFolio } from '../../lib/folio.js';
import { actualizarEstatusPagoFactura } from '../facturas/routes.js';

async function cargarPagoCompleto(client, id) {
  const { rows: cab } = await client.query(
    `SELECT p.*, pr.razon_social AS proveedor_nombre, u.nombre AS registro_nombre
     FROM pagos_proveedor p JOIN proveedores pr ON pr.id = p.proveedor_id JOIN usuarios u ON u.id = p.usuario_registro_id
     WHERE p.id = $1`,
    [id]
  );
  if (!cab[0]) return null;

  const { rows: aplicaciones } = await client.query(
    `SELECT pf.factura_id, pf.monto_aplicado, f.folio AS factura_folio, f.total AS factura_total
     FROM pago_factura pf JOIN facturas f ON f.id = pf.factura_id WHERE pf.pago_id = $1`,
    [id]
  );

  return { ...cab[0], aplicaciones };
}

export default async function pagosRoutes(app) {
  app.addHook('preHandler', app.authenticate);

  app.get('/api/pagos-proveedor', async (request) => {
    const { proveedorId } = request.query;
    const condiciones = [];
    const valores = [];
    if (proveedorId) { valores.push(proveedorId); condiciones.push(`p.proveedor_id = $${valores.length}`); }
    const where = condiciones.length ? `WHERE ${condiciones.join(' AND ')}` : '';

    const { rows } = await pool.query(
      `SELECT p.id, p.folio, p.fecha, p.monto, p.moneda, p.forma_pago, pr.razon_social AS proveedor_nombre
       FROM pagos_proveedor p JOIN proveedores pr ON pr.id = p.proveedor_id
       ${where} ORDER BY p.creado_en DESC LIMIT 200`,
      valores
    );
    return rows;
  });

  app.get('/api/pagos-proveedor/:id', async (request, reply) => {
    const data = await cargarPagoCompleto(pool, request.params.id);
    if (!data) return reply.code(404).send({ error: 'Pago no encontrado' });
    return data;
  });

  app.get('/api/proveedores/:id/estado-cuenta', async (request) => {
    const { id } = request.params;
    const { rows: facturas } = await pool.query(
      `SELECT f.id, f.folio, f.total, f.moneda, f.fecha, f.estatus_pago,
              (SELECT COALESCE(SUM(monto_aplicado), 0) FROM pago_factura WHERE factura_id = f.id) AS monto_pagado
       FROM facturas f WHERE f.proveedor_id = $1 ORDER BY f.fecha DESC`,
      [id]
    );
    const { rows: pagos } = await pool.query(
      `SELECT id, folio, fecha, monto, moneda, forma_pago FROM pagos_proveedor WHERE proveedor_id = $1 ORDER BY fecha DESC`,
      [id]
    );
    return {
      facturas: facturas.map((f) => ({ ...f, saldo: Number(f.total) - Number(f.monto_pagado) })),
      pagos,
    };
  });

  app.post('/api/pagos-proveedor', { preHandler: app.requireRole('comprador', 'direccion') }, async (request, reply) => {
    const { proveedorId, monto, moneda, formaPago, referencia, aplicaciones } = request.body ?? {};
    if (!proveedorId || !monto || !formaPago?.trim() || !Array.isArray(aplicaciones) || aplicaciones.length === 0) {
      return reply.code(400).send({ error: 'Proveedor, monto, forma de pago y al menos una factura aplicada son obligatorios' });
    }

    const sumaAplicada = aplicaciones.reduce((s, a) => s + Number(a.montoAplicado), 0);
    if (sumaAplicada > Number(monto) + 0.01) {
      return reply.code(422).send({ error: 'La suma aplicada a facturas no puede ser mayor al monto del pago' });
    }

    try {
      const resultado = await withTransaction(async (client) => {
        const { rows: facturas } = await client.query(
          `SELECT f.id, f.total, f.proveedor_id,
                  (SELECT COALESCE(SUM(monto_aplicado), 0) FROM pago_factura WHERE factura_id = f.id) AS ya_pagado
           FROM facturas f WHERE f.id = ANY($1::int[]) FOR UPDATE`,
          [aplicaciones.map((a) => a.facturaId)]
        );
        const porFactura = new Map(facturas.map((f) => [f.id, f]));

        const invalidas = [];
        for (const ap of aplicaciones) {
          const f = porFactura.get(ap.facturaId);
          const saldo = f ? Number(f.total) - Number(f.ya_pagado) : 0;
          if (!f || f.proveedor_id !== Number(proveedorId) || Number(ap.montoAplicado) > saldo + 0.01) {
            invalidas.push({ facturaId: ap.facturaId, saldoDisponible: saldo });
          }
        }
        if (invalidas.length > 0) {
          throw Object.assign(new Error('SALDO_INSUFICIENTE'), { code: 422, detalle: invalidas });
        }

        const folio = await siguienteFolio(client, 'PAG', 'pagos_folio_seq');
        const { rows: pagoRows } = await client.query(
          `INSERT INTO pagos_proveedor (folio, proveedor_id, monto, moneda, forma_pago, referencia, usuario_registro_id)
           VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING id`,
          [folio, proveedorId, monto, moneda || 'MXN', formaPago.trim(), referencia?.trim() || null, request.user.sub]
        );
        const pagoId = pagoRows[0].id;

        for (const ap of aplicaciones) {
          await client.query('INSERT INTO pago_factura (pago_id, factura_id, monto_aplicado) VALUES ($1, $2, $3)', [
            pagoId, ap.facturaId, ap.montoAplicado,
          ]);
          await actualizarEstatusPagoFactura(client, ap.facturaId);
        }

        await registrarBitacora(client, {
          tabla: 'pagos_proveedor', registroId: pagoId, usuarioId: request.user.sub,
          accion: 'crear', despues: { folio, proveedorId, monto, aplicaciones },
        });

        return cargarPagoCompleto(client, pagoId);
      });

      return reply.code(201).send(resultado);
    } catch (err) {
      if (err.code === 422) return reply.code(422).send({ error: 'Una o más facturas no tienen saldo suficiente para aplicar ese monto', detalle: err.detalle });
      request.log.error(err);
      return reply.code(500).send({ error: 'No se pudo registrar el pago' });
    }
  });
}
