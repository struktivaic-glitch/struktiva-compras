import { pool, withTransaction } from '../../db/pool.js';
import { registrarBitacora } from '../../lib/audit.js';
import { siguienteFolio } from '../../lib/folio.js';

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

  return { ...cab[0], detalle };
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
}
