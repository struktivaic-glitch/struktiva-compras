import { pool, withTransaction } from '../../db/pool.js';
import { registrarBitacora } from '../../lib/audit.js';
import { siguienteFolio } from '../../lib/folio.js';

const MIME_FOTO_PERMITIDOS = new Set(['image/jpeg', 'image/png', 'image/webp']);
const FOTO_MAX_BYTES = 10 * 1024 * 1024;

async function cargarSalidaCompleta(client, id) {
  const { rows: cab } = await client.query(
    `SELECT sa.*, o.nombre AS obra_nombre, f.nombre AS frente_nombre, u.nombre AS entrego_nombre
     FROM salidas_almacen sa
     JOIN obras o ON o.id = sa.obra_id
     JOIN frentes f ON f.id = sa.frente_id
     JOIN usuarios u ON u.id = sa.usuario_entrega_id
     WHERE sa.id = $1`,
    [id]
  );
  if (!cab[0]) return null;

  const { rows: detalle } = await client.query(
    `SELECT sd.*, i.clave, i.descripcion, i.unidad
     FROM salida_detalle sd JOIN insumos i ON i.id = sd.insumo_id
     WHERE sd.salida_id = $1 ORDER BY i.descripcion`,
    [id]
  );

  const { rows: fotos } = await client.query(
    `SELECT id, tipo, nombre_archivo, mime, tamano_bytes, creado_en
     FROM fotos_salida_almacen WHERE salida_id = $1 ORDER BY creado_en DESC`,
    [id]
  );

  return { ...cab[0], detalle, fotos };
}

