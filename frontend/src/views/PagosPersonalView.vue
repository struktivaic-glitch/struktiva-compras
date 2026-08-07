<template>
  <AppShell>
    <div class="flex items-center justify-between mb-4 flex-wrap gap-3 no-print">
      <div>
        <h2 class="font-display text-[36px]">Pagos a Personal</h2>
        <p class="text-xs text-slate-500">Control interno de gasto de personal — no calcula ISR/IMSS ni sustituye un recibo fiscal.</p>
      </div>
      <div class="flex items-center gap-2">
        <select v-model="estatusFiltro" class="text-sm border border-slate-300 rounded-lg px-2.5 py-2" @change="cargar">
          <option value="">Todos los estatus</option>
          <option value="pendiente">Pendiente</option>
          <option value="pagado">Pagado</option>
        </select>
        <button class="min-h-[39px] bg-primary text-white text-sm font-bold rounded-lg px-4" @click="imprimir">Imprimir / Guardar PDF</button>
      </div>
    </div>

    <form v-if="puedeCapturar" class="bg-white border border-slate-200 rounded-xl p-4 mb-5 grid sm:grid-cols-6 gap-3 items-end no-print" @submit.prevent="crear">
      <div class="sm:col-span-2">
        <label class="block text-[11px] font-bold uppercase text-slate-500 mb-1">Personal</label>
        <select v-model="form.trabajadorId" required class="w-full border border-slate-300 rounded-lg px-2.5 min-h-[42px]" @change="limpiarSugerencia">
          <option :value="null" disabled>Selecciona…</option>
          <option v-for="t in trabajadores" :key="t.id" :value="t.id">{{ t.nombre }}</option>
        </select>
      </div>
      <div>
        <label class="block text-[11px] font-bold uppercase text-slate-500 mb-1">Desde</label>
        <input v-model="form.fechaInicio" type="date" required class="w-full border border-slate-300 rounded-lg px-2.5 min-h-[42px]" @change="limpiarSugerencia" />
      </div>
      <div>
        <label class="block text-[11px] font-bold uppercase text-slate-500 mb-1">Hasta</label>
        <input v-model="form.fechaFin" type="date" required class="w-full border border-slate-300 rounded-lg px-2.5 min-h-[42px]" @change="limpiarSugerencia" />
      </div>
      <div>
        <label class="block text-[11px] font-bold uppercase text-slate-500 mb-1">Concepto</label>
        <input v-model="form.concepto" class="w-full border border-slate-300 rounded-lg px-2.5 min-h-[42px]" />
      </div>
      <button
        type="button"
        class="min-h-[42px] border border-primary text-primary font-bold rounded-lg px-4 text-sm disabled:opacity-50"
        :disabled="!form.trabajadorId || !form.fechaInicio || !form.fechaFin || calculando"
        @click="calcularSugerencia"
      >
        {{ calculando ? 'Calculando…' : 'Calcular sugerencia' }}
      </button>

      <p v-if="sugerencia" class="sm:col-span-6 text-xs text-slate-500 bg-slate-50 rounded-lg px-3 py-2">
        {{ sugerencia.diasTrabajados }} día(s) con entrada registrada en el rango
        <template v-if="sugerencia.salarioReferencia != null">
          · salario de referencia: {{ mxn(sugerencia.salarioReferencia) }} ({{ sugerencia.salarioPeriodo || '—' }})
          · monto sugerido: <b>{{ mxn(sugerencia.montoSugerido) }}</b> (editable abajo)
        </template>
        <template v-else> · sin salario de referencia capturado en el expediente — captura el monto manualmente.</template>
      </p>

      <div>
        <label class="block text-[11px] font-bold uppercase text-slate-500 mb-1">Días trabajados</label>
        <input v-model.number="form.diasTrabajados" type="number" min="0" step="0.5" class="w-full border border-slate-300 rounded-lg px-2.5 min-h-[42px]" />
      </div>
      <div>
        <label class="block text-[11px] font-bold uppercase text-slate-500 mb-1">Monto</label>
        <input v-model.number="form.monto" type="number" min="0.01" step="0.01" required class="w-full border border-slate-300 rounded-lg px-2.5 min-h-[42px]" />
      </div>
      <div class="sm:col-span-2">
        <label class="block text-[11px] font-bold uppercase text-slate-500 mb-1">Notas (opcional)</label>
        <input v-model="form.notas" class="w-full border border-slate-300 rounded-lg px-2.5 min-h-[42px]" />
      </div>
      <button type="submit" class="min-h-[42px] bg-primary text-white font-bold rounded-lg px-5 text-sm sm:col-span-2" :disabled="guardando">
        {{ guardando ? 'Guardando…' : '+ Registrar pago' }}
      </button>
    </form>

    <p v-if="error" class="bg-red-50 border border-danger/30 text-danger text-sm rounded-lg px-4 py-3 mb-4 no-print">{{ error }}</p>
    <p v-if="mensaje" class="bg-emerald-50 border border-success/30 text-success text-sm rounded-lg px-4 py-3 mb-4 no-print">{{ mensaje }}</p>

    <div class="print-sheet bg-white border border-slate-200 rounded-xl overflow-x-auto">
      <ReportePrintHeader titulo="Pagos a Personal" :subtitulo="estatusFiltro ? `Estatus: ${ESTATUS_TEXTO[estatusFiltro]}` : 'Todos los estatus'" class="p-5 pb-0" />
      <table class="w-full text-sm tabular-nums">
        <thead>
          <tr class="bg-slate-50 text-[11px] uppercase tracking-wide text-slate-500">
            <th class="text-left px-4 py-2.5 font-normal">Personal</th>
            <th class="text-left px-4 py-2.5 font-normal">Concepto</th>
            <th class="text-left px-4 py-2.5 font-normal">Fechas</th>
            <th class="text-left px-4 py-2.5 font-normal">Días</th>
            <th class="text-left px-4 py-2.5 font-normal">Monto</th>
            <th class="text-left px-4 py-2.5 font-normal">Estatus</th>
            <th v-if="puedeCapturar" class="text-left px-4 py-2.5 font-normal no-print">Acciones</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="p in pagos" :key="p.id" class="border-t border-slate-200">
            <td class="px-4 py-2.5 font-semibold">{{ p.trabajador_nombre }}</td>
            <td class="px-4 py-2.5">{{ p.concepto }}</td>
            <td class="px-4 py-2.5">{{ formatoFecha(p.fecha_inicio) }} — {{ formatoFecha(p.fecha_fin) }}</td>
            <td class="px-4 py-2.5">{{ p.dias_trabajados ?? '—' }}</td>
            <td class="px-4 py-2.5 font-semibold">{{ mxn(p.monto) }}</td>
            <td class="px-4 py-2.5">
              <span class="inline-flex text-[11.5px] font-bold px-2.5 py-0.5 rounded-full" :class="p.estatus === 'pagado' ? 'bg-emerald-50 text-success' : 'bg-amber-50 text-warning'">
                {{ ESTATUS_TEXTO[p.estatus] }}
              </span>
              <div v-if="p.estatus === 'pagado'" class="text-[11px] text-slate-400 mt-0.5">{{ p.pagado_por_nombre }} · {{ formatoFecha(p.fecha_pago) }}</div>
            </td>
            <td v-if="puedeCapturar" class="px-4 py-2.5 space-x-2 no-print">
              <template v-if="p.estatus === 'pendiente'">
                <button v-if="auth.rol === 'direccion'" class="text-xs font-semibold text-success underline" @click="marcarPagado(p)">Marcar pagado</button>
                <button class="text-xs font-semibold text-danger underline" @click="cancelar(p)">Cancelar</button>
              </template>
            </td>
          </tr>
          <tr v-if="!pagos.length">
            <td :colspan="puedeCapturar ? 7 : 6" class="px-4 py-8 text-center text-slate-400 text-sm">Sin pagos registrados.</td>
          </tr>
        </tbody>
        <tfoot v-if="pagos.length">
          <tr class="border-t border-slate-300 font-bold">
            <td class="px-4 py-2.5" colspan="4">Total</td>
            <td class="px-4 py-2.5">{{ mxn(totalPagos) }}</td>
            <td :colspan="puedeCapturar ? 2 : 1"></td>
          </tr>
        </tfoot>
      </table>
    </div>
  </AppShell>
