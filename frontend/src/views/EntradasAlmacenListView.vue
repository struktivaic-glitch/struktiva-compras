<template>
  <AppShell>
    <div class="flex items-center justify-between mb-4">
      <h2 class="font-display text-[36px]">Entradas de almacén</h2>
      <RouterLink to="/almacen/entradas/nueva" class="min-h-[30px] flex items-center bg-primary text-white text-[13px] font-bold rounded-lg px-4">
        + Nueva entrada
      </RouterLink>
    </div>

    <div class="overflow-x-auto bg-white border border-slate-200 rounded-xl">
      <table class="w-full text-sm">
        <thead>
          <tr class="bg-slate-50 text-[11px] uppercase tracking-wide text-slate-500">
            <th class="text-left px-4 py-2.5 font-normal">Folio</th>
            <th class="text-left px-4 py-2.5 font-normal">OC</th>
            <th class="text-left px-4 py-2.5 font-normal">Proveedor</th>
            <th class="text-left px-4 py-2.5 font-normal">Remisión</th>
            <th class="text-left px-4 py-2.5 font-normal">Fecha</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="e in entradas" :key="e.id" class="border-t border-slate-200">
            <td class="px-4 py-2.5 font-semibold tabular-nums">
              {{ e.folio }}
              <span v-if="e.tiene_excedente" class="ml-1.5 text-[10px] font-bold text-warning">● excedente autorizado</span>
            </td>
            <td class="px-4 py-2.5">{{ e.oc_folio }}</td>
            <td class="px-4 py-2.5">{{ e.proveedor_nombre }}</td>
            <td class="px-4 py-2.5 tabular-nums">{{ e.remision_proveedor }}</td>
            <td class="px-4 py-2.5 tabular-nums">{{ new Date(e.fecha).toLocaleDateString('es-MX') }}</td>
            <td class="px-4 py-2.5"><RouterLink :to="`/almacen/entradas/${e.id}`" class="text-xs font-semibold text-primary underline">Ver</RouterLink></td>
          </tr>
          <tr v-if="!cargando && entradas.length === 0">
            <td colspan="6" class="px-4 py-8 text-center text-slate-400 text-sm">No hay entradas de almacén todavía.</td>
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

const entradas = ref([]);
const cargando = ref(true);

onMounted(async () => {
  const { data } = await api.get('/entradas-almacen');
  entradas.value = data;
  cargando.value = false;
});
</script>
