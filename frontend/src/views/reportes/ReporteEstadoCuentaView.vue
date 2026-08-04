<template>
  <AppShell>
    <div class="flex items-center justify-between mb-4 no-print flex-wrap gap-3">
      <h2 class="font-display text-lg">Estado de cuenta por proveedor</h2>
      <div class="flex items-center gap-2">
        <select v-model.number="proveedorId" class="text-sm border border-slate-300 rounded-lg px-2.5 py-2">
          <option v-for="p in proveedores" :key="p.id" :value="p.id">{{ p.razon_social }}</option>
        </select>
        <button class="min-h-[40px] bg-primary text-white text-sm font-bold rounded-lg px-4" @click="window.print()">Imprimir / Guardar PDF</button>
      </div>
    </div>

    <div v-if="datos" class="print-sheet bg-white border border-slate-200 rounded-xl p-5">
      <ReportePrintHeader titulo="Estado de cuenta" :subtitulo="proveedorNombre" />

      <h3 class="text-[12.5px] font-bold font-sans mb-2">Facturas</h3>
      <table class="w-full text-sm tabular-nums mb-5">
        <thead>
          <tr class="text-[11px] uppercase tracking-wide text-slate-500 border-b border-slate-300">
            <th class="text-left py-2 font-normal font-sans">Folio</th>
            <th class="text-left py-2 font-normal font-sans">Fecha</th>
            <th class="text-left py-2 font-normal font-sans">Total</th>
            <th class="text-left py-2 font-normal font-sans">Pagado</th>
            <th class="text-left py-2 font-normal font-sans">Saldo</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="f in datos.facturas" :key="f.id" class="border-b border-slate-100">
            <td class="py-2 font-semibold">{{ f.folio }}</td>
            <td class="py-2 font-sans">{{ new Date(f.fecha).toLocaleDateString('es-MX') }}</td>
            <td class="py-2">{{ mxn(f.total) }}</td>
            <td class="py-2">{{ mxn(f.monto_pagado) }}</td>
            <td class="py-2 font-bold" :class="f.saldo > 0 ? 'text-warning' : 'text-success'">{{ mxn(f.saldo) }}</td>
          </tr>
        </tbody>
        <tfoot>
          <tr class="border-t border-slate-300 font-bold">
            <td class="py-2 font-sans" colspan="4">Saldo total</td>
            <td class="py-2">{{ mxn(saldoTotal) }}</td>
          </tr>
        </tfoot>
      </table>

      <h3 class="text-[12.5px] font-bold font-sans mb-2">Pagos realizados</h3>
      <table class="w-full text-sm tabular-nums">
        <thead>
          <tr class="text-[11px] uppercase tracking-wide text-slate-500 border-b border-slate-300">
            <th class="text-left py-2 font-normal font-sans">Folio</th>
            <th class="text-left py-2 font-normal font-sans">Fecha</th>
            <th class="text-left py-2 font-normal font-sans">Forma de pago</th>
            <th class="text-left py-2 font-normal font-sans">Monto</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="p in datos.pagos" :key="p.id" class="border-b border-slate-100">
            <td class="py-2 font-semibold">{{ p.folio }}</td>
            <td class="py-2 font-sans">{{ new Date(p.fecha).toLocaleDateString('es-MX') }}</td>
            <td class="py-2 font-sans">{{ p.forma_pago }}</td>
            <td class="py-2">{{ mxn(p.monto) }}</td>
          </tr>
          <tr v-if="datos.pagos.length === 0">
            <td colspan="4" class="py-4 text-center text-slate-400 text-xs font-sans">Sin pagos registrados.</td>
          </tr>
        </tbody>
      </table>
    </div>
  </AppShell>
</template>

<script setup>
import { computed, onMounted, ref, watch } from 'vue';
import AppShell from '../../components/AppShell.vue';
import ReportePrintHeader from '../../components/ReportePrintHeader.vue';
import { api } from '../../lib/api.js';

const proveedores = ref([]);
const proveedorId = ref(null);
const datos = ref(null);

function mxn(n) { return new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN' }).format(n || 0); }

const proveedorNombre = computed(() => proveedores.value.find((p) => p.id === proveedorId.value)?.razon_social ?? '');
const saldoTotal = computed(() => (datos.value?.facturas ?? []).reduce((s, f) => s + Number(f.saldo), 0));

async function cargar() {
  if (!proveedorId.value) return;
  const { data } = await api.get(`/proveedores/${proveedorId.value}/estado-cuenta`);
  datos.value = data;
}
watch(proveedorId, cargar);

onMounted(async () => {
  const { data } = await api.get('/proveedores');
  proveedores.value = data;
  proveedorId.value = data[0]?.id ?? null;
  await cargar();
});
</script>
