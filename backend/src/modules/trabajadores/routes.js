import { pool } from '../../db/pool.js';
import { registrarBitacora } from '../../lib/audit.js';
import { diasVacacionesPorAntiguedad, infoVacaciones, proximoAniversario } from '../../lib/antiguedad.js';

// Catálogo de Personal (antes "trabajadores de campo", ahora también cubre administrativos) —
// NO son usuarios del sistema ni un registro fiscal/de nómina. Sirve para:
//   1) desglosar el gasto de Mano de Obra en las requisiciones (uso original, migración 010),
//   2) el expediente de cada persona (datos + documentos, migración 013).
// salario_referencia es solo control interno de gasto, nunca cálculo fiscal (ISR/IMSS) ni
// timbrado — decisión explícita del cliente. Gestionable por Residente, Superintendente y
// Dirección.

const ROLES_GESTION = ['residente', 'superintendente', 'direccion'];
const MIME_DOC_PERMITIDOS = new Set(['image/jpeg', 'image/png', 'image/webp', 'application/pdf']);
const DOC_MAX_BYTES = 10 * 1024 * 1024;
const DIAS_ALERTA_VENCIMIENTO = 30;

const CAMPOS_EXPEDIENTE = [
  'tipo', 'puesto', 'obraId', 'fechaIngreso', 'salarioReferencia', 'salarioPeriodo',
  'telefono', 'curp', 'rfc', 'nss', 'direccion', 'contactoEmergenciaNombre',
  'contactoEmergenciaTelefono', 'notas',
];

function mapExpediente(body) {
  return {
    tipo: body.tipo === 'administrativo' ? 'administrativo' : 'jornalero',
    puesto: body.puesto?.trim() || null,
    obraId: body.obraId || null,
    fechaIngreso: body.fechaIngreso || null,
    salarioReferencia: body.salarioReferencia != null && body.salarioReferencia !== '' ? Number(body.salarioReferencia) : null,
    salarioPeriodo: body.salarioPeriodo === 'mensual' ? 'mensual' : body.salarioPeriodo === 'diario' ? 'diario' : null,
    telefono: body.telefono?.trim() || null,
    curp: body.curp?.trim().toUpperCase() || null,
    rfc: body.rfc?.trim().toUpperCase() || null,
    nss: body.nss?.trim() || null,
    direccion: body.direccion?.trim() || null,
    contactoEmergenciaNombre: body.contactoEmergenciaNombre?.trim() || null,
    contactoEmergenciaTelefono: body.contactoEmergenciaTelefono?.trim() || null,
    notas: body.notas?.trim() || null,
  };
}

