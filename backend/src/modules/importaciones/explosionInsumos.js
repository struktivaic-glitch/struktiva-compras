import { pool, withTransaction } from '../../db/pool.js';
import { registrarBitacora } from '../../lib/audit.js';
import { leerHojaComoMatriz } from '../../lib/xlsxReader.js';

// Alias de encabezados aceptados — distintos exports de Neodata pueden nombrar las columnas
// ligeramente distinto (ej. "Código" vs "Clave", "Concepto" vs "Descripción").
const ALIAS_COLUMNAS = {
  clave: ['codigo', 'código', 'clave'],
  descripcion: ['concepto', 'descripcion', 'descripción'],
  unidad: ['unidad', 'un', 'u.m.', 'um'],
  cantidad: ['cantidad', 'cant'],
  precio: ['precio', 'precio unitario', 'costo unitario', 'costo'],
};

function normalizar(txt) {
  return String(txt ?? '')
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '');
}

function detectarColumnas(filaEncabezado) {
  const mapa = {};
  filaEncabezado.forEach((valorCelda, colIndex) => {
    const valor = normalizar(valorCelda);
    for (const [campo, alias] of Object.entries(ALIAS_COLUMNAS)) {
      if (alias.some((a) => normalizar(a) === valor)) mapa[campo] = colIndex;
    }
  });
  return mapa;
}

export async function analizarExcel(buffer) {
  const matriz = await leerHojaComoMatriz(buffer, 'insumo');
  if (matriz.length === 0) throw Object.assign(new Error('SIN_HOJAS'), { code: 400 });

  // Busca la fila de encabezado real (trae "Código"/"Clave" en alguna celda) entre las primeras 40 filas.
  let filaEncabezadoIdx = null;
  let columnas = null;
  for (let r = 0; r < Math.min(40, matriz.length); r++) {
    const detectadas = detectarColumnas(matriz[r] ?? []);
    if (detectadas.clave !== undefined && detectadas.descripcion !== undefined) {
      filaEncabezadoIdx = r;
      columnas = detectadas;
      break;
    }
  }
  if (filaEncabezadoIdx === null) {
    throw Object.assign(new Error('ENCABEZADO_NO_ENCONTRADO'), { code: 422 });
  }

  const items = [];
  let familiaActual = null;

  for (let r = filaEncabezadoIdx + 1; r < matriz.length; r++) {
    const fila = matriz[r] ?? [];
    const clave = fila[columnas.clave];
    const descripcion = fila[columnas.descripcion];
    const unidad = columnas.unidad !== undefined ? fila[columnas.unidad] : null;
    const cantidad = columnas.cantidad !== undefined ? fila[columnas.cantidad] : null;
    const precio = columnas.precio !== undefined ? fila[columnas.precio] : null;

    const claveTxt = clave != null ? String(clave).trim() : '';
    const descTxt = descripcion != null ? String(descripcion).trim() : '';

    if (claveTxt && unidad) {
      // Fila de dato: tiene clave y unidad.
      items.push({
        clave: claveTxt,
        descripcion: descTxt,
        unidad: String(unidad).trim(),
        cantidad: typeof cantidad === 'number' ? cantidad : Number(cantidad) || 0,
        precio: typeof precio === 'number' ? precio : Number(precio) || 0,
        familia: familiaActual,
      });
    } else if (!claveTxt && descTxt && !unidad) {
      // Posible encabezado de familia — se descarta si empieza con "TOTAL".
      if (!/^total\b/i.test(descTxt)) {
        familiaActual = descTxt;
      }
    }
    // Filas totalmente vacías o "TOTAL ..." se ignoran.
  }

  const familiasSet = [...new Set(items.map((i) => i.familia).filter(Boolean))];
  const resumenPorFamilia = familiasSet.map((familia) => {
    const deEstaFamilia = items.filter((i) => i.familia === familia);
    return {
      familia,
      cantidadInsumos: deEstaFamilia.length,
      importeTotal: deEstaFamilia.reduce((s, i) => s + i.cantidad * i.precio, 0),
    };
  });

  return { items, familias: familiasSet, resumenPorFamilia };
}

