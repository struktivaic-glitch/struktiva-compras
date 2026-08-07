<template>
  <AppShell>
    <div class="flex items-center justify-between mb-4 flex-wrap gap-3 no-print">
      <div>
        <h2 class="font-display text-[36px]">Incidencias</h2>
        <p class="text-xs text-slate-500">Faltas, permisos, vacaciones e incapacidades del personal — control interno, no es un trámite fiscal.</p>
      </div>
      <div class="flex items-center gap-2">
        <select v-model="estatusFiltro" class="text-sm border border-slate-300 rounded-lg px-2.5 py-2" @change="cargar">
          <option value="">Todos los estatus</option>
          <option value="pendiente">Pendiente</option>
          <option value="autorizada">Autorizada</option>
          <option value="rechazada">Rechazada</option>
        </select>
        <button class="min-h-[39px] bg-primary text-white text-sm font-bold rounded-lg px-4" @click="imprimir">Imprimir / Guardar PDF</button>
      </div>
    </div>

    <form v-if="puedeSolicitar" class="bg-white border border-slate-200 rounded-xl p-4 mb-5 grid sm:grid-cols-6 gap-3 items-end no-print" @submit.prevent="crear">
      <div class="sm:col-span-2">
        <label class="block text-[11px] font-bold uppercase text-slate-500 mb-1">Personal</label>
        <select v-model="form.trabajadorId" required class="w-full border border-slate-300 rounded-lg px-2.5 min-h-[42px]">
          <option :value="null" disabled>Selecciona…</option>
          <option v-for="t in trabajadores" :key="t.id" :value="t.id">{{ t.nombre }}</option>
        </select>
      </div>
      <div>
        <label class="block text-[11px] font-bold uppercase text-slate-500 mb-1">Tipo</label>
        <select v-model="form.tipo" required class="w-full border border-slate-300 rounded-lg px-2.5 min-h-[42px]">
          <option value="falta">Falta</option>
          <option value="permiso">Permiso</option>
          <option value="vacaciones">Vacaciones</option>
          <option value="incapacidad">Incapacidad</option>
        </select>
      </div>
      <div>
        <label class="block text-[11px] font-bold uppercase text-slate-500 mb-1">Desde</label>
        <input v-model="form.fechaInicio" type="date" required class="w-full border border-slate-300 rounded-lg px-2.5 min-h-[42px]" />
      </div>
      <div>
        <label class="block text-[11px] font-bold uppercase text-slate-500 mb-1">Hasta</label>
        <input v-model="form.fechaFin" type="date" required class="w-full border border-slate-300 rounded-lg px-2.5 min-h-[42px]" />
      </div>
      <div>
        <label class="block text-[11px] font-bold uppercase text-slate-500 mb-1">Motivo (opcional)</label>
        <input v-model="form.motivo" class="w-full border border-slate-300 rounded-lg px-2.5 min-h-[42px]" />
      </div>
      <button type="submit" class="min-h-[42px] bg-primary text-white font-bold rounded-lg px-5 text-sm sm:col-span-6" :disabled="guardando">
        {{ guardando ? 'Guardando…' : '+ Solicitar' }}
      </button>
    </form>

    <p v-if="error" class="bg-red-50 border border-danger/30 text-danger text-sm rounded-lg px-4 py-3 mb-4 no-print">{{ error }}</p>
    <p v-if="mensaje" class="bg-emerald-50 border border-success/30 text-success text-sm rounded-lg px-4 py-3 mb-4 no-print">{{ mensaje }}</p>

    <div class="print-sheet bg-white border border-slate-200 rounded-xl overflow-x-auto">
      <ReportePrintHeader titulo="Incidencias de Personal" :subtitulo="estatusFiltro ? `Estatus: ${ESTATUS_TEXTO[estatusFiltro]}` : 'Todos los estatus'" class="p-5 pb-0" />
      <table class="w-full text-sm">
        <thead>
          <tr class="bg-slate-50 text-[11px] uppercase tracking-wide text-slate-500">
            <th class="text-left px-4 py-2.5 font-normal">Personal</th>
            <th class="text-left px-4 py-2.5 font-normal">Tipo</th>
            <th class="text-left px-4 py-2.5 font-normal">Fechas</th>
            <th class="text-left px-4 py-2.5 font-normal">Motivo</th>
            <th class="text-left px-4 py-2.5 font-normal">Solicitó</th>
            <th class="text-left px-4 py-2.5 font-normal">Estatus</th>
            <th v-if="puedeAutorizar" class="text-left px-4 py-2.5 font-normal no-print">Acciones</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="i in incidencias" :key="i.id" class="border-t border-slate-200">
            <td class="px-4 py-2.5 font-semibold">{{ i.trabajador_nombre }}</td>
            <td class="px-4 py-2.5 capitalize">{{ TIPO_TEXTO[i.tipo] }}</td>
            <td class="px-4 py-2.5">{{ formatoFecha(i.fecha_inicio) }} — {{ formatoFecha(i.fecha_fin) }}</td>
            <td class="px-4 py-2.5 text-slate-500">{{ i.motivo || '—' }}</td>
            <td class="px-4 py-2.5 text-slate-500">{{ i.solicitado_por_nombre }}</td>
            <td class="px-4 py-2.5">
              <span class="inline-flex text-[11.5px] font-bold px-2.5 py-0.5 rounded-full" :class="estatusClase(i.estatus)">
                {{ ESTATUS_TEXTO[i.estatus] }}
              </span>
              <div v-if="i.estatus !== 'pendiente'" class="text-[11px] text-slate-400 mt-0.5">{{ i.autorizado_por_nombre }} · {{ formatoFecha(i.fecha_autorizacion) }}</div>
            </td>
            <td v-if="puedeAutorizar" class="px-4 py-2.5 space-x-2 no-print">
              <template v-if="i.estatus === 'pendiente'">
                <button class="text-xs font-semibold text-success underline" @click="autorizar(i)">Autorizar</button>
                <button class="text-xs font-semibold text-danger underline" @click="rechazar(i)">Rechazar</button>
              </template>
            </td>
          </tr>
          <tr v-if="!incidencias.length">
            <td :colspan="puedeAutorizar ? 7 : 6" class="px-4 py-8 text-center text-slate-400 text-sm">Sin incidencias para mostrar.</td>
          </tr>
        </tbody>
      </table>
    </div>
  </AppShell>
