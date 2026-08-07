<template>
  <AppShell>
    <div class="flex items-center justify-between mb-4 flex-wrap gap-3 no-print">
      <h2 class="font-display text-[36px]">Inventario actual de almacén</h2>
      <div class="flex items-center gap-2">
        <select v-model.number="obraId" class="border border-slate-300 rounded-lg px-2.5 min-h-[40px] text-sm">
          <option v-for="o in obras" :key="o.id" :value="o.id">{{ o.nombre }}</option>
        </select>
        <button class="min-h-[39px] bg-primary text-white text-sm font-bold rounded-lg px-4" @click="imprimir">Imprimir / Guardar PDF</button>
      </div>
    </div>

    <div class="print-sheet bg-white border border-slate-200 rounded-xl p-5">
      <ReportePrintHeader titulo="Inventario actual de almacén" :subtitulo="obraNombre" />
      <table class="w-full text-sm tabular-nums">
        <thead>
          <tr class="text-[11px] uppercase tracking-wide text-slate-500 border-b border-slate-300">
            <th class="text-left py-2 font-normal font-sans">Insumo</th>
            <th class="text-left py-2 font-normal font-sans">Entradas</th>
            <th class="text-left py-2 font-normal font-sans">Salidas</th>
            <th class="text-left py-2 font-normal font-sans">Existencia</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="ins in inventario" :key="ins.insumo_id" class="border-b border-slate-100">
            <td class="py-2 font-sans font-semibold">{{ ins.clave }} · {{ ins.descripcion }}</td>
            <td class="py-2">{{ ins.entradas }} {{ ins.unidad }}</td>
            <td class="py-2">{{ ins.salidas }} {{ ins.unidad }}</td>
            <td class="py-2 font-bold" :class="Number(ins.existencia) > 0 ? 'text-success' : 'text-slate-400'">{{ ins.existencia }} {{ ins.unidad }}</td>
          </tr>
          <tr v-if="!cargando && inventario.length === 0">
            <td colspan="4" class="py-8 text-center text-slate-400 text-sm font-sans">Sin movimientos de almacén en esta obra todavía.</td>
          </tr>
        </tbody>
      </table>
    </div>
  </AppShell>
</template>

<script setup>
import { computed, onMounted, ref, watch } from 'vue';
import AppShell from '../components/AppShell.vue';
import ReportePrintHeader from '../components/ReportePrintHeader.vue';
import { api } from '../lib/api.js';

const obras = ref([]);
const obraId = ref(null);
const inventario = ref([]);
const cargando = ref(true);
const obraNombre = computed(() => obras.value.find((o) => o.id === obraId.value)?.nombre ?? '');

function imprimir() {
  window.print();
}

async function cargar() {
  if (!obraId.value) return;
  cargando.value = true;
  const { data } = await api.get('/inventario', { params: { obraId: obraId.value } });
  inventario.value = data;
  cargando.value = false;
}
watch(obraId, cargar);

onMounted(async () => {
  const { data } = await api.get('/catalogo/obras');
  obras.value = data;
  obraId.value = data[0]?.id ?? null;
  await cargar();
});
</script>
