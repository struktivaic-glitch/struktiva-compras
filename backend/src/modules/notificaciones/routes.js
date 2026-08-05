import { pool } from '../../db/pool.js';

export default async function notificacionesRoutes(app) {
  app.addHook('preHandler', app.authenticate);

  // Lista de notificaciones del usuario en sesión. ?categoria= filtra; ?soloNoLeidas=1 filtra.
  app.get('/api/notificaciones', async (request) => {
    const { categoria, soloNoLeidas } = request.query;
    const condiciones = ['usuario_id = $1'];
    const valores = [request.user.sub];
    if (categoria) { valores.push(categoria); condiciones.push(`categoria = $${valores.length}`); }
    if (soloNoLeidas === '1') condiciones.push('NOT leida');

    const { rows } = await pool.query(
      `SELECT id, categoria, entidad_tipo, entidad_id, titulo, mensaje, leida, creado_en
       FROM notificaciones WHERE ${condiciones.join(' AND ')} ORDER BY creado_en DESC LIMIT 100`,
      valores
    );
    return rows;
  });

  // Conteo de no leídas, total y por categoría — para la campanita y las pestañas de la página.
  app.get('/api/notificaciones/resumen', async (request) => {
    const { rows } = await pool.query(
      `SELECT categoria, COUNT(*) FILTER (WHERE NOT leida) AS no_leidas, COUNT(*) AS total
       FROM notificaciones WHERE usuario_id = $1 GROUP BY categoria`,
      [request.user.sub]
    );
    const porCategoria = Object.fromEntries(rows.map((r) => [r.categoria, { noLeidas: Number(r.no_leidas), total: Number(r.total) }]));
    const totalNoLeidas = rows.reduce((acc, r) => acc + Number(r.no_leidas), 0);
    return { totalNoLeidas, porCategoria };
  });

  app.post('/api/notificaciones/:id/leida', async (request, reply) => {
    const { rows } = await pool.query(
      'UPDATE notificaciones SET leida = true WHERE id = $1 AND usuario_id = $2 RETURNING id',
      [request.params.id, request.user.sub]
    );
    if (!rows[0]) return reply.code(404).send({ error: 'Notificación no encontrada' });
    return { ok: true };
  });

  app.post('/api/notificaciones/marcar-todas-leidas', async (request) => {
    const { categoria } = request.body ?? {};
    const condiciones = ['usuario_id = $1', 'NOT leida'];
    const valores = [request.user.sub];
    if (categoria) { valores.push(categoria); condiciones.push(`categoria = $${valores.length}`); }
    await pool.query(`UPDATE notificaciones SET leida = true WHERE ${condiciones.join(' AND ')}`, valores);
    return { ok: true };
  });
}
