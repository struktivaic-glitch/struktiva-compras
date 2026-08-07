<template>
  <AppShell>
    <div v-if="!req" class="text-sm text-slate-500">Cargando…</div>
    <template v-else>
      <BotonVolver fallback="/requisiciones" />
      <div class="flex items-center justify-between flex-wrap gap-3 mb-1 no-print">
        <div>
          <h2 class="font-display text-[36px]">
            {{ req.folio }}
            <span v-if="hayExcedente" class="ml-1.5 text-[11px] font-bold text-danger align-middle">● excede presupuesto</span>
          </h2>
          <p class="text-xs text-slate-500">
            {{ req.obra_nombre }} / {{ req.frente_nombre }} / {{ req.partida_clave }} — {{ req.partida_nombre }}
          </p>
          <p class="text-xs text-slate-500 mt-0.5">
            Solicitante: {{ req.solicitante_nombre }} · Creada: {{ formatoFecha(req.creado_en) }}
          </p>
        </div>
        <div class="flex items-center gap-2 flex-none">
          <span class="inline-flex text-[11.5px] font-bold px-2.5 py-0.5 rounded-full" :class="estatusClase(req.estatus)">
            {{ estatusTexto(req.estatus) }}
          </span>
          <button class="min-h-[39px] bg-primary text-white text-sm font-bold rounded-lg px-4" @click="imprimir">Imprimir / Guardar PDF</button>
        </div>
      </div>

      <p v-if="error" class="bg-red-50 border border-danger/30 text-danger text-sm rounded-lg px-4 py-3 my-4 no-print">{{ error }}</p>
      <p v-if="mensaje" class="bg-emerald-50 border border-success/30 text-success text-sm rounded-lg px-4 py-3 my-4 no-print">{{ mensaje }}</p>

      <div class="print-sheet bg-white border border-slate-200 rounded-xl p-5 my-5">
        <ReportePrintHeader
          :titulo="`Requisición ${req.folio}`"
          :subtitulo="`${req.obra_nombre} / ${req.frente_nombre} / ${req.partida_clave} — ${req.partida_nombre} · Solicitante: ${req.solicitante_nombre} · Estatus: ${estatusTexto(req.estatus)}`"
        />

        <div class="text-xs text-slate-600 mb-4 space-y-1">
          <div>Creada: {{ formatoFecha(req.creado_en) }} por {{ req.solicitante_nombre }}</div>
          <div v-if="req.autoriza_nombre">Autorizó: <b>{{ req.autoriza_nombre }}</b> — {{ formatoFecha(req.fecha_autorizacion) }}</div>
          <div v-if="req.estatus === 'cancelada'">
            Canceló: <b>{{ req.cancelado_por_nombre || '—' }}</b> — {{ formatoFecha(req.fecha_cancelacion) }}
            <template v-if="req.motivo_cancelacion"> · Motivo: {{ req.motivo_cancelacion }}</template>
          </div>
          <div v-for="f in firmas" :key="f.id">
            Firma ({{ f.tipo === 'tactil' ? 'táctil' : 'PIN' }}): <b>{{ f.usuario_nombre }}</b> — {{ formatoFecha(f.creado_en) }}
            · Ubicación: {{ f.gps_lat != null ? `${Number(f.gps_lat).toFixed(5)}, ${Number(f.gps_lng).toFixed(5)}` : 'no disponible' }}
            <template v-if="f.ip"> · IP: {{ f.ip }}</template>
          </div>
        </div>

        <!-- Materiales: tabla plana de insumos -->
        <table v-if="req.tipo !== 'nomina'" class="w-full text-sm tabular-nums">
          <thead>
            <tr class="bg-slate-50 text-[11px] uppercase tracking-wide text-slate-500">
              <th class="text-left px-4 py-2.5 font-normal font-sans">Insumo</th>
              <th class="text-left px-4 py-2.5 font-normal font-sans">Cant. requerida</th>
              <th class="text-left px-4 py-2.5 font-normal font-sans">Cant. aprobada</th>
              <th class="text-left px-4 py-2.5 font-normal font-sans">P.U.</th>
              <th class="text-left px-4 py-2.5 font-normal font-sans">Total sugerido</th>
              <th class="text-left px-4 py-2.5 font-normal font-sans">Saldo disponible</th>
              <th class="text-left px-4 py-2.5 font-normal font-sans">Estado</th>
            </tr>
          </thead>
          <tbody>
            <template v-for="d in req.detalle" :key="d.id">
              <tr class="border-t border-slate-200">
                <td class="px-4 py-2.5 font-sans font-semibold">{{ d.clave }} · {{ d.descripcion }}</td>
                <td class="px-4 py-2.5">{{ d.cantidad_requerida }} {{ d.unidad }}</td>
                <td class="px-4 py-2.5">{{ d.cantidad_aprobada != null ? `${d.cantidad_aprobada} ${d.unidad}` : '—' }}</td>
                <td class="px-4 py-2.5">{{ d.precio_unitario != null ? mxn(d.precio_unitario) : '—' }}</td>
                <td class="px-4 py-2.5 font-semibold">{{ mxn(d.total_sugerido) }}</td>
                <td class="px-4 py-2.5">{{ d.saldo_disponible }} {{ d.unidad }}</td>
                <td class="px-4 py-2.5">
                  <span v-if="d.excede_presupuesto" class="text-[11px] font-bold text-danger">Excede</span>
                  <span v-else class="text-[11px] text-slate-400">Normal</span>
                </td>
              </tr>
              <tr v-if="d.excede_presupuesto && d.justificacion" class="border-t border-slate-100 bg-red-50/40">
                <td colspan="7" class="px-4 py-2 text-xs text-slate-600 font-sans"><b>Justificación:</b> {{ d.justificacion }}</td>
              </tr>
            </template>
          </tbody>
          <tfoot>
            <tr class="border-t border-slate-300 font-bold">
              <td class="px-4 py-2.5 font-sans" colspan="4">Total sugerido de la requisición</td>
              <td class="px-4 py-2.5">{{ mxn(totalRequisicion) }}</td>
              <td></td>
              <td></td>
            </tr>
          </tfoot>
        </table>

        <!-- Nómina: árbol Partida → Renglón de Mano de Obra → Personal -->
        <div v-else>
          <div v-for="d in req.detalle" :key="d.id" class="border border-slate-200 rounded-lg p-3 mb-3">
            <div class="flex items-center justify-between mb-1">
              <span class="font-semibold text-sm font-sans">{{ d.clave }} · {{ d.descripcion }}</span>
              <span v-if="d.excede_presupuesto" class="text-[11px] font-bold text-danger">Excede</span>
              <span v-else class="text-[11px] text-slate-400">Normal</span>
            </div>
            <table class="w-full text-sm tabular-nums mt-1">
              <thead>
                <tr class="text-[10.5px] uppercase tracking-wide text-slate-400">
                  <th class="text-left py-1 font-normal font-sans">Persona</th>
                  <th class="text-left py-1 font-normal font-sans">Días</th>
                  <th class="text-left py-1 font-normal font-sans">Tarifa diaria</th>
                  <th class="text-left py-1 font-normal font-sans">Monto</th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="p in d.personal" :key="p.id" class="border-t border-slate-100">
                  <td class="py-1.5 font-sans">{{ p.nombre }}</td>
                  <td class="py-1.5">{{ p.dias_trabajados }}</td>
                  <td class="py-1.5">{{ mxn(p.tarifa_diaria) }}</td>
                  <td class="py-1.5 font-semibold">{{ mxn(p.monto) }}</td>
                </tr>
              </tbody>
            </table>
            <p class="text-sm font-bold mt-1.5">Total del renglón: {{ mxn(d.total_sugerido) }}</p>
            <p v-if="d.excede_presupuesto && d.justificacion" class="text-xs text-slate-600 font-sans mt-1"><b>Justificación:</b> {{ d.justificacion }}</p>
          </div>
          <p class="text-sm font-display font-bold">Total de Nómina: {{ mxn(totalRequisicion) }}</p>
        </div>

        <template v-if="req.personal?.length">
          <h3 class="text-sm font-display mt-5 mb-2">Personal asignado (Mano de Obra)</h3>
          <table class="w-full text-sm tabular-nums">
            <thead>
              <tr class="bg-slate-50 text-[11px] uppercase tracking-wide text-slate-500">
                <th class="text-left px-4 py-2.5 font-normal font-sans">Nombre</th>
                <th class="text-left px-4 py-2.5 font-normal font-sans">Oficio</th>
                <th class="text-left px-4 py-2.5 font-normal font-sans">Monto</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="p in req.personal" :key="p.id" class="border-t border-slate-200">
                <td class="px-4 py-2.5 font-sans font-semibold">{{ p.nombre }}</td>
                <td class="px-4 py-2.5 font-sans text-slate-500">{{ p.oficio || '—' }}</td>
                <td class="px-4 py-2.5">{{ mxn(p.monto) }}</td>
              </tr>
            </tbody>
            <tfoot>
              <tr class="border-t border-slate-300 font-bold">
                <td class="px-4 py-2.5 font-sans" colspan="2">Total</td>
                <td class="px-4 py-2.5">{{ mxn(totalPersonal) }}</td>
              </tr>
            </tfoot>
          </table>
        </template>
      </div>

      <div class="flex flex-wrap gap-2 no-print">
        <RouterLink :to="`/expediente/${req.id}`" class="min-h-[30px] flex items-center border border-slate-300 text-slate-600 font-bold rounded-lg px-5 text-[13px]">
          Ver expediente completo
        </RouterLink>
        <button
          v-if="req.estatus === 'borrador' && puedeModificar"
          class="min-h-[44px] bg-primary text-white font-bold rounded-lg px-5 text-sm"
          @click="accion('enviar')"
        >
          Enviar a autorizar
        </button>
        <button
          v-if="req.estatus === 'pendiente_autorizacion' && puedeAutorizar"
          class="min-h-[44px] bg-success text-white font-bold rounded-lg px-5 text-sm"
          @click="mostrarFirma = true"
        >
          Autorizar
        </button>
        <button
          v-if="!['atendida_parcial', 'atendida_total', 'cancelada'].includes(req.estatus) && puedeModificar"
          class="min-h-[44px] border border-danger text-danger font-bold rounded-lg px-5 text-sm"
          @click="mostrarCancelar = true"
        >
          Cancelar
        </button>
      </div>

      <FirmaModal
        v-if="mostrarFirma"
        class="no-print"
        :etiqueta="`Autorizando ${req.folio}`"
        ref="firmaModalRef"
        @firmado="autorizarConFirma"
        @cerrar="mostrarFirma = false"
      />

      <div v-if="mostrarCancelar" class="fixed inset-0 bg-black/40 flex items-center justify-center z-50 no-print" @click.self="mostrarCancelar = false">
        <div class="bg-white rounded-xl p-5 w-full max-w-sm">
          <h3 class="text-sm font-display mb-1">Cancelar {{ req.folio }}</h3>
          <p class="text-xs text-slate-500 mb-4">El motivo queda registrado y visible en la impresión de la requisición.</p>
          <label class="block text-[11px] font-bold uppercase text-slate-500 mb-1">Motivo (opcional)</label>
          <textarea v-model="motivoCancelacion" rows="3" class="w-full border border-slate-300 rounded-lg px-2.5 py-2 mb-3" placeholder="Ej. ya no se requiere el material"></textarea>
          <div class="flex gap-2">
            <button class="flex-1 min-h-[42px] border border-danger text-danger font-bold rounded-lg text-sm disabled:opacity-50" :disabled="cancelando" @click="confirmarCancelacion">
              {{ cancelando ? 'Cancelando…' : 'Confirmar cancelación' }}
            </button>
            <button class="min-h-[42px] px-4 border border-slate-300 rounded-lg text-sm" @click="mostrarCancelar = false">Volver</button>
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
import FirmaModal from '../components/FirmaModal.vue';
import ReportePrintHeader from '../components/ReportePrintHeader.vue';
import { api } from '../lib/api.js';
import { useAuthStore } from '../stores/auth.js';

