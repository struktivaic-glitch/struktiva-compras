import { pool } from '../../db/pool.js';
import { registrarBitacora } from '../../lib/audit.js';

// Trabajadores de campo (personal de Mano de Obra) — NO son usuarios del sistema ni un registro
// fiscal/de nómina, es solo un catálogo interno para poder desglosar el gasto de mano de obra
// en las requisiciones. Gestionable por quienes manejan cuadrillas en campo: Residente,
// Superintendente y Dirección.

export default async function trabajadoresRoutes(app) {
  app.addHook('preHandler', app.authenticate);

  app.get('/api/trabajadores', async (request) => {
    const soloActivos = request.query.incluirInactivos !== '1';
    const { rows } = await pool.query(
      `SELECT id, nombre, oficio, activo FROM trabajadores ${soloActivos ? 'WHERE activo' : ''} ORDER BY nombre`
    );
    return rows;
  });

  app.post('/api/trabajadores', { preHandler: app.requireRole('residente', 'superintendente', 'direccion') }, async (request, reply) => {
    const { nombre, oficio } = request.body ?? {};
    if (!nombre?.trim()) {
      return reply.code(400).send({ error: 'El nombre es obligatorio' });
    }
    const { rows } = await pool.query(
      `INSERT INTO trabajadores (nombre, oficio) VALUES ($1, $2) RETURNING id, nombre, oficio, activo`,
      [nombre.trim(), oficio?.trim() || null]
    );
    await registrarBitacora(pool, {
      tabla: 'trabajadores', registroId: rows[0].id, usuarioId: request.user.sub, accion: 'crear',
      despues: rows[0],
    });
    return reply.code(201).send(rows[0]);
  });

  app.put('/api/trabajadores/:id', { preHandler: app.requireRole('residente', 'superintendente', 'direccion') }, async (request, reply) => {
    const { id } = request.params;
    const { nombre, oficio, activo } = request.body ?? {};
    if (!nombre?.trim()) {
      return reply.code(400).send({ error: 'El nombre es obligatorio' });
    }
    const { rows } = await pool.query(
      `UPDATE trabajadores SET nombre = $2, oficio = $3, activo = $4 WHERE id = $1
       RETURNING id, nombre, oficio, activo`,
      [id, nombre.trim(), oficio?.trim() || null, activo ?? true]
    );
    if (!rows[0]) return reply.code(404).send({ error: 'Trabajador no encontrado' });

    await registrarBitacora(pool, {
      tabla: 'trabajadores', registroId: id, usuarioId: request.user.sub, accion: 'editar', despues: rows[0],
    });
    return rows[0];
  });
}