</template>

<script setup>
import { computed, onMounted, reactive, ref } from 'vue';
import AppShell from '../components/AppShell.vue';
import ReportePrintHeader from '../components/ReportePrintHeader.vue';
import { api } from '../lib/api.js';
import { useAuthStore } from '../stores/auth.js';

const auth = useAuthStore();
const puedeCapturar = ['residente', 'superintendente', 'direccion'].includes(auth.rol);

const ESTATUS_TEXTO = { pendiente: 'Pendiente', pagado: 'Pagado' };

const pagos = ref([]);
const trabajadores = ref([]);
const estatusFiltro = ref('');
const error = ref('');
const mensaje = ref('');
const guardando = ref(false);
const calculando = ref(false);
const sugerencia = ref(null);

const form = reactive({ trabajadorId: null, fechaInicio: '', fechaFin: '', concepto: 'Pago de personal', diasTrabajados: null, monto: null, notas: '' });

const totalPagos = computed(() => pagos.value.reduce((acc, p) => acc + Number(p.monto), 0));

function imprimir() {
  window.print();
}
function mxn(n) {
  return new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN' }).format(n || 0);
}
function formatoFecha(fecha) {
  if (!fecha) return '—';
  return new Date(fecha).toLocaleDateString('es-MX', { day: '2-digit', month: 'short', year: 'numeric', timeZone: 'UTC' });
}
function limpiarSugerencia() {
  sugerencia.value = null;
}