export default async function explosionInsumosRoutes(app) {
  app.addHook('preHandler', app.authenticate);

  app.post('/api/importaciones/explosion-insumos/analizar', { preHandler: app.requireRole('comprador', 'direccion') }, async (request, reply) => {
    let archivo = null;
    for await (const part of request.parts()) {
      if (part.type === 'file' && part.fieldname === 'archivo') {
        archivo = await part.toBuffer();
      }
    }
    if (!archivo) return reply.code(400).send({ error: 'Sube un archivo .xlsx' });

    try {
      const resultado = await analizarExcel(archivo);
      if (resultado.items.length === 0) {
        return reply.code(422).send({ error: 'No se encontraron renglones de insumos en el archivo' });
      }
      return resultado;
    } catch (err) {
      if (err.code === 400) return reply.code(400).send({ error: 'El archivo no tiene hojas legibles' });
      if (err.code === 422) return reply.code(422).send({ error: 'No se encontró la fila de encabezado (se esperaba una columna "Código"/"Clave" y "Concepto"/"Descripción")' });
      request.log.error(err);
      return reply.code(500).send({ error: 'No se pudo leer el archivo. Verifica que sea un .xlsx válido.' });
    }
  });

  app.post('/api/importaciones/explosion-insumos/confirmar', { preHandler: app.requireRole('comprador', 'direccion') }, async (request, reply) => {
    const { obraId, items } = request.body ?? {};
    if (!obraId || !Array.isArray(items) || items.length === 0) {
      return reply.code(400).send({ error: 'obraId y al menos un insumo son obligatorios' });
    }

    try {
      const resumen = await withTransaction(async (client) => {
        const familiaIdPorNombre = new Map();
        let familiasCreadas = 0;
        let insumosNuevos = 0;
        let insumosActualizados = 0;

        for (const item of items) {
          let familiaId = null;
          if (item.familia) {
            if (!familiaIdPorNombre.has(item.familia)) {
              const { rows } = await client.query(
                `INSERT INTO familias_insumo (nombre) VALUES ($1)
                 ON CONFLICT (nombre) DO UPDATE SET nombre = EXCLUDED.nombre
                 RETURNING id, (xmax = 0) AS es_nueva`,
                [item.familia]
              );
              familiaIdPorNombre.set(item.familia, rows[0].id);
              if (rows[0].es_nueva) familiasCreadas += 1;
            }
            familiaId = familiaIdPorNombre.get(item.familia);
          }

          const { rows: insumoRows } = await client.query(
            `INSERT INTO insumos (clave, descripcion, unidad, familia_id) VALUES ($1, $2, $3, $4)
             ON CONFLICT (clave) DO UPDATE SET descripcion = EXCLUDED.descripcion, unidad = EXCLUDED.unidad, familia_id = EXCLUDED.familia_id
             RETURNING id, (xmax = 0) AS es_nuevo`,
            [item.clave, item.descripcion, item.unidad, familiaId]
          );
          const insumoId = insumoRows[0].id;
          if (insumoRows[0].es_nuevo) insumosNuevos += 1;
          else insumosActualizados += 1;

          await client.query(
            `INSERT INTO presupuesto_obra_insumo (obra_id, insumo_id, cantidad_presupuestada, costo_unitario, moneda)
             VALUES ($1, $2, $3, $4, 'MXN')
             ON CONFLICT (obra_id, insumo_id) DO UPDATE SET cantidad_presupuestada = EXCLUDED.cantidad_presupuestada, costo_unitario = EXCLUDED.costo_unitario`,
            [obraId, insumoId, item.cantidad, item.precio]
          );
        }

        await registrarBitacora(client, {
          tabla: 'presupuesto_obra_insumo', registroId: obraId, usuarioId: request.user.sub,
          accion: 'importar_explosion', despues: { totalItems: items.length, familiasCreadas, insumosNuevos, insumosActualizados },
        });

        return { totalItems: items.length, familiasCreadas, insumosNuevos, insumosActualizados };
      });

      return reply.code(201).send(resumen);
    } catch (err) {
      request.log.error(err);
      return reply.code(500).send({ error: 'No se pudo guardar la importación' });
    }
  });
}
