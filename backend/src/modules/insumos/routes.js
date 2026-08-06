import { pool } from '../../db/pool.js';
import { registrarBitacora } from '../../lib/audit.js';

// Alta directa de insumos (sin pasar por el importador de Excel) — pensado principalmente para
// dar de alta rubros nuevos de Mano de Obra al vuelo desde una Requisición de Nómina, pero sirve
// para cualquier insumo. Arranca con presupuesto en $0 a propósito (Bloque 28): cualquier cargo
// contra un insumo recién creado dispara "excede presupuesto" hasta que Dirección autorice un
// estimado real con PUT /:id/presupuesto.

const ROLES_GESTION = ['residente', 'superintendente', 'direccion'];

export default async function insumosRoutes(app) {
  app.addHook('preHandler', app.authenticate);

  app.get('/api/insumos', async (request) => {
    const { esManoDeObra, q } = request.query;
    const condiciones = [];
    const valores = [];
    if (esManoDeObra === '1') condiciones.push('COALESCE(fi.es_mano_de_obra, false)');
    if (q) { valores.push(`%${q}%`); condiciones.push(`(i.clave ILIKE $${valores.length} OR i.descripcion ILIKE $${valores.length})`); }
    const where = condiciones.length ? `WHERE ${condiciones.join(' AND ')}` : '';
    const { rows } = await pool.query(
      `SELECT i.id, i.clave, i.descripcion, i.unidad, i.familia_id, fi.nombre AS familia_nombre,
              COALESCE(fi.es_mano_de_obra, false) AS es_mano_de_obra
       FROM insumos i
       LEFT JOIN familias_insumo fi ON fi.id = i.familia_id
       ${where}
       ORDER BY i.descripcion`,
      valores
    );
    return rows;
  });

  app.post('/api/insumos', { preHandler: app.requireRole(...ROLES_GESTION) }, async (request, reply) => {
    const { clave, descripcion, unidad, familiaId, obraId, costoUnitarioReferencia } = request.body ?? {};
    if (!clave?.trim() || !descripcion?.trim() || !unidad?.trim()) {
      return reply.code(400).send({ error: 'Clave, descripción y unidad son obligatorios' });
    }
    if (!obraId || !costoUnitarioReferencia || Number(costoUnitarioReferencia) <= 0) {
      return reply.code(400).send({ error: 'Obra y costo unitario de referencia son obligatorios (arranca con presupuesto en $0)' });
    }

    try {
      // Si no se especifica familia, se asume que es un alta de Mano de Obra (caso de uso
      // principal de este endpoint) y se busca/crea la familia "Mano de Obra" automáticamente,
      // para no depender de que el frontend adivine un familiaId — evita que un insumo nuevo
      // quede sin marcar es_mano_de_obra cuando la obra todavía no tiene ningún rubro de MdO.
      let familiaFinal = familiaId || null;
      if (!familiaFinal) {
        const { rows: familiaExistente } = await pool.query(
          `SELECT id FROM familias_insumo WHERE es_mano_de_obra = true ORDER BY id LIMIT 1`
        );
        if (familiaExistente[0]) {
          familiaFinal = familiaExistente[0].id;
        } else {
          const { rows: familiaNueva } = await pool.query(
            `INSERT INTO familias_insumo (nombre, es_mano_de_obra) VALUES ('Mano de Obra', true) RETURNING id`
          );
          familiaFinal = familiaNueva[0].id;
        }
      }

      const { rows: insumoRows } = await pool.query(
        `INSERT INTO insumos (clave, descripcion, unidad, familia_id) VALUES ($1, $2, $3, $4) RETURNING *`,
        [clave.trim(), descripcion.trim(), unidad.trim(), familiaFinal]
      );
      const insumo = insumoRows[0];

      await pool.query(
        `INSERT INTO presupuesto_obra_insumo (obra_id, insumo_id, cantidad_presupuestada, costo_unitario, moneda)
         VALUES ($1, $2, 0, $3, 'MXN')
         ON CONFLICT (obra_id, insumo_id) DO NOTHING`,
        [obraId, insumo.id, costoUnitarioReferencia]
      );

      await registrarBitacora(pool, {
        tabla: 'insumos', registroId: insumo.id, usuarioId: request.user.sub, accion: 'crear',
        despues: { ...insumo, obraId, costoUnitarioReferencia },
      });
      return reply.code(201).send(insumo);
    } catch (err) {
      if (err.code === '23505') return reply.code(409).send({ error: 'Ya existe un insumo con esa clave' });
      request.log.error(err);
      return reply.code(500).send({ error: 'No se pudo crear el insumo' });
    }
  });

  // "Autorizar el estimado" — Dirección fija el presupuesto real de un insumo para una obra
  // (normalmente uno recién creado en $0). Puede llamarse las veces que haga falta para ajustar.
  app.put('/api/insumos/:id/presupuesto', { preHandler: app.requireRole('direccion') }, async (request, reply) => {
    const { id } = request.params;
    const { obraId, cantidadPresupuestada, costoUnitario } = request.body ?? {};
    if (!obraId || cantidadPresupuestada == null || Number(cantidadPresupuestada) < 0) {
      return reply.code(400).send({ error: 'Obra y cantidad presupuestada son obligatorios' });
    }
    const { rows: existe } = await pool.query('SELECT id FROM insumos WHERE id = $1', [id]);
    if (!existe[0]) return reply.code(404).send({ error: 'Insumo no encontrado' });

    const { rows } = await pool.query(
      `INSERT INTO presupuesto_obra_insumo (obra_id, insumo_id, cantidad_presupuestada, costo_unitario, moneda)
       VALUES ($1, $2, $3, COALESCE($4, 0), 'MXN')
       ON CONFLICT (obra_id, insumo_id) DO UPDATE SET
         cantidad_presupuestada = EXCLUDED.cantidad_presupuestada,
         costo_unitario = COALESCE($4, presupuesto_obra_insumo.costo_unitario)
       RETURNING *`,
      [obraId, id, cantidadPresupuestada, costoUnitario ?? null]
    );
    await registrarBitacora(pool, {
      tabla: 'presupuesto_obra_insumo', registroId: id, usuarioId: request.user.sub, accion: 'autorizar_presupuesto',
      despues: rows[0],
    });
    return rows[0];
  });
}
