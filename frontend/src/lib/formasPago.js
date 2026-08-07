// Formas de pago fijas (07/08/2026, pedido del usuario) — catálogo cerrado, debe coincidir
// exactamente con el CHECK de la base de datos (migración 028) y con FORMAS_PAGO_VALIDAS en el
// backend (modules/pagos/routes.js y modules/pagosPersonal/routes.js).
export const FORMAS_PAGO = [
  { clave: 'efectivo', label: 'Efectivo' },
  { clave: 'transferencia', label: 'Transferencia' },
  { clave: 'tarjeta_debito', label: 'Tarjeta de débito' },
  { clave: 'tarjeta_credito', label: 'Tarjeta de crédito' },
];

export const FORMAS_PAGO_TEXTO = Object.fromEntries(FORMAS_PAGO.map((f) => [f.clave, f.label]));
