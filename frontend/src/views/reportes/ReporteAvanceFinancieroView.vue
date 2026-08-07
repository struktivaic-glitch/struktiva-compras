<template>
  <AppShell>
    <div class="flex items-center justify-between mb-4 no-print flex-wrap gap-3">
      <h2 class="font-display text-[36px]">Avance Financiero</h2>
      <div class="flex items-center gap-2">
        <select v-model.number="obraId" class="text-sm border border-slate-300 rounded-lg px-2.5 py-2">
          <option v-for="o in obras" :key="o.id" :value="o.id">{{ o.nombre }}</option>
        </select>
        <button class="min-h-[39px] bg-primary text-white text-sm font-bold rounded-lg px-4" @click="imprimir">Imprimir / Guardar PDF</button>
      </div>
    </div>

    <div class="print-sheet bg-white border border-slate-200 rounded-xl p-5 overflow-x-auto">
      <ReportePrintHeader titulo="Avance Financiero de Obra" :subtitulo="`${obraNombre} · Presupuesto general contratado vs. valor de obra ejecutada`" />

      <div class="grid sm:grid-cols-3 gap-3.5 mb-5 no-print">
        <div class="bg-slate-50 border border-slate-200 rounded-xl p-4">
          <div class="text-[11px] font-bold uppercase text-slate-500">Presupuesto contratado</div>
          <div class="font-display text-xl tabular-nums">{{ mxn(totales.contratado) }}</div>
        </div>
        <div class="bg-slate-50 border border-slate-200 rounded-xl p-4">
          <div class="text-[11px] font-bold uppercase text-slate-500">Valor ejecutado</div>
          <div class="font-display text-xl tabular-nums">{{ mxn(totales.ejecutado) }}</div>
        </div>
        <div class="bg-slate-50 border border-slate-200 rounded-xl p-4">
          <div class="text-[11px] font-bold uppercase text-slate-500">% avance global</div>
          <div class="font-display text-xl tabular-nums">{{ totales.pct.toFixed(1) }}%</div>
        </div>
      </div>

      <table class="w-full text-sm tabular-nums">
        <thead>
          <tr class="text-[11px] uppercase tracking-wide text-slate-500 border-b border-slate-300">
            <th class="text-left py-2 font-normal font-sans">Concepto</th>
            <th class="text-left py-2 font-normal font-sans">Contratado</th>
            <th class="text-left py-2 font-normal font-sans">Ejecutado</th>
            <th class="text-left py-2 font-normal font-sans">% Avance</th>
            <th class="text-left py-2 font-normal font-sans">Importe contratado</th>
            <th class="text-left py-2 font-normal font-sans">Importe ejecutado</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="l in lineas" :key="l.id" class="border-b border-slate-100">
            <td class="py-2 font-sans font-semibold">
              {{ l.clave }} · {{ l.descripcion }}
              <span v-if="l.capitulo" class="block text-[11px] text-slate-400 font-normal">{{ l.capitulo }}</span>
            </td>
            <td class="py-2 font-sans">{{ Number(l.cantidad_contratada).toLocaleString('es-MX') }} {{ l.unidad }}</td>
            <td class="py-2 font-sans">{{ Number(l.cantidad_ejecutada).toLocaleString('es-MX') }} {{ l.unidad }}</td>
            <td class="py-2">{{ pct(l).toFixed(1) }}%</td>
            <td class="py-2">{{ mxn(l.importe_contratado) }}</td>
            <td class="py-2">{{ mxn(l.importe_ejecutado) }}</td>
          </tr>
        </tbody>
        <tfoot>
          <tr class="border-t border-slate-300 font-bold">
            <td class="py-2 font-sans">Total</td>
            <td></td>
            <td></td>
            <td class="py-2">{{ totales.pct.toFixed(1) }}%</td>
            <td class="py-2">{{ mxn(totales.contratado) }}</td>
            <td class="py-2">{{ mxn(totales.ejecutado) }}</td>
          </tr>
        </tfoot>
      </table>
    </div>
  </AppShell>
</template>

<script setup>
import { computed, onMounted, ref, watch } from 'vue';
import AppShell from '../../components/AppShell.vue';
import ReportePrintHeader from '../../components/ReportePrintHeader.vue';
import { api } from '../../lib/api.js';

const obras = ref([]);
const obraId = ref(null);
const lineas = ref([]);

function mxn(n) { return new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN' }).format(n || 0); }
function imprimir() { window.print(); }
function pct(l) {
  const contratada = Number(l.cantidad_contratada);
  return contratada > 0 ? Math.min(100, (Number(l.cantidad_ejecutada) / contratada) * 100) : 0;
}

const obraNombre = computed(() => obras.value.find((o) => o.id === obraId.value)?.nombre ?? '');
const totales = computed(() => {
  const contratado = lineas.value.reduce((s, l) => s + Number(l.importe_contratado), 0);
  const ejecutado = lineas.value.reduce((s, l) => s + Number(l.importe_ejecutado), 0);
  return { contratado, ejecutado, pct: contratado > 0 ? (ejecutado / contratado) * 100 : 0 };
});

async function cargar() {
  if (!obraId.value) return;
  const { data } = await api.get('/reportes/avance-financiero', { params: { obraId: obraId.value } });
  lineas.value = data;
}
watch(obraId, cargar);

onMounted(async () => {
  const { data } = await api.get('/catalogo/obras');
  obras.value = data;
  obraId.value = data[0]?.id ?? null;
  await cargar();
});
</script>
