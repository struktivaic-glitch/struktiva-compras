import { pool, withTransaction } from '../../db/pool.js';
import { registrarBitacora } from '../../lib/audit.js';
import { siguienteFolio } from '../../lib/folio.js';

const MIME_FOTO_PERMITIDOS = new Set(['image/jpeg', 'image/png', 'image/webp']);
const FOTO_MAX_BYTES = 10 * 1024 * 1024;

async function actualizarEstatusRequisicionesPorOc(client, ocId, usuarioId) {
  const { rows: reqs } = await client.query('SELECT requisicion_id FROM oc_requisicion WHERE oc_id = $1', [ocId]);

  for (const { requisicion_id: requisicionId } of reqs) {
    const { rows: renglones } = await client.query(
      `SELECT rd.insumo_id, rd.cantidad_aprobada,
              COALESCE((
                SELECT SUM(od.cantidad_surtida) FROM oc_detalle od
                JOIN oc_requisicion ocr ON ocr.oc_id = od.oc_id
                WHERE ocr.requisicion_id = $1 AND od.insumo_id = rd.insumo_id
              ), 0) AS surtido
       FROM requisicion_detalle rd WHERE rd.requisicion_id = $1`,
      [requisicionId]
    );

    const todoCubierto = renglones.every((r) => Number(r.surtido) >= Number(r.cantidad_aprobada));
    const algoCubierto = renglones.some((r) => Number(r.surtido) > 0);
    const nuevoEstatus = todoCubierto ? 'atendida_total' : algoCubierto ? 'atendida_parcial' : null;

    if (nuevoEstatus) {
      const { rows: actual } = await client.query('SELECT estatus FROM requisiciones WHERE id = $1', [requisicionId]);
      if (actual[0].estatus !== nuevoEstatus && !['cancelada'].includes(actual[0].estatus)) {
        await client.query('UPDATE requisiciones SET estatus = $2, actualizado_en = now() WHERE id = $1', [requisicionId, nuevoEstatus]);
        await registrarBitacora(client, {
          tabla: 'requisiciones', registroId: requisicionId, usuarioId, accion: 'actualizar_surtido',
          antes: { estatus: actual[0].estatus }, despues: { estatus: nuevoEstatus },
        });
      }
    }
  }
}

async function cargarEntradaCompleta(client, id) {
  const { rows: cab } = await client.query(
    `SELECT ea.*, oc.folio AS oc_folio, pr.razon_social AS proveedor_nombre, u.nombre AS recibio_nombre
     FROM entradas_almacen ea
     JOIN ordenes_compra oc ON oc.id = ea.oc_id
     JOIN proveedores pr ON pr.id = oc.proveedor_id
     JOIN usuarios u ON u.id = ea.usuario_recibio_id
     WHERE ea.id = $1`,
    [id]
  );
  if (!cab[0]) return null;

  const { rows: detalle } = await client.query(
    `SELECT ed.*, i.clave, i.descripcion, i.unidad, au.nombre AS autorizado_por_nombre
     FROM entrada_detalle ed
     JOIN insumos i ON i.id = ed.insumo_id
     LEFT JOIN usuarios au ON au.id = ed.autorizado_por
     WHERE ed.entrada_id = $1 ORDER BY i.descripcion`,
    [id]
  );

  const { rows: fotos } = await client.query(
    `SELECT id, tipo, nombre_archivo, mime, tamano_bytes, creado_en
     FROM fotos_entrada_almacen WHERE entrada_id = $1 ORDER BY creado_en DESC`,
    [id]
  );

  return { ...cab[0], detalle, fotos };
}

