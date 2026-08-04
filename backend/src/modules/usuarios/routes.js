import bcrypt from 'bcryptjs';
import { pool } from '../../db/pool.js';
import { registrarBitacora } from '../../lib/audit.js';

export default async function usuariosRoutes(app) {
  app.addHook('preHandler', app.authenticate);

  app.get('/api/usuarios/pin/estado', async (request) => {
    const { rows } = await pool.query('SELECT pin_hash FROM usuarios WHERE id = $1', [request.user.sub]);
    return { configurado: Boolean(rows[0]?.pin_hash) };
  });

  app.post('/api/usuarios/pin', async (request, reply) => {
    const { pin } = request.body ?? {};
    if (!/^\d{4}$/.test(pin ?? '')) {
      return reply.code(400).send({ error: 'El PIN debe ser de exactamente 4 dígitos numéricos' });
    }
    const pinHash = bcrypt.hashSync(pin, 10);
    await pool.query('UPDATE usuarios SET pin_hash = $2 WHERE id = $1', [request.user.sub, pinHash]);
    return { ok: true };
  });

  // Cambio de contraseña propia — cualquier usuario autenticado, requiere la actual.
  app.post('/api/usuarios/mi-password', async (request, reply) => {
    const { passwordActual, passwordNueva } = request.body ?? {};
    if (!passwordNueva || passwordNueva.length < 6) {
      return reply.code(400).send({ error: 'La nueva contraseña debe tener al menos 6 caracteres' });
    }
    const { rows } = await pool.query('SELECT password_hash FROM usuarios WHERE id = $1', [request.user.sub]);
    if (!bcrypt.compareSync(passwordActual ?? '', rows[0].password_hash)) {
      return reply.code(422).send({ error: 'Tu contraseña actual no es correcta' });
    }
    await pool.query('UPDATE usuarios SET password_hash = $2 WHERE id = $1', [request.user.sub, bcrypt.hashSync(passwordNueva, 10)]);
    return { ok: true };
  });

  app.get('/api/roles', async () => {
    const { rows } = await pool.query('SELECT id, clave, nombre FROM roles ORDER BY nombre');
    return rows;
  });

  // Catálogo de usuarios — solo Dirección administra; Auditor puede consultar (solo lectura).
  app.get('/api/usuarios', { preHandler: app.requireRole('direccion', 'auditor') }, async () => {
    const { rows } = await pool.query(
      `SELECT u.id, u.nombre, u.email, u.activo, u.creado_en, r.id AS rol_id, r.clave AS rol_clave, r.nombre AS rol_nombre
       FROM usuarios u JOIN roles r ON r.id = u.rol_id
       ORDER BY u.nombre`
    );
    return rows;
  });

  app.post('/api/usuarios', { preHandler: app.requireRole('direccion') }, async (request, reply) => {
    const { nombre, email, rolId, password } = request.body ?? {};
    if (!nombre?.trim() || !email?.trim() || !rolId || !password) {
      return reply.code(400).send({ error: 'Nombre, correo, rol y contraseña son obligatorios' });
    }
    if (password.length < 6) {
      return reply.code(400).send({ error: 'La contraseña debe tener al menos 6 caracteres' });
    }

    try {
      const { rows } = await pool.query(
        `INSERT INTO usuarios (nombre, email, password_hash, rol_id) VALUES ($1, $2, $3, $4)
         RETURNING id, nombre, email, activo, creado_en`,
        [nombre.trim(), email.trim().toLowerCase(), bcrypt.hashSync(password, 10), rolId]
      );
      await registrarBitacora(pool, {
        tabla: 'usuarios', registroId: rows[0].id, usuarioId: request.user.sub, accion: 'crear', despues: { nombre, email, rolId },
      });
      return reply.code(201).send(rows[0]);
    } catch (err) {
      if (err.code === '23505') return reply.code(409).send({ error: 'Ya existe un usuario con ese correo' });
      request.log.error(err);
      return reply.code(500).send({ error: 'No se pudo crear el usuario' });
    }
  });

  app.put('/api/usuarios/:id', { preHandler: app.requireRole('direccion') }, async (request, reply) => {
    const { id } = request.params;
    const { nombre, email, rolId, activo } = request.body ?? {};
    if (!nombre?.trim() || !email?.trim() || !rolId) {
      return reply.code(400).send({ error: 'Nombre, correo y rol son obligatorios' });
    }
    if (id === request.user.sub && activo === false) {
      return reply.code(422).send({ error: 'No puedes desactivar tu propia cuenta' });
    }

    try {
      const { rows } = await pool.query(
        `UPDATE usuarios SET nombre = $2, email = $3, rol_id = $4, activo = $5 WHERE id = $1
         RETURNING id, nombre, email, activo, creado_en`,
        [id, nombre.trim(), email.trim().toLowerCase(), rolId, activo ?? true]
      );
      if (!rows[0]) return reply.code(404).send({ error: 'Usuario no encontrado' });

      await registrarBitacora(pool, {
        tabla: 'usuarios', registroId: id, usuarioId: request.user.sub, accion: 'editar', despues: { nombre, email, rolId, activo },
      });
      return rows[0];
    } catch (err) {
      if (err.code === '23505') return reply.code(409).send({ error: 'Ya existe un usuario con ese correo' });
      request.log.error(err);
      return reply.code(500).send({ error: 'No se pudo actualizar el usuario' });
    }
  });

  app.post('/api/usuarios/:id/password', { preHandler: app.requireRole('direccion') }, async (request, reply) => {
    const { id } = request.params;
    const { password } = request.body ?? {};
    if (!password || password.length < 6) {
      return reply.code(400).send({ error: 'La contraseña debe tener al menos 6 caracteres' });
    }
    const { rowCount } = await pool.query('UPDATE usuarios SET password_hash = $2 WHERE id = $1', [id, bcrypt.hashSync(password, 10)]);
    if (!rowCount) return reply.code(404).send({ error: 'Usuario no encontrado' });

    await registrarBitacora(pool, {
      tabla: 'usuarios', registroId: id, usuarioId: request.user.sub, accion: 'restablecer_password',
    });
    return { ok: true };
  });
}
