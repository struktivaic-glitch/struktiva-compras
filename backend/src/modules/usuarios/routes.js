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

  const MIME_PERMITIDOS = new Set(['image/jpeg', 'image/png', 'image/webp']);
  const FOTO_MAX_BYTES = 4 * 1024 * 1024; // ya viene comprimida desde el navegador; esto es solo un tope de seguridad

  // Selfie de perfil — se guarda en la base de datos (no en disco, ver migración 012) para que
  // sobreviva a los deploys en el plan gratuito de Render.
  app.post('/api/usuarios/mi-foto', async (request, reply) => {
    const archivo = await request.file();
    if (!archivo) return reply.code(400).send({ error: 'No se recibió ninguna imagen' });
    if (!MIME_PERMITIDOS.has(archivo.mimetype)) {
      return reply.code(400).send({ error: 'Formato de imagen no soportado. Usa JPG, PNG o WEBP.' });
    }
    const buffer = await archivo.toBuffer();
    if (buffer.length > FOTO_MAX_BYTES) {
      return reply.code(400).send({ error: 'La imagen es demasiado grande.' });
    }

    await pool.query(
      'UPDATE usuarios SET foto_perfil = $2, foto_perfil_mime = $3, foto_perfil_actualizado = now() WHERE id = $1',
      [request.user.sub, buffer, archivo.mimetype]
    );
    await registrarBitacora(pool, { tabla: 'usuarios', registroId: request.user.sub, usuarioId: request.user.sub, accion: 'actualizar_foto_perfil' });
    return { ok: true };
  });

  app.delete('/api/usuarios/mi-foto', async (request) => {
    await pool.query(
      'UPDATE usuarios SET foto_perfil = NULL, foto_perfil_mime = NULL, foto_perfil_actualizado = NULL WHERE id = $1',
      [request.user.sub]
    );
    await registrarBitacora(pool, { tabla: 'usuarios', registroId: request.user.sub, usuarioId: request.user.sub, accion: 'eliminar_foto_perfil' });
    return { ok: true };
  });

  // Servir la foto de cualquier usuario (autenticado) — para mostrarla en encabezado, listado de
  // usuarios, etc. 404 si no tiene foto capturada.
  app.get('/api/usuarios/:id/foto', async (request, reply) => {
    const { rows } = await pool.query('SELECT foto_perfil, foto_perfil_mime FROM usuarios WHERE id = $1', [request.params.id]);
    const usuario = rows[0];
    if (!usuario?.foto_perfil) return reply.code(404).send({ error: 'Este usuario no tiene foto de perfil' });
    reply.header('Cache-Control', 'private, max-age=300');
    return reply.type(usuario.foto_perfil_mime || 'image/jpeg').send(usuario.foto_perfil);
  });

  // Catálogo de usuarios — solo Dirección administra; Auditor puede consultar (solo lectura).
  app.get('/api/usuarios', { preHandler: app.requireRole('direccion', 'auditor') }, async () => {
    const { rows } = await pool.query(
      `SELECT u.id, u.nombre, u.email, u.activo, u.creado_en, (u.foto_perfil IS NOT NULL) AS tiene_foto,
              r.id AS rol_id, r.clave AS rol_clave, r.nombre AS rol_nombre
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
