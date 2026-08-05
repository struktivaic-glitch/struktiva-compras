<template>
  <AppShell>
    <div class="flex items-center justify-between mb-4 flex-wrap gap-3 no-print">
      <div>
        <h2 class="font-display text-lg">Asistencia</h2>
        <p class="text-xs text-slate-500">Entrada y salida diaria del personal — control interno, no calcula nómina ni faltas.</p>
      </div>
      <div class="flex items-center gap-2 text-sm">
        <button
          class="min-h-[38px] px-3 rounded-lg font-semibold"
          :class="tab === 'checador' ? 'bg-primary text-white' : 'border border-slate-300 text-slate-600'"
          @click="tab = 'checador'"
        >
          Checador
        </button>
        <button
          class="min-h-[38px] px-3 rounded-lg font-semibold"
          :class="tab === 'historico' ? 'bg-primary text-white' : 'border border-slate-300 text-slate-600'"
          @click="tab = 'historico'; cargarHistorico()"
        >
          Histórico
        </button>
      </div>
    </div>

    <!-- Checador -->
    <template v-if="tab === 'checador'">
      <div class="flex items-end gap-3 mb-4 flex-wrap no-print">
        <div>
          <label class="block text-[11px] font-bold uppercase text-slate-500 mb-1">Fecha</label>
          <input v-model="fecha" type="date" class="border border-slate-300 rounded-lg px-2.5 min-h-[42px]" @change="cargarChecador" />
        </div>
        <div>
          <label class="block text-[11px] font-bold uppercase text-slate-500 mb-1">Obra / frente</label>
          <select v-model="obraId" class="border border-slate-300 rounded-lg px-2.5 min-h-[42px]" @change="cargarChecador">
            <option :value="null">Todo el personal</option>
            <option v-for="o in obras" :key="o.id" :value="o.id">{{ o.nombre }}</option>
          </select>
        </div>
      </div>

      <p v-if="mensaje" class="bg-emerald-50 border border-success/30 text-success text-sm rounded-lg px-4 py-3 mb-4 no-print">{{ mensaje }}</p>
      <p v-if="error" class="bg-red-50 border border-danger/30 text-danger text-sm rounded-lg px-4 py-3 mb-4 no-print">{{ error }}</p>

      <div class="overflow-x-auto bg-white border border-slate-200 rounded-xl">
        <table class="w-full text-sm">
          <thead>
            <tr class="bg-slate-50 text-[11px] uppercase tracking-wide text-slate-500">
              <th class="text-left px-4 py-2.5 font-normal">Nombre</th>
              <th class="text-left px-4 py-2.5 font-normal">Tipo / Puesto</th>
              <th class="text-left px-4 py-2.5 font-normal">Entrada</th>
              <th class="text-left px-4 py-2.5 font-normal">Salida</th>
              <th v-if="puedeMarcar" class="text-left px-4 py-2.5 font-normal">Acciones</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="p in personal" :key="p.trabajador_id" class="border-t border-slate-200">
              <td class="px-4 py-2.5 font-semibold">{{ p.nombre }}</td>
              <td class="px-4 py-2.5 text-slate-500 capitalize">{{ p.tipo }} · {{ p.puesto || p.oficio || '—' }}</td>
              <td class="px-4 py-2.5">
                <span v-if="p.hora_entrada" class="text-success font-semibold">{{ formatoHora(p.hora_entrada) }}</span>
                <span v-else class="text-slate-400">—</span>
              </td>
              <td class="px-4 py-2.5">
                <span v-if="p.hora_salida" class="text-success font-semibold">{{ formatoHora(p.hora_salida) }}</span>
                <span v-else class="text-slate-400">—</span>
              </td>
              <td v-if="puedeMarcar" class="px-4 py-2.5 space-x-2">
                <button
                  v-if="!p.hora_entrada"
                  class="text-xs font-semibold text-primary underline disabled:opacity-50"
                  :disabled="marcando === p.trabajador_id"
                  @click="marcarEntrada(p)"
                >
                  Marcar entrada
                </button>
                <button
                  v-else-if="!p.hora_salida"
                  class="text-xs font-semibold text-warning underline disabled:opacity-50"
                  :disabled="marcando === p.trabajador_id"
                  @click="marcarSalida(p)"
                >
                  Marcar salida
                </button>
                <span v-else class="text-xs text-slate-400">Completo</span>
              </td>
            </tr>
            <tr v-if="!personal.length">
              <td colspan="5" class="px-4 py-8 text-center text-slate-400 text-sm">Sin personal activo para mostrar.</td>
            </tr>
          </tbody>
        </table>
      </div>
    </template>

    <!-- Histórico -->
    <template v-else>
      <div class="flex items-end gap-3 mb-4 flex-wrap no-print">
        <div>
          <label class="block text-[11px] font-bold uppercase text-slate-500 mb-1">Desde</label>
          <input v-model="desde" type="date" class="border border-slate-300 rounded-lg px-2.5 min-h-[42px]" @change="cargarHistorico" />
        </div>
        <div>
          <label class="block text-[11px] font-bold uppercase text-slate-500 mb-1">Hasta</label>
          <input v-model="hasta" type="date" class="border border-slate-300 rounded-lg px-2.5 min-h-[42px]" @change="cargarHistorico" />
        </div>
        <div>
          <label class="block text-[11px] font-bold uppercase text-slate-500 mb-1">Obra / frente</label>
          <select v-model="obraId" class="border border-slate-300 rounded-lg px-2.5 min-h-[42px]" @change="cargarHistorico">
            <option :value="null">Todas</option>
            <option v-for="o in obras" :key="o.id" :value="o.id">{{ o.nombre }}</option>
          </select>
        </div>
        <button class="min-h-[42px] bg-primary text-white text-sm font-bold rounded-lg px-4 ml-auto" @click="imprimir">Imprimir / Guardar PDF</button>
      </div>

      <div class="print-sheet bg-white border border-slate-200 rounded-xl p-5">
        <ReportePrintHeader titulo="Histórico de Asistencia" :subtitulo="`${desde || '…'} — ${hasta || '…'}`" />
        <table class="w-full text-sm tabular-nums">
          <thead>
            <tr class="text-[11px] uppercase tracking-wide text-slate-500 border-b border-slate-300">
              <th class="text-left py-2 font-normal font-sans">Fecha</th>
              <th class="text-left py-2 font-normal font-sans">Nombre</th>
              <th class="text-left py-2 font-normal font-sans">Obra</th>
              <th class="text-left py-2 font-normal font-sans">Entrada</th>
              <th class="text-left py-2 font-normal font-sans">Salida</th>
              <th class="text-left py-2 font-normal font-sans">Horas</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="a in historico" :key="a.id" class="border-b border-slate-100">
              <td class="py-2 font-sans">{{ formatoFecha(a.fecha) }}</td>
              <td class="py-2 font-semibold">{{ a.nombre }}</td>
              <td class="py-2 font-sans">{{ a.obra_nombre || '—' }}</td>
              <td class="py-2 font-sans">{{ a.hora_entrada ? formatoHora(a.hora_entrada) : '—' }}</td>
              <td class="py-2 font-sans">{{ a.hora_salida ? formatoHora(a.hora_salida) : '—' }}</td>
              <td class="py-2 font-sans">{{ horasTrabajadas(a) }}</td>
            </tr>
            <tr v-if="!historico.length">
              <td colspan="6" class="py-8 text-center text-slate-400 text-sm">Sin registros en el rango seleccionado.</td>
            </tr>
          </tbody>
        </table>
        <p class="text-[10.5px] text-slate-400 mt-4">{{ historico.length }} registro(s) · documento generado por sistema.</p>
      </div>
    </template>
  </AppShell>
