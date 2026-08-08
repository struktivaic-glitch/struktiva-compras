<template>
  <AppShell>
    <BotonVolver fallback="/pagos-personal" />
    <h2 class="font-display text-[36px] mb-1">Generar nómina</h2>
    <p class="text-xs text-slate-500 mb-4">
      Selecciona el periodo, agrega al personal incluido y confirma. El sueldo diario se toma del expediente (editable),
      la asistencia es un respaldo opcional para sugerir los días trabajados — el monto final siempre es editable a mano.
    </p>

    <div class="bg-white border border-slate-200 rounded-xl p-4 mb-5 grid sm:grid-cols-3 gap-3">
      <div>
        <label class="block text-[11px] font-bold uppercase text-slate-500 mb-1">Periodo</label>
        <select v-model="periodoTipo" :disabled="personal.length > 0" class="w-full border border-slate-300 rounded-lg px-2.5 min-h-[42px] disabled:bg-slate-100 disabled:text-slate-400" @change="ajustarFechaFin">
          <option value="semanal">Semanal</option>
          <option value="quincenal">Quincenal</option>
        </select>
      </div>
      <div>
        <label class="block text-[11px] font-bold uppercase text-slate-500 mb-1">Desde</label>
        <input v-model="fechaInicio" type="date" :disabled="personal.length > 0" class="w-full border border-slate-300 rounded-lg px-2.5 min-h-[42px] disabled:bg-slate-100 disabled:text-slate-400" @change="ajustarFechaFin" />
      </div>
      <div>
        <label class="block text-[11px] font-bold uppercase text-slate-500 mb-1">Hasta</label>
        <input v-model="fechaFin" type="date" :disabled="personal.length > 0" class="w-full border border-slate-300 rounded-lg px-2.5 min-h-[42px] disabled:bg-slate-100 disabled:text-slate-400" />
      </div>
      <p v-if="personal.length > 0" class="text-[11px] text-slate-400 sm:col-span-3">
        El periodo queda fijo mientras haya personal agregado — quita a todos si necesitas cambiar las fechas.
      </p>
    </div>

    <p v-if="error" class="bg-red-50 border border-danger/30 text-danger text-sm rounded-lg px-4 py-3 mb-4">{{ error }}</p>

    <div class="bg-white border border-slate-200 rounded-xl p-4 mb-4">
      <label class="block text-[11px] font-bold uppercase text-slate-500 mb-1">Agregar personal</label>
      <div class="flex flex-wrap items-end gap-2">
        <select v-model.number="trabajadorSeleccionado" class="flex-1 min-w-[200px] border border-slate-300 rounded-lg px-2.5 min-h-[42px]">
          <option :value="null" disabled>Elegir…</option>
          <option v-for="t in trabajadoresDisponibles" :key="t.id" :value="t.id">{{ t.nombre }}{{ t.oficio ? ' · ' + t.oficio : '' }}</option>
        </select>
        <button type="button" class="min-h-[42px] border-[1.5px] border-primary text-primary font-bold rounded-lg px-4 text-sm" :disabled="!trabajadorSeleccionado || !fechaInicio || !fechaFin || agregando" @click="agregarPersonal">
          {{ agregando ? 'Agregando…' : '+ Agregar' }}
        </button>
      </div>
    </div>

    <div v-for="(p, idx) in personal" :key="p.trabajadorId" class="bg-white border rounded-xl p-4 mb-3" :class="p.traslapes.length && !p.duplicadoJustificacion.trim() ? 'border-danger' : 'border-slate-200'">
      <div class="flex items-center justify-between mb-2">
        <span class="font-semibold text-sm">{{ p.trabajadorNombre }}</span>
        <button class="text-slate-400 hover:text-danger" @click="personal.splice(idx, 1)">✕</button>
      </div>

      <div class="grid sm:grid-cols-4 gap-3 mb-2">
        <div>
          <label class="block text-[11px] font-bold uppercase text-slate-500 mb-1">Sueldo diario</label>
          <input v-model.number="p.sueldoDiario" type="number" inputmode="decimal" min="0.01" step="any" class="w-full border border-slate-300 rounded-lg px-2.5 min-h-[42px]" />
        </div>
        <div>
          <label class="block text-[11px] font-bold uppercase text-slate-500 mb-1">Días trabajados</label>
          <input v-model.number="p.diasTrabajados" type="number" inputmode="decimal" min="0" step="0.5" :disabled="p.usarAsistencia" class="w-full border border-slate-300 rounded-lg px-2.5 min-h-[42px] disabled:bg-slate-100 disabled:text-slate-400" />
          <label class="flex items-center gap-1.5 text-[11px] text-slate-500 mt-1">
            <input type="checkbox" v-model="p.usarAsistencia" class="w-3.5 h-3.5" @change="p.usarAsistencia && (p.diasTrabajados = p.diasAsistencia)" />
            Usar asistencia ({{ p.diasAsistencia }} día(s) registrados)
          </label>
        </div>
        <div>
          <label class="block text-[11px] font-bold uppercase text-slate-500 mb-1">Compensación (opcional)</label>
          <input v-model.number="p.compensacion" type="number" inputmode="decimal" min="0" step="any" class="w-full border border-slate-300 rounded-lg px-2.5 min-h-[42px]" />
          <input v-if="p.compensacion > 0" v-model="p.compensacionConcepto" placeholder="Motivo (ej. bono, horas extra)" class="w-full border border-slate-300 rounded-lg px-2.5 min-h-[36px] text-xs mt-1" />
        </div>
        <div>
          <label class="block text-[11px] font-bold uppercase text-slate-500 mb-1 flex items-center gap-1">
            Descuento (opcional)
            <button type="button" class="text-primary" title="Anotar motivo del descuento" @click="abrirDescuento(p)">🛈</button>
          </label>
          <input :value="mxn(p.descuento)" readonly class="w-full border border-slate-200 bg-slate-50 rounded-lg px-2.5 min-h-[42px] tabular-nums cursor-pointer" @click="abrirDescuento(p)" />
        </div>
      </div>

      <div v-if="p.traslapes.length" class="bg-red-50 border border-dashed border-danger rounded-md px-2.5 py-2 mb-2">
        <label class="text-[11px] font-bold text-danger block mb-1">
          Esta persona ya está en otra nómina que se traslapa con este periodo: {{ p.traslapes.join(', ') }} — justifica para incluirla de todos modos
        </label>
        <textarea v-model="p.duplicadoJustificacion" rows="2" class="w-full border border-danger rounded-md px-2.5 py-1.5 text-sm" placeholder="Ej. complemento de horas extra, corrección de un error…" />
      </div>

      <p class="text-sm font-bold">Total: {{ mxn(totalPersona(p)) }}</p>
    </div>

    <p v-if="!personal.length" class="text-sm text-slate-400 mb-3">Agrega personal con el selector de arriba.</p>

    <p v-if="personal.length" class="text-sm font-display mb-5">Total de la nómina: <b>{{ mxn(totalNomina) }}</b></p>

    <!-- Modal de descuento -->
    <div v-if="descuentoAbierto" class="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4" @click.self="descuentoAbierto = null">
      <div class="bg-white rounded-xl p-5 w-full max-w-sm">
        <h3 class="text-sm font-display mb-3">Descuento — {{ descuentoAbierto.trabajadorNombre }}</h3>
        <label class="block text-[11px] font-bold uppercase text-slate-500 mb-1">Monto</label>
        <input v-model.number="descuentoAbierto.descuento" type="number" inputmode="decimal" min="0" step="any" class="w-full border border-slate-300 rounded-lg px-2.5 min-h-[42px] mb-3" />
        <label class="block text-[11px] font-bold uppercase text-slate-500 mb-1">Motivo</label>
        <textarea v-model="descuentoAbierto.descuentoMotivo" rows="3" class="w-full border border-slate-300 rounded-lg px-2.5 py-1.5 text-sm mb-3" placeholder="Por qué se le está descontando…" />
        <button class="min-h-[42px] w-full bg-primary text-white font-bold rounded-lg text-sm" @click="descuentoAbierto = null">Listo</button>
      </div>
    </div>

    <button class="min-h-[48px] bg-primary text-white rounded-lg px-5 font-bold text-sm" :disabled="!puedeGuardar || guardando" @click="guardar">
      {{ guardando ? 'Generando…' : 'Generar nómina' }}
    </button>
  </AppShell>
