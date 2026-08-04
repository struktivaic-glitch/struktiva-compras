<template>
  <AppShell>
    <h2 class="font-display text-lg mb-1">Nuevo cuadro comparativo</h2>
    <p class="text-xs text-slate-500 mb-4">Selecciona la obra y las requisiciones autorizadas que quieres cotizar juntas.</p>

    <div class="bg-white border border-slate-200 rounded-xl p-4 mb-5 max-w-xs">
      <label class="block text-[11px] font-bold uppercase text-slate-500 mb-1">Obra</label>
      <select v-model.number="obraId" class="w-full border border-slate-300 rounded-lg px-2.5 min-h-[42px]">
        <option v-for="o in obras" :key="o.id" :value="o.id">{{ o.nombre }}</option>
      </select>
    </div>

    <p v-if="error" class="bg-red-50 border border-danger/30 text-danger text-sm rounded-lg px-4 py-3 mb-4">{{ error }}</p>

    <div class="overflow-x-auto bg-white border border-slate-200 rounded-xl mb-5">
      <table class="w-full text-sm">
        <thead>
          <tr class="bg-slate-50 text-[11px] uppercase tracking-wide text-slate-500">
            <th class="px-4 py-2.5"></th>
            <th class="text-left px-4 py-2.5 font-normal">Folio</th>
            <th class="text-left px-4 py-2.5 font-normal">Frente / Partida</th>
            <th class="text-left px-4 py-2.5 font-normal">Solicitante</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="r in requisiciones" :key="r.id" class="border-t border-slate-200">
            <td class="px-4 py-2.5"><input type="checkbox" :value="r.id" v-model="seleccionadas" class="w-4 h-4" /></td>
            <td class="px-4 py-2.5 font-semibold tabular-nums">{{ r.folio }}</td>
            <td class="px-4 py-2.5">{{ r.frente_nombre }} / {{ r.partida_nombre }}</td>
            <td class="px-4 py-2.5 text-slate-500">{{ r.solicitante_nombre }}</td>
          </tr>
          <tr v-if="!cargando && requisiciones.length === 0">
            <td colspan="4" class="px-4 py-8 text-center text-slate-400 text-sm">No hay requisiciones autorizadas pendientes de cotizar en esta obra.</td>
          </tr>
        </tbody>
      </table>
    </div>

    <button class="min-h-[48px] bg-primary text-white font-bold rounded-lg px-5 text-sm" :disabled="!seleccionadas.length || creando" @click="crear">
      {{ creando ? 'Creando…' : `Crear cuadro comparativo (${seleccionadas.length})` }}
    </button>
  </AppShell>
</template>

<script setup>
import { onMounted, ref, watch } from 'vue';
import { useRouter } from 'vue-router';
import AppShell from '../components/AppShell.vue';
import { api } from '../lib/api.js';

const router = useRouter();
const obras = ref([]);
const obraId = ref(null);
const requisiciones = ref([]);
const seleccionadas = ref([]);
const cargando = ref(true);
const creando = ref(false);
const error = ref('');

async function cargarRequisiciones() {
  if (!obraId.value) return;
  cargando.value = true;
  const { data } = await api.get('/requisiciones', { params: { estatus: 'autorizada', obraId: obraId.value, sinCotizar: 1 } });
  requisiciones.value = data;
  seleccionadas.value = [];
  cargando.value = false;
}

watch(obraId, cargarRequisiciones);

async function crear() {
  error.value = '';
  creando.value = true;
  try {
    const { data } = await api.post('/cotizaciones', { obraId: obraId.value, requisicionIds: seleccionadas.value });
    router.push(`/cotizaciones/${data.id}`);
  } catch (err) {
    error.value = err.response?.data?.error || 'No se pudo crear el proceso de cotización.';
  } finally {
    creando.value = false;
  }
}

onMounted(async () => {
  const { data } = await api.get('/catalogo/obras');
  obras.value = data;
  obraId.value = data[0]?.id ?? null;
  await cargarRequisiciones();
});
</script>
