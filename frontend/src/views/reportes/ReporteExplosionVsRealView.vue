<template>
  <AppShell>
    <div class="flex items-center justify-between mb-4 no-print flex-wrap gap-3">
      <h2 class="font-display text-lg">Explosión vs. Real</h2>
      <div class="flex items-center gap-2">
        <select v-model.number="obraId" class="text-sm border border-slate-300 rounded-lg px-2.5 py-2">
          <option v-for="o in obras" :key="o.id" :value="o.id">{{ o.nombre }}</option>
        </select>
        <button class="min-h-[40px] bg-primary text-white text-sm font-bold rounded-lg px-4" @click="imprimir">Imprimir / Guardar PDF</button>
      </div>
    </div>

    <div class="print-sheet bg-white border border-slate-200 rounded-xl p-5 overflow-x-auto">
      <ReportePrintHeader titulo="Explosión vs. Real" :subtitulo="obraNombre" />
      <table class="w-full text-sm tabular-nums">
        <thead>
          <tr class="text-[11px] uppercase tracking-wide text-slate-500 border-b border-slate-300">
            <th class="text-left py-2 font-normal font-sans">Insumo</th>
            <th class="text-left py-2 font-normal font-sans">Presupuestado</th>
            <th class="text-left py-2 font-normal font-sans">Requerido</th>
            <th class="text-left py-2 font-normal font-sans">Comprado</th>
            <th class="text-left py-2 font-normal font-sans">Recibido</th>
            <th class="text-left py-2 font-normal font-sans">Facturado</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="l in lineas" :key="l.insumo_id" class="border-b border-slate-100">
            <td class="py-2 font-sans font-semibold">{{ l.clave }} · {{ l.descripcion }}</td>
            <td class="py-2">{{ mxn(l.presupuestado) }}</td>
            <td class="py-2">{{ mxn(l.importe_requerido) }}</td>
            <td class="py-2">{{ mxn(l.importe_comprado) }}</td>
            <td class="py-2 font-sans">{{ l.cant_recibida }} {{ l.unidad }}</td>
            <td class="py-2">{{ mxn(l.importe_facturado) }}</td>
          </tr>
        </tbody>
        <tfoot>
          <tr class="border-t border-slate-300 font-bold">
            <td class="py-2 font-sans">Total</td>
            <td class="py-2">{{ mxn(totales.presupuestado) }}</td>
            <td class="py-2">{{ mxn(totales.requerido) }}</td>
            <td class="py-2">{{ mxn(totales.comprado) }}</td>
            <td></td>
            <td class="py-2">{{ mxn(totales.facturado) }}</td>
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

const obraNombre = computed(() => obras.value.find((o) => o.id === obraId.value)?.nombre ?? '');
const totales = computed(() => ({
  presupuestado: lineas.value.reduce((s, l) => s + Number(l.presupuestado), 0),
  requerido: lineas.value.reduce((s, l) => s + Number(l.importe_requerido), 0),
  comprado: lineas.value.reduce((s, l) => s + Number(l.importe_comprado), 0),
  facturado: lineas.value.reduce((s, l) => s + Number(l.importe_facturado), 0),
}));

async function cargar() {
  if (!obraId.value) return;
  const { data } = await api.get('/reportes/explosion-vs-real', { params: { obraId: obraId.value } });
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
