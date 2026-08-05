<template>
  <AppShell>
    <div v-if="!req" class="text-sm text-slate-500">Cargando…</div>
    <template v-else>
      <div class="flex items-center justify-between flex-wrap gap-3 mb-1">
        <div>
          <h2 class="font-display text-lg">
            {{ req.folio }}
            <span v-if="hayExcedente" class="ml-1.5 text-[11px] font-bold text-danger align-middle">● excede presupuesto</span>
          </h2>
          <p class="text-xs text-slate-500">
            {{ req.obra_nombre }} / {{ req.frente_nombre }} / {{ req.partida_clave }} — {{ req.partida_nombre }}
          </p>
          <p class="text-xs text-slate-500 mt-0.5">
            Solicitante: {{ req.solicitante_nombre }} · Creada: {{ formatoFecha(req.creado_en) }}
            <template v-if="req.autoriza_nombre"> · Autorizó: {{ req.autoriza_nombre }} ({{ formatoFecha(req.fecha_autorizacion) }})</template>
          </p>
        </div>
        <span class="inline-flex text-[11.5px] font-bold px-2.5 py-0.5 rounded-full flex-none" :class="estatusClase(req.estatus)">
          {{ estatusTexto(req.estatus) }}
        </span>
      </div>

      <p v-if="error" class="bg-red-50 border border-danger/30 text-danger text-sm rounded-lg px-4 py-3 my-4">{{ error }}</p>
      <p v-if="mensaje" class="bg-emerald-50 border border-success/30 text-success text-sm rounded-lg px-4 py-3 my-4">{{ mensaje }}</p>

      <div class="overflow-x-auto bg-white border border-slate-200 rounded-xl my-5">
        <table class="w-full text-sm tabular-nums">
          <thead>
            <tr class="bg-slate-50 text-[11px] uppercase tracking-wide text-slate-500">
              <th class="text-left px-4 py-2.5 font-normal font-sans">Insumo</th>
              <th class="text-left px-4 py-2.5 font-normal font-sans">Cant. requerida</th>
              <th class="text-left px-4 py-2.5 font-normal font-sans">Cant. aprobada</th>
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
                <td class="px-4 py-2.5">{{ d.saldo_disponible }} {{ d.unidad }}</td>
                <td class="px-4 py-2.5">
                  <span v-if="d.excede_presupuesto" class="text-[11px] font-bold text-danger">Excede</span>
                  <span v-else class="text-[11px] text-slate-400">Normal</span>
                </td>
              </tr>
              <tr v-if="d.excede_presupuesto && d.justificacion" class="border-t border-slate-100 bg-red-50/40">
                <td colspan="5" class="px-4 py-2 text-xs text-slate-600 font-sans"><b>Justificación:</b> {{ d.justificacion }}</td>
              </tr>
            </template>
          </tbody>
        </table>
      </div>

      <div class="flex flex-wrap gap-2">
        <RouterLink :to="`/expediente/${req.id}`" class="min-h-[44px] flex items-center border border-slate-300 text-slate-600 font-bold rounded-lg px-5 text-sm">
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
          @click="accion('cancelar')"
        >
          Cancelar
        </button>
      </div>

      <FirmaModal
        v-if="mostrarFirma"
        :etiqueta="`Autorizando ${req.folio}`"
        ref="firmaModalRef"
        @firmado="autorizarConFirma"
        @cerrar="mostrarFirma = false"
      />
    </template>
  </AppShell>
</template>

<script setup>
import { computed, onMounted, ref } from 'vue';
import { useRoute } from 'vue-router';
import AppShell from '../components/AppShell.vue';
import FirmaModal from '../components/FirmaModal.vue';
import { api } from '../lib/api.js';
import { useAuthStore } from '../stores/auth.js';

const auth = useAuthStore();
const route = useRoute();
const req = ref(null);
const error = ref('');
const mensaje = ref('');
const mostrarFirma = ref(false);
const firmaModalRef = ref(null);

const hayExcedente = computed(() => (req.value?.detalle ?? []).some((d) => d.excede_presupuesto));
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
