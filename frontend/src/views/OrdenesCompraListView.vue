<template>
  <AppShell>
    <h2 class="font-display text-lg mb-4">Órdenes de compra</h2>

    <div class="overflow-x-auto bg-white border border-slate-200 rounded-xl">
      <table class="w-full text-sm tabular-nums">
        <thead>
          <tr class="bg-slate-50 text-[11px] uppercase tracking-wide text-slate-500">
            <th class="text-left px-4 py-2.5 font-normal font-sans">Folio</th>
            <th class="text-left px-4 py-2.5 font-normal font-sans">Proveedor</th>
            <th class="text-left px-4 py-2.5 font-normal font-sans">Importe</th>
            <th class="text-left px-4 py-2.5 font-normal font-sans">Estatus</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="oc in ordenes" :key="oc.id" class="border-t border-slate-200">
            <td class="px-4 py-2.5 font-semibold">{{ oc.folio }}</td>
            <td class="px-4 py-2.5 font-sans">{{ oc.proveedor_nombre }}</td>
            <td class="px-4 py-2.5">{{ mxn(oc.importe_total) }}</td>
            <td class="px-4 py-2.5 font-sans">
              <span class="inline-flex text-[11.5px] font-bold px-2.5 py-0.5 rounded-full" :class="estatusClase(oc.estatus)">
                {{ estatusTexto(oc.estatus) }}
              </span>
            </td>
            <td class="px-4 py-2.5 font-sans">
              <RouterLink :to="`/ordenes-compra/${oc.id}`" class="text-xs font-semibold text-primary underline">Abrir</RouterLink>
            </td>
          </tr>
          <tr v-if="!cargando && ordenes.length === 0">
            <td colspan="5" class="px-4 py-8 text-center text-slate-400 text-sm font-sans">No hay órdenes de compra todavía.</td>
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

const ordenes = ref([]);
const cargando = ref(true);

function mxn(n) {
  return new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN' }).format(n || 0);
}
function estatusTexto(e) {
  return { borrador: 'Borrador', confirmada: 'Confirmada', cancelada: 'Cancelada' }[e] ?? e;
}
function estatusClase(e) {
  if (e === 'confirmada') return 'bg-emerald-50 text-success';
  if (e === 'cancelada') return 'bg-slate-100 text-slate-500';
  return 'bg-amber-50 text-warning';
}

onMounted(async () => {
  const { data } = await api.get('/ordenes-compra');
  ordenes.value = data;
  cargando.value = false;
});
</script>
