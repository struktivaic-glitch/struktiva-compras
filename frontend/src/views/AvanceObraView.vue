<template>
  <AppShell>
    <div class="flex items-center justify-between mb-1 flex-wrap gap-3">
      <h2 class="font-display text-[36px]">Avance de Obra</h2>
      <select v-model.number="obraId" class="text-sm border border-slate-300 rounded-lg px-2.5 py-2">
        <option v-for="o in obras" :key="o.id" :value="o.id">{{ o.nombre }}</option>
      </select>
    </div>
    <p class="text-xs text-slate-500 mb-4">
      Avance físico y financiero por concepto del presupuesto general. Si un avance supera lo contratado, queda
      pendiente de autorización de Superintendencia/Dirección antes de contarse.
    </p>

    <p v-if="error" class="bg-red-50 border border-danger/30 text-danger text-sm rounded-lg px-4 py-3 mb-4">{{ error }}</p>
    <p v-if="aviso" class="bg-emerald-50 border border-success/30 text-success text-sm rounded-lg px-4 py-3 mb-4">{{ aviso }}</p>

    <template v-if="pendientes.length">
      <h3 class="text-sm font-display mb-2">Pendientes de autorización ({{ pendientes.length }})</h3>
      <div class="bg-amber-50 border border-warning/30 rounded-xl mb-6 divide-y divide-warning/20">
        <div v-for="p in pendientes" :key="p.id" class="px-4 py-3 flex items-center justify-between gap-3 flex-wrap">
          <div class="text-sm">
            <span class="font-semibold">{{ p.clave }} · {{ p.descripcion }}</span>
            <span class="text-slate-500"> — {{ Number(p.cantidad_ejecutada).toLocaleString('es-MX') }} {{ p.unidad }}
              (contratado: {{ Number(p.cantidad_contratada).toLocaleString('es-MX') }})</span>
            <p class="text-xs text-slate-500 mt-0.5">Justificación: {{ p.justificacion }}</p>
            <p class="text-[11px] text-slate-400">Registró: {{ p.registrado_por_nombre }} · {{ formatoFecha(p.creado_en) }}</p>
          </div>
          <button v-if="puedeAutorizar" class="min-h-[36px] bg-primary text-white text-xs font-bold rounded-lg px-3 flex-none" @click="abrirFirma(p)">
            Autorizar
          </button>
        </div>
      </div>
    </template>

    <div class="overflow-x-auto bg-white border border-slate-200 rounded-xl">
      <table class="w-full text-sm tabular-nums">
        <thead>
          <tr class="bg-slate-50 text-[11px] uppercase tracking-wide text-slate-500">
            <th class="text-left px-4 py-2.5 font-normal font-sans">Concepto</th>
            <th class="text-left px-4 py-2.5 font-normal font-sans">Contratado</th>
            <th class="text-left px-4 py-2.5 font-normal font-sans">Ejecutado</th>
            <th class="text-left px-4 py-2.5 font-normal font-sans">% Avance</th>
            <th class="text-left px-4 py-2.5 font-normal font-sans">Importe ejecutado</th>
            <th class="text-left px-4 py-2.5 font-normal font-sans"></th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="c in conceptos" :key="c.id" class="border-t border-slate-200">
            <td class="px-4 py-2.5 font-sans">
              <span class="font-semibold">{{ c.clave }} · {{ c.descripcion }}</span>
              <span v-if="c.capitulo" class="block text-[11px] text-slate-400">{{ c.capitulo }}</span>
              <span v-if="Number(c.cantidad_pendiente) > 0" class="block text-[11px] font-bold text-warning">
                +{{ Number(c.cantidad_pendiente).toLocaleString('es-MX') }} {{ c.unidad }} pendiente de autorizar
              </span>
            </td>
            <td class="px-4 py-2.5">{{ Number(c.cantidad_contratada).toLocaleString('es-MX') }} {{ c.unidad }}</td>
            <td class="px-4 py-2.5">{{ Number(c.cantidad_ejecutada).toLocaleString('es-MX') }} {{ c.unidad }}</td>
            <td class="px-4 py-2.5">
              <div class="w-24 h-1.5 bg-slate-100 rounded-full overflow-hidden">
                <div class="h-full bg-success" :style="{ width: c.pct_avance + '%' }"></div>
              </div>
              <span class="text-[11px] text-slate-500">{{ c.pct_avance.toFixed(1) }}%</span>
            </td>
            <td class="px-4 py-2.5">{{ mxn(c.importe_ejecutado) }} <span class="text-[11px] text-slate-400">/ {{ mxn(c.importe_contratado) }}</span></td>
            <td class="px-4 py-2.5">
              <button class="text-xs font-semibold text-primary underline" @click="abrirCaptura(c)">+ Avance</button>
            </td>
          </tr>
          <tr v-if="!cargando && !conceptos.length">
            <td colspan="6" class="px-4 py-8 text-center text-slate-400 text-sm">
              Esta obra no tiene conceptos del presupuesto general todavía. Impórtalos desde "Importar Presupuesto General".
            </td>
          </tr>
        </tbody>
      </table>
    </div>

    <!-- Modal de captura de avance -->
    <div v-if="conceptoCaptura" class="fixed inset-0 bg-black/40 flex items-center justify-center z-50 px-4" @click.self="conceptoCaptura = null">
      <div class="bg-white rounded-xl shadow-xl w-full max-w-sm p-5">
        <h3 class="font-display text-base mb-1">{{ conceptoCaptura.clave }} · {{ conceptoCaptura.descripcion }}</h3>
        <p class="text-xs text-slate-500 mb-4">
          Ejecutado a la fecha: {{ Number(conceptoCaptura.cantidad_ejecutada).toLocaleString('es-MX') }} {{ conceptoCaptura.unidad }}
          de {{ Number(conceptoCaptura.cantidad_contratada).toLocaleString('es-MX') }} contratado.
        </p>

        <p v-if="errorCaptura" class="bg-red-50 border border-danger/30 text-danger text-xs rounded-lg px-3 py-2 mb-3">{{ errorCaptura }}</p>

        <label class="block text-[11px] font-bold uppercase text-slate-500 mb-1">Fecha</label>
        <input v-model="captura.fecha" type="date" class="w-full border border-slate-300 rounded-lg px-2.5 min-h-[42px] mb-3" />

        <label class="block text-[11px] font-bold uppercase text-slate-500 mb-1">Cantidad ejecutada ({{ conceptoCaptura.unidad }})</label>
        <input v-model.number="captura.cantidadEjecutada" type="number" inputmode="decimal" min="0" step="any" class="w-full border border-slate-300 rounded-lg px-2.5 min-h-[42px] mb-3" />

        <div v-if="excedeCaptura" class="bg-amber-50 border border-warning/30 text-warning text-xs rounded-lg px-3 py-2 mb-3">
          El acumulado quedaría en {{ acumuladoProyectado.toLocaleString('es-MX') }} {{ conceptoCaptura.unidad }}, arriba de lo contratado
          ({{ Number(conceptoCaptura.cantidad_contratada).toLocaleString('es-MX') }}). Necesita justificación y autorización de
          Superintendencia/Dirección antes de contar en el avance oficial.
        </div>
        <template v-if="excedeCaptura">
          <label class="block text-[11px] font-bold uppercase text-slate-500 mb-1">Justificación técnica</label>
          <textarea v-model="captura.justificacion" rows="2" class="w-full border border-slate-300 rounded-lg px-2.5 py-2 mb-3 text-sm"></textarea>
        </template>

        <label class="block text-[11px] font-bold uppercase text-slate-500 mb-1">Notas (opcional)</label>
        <textarea v-model="captura.notas" rows="2" class="w-full border border-slate-300 rounded-lg px-2.5 py-2 mb-4 text-sm"></textarea>

        <div class="flex gap-2">
          <button class="flex-1 min-h-[44px] border border-slate-300 rounded-lg text-sm font-semibold" @click="conceptoCaptura = null">Cancelar</button>
          <button
            class="flex-1 min-h-[44px] bg-primary text-white rounded-lg text-sm font-bold disabled:opacity-50"
            :disabled="!puedeGuardarCaptura || guardandoCaptura"
            @click="guardarCaptura"
          >
            {{ guardandoCaptura ? 'Guardando…' : 'Registrar avance' }}
          </button>
        </div>
      </div>
    </div>

    <FirmaModal v-if="pendienteAFirmar" :etiqueta="`Autorizar avance de ${pendienteAFirmar.clave}`" @firmado="autorizarConFirma" @cerrar="pendienteAFirmar = null" ref="firmaModalRef" />
  </AppShell>
