<template>
  <AppShell>
    <h2 class="font-display text-[36px] mb-1">Reportes</h2>
    <p class="text-xs text-slate-500 mb-5">Filtros por Obra, Fecha, Familia, Proveedor y Estatus dentro de cada reporte. Cada uno se puede imprimir o guardar como PDF desde el navegador.</p>

    <div class="grid sm:grid-cols-2 lg:grid-cols-3 gap-3.5">
      <RouterLink v-for="r in reportes" :key="r.to" :to="r.to" class="bg-white border border-slate-200 rounded-xl p-4 shadow-sm flex flex-col gap-2 hover:border-primary">
        <h3 class="text-[13.5px] font-bold">{{ r.titulo }}</h3>
        <p class="text-xs text-slate-500 flex-1">{{ r.descripcion }}</p>
        <span class="text-xs font-semibold text-primary">Abrir →</span>
      </RouterLink>
    </div>
  </AppShell>
</template>

<script setup>
import AppShell from '../components/AppShell.vue';

const reportes = [
  { to: '/reportes/requisiciones', titulo: 'Listado de Requisiciones', descripcion: 'Todas las requisiciones por estatus, con partidas en excedente resaltadas.' },
  { to: '/reportes/facturas', titulo: 'Listado de Facturas', descripcion: 'Facturas vinculadas y su estatus de pago (pendiente/parcial/total).' },
  { to: '/almacen/inventario', titulo: 'Inventario actual de almacén', descripcion: 'Existencia por insumo = Σ Entradas − Σ Salidas, por obra.' },
  { to: '/reportes/estado-cuenta', titulo: 'Estado de cuenta por proveedor', descripcion: 'Facturas, pagos aplicados y saldo por proveedor.' },
  { to: '/reportes/explosion-vs-real', titulo: 'Explosión vs. Real', descripcion: 'Presupuestado vs. Requerido, Comprado, Recibido y Facturado por insumo.' },
  { to: '/reportes/variacion-precios', titulo: 'Variación de precios', descripcion: 'Costo base de presupuesto vs. costo real negociado por insumo.' },
  { to: '/reportes/avance-financiero', titulo: 'Avance Financiero', descripcion: 'Valor de obra ejecutada vs. presupuesto general contratado, por concepto.' },
];
</script>
