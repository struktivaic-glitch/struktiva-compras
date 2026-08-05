<template>
  <AppShell>
    <div class="flex items-center justify-between mb-4 flex-wrap gap-3">
      <h2 class="text-[16px] font-display">Dashboard</h2>
      <div class="flex items-center gap-2">
        <div class="flex items-center gap-1 text-sm">
          <button
            class="min-h-[38px] px-3 rounded-lg font-semibold"
            :class="vista === 'obra' ? 'bg-primary text-white' : 'border border-slate-300 text-slate-600'"
            @click="vista = 'obra'"
          >
            Por obra
          </button>
          <button
            class="min-h-[38px] px-3 rounded-lg font-semibold"
            :class="vista === 'general' ? 'bg-primary text-white' : 'border border-slate-300 text-slate-600'"
            @click="vista = 'general'; cargarResumen()"
          >
            Vista general
          </button>
        </div>
        <select v-if="vista === 'obra' && obras.length" v-model.number="obraId" class="text-sm border border-slate-300 rounded-lg px-2.5 py-2">
          <option v-for="o in obras" :key="o.id" :value="o.id">{{ o.nombre }}</option>
        </select>
      </div>
    </div>

    <!-- Vista general: cada obra activa con sus propios parámetros, sin sumarlas entre sí -->
    <template v-if="vista === 'general'">
      <div v-if="cargandoResumen" class="text-sm text-slate-500">Cargando resumen…</div>
      <div v-else-if="errorResumen" class="bg-red-50 border border-danger/30 text-danger text-sm rounded-lg px-4 py-3">{{ errorResumen }}</div>
      <div v-else class="overflow-x-auto bg-white border border-slate-200 rounded-xl">
        <table class="w-full text-sm tabular-nums">
          <thead>
            <tr class="bg-slate-50 text-[11px] uppercase tracking-wide text-slate-500">
              <th class="text-left px-4 py-2.5 font-normal">Obra</th>
              <th class="text-left px-4 py-2.5 font-normal">Presupuestado</th>
              <th class="text-left px-4 py-2.5 font-normal">Comprometido</th>
              <th class="text-left px-4 py-2.5 font-normal">Saldo disponible</th>
              <th class="text-left px-4 py-2.5 font-normal">Familias en alerta</th>
              <th class="text-left px-4 py-2.5 font-normal">Estatus</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="o in resumenObras" :key="o.id" class="border-t border-slate-200">
              <td class="px-4 py-2.5 font-semibold font-sans">{{ o.nombre }}</td>
              <td class="px-4 py-2.5">{{ mxn(o.presupuestado) }}</td>
              <td class="px-4 py-2.5">{{ mxn(o.aprobado) }}</td>
              <td class="px-4 py-2.5 font-semibold" :class="o.saldo >= 0 ? 'text-success' : 'text-danger'">{{ mxn(o.saldo) }}</td>
              <td class="px-4 py-2.5">{{ o.familias_alerta }}</td>
              <td class="px-4 py-2.5">
                <span class="inline-flex text-[11.5px] font-bold px-2.5 py-0.5 rounded-full" :class="estatusObraClase(o)">
                  {{ estatusObraTexto(o) }}
                </span>
              </td>
            </tr>
            <tr v-if="!resumenObras.length">
              <td colspan="6" class="px-4 py-8 text-center text-slate-400 text-sm font-sans">No hay obras activas.</td>
            </tr>
          </tbody>
        </table>
      </div>
    </template>

    <template v-else>
    <div v-if="cargando" class="text-sm text-slate-500">Cargando saldos…</div>

    <div v-else-if="error" class="bg-red-50 border border-danger/30 text-danger text-sm rounded-lg px-4 py-3">
      {{ error }}
    </div>

    <template v-else>
      <div class="bg-white border border-slate-200 rounded-xl shadow-sm p-5 mb-6">
        <div class="text-xs text-slate-500 mb-1">Fórmula de control · Obra "{{ obraNombre }}"</div>
        <div class="font-display text-[15px]">
          Saldo Disponible = <span class="text-primary font-bold tabular-nums">{{ mxn(totales.presupuestado) }}</span>
          (Presupuestada) − Σ
          <span class="text-primary font-bold tabular-nums">{{ mxn(totales.aprobado) }}</span>
          (Requerida Aprobada) =
          <span class="font-bold tabular-nums" :class="totales.saldo >= 0 ? 'text-success' : 'text-danger'">{{ mxn(totales.saldo) }}</span>
        </div>
      </div>

      <div class="grid grid-cols-2 md:grid-cols-4 gap-3.5 mb-6">
        <div class="bg-white border border-slate-200 rounded-xl shadow-sm p-4">
          <div class="text-[11px] font-bold tracking-wide uppercase text-slate-500">Presupuestado</div>
          <div class="font-display text-2xl tabular-nums">{{ mxn(totales.presupuestado) }}</div>
        </div>
        <div class="bg-white border border-slate-200 rounded-xl shadow-sm p-4">
          <div class="text-[11px] font-bold tracking-wide uppercase text-slate-500">Comprometido</div>
          <div class="font-display text-2xl tabular-nums">{{ mxn(totales.aprobado) }}</div>
        </div>
        <div class="bg-white border border-slate-200 rounded-xl shadow-sm p-4">
          <div class="text-[11px] font-bold tracking-wide uppercase text-slate-500">Saldo disponible</div>
          <div class="font-display text-2xl tabular-nums" :class="totales.saldo >= 0 ? 'text-success' : 'text-danger'">{{ mxn(totales.saldo) }}</div>
        </div>
        <div class="bg-white border border-slate-200 rounded-xl shadow-sm p-4">
          <div class="text-[11px] font-bold tracking-wide uppercase text-slate-500">Familias en alerta</div>
          <div class="font-display text-2xl tabular-nums text-danger">{{ familias.filter(f => f.pct >= 90).length }}</div>
        </div>
      </div>

      <div class="flex items-baseline justify-between mb-2.5">
        <h2 class="text-[16px] font-display">Saldos por familia de insumo</h2>
        <span class="text-[11px] uppercase tracking-wide text-slate-500">{{ obraNombre }}</span>
      </div>

      <div class="overflow-x-auto bg-white border border-slate-200 rounded-xl">
        <table class="w-full text-sm tabular-nums">
          <thead>
            <tr class="bg-slate-50 text-[11px] uppercase tracking-wide text-slate-500">
              <th class="text-left px-4 py-2.5 font-normal">Familia</th>
              <th class="text-left px-4 py-2.5 font-normal">Presupuestado</th>
              <th class="text-left px-4 py-2.5 font-normal">Requerido aprob.</th>
              <th class="text-left px-4 py-2.5 font-normal">% Consumido</th>
              <th class="text-left px-4 py-2.5 font-normal">Estatus</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="f in familias" :key="f.familia" class="border-t border-slate-200">
              <td class="px-4 py-2.5 font-sans">{{ f.familia }}</td>
              <td class="px-4 py-2.5">{{ mxn(f.presupuestado) }}</td>
              <td class="px-4 py-2.5">{{ mxn(f.aprobado) }}</td>
              <td class="px-4 py-2.5">
                <div class="flex items-center gap-2">
                  <div class="w-28 h-1.5 rounded bg-slate-200 overflow-hidden">
                    <div class="h-full rounded" :class="barraColor(f.pct)" :style="{ width: Math.min(f.pct, 100) + '%' }" />
                  </div>
                  <span>{{ f.pct.toFixed(0) }}%</span>
                </div>
              </td>
              <td class="px-4 py-2.5">
                <span class="inline-flex items-center gap-1.5 text-[11.5px] font-bold px-2.5 py-0.5 rounded-full" :class="chipClase(f.pct)">
                  {{ chipTexto(f.pct) }}
                </span>
              </td>
            </tr>
            <tr v-if="familias.length === 0">
              <td colspan="5" class="px-4 py-8 text-center text-slate-400 text-sm font-sans">Esta obra todavía no tiene explosión de insumos importada.</td>
            </tr>
          </tbody>
        </table>
      </div>
    </template>
    </template>
  </AppShell>
