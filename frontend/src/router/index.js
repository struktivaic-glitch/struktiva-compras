import { createRouter, createWebHistory } from 'vue-router';
import { useAuthStore } from '../stores/auth.js';

const routes = [
  { path: '/login', name: 'login', component: () => import('../views/LoginView.vue') },
  { path: '/', name: 'dashboard', component: () => import('../views/DashboardView.vue'), meta: { requiresAuth: true } },
  { path: '/requisiciones', name: 'requisiciones', component: () => import('../views/RequisicionesListView.vue'), meta: { requiresAuth: true } },
  { path: '/requisiciones/nueva', name: 'requisicion-nueva', component: () => import('../views/RequisicionNuevaView.vue'), meta: { requiresAuth: true } },
  { path: '/requisiciones/:id', name: 'requisicion-detalle', component: () => import('../views/RequisicionDetalleView.vue'), meta: { requiresAuth: true } },
  { path: '/proveedores', name: 'proveedores', component: () => import('../views/ProveedoresView.vue'), meta: { requiresAuth: true } },
  { path: '/trabajadores', name: 'trabajadores', component: () => import('../views/TrabajadoresView.vue'), meta: { requiresAuth: true } },
  { path: '/trabajadores/:id', name: 'personal-detalle', component: () => import('../views/PersonalDetalleView.vue'), meta: { requiresAuth: true } },
  { path: '/asistencia', name: 'asistencia', component: () => import('../views/AsistenciaView.vue'), meta: { requiresAuth: true } },
  { path: '/incidencias', name: 'incidencias', component: () => import('../views/IncidenciasView.vue'), meta: { requiresAuth: true } },
  { path: '/pagos-personal', name: 'pagos-personal', component: () => import('../views/PagosPersonalView.vue'), meta: { requiresAuth: true } },
  { path: '/cotizaciones', name: 'cotizaciones', component: () => import('../views/CotizacionesListView.vue'), meta: { requiresAuth: true } },
  { path: '/cotizaciones/nueva', name: 'cotizacion-nueva', component: () => import('../views/CotizacionNuevaView.vue'), meta: { requiresAuth: true, roles: ['comprador', 'direccion'] } },
  { path: '/cotizaciones/:id', name: 'cotizacion-detalle', component: () => import('../views/CotizacionDetalleView.vue'), meta: { requiresAuth: true } },
  { path: '/ordenes-compra', name: 'ordenes-compra', component: () => import('../views/OrdenesCompraListView.vue'), meta: { requiresAuth: true } },
  { path: '/ordenes-compra/:id', name: 'orden-compra-detalle', component: () => import('../views/OrdenCompraDetalleView.vue'), meta: { requiresAuth: true } },
  { path: '/almacen/entradas', name: 'entradas-almacen', component: () => import('../views/EntradasAlmacenListView.vue'), meta: { requiresAuth: true } },
  { path: '/almacen/entradas/nueva', name: 'entrada-almacen-nueva', component: () => import('../views/EntradaAlmacenNuevaView.vue'), meta: { requiresAuth: true, roles: ['almacenista', 'direccion'] } },
  { path: '/almacen/entradas/:id', name: 'entrada-almacen-detalle', component: () => import('../views/EntradaAlmacenDetalleView.vue'), meta: { requiresAuth: true } },
  { path: '/almacen/salidas', name: 'salidas-almacen', component: () => import('../views/SalidasAlmacenListView.vue'), meta: { requiresAuth: true } },
  { path: '/almacen/salidas/nueva', name: 'salida-almacen-nueva', component: () => import('../views/SalidaAlmacenNuevaView.vue'), meta: { requiresAuth: true, roles: ['almacenista', 'direccion'] } },
  { path: '/almacen/salidas/:id', name: 'salida-almacen-detalle', component: () => import('../views/SalidaAlmacenDetalleView.vue'), meta: { requiresAuth: true } },
  { path: '/almacen/inventario', name: 'inventario', component: () => import('../views/InventarioView.vue'), meta: { requiresAuth: true } },
  { path: '/facturas', name: 'facturas', component: () => import('../views/FacturasListView.vue'), meta: { requiresAuth: true } },
  { path: '/facturas/nueva', name: 'factura-nueva', component: () => import('../views/FacturaNuevaView.vue'), meta: { requiresAuth: true, roles: ['comprador', 'direccion'] } },
  { path: '/facturas/:id', name: 'factura-detalle', component: () => import('../views/FacturaDetalleView.vue'), meta: { requiresAuth: true } },
  { path: '/pagos', name: 'pagos', component: () => import('../views/PagosListView.vue'), meta: { requiresAuth: true } },
  { path: '/pagos/nuevo', name: 'pago-nuevo', component: () => import('../views/PagoNuevoView.vue'), meta: { requiresAuth: true, roles: ['comprador', 'direccion'] } },
  { path: '/pagos/:id', name: 'pago-detalle', component: () => import('../views/PagoDetalleView.vue'), meta: { requiresAuth: true } },
  { path: '/expediente/:id', name: 'expediente', component: () => import('../views/ExpedienteView.vue'), meta: { requiresAuth: true } },
  { path: '/reportes', name: 'reportes', component: () => import('../views/ReportesView.vue'), meta: { requiresAuth: true } },
  { path: '/reportes/requisiciones', name: 'reporte-requisiciones', component: () => import('../views/reportes/ReporteRequisicionesView.vue'), meta: { requiresAuth: true } },
  { path: '/reportes/facturas', name: 'reporte-facturas', component: () => import('../views/reportes/ReporteFacturasView.vue'), meta: { requiresAuth: true } },
  { path: '/reportes/estado-cuenta', name: 'reporte-estado-cuenta', component: () => import('../views/reportes/ReporteEstadoCuentaView.vue'), meta: { requiresAuth: true } },
  { path: '/reportes/explosion-vs-real', name: 'reporte-explosion-real', component: () => import('../views/reportes/ReporteExplosionVsRealView.vue'), meta: { requiresAuth: true } },
  { path: '/reportes/variacion-precios', name: 'reporte-variacion-precios', component: () => import('../views/reportes/ReporteVariacionPreciosView.vue'), meta: { requiresAuth: true } },
  { path: '/reportes/avance-financiero', name: 'reporte-avance-financiero', component: () => import('../views/reportes/ReporteAvanceFinancieroView.vue'), meta: { requiresAuth: true } },
  { path: '/perfil', name: 'perfil', component: () => import('../views/PerfilView.vue'), meta: { requiresAuth: true } },
  { path: '/importar-insumos', name: 'importar-insumos', component: () => import('../views/ImportarInsumosView.vue'), meta: { requiresAuth: true, roles: ['comprador', 'direccion'] } },
  { path: '/importar-presupuesto-general', name: 'importar-presupuesto-general', component: () => import('../views/ImportarPresupuestoGeneralView.vue'), meta: { requiresAuth: true, roles: ['comprador', 'direccion'] } },
  { path: '/avance-obra', name: 'avance-obra', component: () => import('../views/AvanceObraView.vue'), meta: { requiresAuth: true } },
  { path: '/usuarios', name: 'usuarios', component: () => import('../views/UsuariosView.vue'), meta: { requiresAuth: true, roles: ['direccion', 'auditor'] } },
  { path: '/notificaciones', name: 'notificaciones', component: () => import('../views/NotificacionesView.vue'), meta: { requiresAuth: true } },
];

const router = createRouter({
  history: createWebHistory(),
  routes,
});

router.beforeEach((to) => {
  const auth = useAuthStore();
  if (to.meta.requiresAuth && !auth.autenticado) {
    return { name: 'login', query: { redirect: to.fullPath } };
  }
  if (to.meta.roles && !to.meta.roles.includes(auth.rol)) {
    return { name: 'dashboard' };
  }
  if (to.name === 'login' && auth.autenticado) {
    return { name: 'dashboard' };
  }
});

export default router;
