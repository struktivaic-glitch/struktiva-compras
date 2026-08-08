<template>
  <AppShell>
    <div class="flex items-center justify-between mb-4 flex-wrap gap-3 no-print">
      <div>
        <h2 class="font-display text-[36px]">Nómina</h2>
        <p class="text-xs text-slate-500">Control interno de gasto de personal — no calcula ISR/IMSS ni sustituye un recibo fiscal.</p>
      </div>
      <div class="flex items-center gap-2">
        <select v-model="estatusFiltro" class="text-sm border border-slate-300 rounded-lg px-2.5 py-2" @change="cargar">
          <option value="">Todos los estatus</option>
          <option value="borrador">Borrador</option>
          <option value="pagada">Pagada</option>
          <option value="cancelada">Cancelada</option>
        </select>
        <button class="min-h-[39px] bg-primary text-white text-sm font-bold rounded-lg px-4" @click="imprimir">Imprimir / Guardar PDF</button>
        <RouterLink v-if="puedeCapturar" to="/pagos-personal/nueva" class="min-h-[30px] flex items-center bg-primary text-white text-[13px] font-bold rounded-lg px-4">
          + Generar nómina
        </RouterLink>
      </div>
    </div>

    <div class="print-sheet bg-white border border-slate-200 rounded-xl overflow-x-auto mb-6">
      <ReportePrintHeader titulo="Nómina" :subtitulo="estatusFiltro ? `Estatus: ${ESTATUS_TEXTO[estatusFiltro]}` : 'Todos los estatus'" class="p-5 pb-0" />
      <table class="w-full text-sm tabular-nums">
        <thead>
          <tr class="bg-slate-50 text-[11px] uppercase tracking-wide text-slate-500">
            <th class="text-left px-4 py-2.5 font-normal">Folio</th>
            <th class="text-left px-4 py-2.5 font-normal">Periodo</th>
            <th class="text-left px-4 py-2.5 font-normal">Fechas</th>
            <th class="text-left px-4 py-2.5 font-normal">Personal</th>
            <th class="text-left px-4 py-2.5 font-normal">Total</th>
            <th class="text-left px-4 py-2.5 font-normal">Estatus</th>
            <th class="text-left px-4 py-2.5 font-normal no-print"></th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="n in nominas" :key="n.id" class="border-t border-slate-200">
            <td class="px-4 py-2.5 font-semibold">{{ n.folio }}</td>
            <td class="px-4 py-2.5 capitalize">{{ n.periodo_tipo }}</td>
            <td class="px-4 py-2.5">{{ formatoFecha(n.fecha_inicio) }} — {{ formatoFecha(n.fecha_fin) }}</td>
            <td class="px-4 py-2.5">{{ n.personal_count }}</td>
            <td class="px-4 py-2.5 font-semibold">{{ mxn(n.total) }}</td>
            <td class="px-4 py-2.5">
              <span class="inline-flex text-[11.5px] font-bold px-2.5 py-0.5 rounded-full" :class="estatusClase(n.estatus)">{{ ESTATUS_TEXTO[n.estatus] }}</span>
            </td>
            <td class="px-4 py-2.5 no-print"><RouterLink :to="`/pagos-personal/${n.id}`" class="text-xs font-semibold text-primary underline">Ver</RouterLink></td>
          </tr>
          <tr v-if="!cargando && nominas.length === 0">
            <td colspan="7" class="px-4 py-8 text-center text-slate-400 text-sm">Sin nóminas generadas todavía.</td>
          </tr>
        </tbody>
        <tfoot v-if="nominas.length">
          <tr class="border-t border-slate-300 font-bold">
            <td class="px-4 py-2.5" colspan="4">Total</td>
            <td class="px-4 py-2.5">{{ mxn(totalNominas) }}</td>
            <td colspan="2"></td>
          </tr>
        </tfoot>
      </table>
    </div>

    <!-- Historial de antes de este bloque (pagos_personal, captura individual) — de solo lectura,
         se queda visible para no perder rastro de lo ya capturado antes de que Nómina generara
         por lote con folio. -->
    <template v-if="historialAnterior.length">
      <h3 class="text-sm font-display mb-2 no-print">Historial anterior (antes de Nómina)</h3>
      <div class="overflow-x-auto bg-white border border-slate-200 rounded-xl no-print">
        <table class="w-full text-sm tabular-nums">
          <thead>
            <tr class="bg-slate-50 text-[11px] uppercase tracking-wide text-slate-500">
              <th class="text-left px-4 py-2.5 font-normal">Personal</th>
              <th class="text-left px-4 py-2.5 font-normal">Concepto</th>
              <th class="text-left px-4 py-2.5 font-normal">Fechas</th>
              <th class="text-left px-4 py-2.5 font-normal">Monto</th>
              <th class="text-left px-4 py-2.5 font-normal">Estatus</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="p in historialAnterior" :key="p.id" class="border-t border-slate-200">
              <td class="px-4 py-2.5 font-semibold">{{ p.trabajador_nombre }}</td>
              <td class="px-4 py-2.5">{{ p.concepto }}</td>
              <td class="px-4 py-2.5">{{ formatoFecha(p.fecha_inicio) }} — {{ formatoFecha(p.fecha_fin) }}</td>
              <td class="px-4 py-2.5">{{ mxn(p.monto) }}</td>
              <td class="px-4 py-2.5">
                <span class="inline-flex text-[11.5px] font-bold px-2.5 py-0.5 rounded-full" :class="p.estatus === 'pagado' ? 'bg-emerald-50 text-success' : 'bg-amber-50 text-warning'">
                  {{ p.estatus === 'pagado' ? 'Pagado' : 'Pendiente' }}
                </span>
              </td>
            </tr>
          </tbody>
        </table>
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
const puedeCapturar = ['residente', 'superintendente', 'direccion'].includes(auth.rol);

const ESTATUS_TEXTO = { borrador: 'Borrador', pagada: 'Pagada', cancelada: 'Cancelada' };

const nominas = ref([]);
const historialAnterior = ref([]);
const estatusFiltro = ref('');
const cargando = ref(true);

const totalNominas = computed(() => nominas.value.reduce((acc, n) => acc + Number(n.total), 0));

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
  cargando.value = true;
  const { data } = await api.get('/nomina', { params: { estatus: estatusFiltro.value || undefined } });
  nominas.value = data;
  cargando.value = false;
}

onMounted(async () => {
  await cargar();
  const { data } = await api.get('/nomina/historial-anterior');
  historialAnterior.value = data;
});
</script>
