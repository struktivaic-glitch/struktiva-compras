import { pool, withTransaction } from '../../db/pool.js';
import { registrarBitacora } from '../../lib/audit.js';
import { siguienteFolio } from '../../lib/folio.js';
import { registrarFirma } from '../../lib/firma.js';

async function cargarRequisicionCompleta(client, id) {
  const { rows: cab } = await client.query(
    `SELECT r.*, o.nombre AS obra_nombre, e.nombre AS etapa_nombre, f.nombre AS frente_nombre,
            p.clave AS partida_clave, p.nombre AS partida_nombre,
            us.nombre AS solicitante_nombre, ua.nombre AS autoriza_nombre
     FROM requisiciones r
     JOIN obras o ON o.id = r.obra_id
     JOIN etapas e ON e.id = r.etapa_id
     JOIN frentes f ON f.id = r.frente_id
     JOIN partidas p ON p.id = r.partida_id
     JOIN usuarios us ON us.id = r.usuario_solicitante_id
     LEFT JOIN usuarios ua ON ua.id = r.usuario_autoriza_id
     WHERE r.id = $1`,
    [id]
  );
  if (!cab[0]) return null;

  const { rows: detalle } = await client.query(
    `SELECT rd.id, rd.insumo_id, rd.cantidad_requerida, rd.cantidad_aprobada, rd.excede_presupuesto, rd.justificacion,
            i.clave, i.descripcion, i.unidad,
            s.cantidad_presupuestada, s.saldo_disponible
     FROM requisicion_detalle rd
     JOIN insumos i ON i.id = rd.insumo_id
     JOIN vw_saldo_obra_insumo s ON s.obra_id = $2 AND s.insumo_id = rd.insumo_id
     WHERE rd.requisicion_id = $1
     ORDER BY rd.id`,
    [id, cab[0].obra_id]
  );

  return { ...cab[0], detalle };
}

