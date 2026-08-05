<template>
  <AppShell>
    <div class="flex items-center justify-between mb-4 no-print flex-wrap gap-3">
      <h2 class="font-display text-lg">Listado de Requisiciones</h2>
      <div class="flex items-center gap-2">
        <select v-model="estatus" class="text-sm border border-slate-300 rounded-lg px-2.5 py-2" @change="cargar">
          <option value="">Todos los estatus</option>
          <option value="borrador">Borrador</option>
          <option value="pendiente_autorizacion">Pendiente de autorización</option>
          <option value="autorizada">Autorizada</option>
          <option value="atendida_parcial">Atendida parcial</option>
          <option value="atendida_total">Atendida total</option>
          <option value="cancelada">Cancelada</option>
        </select>
        <button class="min-h-[40px] bg-primary text-white text-sm font-bold rounded-lg px-4" @click="imprimir">Imprimir / Guardar PDF</button>
      </div>
    </div>

    <div class="print-sheet bg-white border border-slate-200 rounded-xl p-5">
      <ReportePrintHeader titulo="Listado de Requisiciones" :subtitulo="estatus ? `Estatus: ${estatusTexto(estatus)}` : 'Todos los estatus'" />
      <table class="w-full text-sm tabular-nums">
        <thead>
          <tr class="text-[11px] uppercase tracking-wide text-slate-500 border-b border-slate-300">
            <th class="text-left py-2 font-normal font-sans">Folio</th>
            <th class="text-left py-2 font-normal font-sans">Obra / Frente / Partida</th>
            <th class="text-left py-2 font-normal font-sans">Solicitante</th>
            <th class="text-left py-2 font-normal font-sans">Estatus</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="r in requisiciones" :key="r.id" class="border-b border-slate-100">
            <td class="py-2 font-semibold">{{ r.folio }}<span v-if="r.renglones_excedidos > 0" class="ml-1.5 text-[10px] font-bold text-danger">● excede</span></td>
            <td class="py-2 font-sans">{{ r.obra_nombre }} / {{ r.frente_nombre }} / {{ r.partida_nombre }}</td>
            <td class="py-2 font-sans">{{ r.solicitante_nombre }}</td>
            <td class="py-2 font-sans">{{ estatusTexto(r.estatus) }}</td>
          </tr>
        </tbody>
      </table>
      <p class="text-[10.5px] text-slate-400 mt-4">{{ requisiciones.length }} requisición(es) · documento generado por sistema.</p>
    </div>
  </AppShell>
</template>

<script setup>
import { onMounted, ref } from 'vue';
import AppShell from '../../components/AppShell.vue';
import ReportePrintHeader from '../../components/ReportePrintHeader.vue';
import { api } from '../../lib/api.js';

const requisiciones = ref([]);
const estatus = ref('');

const ESTATUS_TEXTO = {
  borrador: 'Borrador', pendiente_autorizacion: 'Pend. autorización', autorizada: 'Autorizada',
  atendida_parcial: 'Atendida parcial', atendida_total: 'Atendida total', cancelada: 'Cancelada',
};
function estatusTexto(e) { return ESTATUS_TEXTO[e] ?? e; }
function imprimir() { window.print(); }

async function cargar() {
  const { data } = await api.get('/requisiciones', { params: { estatus: estatus.value || undefined } });
  requisiciones.value = data;
}

onMounted(cargar);
</script>