</template>

<script setup>
import { onMounted, ref, computed, watch } from 'vue';
import AppShell from '../components/AppShell.vue';
import { api } from '../lib/api.js';

const cargando = ref(true);
const error = ref('');
const obras = ref([]);
const obraId = ref(null);
const familias = ref([]);

const vista = ref('obra'); // 'obra' | 'general'
const resumenObras = ref([]);
const cargandoResumen = ref(false);
const errorResumen = ref('');

function estatusObraTexto(o) {
  if (o.saldo < 0) return 'Excede presupuesto';
  if (o.familias_alerta > 0) return 'Cerca del límite';
  return 'Normal';
}
function estatusObraClase(o) {
  if (o.saldo < 0) return 'bg-red-50 text-danger';
  if (o.familias_alerta > 0) return 'bg-amber-50 text-warning';
  return 'bg-emerald-50 text-success';
}

async function cargarResumen() {
  cargandoResumen.value = true;
  errorResumen.value = '';
  try {
    const { data } = await api.get('/catalogo/obras/resumen');
    resumenObras.value = data.map((o) => {
      const presupuestado = Number(o.presupuestado);
      const aprobado = Number(o.aprobado);
      return { ...o, presupuestado, aprobado, saldo: presupuestado - aprobado, familias_alerta: Number(o.familias_alerta) };
    });
  } catch (err) {
    errorResumen.value = err.response?.data?.error || 'No se pudo cargar el resumen de obras.';
  } finally {
    cargandoResumen.value = false;
  }
}

