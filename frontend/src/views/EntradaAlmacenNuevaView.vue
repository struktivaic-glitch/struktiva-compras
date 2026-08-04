<template>
  <AppShell>
    <h2 class="font-display text-lg mb-1">Nueva entrada de almacén</h2>
    <p class="text-xs text-slate-500 mb-4">Registra el material físico contra la Remisión del Proveedor, amarrado a una Orden de Compra confirmada.</p>

    <div class="bg-white border border-slate-200 rounded-xl p-4 mb-5 grid sm:grid-cols-2 gap-3 max-w-lg">
      <div>
        <label class="block text-[11px] font-bold uppercase text-slate-500 mb-1">Orden de compra confirmada</label>
        <select v-model.number="ocId" class="w-full border border-slate-300 rounded-lg px-2.5 min-h-[42px]">
          <option v-for="o in ordenes" :key="o.id" :value="o.id">{{ o.folio }} — {{ o.proveedor_nombre }}</option>
        </select>
      </div>
      <div>
        <label class="block text-[11px] font-bold uppercase text-slate-500 mb-1">Remisión del proveedor</label>
        <input v-model="remision" placeholder="Folio de remisión" class="w-full border border-slate-300 rounded-lg px-2.5 min-h-[42px]" />
      </div>
    </div>

    <p v-if="error" class="bg-red-50 border border-danger/30 text-danger text-sm rounded-lg px-4 py-3 mb-4">{{ error }}</p>

    <div v-if="oc" class="overflow-x-auto bg-white border border-slate-200 rounded-xl mb-5">
      <table class="w-full text-sm tabular-nums">
        <thead>
          <tr class="bg-slate-50 text-[11px] uppercase tracking-wide text-slate-500">
            <th class="text-left px-4 py-2.5 font-normal font-sans">Insumo</th>
            <th class="text-left px-4 py-2.5 font-normal font-sans">Pedido</th>
            <th class="text-left px-4 py-2.5 font-normal font-sans">Ya recibido</th>
            <th class="text-left px-4 py-2.5 font-normal font-sans">Pendiente</th>
            <th class="text-left px-4 py-2.5 font-normal font-sans">Cant. a recibir</th>
            <th class="text-left px-4 py-2.5 font-normal font-sans">Estado</th>
          </tr>
        </thead>
        <tbody>
          <template v-for="linea in oc.detalle" :key="linea.id">
            <tr :class="excedeTolerancia(linea) ? 'bg-red-50' : ''" class="border-t border-slate-200">
              <td class="px-4 py-2.5 font-sans font-semibold">{{ linea.clave }} · {{ linea.descripcion }}</td>
              <td class="px-4 py-2.5">{{ linea.cantidad_pedida }} {{ linea.unidad }}</td>
              <td class="px-4 py-2.5">{{ linea.cantidad_surtida }} {{ linea.unidad }}</td>
              <td class="px-4 py-2.5">{{ pendiente(linea) }} {{ linea.unidad }}</td>
              <td class="px-4 py-2.5"><input v-model.number="cantidades[linea.insumo_id]" type="number" inputmode="decimal" min="0" step="any" class="w-24 border border-slate-300 rounded px-2 py-1.5" /></td>
              <td class="px-4 py-2.5 font-sans">
                <span v-if="excedeTolerancia(linea)" class="text-[11.5px] font-bold px-2.5 py-0.5 rounded-full bg-red-50 text-danger">Excede tolerancia ({{ linea.tolerancia_recepcion_pct }}%)</span>
                <span v-else class="text-[11.5px] font-bold px-2.5 py-0.5 rounded-full bg-emerald-50 text-success">OK</span>
              </td>
            </tr>
            <tr v-if="excedeTolerancia(linea)" class="border-t border-danger/20">
              <td colspan="6" class="px-4 py-3 bg-red-50 font-sans">
                <template v-if="puedeAutorizar">
                  <label class="flex items-center gap-2 text-xs font-bold text-danger">
                    <input type="checkbox" v-model="autorizaciones[linea.insumo_id]" class="w-4 h-4" />
                    Autorizo este excedente de {{ excedente(linea) }} {{ linea.unidad }} sobre lo pendiente (tolerancia {{ linea.tolerancia_recepcion_pct }}%)
                  </label>
                </template>
                <span v-else class="text-xs text-danger">
                  Excede la tolerancia permitida ({{ linea.tolerancia_recepcion_pct }}%) — requiere autorización de Superintendente o Dirección para continuar.
                </span>
              </td>
            </tr>
          </template>
        </tbody>
      </table>
    </div>

    <button
      class="min-h-[48px] bg-primary text-white font-bold rounded-lg px-5 text-sm disabled:opacity-50"
      :disabled="!puedeGuardar || guardando"
      @click="guardar"
    >
      {{ guardando ? 'Guardando…' : 'Registrar entrada' }}
    </button>
  </AppShell>
