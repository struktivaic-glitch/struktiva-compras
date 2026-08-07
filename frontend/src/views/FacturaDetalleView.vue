<template>
  <AppShell>
    <div v-if="!factura" class="text-sm text-slate-500">Cargando…</div>
    <template v-else>
      <BotonVolver fallback="/facturas" />
      <div class="flex items-center justify-between flex-wrap gap-3 mb-1">
        <div>
          <h2 class="font-display text-[36px]">{{ factura.folio }}</h2>
          <p class="text-xs text-slate-500">
            {{ factura.proveedor_nombre }} · Contra {{ factura.oc_folio }} ·
            Serie/folio fiscal: {{ factura.serie_folio || '—' }} · UUID: {{ factura.folio_fiscal_uuid || '—' }}
          </p>
        </div>
        <span class="inline-flex text-[11.5px] font-bold px-2.5 py-0.5 rounded-full" :class="estatusClase(factura.estatus_pago)">
          {{ estatusTexto(factura.estatus_pago) }}
        </span>
      </div>

      <div class="flex gap-3 my-4">
        <a v-if="factura.xml_url" :href="factura.xml_url" target="_blank" class="text-xs font-semibold text-primary underline">Descargar XML</a>
        <a v-if="factura.pdf_url" :href="factura.pdf_url" target="_blank" class="text-xs font-semibold text-primary underline">Descargar PDF</a>
      </div>

      <p v-if="factura.entradas?.length" class="text-xs text-slate-500 mb-4">
        Entrada(s) relacionada(s):
        <RouterLink v-for="(e, i) in factura.entradas" :key="e.id" :to="`/almacen/entradas/${e.id}`" class="text-primary underline font-semibold">{{ e.folio }}<span v-if="i < factura.entradas.length - 1">, </span></RouterLink>
      </p>

      <p v-if="error" class="bg-red-50 border border-danger/30 text-danger text-sm rounded-lg px-4 py-3 mb-4">{{ error }}</p>

      <div v-if="factura.hayVariacionSinAutorizar" class="bg-amber-50 border border-warning/30 text-warning text-sm rounded-lg px-4 py-3 mb-4 flex items-center justify-between flex-wrap gap-2">
        <span>Uno o más insumos están 5% o más arriba de lo negociado en la OC. Se necesita autorización de Dirección antes de poder pagarse.</span>
        <button v-if="auth.rol === 'direccion'" class="min-h-[36px] bg-primary text-white text-xs font-bold rounded-lg px-3 flex-none" @click="firmaAbierta = true">
          Autorizar variación de precio
        </button>
      </div>
      <p v-else-if="factura.variacion_precio_autorizada" class="bg-emerald-50 border border-success/30 text-success text-xs rounded-lg px-4 py-2 mb-4">
        Variación de precio autorizada por Dirección.
      </p>

      <div class="overflow-x-auto bg-white border border-slate-200 rounded-xl mb-5">
        <table class="w-full text-sm tabular-nums">
          <thead>
            <tr class="bg-slate-50 text-[11px] uppercase tracking-wide text-slate-500">
              <th class="text-left px-4 py-2.5 font-normal font-sans">Insumo</th>
              <th class="text-left px-4 py-2.5 font-normal font-sans">Cantidad</th>
              <th class="text-left px-4 py-2.5 font-normal font-sans">Precio unitario</th>
              <th class="text-left px-4 py-2.5 font-normal font-sans">Importe</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="d in factura.detalle" :key="d.id" class="border-t border-slate-200">
              <td class="px-4 py-2.5 font-sans font-semibold">{{ d.clave }} · {{ d.descripcion }}</td>
              <td class="px-4 py-2.5">{{ d.cantidad }} {{ d.unidad }}</td>
              <td class="px-4 py-2.5">
                {{ mxn(d.precio_unitario) }}
                <span v-if="d.excede_variacion_precio" class="block text-[10px] font-bold text-danger">▲ {{ d.variacion_pct }}% sobre lo negociado</span>
              </td>
              <td class="px-4 py-2.5">{{ mxn(d.cantidad * d.precio_unitario) }}</td>
            </tr>
          </tbody>
          <tfoot>
            <tr class="border-t border-slate-300">
              <td colspan="3" class="px-4 py-2 font-sans text-slate-500">Subtotal</td>
              <td class="px-4 py-2">{{ mxn(factura.subtotal) }}</td>
            </tr>
            <tr>
              <td colspan="3" class="px-4 py-2 font-sans text-slate-500">IVA</td>
              <td class="px-4 py-2">{{ mxn(factura.iva) }}</td>
            </tr>
            <tr class="font-bold">
              <td colspan="3" class="px-4 py-2 font-sans">Total</td>
              <td class="px-4 py-2">{{ mxn(factura.total) }}</td>
            </tr>
            <tr class="text-success">
              <td colspan="3" class="px-4 py-2 font-sans">Pagado</td>
              <td class="px-4 py-2">{{ mxn(factura.monto_pagado) }}</td>
            </tr>
          </tfoot>
        </table>
      </div>

      <FirmaModal v-if="firmaAbierta" etiqueta="Autorizar variación de precio de la factura" @firmado="autorizarVariacion" @cerrar="firmaAbierta = false" ref="firmaModalRef" />
    </template>
  </AppShell>
</template>

<script setup>
import { onMounted, ref } from 'vue';
import { useRoute } from 'vue-router';
import AppShell from '../components/AppShell.vue';
import BotonVolver from '../components/BotonVolver.vue';
import FirmaModal from '../components/FirmaModal.vue';
import { api } from '../lib/api.js';
import { useAuthStore } from '../stores/auth.js';

const auth = useAuthStore();
const route = useRoute();
const factura = ref(null);
const error = ref('');
const firmaAbierta = ref(false);
const firmaModalRef = ref(null);

async function autorizarVariacion(firma) {
  try {
    const { data } = await api.post(`/facturas/${route.params.id}/autorizar-variacion`, { firma });
    factura.value = data;
    firmaAbierta.value = false;
  } catch (err) {
    firmaModalRef.value?.mostrarError(err.response?.data?.error || 'No se pudo autorizar la variación.');
  }
}

function mxn(n) {
  return new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN' }).format(n || 0);
}
function estatusTexto(e) {
  return { pendiente: 'Pendiente', pagada_parcial: 'Pagada parcial', pagada_total: 'Pagada total' }[e] ?? e;
}
function estatusClase(e) {
  if (e === 'pagada_total') return 'bg-emerald-50 text-success';
  if (e === 'pagada_parcial') return 'bg-amber-50 text-warning';
  return 'bg-slate-100 text-slate-600';
}

onMounted(async () => {
  const { data } = await api.get(`/facturas/${route.params.id}`);
  factura.value = data;
});
</script>
