import { pool, withTransaction } from '../../db/pool.js';
import { registrarBitacora } from '../../lib/audit.js';

// Bloque 30: Destajos. Catálogo de destajistas separado de trabajadores (decisión del usuario).
// Un Destajo liga un destajista a UN concepto del presupuesto general (Bloque 29) con un precio
// de destajo propio. El monto ganado se calcula del avance físico CONFIRMADO ya capturado para
// ese concepto — no se vuelve a medir aparte, evita que avance físico y pago a destajista se
// desfasen entre sí.

const ROLES_GESTION = ['residente', 'superintendente', 'direccion'];

async function cargarDestajoCompleto(client, id) {
  const { rows: cab } = await client.query(
    `SELECT d.id, d.destajista_id, d.concepto_id, d.precio_destajo, d.notas, d.estatus, d.creado_en, d.cerrado_en,
            ds.nombre AS destajista_nombre, ds.telefono AS destajista_telefono, ds.especialidad,
            c.clave AS concepto_clave, c.descripcion AS concepto_descripcion, c.unidad AS concepto_unidad,
            c.cantidad_contratada, c.obra_id, o.nombre AS obra_nombre,
            COALESCE((SELECT SUM(ca.cantidad_ejecutada) FROM concepto_avance ca WHERE ca.concepto_id = d.concepto_id AND ca.estatus = 'confirmado'), 0) AS cantidad_avance_confirmado
     FROM destajos d
     JOIN destajistas ds ON ds.id = d.destajista_id
     JOIN conceptos_obra c ON c.id = d.concepto_id
     JOIN obras o ON o.id = c.obra_id
     WHERE d.id = $1`,
    [id]
  );
  if (!cab[0]) return null;

  const { rows: pagos } = await client.query(
    `SELECT dp.id, dp.fecha, dp.monto, dp.notas, dp.creado_en, u.nombre AS registrado_por_nombre
     FROM destajo_pago dp JOIN usuarios u ON u.id = dp.registrado_por
     WHERE dp.destajo_id = $1 ORDER BY dp.fecha, dp.creado_en`,
    [id]
  );

  const d = cab[0];
  const montoGanado = Number(d.cantidad_avance_confirmado) * Number(d.precio_destajo);
  const montoPagado = pagos.reduce((s, p) => s + Number(p.monto), 0);

  return {
    ...d,
    monto_ganado: montoGanado,
    monto_pagado: montoPagado,
    saldo: montoGanado - montoPagado,
    pagos,
  };
}

