import { pool, withTransaction } from '../../db/pool.js';
import { registrarBitacora } from '../../lib/audit.js';
import { siguienteFolio } from '../../lib/folio.js';
import { notificarPorRol } from '../../lib/notificaciones.js';

// Nómina por lote (semanal/quincenal) — migración 030, reemplaza la captura individual de
// "Pagos a Personal" (Bloque HR-D). Sigue siendo control interno de gasto: "marcar pagada" solo
// registra que el pago ya se hizo por fuera del sistema, no mueve dinero real ni calcula
// ISR/IMSS. La tabla vieja `pagos_personal` no se toca — se sigue leyendo aparte como historial.

const ROLES_CAPTURAR = ['residente', 'superintendente', 'direccion'];
const FORMAS_PAGO_VALIDAS = new Set(['efectivo', 'transferencia', 'tarjeta_debito', 'tarjeta_credito']);

function hoy() {
  return new Date().toISOString().slice(0, 10);
}

async function cargarNominaCompleta(client, id) {
  const { rows: cab } = await client.query(
    `SELECT n.*, ug.nombre AS genero_nombre, up.nombre AS pagado_por_nombre
     FROM nominas n
     JOIN usuarios ug ON ug.id = n.usuario_genero_id
     LEFT JOIN usuarios up ON up.id = n.pagado_por
     WHERE n.id = $1`,
    [id]
  );
  if (!cab[0]) return null;

  const { rows: detalle } = await client.query(
    `SELECT nd.*, t.nombre AS trabajador_nombre, t.oficio, t.tipo AS trabajador_tipo
     FROM nomina_detalle nd
     JOIN trabajadores t ON t.id = nd.trabajador_id
     WHERE nd.nomina_id = $1
     ORDER BY t.nombre`,
    [id]
  );

  return { ...cab[0], detalle };
}

// ¿Esta persona ya está en OTRA nómina (no cancelada) cuyo periodo se traslape con [desde,hasta]?
// Se usa tanto para avisar en vivo mientras se captura como para revalidar en el servidor al
// guardar (nunca se confía solo en lo que ya validó el navegador).
async function buscarTraslapes(client, trabajadorId, desde, hasta, excluirNominaId) {
  const { rows } = await client.query(
    `SELECT n.id, n.folio, n.fecha_inicio, n.fecha_fin
     FROM nomina_detalle nd
     JOIN nominas n ON n.id = nd.nomina_id
     WHERE nd.trabajador_id = $1 AND n.estatus != 'cancelada'
       AND n.fecha_inicio <= $3 AND n.fecha_fin >= $2
       AND ($4::int IS NULL OR n.id != $4)`,
    [trabajadorId, desde, hasta, excluirNominaId ?? null]
  );
  return rows;
}

