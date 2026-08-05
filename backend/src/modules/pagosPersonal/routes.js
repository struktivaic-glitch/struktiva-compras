import { pool } from '../../db/pool.js';
import { registrarBitacora } from '../../lib/audit.js';

// Control interno de pagos a Personal (Bloque HR-D) — generaliza el "Personal asignado" que
// antes solo vivía dentro de una requisición de Mano de Obra (Bloque 23). Sigue siendo control
// interno de gasto: "marcar pagado" solo registra que el pago ya se hizo por fuera del sistema,
// no mueve dinero real ni calcula ISR/IMSS.

const ROLES_CAPTURAR = ['residente', 'superintendente', 'direccion'];

function hoy() {
  return new Date().toISOString().slice(0, 10);
}

export default async function pagosPersonalRoutes(app) {
  app.addHook('preHandler', app.authenticate);

  // Sugerencia de días trabajados / monto a partir de Asistencia + salario de referencia del
  // expediente — es solo un punto de partida, el monto final siempre es editable.
  app.get('/api/pagos-personal/sugerencia', async (request, reply) => {
    const { trabajadorId, desde, hasta } = request.query;
    if (!trabajadorId || !desde || !hasta) {
      return reply.code(400).send({ error: 'trabajadorId, desde y hasta son obligatorios' });
    }
    const { rows: tRows } = await pool.query(
      'SELECT nombre, salario_referencia, salario_periodo FROM trabajadores WHERE id = $1',
      [trabajadorId]
    );
    if (!tRows[0]) return reply.code(404).send({ error: 'Personal no encontrado' });
    const t = tRows[0];

    const { rows: aRows } = await pool.query(
      `SELECT COUNT(*)::int AS dias FROM asistencias
       WHERE trabajador_id = $1 AND fecha BETWEEN $2 AND $3 AND hora_entrada IS NOT NULL`,
      [trabajadorId, desde, hasta]
    );
    const diasTrabajados = aRows[0].dias;
    const salario = t.salario_referencia != null ? Number(t.salario_referencia) : null;

    let montoSugerido = null;
    if (salario != null) {
      montoSugerido = t.salario_periodo === 'diario' ? Number((salario * diasTrabajados).toFixed(2)) : salario;
    }

    return {
      trabajadorNombre: t.nombre,
      salarioReferencia: salario,
      salarioPeriodo: t.salario_periodo,
      diasTrabajados,
      montoSugerido,
    };
  });

  app.get('/api/pagos-personal', async (request) => {
    const { estatus, trabajadorId, desde, hasta } = request.query;
    const condiciones = [];
    const valores = [];
    if (estatus) { valores.push(estatus); condiciones.push(`p.estatus = $${valores.length}`); }
    if (trabajadorId) { valores.push(trabajadorId); condiciones.push(`p.trabajador_id = $${valores.length}`); }
    if (desde) { valores.push(desde); condiciones.push(`p.fecha_fin >= $${valores.length}`); }
    if (hasta) { valores.push(hasta); condiciones.push(`p.fecha_inicio <= $${valores.length}`); }
    const where = condiciones.length ? `WHERE ${condiciones.join(' AND ')}` : '';
    const { rows } = await pool.query(
      `SELECT p.*, t.nombre AS trabajador_nombre, t.tipo AS trabajador_tipo,
              ur.nombre AS registrado_por_nombre, up.nombre AS pagado_por_nombre
       FROM pagos_personal p
       JOIN trabajadores t ON t.id = p.trabajador_id
       JOIN usuarios ur ON ur.id = p.registrado_por
       LEFT JOIN usuarios up ON up.id = p.pagado_por
       ${where}
       ORDER BY p.fecha_inicio DESC, t.nombre
       LIMIT 500`,
      valores
    );
    return rows;
  });

  app.post('/api/pagos-personal', { preHandler: app.requireRole(...ROLES_CAPTURAR) }, async (request, reply) => {
    const { trabajadorId, fechaInicio, fechaFin, concepto, diasTrabajados, monto, notas } = request.body ?? {};
    if (!trabajadorId || !fechaInicio || !fechaFin || !monto) {
      return reply.code(400).send({ error: 'Personal, fechas y monto son obligatorios' });
    }
    if (fechaFin < fechaInicio) return reply.code(400).send({ error: 'La fecha final no puede ser antes de la fecha inicial' });
    if (Number(monto) <= 0) return reply.code(400).send({ error: 'El monto debe ser mayor a cero' });

    const { rows } = await pool.query(
      `INSERT INTO pagos_personal (trabajador_id, fecha_inicio, fecha_fin, concepto, dias_trabajados, monto, notas, registrado_por)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING *`,
      [trabajadorId, fechaInicio, fechaFin, concepto?.trim() || 'Pago de personal', diasTrabajados ?? null, monto, notas?.trim() || null, request.user.sub]
    );
    await registrarBitacora(pool, {
      tabla: 'pagos_personal', registroId: rows[0].id, usuarioId: request.user.sub, accion: 'crear', despues: rows[0],
    });
    return reply.code(201).send(rows[0]);
  });

  app.put('/api/pagos-personal/:id', { preHandler: app.requireRole(...ROLES_CAPTURAR) }, async (request, reply) => {
    const { id } = request.params;
    const { fechaInicio, fechaFin, concepto, diasTrabajados, monto, notas } = request.body ?? {};
    const { rows: existentes } = await pool.query('SELECT estatus FROM pagos_personal WHERE id = $1', [id]);
    if (!existentes[0]) return reply.code(404).send({ error: 'Registro no encontrado' });
    if (existentes[0].estatus === 'pagado') return reply.code(422).send({ error: 'Ya está marcado como pagado, no se puede editar' });
    if (fechaFin < fechaInicio) return reply.code(400).send({ error: 'La fecha final no puede ser antes de la fecha inicial' });
    if (Number(monto) <= 0) return reply.code(400).send({ error: 'El monto debe ser mayor a cero' });

    const { rows } = await pool.query(
      `UPDATE pagos_personal SET fecha_inicio = $2, fecha_fin = $3, concepto = $4, dias_trabajados = $5, monto = $6, notas = $7
       WHERE id = $1 RETURNING *`,
      [id, fechaInicio, fechaFin, concepto?.trim() || 'Pago de personal', diasTrabajados ?? null, monto, notas?.trim() || null]
    );
    await registrarBitacora(pool, {
      tabla: 'pagos_personal', registroId: id, usuarioId: request.user.sub, accion: 'editar', despues: rows[0],
    });
    return rows[0];
  });

  app.post('/api/pagos-personal/:id/marcar-pagado', { preHandler: app.requireRole('direccion') }, async (request, reply) => {
    const { id } = request.params;
    const { fechaPago } = request.body ?? {};
    const { rows: existentes } = await pool.query('SELECT estatus FROM pagos_personal WHERE id = $1', [id]);
    if (!existentes[0]) return reply.code(404).send({ error: 'Registro no encontrado' });
    if (existentes[0].estatus === 'pagado') return reply.code(422).send({ error: 'Ya está marcado como pagado' });

    const { rows } = await pool.query(
      `UPDATE pagos_personal SET estatus = 'pagado', fecha_pago = $2, pagado_por = $3 WHERE id = $1 RETURNING *`,
      [id, fechaPago || hoy(), request.user.sub]
    );
    await registrarBitacora(pool, {
      tabla: 'pagos_personal', registroId: id, usuarioId: request.user.sub, accion: 'marcar_pagado', despues: rows[0],
    });
    return rows[0];
  });

  app.delete('/api/pagos-personal/:id', { preHandler: app.requireRole(...ROLES_CAPTURAR) }, async (request, reply) => {
    const { id } = request.params;
    const { rows: existentes } = await pool.query('SELECT estatus FROM pagos_personal WHERE id = $1', [id]);
    if (!existentes[0]) return reply.code(404).send({ error: 'Registro no encontrado' });
    if (existentes[0].estatus === 'pagado') return reply.code(422).send({ error: 'Ya está marcado como pagado, no se puede cancelar' });

    await pool.query('DELETE FROM pagos_personal WHERE id = $1', [id]);
    await registrarBitacora(pool, {
      tabla: 'pagos_personal', registroId: id, usuarioId: request.user.sub, accion: 'eliminar',
    });
    return { ok: true };
  });
}