const auth = useAuthStore();
const route = useRoute();
const req = ref(null);
const error = ref('');
const mensaje = ref('');
const mostrarFirma = ref(false);
const firmaModalRef = ref(null);
const firmas = ref([]);
const mostrarCancelar = ref(false);
const motivoCancelacion = ref('');
const cancelando = ref(false);

function imprimir() {
  window.print();
}

const hayExcedente = computed(() => (req.value?.detalle ?? []).some((d) => d.excede_presupuesto));
const totalPersonal = computed(() => (req.value?.personal ?? []).reduce((acc, p) => acc + Number(p.monto), 0));
const totalRequisicion = computed(() => (req.value?.detalle ?? []).reduce((acc, d) => acc + Number(d.total_sugerido ?? 0), 0));
function mxn(n) {
  return new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN' }).format(n || 0);
}
const puedeAutorizar = computed(() => ['superintendente', 'direccion'].includes(auth.rol));
const puedeModificar = computed(() => req.value?.usuario_solicitante_id === auth.usuario?.id || auth.rol === 'direccion');

const ESTATUS_TEXTO = {
  borrador: 'Borrador',
  pendiente_autorizacion: 'Pend. autorización',
  autorizada: 'Autorizada',
  atendida_parcial: 'Atendida parcial',
  atendida_total: 'Atendida total',
  cancelada: 'Cancelada',
};
function estatusTexto(e) {
  return ESTATUS_TEXTO[e] ?? e;
}
function estatusClase(e) {
  if (e === 'autorizada' || e === 'atendida_total') return 'bg-emerald-50 text-success';
  if (e === 'pendiente_autorizacion' || e === 'atendida_parcial') return 'bg-amber-50 text-warning';
  if (e === 'cancelada') return 'bg-slate-100 text-slate-500';
  return 'bg-slate-100 text-slate-600';
}
function formatoFecha(fecha) {
  if (!fecha) return '';
  return new Date(fecha).toLocaleString('es-MX', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}

async function cargar() {
  const { data } = await api.get(`/requisiciones/${route.params.id}`);
  req.value = data;
  const { data: firmasData } = await api.get('/firmas', { params: { entidadTipo: 'requisicion', entidadId: data.id } });
  firmas.value = firmasData;
}

async function accion(tipo) {
  error.value = '';
  mensaje.value = '';
  try {
    await api.post(`/requisiciones/${req.value.id}/${tipo}`);
    mensaje.value = tipo === 'enviar' ? 'Enviada a autorización.' : 'Requisición cancelada.';
    await cargar();
  } catch (err) {
    error.value = err.response?.data?.error || 'No se pudo completar la acción.';
  }
}

async function confirmarCancelacion() {
  error.value = '';
  mensaje.value = '';
  cancelando.value = true;
  try {
    await api.post(`/requisiciones/${req.value.id}/cancelar`, { motivo: motivoCancelacion.value });
    mostrarCancelar.value = false;
    motivoCancelacion.value = '';
    mensaje.value = 'Requisición cancelada.';
    await cargar();
  } catch (err) {
    error.value = err.response?.data?.error || 'No se pudo cancelar.';
  } finally {
    cancelando.value = false;
  }
}

async function autorizarConFirma(firma) {
  try {
    await api.post(`/requisiciones/${req.value.id}/autorizar`, { firma });
    mostrarFirma.value = false;
    mensaje.value = 'Requisición autorizada.';
    await cargar();
  } catch (err) {
    firmaModalRef.value?.mostrarError(err.response?.data?.error || 'No se pudo autorizar.');
  }
}

onMounted(cargar);
</script>