export default async function nominaRoutes(app) {
  app.addHook('preHandler', app.authenticate);

  // Punto de partida al agregar a alguien a la nómina: sueldo de referencia del expediente +
  // sugerencia de días trabajados a partir de Asistencia — siempre editable a mano después,
  // y el "usarAsistencia" real es una decisión por persona que vive en el frontend/al guardar.
  app.get('/api/nomina/sugerencia', async (request, reply) => {
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

    const traslapes = await buscarTraslapes(pool, trabajadorId, desde, hasta, null);

    return {
      trabajadorNombre: t.nombre,
      sueldoDiario: t.salario_periodo === 'diario' ? (t.salario_referencia != null ? Number(t.salario_referencia) : null) : null,
      diasAsistencia: aRows[0].dias,
      traslapes: traslapes.map((n) => ({ folio: n.folio, fechaInicio: n.fecha_inicio, fechaFin: n.fecha_fin })),
    };
  });

  app.get('/api/nomina', async (request) => {
    const { estatus, desde, hasta } = request.query;
    const condiciones = [];
    const valores = [];
    if (estatus) { valores.push(estatus); condiciones.push(`n.estatus = $${valores.length}`); }
    if (desde) { valores.push(desde); condiciones.push(`n.fecha_fin >= $${valores.length}`); }
    if (hasta) { valores.push(hasta); condiciones.push(`n.fecha_inicio <= $${valores.length}`); }
    const where = condiciones.length ? `WHERE ${condiciones.join(' AND ')}` : '';

    const { rows } = await pool.query(
      `SELECT n.id, n.folio, n.periodo_tipo, n.fecha_inicio, n.fecha_fin, n.estatus, n.fecha_pago,
              ug.nombre AS genero_nombre,
              (SELECT COUNT(*) FROM nomina_detalle nd WHERE nd.nomina_id = n.id) AS personal_count,
              (SELECT COALESCE(SUM(nd.monto_total), 0) FROM nomina_detalle nd WHERE nd.nomina_id = n.id) AS total
       FROM nominas n
       JOIN usuarios ug ON ug.id = n.usuario_genero_id
       ${where}
       ORDER BY n.fecha_inicio DESC
       LIMIT 200`,
      valores
    );
    return rows;
  });

  // Historial de antes de este bloque — de solo lectura, no se vuelve a escribir aquí. Se
  // muestra junto a los folios nuevos para no perder visibilidad de lo ya capturado.
  app.get('/api/nomina/historial-anterior', async () => {
    const { rows } = await pool.query(
      `SELECT p.id, p.fecha_inicio, p.fecha_fin, p.concepto, p.dias_trabajados, p.monto, p.estatus,
              p.fecha_pago, p.forma_pago, t.nombre AS trabajador_nombre
       FROM pagos_personal p
       JOIN trabajadores t ON t.id = p.trabajador_id
       ORDER BY p.fecha_inicio DESC
       LIMIT 200`
    );
    return rows;
  });

  app.get('/api/nomina/:id', async (request, reply) => {
    const data = await cargarNominaCompleta(pool, request.params.id);
    if (!data) return reply.code(404).send({ error: 'Nómina no encontrada' });
    return data;
  });

  app.post('/api/nomina', { preHandler: app.requireRole(...ROLES_CAPTURAR) }, async (request, reply) => {
    const { periodoTipo, fechaInicio, fechaFin, personal } = request.body ?? {};
    if (!['semanal', 'quincenal'].includes(periodoTipo)) {
      return reply.code(400).send({ error: 'El periodo debe ser semanal o quincenal' });
    }
    if (!fechaInicio || !fechaFin || fechaFin < fechaInicio) {
      return reply.code(400).send({ error: 'Fecha de inicio y fin son obligatorias y la fecha fin no puede ser antes del inicio' });
    }
    if (!Array.isArray(personal) || personal.length === 0) {
      return reply.code(400).send({ error: 'Agrega al menos una persona a la nómina' });
    }

    try {
      const resultado = await withTransaction(async (client) => {
        const detalleValidado = [];
        for (const p of personal) {
          if (!p.trabajadorId || !(Number(p.sueldoDiario) > 0)) {
            throw Object.assign(new Error('DATOS_INCOMPLETOS'), { code: 400 });
          }
          const diasTrabajados = Number(p.diasTrabajados || 0);
          const compensacion = Number(p.compensacion || 0);
          const descuento = Number(p.descuento || 0);
          const montoTotal = diasTrabajados * Number(p.sueldoDiario) + compensacion - descuento;
          if (montoTotal < 0) {
            throw Object.assign(new Error('MONTO_NEGATIVO'), { code: 422, detalle: p.trabajadorId });
          }

          const traslapes = await buscarTraslapes(client, p.trabajadorId, fechaInicio, fechaFin, null);
          if (traslapes.length > 0 && !p.duplicadoJustificacion?.trim()) {
            throw Object.assign(new Error('TRASLAPE_SIN_JUSTIFICAR'), {
              code: 422,
              detalle: { trabajadorId: p.trabajadorId, traslapes: traslapes.map((n) => n.folio) },
            });
          }

          detalleValidado.push({
            trabajadorId: p.trabajadorId,
            sueldoDiario: Number(p.sueldoDiario),
            usarAsistencia: Boolean(p.usarAsistencia),
            diasTrabajados,
            compensacion,
            compensacionConcepto: p.compensacionConcepto?.trim() || null,
            descuento,
            descuentoMotivo: p.descuentoMotivo?.trim() || null,
            montoTotal,
            duplicadoJustificacion: traslapes.length > 0 ? p.duplicadoJustificacion.trim() : null,
          });
        }

        const folio = await siguienteFolio(client, 'NOM', 'nominas_folio_seq');
        const { rows: nomRows } = await client.query(
          `INSERT INTO nominas (folio, periodo_tipo, fecha_inicio, fecha_fin, usuario_genero_id)
           VALUES ($1, $2, $3, $4, $5) RETURNING id`,
          [folio, periodoTipo, fechaInicio, fechaFin, request.user.sub]
        );
        const nominaId = nomRows[0].id;

        for (const d of detalleValidado) {
          await client.query(
            `INSERT INTO nomina_detalle
               (nomina_id, trabajador_id, sueldo_diario, usar_asistencia, dias_trabajados,
                compensacion, compensacion_concepto, descuento, descuento_motivo, monto_total, duplicado_justificacion)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)`,
            [
              nominaId, d.trabajadorId, d.sueldoDiario, d.usarAsistencia, d.diasTrabajados,
              d.compensacion, d.compensacionConcepto, d.descuento, d.descuentoMotivo, d.montoTotal, d.duplicadoJustificacion,
            ]
          );
        }

        await registrarBitacora(client, {
          tabla: 'nominas', registroId: nominaId, usuarioId: request.user.sub, accion: 'crear',
          despues: { folio, periodoTipo, fechaInicio, fechaFin, personal: detalleValidado },
        });

        const total = detalleValidado.reduce((acc, d) => acc + d.montoTotal, 0);
        await notificarPorRol(client, {
          roles: ['direccion'],
          categoria: 'nomina',
          entidadTipo: 'nomina',
          entidadId: nominaId,
          titulo: `Nueva nómina generada: ${folio}`,
          mensaje: `${detalleValidado.length} persona(s) · Total ${total.toLocaleString('es-MX', { style: 'currency', currency: 'MXN' })} — pendiente de marcar como pagada.`,
          excluirUsuarioId: request.user.sub,
        });

        return cargarNominaCompleta(client, nominaId);
      });

      return reply.code(201).send(resultado);
    } catch (err) {
      if (err.message === 'DATOS_INCOMPLETOS') {
        return reply.code(400).send({ error: 'Cada persona necesita un sueldo diario capturado (mayor a cero)' });
      }
      if (err.message === 'MONTO_NEGATIVO') {
        return reply.code(422).send({ error: 'El descuento no puede ser mayor a los días trabajados más la compensación' });
      }
      if (err.message === 'TRASLAPE_SIN_JUSTIFICAR') {
        return reply.code(422).send({
          error: `Esta persona ya está incluida en otra nómina de este periodo (${err.detalle.traslapes.join(', ')}) — captura una justificación para incluirla de todos modos.`,
          detalle: err.detalle,
        });
      }
      request.log.error(err);
      return reply.code(500).send({ error: 'No se pudo generar la nómina' });
    }
  });

  app.post('/api/nomina/:id/marcar-pagada', { preHandler: app.requireRole('direccion') }, async (request, reply) => {
    const { id } = request.params;
    const { fechaPago, formaPago } = request.body ?? {};
    if (!FORMAS_PAGO_VALIDAS.has(formaPago)) {
      return reply.code(400).send({ error: 'Forma de pago inválida (efectivo, transferencia, tarjeta de débito o tarjeta de crédito)' });
    }
    const { rows: existentes } = await pool.query('SELECT estatus FROM nominas WHERE id = $1', [id]);
    if (!existentes[0]) return reply.code(404).send({ error: 'Nómina no encontrada' });
    if (existentes[0].estatus !== 'borrador') return reply.code(422).send({ error: 'Esta nómina ya no está en borrador' });

    const { rows } = await pool.query(
      `UPDATE nominas SET estatus = 'pagada', fecha_pago = $2, pagado_por = $3, forma_pago = $4 WHERE id = $1 RETURNING *`,
      [id, fechaPago || hoy(), request.user.sub, formaPago]
    );
    await registrarBitacora(pool, {
      tabla: 'nominas', registroId: id, usuarioId: request.user.sub, accion: 'marcar_pagada', despues: rows[0],
    });
    return cargarNominaCompleta(pool, id);
  });

  app.post('/api/nomina/:id/cancelar', { preHandler: app.requireRole(...ROLES_CAPTURAR) }, async (request, reply) => {
    const { id } = request.params;
    const { rows: existentes } = await pool.query('SELECT estatus FROM nominas WHERE id = $1', [id]);
    if (!existentes[0]) return reply.code(404).send({ error: 'Nómina no encontrada' });
    if (existentes[0].estatus !== 'borrador') return reply.code(422).send({ error: 'Ya no se puede cancelar (no está en borrador)' });

    await pool.query(`UPDATE nominas SET estatus = 'cancelada' WHERE id = $1`, [id]);
    await registrarBitacora(pool, {
      tabla: 'nominas', registroId: id, usuarioId: request.user.sub, accion: 'cancelar',
    });
    return cargarNominaCompleta(pool, id);
  });
}
