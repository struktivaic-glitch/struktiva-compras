import { pool, withTransaction } from '../../db/pool.js';
import { registrarBitacora } from '../../lib/audit.js';
import { siguienteFolio } from '../../lib/folio.js';
import { registrarFirma } from '../../lib/firma.js';
import { notificarPorRol } from '../../lib/notificaciones.js';
import { env } from '../../config/env.js';

// Vista previa en texto de la requisición para el mensaje de Telegram — no es un PDF/impresión
// real (eso pediría Puppeteer, que evitamos a propósito en este proyecto), pero da el detalle
// completo sin tener que abrir la app primero.
function formatoRequisicionTelegram(req, encabezado) {
  const lineas = [encabezado, ''];
  lineas.push(`Obra: ${req.obra_nombre} / ${req.frente_nombre} / ${req.partida_nombre}`);
  lineas.push(`Solicitante: ${req.solicitante_nombre}`);
  const hayExcedente = req.detalle.some((d) => d.excede_presupuesto);
  if (hayExcedente) lineas.push('⚠️ Incluye insumos que exceden el saldo disponible');
  lineas.push('', 'Insumos:');
  let totalGeneral = 0;
  for (const d of req.detalle) {
    const cantidad = Number(d.cantidad_requerida).toLocaleString('es-MX');
    const marca = d.excede_presupuesto ? ' ⚠️ excede' : '';
    const total = Number(d.total_sugerido ?? 0);
    totalGeneral += total;
    const pu = d.precio_unitario != null ? ` · P.U. $${Number(d.precio_unitario).toLocaleString('es-MX')} · Total $${total.toLocaleString('es-MX')}` : '';
    lineas.push(`• ${d.descripcion} — ${cantidad} ${d.unidad}${marca}${pu}`);
    if (d.excede_presupuesto && d.justificacion) lineas.push(`   Justificación: ${d.justificacion}`);
  }
  if (req.detalle.some((d) => d.precio_unitario != null)) lineas.push(`Total sugerido: $${totalGeneral.toLocaleString('es-MX')}`);
  lineas.push('', `Ver y autorizar: ${env.corsOrigin}/requisiciones`);
  return lineas.join('\n');
}