export default async function trabajadoresRoutes(app) {
  app.addHook('preHandler', app.authenticate);

  app.get('/api/trabajadores', async (request) => {
    const soloActivos = request.query.incluirInactivos !== '1';
    const { rows } = await pool.query(
      `SELECT t.id, t.nombre, t.oficio, t.activo, t.tipo, t.puesto, t.salario_referencia, t.salario_periodo, o.nombre AS obra_nombre
       FROM trabajadores t
       LEFT JOIN obras o ON o.id = t.obra_id
       ${soloActivos ? 'WHERE t.activo' : ''}
       ORDER BY t.nombre`
    );
    return rows;
  });

  // Bloque 32: certificaciones/documentos con fecha de vigencia próxima a vencer — Seguridad e
  // Higiene resuelto como extensión del Expediente en vez de un módulo aparte.
  app.get('/api/trabajadores/vencimientos', async () => {
    const { rows } = await pool.query(
      `SELECT dp.id, dp.tipo_documento, dp.fecha_vencimiento AS fecha, t.id AS trabajador_id, t.nombre
       FROM documentos_personal dp JOIN trabajadores t ON t.id = dp.trabajador_id
       WHERE dp.fecha_vencimiento IS NOT NULL AND dp.fecha_vencimiento <= current_date + ${DIAS_ALERTA_VENCIMIENTO}
         AND t.activo
       ORDER BY dp.fecha_vencimiento`
    );
    return rows;
  });

  // Próximos aniversarios de antigüedad (30 días) — mismo patrón que /vencimientos, para un
  // panel de aviso en vez de notificaciones automáticas (no hay tareas programadas en el
  // sistema). Trae de una vez los días de vacaciones que le van a corresponder a partir de ese
  // aniversario, que es justo el dato útil de avisar con anticipación.
  app.get('/api/trabajadores/aniversarios', async () => {
    const { rows } = await pool.query(
      `SELECT id, nombre, fecha_ingreso FROM trabajadores WHERE activo AND fecha_ingreso IS NOT NULL ORDER BY nombre`
    );
    const proximos = rows
      .map((t) => ({ ...t, proximo: proximoAniversario(t.fecha_ingreso) }))
      .filter((t) => {
        const diasFaltantes = (t.proximo - new Date()) / (1000 * 60 * 60 * 24);
        return diasFaltantes <= DIAS_ALERTA_VENCIMIENTO;
      })
      .map((t) => {
        const info = infoVacaciones(t.fecha_ingreso, 0);
        const aniosCumple = info.aniosCumplidos + 1;
        return {
          trabajador_id: t.id,
          nombre: t.nombre,
          fecha: t.proximo.toISOString().slice(0, 10),
          anios_cumple: aniosCumple,
          // Días que corresponden a partir de ESE aniversario (no los de la antigüedad de hoy).
          dias_vacaciones_nuevos: diasVacacionesPorAntiguedad(aniosCumple),
        };
      })
      .sort((a, b) => a.fecha.localeCompare(b.fecha));
    return proximos;
  });

  // Calendario de vacaciones (línea de tiempo) — trae los periodos de todo el personal activo
  // que caen dentro del rango pedido, para poder verlos agrupados por oficio y detectar
  // traslapes entre personas distintas (a diferencia del traslape de Nómina, que solo cuida que
  // una misma persona no quede en dos nóminas). El cálculo de "quién se traslapa con quién" se
  // hace en el frontend (agrupando por oficio), aquí solo se entrega el dato crudo.
  app.get('/api/trabajadores/vacaciones-calendario', async (request, reply) => {
    const { desde, hasta, obraId } = request.query ?? {};
    if (!desde || !hasta) return reply.code(400).send({ error: 'Falta el rango de fechas (desde/hasta)' });

    const params = [desde, hasta];
    let filtroObra = '';
    if (obraId) {
      params.push(obraId);
      filtroObra = `AND t.obra_id = $${params.length}`;
    }
    const { rows } = await pool.query(
      `SELECT v.id, v.fecha_inicio, v.fecha_fin, v.dias,
              t.id AS trabajador_id, t.nombre AS trabajador_nombre, t.oficio, t.obra_id, o.nombre AS obra_nombre
       FROM vacaciones_trabajador v
       JOIN trabajadores t ON t.id = v.trabajador_id
       LEFT JOIN obras o ON o.id = t.obra_id
       WHERE t.activo AND v.fecha_inicio <= $2 AND v.fecha_fin >= $1 ${filtroObra}
       ORDER BY t.oficio NULLS LAST, t.nombre, v.fecha_inicio`,
      params
    );
    return rows;
  });

  app.get('/api/trabajadores/:id', async (request, reply) => {
    const { rows } = await pool.query(
      `SELECT t.*, o.nombre AS obra_nombre
       FROM trabajadores t
       LEFT JOIN obras o ON o.id = t.obra_id
       WHERE t.id = $1`,
      [request.params.id]
    );
    if (!rows[0]) return reply.code(404).send({ error: 'Personal no encontrado' });

    const { rows: documentos } = await pool.query(
      `SELECT id, tipo_documento, nombre_archivo, mime, tamano_bytes, fecha_vencimiento, creado_en
       FROM documentos_personal WHERE trabajador_id = $1 ORDER BY creado_en DESC`,
      [request.params.id]
    );
    return { ...rows[0], documentos };
  });

  // --- Vacaciones ---

  app.get('/api/trabajadores/:id/vacaciones', async (request, reply) => {
    const { rows: tRows } = await pool.query('SELECT fecha_ingreso FROM trabajadores WHERE id = $1', [request.params.id]);
    if (!tRows[0]) return reply.code(404).send({ error: 'Personal no encontrado' });

    const { rows: periodos } = await pool.query(
      `SELECT v.id, v.fecha_inicio, v.fecha_fin, v.dias, v.notas, u.nombre AS registrado_por_nombre, v.creado_en
       FROM vacaciones_trabajador v JOIN usuarios u ON u.id = v.registrado_por
       WHERE v.trabajador_id = $1 ORDER BY v.fecha_inicio DESC`,
      [request.params.id]
    );

    let info = null;
    if (tRows[0].fecha_ingreso) {
      const base = infoVacaciones(tRows[0].fecha_ingreso, 0);
      const { rows: tomadosRows } = await pool.query(
        `SELECT COALESCE(SUM(dias), 0) AS tomados FROM vacaciones_trabajador
         WHERE trabajador_id = $1 AND fecha_inicio >= $2 AND fecha_inicio < $3`,
        [request.params.id, base.anioServicioDesde, base.anioServicioHasta]
      );
      info = infoVacaciones(tRows[0].fecha_ingreso, tomadosRows[0].tomados);
    }

    return { periodos, info };
  });

  app.post('/api/trabajadores/:id/vacaciones', { preHandler: app.requireRole(...ROLES_GESTION) }, async (request, reply) => {
    const { id } = request.params;
    const { fechaInicio, fechaFin, dias, notas } = request.body ?? {};
    if (!fechaInicio || !fechaFin || !(Number(dias) > 0)) {
      return reply.code(400).send({ error: 'Fecha de inicio, fecha de fin y días (mayor a cero) son obligatorios' });
    }
    if (fechaFin < fechaInicio) return reply.code(400).send({ error: 'La fecha final no puede ser antes de la inicial' });

    const { rows: existe } = await pool.query('SELECT id FROM trabajadores WHERE id = $1', [id]);
    if (!existe[0]) return reply.code(404).send({ error: 'Personal no encontrado' });

    const { rows } = await pool.query(
      `INSERT INTO vacaciones_trabajador (trabajador_id, fecha_inicio, fecha_fin, dias, notas, registrado_por)
       VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`,
      [id, fechaInicio, fechaFin, dias, notas?.trim() || null, request.user.sub]
    );
    await registrarBitacora(pool, {
      tabla: 'vacaciones_trabajador', registroId: rows[0].id, usuarioId: request.user.sub, accion: 'crear', despues: rows[0],
    });
    return reply.code(201).send(rows[0]);
  });

  // Editar las fechas de un periodo ya registrado — pensado para el calendario de vacaciones:
  // la barra muestra la fecha "sugerida" y, una vez consultada la disponibilidad real con la
  // persona, se ajusta aquí mismo en vez de borrar y volver a capturar.
  app.put('/api/trabajadores/:id/vacaciones/:vacId', { preHandler: app.requireRole(...ROLES_GESTION) }, async (request, reply) => {
    const { id, vacId } = request.params;
    const { fechaInicio, fechaFin, dias, notas } = request.body ?? {};
    if (!fechaInicio || !fechaFin || !(Number(dias) > 0)) {
      return reply.code(400).send({ error: 'Fecha de inicio, fecha de fin y días (mayor a cero) son obligatorios' });
    }
    if (fechaFin < fechaInicio) return reply.code(400).send({ error: 'La fecha final no puede ser antes de la inicial' });

    const { rows } = await pool.query(
      `UPDATE vacaciones_trabajador SET fecha_inicio = $3, fecha_fin = $4, dias = $5, notas = $6
       WHERE id = $1 AND trabajador_id = $2
       RETURNING *`,
      [vacId, id, fechaInicio, fechaFin, dias, notas?.trim() || null]
    );
    if (!rows[0]) return reply.code(404).send({ error: 'Periodo de vacaciones no encontrado' });

    await registrarBitacora(pool, {
      tabla: 'vacaciones_trabajador', registroId: vacId, usuarioId: request.user.sub, accion: 'editar', despues: rows[0],
    });
    return rows[0];
  });

  app.delete('/api/trabajadores/:id/vacaciones/:vacId', { preHandler: app.requireRole(...ROLES_GESTION) }, async (request, reply) => {
    const { rowCount } = await pool.query(
      'DELETE FROM vacaciones_trabajador WHERE id = $1 AND trabajador_id = $2',
      [request.params.vacId, request.params.id]
    );
    if (!rowCount) return reply.code(404).send({ error: 'Periodo de vacaciones no encontrado' });
    await registrarBitacora(pool, {
      tabla: 'vacaciones_trabajador', registroId: request.params.vacId, usuarioId: request.user.sub, accion: 'eliminar',
    });
    return { ok: true };
  });

  app.post('/api/trabajadores', { preHandler: app.requireRole(...ROLES_GESTION) }, async (request, reply) => {
    const { nombre, oficio } = request.body ?? {};
    if (!nombre?.trim()) {
      return reply.code(400).send({ error: 'El nombre es obligatorio' });
    }
    const exp = mapExpediente(request.body ?? {});
    const { rows } = await pool.query(
      `INSERT INTO trabajadores
         (nombre, oficio, tipo, puesto, obra_id, fecha_ingreso, salario_referencia, salario_periodo,
          telefono, curp, rfc, nss, direccion, contacto_emergencia_nombre, contacto_emergencia_telefono, notas)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16)
       RETURNING *`,
      [
        nombre.trim(), oficio?.trim() || null, exp.tipo, exp.puesto, exp.obraId, exp.fechaIngreso,
        exp.salarioReferencia, exp.salarioPeriodo, exp.telefono, exp.curp, exp.rfc, exp.nss,
        exp.direccion, exp.contactoEmergenciaNombre, exp.contactoEmergenciaTelefono, exp.notas,
      ]
    );
    await registrarBitacora(pool, {
      tabla: 'trabajadores', registroId: rows[0].id, usuarioId: request.user.sub, accion: 'crear',
      despues: rows[0],
    });
    return reply.code(201).send(rows[0]);
  });

  app.put('/api/trabajadores/:id', { preHandler: app.requireRole(...ROLES_GESTION) }, async (request, reply) => {
    const { id } = request.params;
    const { nombre, oficio, activo } = request.body ?? {};
    if (!nombre?.trim()) {
      return reply.code(400).send({ error: 'El nombre es obligatorio' });
    }
    const exp = mapExpediente(request.body ?? {});
    const { rows } = await pool.query(
      `UPDATE trabajadores SET
         nombre = $2, oficio = $3, activo = $4, tipo = $5, puesto = $6, obra_id = $7,
         fecha_ingreso = $8, salario_referencia = $9, salario_periodo = $10, telefono = $11,
         curp = $12, rfc = $13, nss = $14, direccion = $15, contacto_emergencia_nombre = $16,
         contacto_emergencia_telefono = $17, notas = $18
       WHERE id = $1
       RETURNING *`,
      [
        id, nombre.trim(), oficio?.trim() || null, activo ?? true, exp.tipo, exp.puesto, exp.obraId,
        exp.fechaIngreso, exp.salarioReferencia, exp.salarioPeriodo, exp.telefono, exp.curp, exp.rfc,
        exp.nss, exp.direccion, exp.contactoEmergenciaNombre, exp.contactoEmergenciaTelefono, exp.notas,
      ]
    );
    if (!rows[0]) return reply.code(404).send({ error: 'Personal no encontrado' });

    await registrarBitacora(pool, {
      tabla: 'trabajadores', registroId: id, usuarioId: request.user.sub, accion: 'editar', despues: rows[0],
    });
    return rows[0];
  });

  // --- Documentos del expediente ---

  app.post('/api/trabajadores/:id/documentos', { preHandler: app.requireRole(...ROLES_GESTION) }, async (request, reply) => {
    const { id } = request.params;
    const { rows: existe } = await pool.query('SELECT id FROM trabajadores WHERE id = $1', [id]);
    if (!existe[0]) return reply.code(404).send({ error: 'Personal no encontrado' });

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
      `INSERT INTO documentos_personal (trabajador_id, tipo_documento, nombre_archivo, mime, archivo, tamano_bytes, fecha_vencimiento, subido_por)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       RETURNING id, tipo_documento, nombre_archivo, mime, tamano_bytes, fecha_vencimiento, creado_en`,
      [id, tipoDocumento, archivo.filename || 'documento', archivo.mimetype, archivo.buffer, archivo.buffer.length, fechaVencimiento, request.user.sub]
    );
    await registrarBitacora(pool, {
      tabla: 'documentos_personal', registroId: rows[0].id, usuarioId: request.user.sub, accion: 'crear',
      despues: { trabajadorId: id, tipoDocumento },
    });
    return reply.code(201).send(rows[0]);
  });

  app.get('/api/trabajadores/:id/documentos/:docId', async (request, reply) => {
    const { rows } = await pool.query(
      'SELECT archivo, mime, nombre_archivo FROM documentos_personal WHERE id = $1 AND trabajador_id = $2',
      [request.params.docId, request.params.id]
    );
    if (!rows[0]) return reply.code(404).send({ error: 'Documento no encontrado' });
    reply.header('Cache-Control', 'private, max-age=60');
    return reply.type(rows[0].mime).send(rows[0].archivo);
  });

  app.delete('/api/trabajadores/:id/documentos/:docId', { preHandler: app.requireRole(...ROLES_GESTION) }, async (request, reply) => {
    const { rowCount } = await pool.query(
      'DELETE FROM documentos_personal WHERE id = $1 AND trabajador_id = $2',
      [request.params.docId, request.params.id]
    );
    if (!rowCount) return reply.code(404).send({ error: 'Documento no encontrado' });
    await registrarBitacora(pool, {
      tabla: 'documentos_personal', registroId: request.params.docId, usuarioId: request.user.sub, accion: 'eliminar',
    });
    return { ok: true };
  });
}
