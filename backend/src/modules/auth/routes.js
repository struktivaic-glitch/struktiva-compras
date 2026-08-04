import bcrypt from 'bcryptjs';
import { pool } from '../../db/pool.js';
import { env } from '../../config/env.js';

export default async function authRoutes(app) {
  app.post('/api/auth/login', async (request, reply) => {
    const { email, password } = request.body ?? {};
    if (!email || !password) {
      return reply.code(400).send({ error: 'Correo y contraseña son obligatorios' });
    }

    const { rows } = await pool.query(
      `SELECT u.id, u.nombre, u.email, u.password_hash, u.activo, r.clave AS rol, r.nombre AS rol_nombre
       FROM usuarios u JOIN roles r ON r.id = u.rol_id
       WHERE u.email = $1`,
      [email.toLowerCase().trim()]
    );
    const usuario = rows[0];

    if (!usuario || !usuario.activo || !bcrypt.compareSync(password, usuario.password_hash)) {
      return reply.code(401).send({ error: 'Correo o contraseña incorrectos' });
    }

    const token = app.jwt.sign(
      { sub: usuario.id, nombre: usuario.nombre, rol: usuario.rol },
      { expiresIn: env.jwtExpiresIn }
    );

    return {
      token,
      usuario: {
        id: usuario.id,
        nombre: usuario.nombre,
        email: usuario.email,
        rol: usuario.rol,
        rolNombre: usuario.rol_nombre,
      },
    };
  });

  app.get('/api/auth/me', { preHandler: app.authenticate }, async (request) => {
    return { usuario: request.user };
  });
}