const obraNombre = computed(() => obras.value.find((o) => o.id === obraId.value)?.nombre ?? '');

const totales = computed(() => {
  const presupuestado = familias.value.reduce((s, f) => s + f.presupuestado, 0);
  const aprobado = familias.value.reduce((s, f) => s + f.aprobado, 0);
  return { presupuestado, aprobado, saldo: presupuestado - aprobado };
});

function mxn(n) {
  return new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN', maximumFractionDigits: 0 }).format(n || 0);
}

function barraColor(pct) {
  if (pct >= 100) return 'bg-danger';
  if (pct >= 90) return 'bg-warning';
  return 'bg-success';
}
function chipClase(pct) {
  if (pct >= 100) return 'bg-red-50 text-danger';
  if (pct >= 90) return 'bg-amber-50 text-warning';
  return 'bg-emerald-50 text-success';
}
function chipTexto(pct) {
  if (pct >= 100) return 'Excede presupuesto';
  if (pct >= 90) return 'Cerca del límite';
  return 'Normal';
}

async function cargarSaldos() {
  if (!obraId.value) return;
  cargando.value = true;
  error.value = '';
  try {
    const { data } = await api.get(`/catalogo/obras/${obraId.value}/saldos-por-familia`);
    familias.value = data.map((f) => {
      const presupuestado = Number(f.presupuestado);
      const aprobado = Number(f.aprobado);
      return { ...f, presupuestado, aprobado, pct: presupuestado > 0 ? (aprobado / presupuestado) * 100 : 0 };
    });
  } catch (err) {
    error.value = err.response?.data?.error || 'No se pudieron cargar los saldos (¿está corriendo el backend y Postgres?).';
  } finally {
    cargando.value = false;
  }
}
watch(obraId, cargarSaldos);

onMounted(async () => {
  try {
    const { data } = await api.get('/catalogo/obras');
    obras.value = data;
    obraId.value = data[0]?.id ?? null;
    if (!obraId.value) {
      error.value = 'No hay obras configuradas todavía.';
      cargando.value = false;
    }
  } catch (err) {
    error.value = err.response?.data?.error || 'No se pudo cargar el catálogo de obras.';
    cargando.value = false;
  }
});
</script>