</template>

<script setup>
import { computed, onMounted, reactive, ref, watch } from 'vue';
import { useRouter } from 'vue-router';
import AppShell from '../components/AppShell.vue';
import { api } from '../lib/api.js';
import { useAuthStore } from '../stores/auth.js';

const auth = useAuthStore();
const puedeAutorizar = ['superintendente', 'direccion'].includes(auth.rol);
const router = useRouter();

const ordenes = ref([]);
const ocId = ref(null);
const oc = ref(null);
const remision = ref('');
const cantidades = reactive({});
const autorizaciones = reactive({});
const error = ref('');
const guardando = ref(false);

function pendiente(linea) {
  return (Number(linea.cantidad_pedida) - Number(linea.cantidad_surtida)).toFixed(2);
}
function excedente(linea) {
  return Math.max(0, Number(cantidades[linea.insumo_id] || 0) - Number(pendiente(linea))).toFixed(2);
}
function excedeTolerancia(linea) {
  const p = Number(pendiente(linea));
  const exc = Number(excedente(linea));
  const tolAbs = Math.max(0, p) * (Number(linea.tolerancia_recepcion_pct) / 100);
  return exc > tolAbs;
}

const puedeGuardar = computed(() => {
  if (!oc.value || !remision.value.trim()) return false;
  const conCantidad = oc.value.detalle.filter((l) => cantidades[l.insumo_id] > 0);
  if (conCantidad.length === 0) return false;
  return conCantidad.every((l) => !excedeTolerancia(l) || autorizaciones[l.insumo_id]);
});

async function cargarOc() {
  if (!ocId.value) return;
  const { data } = await api.get(`/ordenes-compra/${ocId.value}`);
  oc.value = data;
  for (const k of Object.keys(cantidades)) delete cantidades[k];
  for (const k of Object.keys(autorizaciones)) delete autorizaciones[k];
}
watch(ocId, cargarOc);

async function guardar() {
  error.value = '';
  guardando.value = true;
  try {
    const detalle = oc.value.detalle
      .filter((l) => cantidades[l.insumo_id] > 0)
      .map((l) => ({
        insumoId: l.insumo_id,
        cantidadRecibida: cantidades[l.insumo_id],
        autorizarExcedente: Boolean(autorizaciones[l.insumo_id]),
      }));
    const { data } = await api.post('/entradas-almacen', { ocId: ocId.value, remisionProveedor: remision.value, detalle });
    router.push(`/almacen/entradas/${data.id}`);
  } catch (err) {
    error.value = err.response?.data?.error || 'No se pudo registrar la entrada.';
  } finally {
    guardando.value = false;
  }
}

onMounted(async () => {
  const { data } = await api.get('/ordenes-compra', { params: { estatus: 'confirmada' } });
  ordenes.value = data;
  ocId.value = data[0]?.id ?? null;
  await cargarOc();
});
</script>
