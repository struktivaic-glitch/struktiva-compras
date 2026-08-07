import { pool } from '../../db/pool.js';
import { registrarBitacora } from '../../lib/audit.js';

// Bloque 31: Control de Maquinaria y Equipos — catálogo, expediente (documentos, mismo patrón
// que documentos_personal) y bitácora de mantenimiento. Equipo rentado: solo fechas de vigencia
// de la renta, sin costo (el costo sigue su camino normal por Requisición/Factura).

const ROLES_GESTION = ['residente', 'superintendente', 'direccion'];
const MIME_DOC_PERMITIDOS = new Set(['image/jpeg', 'image/png', 'image/webp', 'application/pdf']);
const DOC_MAX_BYTES = 10 * 1024 * 1024;
const DIAS_ALERTA_VENCIMIENTO = 30;

async function cargarEquipoCompleto(id) {
  const { rows: cab } = await pool.query(
    `SELECT e.*, o.nombre AS obra_nombre FROM equipos e LEFT JOIN obras o ON o.id = e.obra_id WHERE e.id = $1`,
    [id]
  );
  if (!cab[0]) return null;

  const { rows: documentos } = await pool.query(
    `SELECT id, tipo_documento, nombre_archivo, mime, tamano_bytes, fecha_vencimiento, creado_en
     FROM documentos_equipo WHERE equipo_id = $1 ORDER BY creado_en DESC`,
    [id]
  );
  const { rows: bitacora } = await pool.query(
    `SELECT bm.*, u.nombre AS registrado_por_nombre FROM bitacora_mantenimiento bm
     JOIN usuarios u ON u.id = bm.registrado_por WHERE bm.equipo_id = $1 ORDER BY bm.fecha DESC, bm.creado_en DESC`,
    [id]
  );

  return { ...cab[0], documentos, bitacora };
}

