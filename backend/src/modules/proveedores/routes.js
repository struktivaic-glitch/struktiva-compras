import { pool } from '../../db/pool.js';
import { registrarBitacora } from '../../lib/audit.js';

export default async function proveedoresRoutes(app) {
  app.addHook('preHandler', app.authenticate);

  app.get('/api/proveedores', async (request) => {
    const soloActivos = request.query.incluirInactivos !== '1';
    const { rows } = await pool.query(
      `SELECT id, rfc, razon_social, dias_credito, moneda, contacto, activo
       FROM proveedores ${soloActivos ? 'WHERE activo' : ''} ORDER BY razon_social`
    );
    return rows;
  });

  app.post('/api/proveedores', { preHandler: app.requireRole('comprador', 'direccion') }, async (request, reply) => {
    const { rfc, razonSocial, diasCredito, moneda, contacto } = request.body ?? {};
    if (!razonSocial?.trim()) {
      return reply.code(400).send({ error: 'La razón social es obligatoria' });
    }
    const { rows } = await pool.query(
      `INSERT INTO proveedores (rfc, razon_social, dias_credito, moneda, contacto)
       VALUES ($1, $2, $3, $4, $5) RETURNING id, rfc, razon_social, dias_credito, moneda, contacto, activo`,
      [rfc?.trim() || null, razonSocial.trim(), diasCredito || 0, moneda || 'MXN', contacto?.trim() || null]
    );
    return reply.code(201).send(rows[0]);
  });

  app.put('/api/proveedores/:id', { preHandler: app.requireRole('comprador', 'direccion') }, async (request, reply) => {
    const { id } = request.params;
    const { rfc, razonSocial, diasCredito, moneda, contacto, activo } = request.body ?? {};
    if (!razonSocial?.trim()) {
      return reply.code(400).send({ error: 'La razón social es obligatoria' });
    }
    const { rows } = await pool.query(
      `UPDATE proveedores SET rfc = $2, razon_social = $3, dias_credito = $4, moneda = $5, contacto = $6, activo = $7
       WHERE id = $1 RETURNING id, rfc, razon_social, dias_credito, moneda, contacto, activo`,
      [id, rfc?.trim() || null, razonSocial.trim(), diasCredito || 0, moneda || 'MXN', contacto?.trim() || null, activo ?? true]
    );
    if (!rows[0]) return reply.code(404).send({ error: 'Proveedor no encontrado' });

    await registrarBitacora(pool, {
      tabla: 'proveedores', registroId: id, usuarioId: request.user.sub, accion: 'editar',
      despues: { rfc, razonSocial, diasCredito, moneda, contacto, activo },
    });
    return rows[0];
  });
}
