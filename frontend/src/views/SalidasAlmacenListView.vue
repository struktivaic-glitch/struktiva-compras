<template>
  <AppShell>
    <div class="flex items-center justify-between mb-4">
      <h2 class="font-display text-[36px]">Salidas de almacén</h2>
      <RouterLink to="/almacen/salidas/nueva" class="min-h-[30px] flex items-center bg-primary text-white text-[13px] font-bold rounded-lg px-4">
        + Nueva salida
      </RouterLink>
    </div>

    <div class="overflow-x-auto bg-white border border-slate-200 rounded-xl">
      <table class="w-full text-sm">
        <thead>
          <tr class="bg-slate-50 text-[11px] uppercase tracking-wide text-slate-500">
            <th class="text-left px-4 py-2.5 font-normal">Folio</th>
            <th class="text-left px-4 py-2.5 font-normal">Obra / Frente</th>
            <th class="text-left px-4 py-2.5 font-normal">Recibió</th>
            <th class="text-left px-4 py-2.5 font-normal">Fecha</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="s in salidas" :key="s.id" class="border-t border-slate-200">
            <td class="px-4 py-2.5 font-semibold tabular-nums">{{ s.folio }}</td>
            <td class="px-4 py-2.5">{{ s.obra_nombre }} / {{ s.frente_nombre }}</td>
            <td class="px-4 py-2.5">{{ s.usuario_recibe_nombre }}</td>
            <td class="px-4 py-2.5 tabular-nums">{{ new Date(s.fecha).toLocaleDateString('es-MX') }}</td>
            <td class="px-4 py-2.5"><RouterLink :to="`/almacen/salidas/${s.id}`" class="text-xs font-semibold text-primary underline">Ver</RouterLink></td>
          </tr>
          <tr v-if="!cargando && salidas.length === 0">
            <td colspan="5" class="px-4 py-8 text-center text-slate-400 text-sm">No hay salidas de almacén todavía.</td>
          </tr>
        </tbody>
      </table>
    </div>
  </AppShell>
</template>

<script setup>
import { onMounted, ref } from 'vue';
import AppShell from '../components/AppShell.vue';
import { api } from '../lib/api.js';

const salidas = ref([]);
const cargando = ref(true);

onMounted(async () => {
  const { data } = await api.get('/salidas-almacen');
  salidas.value = data;
  cargando.value = false;
});
</script>
