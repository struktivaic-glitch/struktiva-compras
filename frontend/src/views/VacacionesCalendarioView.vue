<template>
  <AppShell>
    <BotonVolver fallback="/trabajadores" />
    <div class="flex items-center justify-between mb-1 flex-wrap gap-2">
      <div>
        <h2 class="font-display text-[36px]">Calendario de vacaciones</h2>
        <p class="text-xs text-slate-500">
          Línea de tiempo del personal de vacaciones, agrupada por oficio — para programar mejor y ver
          quién no está disponible. Da clic en una barra para ajustar sus fechas una vez confirmadas con la persona.
        </p>
      </div>
    </div>

    <div class="flex items-end gap-3 mb-4 flex-wrap">
      <div>
        <label class="block text-[11px] font-bold uppercase text-slate-500 mb-1">Obra</label>
        <select v-model="obraId" class="border border-slate-300 rounded-lg px-2.5 min-h-[42px]" @change="cargar">
          <option :value="null">Todas las obras</option>
          <option v-for="o in obras" :key="o.id" :value="o.id">{{ o.nombre }}</option>
        </select>
      </div>
      <div>
        <label class="block text-[11px] font-bold uppercase text-slate-500 mb-1">Rango</label>
        <select v-model="rango" class="border border-slate-300 rounded-lg px-2.5 min-h-[42px]" @change="cargar">
          <option value="8semanas">Próximas 8 semanas</option>
          <option value="mes">Este mes</option>
          <option value="trimestre">Próximos 3 meses</option>
        </select>
      </div>
      <p class="text-[11px] text-slate-400">{{ formatoFecha(rangoActivo.desde) }} — {{ formatoFecha(rangoActivo.hasta) }}</p>
    </div>

    <p v-if="error" class="bg-red-50 border border-danger/30 text-danger text-sm rounded-lg px-4 py-3 mb-4">{{ error }}</p>

    <div class="flex items-center gap-4 mb-3 text-xs text-slate-500">
      <span class="flex items-center gap-1.5"><span class="w-2.5 h-2.5 rounded-sm bg-primary inline-block"></span> Vacaciones</span>
      <span class="flex items-center gap-1.5"><span class="w-2.5 h-2.5 rounded-sm bg-danger inline-block"></span> Traslape con otra persona del mismo oficio</span>
      <span class="flex items-center gap-1.5"><span class="w-0 h-2.5 border-l-2 border-dashed border-slate-400 inline-block"></span> Hoy</span>
    </div>

    <div v-if="cargando" class="text-sm text-slate-400">Cargando…</div>

    <div v-else-if="!grupos.length" class="bg-white border border-slate-200 rounded-xl p-8 text-center text-sm text-slate-400">
      Sin vacaciones registradas en este rango.
    </div>

    <div v-else class="bg-white border border-slate-200 rounded-xl p-4">
      <div class="grid gap-1 mb-2" style="grid-template-columns: 160px 1fr;">
        <div></div>
        <div class="relative h-4">
          <span
            v-for="(etq, idx) in etiquetasSemana"
            :key="idx"
            class="absolute text-[10px] text-slate-400"
            :style="{ left: etq.pct + '%' }"
          >{{ etq.texto }}</span>
        </div>
      </div>

      <template v-for="grupo in grupos" :key="grupo.oficio">
        <p class="text-xs font-bold uppercase text-slate-500 mt-3 mb-1">{{ grupo.oficio }}</p>
        <div
          v-for="fila in grupo.filas"
          :key="fila.trabajadorId"
          class="grid gap-1 items-center py-1 border-t border-slate-100"
          style="grid-template-columns: 160px 1fr;"
        >
          <RouterLink :to="`/trabajadores/${fila.trabajadorId}`" class="text-[13px] font-semibold text-slate-700 hover:text-primary truncate">
            {{ fila.trabajadorNombre }}
          </RouterLink>
          <div class="relative h-6 bg-slate-50 rounded">
            <div
              v-if="hoyPct !== null"
              class="absolute top-0 bottom-0 border-l-2 border-dashed border-slate-400"
              :style="{ left: hoyPct + '%' }"
            ></div>
            <button
              v-for="p in fila.periodos"
              :key="p.id"
              class="absolute top-0.5 bottom-0.5 rounded text-[10px] text-white font-semibold px-1 truncate text-left"
              :class="p.conflicto ? 'bg-danger' : 'bg-primary'"
              :style="barraEstilo(p)"
              :title="`${formatoFecha(p.fecha_inicio)} — ${formatoFecha(p.fecha_fin)} (${p.dias} día(s))${p.conflicto ? ' · traslapa con otra persona del mismo oficio' : ''}`"
              @click="abrirEdicion(p, fila)"
            >
              {{ formatoFechaCorta(p.fecha_inicio) }}
            </button>
          </div>
        </div>
      </template>
    </div>

    <div v-if="conflictos.length" class="flex flex-col gap-2 mt-4">
      <div v-for="(c, idx) in conflictos" :key="idx" class="flex items-start gap-2 bg-red-50 border border-danger/30 rounded-lg px-3 py-2.5">
        <span class="text-danger">⚠</span>
        <p class="text-[13px] text-danger">
          <b>{{ c.trabajadorA }}</b> y <b>{{ c.trabajadorB }}</b> ({{ c.oficio }}) se traslapan del {{ formatoFecha(c.desde) }} al {{ formatoFecha(c.hasta) }}
        </p>
      </div>
    </div>

    <!-- Modal de edición de fechas -->
    <div v-if="edicion" class="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4" @click.self="edicion = null">
      <div class="bg-white rounded-xl p-5 w-full max-w-sm">
        <h3 class="text-sm font-display mb-1">Ajustar vacaciones — {{ edicion.trabajadorNombre }}</h3>
        <p class="text-[11px] text-slate-400 mb-3">
          Fechas sugeridas al registrarse. Ajusta una vez confirmada la disponibilidad real con la persona.
        </p>
        <p v-if="errorEdicion" class="bg-red-50 border border-danger/30 text-danger text-xs rounded-lg px-3 py-2 mb-3">{{ errorEdicion }}</p>
        <div class="grid grid-cols-2 gap-2 mb-3">
          <div>
            <label class="block text-[11px] font-bold uppercase text-slate-500 mb-1">Desde</label>
            <input v-model="edicion.fechaInicio" type="date" class="w-full border border-slate-300 rounded-lg px-2.5 min-h-[42px]" />
          </div>
          <div>
            <label class="block text-[11px] font-bold uppercase text-slate-500 mb-1">Hasta</label>
            <input v-model="edicion.fechaFin" type="date" class="w-full border border-slate-300 rounded-lg px-2.5 min-h-[42px]" />
          </div>
        </div>
        <div class="mb-4">
          <label class="block text-[11px] font-bold uppercase text-slate-500 mb-1">Días</label>
          <input v-model.number="edicion.dias" type="number" min="0.5" step="0.5" class="w-full border border-slate-300 rounded-lg px-2.5 min-h-[42px]" />
        </div>
        <div class="flex gap-2 justify-between">
          <button class="min-h-[42px] border-[1.5px] border-danger text-danger font-bold rounded-lg px-4 text-sm" :disabled="guardandoEdicion" @click="eliminarEdicion">
            Eliminar
          </button>
          <div class="flex gap-2">
            <button class="min-h-[42px] border border-slate-300 text-slate-600 font-bold rounded-lg px-4 text-sm" @click="edicion = null">Cancelar</button>
            <button class="min-h-[42px] bg-primary text-white font-bold rounded-lg px-4 text-sm disabled:opacity-50" :disabled="guardandoEdicion" @click="guardarEdicion">
              {{ guardandoEdicion ? 'Guardando…' : 'Guardar' }}
            </button>
          </div>
        </div>
      </div>
    </div>
  </AppShell>
