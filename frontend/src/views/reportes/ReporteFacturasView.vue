<template>
  <AppShell>
    <div class="flex items-center justify-between mb-4 no-print flex-wrap gap-3">
      <h2 class="font-display text-lg">Listado de Facturas</h2>
      <div class="flex items-center gap-2">
        <select v-model="estatusPago" class="text-sm border border-slate-300 rounded-lg px-2.5 py-2" @change="cargar">
          <option value="">Todos los estatus de pago</option>
          <option value="pendiente">Pendiente</option>
          <option value="pagada_parcial">Pagada parcial</option>
          <option value="pagada_total">Pagada total</option>
        </select>
        <button class="min-h-[40px] bg-primary text-white text-sm font-bold rounded-lg px-4" @click="window.print()">Imprimir / Guardar PDF</button>
      </div>
    </div>

    <div class="print-sheet bg-white border border-slate-200 rounded-xl p-5">
      <ReportePrintHeader titulo="Listado de Facturas" :subtitulo="estatusPago ? `Estatus: ${estatusTexto(estatusPago)}` : 'Todos los estatus'" />
      <table class="w-full text-sm tabular-nums">
        <thead>
          <tr class="text-[11px] uppercase tracking-wide text-slate-500 border-b border-slate-300">
            <th class="text-left py-2 font-normal font-sans">Folio</th>
            <th class="text-left py-2 font-normal font-sans">Proveedor</th>
            <th class="text-left py-2 font-normal font-sans">Total</th>
            <th class="text-left py-2 font-normal font-sans">Pagado</th>
            <th class="text-left py-2 font-normal font-sans">Saldo</th>
            <th class="text-left py-2 font-normal font-sans">Estatus</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="f in facturas" :key="f.id" class="border-b border-slate-100">
            <td class="py-2 font-semibold">{{ f.folio }}</td>
            <td class="py-2 font-sans">{{ f.proveedor_nombre }}</td>
            <td class="py-2">{{ mxn(f.total) }}</td>
            <td class="py-2">{{ mxn(f.monto_pagado) }}</td>
            <td class="py-2">{{ mxn(f.total - f.monto_pagado) }}</td>
            <td class="py-2 font-sans">{{ estatusTexto(f.estatus_pago) }}</td>
          </tr>
        </tbody>
        <tfoot>
          <tr class="border-t border-slate-300 font-bold">
            <td class="py-2 font-sans" colspan="2">Total</td>
            <td class="py-2">{{ mxn(totalFacturado) }}</td>
            <td class="py-2">{{ mxn(totalPagado) }}</td>
            <td class="py-2">{{ mxn(totalFacturado - totalPagado) }}</td>
            <td></td>
          </tr>
        </tfoot>
      </table>
    </div>
  </AppShell>
</template>

<script setup>
import { computed, onMounted, ref } from 'vue';
import AppShell from '../../components/AppShell.vue';
import ReportePrintHeader from '../../components/ReportePrintHeader.vue';
import { api } from '../../lib/api.js';

const facturas = ref([]);
const estatusPago = ref('');

const ESTATUS_TEXTO = { pendiente: 'Pendiente', pagada_parcial: 'Pagada parcial', pagada_total: 'Pagada total' };
function estatusTexto(e) { return ESTATUS_TEXTO[e] ?? e; }
function mxn(n) { return new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN' }).format(n || 0); }

const totalFacturado = computed(() => facturas.value.reduce((s, f) => s + Number(f.total), 0));
const totalPagado = computed(() => facturas.value.reduce((s, f) => s + Number(f.monto_pagado), 0));

async function cargar() {
  const { data } = await api.get('/facturas', { params: { estatusPago: estatusPago.value || undefined } });
  facturas.value = data;
}

onMounted(cargar);
</script>
