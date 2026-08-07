// Lista canónica de módulos del menú — fuente única de verdad, usada tanto por AppShell.vue
// (para pintar el menú agrupado) como por UsuariosView.vue (para el checklist de permisos por
// usuario, migración 029). "Usuarios" NO aparece aquí a propósito: sigue gobernado solo por rol
// (direccion/auditor), fuera del checklist, para no arriesgar que alguien se quite a sí mismo (o
// al único administrador) el acceso a la pantalla que arregla los permisos.
export const GRUPOS_NAV = [
  {
    clave: 'insumos', label: 'Insumos', icono: '📥',
    items: [
      { to: '/', label: 'Dashboard' },
      { to: '/requisiciones', label: 'Requisiciones' },
      { to: '/cotizaciones', label: 'Cotizaciones' },
      { to: '/proveedores', label: 'Proveedores' },
      { to: '/ordenes-compra', label: 'Órdenes de compra' },
      { to: '/importar-insumos', label: 'Importar Insumos' },
      { to: '/reportes', label: 'Reportes' },
      { to: '/destajos', label: 'Destajos' },
    ],
  },
  {
    clave: 'obras', label: 'Obras', icono: '🏗️',
    items: [
      { to: '/importar-presupuesto-general', label: 'Importar Presupuesto' },
      { to: '/avance-obra', label: 'Avance de Obra' },
      { to: '/reportes/avance-financiero', label: 'Dash de Avance de Obra' },
    ],
  },
  {
    clave: 'almacen', label: 'Almacén', icono: '🏬',
    items: [
      { to: '/almacen/entradas', label: 'Entradas' },
      { to: '/almacen/salidas', label: 'Salidas' },
      { to: '/almacen/inventario', label: 'Inventario' },
      { to: '/facturas', label: 'Facturas' },
      { to: '/pagos', label: 'Pagos' },
      { to: '/equipos', label: 'Maquinaria y Equipos' },
    ],
  },
  {
    clave: 'rh', label: 'R.H.', icono: '👥',
    items: [
      { to: '/trabajadores', label: 'Personal' },
      { to: '/asistencia', label: 'Asistencia' },
      { to: '/incidencias', label: 'Incidencias' },
      { to: '/pagos-personal', label: 'Pagos a Personal' },
      { to: '/destajistas', label: 'Destajistas' },
    ],
  },
];

// Lista plana de todos los módulos (clave = ruta), para el checklist de permisos.
export const MODULOS_FLAT = GRUPOS_NAV.flatMap((g) => g.items.map((item) => ({ ...item, grupo: g.label })));
