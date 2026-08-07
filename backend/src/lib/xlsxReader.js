// Lector mínimo de .xlsx propio (en vez de exceljs/xlsx de terceros).
//
// Por qué: los exports reales de Neodata no incluyen los atributos r= (índice de fila/celda)
// en las etiquetas <row>/<c> — es válido según el estándar OOXML (la posición se infiere del
// orden en que aparecen las etiquetas), pero exceljs no lo soporta bien y truena con
// "Invalid row number in model". Este lector no depende de esos atributos: solo recorre las
// etiquetas <row>/<c> en el orden en que aparecen en el XML, tal como cualquier lector de
// Excel real (incluido el propio Excel) las interpretaría.
import yauzl from 'yauzl';
import { XMLParser } from 'fast-xml-parser';

function abrirZip(buffer) {
  return new Promise((resolve, reject) => {
    yauzl.fromBuffer(buffer, { lazyEntries: true, autoClose: false }, (err, zipfile) => {
      if (err) return reject(err);
      resolve(zipfile);
    });
  });
}

function leerEntrada(zipfile, entry) {
  return new Promise((resolve, reject) => {
    zipfile.openReadStream(entry, (err, stream) => {
      if (err) return reject(err);
      const chunks = [];
      stream.on('data', (c) => chunks.push(c));
      stream.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')));
      stream.on('error', reject);
    });
  });
}

async function leerArchivosDelZip(buffer, nombresBuscados) {
  const zipfile = await abrirZip(buffer);
  const resultado = {};
  await new Promise((resolve, reject) => {
    zipfile.readEntry();
    zipfile.on('entry', async (entry) => {
      if (nombresBuscados.some((n) => entry.fileName === n || entry.fileName.endsWith(n))) {
        try {
          resultado[entry.fileName] = await leerEntrada(zipfile, entry);
        } catch (e) {
          zipfile.close();
          return reject(e);
        }
      }
      zipfile.readEntry();
    });
    zipfile.on('end', () => {
      zipfile.close();
      resolve();
    });
    zipfile.on('error', reject);
  });
  return resultado;
}

const parserXml = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: '@_',
  preserveOrder: false,
  isArray: (name) => ['row', 'c', 'si', 'r'].includes(name),
});

function textoDeSharedString(si) {
  // <si><t>texto</t></si>  ó  <si><r><t>texto</t></r><r><t>mas</t></r></si> (rich text)
  if (si?.t !== undefined) return typeof si.t === 'object' ? (si.t['#text'] ?? '') : String(si.t);
  if (si?.r) {
    const runs = Array.isArray(si.r) ? si.r : [si.r];
    return runs.map((run) => (typeof run.t === 'object' ? run.t['#text'] ?? '' : run.t ?? '')).join('');
  }
  return '';
}

/**
 * Extrae la primera hoja cuyo nombre incluya `filtroNombreHoja` (o la primera hoja si no hay match)
 * como una matriz de filas -> arreglo de valores de celda, en el orden en que aparecen en el XML.
 */
export async function leerHojaComoMatriz(buffer, filtroNombreHoja = '') {
  const archivos = await leerArchivosDelZip(buffer, [
    'xl/sharedStrings.xml',
    'xl/workbook.xml',
    'xl/_rels/workbook.xml.rels',
  ]);

  const sharedStrings = [];
  if (archivos['xl/sharedStrings.xml']) {
    const doc = parserXml.parse(archivos['xl/sharedStrings.xml']);
    const items = doc.sst?.si ?? [];
    for (const si of items) sharedStrings.push(textoDeSharedString(si));
  }

  // Determina qué archivo de hoja (xl/worksheets/sheetN.xml) corresponde a cada nombre de hoja.
  let hojaObjetivoPath = 'xl/worksheets/sheet1.xml';
  if (archivos['xl/workbook.xml'] && archivos['xl/_rels/workbook.xml.rels']) {
    const wb = parserXml.parse(archivos['xl/workbook.xml']);
    const rels = parserXml.parse(archivos['xl/_rels/workbook.xml.rels']);
    const sheets = wb.workbook?.sheets?.sheet;
    const listaSheets = Array.isArray(sheets) ? sheets : sheets ? [sheets] : [];
    const relsList = Array.isArray(rels.Relationships?.Relationship)
      ? rels.Relationships.Relationship
      : rels.Relationships?.Relationship
        ? [rels.Relationships.Relationship]
        : [];

    const elegida =
      listaSheets.find((s) => String(s['@_name'] ?? '').toLowerCase().includes(filtroNombreHoja.toLowerCase())) ??
      listaSheets[0];

    if (elegida) {
      const rId = elegida['@_r:id'];
      const rel = relsList.find((r) => r['@_Id'] === rId);
      if (rel?.['@_Target']) hojaObjetivoPath = `xl/${rel['@_Target'].replace(/^\/?xl\//, '')}`;
    }
  }

  const hojaArchivos = await leerArchivosDelZip(buffer, [hojaObjetivoPath]);
  const hojaXml = hojaArchivos[hojaObjetivoPath];
  if (!hojaXml) throw Object.assign(new Error('HOJA_NO_ENCONTRADA'), { code: 400 });

  const hojaDoc = parserXml.parse(hojaXml);
  const filasXml = hojaDoc.worksheet?.sheetData?.row ?? [];

  function valorDeCelda(c) {
    const tipo = c['@_t'];
    // <c t="inlineStr"><is><t>texto</t></is></c> — el texto vive en <is>, no en <v> (a
    // diferencia de shared strings/numéricos). Algunas herramientas (ej. openpyxl) escriben así
    // por default en vez de usar sharedStrings.xml.
    if (tipo === 'inlineStr') {
      return c.is ? textoDeSharedString(c.is) : null;
    }
    const valorCrudo = c.v;
    if (valorCrudo === undefined || valorCrudo === null) return null;
    if (tipo === 's') {
      const idx = Number(typeof valorCrudo === 'object' ? valorCrudo['#text'] : valorCrudo);
      return sharedStrings[idx] ?? null;
    }
    if (tipo === 'str') {
      return typeof valorCrudo === 'object' ? valorCrudo['#text'] : String(valorCrudo);
    }
    // Numérico (incluye fechas seriales, que no necesitamos convertir para este importador).
    const num = Number(typeof valorCrudo === 'object' ? valorCrudo['#text'] : valorCrudo);
    return Number.isNaN(num) ? null : num;
  }

  // Índice de columna 0-based a partir de la referencia de celda ("B7" -> 1). Excel/las
  // herramientas que generan .xlsx (ej. openpyxl) omiten el <c> de celdas vacías por completo —
  // sin esto, una fila con huecos (ej. solo la columna B con texto) se recorre por posición y
  // todo queda desalineado una o más columnas a la izquierda.
  function columnaAIndice(ref) {
    const letras = String(ref ?? '').match(/^[A-Z]+/)?.[0] ?? '';
    let idx = 0;
    for (const ch of letras) idx = idx * 26 + (ch.charCodeAt(0) - 64);
    return idx - 1;
  }

  const matriz = filasXml.map((filaXml) => {
    const celdasXml = filaXml.c ?? [];
    const fila = [];
    let siguiente = 0;
    for (const c of celdasXml) {
      const ref = c['@_r'];
      const idx = ref ? columnaAIndice(ref) : siguiente;
      const destino = idx >= 0 ? idx : siguiente;
      while (fila.length < destino) fila.push(null);
      fila[destino] = valorDeCelda(c);
      siguiente = destino + 1;
    }
    return fila;
  });

  return matriz;
}
