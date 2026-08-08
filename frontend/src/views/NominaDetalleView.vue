<template>
  <AppShell>
    <div v-if="!nomina" class="text-sm text-slate-500">Cargando…</div>
    <template v-else>
      <BotonVolver fallback="/pagos-personal" />
      <div class="flex items-center justify-between flex-wrap gap-3 mb-1 no-print">
        <div>
          <h2 class="font-display text-[36px]">{{ nomina.folio }}</h2>
          <p class="text-xs text-slate-500">
            {{ nomina.periodo_tipo === 'semanal' ? 'Semanal' : 'Quincenal' }} · {{ formatoFecha(nomina.fecha_inicio) }} — {{ formatoFecha(nomina.fecha_fin) }} ·
            Generó: {{ nomina.genero_nombre }}
          </p>
        </div>
        <div class="flex items-center gap-2">
          <span class="inline-flex text-[11.5px] font-bold px-2.5 py-0.5 rounded-full" :class="estatusClase(nomina.estatus)">{{ ESTATUS_TEXTO[nomina.estatus] }}</span>
          <button class="min-h-[39px] bg-primary text-white text-sm font-bold rounded-lg px-4" @click="imprimir">Imprimir / Guardar PDF</button>
        </div>
      </div>

      <p v-if="error" class="bg-red-50 border border-danger/30 text-danger text-sm rounded-lg px-4 py-3 my-4 no-print">{{ error }}</p>

      <div class="print-sheet bg-white border border-slate-200 rounded-xl p-5 my-5">
        <ReportePrintHeader :titulo="`Nómina ${nomina.folio}`" :subtitulo="`${nomina.periodo_tipo === 'semanal' ? 'Semanal' : 'Quincenal'} · ${formatoFecha(nomina.fecha_inicio)} — ${formatoFecha(nomina.fecha_fin)} · Estatus: ${ESTATUS_TEXTO[nomina.estatus]}`" />

        <div v-if="nomina.estatus === 'pagada'" class="text-xs text-slate-600 mb-4">
          Pagada el {{ formatoFecha(nomina.fecha_pago) }} por <b>{{ nomina.pagado_por_nombre }}</b> · Forma de pago: {{ FORMAS_PAGO_TEXTO[nomina.forma_pago] || nomina.forma_pago }}
        </div>

        <table class="w-full text-sm tabular-nums">
          <thead>
            <tr class="bg-slate-50 text-[11px] uppercase tracking-wide text-slate-500">
              <th class="text-left px-4 py-2.5 font-normal font-sans">Persona</th>
              <th class="text-left px-4 py-2.5 font-normal font-sans">Sueldo diario</th>
              <th class="text-left px-4 py-2.5 font-normal font-sans">Días</th>
              <th class="text-left px-4 py-2.5 font-normal font-sans">Compensación</th>
              <th class="text-left px-4 py-2.5 font-normal font-sans">Descuento</th>
              <th class="text-left px-4 py-2.5 font-normal font-sans">Total</th>
            </tr>
          </thead>
          <tbody>
            <template v-for="d in nomina.detalle" :key="d.id">
              <tr class="border-t border-slate-200">
                <td class="px-4 py-2.5 font-sans font-semibold">{{ d.trabajador_nombre }}<span v-if="d.oficio" class="text-slate-400 font-normal"> · {{ d.oficio }}</span></td>
                <td class="px-4 py-2.5">{{ mxn(d.sueldo_diario) }}</td>
                <td class="px-4 py-2.5">{{ d.dias_trabajados }}<span v-if="d.usar_asistencia" class="text-[10px] text-slate-400"> (asist.)</span></td>
                <td class="px-4 py-2.5">
                  {{ d.compensacion > 0 ? mxn(d.compensacion) : '—' }}
                  <span v-if="d.compensacion_concepto" class="block text-[10.5px] text-slate-400 font-sans">{{ d.compensacion_concepto }}</span>
                </td>
                <td class="px-4 py-2.5">{{ d.descuento > 0 ? mxn(d.descuento) : '—' }}</td>
                <td class="px-4 py-2.5 font-semibold">{{ mxn(d.monto_total) }}</td>
              </tr>
              <tr v-if="d.descuento_motivo" class="border-t border-slate-100 bg-amber-50/40">
                <td colspan="6" class="px-4 py-2 text-xs text-slate-600 font-sans"><b>Motivo del descuento:</b> {{ d.descuento_motivo }}</td>
              </tr>
              <tr v-if="d.duplicado_justificacion" class="border-t border-slate-100 bg-red-50/40">
                <td colspan="6" class="px-4 py-2 text-xs text-slate-600 font-sans"><b>Justificación (persona ya estaba en otra nómina del periodo):</b> {{ d.duplicado_justificacion }}</td>
              </tr>
            </template>
          </tbody>
          <tfoot>
            <tr class="border-t border-slate-300 font-bold">
              <td class="px-4 py-2.5 font-sans" colspan="5">Total de la nómina</td>
              <td class="px-4 py-2.5">{{ mxn(totalNomina) }}</td>
            </tr>
          </tfoot>
        </table>
      </div>

      <div v-if="nomina.estatus === 'borrador'" class="flex gap-2.5 no-print">
        <button v-if="auth.rol === 'direccion'" class="min-h-[48px] bg-primary text-white rounded-lg px-5 font-bold text-sm" @click="pagoAbierto = true">
          Marcar pagada
        </button>
        <button class="min-h-[48px] border-[1.5px] border-danger text-danger rounded-lg px-5 font-bold text-sm" @click="cancelar">
          Cancelar nómina
        </button>
      </div>

      <div v-if="pagoAbierto" class="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4" @click.self="pagoAbierto = false">
        <div class="bg-white rounded-xl p-5 w-full max-w-sm">
          <h3 class="text-sm font-display mb-1">Marcar nómina pagada</h3>
          <p class="text-xs text-slate-500 mb-4">{{ nomina.folio }} · {{ mxn(totalNomina) }}</p>
          <label class="block text-[11px] font-bold uppercase text-slate-500 mb-1">Forma de pago</label>
          <select v-model="formaPago" class="w-full border border-slate-300 rounded-lg px-2.5 min-h-[42px] mb-4">
            <option value="" disabled>Selecciona…</option>
            <option v-for="f in FORMAS_PAGO" :key="f.clave" :value="f.clave">{{ f.label }}</option>
          </select>
          <div class="flex gap-2 justify-end">
            <button class="min-h-[42px] border border-slate-300 text-slate-600 font-bold rounded-lg px-4 text-sm" @click="pagoAbierto = false">Cancelar</button>
            <button class="min-h-[42px] bg-primary text-white font-bold rounded-lg px-4 text-sm disabled:opacity-50" :disabled="!formaPago || marcando" @click="marcarPagada">
              {{ marcando ? 'Guardando…' : 'Confirmar' }}
            </button>
          </div>
        </div>
      </div>
    </template>
  </AppShell>