</template>

<script setup>
import { computed, onMounted, ref } from 'vue';
import AppShell from '../components/AppShell.vue';
import ReportePrintHeader from '../components/ReportePrintHeader.vue';
import { api } from '../lib/api.js';
import { useAuthStore } from '../stores/auth.js';

const auth = useAuthStore();
const puedeMarcar = ['residente', 'superintendente', 'direccion'].includes(auth.rol);

const tab = ref('checador');
const obras = ref([]);
const obraId = ref(null);

const fecha = ref(new Date().toISOString().slice(0, 10));
const personal = ref([]);
const mensaje = ref('');
const error = ref('');
const marcando = ref(null);

const desde = ref(new Date().toISOString().slice(0, 8) + '01'); // primer día del mes actual
const hasta = ref(new Date().toISOString().slice(0, 10));
const historico = ref([]);

function imprimir() {
  window.print();
}

function obtenerGps() {
  return new Promise((resolve) => {
    if (!navigator.geolocation) return resolve({});
    navigator.geolocation.getCurrentPosition(
      (pos) => resolve({ gpsLat: pos.coords.latitude, gpsLng: pos.coords.longitude }),
      () => resolve({}),
      { timeout: 2500 }
    );
  });
}

function formatoHora(fechaIso) {
  return new Date(fechaIso).toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' });
}
function formatoFecha(fechaIso) {
  // `fecha` es una columna DATE (sin hora) — el backend la sirve como medianoche UTC. Si se
  // formatea en la zona horaria local del navegador, puede "retroceder" un día (ej. Hermosillo,
  // UTC-7). Se fuerza timeZone: 'UTC' para mostrar el día calendario tal como está guardado.
  return new Date(fechaIso).toLocaleDateString('es-MX', { day: '2-digit', month: 'short', year: 'numeric', timeZone: 'UTC' });
}
function horasTrabajadas(a) {
  if (!a.hora_entrada || !a.hora_salida) return '—';
  const ms = new Date(a.hora_salida) - new Date(a.hora_entrada);
  return (ms / 3_600_000).toFixed(1) + ' h';
}

