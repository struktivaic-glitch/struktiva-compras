import { pool, withTransaction } from '../../db/pool.js';
import { registrarBitacora } from '../../lib/audit.js';

export default async function catalogoRoutes(app) {
  app.addHook('preHandler', app.authenticate);

  // Alta de obra nueva — crea de una vez una Etapa/Frente/Partida inicial para que la
  // requisición tenga dónde amarrarse (son etiquetas descriptivas, no dimensión de presupuesto).
  app.post('/api/obras', { preHandler: app.requireRole('direccion') }, async (request, reply) => {
    const { nombre, ubicacion, cliente, etapaNombre, frenteNombre, partidaClave, partidaNombre } = request.body ?? {};
    if (!nombre?.trim()) return reply.code(400).send({ error: 'El nombre de la obra es obligatorio' });

    try {
      const resultado = await withTransaction(async (client) => {
        const { rows: obraRows } = await client.query(
          `INSERT INTO obras (nombre, ubicacion, cliente) VALUES ($1, $2, $3) RETURNING id`,
          [nombre.trim(), ubicacion?.trim() || null, cliente?.trim() || null]
        );
        const obraId = obraRows[0].id;

        const { rows: etapaRows } = await client.query(
          `INSERT INTO etapas (obra_id, nombre, orden) VALUES ($1, $2, 1) RETURNING id`,
          [obraId, etapaNombre?.trim() || 'Etapa 1']
        );
        const { rows: frenteRows } = await client.query(
          `INSERT INTO frentes (etapa_id, nombre, orden) VALUES ($1, $2, 1) RETURNING id`,
          [etapaRows[0].id, frenteNombre?.trim() || 'General']
        );
        await client.query(
          `INSERT INTO partidas (frente_id, clave, nombre) VALUES ($1, $2, $3)`,
          [frenteRows[0].id, partidaClave?.trim() || 'GEN-01', partidaNombre?.trim() || 'General']
        );

        await registrarBitacora(client, {
          tabla: 'obras', registroId: obraId, usuarioId: request.user.sub, accion: 'crear', despues: { nombre },
        });

        return { id: obraId, nombre: nombre.trim() };
      });

      return reply.code(201).send(resultado);
    } catch (err) {
      request.log.error(err);
      return reply.code(500).send({ error: 'No se pudo crear la obra' });
    }
  });

  // Árbol Obra > Etapa > Frente > Partida, para el selector de la captura de requisición.
  app.get('/api/catalogo/obras', async () => {
    const { rows: obras } = await pool.query(
      `SELECT id, nombre, ubicacion, cliente FROM obras WHERE estatus = 'activa' ORDER BY nombre`
    );
    const { rows: etapas } = await pool.query(
      `SELECT id, obra_id, nombre, orden FROM etapas ORDER BY orden`
    );
    const { rows: frentes } = await pool.query(
      `SELECT id, etapa_id, nombre, orden FROM frentes ORDER BY orden`
    );
    const { rows: partidas } = await pool.query(
      `SELECT id, frente_id, clave, nombre FROM partidas ORDER BY clave`
    );

    return obras.map((obra) => ({
      ...obra,
      etapas: etapas
        .filter((e) => e.obra_id === obra.id)
        .map((etapa) => ({
          ...etapa,
          frentes: frentes
            .filter((f) => f.etapa_id === etapa.id)
            .map((frente) => ({
              ...frente,
              partidas: partidas.filter((p) => p.frente_id === frente.id),
            })),
        })),
    }));
  });

  // Autocompletado inteligente de insumos, con saldo disponible dentro de la obra indicada
  // (el presupuesto se controla a nivel Obra completa, no por partida — ver migración 007).
  app.get('/api/catalogo/obras/:obraId/insumos', async (request, reply) => {
    const { obraId } = request.params;
    const q = (request.query.q ?? '').trim();
    // El buscador de autocompletado pide pocos (rápido, mientras escribes); el catálogo completo
    // (modal "Ver catálogo") pide todos con ?todos=1, agrupados por familia del lado del cliente.
    const limite = request.query.todos === '1' ? 500 : 25;

    const { rows } = await pool.query(
      `SELECT i.id, i.clave, i.descripcion, i.unidad, fi.nombre AS familia_nombre, COALESCE(fi.es_mano_de_obra, false) AS es_mano_de_obra,
              s.cantidad_presupuestada, s.cantidad_aprobada_acumulada, s.saldo_disponible, s.costo_unitario, s.moneda
       FROM presupuesto_obra_insumo poi
       JOIN insumos i ON i.id = poi.insumo_id
       LEFT JOIN familias_insumo fi ON fi.id = i.familia_id
       JOIN vw_saldo_obra_insumo s ON s.obra_id = poi.obra_id AND s.insumo_id = poi.insumo_id
       WHERE poi.obra_id = $1
         AND ($2 = '' OR i.descripcion ILIKE '%' || $2 || '%' OR i.clave ILIKE '%' || $2 || '%')
       ORDER BY fi.nombre NULLS LAST, i.descripcion
       LIMIT $3`,
      [obraId, q, limite]
    );

    return rows;
  });

  // Saldos por familia de insumo dentro de una obra — usado por el Dashboard.
  app.get('/api/catalogo/obras/:obraId/saldos-por-familia', async (request) => {
    const { obraId } = request.params;
    const { rows } = await pool.query(
      `SELECT COALESCE(fi.nombre, 'Sin familia') AS familia,
              SUM(s.cantidad_presupuestada * s.costo_unitario) AS presupuestado,
              SUM(s.cantidad_aprobada_acumulada * s.costo_unitario) AS aprobado
       FROM vw_saldo_obra_insumo s
       JOIN insumos i ON i.id = s.insumo_id
       LEFT JOIN familias_insumo fi ON fi.id = i.familia_id
       WHERE s.obra_id = $1
       GROUP BY COALESCE(fi.nombre, 'Sin familia')
       ORDER BY presupuestado DESC`,
      [obraId]
    );
    return rows;
  });
}
