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
      `SELECT u.id, u.nombre, u.email, u.password_hash, u.activo, (u.foto_perfil IS NOT NULL) AS tiene_foto,
              r.clave AS rol, r.nombre AS rol_nombre
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

    // Checklist de módulos visibles (migración 029) — viaja en la respuesta de login (no en el
    // JWT, para no tener que reemitir tokens cada vez que Dirección ajusta permisos) y el
    // frontend lo guarda junto con el resto de `usuario`. Un cambio de permisos aplica hasta el
    // siguiente inicio de sesión, igual que un cambio de rol.
    const { rows: modulosRows } = await pool.query('SELECT modulo_clave FROM usuario_modulos WHERE usuario_id = $1', [usuario.id]);

    return {
      token,
      usuario: {
        id: usuario.id,
        nombre: usuario.nombre,
        email: usuario.email,
        rol: usuario.rol,
        rolNombre: usuario.rol_nombre,
        tieneFoto: usuario.tiene_foto,
        modulos: modulosRows.map((r) => r.modulo_clave),
      },
    };
  });

  app.get('/api/auth/me', { preHandler: app.authenticate }, async (request) => {
    const { rows } = await pool.query('SELECT (foto_perfil IS NOT NULL) AS tiene_foto FROM usuarios WHERE id = $1', [request.user.sub]);
    return { usuario: { ...request.user, tieneFoto: Boolean(rows[0]?.tiene_foto) } };
  });
}
