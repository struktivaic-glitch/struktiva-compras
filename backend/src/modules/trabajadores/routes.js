import { pool } from '../../db/pool.js';
import { registrarBitacora } from '../../lib/audit.js';

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
      `SELECT id, tipo_documento, nombre_archivo, mime, tamano_bytes, creado_en
       FROM documentos_personal WHERE trabajador_id = $1 ORDER BY creado_en DESC`,
      [request.params.id]
    );
    return { ...rows[0], documentos };
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
      }
    }
    if (!archivo) return reply.code(400).send({ error: 'No se recibió ningún archivo' });

    const { rows } = await pool.query(
      `INSERT INTO documentos_personal (trabajador_id, tipo_documento, nombre_archivo, mime, archivo, tamano_bytes, subido_por)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING id, tipo_documento, nombre_archivo, mime, tamano_bytes, creado_en`,
      [id, tipoDocumento, archivo.filename || 'documento', archivo.mimetype, archivo.buffer, archivo.buffer.length, request.user.sub]
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