export default async function destajosRoutes(app) {
  app.addHook('preHandler', app.authenticate);

  // --- Catálogo de destajistas ---

  app.get('/api/destajistas', async (request) => {
    const soloActivos = request.query.incluirInactivos !== '1';
    const { rows } = await pool.query(
      `SELECT id, nombre, telefono, especialidad, activo, notas, creado_en FROM destajistas
       ${soloActivos ? 'WHERE activo' : ''} ORDER BY nombre`
    );
    return rows;
  });

  app.post('/api/destajistas', { preHandler: app.requireRole(...ROLES_GESTION) }, async (request, reply) => {
    const { nombre, telefono, especialidad, notas } = request.body ?? {};
    if (!nombre?.trim()) return reply.code(400).send({ error: 'El nombre es obligatorio' });
    const { rows } = await pool.query(
      `INSERT INTO destajistas (nombre, telefono, especialidad, notas) VALUES ($1, $2, $3, $4) RETURNING *`,
      [nombre.trim(), telefono?.trim() || null, especialidad?.trim() || null, notas?.trim() || null]
    );
    await registrarBitacora(pool, { tabla: 'destajistas', registroId: rows[0].id, usuarioId: request.user.sub, accion: 'crear', despues: rows[0] });
    return reply.code(201).send(rows[0]);
  });

  app.put('/api/destajistas/:id', { preHandler: app.requireRole(...ROLES_GESTION) }, async (request, reply) => {
    const { id } = request.params;
    const { nombre, telefono, especialidad, activo, notas } = request.body ?? {};
    if (!nombre?.trim()) return reply.code(400).send({ error: 'El nombre es obligatorio' });
    const { rows } = await pool.query(
      `UPDATE destajistas SET nombre = $2, telefono = $3, especialidad = $4, activo = $5, notas = $6 WHERE id = $1 RETURNING *`,
      [id, nombre.trim(), telefono?.trim() || null, especialidad?.trim() || null, activo ?? true, notas?.trim() || null]
    );
    if (!rows[0]) return reply.code(404).send({ error: 'Destajista no encontrado' });
    await registrarBitacora(pool, { tabla: 'destajistas', registroId: id, usuarioId: request.user.sub, accion: 'editar', despues: rows[0] });
    return rows[0];
  });

  // --- Destajos ---

  app.get('/api/destajos', async (request, reply) => {
    const { obraId, estatus } = request.query;
    if (!obraId) return reply.code(400).send({ error: 'obraId es obligatorio' });
    const condiciones = ['c.obra_id = $1'];
    const valores = [obraId];
    if (estatus) { valores.push(estatus); condiciones.push(`d.estatus = $${valores.length}`); }

    const { rows } = await pool.query(
      `SELECT d.id, d.precio_destajo, d.estatus, d.creado_en,
              ds.nombre AS destajista_nombre,
              c.clave AS concepto_clave, c.descripcion AS concepto_descripcion, c.unidad AS concepto_unidad,
              COALESCE((SELECT SUM(ca.cantidad_ejecutada) FROM concepto_avance ca WHERE ca.concepto_id = d.concepto_id AND ca.estatus = 'confirmado'), 0) AS cantidad_avance_confirmado,
              COALESCE((SELECT SUM(dp.monto) FROM destajo_pago dp WHERE dp.destajo_id = d.id), 0) AS monto_pagado
       FROM destajos d
       JOIN destajistas ds ON ds.id = d.destajista_id
       JOIN conceptos_obra c ON c.id = d.concepto_id
       WHERE ${condiciones.join(' AND ')}
       ORDER BY d.creado_en DESC`,
      valores
    );
    return rows.map((r) => {
      const montoGanado = Number(r.cantidad_avance_confirmado) * Number(r.precio_destajo);
      return { ...r, monto_ganado: montoGanado, saldo: montoGanado - Number(r.monto_pagado) };
    });
  });

  // Conceptos de esta obra que todavía no tienen un destajo activo — para poder elegir al armar uno nuevo.
  app.get('/api/destajos/conceptos-disponibles', async (request, reply) => {
    const { obraId } = request.query;
    if (!obraId) return reply.code(400).send({ error: 'obraId es obligatorio' });
    const { rows } = await pool.query(
      `SELECT c.id, c.capitulo, c.clave, c.descripcion, c.unidad, c.cantidad_contratada, c.precio_unitario
       FROM conceptos_obra c
       WHERE c.obra_id = $1
         AND NOT EXISTS (SELECT 1 FROM destajos d WHERE d.concepto_id = c.id AND d.estatus = 'activo')
       ORDER BY c.capitulo NULLS LAST, c.clave`,
      [obraId]
    );
    return rows;
  });

  app.get('/api/destajos/:id', async (request, reply) => {
    const data = await cargarDestajoCompleto(pool, request.params.id);
    if (!data) return reply.code(404).send({ error: 'Destajo no encontrado' });
    return data;
  });

  app.post('/api/destajos', async (request, reply) => {
    const { destajistaId, conceptoId, precioDestajo, notas } = request.body ?? {};
    if (!destajistaId || !conceptoId || !precioDestajo || Number(precioDestajo) <= 0) {
      return reply.code(400).send({ error: 'Destajista, concepto y precio de destajo son obligatorios' });
    }
    try {
      const { rows } = await pool.query(
        `INSERT INTO destajos (destajista_id, concepto_id, precio_destajo, notas, creado_por)
         VALUES ($1, $2, $3, $4, $5) RETURNING id`,
        [destajistaId, conceptoId, precioDestajo, notas?.trim() || null, request.user.sub]
      );
      await registrarBitacora(pool, {
        tabla: 'destajos', registroId: rows[0].id, usuarioId: request.user.sub, accion: 'crear',
        despues: { destajistaId, conceptoId, precioDestajo },
      });
      return reply.code(201).send(await cargarDestajoCompleto(pool, rows[0].id));
    } catch (err) {
      if (err.code === '23505') return reply.code(409).send({ error: 'Este concepto ya tiene un destajo activo — cancela o liquida el anterior primero' });
      request.log.error(err);
      return reply.code(500).send({ error: 'No se pudo crear el destajo' });
    }
  });

  app.post('/api/destajos/:id/cerrar', { preHandler: app.requireRole(...ROLES_GESTION) }, async (request, reply) => {
    const { id } = request.params;
    const { estatus } = request.body ?? {}; // 'liquidado' | 'cancelado'
    if (!['liquidado', 'cancelado'].includes(estatus)) {
      return reply.code(400).send({ error: 'Estatus inválido (usa liquidado o cancelado)' });
    }
    const { rows } = await pool.query(
      `UPDATE destajos SET estatus = $2, cerrado_en = now() WHERE id = $1 AND estatus = 'activo' RETURNING id`,
      [id, estatus]
    );
    if (!rows[0]) return reply.code(409).send({ error: 'Este destajo ya no está activo' });
    await registrarBitacora(pool, { tabla: 'destajos', registroId: id, usuarioId: request.user.sub, accion: estatus });
    return cargarDestajoCompleto(pool, id);
  });

  // --- Pagos (anticipos) a destajo ---

  app.post('/api/destajos/:id/pagos', { preHandler: app.requireRole(...ROLES_GESTION) }, async (request, reply) => {
    const { id } = request.params;
    const { fecha, monto, notas } = request.body ?? {};
    if (!monto || Number(monto) <= 0) return reply.code(400).send({ error: 'El monto debe ser mayor a cero' });

    try {
      const resultado = await withTransaction(async (client) => {
        const actual = await cargarDestajoCompleto(client, id);
        if (!actual) throw Object.assign(new Error('NOT_FOUND'), { code: 404 });
        if (actual.estatus !== 'activo') throw Object.assign(new Error('NO_ACTIVO'), { code: 409 });
        if (Number(monto) > actual.saldo + 0.01) {
          throw Object.assign(new Error('SALDO_INSUFICIENTE'), { code: 422, saldo: actual.saldo });
        }

        await client.query(
          `INSERT INTO destajo_pago (destajo_id, fecha, monto, notas, registrado_por) VALUES ($1, COALESCE($2, current_date), $3, $4, $5)`,
          [id, fecha || null, monto, notas?.trim() || null, request.user.sub]
        );
        await registrarBitacora(client, {
          tabla: 'destajo_pago', registroId: id, usuarioId: request.user.sub, accion: 'crear', despues: { monto },
        });
        return cargarDestajoCompleto(client, id);
      });
      return reply.code(201).send(resultado);
    } catch (err) {
      if (err.code === 404) return reply.code(404).send({ error: 'Destajo no encontrado' });
      if (err.code === 409) return reply.code(409).send({ error: 'Este destajo ya no está activo' });
      if (err.code === 422) return reply.code(422).send({ error: `El monto supera el saldo pendiente (${err.saldo.toFixed(2)})` });
      request.log.error(err);
      return reply.code(500).send({ error: 'No se pudo registrar el pago' });
    }
  });
}
