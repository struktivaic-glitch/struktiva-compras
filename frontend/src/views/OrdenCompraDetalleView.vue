<template>
  <AppShell>
    <div v-if="!oc" class="text-sm text-slate-500">Cargando…</div>
    <template v-else>
      <BotonVolver fallback="/ordenes-compra" />
      <div class="flex items-center justify-between flex-wrap gap-3 mb-1 no-print">
        <div>
          <h2 class="font-display text-[36px]">{{ oc.folio }}</h2>
          <p class="text-xs text-slate-500">
            {{ oc.proveedor_nombre }} ({{ oc.proveedor_rfc || 'sin RFC' }}) · Cotización {{ oc.cotizacion_folio }} ·
            Requisiciones: {{ oc.requisiciones.map(r => r.folio).join(', ') }}
          </p>
        </div>
        <div class="flex items-center gap-2 flex-none">
          <span class="inline-flex text-[11.5px] font-bold px-2.5 py-0.5 rounded-full" :class="oc.estatus === 'confirmada' ? 'bg-emerald-50 text-success' : 'bg-amber-50 text-warning'">
            {{ oc.estatus === 'confirmada' ? 'Confirmada' : 'Borrador' }}
          </span>
          <button class="min-h-[39px] bg-primary text-white text-sm font-bold rounded-lg px-4" @click="imprimir">Imprimir / Guardar PDF</button>
        </div>
      </div>

      <p v-if="error" class="bg-red-50 border border-danger/30 text-danger text-sm rounded-lg px-4 py-3 my-4 no-print">{{ error }}</p>

      <div v-if="oc.estatus === 'borrador' && oc.requiere_autorizacion_monto" class="bg-amber-50 border border-warning/30 text-warning text-sm rounded-lg px-4 py-3 my-4 no-print">
        <p class="mb-1">
          Esta OC es de {{ mxn(oc.importe_total) }} — igual o mayor a $20,000, requiere autorización de Dirección,
          o la excepción de dos firmas (Administrador + Superintendente) para cuando Dirección no pueda firmar.
        </p>
        <p v-if="firmantesExcepcion.length" class="text-xs">
          Firmado por excepción: {{ firmantesExcepcion.join(', ') }} — falta {{ faltanteExcepcionTexto }}.
        </p>
      </div>

      <div class="print-sheet bg-white border border-slate-200 rounded-xl p-5 my-5">
        <ReportePrintHeader
          :titulo="`Orden de Compra ${oc.folio}`"
          :subtitulo="`${oc.proveedor_nombre} (${oc.proveedor_rfc || 'sin RFC'}) · Cotización ${oc.cotizacion_folio} · Requisiciones: ${oc.requisiciones.map(r => r.folio).join(', ')} · Estatus: ${oc.estatus === 'confirmada' ? 'Confirmada' : 'Borrador'}`"
        />
        <table class="w-full text-sm tabular-nums">
          <thead>
            <tr class="bg-slate-50 text-[11px] uppercase tracking-wide text-slate-500">
              <th class="text-left px-4 py-2.5 font-normal font-sans">Insumo</th>
              <th class="text-left px-4 py-2.5 font-normal font-sans">Cant. pedida</th>
              <th class="text-left px-4 py-2.5 font-normal font-sans">Precio negociado</th>
              <th class="text-left px-4 py-2.5 font-normal font-sans">Importe</th>
              <th class="text-left px-4 py-2.5 font-normal font-sans">Surtido</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="d in oc.detalle" :key="d.id" class="border-t border-slate-200">
              <td class="px-4 py-2.5 font-sans font-semibold">{{ d.clave }} · {{ d.descripcion }}</td>
              <td class="px-4 py-2.5">{{ d.cantidad_pedida }} {{ d.unidad }}</td>
              <td class="px-4 py-2.5">{{ mxn(d.precio_negociado) }}</td>
              <td class="px-4 py-2.5">{{ mxn(d.cantidad_pedida * d.precio_negociado) }}</td>
              <td class="px-4 py-2.5">{{ d.cantidad_surtida }} / {{ d.cantidad_pedida }} {{ d.unidad }}</td>
            </tr>
          </tbody>
          <tfoot>
            <tr class="border-t border-slate-300 font-bold">
              <td class="px-4 py-2.5 font-sans" colspan="3">Total</td>
              <td class="px-4 py-2.5">{{ mxn(total) }}</td>
              <td></td>
            </tr>
          </tfoot>
        </table>
      </div>

      <button
        v-if="oc.estatus === 'borrador' && puedeComprar && !oc.requiere_autorizacion_monto"
        class="min-h-[48px] bg-primary text-white font-bold rounded-lg px-5 text-sm no-print"
        :disabled="confirmando"
        @click="confirmar"
      >
        {{ confirmando ? 'Confirmando…' : 'Confirmar Orden de Compra' }}
      </button>

      <button
        v-if="oc.estatus === 'borrador' && oc.requiere_autorizacion_monto && auth.rol === 'direccion'"
        class="min-h-[48px] bg-primary text-white font-bold rounded-lg px-5 text-sm no-print"
        @click="firmaAbierta = true"
      >
        Autorizar y confirmar
      </button>
      <button
        v-if="oc.estatus === 'borrador' && oc.requiere_autorizacion_monto && ['administrador', 'superintendente'].includes(auth.rol)"
        class="min-h-[48px] bg-primary text-white font-bold rounded-lg px-5 text-sm no-print disabled:opacity-50"
        :disabled="yaFirmeExcepcion"
        @click="firmaAbierta = true"
      >
        {{ yaFirmeExcepcion ? 'Ya firmaste esta autorización' : 'Firmar autorización (excepción, 2 firmas)' }}
      </button>

      <FirmaModal
        v-if="firmaAbierta"
        :etiqueta="auth.rol === 'direccion' ? `Autorizar y confirmar ${oc.folio}` : `Firma de excepción (${auth.rol}) para ${oc.folio}`"
        @firmado="autorizarMonto"
        @cerrar="firmaAbierta = false"
        ref="firmaModalRef"
      />
    </template>
  </AppShell>
