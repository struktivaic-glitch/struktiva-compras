<template>
  <AppShell>
    <div class="flex items-center justify-between mb-4 flex-wrap gap-3 no-print">
      <div>
        <h2 class="font-display text-lg">Asistencia</h2>
        <p class="text-xs text-slate-500">
          Registro de jornada (entrada/salida/comida) — apoya el registro electrónico que exige la LFT
          (Art. 132 Fracc. XXXIV). Las marcas originales son inalterables; las correcciones quedan documentadas.
        </p>
      </div>
      <div class="flex items-center gap-2 text-sm">
        <button class="min-h-[38px] px-3 rounded-lg font-semibold" :class="tab === 'checador' ? 'bg-primary text-white' : 'border border-slate-300 text-slate-600'" @click="tab = 'checador'">
          Checador
        </button>
        <button class="min-h-[38px] px-3 rounded-lg font-semibold" :class="tab === 'historico' ? 'bg-primary text-white' : 'border border-slate-300 text-slate-600'" @click="tab = 'historico'; cargarHistorico()">
          Histórico
        </button>
        <button class="min-h-[38px] px-3 rounded-lg font-semibold" :class="tab === 'horasExtra' ? 'bg-primary text-white' : 'border border-slate-300 text-slate-600'" @click="tab = 'horasExtra'; cargarHorasExtra(); cargarConfig()">
          Horas extra
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
              <th class="text-left px-4 py-2.5 font-normal">Comida</th>
              <th class="text-left px-4 py-2.5 font-normal">Salida</th>
              <th v-if="puedeMarcar" class="text-left px-4 py-2.5 font-normal">Acciones</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="p in personal" :key="p.trabajador_id" class="border-t border-slate-200">
              <td class="px-4 py-2.5 font-semibold">
                {{ p.nombre }}
                <span v-if="p.corregido" class="ml-1 text-[10px] font-bold text-warning" title="Tiene una corrección registrada">✎ corregido</span>
              </td>
              <td class="px-4 py-2.5 text-slate-500 capitalize">{{ p.tipo }} · {{ p.puesto || p.oficio || '—' }}</td>
              <td class="px-4 py-2.5">
                <span v-if="p.hora_entrada" class="text-success font-semibold">{{ formatoHora(p.hora_entrada) }}</span>
                <span v-else class="text-slate-400">—</span>
              </td>
              <td class="px-4 py-2.5 text-xs">
                <span v-if="p.hora_inicio_comida || p.hora_fin_comida">
                  {{ p.hora_inicio_comida ? formatoHora(p.hora_inicio_comida) : '—' }} / {{ p.hora_fin_comida ? formatoHora(p.hora_fin_comida) : '—' }}
                </span>
                <span v-else class="text-slate-400">—</span>
              </td>
              <td class="px-4 py-2.5">
                <span v-if="p.hora_salida" class="text-success font-semibold">{{ formatoHora(p.hora_salida) }}</span>
                <span v-else class="text-slate-400">—</span>
              </td>
              <td v-if="puedeMarcar" class="px-4 py-2.5 space-y-1">
                <div class="space-x-2">
                  <button v-if="!p.hora_entrada" class="text-xs font-semibold text-primary underline disabled:opacity-50" :disabled="marcando === p.trabajador_id" @click="marcarEntrada(p)">
                    Marcar entrada
                  </button>
                  <template v-else-if="!p.hora_salida">
                    <button v-if="!p.hora_inicio_comida" class="text-xs font-semibold text-slate-600 underline disabled:opacity-50" :disabled="marcando === p.trabajador_id" @click="marcarComida(p, 'inicio')">
                      Inicio comida
                    </button>
                    <button v-else-if="!p.hora_fin_comida" class="text-xs font-semibold text-slate-600 underline disabled:opacity-50" :disabled="marcando === p.trabajador_id" @click="marcarComida(p, 'fin')">
                      Fin comida
                    </button>
                    <button class="text-xs font-semibold text-warning underline disabled:opacity-50" :disabled="marcando === p.trabajador_id" @click="marcarSalida(p)">
                      Marcar salida
                    </button>
                  </template>
                  <span v-else class="text-xs text-slate-400">Completo</span>
                </div>
                <button v-if="p.asistencia_id" class="text-[11px] text-slate-400 underline" @click="abrirCorreccion(p)">Corregir…</button>
              </td>
            </tr>
            <tr v-if="!personal.length">
              <td colspan="6" class="px-4 py-8 text-center text-slate-400 text-sm">Sin personal activo para mostrar.</td>
            </tr>
          </tbody>
        </table>
      </div>
    </template>

    <!-- Histórico -->
    <template v-else-if="tab === 'historico'">
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
              <th class="text-left py-2 font-normal font-sans">Comida</th>
              <th class="text-left py-2 font-normal font-sans">Salida</th>
              <th class="text-left py-2 font-normal font-sans">Horas</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="a in historico" :key="a.id" class="border-b border-slate-100">
              <td class="py-2 font-sans">{{ formatoFecha(a.fecha) }}</td>
              <td class="py-2 font-semibold">{{ a.nombre }}<span v-if="a.corregido" class="ml-1 text-[10px] font-bold text-warning">✎</span></td>
              <td class="py-2 font-sans">{{ a.obra_nombre || '—' }}</td>
              <td class="py-2 font-sans">{{ a.hora_entrada ? formatoHora(a.hora_entrada) : '—' }}</td>
              <td class="py-2 font-sans text-xs">{{ a.hora_inicio_comida ? formatoHora(a.hora_inicio_comida) : '—' }} / {{ a.hora_fin_comida ? formatoHora(a.hora_fin_comida) : '—' }}</td>
              <td class="py-2 font-sans">{{ a.hora_salida ? formatoHora(a.hora_salida) : '—' }}</td>
              <td class="py-2 font-sans">{{ horasTrabajadas(a) }}</td>
            </tr>
            <tr v-if="!historico.length">
              <td colspan="7" class="py-8 text-center text-slate-400 text-sm">Sin registros en el rango seleccionado.</td>
            </tr>
          </tbody>
        </table>
        <p class="text-[10.5px] text-slate-400 mt-4">{{ historico.length }} registro(s) · documento generado por sistema.</p>
      </div>
    </template>

    <!-- Horas extra -->
    <template v-else>
      <p class="text-xs text-slate-500 bg-slate-50 border border-slate-200 rounded-lg px-4 py-3 mb-4 no-print">
        Sugerencia de cálculo, no un dictamen legal — el criterio exacto de la reforma de jornada tiene puntos sin resolver
        de forma unánime. Valida con tu asesoría laboral antes de usarlo para nómina real.
      </p>
      <div class="flex items-end gap-3 mb-4 flex-wrap no-print">
        <div>
          <label class="block text-[11px] font-bold uppercase text-slate-500 mb-1">Desde</label>
          <input v-model="desde" type="date" class="border border-slate-300 rounded-lg px-2.5 min-h-[42px]" @change="cargarHorasExtra" />
        </div>
        <div>
          <label class="block text-[11px] font-bold uppercase text-slate-500 mb-1">Hasta</label>
          <input v-model="hasta" type="date" class="border border-slate-300 rounded-lg px-2.5 min-h-[42px]" @change="cargarHorasExtra" />
        </div>
        <button class="min-h-[42px] bg-primary text-white text-sm font-bold rounded-lg px-4 ml-auto no-print" @click="imprimir">Imprimir / Guardar PDF</button>
      </div>

      <div class="print-sheet bg-white border border-slate-200 rounded-xl p-5 mb-5">
        <ReportePrintHeader titulo="Horas extra (sugerencia)" :subtitulo="`${desde || '…'} — ${hasta || '…'}`" />
        <table class="w-full text-sm tabular-nums">
          <thead>
            <tr class="text-[11px] uppercase tracking-wide text-slate-500 border-b border-slate-300">
              <th class="text-left py-2 font-normal font-sans">Personal</th>
              <th class="text-left py-2 font-normal font-sans">Semana (inicia)</th>
              <th class="text-left py-2 font-normal font-sans">Horas trabajadas</th>
              <th class="text-left py-2 font-normal font-sans">Ordinarias</th>
              <th class="text-left py-2 font-normal font-sans">Dobles</th>
              <th class="text-left py-2 font-normal font-sans">Triples</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="s in horasExtra" :key="`${s.trabajadorId}-${s.semanaInicio}`" class="border-b border-slate-100">
              <td class="py-2 font-semibold">{{ s.trabajadorNombre }}</td>
              <td class="py-2 font-sans">{{ formatoFecha(s.semanaInicio) }}</td>
              <td class="py-2 font-sans">{{ s.horasTrabajadas }} h</td>
              <td class="py-2 font-sans">{{ s.horasOrdinarias }} h</td>
              <td class="py-2 font-sans" :class="s.horasDobles > 0 ? 'text-warning font-semibold' : ''">{{ s.horasDobles }} h</td>
              <td class="py-2 font-sans" :class="s.horasTriples > 0 ? 'text-danger font-semibold' : ''">{{ s.horasTriples }} h</td>
            </tr>
            <tr v-if="!horasExtra.length">
              <td colspan="6" class="py-8 text-center text-slate-400 text-sm">Sin jornadas completas (entrada + salida) en el rango seleccionado.</td>
            </tr>
          </tbody>
        </table>
      </div>

      <div v-if="auth.rol === 'direccion'" class="bg-white border border-slate-200 rounded-xl p-5 no-print">
        <h3 class="text-sm font-display mb-1">Configuración de jornada vigente</h3>
        <p class="text-xs text-slate-500 mb-4">Calendario de la reforma (editable si cambia o si tu asesoría laboral confirma un criterio distinto).</p>
        <table class="w-full text-sm mb-4">
          <thead>
            <tr class="bg-slate-50 text-[11px] uppercase tracking-wide text-slate-500">
              <th class="text-left px-3 py-2 font-normal">Vigente desde</th>
              <th class="text-left px-3 py-2 font-normal">Jornada semanal</th>
              <th class="text-left px-3 py-2 font-normal">Tope de dobles</th>
              <th class="text-left px-3 py-2 font-normal">Notas</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="c in configJornada" :key="c.id" class="border-t border-slate-200">
              <td class="px-3 py-2 font-semibold">{{ formatoFecha(c.vigente_desde) }}</td>
              <td class="px-3 py-2">{{ c.jornada_semanal_horas }} h</td>
              <td class="px-3 py-2">{{ c.limite_semanal_dobles_horas }} h</td>
              <td class="px-3 py-2 text-slate-500 text-xs">{{ c.notas || '—' }}</td>
            </tr>
          </tbody>
        </table>
        <form class="grid sm:grid-cols-5 gap-3 items-end" @submit.prevent="agregarConfig">
          <div>
            <label class="block text-[11px] font-bold uppercase text-slate-500 mb-1">Vigente desde</label>
            <input v-model="nuevaConfig.vigenteDesde" type="date" required class="w-full border border-slate-300 rounded-lg px-2.5 min-h-[42px]" />
          </div>
          <div>
            <label class="block text-[11px] font-bold uppercase text-slate-500 mb-1">Jornada semanal (h)</label>
            <input v-model.number="nuevaConfig.jornadaSemanalHoras" type="number" step="0.5" required class="w-full border border-slate-300 rounded-lg px-2.5 min-h-[42px]" />
          </div>
          <div>
            <label class="block text-[11px] font-bold uppercase text-slate-500 mb-1">Tope de dobles (h)</label>
            <input v-model.number="nuevaConfig.limiteSemanalDoblesHoras" type="number" step="0.5" required class="w-full border border-slate-300 rounded-lg px-2.5 min-h-[42px]" />
          </div>
          <div>
            <label class="block text-[11px] font-bold uppercase text-slate-500 mb-1">Notas</label>
            <input v-model="nuevaConfig.notas" class="w-full border border-slate-300 rounded-lg px-2.5 min-h-[42px]" />
          </div>
          <button type="submit" class="min-h-[42px] bg-primary text-white font-bold rounded-lg px-5 text-sm">+ Agregar</button>
        </form>
      </div>
    </template>

    <!-- Modal de corrección -->
    <div v-if="correccion.abierto" class="fixed inset-0 bg-black/40 flex items-center justify-center z-50 no-print" @click.self="correccion.abierto = false">
      <div class="bg-white rounded-xl p-5 w-full max-w-sm">
        <h3 class="text-sm font-display mb-1">Corregir marca de {{ correccion.nombre }}</h3>
        <p class="text-xs text-slate-500 mb-4">La marca original queda conservada — esto solo agrega una corrección documentada.</p>
        <label class="block text-[11px] font-bold uppercase text-slate-500 mb-1">Campo</label>
        <select v-model="correccion.campo" class="w-full border border-slate-300 rounded-lg px-2.5 min-h-[42px] mb-3">
          <option value="hora_entrada">Entrada</option>
          <option value="hora_inicio_comida">Inicio de comida</option>
          <option value="hora_fin_comida">Fin de comida</option>
          <option value="hora_salida">Salida</option>
        </select>
        <label class="block text-[11px] font-bold uppercase text-slate-500 mb-1">Nueva hora</label>
        <input v-model="correccion.valorNuevo" type="datetime-local" class="w-full border border-slate-300 rounded-lg px-2.5 min-h-[42px] mb-3" />
        <label class="block text-[11px] font-bold uppercase text-slate-500 mb-1">Motivo (obligatorio)</label>
        <textarea v-model="correccion.motivo" rows="2" class="w-full border border-slate-300 rounded-lg px-2.5 py-2 mb-3" placeholder="Ej. se le olvidó marcar y confirmó su hora real con el residente"></textarea>
        <p v-if="correccion.error" class="text-xs text-danger mb-3">{{ correccion.error }}</p>
        <div class="flex gap-2">
          <button class="flex-1 min-h-[42px] bg-primary text-white font-bold rounded-lg text-sm disabled:opacity-50" :disabled="correccion.guardando" @click="guardarCorreccion">
            {{ correccion.guardando ? 'Guardando…' : 'Guardar corrección' }}
          </button>
          <button class="min-h-[42px] px-4 border border-slate-300 rounded-lg text-sm" @click="correccion.abierto = false">Cancelar</button>
        </div>
      </div>
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
const horasExtra = ref([]);
const configJornada = ref([]);
const nuevaConfig = reactive({ vigenteDesde: '', jornadaSemanalHoras: null, limiteSemanalDoblesHoras: null, notas: '' });