export default async function entradasAlmacenRoutes(app) {
  app.addHook('preHandler', app.authenticate);

  app.get('/api/entradas-almacen', async (request) => {
    const { ocId } = request.query;
    const condiciones = [];
    const valores = [];
    if (ocId) { valores.push(ocId); condiciones.push(`ea.oc_id = $${valores.length}`); }
    const where = condiciones.length ? `WHERE ${condiciones.join(' AND ')}` : '';

    const { rows } = await pool.query(
      `SELECT ea.id, ea.folio, ea.remision_proveedor, ea.fecha, oc.folio AS oc_folio, pr.razon_social AS proveedor_nombre,
              EXISTS (SELECT 1 FROM entrada_detalle ed WHERE ed.entrada_id = ea.id AND ed.cantidad_excedente > 0) AS tiene_excedente
       FROM entradas_almacen ea
       JOIN ordenes_compra oc ON oc.id = ea.oc_id
       JOIN proveedores pr ON pr.id = oc.proveedor_id
       ${where}
       ORDER BY ea.creado_en DESC LIMIT 200`,
      valores
    );
    return rows;
  });

  app.get('/api/entradas-almacen/:id', async (request, reply) => {
    const data = await cargarEntradaCompleta(pool, request.params.id);
    if (!data) return reply.code(404).send({ error: 'Entrada de almacén no encontrada' });
    return data;
  });

  app.post('/api/entradas-almacen', { preHandler: app.requireRole('almacenista', 'direccion') }, async (request, reply) => {
    const { ocId, remisionProveedor, detalle } = request.body ?? {};
    if (!ocId || !remisionProveedor?.trim() || !Array.isArray(detalle) || detalle.length === 0) {
      return reply.code(400).send({ error: 'OC, remisión del proveedor y al menos un renglón recibido son obligatorios' });
    }

    try {
      const resultado = await withTransaction(async (client) => {
        const { rows: ocRows } = await client.query('SELECT estatus FROM ordenes_compra WHERE id = $1 FOR UPDATE', [ocId]);
        if (!ocRows[0]) throw Object.assign(new Error('NOT_FOUND'), { code: 404 });
        if (ocRows[0].estatus !== 'confirmada') throw Object.assign(new Error('OC_NO_CONFIRMADA'), { code: 409 });

        const { rows: ocDetalle } = await client.query(
          `SELECT od.insumo_id, od.cantidad_pedida, od.cantidad_surtida, COALESCE(fi.tolerancia_recepcion_pct, 0) AS tolerancia_pct
           FROM oc_detalle od JOIN insumos i ON i.id = od.insumo_id LEFT JOIN familias_insumo fi ON fi.id = i.familia_id
           WHERE od.oc_id = $1`,
          [ocId]
        );
        const porInsumo = new Map(ocDetalle.map((d) => [d.insumo_id, d]));

        const bloqueados = [];
        const itemsValidados = [];
        for (const item of detalle) {
          const linea = porInsumo.get(item.insumoId);
          if (!linea) throw Object.assign(new Error('INSUMO_FUERA_DE_OC'), { code: 400 });

          const pendiente = Number(linea.cantidad_pedida) - Number(linea.cantidad_surtida);
          const excedente = Math.max(0, Number(item.cantidadRecibida) - pendiente);
          const toleranciaAbs = Math.max(0, pendiente) * (Number(linea.tolerancia_pct) / 100);
          const bloqueado = excedente > toleranciaAbs;

          if (bloqueado && !item.autorizarExcedente) {
            bloqueados.push({ insumoId: item.insumoId, pendiente, excedente, tolerancia_pct: linea.tolerancia_pct });
            continue;
          }
          if (bloqueado && item.autorizarExcedente && !['superintendente', 'direccion'].includes(request.user.rol)) {
            throw Object.assign(new Error('SIN_PERMISO_AUTORIZAR'), { code: 403 });
          }

          itemsValidados.push({ ...item, excedente, autorizado: bloqueado });
        }

        if (bloqueados.length > 0) {
          throw Object.assign(new Error('EXCEDE_TOLERANCIA'), { code: 422, detalle: bloqueados });
        }

        const folio = await siguienteFolio(client, 'ENT', 'entradas_folio_seq');
        const { rows: eaRows } = await client.query(
          `INSERT INTO entradas_almacen (folio, oc_id, remision_proveedor, usuario_recibio_id) VALUES ($1, $2, $3, $4) RETURNING id`,
          [folio, ocId, remisionProveedor.trim(), request.user.sub]
        );
        const entradaId = eaRows[0].id;

        for (const item of itemsValidados) {
          await client.query(
            `INSERT INTO entrada_detalle (entrada_id, insumo_id, cantidad_recibida, cantidad_excedente, autorizado_por)
             VALUES ($1, $2, $3, $4, $5)`,
            [entradaId, item.insumoId, item.cantidadRecibida, item.excedente, item.autorizado ? request.user.sub : null]
          );
          await client.query('UPDATE oc_detalle SET cantidad_surtida = cantidad_surtida + $2 WHERE oc_id = $1 AND insumo_id = $3', [
            ocId, item.cantidadRecibida, item.insumoId,
          ]);
        }

        await actualizarEstatusRequisicionesPorOc(client, ocId, request.user.sub);

        await registrarBitacora(client, {
          tabla: 'entradas_almacen', registroId: entradaId, usuarioId: request.user.sub,
          accion: 'crear', despues: { folio, ocId, detalle: itemsValidados },
        });

        return cargarEntradaCompleta(client, entradaId);
      });

      return reply.code(201).send(resultado);
    } catch (err) {
      if (err.code === 404) return reply.code(404).send({ error: 'Orden de compra no encontrada' });
      if (err.code === 409) return reply.code(409).send({ error: 'La Orden de Compra debe estar Confirmada para recibir material contra ella' });
      if (err.code === 400) return reply.code(400).send({ error: 'Uno de los insumos capturados no pertenece a esta Orden de Compra' });
      if (err.code === 403) return reply.code(403).send({ error: 'El excedente requiere autorización de Superintendente o Dirección' });
      if (err.code === 422) {
        return reply.code(422).send({
          error: 'Uno o más insumos exceden la tolerancia permitida sobre el pedido — requieren autorización',
          detalle: err.detalle,
        });
      }
      request.log.error(err);
      return reply.code(500).send({ error: 'No se pudo registrar la entrada de almacén' });
    }
  });

  // --- Fotos de evidencia (remisión / embarque) — pedido del usuario 07/08/2026 ---

  app.post('/api/entradas-almacen/:id/fotos', { preHandler: app.requireRole('almacenista', 'direccion') }, async (request, reply) => {
    const { id } = request.params;
    const { rows: existe } = await pool.query('SELECT id FROM entradas_almacen WHERE id = $1', [id]);
    if (!existe[0]) return reply.code(404).send({ error: 'Entrada de almacén no encontrada' });

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
    if (!['remision', 'embarque'].includes(tipo)) {
      return reply.code(400).send({ error: 'Tipo de foto inválido (remisión o embarque)' });
    }
    if (!archivo) return reply.code(400).send({ error: 'No se recibió ninguna foto' });

    const { rows } = await pool.query(
      `INSERT INTO fotos_entrada_almacen (entrada_id, tipo, nombre_archivo, mime, archivo, tamano_bytes, subido_por)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING id, tipo, nombre_archivo, mime, tamano_bytes, creado_en`,
      [id, tipo, archivo.filename || 'foto.jpg', archivo.mimetype, archivo.buffer, archivo.buffer.length, request.user.sub]
    );
    await registrarBitacora(pool, {
      tabla: 'fotos_entrada_almacen', registroId: rows[0].id, usuarioId: request.user.sub, accion: 'crear',
      despues: { entradaId: id, tipo },
    });
    return reply.code(201).send(rows[0]);
  });

  app.get('/api/entradas-almacen/:id/fotos/:fotoId', async (request, reply) => {
    const { rows } = await pool.query(
      'SELECT archivo, mime, nombre_archivo FROM fotos_entrada_almacen WHERE id = $1 AND entrada_id = $2',
      [request.params.fotoId, request.params.id]
    );
    if (!rows[0]) return reply.code(404).send({ error: 'Foto no encontrada' });
    reply.header('Cache-Control', 'private, max-age=60');
    return reply.type(rows[0].mime).send(rows[0].archivo);
  });

  app.delete('/api/entradas-almacen/:id/fotos/:fotoId', { preHandler: app.requireRole('almacenista', 'direccion') }, async (request, reply) => {
    const { rowCount } = await pool.query(
      'DELETE FROM fotos_entrada_almacen WHERE id = $1 AND entrada_id = $2',
      [request.params.fotoId, request.params.id]
    );
    if (!rowCount) return reply.code(404).send({ error: 'Foto no encontrada' });
    await registrarBitacora(pool, {
      tabla: 'fotos_entrada_almacen', registroId: request.params.fotoId, usuarioId: request.user.sub, accion: 'eliminar',
    });
    return { ok: true };
  });
}
