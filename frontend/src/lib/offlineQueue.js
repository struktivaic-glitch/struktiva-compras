// Cola de borradores capturados sin conexión (localStorage). Solo Requisiciones por ahora.
const CLAVE = 'struktiva_borradores_offline';

function leer() {
  try {
    return JSON.parse(localStorage.getItem(CLAVE) || '[]');
  } catch {
    return [];
  }
}

function escribir(lista) {
  localStorage.setItem(CLAVE, JSON.stringify(lista));
}

export function guardarBorradorLocal(payload) {
  const lista = leer();
  const borrador = { id: crypto.randomUUID(), creadoEn: new Date().toISOString(), payload };
  lista.push(borrador);
  escribir(lista);
  return borrador;
}

export function listarBorradoresLocales() {
  return leer();
}

export function eliminarBorradorLocal(id) {
  escribir(leer().filter((b) => b.id !== id));
}

export function contarBorradoresLocales() {
  return leer().length;
}

// Es "error de red" (sin respuesta del servidor) y no un error de validación del negocio.
export function esErrorDeRed(err) {
  return !err.response;
}
