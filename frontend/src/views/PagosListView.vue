<template>
  <AppShell>
    <div class="flex items-center justify-between mb-4">
      <h2 class="font-display text-lg">Pagos a proveedores</h2>
      <RouterLink to="/pagos/nuevo" class="min-h-[40px] flex items-center bg-primary text-white text-sm font-bold rounded-lg px-4">
        + Nuevo pago
      </RouterLink>
    </div>

    <div class="overflow-x-auto bg-white border border-slate-200 rounded-xl">
      <table class="w-full text-sm tabular-nums">
        <thead>
          <tr class="bg-slate-50 text-[11px] uppercase tracking-wide text-slate-500">
            <th class="text-left px-4 py-2.5 font-normal font-sans">Folio</th>
            <th class="text-left px-4 py-2.5 font-normal font-sans">Proveedor</th>
            <th class="text-left px-4 py-2.5 font-normal font-sans">Monto</th>
            <th class="text-left px-4 py-2.5 font-normal font-sans">Forma de pago</th>
            <th class="text-left px-4 py-2.5 font-normal font-sans">Fecha</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="p in pagos" :key="p.id" class="border-t border-slate-200">
            <td class="px-4 py-2.5 font-semibold">{{ p.folio }}</td>
            <td class="px-4 py-2.5 font-sans">{{ p.proveedor_nombre }}</td>
            <td class="px-4 py-2.5">{{ mxn(p.monto) }}</td>
            <td class="px-4 py-2.5 font-sans">{{ p.forma_pago }}</td>
            <td class="px-4 py-2.5">{{ new Date(p.fecha).toLocaleDateString('es-MX') }}</td>
          </tr>
          <tr v-if="!cargando && pagos.length === 0">
            <td colspan="5" class="px-4 py-8 text-center text-slate-400 text-sm font-sans">No hay pagos registrados todavía.</td>
          </tr>
        </tbody>
      </table>
    </div>
  </AppShell>
</template>

<script setup>
import { onMounted, ref } from 'vue';
import AppShell from '../components/AppShell.vue';
import { api } from '../lib/api.js';

const pagos = ref([]);
const cargando = ref(true);

function mxn(n) {
  return new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN' }).format(n || 0);
}

onMounted(async () => {
  const { data } = await api.get('/pagos-proveedor');
  pagos.value = data;
  cargando.value = false;
});
</script>