</template>

<script setup>
import { computed, ref } from 'vue';
import AppShell from '../components/AppShell.vue';
import BotonVolver from '../components/BotonVolver.vue';
import { api } from '../lib/api.js';

const obras = ref([]);
const obraId = ref(null);
const rango = ref('8semanas');
const periodos = ref([]);
const cargando = ref(false);
const error = ref('');

const edicion = ref(null);
const guardandoEdicion = ref(false);
const errorEdicion = ref('');

function sumarDias(fechaIso, dias) {
  const d = new Date(fechaIso + 'T00:00:00');
  d.setDate(d.getDate() + dias);
  return d.toISOString().slice(0, 10);
}
function hoyIso() {
  return new Date().toISOString().slice(0, 10);
}

const rangoActivo = computed(() => {
  const hoy = hoyIso();
  if (rango.value === 'mes') {
    const d = new Date();
    const desde = new Date(d.getFullYear(), d.getMonth(), 1).toISOString().slice(0, 10);
    const hasta = new Date(d.getFullYear(), d.getMonth() + 1, 0).toISOString().slice(0, 10);
    return { desde, hasta };
  }
  if (rango.value === 'trimestre') return { desde: hoy, hasta: sumarDias(hoy, 90) };
  return { desde: hoy, hasta: sumarDias(hoy, 56) }; // 8 semanas
});