async function calcularSugerencia() {
  calculando.value = true;
  error.value = '';
  try {
    const { data } = await api.get('/pagos-personal/sugerencia', {
      params: { trabajadorId: form.trabajadorId, desde: form.fechaInicio, hasta: form.fechaFin },
    });
    sugerencia.value = data;
    form.diasTrabajados = data.diasTrabajados;
    if (data.montoSugerido != null) form.monto = data.montoSugerido;
  } catch (err) {
    error.value = err.response?.data?.error || 'No se pudo calcular la sugerencia.';
  } finally {
    calculando.value = false;
  }
}

async function cargar() {
  const { data } = await api.get('/pagos-personal', { params: { estatus: estatusFiltro.value || undefined } });
  pagos.value = data;
}

async function crear() {
  error.value = '';
  mensaje.value = '';
  guardando.value = true;
  try {
    await api.post('/pagos-personal', form);
    Object.assign(form, { trabajadorId: null, fechaInicio: '', fechaFin: '', concepto: 'Pago de personal', diasTrabajados: null, monto: null, notas: '' });
    sugerencia.value = null;
    mensaje.value = 'Pago registrado.';
    await cargar();
  } catch (err) {
    error.value = err.response?.data?.error || 'No se pudo registrar el pago.';
  } finally {
    guardando.value = false;
  }
}

async function marcarPagado(p) {
  error.value = '';
  try {
    await api.post(`/pagos-personal/${p.id}/marcar-pagado`, {});
    await cargar();
  } catch (err) {
    error.value = err.response?.data?.error || 'No se pudo marcar como pagado.';
  }
}

async function cancelar(p) {
  if (!window.confirm(`¿Cancelar el pago pendiente de ${p.trabajador_nombre} (${mxn(p.monto)})?`)) return;
  error.value = '';
  try {
    await api.delete(`/pagos-personal/${p.id}`);
    await cargar();
  } catch (err) {
    error.value = err.response?.data?.error || 'No se pudo cancelar.';
  }
}

onMounted(async () => {
  const { data } = await api.get('/trabajadores');
  trabajadores.value = data;
  await cargar();
});
</script>
