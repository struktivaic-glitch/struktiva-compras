<template>
  <AppShell>
    <div class="flex items-center justify-between mb-4 no-print flex-wrap gap-3">
      <h2 class="font-display text-lg">Variación de precios</h2>
      <div class="flex items-center gap-2">
        <select v-model.number="obraId" class="text-sm border border-slate-300 rounded-lg px-2.5 py-2">
          <option v-for="o in obras" :key="o.id" :value="o.id">{{ o.nombre }}</option>
        </select>
        <button class="min-h-[40px] bg-primary text-white text-sm font-bold rounded-lg px-4" @click="window.print()">Imprimir / Guardar PDF</button>
      </div>
    </div>

    <div class="print-sheet bg-white border border-slate-200 rounded-xl p-5 overflow-x-auto">
      <ReportePrintHeader titulo="Variación de precios" :subtitulo="obraNombre" />
      <table class="w-full text-sm tabular-nums">
        <thead>
          <tr class="text-[11px] uppercase tracking-wide text-slate-500 border-b border-slate-300">
            <th class="text-left py-2 font-normal font-sans">Insumo</th>
            <th class="text-left py-2 font-normal font-sans">OC</th>
            <th class="text-left py-2 font-normal font-sans">Proveedor</th>
            <th class="text-left py-2 font-normal font-sans">Costo presupuesto</th>
            <th class="text-left py-2 font-normal font-sans">Costo real</th>
            <th class="text-left py-2 font-normal font-sans">Variación</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="l in lineas" :key="l.oc_folio + l.insumo_id" class="border-b border-slate-100">
            <td class="py-2 font-sans font-semibold">{{ l.clave }} · {{ l.descripcion }}</td>
            <td class="py-2 font-sans">{{ l.oc_folio }}</td>
            <td class="py-2 font-sans">{{ l.proveedor_nombre }}</td>
            <td class="py-2">{{ mxn(l.costo_presupuesto) }}</td>
            <td class="py-2">{{ mxn(l.costo_real) }}</td>
            <td class="py-2 font-bold" :class="Number(l.variacion_absoluta) > 0 ? 'text-danger' : 'text-success'">
              {{ mxn(l.variacion_absoluta) }} ({{ Number(l.variacion_pct).toFixed(1) }}%)
            </td>
          </tr>
          <tr v-if="lineas.length === 0">
            <td colspan="6" class="py-6 text-center text-slate-400 text-xs font-sans">Sin compras registradas todavía en esta obra.</td>
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

const obras = ref([]);
const obraId = ref(null);
const lineas = ref([]);

function mxn(n) { return new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN' }).format(n || 0); }
const obraNombre = computed(() => obras.value.find((o) => o.id === obraId.value)?.nombre ?? '');

async function cargar() {
  if (!obraId.value) return;
  const { data } = await api.get('/reportes/variacion-precios', { params: { obraId: obraId.value } });
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
