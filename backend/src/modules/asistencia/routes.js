import { pool } from '../../db/pool.js';
import { registrarBitacora } from '../../lib/audit.js';

// Asistencia / checador — entrada y salida diaria del Personal (catálogo `trabajadores`).
// Control interno, no calcula nómina ni faltas automáticamente (eso es del módulo de
// Incidencias). Gestionable por Residente, Superintendente y Dirección; el resto de roles
// puede consultar.

const ROLES_GESTION = ['residente', 'superintendente', 'direccion'];

function hoy() {
  return new Date().toISOString().slice(0, 10);
}

export default async function asistenciaRoutes(app) {
  app.addHook('preHandler', app.authenticate);

  // Vista de checador: todo el personal activo (filtrable por obra) con su entrada/salida del día.
  app.get('/api/asistencias/checador', async (request) => {
    const dia = request.query.fecha || hoy();
    const obraId = request.query.obraId || null;
    const { rows } = await pool.query(
      `SELECT t.id AS trabajador_id, t.nombre, t.tipo, t.oficio, t.puesto, t.obra_id,
              a.id AS asistencia_id, a.hora_entrada, a.hora_salida
       FROM trabajadores t
       LEFT JOIN asistencias a ON a.trabajador_id = t.id AND a.fecha = $1
       WHERE t.activo ${obraId ? 'AND t.obra_id = $2' : ''}
       ORDER BY t.nombre`,
      obraId ? [dia, obraId] : [dia]
    );
    return { fecha: dia, personal: rows };
  });

  // Histórico/reporte, filtrable por rango de fechas, obra o persona.
  app.get('/api/asistencias', async (request) => {
    const { desde, hasta, obraId, trabajadorId } = request.query;
    const condiciones = [];
    const valores = [];
    if (desde) { valores.push(desde); condiciones.push(`a.fecha >= $${valores.length}`); }
    if (hasta) { valores.push(hasta); condiciones.push(`a.fecha <= $${valores.length}`); }
    if (obraId) { valores.push(obraId); condiciones.push(`a.obra_id = $${valores.length}`); }
    if (trabajadorId) { valores.push(trabajadorId); condiciones.push(`a.trabajador_id = $${valores.length}`); }
    const where = condiciones.length ? `WHERE ${condiciones.join(' AND ')}` : '';
    const { rows } = await pool.query(
      `SELECT a.*, t.nombre, t.tipo, t.oficio, t.puesto, o.nombre AS obra_nombre
       FROM asistencias a
       JOIN trabajadores t ON t.id = a.trabajador_id
       LEFT JOIN obras o ON o.id = a.obra_id
       ${where}
       ORDER BY a.fecha DESC, t.nombre
       LIMIT 500`,
      valores
    );
    return rows;
  });

  app.post('/api/asistencias/entrada', { preHandler: app.requireRole(...ROLES_GESTION) }, async (request, reply) => {
    const { trabajadorId, fecha, obraId, gpsLat, gpsLng } = request.body ?? {};
    if (!trabajadorId) return reply.code(400).send({ error: 'trabajadorId es obligatorio' });
    const dia = fecha || hoy();

    const { rows: existentes } = await pool.query(
      'SELECT id, hora_entrada FROM asistencias WHERE trabajador_id = $1 AND fecha = $2',
      [trabajadorId, dia]
    );
    if (existentes[0]?.hora_entrada) {
      return reply.code(409).send({ error: 'Ya tiene entrada registrada ese día' });
    }

    let row;
    if (existentes[0]) {
      const { rows } = await pool.query(
        `UPDATE asistencias SET hora_entrada = now(), obra_id = COALESCE($2, obra_id),
           gps_lat_entrada = $3, gps_lng_entrada = $4, registrado_por = $5, actualizado_en = now()
         WHERE id = $1 RETURNING *`,
        [existentes[0].id, obraId || null, gpsLat ?? null, gpsLng ?? null, request.user.sub]
      );
      row = rows[0];
    } else {
      const { rows } = await pool.query(
        `INSERT INTO asistencias (trabajador_id, fecha, hora_entrada, obra_id, gps_lat_entrada, gps_lng_entrada, registrado_por)
         VALUES ($1, $2, now(), $3, $4, $5, $6) RETURNING *`,
        [trabajadorId, dia, obraId || null, gpsLat ?? null, gpsLng ?? null, request.user.sub]
      );
      row = rows[0];
    }
    await registrarBitacora(pool, {
      tabla: 'asistencias', registroId: row.id, usuarioId: request.user.sub, accion: 'marcar_entrada',
      despues: { trabajadorId, dia },
    });
    return reply.code(201).send(row);
  });

  app.post('/api/asistencias/salida', { preHandler: app.requireRole(...ROLES_GESTION) }, async (request, reply) => {
    const { trabajadorId, fecha, gpsLat, gpsLng } = request.body ?? {};
    if (!trabajadorId) return reply.code(400).send({ error: 'trabajadorId es obligatorio' });
    const dia = fecha || hoy();

    const { rows: existentes } = await pool.query(
      'SELECT id, hora_entrada, hora_salida FROM asistencias WHERE trabajador_id = $1 AND fecha = $2',
      [trabajadorId, dia]
    );
    if (!existentes[0]?.hora_entrada) {
      return reply.code(422).send({ error: 'No tiene entrada registrada ese día' });
    }
    if (existentes[0].hora_salida) {
      return reply.code(409).send({ error: 'Ya tiene salida registrada ese día' });
    }

    const { rows } = await pool.query(
      `UPDATE asistencias SET hora_salida = now(), gps_lat_salida = $2, gps_lng_salida = $3, actualizado_en = now()
       WHERE id = $1 RETURNING *`,
      [existentes[0].id, gpsLat ?? null, gpsLng ?? null]
    );
    await registrarBitacora(pool, {
      tabla: 'asistencias', registroId: rows[0].id, usuarioId: request.user.sub, accion: 'marcar_salida',
      despues: { trabajadorId, dia },
    });
    return rows[0];
  });

  // Corrección manual (ej. se olvidó marcar, o se marcó a deshoras).
  app.put('/api/asistencias/:id', { preHandler: app.requireRole(...ROLES_GESTION) }, async (request, reply) => {
    const { id } = request.params;
    const { horaEntrada, horaSalida, notas } = request.body ?? {};
    const { rows } = await pool.query(
      `UPDATE asistencias SET hora_entrada = $2, hora_salida = $3, notas = $4, actualizado_en = now()
       WHERE id = $1 RETURNING *`,
      [id, horaEntrada || null, horaSalida || null, notas?.trim() || null]
    );
    if (!rows[0]) return reply.code(404).send({ error: 'Registro de asistencia no encontrado' });

    await registrarBitacora(pool, {
      tabla: 'asistencias', registroId: id, usuarioId: request.user.sub, accion: 'corregir', despues: rows[0],
    });
    return rows[0];
  });
}