</template>

<script setup>
import { computed, ref } from 'vue';
import { useRouter } from 'vue-router';
import AppShell from '../components/AppShell.vue';
import BotonVolver from '../components/BotonVolver.vue';
import { api } from '../lib/api.js';

const router = useRouter();

const periodoTipo = ref('semanal');
const fechaInicio = ref(new Date().toISOString().slice(0, 10));
const fechaFin = ref('');
const trabajadores = ref([]);
const trabajadorSeleccionado = ref(null);
const personal = ref([]);
const agregando = ref(false);
const guardando = ref(false);
const error = ref('');
const descuentoAbierto = ref(null);

function sumarDias(fechaIso, dias) {
  const d = new Date(fechaIso + 'T00:00:00');
  d.setDate(d.getDate() + dias);
  return d.toISOString().slice(0, 10);
}
function ajustarFechaFin() {
  if (!fechaInicio.value) return;
  fechaFin.value = sumarDias(fechaInicio.value, periodoTipo.value === 'semanal' ? 6 : 14);
}
ajustarFechaFin();

const trabajadoresDisponibles = computed(() => trabajadores.value.filter((t) => !personal.value.some((p) => p.trabajadorId === t.id)));

function mxn(n) {
  return new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN' }).format(n || 0);
}
function totalPersona(p) {
  return Number(p.diasTrabajados || 0) * Number(p.sueldoDiario || 0) + Number(p.compensacion || 0) - Number(p.descuento || 0);
}
const totalNomina = computed(() => personal.value.reduce((acc, p) => acc + totalPersona(p), 0));

