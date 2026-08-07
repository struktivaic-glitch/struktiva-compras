<template>
  <AppShell>
    <div v-if="!salida" class="text-sm text-slate-500">Cargando…</div>
    <template v-else>
      <BotonVolver fallback="/almacen/salidas" />
      <h2 class="font-display text-[36px] mb-1">{{ salida.folio }}</h2>
      <p class="text-xs text-slate-500 mb-5">
        {{ salida.obra_nombre }} / {{ salida.frente_nombre }} · Entregó: {{ salida.entrego_nombre }} · Recibió: {{ salida.usuario_recibe_nombre }} ·
        {{ new Date(salida.fecha).toLocaleDateString('es-MX') }}
      </p>

      <div class="overflow-x-auto bg-white border border-slate-200 rounded-xl">
        <table class="w-full text-sm tabular-nums">
          <thead>
            <tr class="bg-slate-50 text-[11px] uppercase tracking-wide text-slate-500">
              <th class="text-left px-4 py-2.5 font-normal font-sans">Insumo</th>
              <th class="text-left px-4 py-2.5 font-normal font-sans">Cant. entregada</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="d in salida.detalle" :key="d.id" class="border-t border-slate-200">
              <td class="px-4 py-2.5 font-sans font-semibold">{{ d.clave }} · {{ d.descripcion }}</td>
              <td class="px-4 py-2.5">{{ d.cantidad_entregada }} {{ d.unidad }}</td>
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
import BotonVolver from '../components/BotonVolver.vue';
import { api } from '../lib/api.js';

const route = useRoute();
const salida = ref(null);

onMounted(async () => {
  const { data } = await api.get(`/salidas-almacen/${route.params.id}`);
  salida.value = data;
});
</script>
