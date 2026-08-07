<template>
  <AppShell>
    <div class="flex items-center justify-between mb-4 flex-wrap gap-3">
      <h2 class="font-display text-[36px]">Salidas de almacén</h2>
      <RouterLink to="/almacen/salidas/nueva" class="min-h-[30px] flex items-center bg-primary text-white text-[13px] font-bold rounded-lg px-4">
        + Nueva salida
      </RouterLink>
    </div>

    <div class="bg-white border border-slate-200 rounded-xl p-3 mb-4 flex items-end gap-3 flex-wrap">
      <div>
        <label class="block text-[11px] font-bold uppercase text-slate-500 mb-1">Quién recibió</label>
        <input v-model="filtros.usuarioRecibeNombre" placeholder="Nombre de la persona…" class="border border-slate-300 rounded-lg px-2.5" @keyup.enter="cargar" @blur="cargar" />
      </div>
      <div>
        <label class="block text-[11px] font-bold uppercase text-slate-500 mb-1">Obra</label>
        <select v-model="filtros.obraId" class="border border-slate-300 rounded-lg px-2.5" @change="cargar">
          <option :value="null">Todas</option>
          <option v-for="o in obras" :key="o.id" :value="o.id">{{ o.nombre }}</option>
        </select>
      </div>
      <div>
        <label class="block text-[11px] font-bold uppercase text-slate-500 mb-1">Desde</label>
        <input v-model="filtros.desde" type="date" class="border border-slate-300 rounded-lg px-2.5" @change="cargar" />
      </div>
      <div>
        <label class="block text-[11px] font-bold uppercase text-slate-500 mb-1">Hasta</label>
        <input v-model="filtros.hasta" type="date" class="border border-slate-300 rounded-lg px-2.5" @change="cargar" />
      </div>
      <button v-if="filtros.usuarioRecibeNombre || filtros.obraId || filtros.desde || filtros.hasta" class="text-xs font-semibold text-primary underline" @click="limpiarFiltros">Quitar filtros</button>
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
            <td colspan="5" class="px-4 py-8 text-center text-slate-400 text-sm">
              {{ filtros.usuarioRecibeNombre || filtros.obraId || filtros.desde || filtros.hasta ? 'Sin salidas con esos filtros.' : 'No hay salidas de almacén todavía.' }}
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  </AppShell>
</template>

<script setup>
import { onMounted, reactive, ref } from 'vue';
import AppShell from '../components/AppShell.vue';
import { api } from '../lib/api.js';

const salidas = ref([]);
const obras = ref([]);
const cargando = ref(true);
const filtros = reactive({ usuarioRecibeNombre: '', obraId: null, desde: '', hasta: '' });

async function cargar() {
  cargando.value = true;
  const { data } = await api.get('/salidas-almacen', {
    params: {
      usuarioRecibeNombre: filtros.usuarioRecibeNombre.trim() || undefined,
      obraId: filtros.obraId || undefined,
      desde: filtros.desde || undefined,
      hasta: filtros.hasta || undefined,
    },
  });
  salidas.value = data;
  cargando.value = false;
}

function limpiarFiltros() {
  filtros.usuarioRecibeNombre = '';
  filtros.obraId = null;
  filtros.desde = '';
  filtros.hasta = '';
  cargar();
}

onMounted(async () => {
  const { data } = await api.get('/catalogo/obras');
  obras.value = data;
  await cargar();
});
</script>