</template>

<script setup>
import { computed, onMounted, ref } from 'vue';
import { useRoute } from 'vue-router';
import AppShell from '../components/AppShell.vue';
import BotonVolver from '../components/BotonVolver.vue';
import ReportePrintHeader from '../components/ReportePrintHeader.vue';
import { api } from '../lib/api.js';
import { FORMAS_PAGO, FORMAS_PAGO_TEXTO } from '../lib/formasPago.js';
import { useAuthStore } from '../stores/auth.js';

const auth = useAuthStore();
const route = useRoute();
const nomina = ref(null);
const error = ref('');
const pagoAbierto = ref(false);
const formaPago = ref('');
const marcando = ref(false);

const ESTATUS_TEXTO = { borrador: 'Borrador', pagada: 'Pagada', cancelada: 'Cancelada' };

const totalNomina = computed(() => (nomina.value?.detalle ?? []).reduce((acc, d) => acc + Number(d.monto_total), 0));

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
function estatusClase(estatus) {
  if (estatus === 'pagada') return 'bg-emerald-50 text-success';
  if (estatus === 'cancelada') return 'bg-slate-100 text-slate-500';
  return 'bg-amber-50 text-warning';
}

async function cargar() {
  const { data } = await api.get(`/nomina/${route.params.id}`);
  nomina.value = data;
}

async function marcarPagada() {
  marcando.value = true;
  error.value = '';
  try {
    await api.post(`/nomina/${route.params.id}/marcar-pagada`, { formaPago: formaPago.value });
    pagoAbierto.value = false;
    await cargar();
  } catch (err) {
    error.value = err.response?.data?.error || 'No se pudo marcar como pagada.';
  } finally {
    marcando.value = false;
  }
}

async function cancelar() {
  if (!window.confirm(`¿Cancelar la nómina ${nomina.value.folio}?`)) return;
  error.value = '';
  try {
    await api.post(`/nomina/${route.params.id}/cancelar`);
    await cargar();
  } catch (err) {
    error.value = err.response?.data?.error || 'No se pudo cancelar.';
  }
}

onMounted(cargar);
</script>