async function cargarRequisicionCompleta(client, id) {
  const { rows: cab } = await client.query(
    `SELECT r.*, o.nombre AS obra_nombre, e.nombre AS etapa_nombre, f.nombre AS frente_nombre,
            p.clave AS partida_clave, p.nombre AS partida_nombre,
            us.nombre AS solicitante_nombre, ua.nombre AS autoriza_nombre, uc.nombre AS cancelado_por_nombre
     FROM requisiciones r
     JOIN obras o ON o.id = r.obra_id
     JOIN etapas e ON e.id = r.etapa_id
     JOIN frentes f ON f.id = r.frente_id
     JOIN partidas p ON p.id = r.partida_id
     JOIN usuarios us ON us.id = r.usuario_solicitante_id
     LEFT JOIN usuarios ua ON ua.id = r.usuario_autoriza_id
     LEFT JOIN usuarios uc ON uc.id = r.cancelado_por
     WHERE r.id = $1`,
    [id]
  );
  if (!cab[0]) return null;

  const { rows: detalle } = await client.query(
    `SELECT rd.id, rd.insumo_id, rd.cantidad_requerida, rd.cantidad_aprobada, rd.excede_presupuesto, rd.justificacion,
            rd.precio_unitario,
            -- Para renglones de Mano de Obra, cantidad_requerida es una cantidad EQUIVALENTE
            -- derivada del monto total ÷ costo unitario (guardada con solo 4 decimales) — usar
            -- cantidad × precio para el total redondea distinto a la suma real del personal (ej.
            -- $850.00 de personal podía mostrarse como $850.01). Cuando el renglón tiene personal
            -- ligado, el total se toma directo de esa suma exacta; si no, cantidad × precio como
            -- siempre (insumos normales, sin desglose de personal).
            COALESCE(
              (SELECT SUM(rp.monto) FROM requisicion_personal rp WHERE rp.requisicion_detalle_id = rd.id),
              rd.cantidad_requerida * COALESCE(rd.precio_unitario, s.costo_unitario)
            ) AS total_sugerido,
            i.clave, i.descripcion, i.unidad, COALESCE(fi.es_mano_de_obra, false) AS es_mano_de_obra,
            s.cantidad_presupuestada, s.saldo_disponible, s.costo_unitario
     FROM requisicion_detalle rd
     JOIN insumos i ON i.id = rd.insumo_id
     LEFT JOIN familias_insumo fi ON fi.id = i.familia_id
     JOIN vw_saldo_obra_insumo s ON s.obra_id = $2 AND s.insumo_id = rd.insumo_id
     WHERE rd.requisicion_id = $1
     ORDER BY rd.id`,
    [id, cab[0].obra_id]
  );

  const { rows: personal } = await client.query(
    `SELECT rp.id, rp.trabajador_id, rp.requisicion_detalle_id, rp.monto, rp.dias_trabajados, rp.tarifa_diaria, t.nombre, t.oficio
     FROM requisicion_personal rp
     JOIN trabajadores t ON t.id = rp.trabajador_id
     WHERE rp.requisicion_id = $1
     ORDER BY t.nombre`,
    [id]
  );

  // Personal "plano" (Bloque 23, requisiciones de materiales con Mano de Obra mezclada) vs.
  // personal anidado por renglón (Bloque 28, requisiciones de nómina — cada detalle trae su
  // propio desglose, para que el árbol Partida → Renglón → Personal se pueda dibujar tal cual).
  const detalleConPersonal = detalle.map((d) => ({
    ...d,
    personal: personal.filter((p) => p.requisicion_detalle_id === d.id),
  }));
  const personalPlano = personal.filter((p) => p.requisicion_detalle_id === null);

  return { ...cab[0], detalle: detalleConPersonal, personal: personalPlano };
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
      `SELECT r.id, r.folio, r.estatus, r.tipo, r.creado_en, r.usuario_solicitante_id,
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
    const { obraId, etapaId, frenteId, partidaId, items, tipo } = request.body ?? {};
    const tipoReq = tipo === 'nomina' ? 'nomina' : 'materiales';
    if (!obraId || !etapaId || !frenteId || !partidaId || !Array.isArray(items) || items.length === 0) {
      return reply.code(400).send({ error: 'Obra, etapa, frente, partida y al menos un insumo son obligatorios' });
    }

    try {
      const resultado = await withTransaction(async (client) => {
        const { rows: saldos } = await client.query(
          `SELECT s.insumo_id, s.saldo_disponible, s.costo_unitario, COALESCE(fi.es_mano_de_obra, false) AS es_mano_de_obra
           FROM vw_saldo_obra_insumo s
           JOIN insumos i ON i.id = s.insumo_id
           LEFT JOIN familias_insumo fi ON fi.id = i.familia_id
           WHERE s.obra_id = $1`,
          [obraId]
        );
        const saldoPorInsumo = new Map(saldos.map((s) => [s.insumo_id, s]));

        const erroresJustificacion = [];
        const erroresPrecio = [];
        let itemsValidados;

        if (tipoReq === 'nomina') {
          // Requisición de Nómina (Bloque 28): no se captura cantidad ni P.U. directo — cada
          // renglón es un rubro de Mano de Obra y se desglosa en personal (días × tarifa diaria).
          // La cantidad y el P.U. se derivan del propio desglose, para que el total del renglón
          // SIEMPRE sea exactamente la suma de su personal (nunca puede "no cuadrar").
          const erroresPersonal = [];
          itemsValidados = items.map((item) => {
            const info = saldoPorInsumo.get(item.insumoId);
            const personalItem = Array.isArray(item.personal)
              ? item.personal.filter((p) => p.trabajadorId && Number(p.diasTrabajados) > 0 && Number(p.tarifaDiaria) > 0)
              : [];
            if (personalItem.length === 0) erroresPersonal.push(item.insumoId);
            const montoRenglon = personalItem.reduce((acc, p) => acc + Number(p.diasTrabajados) * Number(p.tarifaDiaria), 0);
            const costoUnitario = Number(info?.costo_unitario ?? 0);
            if (!(costoUnitario > 0)) erroresPrecio.push(item.insumoId);
            const cantidadRequerida = costoUnitario > 0 ? montoRenglon / costoUnitario : 0;
            const saldo = Number(info?.saldo_disponible ?? 0);
            const excede = cantidadRequerida > saldo;
            if (excede && !item.justificacion?.trim()) {
              erroresJustificacion.push({ insumoId: item.insumoId, saldoDisponible: saldo });
            }
            return { ...item, personal: personalItem, cantidadRequerida, precioUnitario: costoUnitario, excede };
          });
          if (erroresPersonal.length > 0) {
            throw Object.assign(new Error('RENGLON_SIN_PERSONAL'), { code: 400 });
          }
        } else {
          // Renglones de Mano de Obra dentro de una requisición de materiales (Bloque 23,
          // rediseñado 07/08/2026 a pedido del usuario): igual que en Nómina, la cantidad y el
          // P.U. ya NO se capturan a mano — se derivan del desglose de personal asignado a ese
          // mismo renglón (suma de montos), convertida a la unidad del insumo usando su costo
          // presupuestado como tipo de cambio. Así el total del renglón SIEMPRE es exactamente la
          // suma de su propio personal — nunca puede "no cuadrar" porque ya no hay dos capturas
          // independientes que cuadrar. Los insumos que no son de Mano de Obra siguen exactamente
          // igual que siempre (cantidad y P.U. capturados directo).
          const erroresPersonalMdO = [];
          itemsValidados = items.map((item) => {
            const info = saldoPorInsumo.get(item.insumoId);
            const saldo = Number(info?.saldo_disponible ?? 0);
            const esManoDeObra = Boolean(info?.es_mano_de_obra);

            let cantidadRequerida, precioUnitario, personalItem = [];
            if (esManoDeObra) {
              personalItem = Array.isArray(item.personal)
                ? item.personal.filter((p) => p.trabajadorId && Number(p.monto) > 0)
                : [];
              if (personalItem.length === 0) erroresPersonalMdO.push(item.insumoId);
              const montoRenglon = personalItem.reduce((acc, p) => acc + Number(p.monto), 0);
              const costoUnitario = Number(info?.costo_unitario ?? 0);
              precioUnitario = costoUnitario;
              cantidadRequerida = costoUnitario > 0 ? montoRenglon / costoUnitario : 0;
            } else {
              cantidadRequerida = Number(item.cantidadRequerida);
              // El P.U. lo captura quien pide la requisición (visible desde el inicio, no un
              // cálculo oculto contra el presupuesto) — solo caemos al costo presupuestado si no
              // mandaron nada.
              precioUnitario = item.precioUnitario != null && item.precioUnitario !== '' ? Number(item.precioUnitario) : Number(info?.costo_unitario ?? 0);
            }

            const excede = cantidadRequerida > saldo;
            if (excede && !item.justificacion?.trim()) {
              erroresJustificacion.push({ insumoId: item.insumoId, saldoDisponible: saldo });
            }
            if (!(precioUnitario > 0)) erroresPrecio.push(item.insumoId);
            return { ...item, excede, precioUnitario, cantidadRequerida, personal: personalItem, esManoDeObra };
          });
          if (erroresPersonalMdO.length > 0) {
            throw Object.assign(new Error('RENGLON_MDO_SIN_PERSONAL'), { code: 400 });
          }
        }

        if (erroresPrecio.length > 0) {
          throw Object.assign(new Error('PRECIO_UNITARIO_REQUERIDO'), { code: 400 });
        }

        if (erroresJustificacion.length > 0) {
          const err = new Error('EXCEDE_SIN_JUSTIFICACION');
          err.detalle = erroresJustificacion;
          throw err;
        }

        const folio = await siguienteFolio(client, 'REQ', 'requisiciones_folio_seq');
        const { rows: reqRows } = await client.query(
          `INSERT INTO requisiciones (folio, obra_id, etapa_id, frente_id, partida_id, usuario_solicitante_id, estatus, tipo)
           VALUES ($1, $2, $3, $4, $5, $6, 'borrador', $7) RETURNING id`,
          [folio, obraId, etapaId, frenteId, partidaId, request.user.sub, tipoReq]
        );
        const requisicionId = reqRows[0].id;

        for (const item of itemsValidados) {
          const { rows: detalleRows } = await client.query(
            `INSERT INTO requisicion_detalle (requisicion_id, insumo_id, cantidad_requerida, excede_presupuesto, justificacion, precio_unitario)
             VALUES ($1, $2, $3, $4, $5, $6) RETURNING id`,
            [requisicionId, item.insumoId, item.cantidadRequerida, item.excede, item.justificacion ?? null, item.precioUnitario]
          );
          if (tipoReq === 'nomina') {
            for (const p of item.personal) {
              const monto = Number(p.diasTrabajados) * Number(p.tarifaDiaria);
              await client.query(
                `INSERT INTO requisicion_personal (requisicion_id, requisicion_detalle_id, trabajador_id, monto, dias_trabajados, tarifa_diaria)
                 VALUES ($1, $2, $3, $4, $5, $6)`,
                [requisicionId, detalleRows[0].id, p.trabajadorId, monto, p.diasTrabajados, p.tarifaDiaria]
              );
            }
          } else if (item.esManoDeObra) {
            // Mismo criterio que nómina, pero con monto directo (sin días × tarifa) — es el
            // desglose que ya existía para Mano de Obra mezclada en una requisición de
            // materiales, ahora ligado al renglón (requisicion_detalle_id) en vez de "plano".
            for (const p of item.personal) {
              await client.query(
                `INSERT INTO requisicion_personal (requisicion_id, requisicion_detalle_id, trabajador_id, monto)
                 VALUES ($1, $2, $3, $4)`,
                [requisicionId, detalleRows[0].id, p.trabajadorId, p.monto]
              );
            }
          }
        }

        await registrarBitacora(client, {
          tabla: 'requisiciones',
          registroId: requisicionId,
          usuarioId: request.user.sub,
          accion: 'crear',
          despues: { folio, estatus: 'borrador', tipo: tipoReq, items: itemsValidados },
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
      if (err.message === 'PRECIO_UNITARIO_REQUERIDO') {
        return reply.code(400).send({ error: 'Captura un precio unitario mayor a cero en cada insumo.' });
      }
      if (err.message === 'RENGLON_SIN_PERSONAL') {
        return reply.code(400).send({ error: 'Cada renglón de nómina necesita al menos una persona con días y tarifa capturados.' });
      }
      if (err.message === 'RENGLON_MDO_SIN_PERSONAL') {
        return reply.code(400).send({ error: 'Cada renglón de Mano de Obra necesita al menos una persona con un monto asignado.' });
      }
      request.log.error(err);
      return reply.code(500).send({ error: 'No se pudo crear la requisición' });
    }
  });

  app.post('/api/requisiciones/:id/enviar', async (request, reply) => {
    const { id } = request.params;
    const resultado = await withTransaction(async (client) => {
      const { rows } = await client.query('SELECT estatus, folio, usuario_solicitante_id FROM requisiciones WHERE id = $1 FOR UPDATE', [id]);
      const req = rows[0];
      if (!req) return { error: 404 };
      if (req.usuario_solicitante_id !== request.user.sub && request.user.rol !== 'direccion') {
        return { error: 403, mensaje: 'Solo quien creó la requisición o Dirección puede enviarla a autorizar' };
      }
      if (req.estatus !== 'borrador') return { error: 409, mensaje: 'Solo un borrador puede enviarse a autorización' };

      await client.query("UPDATE requisiciones SET estatus = 'pendiente_autorizacion', actualizado_en = now() WHERE id = $1", [id]);
      await registrarBitacora(client, {
        tabla: 'requisiciones', registroId: id, usuarioId: request.user.sub, accion: 'enviar_autorizacion',
        antes: { estatus: 'borrador' }, despues: { estatus: 'pendiente_autorizacion' },
      });

      const completa = await cargarRequisicionCompleta(client, id);
      await notificarPorRol(client, {
        roles: ['superintendente', 'direccion'], categoria: 'requisicion', entidadTipo: 'requisicion', entidadId: Number(id),
        titulo: `Requisición ${req.folio} pendiente de autorizar`,
        mensaje: 'Requiere tu autorización para continuar.',
        textoTelegram: formatoRequisicionTelegram(completa, `📋 ${req.folio} pendiente de autorizar`),
        excluirUsuarioId: request.user.sub,
      });
      return { ok: true };
    });

    if (resultado.error === 404) return reply.code(404).send({ error: 'Requisición no encontrada' });
    if (resultado.error === 403) return reply.code(403).send({ error: resultado.mensaje });
    if (resultado.error === 409) return reply.code(409).send({ error: resultado.mensaje });
    return cargarRequisicionCompleta(pool, id);
  });

  app.post('/api/requisiciones/:id/autorizar', { preHandler: app.requireRole('superintendente', 'direccion') }, async (request, reply) => {
    const { id } = request.params;
    const { firma } = request.body ?? {};

    try {
      await withTransaction(async (client) => {
        const { rows } = await client.query('SELECT estatus, folio FROM requisiciones WHERE id = $1 FOR UPDATE', [id]);
        const req = rows[0];
        if (!req) throw Object.assign(new Error('NOT_FOUND'), { code: 404 });
        if (req.estatus !== 'pendiente_autorizacion') {
          throw Object.assign(new Error('NO_PENDIENTE'), { code: 409 });
        }

        const { rows: excedRows } = await client.query(
          'SELECT COUNT(*) FROM requisicion_detalle WHERE requisicion_id = $1 AND excede_presupuesto',
          [id]
        );
        const tieneExcedente = Number(excedRows[0].count) > 0;

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

        // El excedente lo puede autorizar Superintendente o Dirección — al que NO lo hizo se le
        // avisa que el otro ya hizo el ajuste, para que ambos queden enterados.
        if (tieneExcedente) {
          const otroRol = request.user.rol === 'direccion' ? 'superintendente' : 'direccion';
          const completa = await cargarRequisicionCompleta(client, id);
          await notificarPorRol(client, {
            roles: [otroRol], categoria: 'excedente', entidadTipo: 'requisicion', entidadId: Number(id),
            titulo: `Excedente autorizado en requisición ${req.folio}`,
            mensaje: `${request.user.nombre} autorizó el excedente de presupuesto de esta requisición.`,
            textoTelegram: formatoRequisicionTelegram(completa, `✅ ${request.user.nombre} autorizó el excedente de ${req.folio}`),
            excluirUsuarioId: request.user.sub,
          });
        }
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
    const { motivo } = request.body ?? {};
    const resultado = await withTransaction(async (client) => {
      const { rows } = await client.query('SELECT estatus, folio, usuario_solicitante_id FROM requisiciones WHERE id = $1 FOR UPDATE', [id]);
      const req = rows[0];
      if (!req) return { error: 404 };
      if (req.usuario_solicitante_id !== request.user.sub && request.user.rol !== 'direccion') {
        return { error: 403, mensaje: 'Solo quien creó la requisición o Dirección puede cancelarla' };
      }
      if (['atendida_parcial', 'atendida_total', 'cancelada'].includes(req.estatus)) {
        return { error: 409, mensaje: 'Esta requisición ya no puede cancelarse' };
      }

      await client.query(
        `UPDATE requisiciones SET estatus = 'cancelada', cancelado_por = $2, fecha_cancelacion = now(),
           motivo_cancelacion = $3, actualizado_en = now() WHERE id = $1`,
        [id, request.user.sub, motivo?.trim() || null]
      );
      await registrarBitacora(client, {
        tabla: 'requisiciones', registroId: id, usuarioId: request.user.sub, accion: 'cancelar',
        antes: { estatus: req.estatus }, despues: { estatus: 'cancelada', motivo: motivo?.trim() || null },
      });
      // Aviso informativo — no bloquea al que cancela, solo mantiene a Dirección/Auditoría enteradas.
      await notificarPorRol(client, {
        roles: ['direccion', 'auditor'], categoria: 'cancelacion', entidadTipo: 'requisicion', entidadId: Number(id),
        titulo: `Requisición ${req.folio} cancelada`,
        mensaje: `${request.user.nombre} canceló esta requisición (estaba en estatus "${req.estatus}").`,
        textoTelegram: `❌ Requisición ${req.folio} cancelada\n\n${request.user.nombre} la canceló (estaba en estatus "${req.estatus}").\n\nVer: ${env.corsOrigin}/requisiciones`,
        excluirUsuarioId: request.user.sub,
      });
      return { ok: true };
    });

    if (resultado.error === 404) return reply.code(404).send({ error: 'Requisición no encontrada' });
    if (resultado.error === 403) return reply.code(403).send({ error: resultado.mensaje });
    if (resultado.error === 409) return reply.code(409).send({ error: resultado.mensaje });
    return cargarRequisicionCompleta(pool, id);
  });
}
