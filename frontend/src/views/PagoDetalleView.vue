<template>
  <AppShell>
    <div v-if="!pago" class="text-sm text-slate-500">Cargando…</div>
    <template v-else>
      <h2 class="font-display text-lg mb-1">{{ pago.folio }}</h2>
      <p class="text-xs text-slate-500 mb-5">
        {{ pago.proveedor_nombre }} · {{ pago.forma_pago }} · {{ pago.referencia || 'sin referencia' }} ·
        Registró: {{ pago.registro_nombre }} · {{ new Date(pago.fecha).toLocaleDateString('es-MX') }}
      </p>

      <div class="overflow-x-auto bg-white border border-slate-200 rounded-xl mb-5">
        <table class="w-full text-sm tabular-nums">
          <thead>
            <tr class="bg-slate-50 text-[11px] uppercase tracking-wide text-slate-500">
              <th class="text-left px-4 py-2.5 font-normal font-sans">Factura</th>
              <th class="text-left px-4 py-2.5 font-normal font-sans">Total factura</th>
              <th class="text-left px-4 py-2.5 font-normal font-sans">Monto aplicado</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="a in pago.aplicaciones" :key="a.factura_id" class="border-t border-slate-200">
              <td class="px-4 py-2.5 font-semibold">{{ a.factura_folio }}</td>
              <td class="px-4 py-2.5">{{ mxn(a.factura_total) }}</td>
              <td class="px-4 py-2.5">{{ mxn(a.monto_aplicado) }}</td>
            </tr>
          </tbody>
          <tfoot>
            <tr class="border-t border-slate-300 font-bold">
              <td class="px-4 py-2.5 font-sans">Total del pago</td>
              <td></td>
              <td class="px-4 py-2.5">{{ mxn(pago.monto) }}</td>
            </tr>
          </tfoot>
        </table>
      </div>
    </template>
  </AppShell>
</template>

<script setup>
import { onMounted, ref } from 'vue';
import { useRoute } from 'vue-router';
import AppShell from '../components/AppShell.vue';
import { api } from '../lib/api.js';

const route = useRoute();
const pago = ref(null);

function mxn(n) {
  return new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN' }).format(n || 0);
}

onMounted(async () => {
  const { data } = await api.get(`/pagos-proveedor/${route.params.id}`);
  pago.value = data;
});
</script>
