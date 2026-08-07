// Lista canónica de módulos (claves = mismas rutas del menú) — debe coincidir con
// frontend/src/lib/modulosNav.js. Se usa aquí solo para dar de alta a un usuario nuevo con
// acceso a todo por default (mismo comportamiento que tenían todos los usuarios antes de la
// migración 029) y como candado ligero de sanidad al guardar el checklist de un usuario.
export const MODULOS_CLAVES = [
  '/', '/requisiciones', '/cotizaciones', '/proveedores', '/ordenes-compra',
  '/importar-insumos', '/reportes', '/destajos',
  '/importar-presupuesto-general', '/avance-obra', '/reportes/avance-financiero',
  '/almacen/entradas', '/almacen/salidas', '/almacen/inventario', '/facturas',
  '/pagos', '/equipos',
  '/trabajadores', '/asistencia', '/incidencias', '/pagos-personal', '/destajistas',
];
