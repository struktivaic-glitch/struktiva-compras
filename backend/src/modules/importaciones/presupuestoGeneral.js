import { pool, withTransaction } from '../../db/pool.js';
import { registrarBitacora } from '../../lib/audit.js';
import { leerHojaComoMatriz } from '../../lib/xlsxReader.js';

// Bloque 29: importador del Presupuesto General por Conceptos (catálogo de lo contratado con el
// cliente — capítulo/clave/descripción/unidad/cantidad/P.U.), mismo patrón que el importador de
// Explosión de Insumos (analizar → confirmar).

const ALIAS_COLUMNAS = {
  clave: ['codigo', 'código', 'clave'],
  descripcion: ['concepto', 'descripcion', 'descripción'],
  unidad: ['unidad', 'un', 'u.m.', 'um'],
  cantidad: ['cantidad', 'cant'],
  precio: ['precio', 'precio unitario', 'p.u.', 'pu'],
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
  const matriz = await leerHojaComoMatriz(buffer, 'presupuesto');
  if (matriz.length === 0) throw Object.assign(new Error('SIN_HOJAS'), { code: 400 });

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
  let capituloActual = null;

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
      items.push({
        clave: claveTxt,
        descripcion: descTxt,
        unidad: String(unidad).trim(),
        cantidad: typeof cantidad === 'number' ? cantidad : Number(cantidad) || 0,
        precio: typeof precio === 'number' ? precio : Number(precio) || 0,
        capitulo: capituloActual,
      });
    } else if (!claveTxt && descTxt && !unidad) {
      if (!/^total\b/i.test(descTxt)) {
        capituloActual = descTxt;
      }
    }
  }

  const capitulosSet = [...new Set(items.map((i) => i.capitulo).filter(Boolean))];
  const resumenPorCapitulo = capitulosSet.map((capitulo) => {
    const deEsteCapitulo = items.filter((i) => i.capitulo === capitulo);
    return {
      capitulo,
      cantidadConceptos: deEsteCapitulo.length,
      importeTotal: deEsteCapitulo.reduce((s, i) => s + i.cantidad * i.precio, 0),
    };
  });

  return { items, capitulos: capitulosSet, resumenPorCapitulo };
}

export default async function presupuestoGeneralRoutes(app) {
  app.addHook('preHandler', app.authenticate);

  app.post('/api/importaciones/presupuesto-general/analizar', { preHandler: app.requireRole('comprador', 'direccion') }, async (request, reply) => {
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
        return reply.code(422).send({ error: 'No se encontraron renglones de conceptos en el archivo' });
      }
      return resultado;
    } catch (err) {
      if (err.code === 400) return reply.code(400).send({ error: 'El archivo no tiene hojas legibles' });
      if (err.code === 422) return reply.code(422).send({ error: 'No se encontró la fila de encabezado (se esperaba una columna "Código"/"Clave" y "Concepto"/"Descripción")' });
      request.log.error(err);
      return reply.code(500).send({ error: 'No se pudo leer el archivo. Verifica que sea un .xlsx válido.' });
    }
  });

  app.post('/api/importaciones/presupuesto-general/confirmar', { preHandler: app.requireRole('comprador', 'direccion') }, async (request, reply) => {
    const { obraId, items } = request.body ?? {};
    if (!obraId || !Array.isArray(items) || items.length === 0) {
      return reply.code(400).send({ error: 'obraId y al menos un concepto son obligatorios' });
    }

    try {
      const resumen = await withTransaction(async (client) => {
        let conceptosNuevos = 0;
        let conceptosActualizados = 0;

        for (const item of items) {
          const { rows } = await client.query(
            `INSERT INTO conceptos_obra (obra_id, capitulo, clave, descripcion, unidad, cantidad_contratada, precio_unitario)
             VALUES ($1, $2, $3, $4, $5, $6, $7)
             ON CONFLICT (obra_id, clave) DO UPDATE SET
               capitulo = EXCLUDED.capitulo, descripcion = EXCLUDED.descripcion, unidad = EXCLUDED.unidad,
               cantidad_contratada = EXCLUDED.cantidad_contratada, precio_unitario = EXCLUDED.precio_unitario
             RETURNING id, (xmax = 0) AS es_nuevo`,
            [obraId, item.capitulo, item.clave, item.descripcion, item.unidad, item.cantidad, item.precio]
          );
          if (rows[0].es_nuevo) conceptosNuevos += 1;
          else conceptosActualizados += 1;
        }

        await registrarBitacora(client, {
          tabla: 'conceptos_obra', registroId: obraId, usuarioId: request.user.sub,
          accion: 'importar_presupuesto_general', despues: { totalItems: items.length, conceptosNuevos, conceptosActualizados },
        });

        return { totalItems: items.length, conceptosNuevos, conceptosActualizados };
      });

      return reply.code(201).send(resumen);
    } catch (err) {
      request.log.error(err);
      return reply.code(500).send({ error: 'No se pudo guardar la importación' });
    }
  });
}
