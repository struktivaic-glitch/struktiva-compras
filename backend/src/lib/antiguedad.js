// Antigüedad y vacaciones — pedido del usuario (08/08/2026). Cálculo de días de vacaciones que
// corresponden por antigüedad, según la Ley Federal del Trabajo, Art. 76 (reforma "Vacaciones
// Dignas", vigente desde el 1 de enero de 2023):
//   Año 1: 12 días · +2 por cada año hasta el año 5 (14, 16, 18, 20) · a partir del año 6,
//   +2 días por cada bloque de 5 años cumplidos de más (22 en años 6-10, 24 en años 11-15, ...).
// El "año de servicio" de una persona corre de aniversario a aniversario (no es el año
// calendario) — todo lo de abajo respeta eso.

export function diasVacacionesPorAntiguedad(aniosCumplidos) {
  if (aniosCumplidos < 1) return 0;
  if (aniosCumplidos <= 5) return 10 + aniosCumplidos * 2; // 1→12, 2→14, 3→16, 4→18, 5→20
  const bloquesDeCinco = Math.ceil((aniosCumplidos - 5) / 5);
  return 20 + bloquesDeCinco * 2;
}

// Años completos cumplidos entre fechaIngreso y fechaReferencia (default: hoy).
export function aniosCumplidos(fechaIngreso, fechaReferencia = new Date()) {
  const ingreso = new Date(fechaIngreso);
  let anios = fechaReferencia.getFullYear() - ingreso.getFullYear();
  const aniversarioEsteAnio = new Date(fechaReferencia.getFullYear(), ingreso.getMonth(), ingreso.getDate());
  if (fechaReferencia < aniversarioEsteAnio) anios -= 1;
  return Math.max(0, anios);
}

// Fecha del próximo aniversario de ingreso (hoy o en el futuro más cercano).
export function proximoAniversario(fechaIngreso, fechaReferencia = new Date()) {
  const ingreso = new Date(fechaIngreso);
  let candidato = new Date(fechaReferencia.getFullYear(), ingreso.getMonth(), ingreso.getDate());
  if (candidato < fechaReferencia) candidato = new Date(fechaReferencia.getFullYear() + 1, ingreso.getMonth(), ingreso.getDate());
  return candidato;
}

// Rango [desde, hasta) del "año de servicio" vigente (el que ya empezó, corre hasta el próximo
// aniversario) — es el periodo contra el que se cuentan los días de vacaciones ya tomados.
export function rangoAnioServicioActual(fechaIngreso, fechaReferencia = new Date()) {
  const ingreso = new Date(fechaIngreso);
  let desde = new Date(fechaReferencia.getFullYear(), ingreso.getMonth(), ingreso.getDate());
  if (desde > fechaReferencia) desde = new Date(fechaReferencia.getFullYear() - 1, ingreso.getMonth(), ingreso.getDate());
  const hasta = new Date(desde.getFullYear() + 1, desde.getMonth(), desde.getDate());
  return { desde: desde.toISOString().slice(0, 10), hasta: hasta.toISOString().slice(0, 10) };
}

// Info completa de vacaciones de una persona, dado su fecha de ingreso y los días que ya haya
// tomado en el año de servicio vigente (se le pasa la suma, ya consultada aparte en la BD).
export function infoVacaciones(fechaIngreso, diasTomadosAnioActual = 0) {
  if (!fechaIngreso) return null;
  const anios = aniosCumplidos(fechaIngreso);
  const corresponden = diasVacacionesPorAntiguedad(anios);
  return {
    aniosCumplidos: anios,
    diasCorresponden: corresponden,
    diasTomados: Number(diasTomadosAnioActual),
    diasSaldo: Math.max(0, corresponden - Number(diasTomadosAnioActual)),
    proximoAniversario: proximoAniversario(fechaIngreso).toISOString().slice(0, 10),
    ...rangoAnioServicioActualNombrado(fechaIngreso),
  };
}

function rangoAnioServicioActualNombrado(fechaIngreso) {
  const { desde, hasta } = rangoAnioServicioActual(fechaIngreso);
  return { anioServicioDesde: desde, anioServicioHasta: hasta };
}