function diasEntre(a, b) {
  return Math.round((new Date(b + 'T00:00:00') - new Date(a + 'T00:00:00')) / 86400000);
}
function formatoFecha(fecha) {
  if (!fecha) return '—';
  return new Date(fecha).toLocaleDateString('es-MX', { day: '2-digit', month: 'short', year: 'numeric', timeZone: 'UTC' });
}
function formatoFechaCorta(fecha) {
  return new Date(fecha).toLocaleDateString('es-MX', { day: '2-digit', month: 'short', timeZone: 'UTC' });
}

const totalDias = computed(() => Math.max(diasEntre(rangoActivo.value.desde, rangoActivo.value.hasta), 1));

const etiquetasSemana = computed(() => {
  const out = [];
  for (let d = 0; d <= totalDias.value; d += 7) {
    out.push({ pct: (d / totalDias.value) * 100, texto: formatoFechaCorta(sumarDias(rangoActivo.value.desde, d)) });
  }
  return out;
});

const hoyPct = computed(() => {
  const offset = diasEntre(rangoActivo.value.desde, hoyIso());
  if (offset < 0 || offset > totalDias.value) return null;
  return (offset / totalDias.value) * 100;
});

function barraEstilo(p) {
  const inicio = Math.max(diasEntre(rangoActivo.value.desde, p.fecha_inicio), 0);
  const fin = Math.min(diasEntre(rangoActivo.value.desde, p.fecha_fin) + 1, totalDias.value);
  const left = (inicio / totalDias.value) * 100;
  const width = Math.max(((fin - inicio) / totalDias.value) * 100, 3);
  return { left: left + '%', width: width + '%' };
}

// Agrupa por oficio → por persona, y marca conflicto cuando dos personas DISTINTAS del mismo
// oficio tienen periodos que se traslapan (el traslape de una misma persona en dos nóminas ya se
// cuida aparte, en el módulo de Nómina).
const grupos = computed(() => {
  const porOficio = new Map();
  for (const p of periodos.value) {
    const oficio = p.oficio?.trim() || 'Sin oficio';
    if (!porOficio.has(oficio)) porOficio.set(oficio, new Map());
    const porTrabajador = porOficio.get(oficio);
    if (!porTrabajador.has(p.trabajador_id)) {
      porTrabajador.set(p.trabajador_id, { trabajadorId: p.trabajador_id, trabajadorNombre: p.trabajador_nombre, periodos: [] });
    }
    porTrabajador.get(p.trabajador_id).periodos.push({ ...p, conflicto: false });
  }

  for (const [, porTrabajador] of porOficio) {
    const todos = [...porTrabajador.values()].flatMap((f) => f.periodos);
    for (let i = 0; i < todos.length; i++) {
      for (let j = i + 1; j < todos.length; j++) {
        const a = todos[i];
        const b = todos[j];
        if (a.trabajador_id === b.trabajador_id) continue;
        const seTraslapan = a.fecha_inicio <= b.fecha_fin && a.fecha_fin >= b.fecha_inicio;
        if (seTraslapan) {
          a.conflicto = true;
          b.conflicto = true;
        }
      }
    }
  }

  return [...porOficio.entries()]
    .map(([oficio, porTrabajador]) => ({
      oficio,
      filas: [...porTrabajador.values()].sort((x, y) => x.trabajadorNombre.localeCompare(y.trabajadorNombre)),
    }))
    .sort((a, b) => a.oficio.localeCompare(b.oficio));
});

