import { pool } from '../../db/pool.js';
import { registrarBitacora } from '../../lib/audit.js';

// Umbrales legales de jornada semanal / tope de horas dobles antes de triples (LFT Art. 66-68,
// reforma de jornada de 40 horas). Vive en base de datos (no hardcodeado) porque el calendario es
// gradual año con año y porque hay ambigüedad publicada sobre el criterio exacto — Dirección debe
// poder ajustarlo si la ley cambia o si su asesoría laboral confirma un criterio distinto. Ver
// migración 017 para el calendario semilla.

export default async function configuracionJornadaRoutes(app) {
  app.addHook('preHandler', app.authenticate);

  app.get('/api/configuracion-jornada', async () => {
    const { rows } = await pool.query('SELECT * FROM configuracion_jornada ORDER BY vigente_desde');
    return rows;
  });

  app.post('/api/configuracion-jornada', { preHandler: app.requireRole('direccion') }, async (request, reply) => {
    const { vigenteDesde, jornadaSemanalHoras, limiteSemanalDoblesHoras, notas } = request.body ?? {};
    if (!vigenteDesde || !jornadaSemanalHoras || !limiteSemanalDoblesHoras) {
      return reply.code(400).send({ error: 'Vigente desde, jornada semanal y tope de dobles son obligatorios' });
    }
    try {
      const { rows } = await pool.query(
        `INSERT INTO configuracion_jornada (vigente_desde, jornada_semanal_horas, limite_semanal_dobles_horas, notas)
         VALUES ($1, $2, $3, $4) RETURNING *`,
        [vigenteDesde, jornadaSemanalHoras, limiteSemanalDoblesHoras, notas?.trim() || null]
      );
      await registrarBitacora(pool, {
        tabla: 'configuracion_jornada', registroId: rows[0].id, usuarioId: request.user.sub, accion: 'crear', despues: rows[0],
      });
      return reply.code(201).send(rows[0]);
    } catch (err) {
      if (err.code === '23505') return reply.code(409).send({ error: 'Ya existe una configuración vigente desde esa fecha' });
      request.log.error(err);
      return reply.code(500).send({ error: 'No se pudo guardar la configuración' });
    }
  });

  app.put('/api/configuracion-jornada/:id', { preHandler: app.requireRole('direccion') }, async (request, reply) => {
    const { id } = request.params;
    const { jornadaSemanalHoras, limiteSemanalDoblesHoras, notas } = request.body ?? {};
    if (!jornadaSemanalHoras || !limiteSemanalDoblesHoras) {
      return reply.code(400).send({ error: 'Jornada semanal y tope de dobles son obligatorios' });
    }
    const { rows } = await pool.query(
      `UPDATE configuracion_jornada SET jornada_semanal_horas = $2, limite_semanal_dobles_horas = $3, notas = $4
       WHERE id = $1 RETURNING *`,
      [id, jornadaSemanalHoras, limiteSemanalDoblesHoras, notas?.trim() || null]
    );
    if (!rows[0]) return reply.code(404).send({ error: 'Configuración no encontrada' });
    await registrarBitacora(pool, {
      tabla: 'configuracion_jornada', registroId: id, usuarioId: request.user.sub, accion: 'editar', despues: rows[0],
    });
    return rows[0];
  });

  app.delete('/api/configuracion-jornada/:id', { preHandler: app.requireRole('direccion') }, async (request, reply) => {
    const { rowCount } = await pool.query('DELETE FROM configuracion_jornada WHERE id = $1', [request.params.id]);
    if (!rowCount) return reply.code(404).send({ error: 'Configuración no encontrada' });
    await registrarBitacora(pool, {
      tabla: 'configuracion_jornada', registroId: request.params.id, usuarioId: request.user.sub, accion: 'eliminar',
    });
    return { ok: true };
  });
}
