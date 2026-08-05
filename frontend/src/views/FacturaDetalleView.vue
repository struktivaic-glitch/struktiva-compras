<template>
  <AppShell>
    <div v-if="!factura" class="text-sm text-slate-500">Cargando…</div>
    <template v-else>
      <BotonVolver fallback="/facturas" />
      <div class="flex items-center justify-between flex-wrap gap-3 mb-1">
        <div>
          <h2 class="font-display text-lg">{{ factura.folio }}</h2>
          <p class="text-xs text-slate-500">
            {{ factura.proveedor_nombre }} · Contra {{ factura.oc_folio }} ·
            Serie/folio fiscal: {{ factura.serie_folio || '—' }} · UUID: {{ factura.folio_fiscal_uuid || '—' }}
          </p>
        </div>
        <span class="inline-flex text-[11.5px] font-bold px-2.5 py-0.5 rounded-full" :class="estatusClase(factura.estatus_pago)">
          {{ estatusTexto(factura.estatus_pago) }}
        </span>
      </div>

      <div class="flex gap-3 my-4">
        <a v-if="factura.xml_url" :href="factura.xml_url" target="_blank" class="text-xs font-semibold text-primary underline">Descargar XML</a>
        <a v-if="factura.pdf_url" :href="factura.pdf_url" target="_blank" class="text-xs font-semibold text-primary underline">Descargar PDF</a>
      </div>

      <div class="overflow-x-auto bg-white border border-slate-200 rounded-xl mb-5">
        <table class="w-full text-sm tabular-nums">
          <thead>
            <tr class="bg-slate-50 text-[11px] uppercase tracking-wide text-slate-500">
              <th class="text-left px-4 py-2.5 font-normal font-sans">Insumo</th>
              <th class="text-left px-4 py-2.5 font-normal font-sans">Cantidad</th>
              <th class="text-left px-4 py-2.5 font-normal font-sans">Precio unitario</th>
              <th class="text-left px-4 py-2.5 font-normal font-sans">Importe</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="d in factura.detalle" :key="d.id" class="border-t border-slate-200">
              <td class="px-4 py-2.5 font-sans font-semibold">{{ d.clave }} · {{ d.descripcion }}</td>
              <td class="px-4 py-2.5">{{ d.cantidad }} {{ d.unidad }}</td>
              <td class="px-4 py-2.5">{{ mxn(d.precio_unitario) }}</td>
              <td class="px-4 py-2.5">{{ mxn(d.cantidad * d.precio_unitario) }}</td>
            </tr>
          </tbody>
          <tfoot>
            <tr class="border-t border-slate-300">
              <td colspan="3" class="px-4 py-2 font-sans text-slate-500">Subtotal</td>
              <td class="px-4 py-2">{{ mxn(factura.subtotal) }}</td>
            </tr>
            <tr>
              <td colspan="3" class="px-4 py-2 font-sans text-slate-500">IVA</td>
              <td class="px-4 py-2">{{ mxn(factura.iva) }}</td>
            </tr>
            <tr class="font-bold">
              <td colspan="3" class="px-4 py-2 font-sans">Total</td>
              <td class="px-4 py-2">{{ mxn(factura.total) }}</td>
            </tr>
            <tr class="text-success">
              <td colspan="3" class="px-4 py-2 font-sans">Pagado</td>
              <td class="px-4 py-2">{{ mxn(factura.monto_pagado) }}</td>
            </tr>
          </tfoot>
        </table>
      </div>
    </template>
  </AppShell>
</template>

<script setup>
import { onMounted, ref } from 'vue';
import { useRoute } from 'vue-router';
import AppShell from '../components/AppShell.vue';
import BotonVolver from '../components/BotonVolver.vue';
import { api } from '../lib/api.js';

const route = useRoute();
const factura = ref(null);

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
  const { data } = await api.get(`/facturas/${route.params.id}`);
  factura.value = data;
});
</script>