</template>

<script setup>
import { computed, onMounted, ref } from 'vue';
import { useRoute } from 'vue-router';
import AppShell from '../components/AppShell.vue';
import BotonVolver from '../components/BotonVolver.vue';
import ReportePrintHeader from '../components/ReportePrintHeader.vue';
import FirmaModal from '../components/FirmaModal.vue';
import { api } from '../lib/api.js';
import { useAuthStore } from '../stores/auth.js';

const auth = useAuthStore();
const puedeComprar = ['comprador', 'direccion'].includes(auth.rol);
const route = useRoute();
const oc = ref(null);
const error = ref('');
const confirmando = ref(false);
const firmaAbierta = ref(false);
const firmaModalRef = ref(null);

const total = computed(() => (oc.value?.detalle ?? []).reduce((s, d) => s + d.cantidad_pedida * d.precio_negociado, 0));

const NOMBRES_ROL = { administrador: 'Administrador', superintendente: 'Superintendente', direccion: 'Dirección' };
const firmantesExcepcion = computed(() => (oc.value?.firmas_excepcion ?? []).map((f) => `${NOMBRES_ROL[f.rol] || f.rol} (${f.nombre})`));
const faltanteExcepcionTexto = computed(() => {
  const roles = ['administrador', 'superintendente'];
  const firmados = new Set((oc.value?.firmas_excepcion ?? []).map((f) => f.rol));
  const falta = roles.find((r) => !firmados.has(r));
  return falta ? NOMBRES_ROL[falta] : '';
});
const yaFirmeExcepcion = computed(() => (oc.value?.firmas_excepcion ?? []).some((f) => f.rol === auth.rol));

function mxn(n) {
  return new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN' }).format(n || 0);
}

function imprimir() {
  window.print();
}

async function cargar() {
  const { data } = await api.get(`/ordenes-compra/${route.params.id}`);
  oc.value = data;
}

async function confirmar() {
  error.value = '';
  confirmando.value = true;
  try {
    const { data } = await api.post(`/ordenes-compra/${route.params.id}/confirmar`);
    oc.value = data;
  } catch (err) {
    error.value = err.response?.data?.error || 'No se pudo confirmar la Orden de Compra.';
  } finally {
    confirmando.value = false;
  }
}

async function autorizarMonto(firma) {
  try {
    const { data } = await api.post(`/ordenes-compra/${route.params.id}/autorizar-monto`, { firma });
    oc.value = data;
    firmaAbierta.value = false;
  } catch (err) {
    firmaModalRef.value?.mostrarError(err.response?.data?.error || 'No se pudo registrar la autorización.');
  }
}

onMounted(cargar);
</script>