</template>

<script setup>
import { computed, onMounted, reactive, ref, watch } from 'vue';
import AppShell from '../components/AppShell.vue';
import FirmaModal from '../components/FirmaModal.vue';
import { api } from '../lib/api.js';
import { useAuthStore } from '../stores/auth.js';

const auth = useAuthStore();
const puedeAutorizar = ['superintendente', 'direccion'].includes(auth.rol);

const obras = ref([]);
const obraId = ref(null);
const conceptos = ref([]);
const pendientes = ref([]);
const cargando = ref(false);
const error = ref('');
const aviso = ref('');

function mxn(n) {
  return new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN' }).format(n || 0);
}
function formatoFecha(fecha) {
  return new Date(fecha).toLocaleString('es-MX', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}

async function cargar() {
  if (!obraId.value) return;
  cargando.value = true;
  try {
    const [{ data: c }, { data: p }] = await Promise.all([
      api.get('/avance-obra/conceptos', { params: { obraId: obraId.value } }),
      api.get('/avance-obra/pendientes', { params: { obraId: obraId.value } }),
    ]);
    conceptos.value = c;
    pendientes.value = p;
  } catch (err) {
    error.value = err.response?.data?.error || 'No se pudo cargar el avance de obra.';
  } finally {
    cargando.value = false;
  }
}
watch(obraId, cargar);

// --- Captura de avance ---
const conceptoCaptura = ref(null);
const captura = reactive({ fecha: '', cantidadEjecutada: null, justificacion: '', notas: '' });
const errorCaptura = ref('');
const guardandoCaptura = ref(false);

function abrirCaptura(concepto) {
  conceptoCaptura.value = concepto;
  captura.fecha = new Date().toISOString().slice(0, 10);
  captura.cantidadEjecutada = null;
  captura.justificacion = '';
  captura.notas = '';
  errorCaptura.value = '';
}

const acumuladoProyectado = computed(() => {
  if (!conceptoCaptura.value) return 0;
  return Number(conceptoCaptura.value.cantidad_ejecutada) + Number(conceptoCaptura.value.cantidad_pendiente) + Number(captura.cantidadEjecutada || 0);
});
const excedeCaptura = computed(() => {
  if (!conceptoCaptura.value || !captura.cantidadEjecutada) return false;
  return acumuladoProyectado.value > Number(conceptoCaptura.value.cantidad_contratada);
});
const puedeGuardarCaptura = computed(() => {
  if (!captura.cantidadEjecutada || captura.cantidadEjecutada <= 0) return false;
  if (excedeCaptura.value && !captura.justificacion.trim()) return false;
  return true;
});

async function guardarCaptura() {
  errorCaptura.value = '';
  guardandoCaptura.value = true;
  try {
    const { data } = await api.post(`/avance-obra/conceptos/${conceptoCaptura.value.id}/avance`, {
      fecha: captura.fecha, cantidadEjecutada: captura.cantidadEjecutada,
      justificacion: captura.justificacion || undefined, notas: captura.notas || undefined,
    });
    conceptoCaptura.value = null;
    aviso.value = data.estatus === 'pendiente_autorizacion'
      ? 'Avance registrado — queda pendiente de autorización porque supera lo contratado.'
      : 'Avance registrado.';
    await cargar();
  } catch (err) {
    errorCaptura.value = err.response?.data?.error || 'No se pudo registrar el avance.';
  } finally {
    guardandoCaptura.value = false;
  }
}

// --- Autorización de pendientes ---
const pendienteAFirmar = ref(null);
const firmaModalRef = ref(null);

function abrirFirma(p) {
  pendienteAFirmar.value = p;
}

async function autorizarConFirma(firma) {
  try {
    await api.post(`/avance-obra/avance/${pendienteAFirmar.value.id}/autorizar`, { firma });
    pendienteAFirmar.value = null;
    aviso.value = 'Avance autorizado.';
    await cargar();
  } catch (err) {
    firmaModalRef.value?.mostrarError(err.response?.data?.error || 'No se pudo autorizar.');
  }
}

onMounted(async () => {
  const { data } = await api.get('/catalogo/obras');
  obras.value = data;
  obraId.value = data[0]?.id ?? null;
});
</script>
