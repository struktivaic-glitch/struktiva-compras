<template>
  <AppShell>
    <div v-if="!entrada" class="text-sm text-slate-500">Cargando…</div>
    <template v-else>
      <h2 class="font-display text-lg mb-1">{{ entrada.folio }}</h2>
      <p class="text-xs text-slate-500 mb-5">
        Contra {{ entrada.oc_folio }} · {{ entrada.proveedor_nombre }} · Remisión {{ entrada.remision_proveedor }} ·
        Recibió: {{ entrada.recibio_nombre }} · {{ new Date(entrada.fecha).toLocaleDateString('es-MX') }}
      </p>

      <div class="overflow-x-auto bg-white border border-slate-200 rounded-xl">
        <table class="w-full text-sm tabular-nums">
          <thead>
            <tr class="bg-slate-50 text-[11px] uppercase tracking-wide text-slate-500">
              <th class="text-left px-4 py-2.5 font-normal font-sans">Insumo</th>
              <th class="text-left px-4 py-2.5 font-normal font-sans">Cant. recibida</th>
              <th class="text-left px-4 py-2.5 font-normal font-sans">Excedente</th>
              <th class="text-left px-4 py-2.5 font-normal font-sans">Autorizó</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="d in entrada.detalle" :key="d.id" class="border-t border-slate-200">
              <td class="px-4 py-2.5 font-sans font-semibold">{{ d.clave }} · {{ d.descripcion }}</td>
              <td class="px-4 py-2.5">{{ d.cantidad_recibida }} {{ d.unidad }}</td>
              <td class="px-4 py-2.5" :class="Number(d.cantidad_excedente) > 0 ? 'text-warning font-bold' : ''">{{ d.cantidad_excedente }} {{ d.unidad }}</td>
              <td class="px-4 py-2.5 font-sans">{{ d.autorizado_por_nombre || '—' }}</td>
            </tr>
          </tbody>
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
const entrada = ref(null);

onMounted(async () => {
  const { data } = await api.get(`/entradas-almacen/${route.params.id}`);
  entrada.value = data;
});
</script>