const correccion = reactive({ abierto: false, asistenciaId: null, nombre: '', campo: 'hora_entrada', valorNuevo: '', motivo: '', guardando: false, error: '' });

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
  // Columnas DATE puras se sirven como medianoche UTC — se fuerza timeZone: 'UTC' para no
  // "retroceder" un día en zonas horarias negativas (ej. Hermosillo, UTC-7).
  return new Date(fechaIso).toLocaleDateString('es-MX', { day: '2-digit', month: 'short', year: 'numeric', timeZone: 'UTC' });
}
function horasTrabajadas(a) {
  if (!a.hora_entrada || !a.hora_salida) return '—';
  const msComida = a.hora_inicio_comida && a.hora_fin_comida ? new Date(a.hora_fin_comida) - new Date(a.hora_inicio_comida) : 0;
  const ms = new Date(a.hora_salida) - new Date(a.hora_entrada) - msComida;
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

async function cargarHorasExtra() {
  const { data } = await api.get('/asistencias/horas-extra', { params: { desde: desde.value, hasta: hasta.value } });
  horasExtra.value = Array.isArray(data) ? data : [];
}

async function cargarConfig() {
  const { data } = await api.get('/configuracion-jornada');
  configJornada.value = data;
}

async function agregarConfig() {
  try {
    await api.post('/configuracion-jornada', nuevaConfig);
    Object.assign(nuevaConfig, { vigenteDesde: '', jornadaSemanalHoras: null, limiteSemanalDoblesHoras: null, notas: '' });
    await cargarConfig();
  } catch (err) {
    error.value = err.response?.data?.error || 'No se pudo guardar la configuración.';
  }
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

async function marcarComida(p, momento) {
  error.value = '';
  mensaje.value = '';
  marcando.value = p.trabajador_id;
  try {
    await api.post(`/asistencias/comida-${momento}`, { trabajadorId: p.trabajador_id, fecha: fecha.value });
    mensaje.value = `${momento === 'inicio' ? 'Inicio' : 'Fin'} de comida registrado para ${p.nombre}.`;
    await cargarChecador();
  } catch (err) {
    error.value = err.response?.data?.error || 'No se pudo registrar la comida.';
  } finally {
    marcando.value = null;
  }
}

function abrirCorreccion(p) {
  Object.assign(correccion, { abierto: true, asistenciaId: p.asistencia_id, nombre: p.nombre, campo: 'hora_entrada', valorNuevo: '', motivo: '', error: '' });
}

async function guardarCorreccion() {
  correccion.error = '';
  if (!correccion.valorNuevo) { correccion.error = 'Captura la nueva hora.'; return; }
  if (!correccion.motivo.trim() || correccion.motivo.trim().length < 5) { correccion.error = 'El motivo es obligatorio (mínimo 5 caracteres).'; return; }
  correccion.guardando = true;
  try {
    await api.post(`/asistencias/${correccion.asistenciaId}/corregir`, {
      campo: correccion.campo,
      valorNuevo: new Date(correccion.valorNuevo).toISOString(),
      motivo: correccion.motivo.trim(),
    });
    correccion.abierto = false;
    mensaje.value = 'Corrección guardada.';
    await cargarChecador();
  } catch (err) {
    correccion.error = err.response?.data?.error || 'No se pudo guardar la corrección.';
  } finally {
    correccion.guardando = false;
  }
}

onMounted(async () => {
  const { data } = await api.get('/catalogo/obras');
  obras.value = data.map((o) => ({ id: o.id, nombre: o.nombre }));
  await cargarChecador();
});
</script>
