<template>
  <AppShell>
    <div class="flex items-center justify-between mb-4 flex-wrap gap-3">
      <h2 class="text-[32px] font-display">Requisiciones</h2>
      <div class="flex items-center gap-2">
        <select v-model="filtroEstatus" class="text-sm border border-slate-300 rounded-lg px-2.5 py-2" @change="cargar">
          <option value="">Todos los estatus</option>
          <option value="borrador">Borrador</option>
          <option value="pendiente_autorizacion">Pendiente de autorización</option>
          <option value="autorizada">Autorizada</option>
          <option value="atendida_parcial">Atendida parcial</option>
          <option value="atendida_total">Atendida total</option>
          <option value="cancelada">Cancelada</option>
        </select>
        <RouterLink to="/requisiciones/nueva" class="min-h-[30px] flex items-center bg-primary text-white text-[13px] font-bold rounded-lg px-4">
          + Nueva requisición
        </RouterLink>
      </div>
    </div>

    <p v-if="error" class="bg-red-50 border border-danger/30 text-danger text-sm rounded-lg px-4 py-3 mb-4">{{ error }}</p>

    <BorradoresLocalesPanel @sincronizado="cargar" />

    <div class="overflow-x-auto bg-white border border-slate-200 rounded-xl">
      <table class="w-full text-sm">
        <thead>
          <tr class="bg-slate-50 text-[11px] uppercase tracking-wide text-slate-500">
            <th class="text-left px-4 py-2.5 font-normal">Folio</th>
            <th class="text-left px-4 py-2.5 font-normal">Obra / Frente / Partida</th>
            <th class="text-left px-4 py-2.5 font-normal">Solicitante</th>
            <th class="text-left px-4 py-2.5 font-normal">Estatus</th>
            <th class="text-left px-4 py-2.5 font-normal">Acciones</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="r in requisiciones" :key="r.id" class="border-t border-slate-200">
            <td class="px-4 py-2.5 font-semibold tabular-nums">
              <RouterLink :to="`/requisiciones/${r.id}`" class="text-primary underline decoration-primary/30 hover:decoration-primary">{{ r.folio }}</RouterLink>
              <span v-if="r.tipo === 'nomina'" class="ml-1.5 text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-slate-100 text-slate-500">Nómina</span>
              <span v-if="r.renglones_excedidos > 0" class="ml-1.5 text-[10px] font-bold text-danger">● excede</span>
            </td>
            <td class="px-4 py-2.5">{{ r.obra_nombre }} / {{ r.frente_nombre }} / {{ r.partida_nombre }}</td>
            <td class="px-4 py-2.5">{{ r.solicitante_nombre }}</td>
            <td class="px-4 py-2.5">
              <span class="inline-flex text-[11.5px] font-bold px-2.5 py-0.5 rounded-full" :class="estatusClase(r.estatus)">
                {{ estatusTexto(r.estatus) }}
              </span>
            </td>
            <td class="px-4 py-2.5 space-x-2">
              <RouterLink :to="`/requisiciones/${r.id}`" class="text-xs font-semibold text-primary underline">Consultar</RouterLink>
              <RouterLink :to="`/expediente/${r.id}`" class="text-xs font-semibold text-slate-500 underline">Expediente</RouterLink>
              <button
                v-if="r.estatus === 'borrador' && puedeModificar(r)"
                class="text-xs font-semibold text-primary underline"
                @click="accion(r, 'enviar')"
              >
                Enviar a autorizar
              </button>
              <button
                v-if="r.estatus === 'pendiente_autorizacion' && puedeAutorizar"
                class="text-xs font-semibold text-success underline"
                @click="abrirFirma(r)"
              >
                Autorizar
              </button>
              <button
                v-if="!['atendida_parcial', 'atendida_total', 'cancelada'].includes(r.estatus) && puedeModificar(r)"
                class="text-xs font-semibold text-danger underline"
                @click="accion(r, 'cancelar')"
              >
                Cancelar
              </button>
            </td>
          </tr>
          <tr v-if="!cargando && requisiciones.length === 0">
            <td colspan="5" class="px-4 py-8 text-center text-slate-400 text-sm">No hay requisiciones con este filtro.</td>
          </tr>
        </tbody>
      </table>
    </div>

    <FirmaModal v-if="reqAFirmar" :etiqueta="`Autorizando ${reqAFirmar.folio}`" @firmado="autorizarConFirma" @cerrar="reqAFirmar = null" ref="firmaModalRef" />
  </AppShell>
</template>

<script setup>
import { onMounted, ref, computed } from 'vue';
import AppShell from '../components/AppShell.vue';
import FirmaModal from '../components/FirmaModal.vue';
import BorradoresLocalesPanel from '../components/BorradoresLocalesPanel.vue';
import { api } from '../lib/api.js';
import { useAuthStore } from '../stores/auth.js';

const auth = useAuthStore();
const requisiciones = ref([]);
const cargando = ref(true);
const error = ref('');
const filtroEstatus = ref('');

const puedeAutorizar = computed(() => ['superintendente', 'direccion'].includes(auth.rol));
function puedeModificar(r) {
  return r.usuario_solicitante_id === auth.usuario?.id || auth.rol === 'direccion';
}

const ESTATUS_TEXTO = {
  borrador: 'Borrador',
  pendiente_autorizacion: 'Pend. autorización',
  autorizada: 'Autorizada',
  atendida_parcial: 'Atendida parcial',
  atendida_total: 'Atendida total',
  cancelada: 'Cancelada',
};
function estatusTexto(e) {
  return ESTATUS_TEXTO[e] ?? e;
}
function estatusClase(e) {
  if (e === 'autorizada' || e === 'atendida_total') return 'bg-emerald-50 text-success';
  if (e === 'pendiente_autorizacion' || e === 'atendida_parcial') return 'bg-amber-50 text-warning';
  if (e === 'cancelada') return 'bg-slate-100 text-slate-500';
  return 'bg-slate-100 text-slate-600';
}

async function cargar() {
  cargando.value = true;
  error.value = '';
  try {
    const { data } = await api.get('/requisiciones', { params: { estatus: filtroEstatus.value || undefined } });
    requisiciones.value = data;
  } catch (err) {
    error.value = err.response?.data?.error || 'No se pudieron cargar las requisiciones.';
  } finally {
    cargando.value = false;
  }
}

async function accion(req, tipo) {
  try {
    await api.post(`/requisiciones/${req.id}/${tipo}`);
    await cargar();
  } catch (err) {
    error.value = err.response?.data?.error || 'No se pudo completar la acción.';
  }
}

const reqAFirmar = ref(null);
const firmaModalRef = ref(null);

function abrirFirma(req) {
  reqAFirmar.value = req;
}

async function autorizarConFirma(firma) {
  try {
    await api.post(`/requisiciones/${reqAFirmar.value.id}/autorizar`, { firma });
    reqAFirmar.value = null;
    await cargar();
  } catch (err) {
    firmaModalRef.value?.mostrarError(err.response?.data?.error || 'No se pudo autorizar.');
  }
}

onMounted(cargar);
</script>