</template>

<script setup>
import { onMounted, reactive, ref } from 'vue';
import AppShell from '../components/AppShell.vue';
import ReportePrintHeader from '../components/ReportePrintHeader.vue';
import { api } from '../lib/api.js';
import { useAuthStore } from '../stores/auth.js';

const auth = useAuthStore();
const puedeSolicitar = ['residente', 'superintendente', 'direccion'].includes(auth.rol);
const puedeAutorizar = ['superintendente', 'direccion'].includes(auth.rol);

const TIPO_TEXTO = { falta: 'Falta', permiso: 'Permiso', vacaciones: 'Vacaciones', incapacidad: 'Incapacidad' };
const ESTATUS_TEXTO = { pendiente: 'Pendiente', autorizada: 'Autorizada', rechazada: 'Rechazada' };

const incidencias = ref([]);
const trabajadores = ref([]);
const estatusFiltro = ref('');
const error = ref('');
const mensaje = ref('');
const guardando = ref(false);
const form = reactive({ trabajadorId: null, tipo: 'falta', fechaInicio: '', fechaFin: '', motivo: '' });

function imprimir() {
  window.print();
}
function formatoFecha(fecha) {
  if (!fecha) return '—';
  return new Date(fecha).toLocaleDateString('es-MX', { day: '2-digit', month: 'short', year: 'numeric', timeZone: 'UTC' });
}
function estatusClase(e) {
  if (e === 'autorizada') return 'bg-emerald-50 text-success';
  if (e === 'rechazada') return 'bg-red-50 text-danger';
  return 'bg-amber-50 text-warning';
}

async function cargar() {
  const { data } = await api.get('/incidencias', { params: { estatus: estatusFiltro.value || undefined } });
  incidencias.value = data;
}

async function crear() {
  error.value = '';
  mensaje.value = '';
  guardando.value = true;
  try {
    await api.post('/incidencias', form);
    Object.assign(form, { trabajadorId: null, tipo: 'falta', fechaInicio: '', fechaFin: '', motivo: '' });
    mensaje.value = 'Solicitud enviada.';
    await cargar();
  } catch (err) {
    error.value = err.response?.data?.error || 'No se pudo enviar la solicitud.';
  } finally {
    guardando.value = false;
  }
}

async function autorizar(i) {
  error.value = '';
  try {
    await api.post(`/incidencias/${i.id}/autorizar`);
    await cargar();
  } catch (err) {
    error.value = err.response?.data?.error || 'No se pudo autorizar.';
  }
}

async function rechazar(i) {
  const comentario = window.prompt('¿Motivo del rechazo? (opcional)') || '';
  error.value = '';
  try {
    await api.post(`/incidencias/${i.id}/rechazar`, { comentario });
    await cargar();
  } catch (err) {
    error.value = err.response?.data?.error || 'No se pudo rechazar.';
  }
}

onMounted(async () => {
  const { data } = await api.get('/trabajadores');
  trabajadores.value = data;
  await cargar();
});
</script>
