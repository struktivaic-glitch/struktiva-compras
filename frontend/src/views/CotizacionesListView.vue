<template>
  <AppShell>
    <div class="flex items-center justify-between mb-4">
      <h2 class="font-display text-[36px]">Cotizaciones</h2>
      <RouterLink to="/cotizaciones/nueva" class="min-h-[30px] flex items-center bg-primary text-white text-[13px] font-bold rounded-lg px-4">
        + Nuevo cuadro comparativo
      </RouterLink>
    </div>

    <div class="overflow-x-auto bg-white border border-slate-200 rounded-xl">
      <table class="w-full text-sm">
        <thead>
          <tr class="bg-slate-50 text-[11px] uppercase tracking-wide text-slate-500">
            <th class="text-left px-4 py-2.5 font-normal">Folio</th>
            <th class="text-left px-4 py-2.5 font-normal">Obra</th>
            <th class="text-left px-4 py-2.5 font-normal">Proveedores cotizando</th>
            <th class="text-left px-4 py-2.5 font-normal">Estatus</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="c in cotizaciones" :key="c.id" class="border-t border-slate-200">
            <td class="px-4 py-2.5 font-semibold tabular-nums">{{ c.folio }}</td>
            <td class="px-4 py-2.5">{{ c.obra_nombre }}</td>
            <td class="px-4 py-2.5 tabular-nums">{{ c.num_proveedores }}</td>
            <td class="px-4 py-2.5">
              <span class="inline-flex text-[11.5px] font-bold px-2.5 py-0.5 rounded-full" :class="c.estatus === 'cerrado' ? 'bg-emerald-50 text-success' : 'bg-amber-50 text-warning'">
                {{ c.estatus === 'cerrado' ? 'Cerrado' : 'En cotización' }}
              </span>
            </td>
            <td class="px-4 py-2.5">
              <RouterLink :to="`/cotizaciones/${c.id}`" class="text-xs font-semibold text-primary underline">Abrir</RouterLink>
            </td>
          </tr>
          <tr v-if="!cargando && cotizaciones.length === 0">
            <td colspan="5" class="px-4 py-8 text-center text-slate-400 text-sm">No hay procesos de cotización todavía.</td>
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

const cotizaciones = ref([]);
const cargando = ref(true);

onMounted(async () => {
  const { data } = await api.get('/cotizaciones');
  cotizaciones.value = data;
  cargando.value = false;
});
</script>
