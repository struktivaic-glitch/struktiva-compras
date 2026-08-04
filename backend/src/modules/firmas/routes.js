import { pool } from '../../db/pool.js';

export default async function firmasRoutes(app) {
  app.addHook('preHandler', app.authenticate);

  app.get('/api/firmas', async (request, reply) => {
    const { entidadTipo, entidadId } = request.query;
    if (!entidadTipo || !entidadId) return reply.code(400).send({ error: 'entidadTipo y entidadId son obligatorios' });

    const { rows } = await pool.query(
      `SELECT f.id, f.tipo, f.imagen_url, f.ip, f.gps_lat, f.gps_lng, f.creado_en, u.nombre AS usuario_nombre
       FROM firmas f JOIN usuarios u ON u.id = f.usuario_id
       WHERE f.entidad_tipo = $1 AND f.entidad_id = $2
       ORDER BY f.creado_en DESC`,
      [entidadTipo, entidadId]
    );
    return rows;
  });
}