const conflictos = computed(() => {
  const out = [];
  for (const grupo of grupos.value) {
    const todos = grupo.filas.flatMap((f) => f.periodos.map((p) => ({ ...p, trabajadorNombre: f.trabajadorNombre })));
    for (let i = 0; i < todos.length; i++) {
      for (let j = i + 1; j < todos.length; j++) {
        const a = todos[i];
        const b = todos[j];
        if (a.trabajador_id === b.trabajador_id) continue;
        const seTraslapan = a.fecha_inicio <= b.fecha_fin && a.fecha_fin >= b.fecha_inicio;
        if (!seTraslapan) continue;
        out.push({
          oficio: grupo.oficio,
          trabajadorA: a.trabajadorNombre,
          trabajadorB: b.trabajadorNombre,
          desde: a.fecha_inicio > b.fecha_inicio ? a.fecha_inicio : b.fecha_inicio,
          hasta: a.fecha_fin < b.fecha_fin ? a.fecha_fin : b.fecha_fin,
        });
      }
    }
  }
  return out;
});

function abrirEdicion(p, fila) {
  errorEdicion.value = '';
  edicion.value = {
    id: p.id,
    trabajadorId: fila.trabajadorId,
    trabajadorNombre: fila.trabajadorNombre,
    fechaInicio: new Date(p.fecha_inicio).toISOString().slice(0, 10),
    fechaFin: new Date(p.fecha_fin).toISOString().slice(0, 10),
    dias: Number(p.dias),
  };
}

async function guardarEdicion() {
  errorEdicion.value = '';
  if (!edicion.value.fechaInicio || !edicion.value.fechaFin || !(edicion.value.dias > 0)) {
    errorEdicion.value = 'Fecha de inicio, fin y días (mayor a cero) son obligatorios.';
    return;
  }
  guardandoEdicion.value = true;
  try {
    await api.put(`/trabajadores/${edicion.value.trabajadorId}/vacaciones/${edicion.value.id}`, {
      fechaInicio: edicion.value.fechaInicio,
      fechaFin: edicion.value.fechaFin,
      dias: edicion.value.dias,
    });
    edicion.value = null;
    await cargar();
  } catch (err) {
    errorEdicion.value = err.response?.data?.error || 'No se pudo guardar el cambio.';
  } finally {
    guardandoEdicion.value = false;
  }
}

async function eliminarEdicion() {
  if (!window.confirm('¿Eliminar este periodo de vacaciones?')) return;
  guardandoEdicion.value = true;
  try {
    await api.delete(`/trabajadores/${edicion.value.trabajadorId}/vacaciones/${edicion.value.id}`);
    edicion.value = null;
    await cargar();
  } catch (err) {
    errorEdicion.value = err.response?.data?.error || 'No se pudo eliminar.';
  } finally {
    guardandoEdicion.value = false;
  }
}

async function cargar() {
  cargando.value = true;
  error.value = '';
  try {
    const { data } = await api.get('/trabajadores/vacaciones-calendario', {
      params: { desde: rangoActivo.value.desde, hasta: rangoActivo.value.hasta, obraId: obraId.value || undefined },
    });
    periodos.value = data;
  } catch (err) {
    error.value = err.response?.data?.error || 'No se pudo cargar el calendario.';
  } finally {
    cargando.value = false;
  }
}

api.get('/catalogo/obras').then(({ data }) => { obras.value = data; });
cargar();
</script>
