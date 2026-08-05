import { pool } from '../../db/pool.js';
import { registrarBitacora } from '../../lib/audit.js';
import { notificarPorRol, notificarUsuario } from '../../lib/notificaciones.js';

// Incidencias (faltas, permisos, vacaciones, incapacidades) — control interno de Personal, sin
// tocar nómina fiscal. Los trabajadores no tienen cuenta propia en el sistema, así que quien
// captura la solicitud lo hace a su nombre; Superintendencia/Dirección autoriza o rechaza, mismo
// patrón de flujo que Requisiciones.

const ROLES_SOLICITAR = ['residente', 'superintendente', 'direccion'];
const ROLES_AUTORIZAR = ['superintendente', 'direccion'];

const TIPO_LABEL = { falta: 'Falta', permiso: 'Permiso', vacaciones: 'Vacaciones', incapacidad: 'Incapacidad' };

export default async function incidenciasRoutes(app) {
  app.addHook('preHandler', app.authenticate);

  app.get('/api/incidencias', async (request) => {
    const { estatus, trabajadorId, tipo } = request.query;
    const condiciones = [];
    const valores = [];
    if (estatus) { valores.push(estatus); condiciones.push(`i.estatus = $${valores.length}`); }
    if (trabajadorId) { valores.push(trabajadorId); condiciones.push(`i.trabajador_id = $${valores.length}`); }
    if (tipo) { valores.push(tipo); condiciones.push(`i.tipo = $${valores.length}`); }
    const where = condiciones.length ? `WHERE ${condiciones.join(' AND ')}` : '';
    const { rows } = await pool.query(
      `SELECT i.*, t.nombre AS trabajador_nombre, t.tipo AS trabajador_tipo,
              us.nombre AS solicitado_por_nombre, ua.nombre AS autorizado_por_nombre
       FROM incidencias i
       JOIN trabajadores t ON t.id = i.trabajador_id
       JOIN usuarios us ON us.id = i.solicitado_por
       LEFT JOIN usuarios ua ON ua.id = i.autorizado_por
       ${where}
       ORDER BY i.creado_en DESC
       LIMIT 300`,
      valores
    );
    return rows;
  });

  app.post('/api/incidencias', { preHandler: app.requireRole(...ROLES_SOLICITAR) }, async (request, reply) => {
    const { trabajadorId, tipo, fechaInicio, fechaFin, motivo } = request.body ?? {};
    if (!trabajadorId || !tipo || !fechaInicio || !fechaFin) {
      return reply.code(400).send({ error: 'Trabajador, tipo y fechas son obligatorios' });
    }
    if (!TIPO_LABEL[tipo]) return reply.code(400).send({ error: 'Tipo de incidencia inválido' });
    if (fechaFin < fechaInicio) return reply.code(400).send({ error: 'La fecha final no puede ser antes de la fecha inicial' });

    const { rows } = await pool.query(
      `INSERT INTO incidencias (trabajador_id, tipo, fecha_inicio, fecha_fin, motivo, solicitado_por)
       VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`,
      [trabajadorId, tipo, fechaInicio, fechaFin, motivo?.trim() || null, request.user.sub]
    );
    const inc = rows[0];

    await registrarBitacora(pool, {
      tabla: 'incidencias', registroId: inc.id, usuarioId: request.user.sub, accion: 'crear', despues: inc,
    });

    const { rows: trabajadorRows } = await pool.query('SELECT nombre FROM trabajadores WHERE id = $1', [trabajadorId]);
    await notificarPorRol(pool, {
      roles: ROLES_AUTORIZAR, categoria: 'incidencia', entidadTipo: 'incidencia', entidadId: inc.id,
      titulo: `${TIPO_LABEL[tipo]} pendiente de autorizar: ${trabajadorRows[0]?.nombre ?? ''}`,
      mensaje: `${request.user.nombre} solicitó ${TIPO_LABEL[tipo].toLowerCase()} del ${fechaInicio} al ${fechaFin}.`,
      excluirUsuarioId: request.user.sub,
    });

    return reply.code(201).send(inc);
  });

  app.post('/api/incidencias/:id/autorizar', { preHandler: app.requireRole(...ROLES_AUTORIZAR) }, async (request, reply) => {
    const { id } = request.params;
    const { comentario } = request.body ?? {};
    const { rows: existentes } = await pool.query('SELECT * FROM incidencias WHERE id = $1', [id]);
    if (!existentes[0]) return reply.code(404).send({ error: 'Incidencia no encontrada' });
    if (existentes[0].estatus !== 'pendiente') return reply.code(422).send({ error: 'Esta incidencia ya fue resuelta' });

    const { rows } = await pool.query(
      `UPDATE incidencias SET estatus = 'autorizada', autorizado_por = $2, fecha_autorizacion = now(), comentario_autorizacion = $3
       WHERE id = $1 RETURNING *`,
      [id, request.user.sub, comentario?.trim() || null]
    );
    await registrarBitacora(pool, {
      tabla: 'incidencias', registroId: id, usuarioId: request.user.sub, accion: 'autorizar', despues: rows[0],
    });
    const { rows: trabajadorRows } = await pool.query('SELECT nombre FROM trabajadores WHERE id = $1', [rows[0].trabajador_id]);
    await notificarUsuario(pool, {
      usuarioId: existentes[0].solicitado_por, categoria: 'incidencia', entidadTipo: 'incidencia', entidadId: Number(id),
      titulo: `${TIPO_LABEL[existentes[0].tipo]} autorizada: ${trabajadorRows[0]?.nombre ?? ''}`,
      mensaje: `${request.user.nombre} autorizó la solicitud.`,
    });
    return rows[0];
  });

  app.post('/api/incidencias/:id/rechazar', { preHandler: app.requireRole(...ROLES_AUTORIZAR) }, async (request, reply) => {
    const { id } = request.params;
    const { comentario } = request.body ?? {};
    const { rows: existentes } = await pool.query('SELECT * FROM incidencias WHERE id = $1', [id]);
    if (!existentes[0]) return reply.code(404).send({ error: 'Incidencia no encontrada' });
    if (existentes[0].estatus !== 'pendiente') return reply.code(422).send({ error: 'Esta incidencia ya fue resuelta' });

    const { rows } = await pool.query(
      `UPDATE incidencias SET estatus = 'rechazada', autorizado_por = $2, fecha_autorizacion = now(), comentario_autorizacion = $3
       WHERE id = $1 RETURNING *`,
      [id, request.user.sub, comentario?.trim() || null]
    );
    await registrarBitacora(pool, {
      tabla: 'incidencias', registroId: id, usuarioId: request.user.sub, accion: 'rechazar', despues: rows[0],
    });
    const { rows: trabajadorRows } = await pool.query('SELECT nombre FROM trabajadores WHERE id = $1', [rows[0].trabajador_id]);
    await notificarUsuario(pool, {
      usuarioId: existentes[0].solicitado_por, categoria: 'incidencia', entidadTipo: 'incidencia', entidadId: Number(id),
      titulo: `${TIPO_LABEL[existentes[0].tipo]} rechazada: ${trabajadorRows[0]?.nombre ?? ''}`,
      mensaje: comentario?.trim() ? `${request.user.nombre} la rechazó: ${comentario.trim()}` : `${request.user.nombre} la rechazó.`,
    });
    return rows[0];
  });
}
