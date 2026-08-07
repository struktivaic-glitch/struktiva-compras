import { pool, withTransaction } from '../../db/pool.js';
import { registrarBitacora } from '../../lib/audit.js';
import { registrarFirma } from '../../lib/firma.js';
import { notificarPorRol } from '../../lib/notificaciones.js';

// Bloque 29: Avance financiero de obra. Presupuesto GENERAL por conceptos (distinto del
// presupuesto por insumo ya existente) — el catálogo de lo contratado con el cliente. El avance
// físico se captura por concepto y, si el acumulado supera lo contratado, queda pendiente de
// autorización de Superintendencia/Dirección antes de contar en el avance oficial — mismo
// espíritu que el candado de excedente de Requisiciones/Bloque 16.

const ROLES_GESTION_CONCEPTOS = ['comprador', 'direccion'];
const ROLES_AUTORIZA = ['superintendente', 'direccion'];

async function cargarConceptosConAvance(obraId) {
  const { rows } = await pool.query(
    `SELECT c.id, c.capitulo, c.clave, c.descripcion, c.unidad, c.cantidad_contratada, c.precio_unitario,
            c.cantidad_contratada * c.precio_unitario AS importe_contratado,
            COALESCE(SUM(ca.cantidad_ejecutada) FILTER (WHERE ca.estatus = 'confirmado'), 0) AS cantidad_ejecutada,
            COALESCE(SUM(ca.cantidad_ejecutada) FILTER (WHERE ca.estatus = 'pendiente_autorizacion'), 0) AS cantidad_pendiente
     FROM conceptos_obra c
     LEFT JOIN concepto_avance ca ON ca.concepto_id = c.id
     WHERE c.obra_id = $1
     GROUP BY c.id
     ORDER BY c.capitulo NULLS LAST, c.clave`,
    [obraId]
  );
  return rows.map((r) => {
    const cantidadEjecutada = Number(r.cantidad_ejecutada);
    const cantidadContratada = Number(r.cantidad_contratada);
    const importeEjecutado = cantidadEjecutada * Number(r.precio_unitario);
    return {
      ...r,
      importe_ejecutado: importeEjecutado,
      saldo_cantidad: cantidadContratada - cantidadEjecutada,
      pct_avance: cantidadContratada > 0 ? Math.min(100, (cantidadEjecutada / cantidadContratada) * 100) : 0,
    };
  });
}

