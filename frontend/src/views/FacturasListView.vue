<template>
  <AppShell>
    <div class="flex items-center justify-between mb-4">
      <h2 class="font-display text-[36px]">Facturas</h2>
      <RouterLink to="/facturas/nueva" class="min-h-[30px] flex items-center bg-primary text-white text-[13px] font-bold rounded-lg px-4">
        + Nueva factura
      </RouterLink>
    </div>

    <div class="overflow-x-auto bg-white border border-slate-200 rounded-xl">
      <table class="w-full text-sm tabular-nums">
        <thead>
          <tr class="bg-slate-50 text-[11px] uppercase tracking-wide text-slate-500">
            <th class="text-left px-4 py-2.5 font-normal font-sans">Folio</th>
            <th class="text-left px-4 py-2.5 font-normal font-sans">OC</th>
            <th class="text-left px-4 py-2.5 font-normal font-sans">Proveedor</th>
            <th class="text-left px-4 py-2.5 font-normal font-sans">Total</th>
            <th class="text-left px-4 py-2.5 font-normal font-sans">Pagado</th>
            <th class="text-left px-4 py-2.5 font-normal font-sans">Estatus</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="f in facturas" :key="f.id" class="border-t border-slate-200">
            <td class="px-4 py-2.5 font-semibold">{{ f.folio }}</td>
            <td class="px-4 py-2.5">{{ f.oc_folio }}</td>
            <td class="px-4 py-2.5 font-sans">{{ f.proveedor_nombre }}</td>
            <td class="px-4 py-2.5">{{ mxn(f.total) }}</td>
            <td class="px-4 py-2.5">{{ mxn(f.monto_pagado) }}</td>
            <td class="px-4 py-2.5 font-sans">
              <span class="inline-flex text-[11.5px] font-bold px-2.5 py-0.5 rounded-full" :class="estatusClase(f.estatus_pago)">
                {{ estatusTexto(f.estatus_pago) }}
              </span>
            </td>
            <td class="px-4 py-2.5 font-sans"><RouterLink :to="`/facturas/${f.id}`" class="text-xs font-semibold text-primary underline">Ver</RouterLink></td>
          </tr>
          <tr v-if="!cargando && facturas.length === 0">
            <td colspan="7" class="px-4 py-8 text-center text-slate-400 text-sm font-sans">No hay facturas todavía.</td>
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

const facturas = ref([]);
const cargando = ref(true);

function mxn(n) {
  return new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN' }).format(n || 0);
}
function estatusTexto(e) {
  return { pendiente: 'Pendiente', pagada_parcial: 'Pagada parcial', pagada_total: 'Pagada total' }[e] ?? e;
}
function estatusClase(e) {
  if (e === 'pagada_total') return 'bg-emerald-50 text-success';
  if (e === 'pagada_parcial') return 'bg-amber-50 text-warning';
  return 'bg-slate-100 text-slate-600';
}

onMounted(async () => {
  const { data } = await api.get('/facturas');
  facturas.value = data;
  cargando.value = false;
});
</script>
