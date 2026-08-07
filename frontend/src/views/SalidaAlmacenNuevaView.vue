<template>
  <AppShell>
    <h2 class="font-display text-[36px] mb-1">Nueva salida de almacén</h2>
    <p class="text-xs text-slate-500 mb-4">Entrega de material del almacén de obra hacia un frente/cuadrilla.</p>

    <div class="bg-white border border-slate-200 rounded-xl p-4 mb-5 grid sm:grid-cols-3 gap-3 max-w-2xl">
      <div>
        <label class="block text-[11px] font-bold uppercase text-slate-500 mb-1">Obra</label>
        <select v-model.number="obraId" class="w-full border border-slate-300 rounded-lg px-2.5 min-h-[42px]">
          <option v-for="o in obras" :key="o.id" :value="o.id">{{ o.nombre }}</option>
        </select>
      </div>
      <div>
        <label class="block text-[11px] font-bold uppercase text-slate-500 mb-1">Frente destino</label>
        <select v-model.number="frenteId" class="w-full border border-slate-300 rounded-lg px-2.5 min-h-[42px]">
          <option v-for="f in frentes" :key="f.id" :value="f.id">{{ f.nombre }}</option>
        </select>
      </div>
      <div>
        <label class="block text-[11px] font-bold uppercase text-slate-500 mb-1">Recibe (cuadrilla/residente)</label>
        <input v-model="usuarioRecibeNombre" placeholder="Nombre de quien recibe" class="w-full border border-slate-300 rounded-lg px-2.5 min-h-[42px]" />
      </div>
    </div>

    <p v-if="error" class="bg-red-50 border border-danger/30 text-danger text-sm rounded-lg px-4 py-3 mb-4">{{ error }}</p>

    <div v-if="inventario.length" class="overflow-x-auto bg-white border border-slate-200 rounded-xl mb-5">
      <table class="w-full text-sm tabular-nums">
        <thead>
          <tr class="bg-slate-50 text-[11px] uppercase tracking-wide text-slate-500">
            <th class="text-left px-4 py-2.5 font-normal font-sans">Insumo</th>
            <th class="text-left px-4 py-2.5 font-normal font-sans">Existencia</th>
            <th class="text-left px-4 py-2.5 font-normal font-sans">Cant. a entregar</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="ins in inventario" :key="ins.insumo_id" class="border-t border-slate-200" :class="excede(ins) ? 'bg-red-50' : ''">
            <td class="px-4 py-2.5 font-sans font-semibold">{{ ins.clave }} · {{ ins.descripcion }}</td>
            <td class="px-4 py-2.5">{{ ins.existencia }} {{ ins.unidad }}</td>
            <td class="px-4 py-2.5">
              <input v-model.number="cantidades[ins.insumo_id]" type="number" inputmode="decimal" min="0" step="any" class="w-24 border border-slate-300 rounded px-2 py-1.5" />
              <span v-if="excede(ins)" class="ml-2 text-[11px] font-bold text-danger">excede existencia</span>
            </td>
          </tr>
        </tbody>
      </table>
    </div>
    <p v-else-if="obraId" class="text-sm text-slate-400 mb-5">No hay existencia disponible en esta obra todavía.</p>

    <button class="min-h-[48px] bg-primary text-white font-bold rounded-lg px-5 text-sm disabled:opacity-50" :disabled="!puedeGuardar || guardando" @click="guardar">
      {{ guardando ? 'Guardando…' : 'Registrar salida' }}
    </button>
  </AppShell>
</template>

<script setup>
import { computed, onMounted, reactive, ref, watch } from 'vue';
import { useRouter } from 'vue-router';
import AppShell from '../components/AppShell.vue';
import { api } from '../lib/api.js';

const router = useRouter();
const obras = ref([]);
const obraId = ref(null);
const frenteId = ref(null);
const usuarioRecibeNombre = ref('');
const inventario = ref([]);
const cantidades = reactive({});
const error = ref('');
const guardando = ref(false);

const frentes = computed(() => {
  const obra = obras.value.find((o) => o.id === obraId.value);
  return obra?.etapas.flatMap((e) => e.frentes) ?? [];
});

function excede(ins) {
  return Number(cantidades[ins.insumo_id] || 0) > Number(ins.existencia);
}

const puedeGuardar = computed(() => {
  if (!obraId.value || !frenteId.value || !usuarioRecibeNombre.value.trim()) return false;
  const conCantidad = inventario.value.filter((i) => cantidades[i.insumo_id] > 0);
  return conCantidad.length > 0 && conCantidad.every((i) => !excede(i));
});

async function cargarInventario() {
  if (!obraId.value) return;
  const { data } = await api.get('/inventario', { params: { obraId: obraId.value } });
  inventario.value = data;
  for (const k of Object.keys(cantidades)) delete cantidades[k];
}
watch(obraId, () => {
  frenteId.value = frentes.value[0]?.id ?? null;
  cargarInventario();
});

async function guardar() {
  error.value = '';
  guardando.value = true;
  try {
    const detalle = inventario.value
      .filter((i) => cantidades[i.insumo_id] > 0)
      .map((i) => ({ insumoId: i.insumo_id, cantidadEntregada: cantidades[i.insumo_id] }));
    const { data } = await api.post('/salidas-almacen', {
      obraId: obraId.value, frenteId: frenteId.value, usuarioRecibeNombre: usuarioRecibeNombre.value, detalle,
    });
    router.push(`/almacen/salidas/${data.id}`);
  } catch (err) {
    error.value = err.response?.data?.error || 'No se pudo registrar la salida.';
  } finally {
    guardando.value = false;
  }
}

onMounted(async () => {
  const { data } = await api.get('/catalogo/obras');
  obras.value = data;
  obraId.value = data[0]?.id ?? null;
  frenteId.value = frentes.value[0]?.id ?? null;
  await cargarInventario();
});
</script>