export default async function requisicionesRoutes(app) {
  app.addHook('preHandler', app.authenticate);

  app.get('/api/requisiciones', async (request) => {
    const { estatus, obraId, mias, sinCotizar } = request.query;
    const condiciones = [];
    const valores = [];

    if (estatus) {
      valores.push(estatus);
      condiciones.push(`r.estatus = $${valores.length}`);
    }
    if (obraId) {
      valores.push(obraId);
      condiciones.push(`r.obra_id = $${valores.length}`);
    }
    if (mias === '1') {
      valores.push(request.user.sub);
      condiciones.push(`r.usuario_solicitante_id = $${valores.length}`);
    }
    if (sinCotizar === '1') {
      condiciones.push(`NOT EXISTS (
        SELECT 1 FROM proceso_cotizacion_requisicion pcr
        JOIN procesos_cotizacion pc ON pc.id = pcr.proceso_id
        WHERE pcr.requisicion_id = r.id AND pc.estatus != 'cancelado'
      )`);
    }

    const where = condiciones.length ? `WHERE ${condiciones.join(' AND ')}` : '';
    const { rows } = await pool.query(
      `SELECT r.id, r.folio, r.estatus, r.creado_en,
              o.nombre AS obra_nombre, f.nombre AS frente_nombre, p.nombre AS partida_nombre,
              us.nombre AS solicitante_nombre,
              (SELECT COUNT(*) FROM requisicion_detalle rd WHERE rd.requisicion_id = r.id AND rd.excede_presupuesto) AS renglones_excedidos
       FROM requisiciones r
       JOIN obras o ON o.id = r.obra_id
       JOIN frentes f ON f.id = r.frente_id
       JOIN partidas p ON p.id = r.partida_id
       JOIN usuarios us ON us.id = r.usuario_solicitante_id
       ${where}
       ORDER BY r.creado_en DESC
       LIMIT 200`,
      valores
    );
    return rows;
  });

  app.get('/api/requisiciones/:id', async (request, reply) => {
    const data = await cargarRequisicionCompleta(pool, request.params.id);
    if (!data) return reply.code(404).send({ error: 'Requisición no encontrada' });
    return data;
  });

  app.post('/api/requisiciones', async (request, reply) => {
    const { obraId, etapaId, frenteId, partidaId, items } = request.body ?? {};
    if (!obraId || !etapaId || !frenteId || !partidaId || !Array.isArray(items) || items.length === 0) {
      return reply.code(400).send({ error: 'Obra, etapa, frente, partida y al menos un insumo son obligatorios' });
    }

    try {
      const resultado = await withTransaction(async (client) => {
        const { rows: saldos } = await client.query(
          `SELECT insumo_id, saldo_disponible FROM vw_saldo_obra_insumo WHERE obra_id = $1`,
          [obraId]
        );
        const saldoPorInsumo = new Map(saldos.map((s) => [s.insumo_id, Number(s.saldo_disponible)]));

        const erroresJustificacion = [];
        const itemsValidados = items.map((item) => {
          const saldo = saldoPorInsumo.get(item.insumoId) ?? 0;
          const excede = Number(item.cantidadRequerida) > saldo;
          if (excede && !item.justificacion?.trim()) {
            erroresJustificacion.push({ insumoId: item.insumoId, saldoDisponible: saldo });
          }
          return { ...item, excede };
        });

        if (erroresJustificacion.length > 0) {
          const err = new Error('EXCEDE_SIN_JUSTIFICACION');
          err.detalle = erroresJustificacion;
          throw err;
        }

        const folio = await siguienteFolio(client, 'REQ', 'requisiciones_folio_seq');
        const { rows: reqRows } = await client.query(
          `INSERT INTO requisiciones (folio, obra_id, etapa_id, frente_id, partida_id, usuario_solicitante_id, estatus)
           VALUES ($1, $2, $3, $4, $5, $6, 'borrador') RETURNING id`,
          [folio, obraId, etapaId, frenteId, partidaId, request.user.sub]
        );
        const requisicionId = reqRows[0].id;

        for (const item of itemsValidados) {
          await client.query(
            `INSERT INTO requisicion_detalle (requisicion_id, insumo_id, cantidad_requerida, excede_presupuesto, justificacion)
             VALUES ($1, $2, $3, $4, $5)`,
            [requisicionId, item.insumoId, item.cantidadRequerida, item.excede, item.justificacion ?? null]
          );
        }

        await registrarBitacora(client, {
          tabla: 'requisiciones',
          registroId: requisicionId,
          usuarioId: request.user.sub,
          accion: 'crear',
          despues: { folio, estatus: 'borrador', items: itemsValidados },
        });

        return cargarRequisicionCompleta(client, requisicionId);
      });

      return reply.code(201).send(resultado);
    } catch (err) {
      if (err.message === 'EXCEDE_SIN_JUSTIFICACION') {
        return reply.code(422).send({
          error: 'Uno o más insumos exceden el saldo disponible y requieren justificación técnica',
          detalle: err.detalle,
        });
      }
      request.log.error(err);
      return reply.code(500).send({ error: 'No se pudo crear la requisición' });
    }
  });

  app.post('/api/requisiciones/:id/enviar', async (request, reply) => {
    const { id } = request.params;
    const resultado = await withTransaction(async (client) => {
      const { rows } = await client.query('SELECT estatus, usuario_solicitante_id FROM requisiciones WHERE id = $1 FOR UPDATE', [id]);
      const req = rows[0];
      if (!req) return { error: 404 };
      if (req.estatus !== 'borrador') return { error: 409, mensaje: 'Solo un borrador puede enviarse a autorización' };

      await client.query("UPDATE requisiciones SET estatus = 'pendiente_autorizacion', actualizado_en = now() WHERE id = $1", [id]);
      await registrarBitacora(client, {
        tabla: 'requisiciones', registroId: id, usuarioId: request.user.sub, accion: 'enviar_autorizacion',
        antes: { estatus: 'borrador' }, despues: { estatus: 'pendiente_autorizacion' },
      });
      return { ok: true };
    });

    if (resultado.error === 404) return reply.code(404).send({ error: 'Requisición no encontrada' });
    if (resultado.error === 409) return reply.code(409).send({ error: resultado.mensaje });
    return cargarRequisicionCompleta(pool, id);
  });

  app.post('/api/requisiciones/:id/autorizar', { preHandler: app.requireRole('superintendente', 'direccion') }, async (request, reply) => {
    const { id } = request.params;
    const { firma } = request.body ?? {};

    try {
      await withTransaction(async (client) => {
        const { rows } = await client.query('SELECT estatus FROM requisiciones WHERE id = $1 FOR UPDATE', [id]);
        const req = rows[0];
        if (!req) throw Object.assign(new Error('NOT_FOUND'), { code: 404 });
        if (req.estatus !== 'pendiente_autorizacion') {
          throw Object.assign(new Error('NO_PENDIENTE'), { code: 409 });
        }

        await registrarFirma(client, { request, entidadTipo: 'requisicion', entidadId: id, firma });

        await client.query(
          `UPDATE requisicion_detalle SET cantidad_aprobada = cantidad_requerida WHERE requisicion_id = $1`,
          [id]
        );
        await client.query(
          `UPDATE requisiciones SET estatus = 'autorizada', usuario_autoriza_id = $2, fecha_autorizacion = now(), actualizado_en = now() WHERE id = $1`,
          [id, request.user.sub]
        );
        await registrarBitacora(client, {
          tabla: 'requisiciones', registroId: id, usuarioId: request.user.sub, accion: 'autorizar',
          antes: { estatus: 'pendiente_autorizacion' }, despues: { estatus: 'autorizada', firma: firma?.tipo },
        });
      });
    } catch (err) {
      if (err.code === 404) return reply.code(404).send({ error: 'Requisición no encontrada' });
      if (err.code === 409) return reply.code(409).send({ error: 'Solo una requisición pendiente puede autorizarse' });
      if (err.message === 'FIRMA_REQUERIDA') return reply.code(400).send({ error: 'Se requiere firma (táctil o PIN) para autorizar' });
      if (err.message === 'SIN_PIN_CONFIGURADO') return reply.code(400).send({ error: 'Aún no configuras tu PIN de firma. Ve a tu perfil para crearlo.' });
      if (err.message === 'PIN_INCORRECTO') return reply.code(422).send({ error: 'PIN incorrecto' });
      if (err.message === 'FIRMA_TACTIL_INVALIDA') return reply.code(400).send({ error: 'La firma táctil capturada no es válida, intenta de nuevo' });
      request.log.error(err);
      return reply.code(500).send({ error: 'No se pudo autorizar la requisición' });
    }

    return cargarRequisicionCompleta(pool, id);
  });

  app.post('/api/requisiciones/:id/cancelar', async (request, reply) => {
    const { id } = request.params;
    const resultado = await withTransaction(async (client) => {
      const { rows } = await client.query('SELECT estatus FROM requisiciones WHERE id = $1 FOR UPDATE', [id]);
      const req = rows[0];
      if (!req) return { error: 404 };
      if (['atendida_parcial', 'atendida_total', 'cancelada'].includes(req.estatus)) {
        return { error: 409, mensaje: 'Esta requisición ya no puede cancelarse' };
      }

      await client.query("UPDATE requisiciones SET estatus = 'cancelada', actualizado_en = now() WHERE id = $1", [id]);
      await registrarBitacora(client, {
        tabla: 'requisiciones', registroId: id, usuarioId: request.user.sub, accion: 'cancelar',
        antes: { estatus: req.estatus }, despues: { estatus: 'cancelada' },
      });
      return { ok: true };
    });

    if (resultado.error === 404) return reply.code(404).send({ error: 'Requisición no encontrada' });
    if (resultado.error === 409) return reply.code(409).send({ error: resultado.mensaje });
    return cargarRequisicionCompleta(pool, id);
  });
}