export default async function avanceObraRoutes(app) {
  app.addHook('preHandler', app.authenticate);

  app.get('/api/avance-obra/conceptos', async (request, reply) => {
    const { obraId } = request.query;
    if (!obraId) return reply.code(400).send({ error: 'obraId es obligatorio' });
    return cargarConceptosConAvance(obraId);
  });

  app.get('/api/avance-obra/pendientes', async (request, reply) => {
    const { obraId } = request.query;
    if (!obraId) return reply.code(400).send({ error: 'obraId es obligatorio' });
    const { rows } = await pool.query(
      `SELECT ca.id, ca.fecha, ca.cantidad_ejecutada, ca.justificacion, ca.notas, ca.creado_en,
              c.clave, c.descripcion, c.unidad, c.cantidad_contratada, u.nombre AS registrado_por_nombre
       FROM concepto_avance ca
       JOIN conceptos_obra c ON c.id = ca.concepto_id
       JOIN usuarios u ON u.id = ca.registrado_por
       WHERE c.obra_id = $1 AND ca.estatus = 'pendiente_autorizacion'
       ORDER BY ca.creado_en`,
      [obraId]
    );
    return rows;
  });

  // Alta manual de un concepto (uso normal es vía importación, ver módulo importaciones).
  app.post('/api/avance-obra/conceptos', { preHandler: app.requireRole(...ROLES_GESTION_CONCEPTOS) }, async (request, reply) => {
    const { obraId, capitulo, clave, descripcion, unidad, cantidadContratada, precioUnitario } = request.body ?? {};
    if (!obraId || !clave?.trim() || !descripcion?.trim() || !unidad?.trim() || !cantidadContratada || !precioUnitario) {
      return reply.code(400).send({ error: 'Obra, clave, descripción, unidad, cantidad contratada y precio unitario son obligatorios' });
    }
    try {
      const { rows } = await pool.query(
        `INSERT INTO conceptos_obra (obra_id, capitulo, clave, descripcion, unidad, cantidad_contratada, precio_unitario)
         VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING id`,
        [obraId, capitulo?.trim() || null, clave.trim(), descripcion.trim(), unidad.trim(), cantidadContratada, precioUnitario]
      );
      await registrarBitacora(pool, {
        tabla: 'conceptos_obra', registroId: rows[0].id, usuarioId: request.user.sub, accion: 'crear',
        despues: { obraId, clave, descripcion, cantidadContratada, precioUnitario },
      });
      return reply.code(201).send({ id: rows[0].id });
    } catch (err) {
      if (err.code === '23505') return reply.code(409).send({ error: 'Ya existe un concepto con esa clave en esta obra' });
      request.log.error(err);
      return reply.code(500).send({ error: 'No se pudo crear el concepto' });
    }
  });

  // Captura de avance físico. Cualquier rol autenticado puede capturar (normalmente Residente),
  // igual que la captura de una Requisición — el candado real está en la autorización si excede.
  app.post('/api/avance-obra/conceptos/:id/avance', async (request, reply) => {
    const { id } = request.params;
    const { fecha, cantidadEjecutada, notas, justificacion } = request.body ?? {};
    if (!cantidadEjecutada || Number(cantidadEjecutada) <= 0) {
      return reply.code(400).send({ error: 'La cantidad ejecutada debe ser mayor a cero' });
    }

    try {
      const resultado = await withTransaction(async (client) => {
        const { rows: conceptoRows } = await client.query(
          `SELECT c.id, c.clave, c.descripcion, c.cantidad_contratada, c.obra_id, o.nombre AS obra_nombre
           FROM conceptos_obra c
           JOIN obras o ON o.id = c.obra_id
           WHERE c.id = $1
           FOR UPDATE OF c`,
          [id]
        );
        if (!conceptoRows[0]) throw Object.assign(new Error('NOT_FOUND'), { code: 404 });
        const concepto = conceptoRows[0];

        const { rows: sumaRows } = await client.query(
          `SELECT COALESCE(SUM(cantidad_ejecutada), 0) AS ejecutado_previo
           FROM concepto_avance WHERE concepto_id = $1 AND estatus = 'confirmado'`,
          [id]
        );

        const nuevoAcumulado = Number(sumaRows[0].ejecutado_previo) + Number(cantidadEjecutada);
        const excede = nuevoAcumulado > Number(concepto.cantidad_contratada);
        if (excede && !justificacion?.trim()) {
          throw Object.assign(new Error('JUSTIFICACION_REQUERIDA'), { code: 422 });
        }

        const { rows } = await client.query(
          `INSERT INTO concepto_avance (concepto_id, fecha, cantidad_ejecutada, excede_contratado, justificacion, estatus, registrado_por, notas)
           VALUES ($1, COALESCE($2, current_date), $3, $4, $5, $6, $7, $8)
           RETURNING id, estatus`,
          [
            id, fecha || null, cantidadEjecutada, excede, excede ? justificacion.trim() : null,
            excede ? 'pendiente_autorizacion' : 'confirmado', request.user.sub, notas?.trim() || null,
          ]
        );

        await registrarBitacora(client, {
          tabla: 'concepto_avance', registroId: rows[0].id, usuarioId: request.user.sub, accion: 'crear',
          despues: { conceptoId: id, cantidadEjecutada, excede },
        });

        if (excede) {
          await notificarPorRol(client, {
            roles: ROLES_AUTORIZA,
            categoria: 'avance_obra',
            entidadTipo: 'concepto_avance',
            entidadId: rows[0].id,
            titulo: `Avance excede lo contratado — ${concepto.clave}`,
            mensaje: `${concepto.clave} · ${concepto.descripcion} (${concepto.obra_nombre}): el acumulado llegaría a ${nuevoAcumulado} contra ${concepto.cantidad_contratada} contratado. Requiere autorización.`,
            excluirUsuarioId: request.user.sub,
          });
        }

        return { id: rows[0].id, estatus: rows[0].estatus, excede };
      });

      return reply.code(201).send(resultado);
    } catch (err) {
      if (err.code === 404) return reply.code(404).send({ error: 'Concepto no encontrado' });
      if (err.code === 422) return reply.code(422).send({ error: 'Este avance supera lo contratado — agrega una justificación técnica' });
      request.log.error(err);
      return reply.code(500).send({ error: 'No se pudo registrar el avance' });
    }
  });

  // Superintendencia/Dirección autoriza un avance que excedía lo contratado.
  app.post('/api/avance-obra/avance/:id/autorizar', { preHandler: app.requireRole(...ROLES_AUTORIZA) }, async (request, reply) => {
    const { id } = request.params;
    const { firma } = request.body ?? {};
    try {
      const resultado = await withTransaction(async (client) => {
        const { rows } = await client.query('SELECT id, estatus FROM concepto_avance WHERE id = $1 FOR UPDATE', [id]);
        if (!rows[0]) throw Object.assign(new Error('NOT_FOUND'), { code: 404 });
        if (rows[0].estatus !== 'pendiente_autorizacion') throw Object.assign(new Error('NO_PENDIENTE'), { code: 409 });

        await registrarFirma(client, { request, entidadTipo: 'concepto_avance', entidadId: id, firma });
        await client.query(
          `UPDATE concepto_avance SET estatus = 'confirmado', autorizado_por = $2, fecha_autorizacion = now() WHERE id = $1`,
          [id, request.user.sub]
        );
        await registrarBitacora(client, {
          tabla: 'concepto_avance', registroId: id, usuarioId: request.user.sub, accion: 'autorizar',
        });
        return { ok: true };
      });
      return resultado;
    } catch (err) {
      if (err.code === 404) return reply.code(404).send({ error: 'Avance no encontrado' });
      if (err.code === 409) return reply.code(409).send({ error: 'Este avance ya fue procesado' });
      if (err.message === 'FIRMA_REQUERIDA') return reply.code(400).send({ error: 'Se requiere firma (táctil o PIN) para autorizar' });
      if (err.message === 'SIN_PIN_CONFIGURADO') return reply.code(400).send({ error: 'Aún no configuras tu PIN de firma. Ve a tu perfil para crearlo.' });
      if (err.message === 'PIN_INCORRECTO') return reply.code(422).send({ error: 'PIN incorrecto' });
      if (err.message === 'FIRMA_TACTIL_INVALIDA') return reply.code(400).send({ error: 'La firma táctil capturada no es válida, intenta de nuevo' });
      request.log.error(err);
      return reply.code(500).send({ error: 'No se pudo registrar la autorización' });
    }
  });
}