async function cargarChecador() {
  const { data } = await api.get('/asistencias/checador', { params: { fecha: fecha.value, obraId: obraId.value || undefined } });
  personal.value = data.personal;
}

async function cargarHistorico() {
  const { data } = await api.get('/asistencias', {
    params: { desde: desde.value || undefined, hasta: hasta.value || undefined, obraId: obraId.value || undefined },
  });
  historico.value = data;
}

async function marcarEntrada(p) {
  error.value = '';
  mensaje.value = '';
  marcando.value = p.trabajador_id;
  try {
    const gps = await obtenerGps();
    await api.post('/asistencias/entrada', { trabajadorId: p.trabajador_id, fecha: fecha.value, obraId: obraId.value || p.obra_id, ...gps });
    mensaje.value = `Entrada registrada para ${p.nombre}.`;
    await cargarChecador();
  } catch (err) {
    error.value = err.response?.data?.error || 'No se pudo registrar la entrada.';
  } finally {
    marcando.value = null;
  }
}

async function marcarSalida(p) {
  error.value = '';
  mensaje.value = '';
  marcando.value = p.trabajador_id;
  try {
    const gps = await obtenerGps();
    await api.post('/asistencias/salida', { trabajadorId: p.trabajador_id, fecha: fecha.value, ...gps });
    mensaje.value = `Salida registrada para ${p.nombre}.`;
    await cargarChecador();
  } catch (err) {
    error.value = err.response?.data?.error || 'No se pudo registrar la salida.';
  } finally {
    marcando.value = null;
  }
}

onMounted(async () => {
  const { data } = await api.get('/catalogo/obras');
  obras.value = data.map((o) => ({ id: o.id, nombre: o.nombre }));
  await cargarChecador();
});
</script>