function abrirDescuento(p) {
  descuentoAbierto.value = p;
}

async function agregarPersonal() {
  error.value = '';
  agregando.value = true;
  try {
    const { data } = await api.get('/nomina/sugerencia', { params: { trabajadorId: trabajadorSeleccionado.value, desde: fechaInicio.value, hasta: fechaFin.value } });
    personal.value.push({
      trabajadorId: trabajadorSeleccionado.value,
      trabajadorNombre: data.trabajadorNombre,
      sueldoDiario: data.sueldoDiario ?? 0,
      usarAsistencia: true,
      diasAsistencia: data.diasAsistencia,
      diasTrabajados: data.diasAsistencia,
      compensacion: 0,
      compensacionConcepto: '',
      descuento: 0,
      descuentoMotivo: '',
      traslapes: data.traslapes.map((t) => t.folio),
      duplicadoJustificacion: '',
    });
    trabajadorSeleccionado.value = null;
  } catch (err) {
    error.value = err.response?.data?.error || 'No se pudo agregar a esta persona.';
  } finally {
    agregando.value = false;
  }
}

const puedeGuardar = computed(() =>
  personal.value.length > 0 &&
  personal.value.every((p) => p.sueldoDiario > 0 && (p.traslapes.length === 0 || p.duplicadoJustificacion.trim()))
);

async function guardar() {
  error.value = '';
  guardando.value = true;
  try {
    const { data } = await api.post('/nomina', {
      periodoTipo: periodoTipo.value,
      fechaInicio: fechaInicio.value,
      fechaFin: fechaFin.value,
      personal: personal.value.map((p) => ({
        trabajadorId: p.trabajadorId,
        sueldoDiario: p.sueldoDiario,
        usarAsistencia: p.usarAsistencia,
        diasTrabajados: p.diasTrabajados,
        compensacion: p.compensacion,
        compensacionConcepto: p.compensacionConcepto,
        descuento: p.descuento,
        descuentoMotivo: p.descuentoMotivo,
        duplicadoJustificacion: p.duplicadoJustificacion,
      })),
    });
    router.push(`/pagos-personal/${data.id}`);
  } catch (err) {
    error.value = err.response?.data?.error || 'No se pudo generar la nómina.';
  } finally {
    guardando.value = false;
  }
}

api.get('/trabajadores').then(({ data }) => { trabajadores.value = data; });
</script>