export default async function salidasAlmacenRoutes(app) {
  app.addHook('preHandler', app.authenticate);

  app.get('/api/inventario', async (request, reply) => {
    const { obraId } = request.query;
    if (!obraId) return reply.code(400).send({ error: 'obraId es obligatorio' });

    const { rows } = await pool.query(
      `SELECT i.id AS insumo_id, i.clave, i.descripcion, i.unidad,
              COALESCE(v.entradas, 0) AS entradas, COALESCE(v.salidas, 0) AS salidas, COALESCE(v.existencia, 0) AS existencia
       FROM insumos i
       JOIN vw_existencia_obra_insumo v ON v.insumo_id = i.id AND v.obra_id = $1
       WHERE COALESCE(v.entradas, 0) > 0
       ORDER BY i.descripcion`,
      [obraId]
    );
    return rows;
  });

  app.get('/api/salidas-almacen', async () => {
    const { rows } = await pool.query(
      `SELECT sa.id, sa.folio, sa.fecha, sa.usuario_recibe_nombre, o.nombre AS obra_nombre, f.nombre AS frente_nombre
       FROM salidas_almacen sa JOIN obras o ON o.id = sa.obra_id JOIN frentes f ON f.id = sa.frente_id
       ORDER BY sa.creado_en DESC LIMIT 200`
    );
    return rows;
  });

  app.get('/api/salidas-almacen/:id', async (request, reply) => {
    const data = await cargarSalidaCompleta(pool, request.params.id);
    if (!data) return reply.code(404).send({ error: 'Salida de almacén no encontrada' });
    return data;
  });

  app.post('/api/salidas-almacen', { preHandler: app.requireRole('almacenista', 'direccion') }, async (request, reply) => {
    const { obraId, frenteId, usuarioRecibeNombre, detalle } = request.body ?? {};
    if (!obraId || !frenteId || !usuarioRecibeNombre?.trim() || !Array.isArray(detalle) || detalle.length === 0) {
      return reply.code(400).send({ error: 'Obra, frente, quien recibe y al menos un insumo son obligatorios' });
    }

    try {
      const resultado = await withTransaction(async (client) => {
        const { rows: existencias } = await client.query(
          `SELECT insumo_id, existencia FROM vw_existencia_obra_insumo WHERE obra_id = $1`,
          [obraId]
        );
        const porInsumo = new Map(existencias.map((e) => [e.insumo_id, Number(e.existencia)]));

        const insuficientes = detalle
          .filter((item) => Number(item.cantidadEntregada) > (porInsumo.get(item.insumoId) ?? 0))
          .map((item) => ({ insumoId: item.insumoId, existencia: porInsumo.get(item.insumoId) ?? 0 }));
        if (insuficientes.length > 0) {
          throw Object.assign(new Error('SIN_EXISTENCIA'), { code: 422, detalle: insuficientes });
        }

        const folio = await siguienteFolio(client, 'SAL', 'salidas_folio_seq');
        const { rows: saRows } = await client.query(
          `INSERT INTO salidas_almacen (folio, obra_id, frente_id, usuario_entrega_id, usuario_recibe_nombre)
           VALUES ($1, $2, $3, $4, $5) RETURNING id`,
          [folio, obraId, frenteId, request.user.sub, usuarioRecibeNombre.trim()]
        );
        const salidaId = saRows[0].id;

        for (const item of detalle) {
          await client.query(
            `INSERT INTO salida_detalle (salida_id, insumo_id, cantidad_entregada) VALUES ($1, $2, $3)`,
            [salidaId, item.insumoId, item.cantidadEntregada]
          );
        }

        await registrarBitacora(client, {
          tabla: 'salidas_almacen', registroId: salidaId, usuarioId: request.user.sub,
          accion: 'crear', despues: { folio, obraId, frenteId, detalle },
        });

        return cargarSalidaCompleta(client, salidaId);
      });

      return reply.code(201).send(resultado);
    } catch (err) {
      if (err.code === 422) return reply.code(422).send({ error: 'No hay existencia suficiente para uno o más insumos', detalle: err.detalle });
      request.log.error(err);
      return reply.code(500).send({ error: 'No se pudo registrar la salida de almacén' });
    }
  });

  // --- Fotos de evidencia (personal que recibió / material entregado) — pedido del usuario 07/08/2026 ---

  app.post('/api/salidas-almacen/:id/fotos', { preHandler: app.requireRole('almacenista', 'direccion') }, async (request, reply) => {
    const { id } = request.params;
    const { rows: existe } = await pool.query('SELECT id FROM salidas_almacen WHERE id = $1', [id]);
    if (!existe[0]) return reply.code(404).send({ error: 'Salida de almacén no encontrada' });

    let tipo = null;
    let archivo = null;
    for await (const part of request.parts()) {
      if (part.type === 'file' && part.fieldname === 'archivo') {
        if (!MIME_FOTO_PERMITIDOS.has(part.mimetype)) {
          return reply.code(400).send({ error: 'Formato no soportado. Usa JPG, PNG o WEBP.' });
        }
        const buffer = await part.toBuffer();
        if (buffer.length > FOTO_MAX_BYTES) {
          return reply.code(400).send({ error: 'La foto es demasiado grande (máx. 10 MB).' });
        }
        archivo = { buffer, mimetype: part.mimetype, filename: part.filename };
      } else if (part.fieldname === 'tipo') {
        tipo = part.value;
      }
    }
    if (!['personal', 'material'].includes(tipo)) {
      return reply.code(400).send({ error: 'Tipo de foto inválido (personal o material)' });
    }
    if (!archivo) return reply.code(400).send({ error: 'No se recibió ninguna foto' });

    const { rows } = await pool.query(
      `INSERT INTO fotos_salida_almacen (salida_id, tipo, nombre_archivo, mime, archivo, tamano_bytes, subido_por)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING id, tipo, nombre_archivo, mime, tamano_bytes, creado_en`,
      [id, tipo, archivo.filename || 'foto.jpg', archivo.mimetype, archivo.buffer, archivo.buffer.length, request.user.sub]
    );
    await registrarBitacora(pool, {
      tabla: 'fotos_salida_almacen', registroId: rows[0].id, usuarioId: request.user.sub, accion: 'crear',
      despues: { salidaId: id, tipo },
    });
    return reply.code(201).send(rows[0]);
  });

  app.get('/api/salidas-almacen/:id/fotos/:fotoId', async (request, reply) => {
    const { rows } = await pool.query(
      'SELECT archivo, mime, nombre_archivo FROM fotos_salida_almacen WHERE id = $1 AND salida_id = $2',
      [request.params.fotoId, request.params.id]
    );
    if (!rows[0]) return reply.code(404).send({ error: 'Foto no encontrada' });
    reply.header('Cache-Control', 'private, max-age=60');
    return reply.type(rows[0].mime).send(rows[0].archivo);
  });

  app.delete('/api/salidas-almacen/:id/fotos/:fotoId', { preHandler: app.requireRole('almacenista', 'direccion') }, async (request, reply) => {
    const { rowCount } = await pool.query(
      'DELETE FROM fotos_salida_almacen WHERE id = $1 AND salida_id = $2',
      [request.params.fotoId, request.params.id]
    );
    if (!rowCount) return reply.code(404).send({ error: 'Foto no encontrada' });
    await registrarBitacora(pool, {
      tabla: 'fotos_salida_almacen', registroId: request.params.fotoId, usuarioId: request.user.sub, accion: 'eliminar',
    });
    return { ok: true };
  });
}