export default async function equiposRoutes(app) {
  app.addHook('preHandler', app.authenticate);

  app.get('/api/equipos', async (request) => {
    const { obraId, estatus, modalidad } = request.query;
    const condiciones = [];
    const valores = [];
    if (obraId) { valores.push(obraId); condiciones.push(`e.obra_id = $${valores.length}`); }
    if (estatus) { valores.push(estatus); condiciones.push(`e.estatus = $${valores.length}`); }
    if (modalidad) { valores.push(modalidad); condiciones.push(`e.modalidad = $${valores.length}`); }
    const where = condiciones.length ? `WHERE ${condiciones.join(' AND ')}` : '';

    const { rows } = await pool.query(
      `SELECT e.id, e.clave, e.descripcion, e.tipo, e.marca, e.modelo, e.modalidad, e.estatus,
              e.obra_id, o.nombre AS obra_nombre, e.fecha_vencimiento_renta,
              (e.fecha_vencimiento_renta IS NOT NULL AND e.fecha_vencimiento_renta <= current_date + ${DIAS_ALERTA_VENCIMIENTO}) AS renta_por_vencer
       FROM equipos e LEFT JOIN obras o ON o.id = e.obra_id
       ${where} ORDER BY e.clave`,
      valores
    );
    return rows;
  });

  // Panel de vencimientos próximos (documentos, renta, mantenimiento) — calculado al cargar,
  // sin necesidad de un cron: no hay infraestructura de tareas programadas en este sistema.
  app.get('/api/equipos/vencimientos', async () => {
    const { rows: renta } = await pool.query(
      `SELECT id, clave, descripcion, fecha_vencimiento_renta AS fecha
       FROM equipos WHERE modalidad = 'rentado' AND fecha_vencimiento_renta IS NOT NULL
         AND fecha_vencimiento_renta <= current_date + ${DIAS_ALERTA_VENCIMIENTO}
       ORDER BY fecha_vencimiento_renta`
    );
    const { rows: documentos } = await pool.query(
      `SELECT de.id, de.tipo_documento, de.fecha_vencimiento AS fecha, e.id AS equipo_id, e.clave, e.descripcion
       FROM documentos_equipo de JOIN equipos e ON e.id = de.equipo_id
       WHERE de.fecha_vencimiento IS NOT NULL AND de.fecha_vencimiento <= current_date + ${DIAS_ALERTA_VENCIMIENTO}
       ORDER BY de.fecha_vencimiento`
    );
    const { rows: mantenimiento } = await pool.query(
      `SELECT bm.id, bm.proximo_mantenimiento AS fecha, e.id AS equipo_id, e.clave, e.descripcion
       FROM bitacora_mantenimiento bm JOIN equipos e ON e.id = bm.equipo_id
       WHERE bm.proximo_mantenimiento IS NOT NULL AND bm.proximo_mantenimiento <= current_date + ${DIAS_ALERTA_VENCIMIENTO}
         AND bm.id IN (SELECT MAX(id) FROM bitacora_mantenimiento GROUP BY equipo_id)
       ORDER BY bm.proximo_mantenimiento`
    );
    return { renta, documentos, mantenimiento };
  });

  app.get('/api/equipos/:id', async (request, reply) => {
    const data = await cargarEquipoCompleto(request.params.id);
    if (!data) return reply.code(404).send({ error: 'Equipo no encontrado' });
    return data;
  });

  app.post('/api/equipos', { preHandler: app.requireRole(...ROLES_GESTION) }, async (request, reply) => {
    const { clave, descripcion, tipo, marca, modelo, numeroSerie, modalidad, obraId, proveedorRenta, fechaInicioRenta, fechaVencimientoRenta, notas } = request.body ?? {};
    if (!clave?.trim() || !descripcion?.trim()) {
      return reply.code(400).send({ error: 'Clave y descripción son obligatorios' });
    }
    try {
      const { rows } = await pool.query(
        `INSERT INTO equipos (clave, descripcion, tipo, marca, modelo, numero_serie, modalidad, obra_id, proveedor_renta, fecha_inicio_renta, fecha_vencimiento_renta, notas)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12) RETURNING id`,
        [
          clave.trim(), descripcion.trim(), tipo?.trim() || null, marca?.trim() || null, modelo?.trim() || null,
          numeroSerie?.trim() || null, modalidad === 'rentado' ? 'rentado' : 'propio', obraId || null,
          proveedorRenta?.trim() || null, fechaInicioRenta || null, fechaVencimientoRenta || null, notas?.trim() || null,
        ]
      );
      await registrarBitacora(pool, { tabla: 'equipos', registroId: rows[0].id, usuarioId: request.user.sub, accion: 'crear', despues: request.body });
      return reply.code(201).send(await cargarEquipoCompleto(rows[0].id));
    } catch (err) {
      if (err.code === '23505') return reply.code(409).send({ error: 'Ya existe un equipo con esa clave' });
      request.log.error(err);
      return reply.code(500).send({ error: 'No se pudo crear el equipo' });
    }
  });

  app.put('/api/equipos/:id', { preHandler: app.requireRole(...ROLES_GESTION) }, async (request, reply) => {
    const { id } = request.params;
    const { clave, descripcion, tipo, marca, modelo, numeroSerie, modalidad, obraId, estatus, proveedorRenta, fechaInicioRenta, fechaVencimientoRenta, notas } = request.body ?? {};
    if (!clave?.trim() || !descripcion?.trim()) {
      return reply.code(400).send({ error: 'Clave y descripción son obligatorios' });
    }
    const { rows } = await pool.query(
      `UPDATE equipos SET clave=$2, descripcion=$3, tipo=$4, marca=$5, modelo=$6, numero_serie=$7, modalidad=$8,
         obra_id=$9, estatus=$10, proveedor_renta=$11, fecha_inicio_renta=$12, fecha_vencimiento_renta=$13, notas=$14
       WHERE id = $1 RETURNING id`,
      [
        id, clave.trim(), descripcion.trim(), tipo?.trim() || null, marca?.trim() || null, modelo?.trim() || null,
        numeroSerie?.trim() || null, modalidad === 'rentado' ? 'rentado' : 'propio', obraId || null,
        estatus || 'activo', proveedorRenta?.trim() || null, fechaInicioRenta || null, fechaVencimientoRenta || null, notas?.trim() || null,
      ]
    );
    if (!rows[0]) return reply.code(404).send({ error: 'Equipo no encontrado' });
    await registrarBitacora(pool, { tabla: 'equipos', registroId: id, usuarioId: request.user.sub, accion: 'editar', despues: request.body });
    return cargarEquipoCompleto(id);
  });

  // --- Expediente: documentos ---

  app.post('/api/equipos/:id/documentos', { preHandler: app.requireRole(...ROLES_GESTION) }, async (request, reply) => {
    const { id } = request.params;
    const { rows: existe } = await pool.query('SELECT id FROM equipos WHERE id = $1', [id]);
    if (!existe[0]) return reply.code(404).send({ error: 'Equipo no encontrado' });

    let tipoDocumento = 'Otro';
    let fechaVencimiento = null;
    let archivo = null;
    for await (const part of request.parts()) {
      if (part.type === 'file' && part.fieldname === 'archivo') {
        if (!MIME_DOC_PERMITIDOS.has(part.mimetype)) {
          return reply.code(400).send({ error: 'Formato no soportado. Usa JPG, PNG, WEBP o PDF.' });
        }
        const buffer = await part.toBuffer();
        if (buffer.length > DOC_MAX_BYTES) {
          return reply.code(400).send({ error: 'El archivo es demasiado grande (máx. 10 MB).' });
        }
        archivo = { buffer, mimetype: part.mimetype, filename: part.filename };
      } else if (part.fieldname === 'tipoDocumento') {
        tipoDocumento = part.value?.trim() || 'Otro';
      } else if (part.fieldname === 'fechaVencimiento') {
        fechaVencimiento = part.value?.trim() || null;
      }
    }
    if (!archivo) return reply.code(400).send({ error: 'No se recibió ningún archivo' });

    const { rows } = await pool.query(
      `INSERT INTO documentos_equipo (equipo_id, tipo_documento, nombre_archivo, mime, archivo, tamano_bytes, fecha_vencimiento, subido_por)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       RETURNING id, tipo_documento, nombre_archivo, mime, tamano_bytes, fecha_vencimiento, creado_en`,
      [id, tipoDocumento, archivo.filename || 'documento', archivo.mimetype, archivo.buffer, archivo.buffer.length, fechaVencimiento, request.user.sub]
    );
    await registrarBitacora(pool, {
      tabla: 'documentos_equipo', registroId: rows[0].id, usuarioId: request.user.sub, accion: 'crear',
      despues: { equipoId: id, tipoDocumento },
    });
    return reply.code(201).send(rows[0]);
  });

  app.get('/api/equipos/:id/documentos/:docId', async (request, reply) => {
    const { rows } = await pool.query(
      'SELECT archivo, mime, nombre_archivo FROM documentos_equipo WHERE id = $1 AND equipo_id = $2',
      [request.params.docId, request.params.id]
    );
    if (!rows[0]) return reply.code(404).send({ error: 'Documento no encontrado' });
    reply.header('Cache-Control', 'private, max-age=60');
    return reply.type(rows[0].mime).send(rows[0].archivo);
  });

  app.delete('/api/equipos/:id/documentos/:docId', { preHandler: app.requireRole(...ROLES_GESTION) }, async (request, reply) => {
    const { rowCount } = await pool.query(
      'DELETE FROM documentos_equipo WHERE id = $1 AND equipo_id = $2',
      [request.params.docId, request.params.id]
    );
    if (!rowCount) return reply.code(404).send({ error: 'Documento no encontrado' });
    await registrarBitacora(pool, { tabla: 'documentos_equipo', registroId: request.params.docId, usuarioId: request.user.sub, accion: 'eliminar' });
    return { ok: true };
  });

  // --- Bitácora de mantenimiento ---

  app.post('/api/equipos/:id/mantenimiento', { preHandler: app.requireRole(...ROLES_GESTION) }, async (request, reply) => {
    const { id } = request.params;
    const { tipo, fecha, horometroKm, descripcion, costo, tallerProveedor, proximoMantenimiento } = request.body ?? {};
    if (!['preventivo', 'correctivo'].includes(tipo) || !descripcion?.trim()) {
      return reply.code(400).send({ error: 'Tipo (preventivo/correctivo) y descripción son obligatorios' });
    }
    const { rows: existe } = await pool.query('SELECT id FROM equipos WHERE id = $1', [id]);
    if (!existe[0]) return reply.code(404).send({ error: 'Equipo no encontrado' });

    const { rows } = await pool.query(
      `INSERT INTO bitacora_mantenimiento (equipo_id, tipo, fecha, horometro_km, descripcion, costo, taller_proveedor, proximo_mantenimiento, registrado_por)
       VALUES ($1, $2, COALESCE($3, current_date), $4, $5, $6, $7, $8, $9) RETURNING id`,
      [id, tipo, fecha || null, horometroKm || null, descripcion.trim(), costo || null, tallerProveedor?.trim() || null, proximoMantenimiento || null, request.user.sub]
    );
    await registrarBitacora(pool, { tabla: 'bitacora_mantenimiento', registroId: rows[0].id, usuarioId: request.user.sub, accion: 'crear', despues: request.body });
    return reply.code(201).send(await cargarEquipoCompleto(id));
  });
}
