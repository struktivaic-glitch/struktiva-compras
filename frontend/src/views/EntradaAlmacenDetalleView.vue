<template>
  <AppShell>
    <div v-if="!entrada" class="text-sm text-slate-500">Cargando…</div>
    <template v-else>
      <BotonVolver fallback="/almacen/entradas" />
      <h2 class="font-display text-[36px] mb-1">{{ entrada.folio }}</h2>
      <p class="text-xs text-slate-500 mb-5">
        Contra {{ entrada.oc_folio }} · {{ entrada.proveedor_nombre }} · Remisión {{ entrada.remision_proveedor }} ·
        Recibió: {{ entrada.recibio_nombre }} · {{ new Date(entrada.fecha).toLocaleDateString('es-MX') }}
      </p>

      <div class="overflow-x-auto bg-white border border-slate-200 rounded-xl mb-5">
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

      <div class="bg-white border border-slate-200 rounded-xl p-5">
        <h3 class="text-sm font-display mb-1">Fotos de evidencia</h3>
        <p class="text-xs text-slate-500 mb-4">Remisión del proveedor y estado del embarque recibido. Puedes subir varias de cada tipo.</p>

        <div v-for="grupo in gruposFoto" :key="grupo.tipo" class="mb-5 last:mb-0">
          <div class="flex items-center justify-between mb-2">
            <span class="text-xs font-bold uppercase tracking-wide text-slate-500">{{ grupo.label }}</span>
            <label class="min-h-[30px] flex items-center bg-primary text-white text-[13px] font-bold rounded-lg px-3 cursor-pointer disabled:opacity-50" :class="{ 'opacity-50 pointer-events-none': subiendo === grupo.tipo }">
              {{ subiendo === grupo.tipo ? 'Subiendo…' : '+ Tomar / subir foto' }}
              <input type="file" accept="image/*" capture="environment" class="hidden" :disabled="subiendo === grupo.tipo" @change="subirFoto($event, grupo.tipo)" />
            </label>
          </div>
          <div v-if="fotosPorTipo(grupo.tipo).length" class="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div v-for="f in fotosPorTipo(grupo.tipo)" :key="f.id" class="relative group">
              <img v-if="miniaturas[f.id]" :src="miniaturas[f.id]" class="w-full aspect-square object-cover rounded-lg border border-slate-200 cursor-pointer" @click="verFoto(f)" />
              <div v-else class="w-full aspect-square rounded-lg border border-slate-200 bg-slate-50 animate-pulse"></div>
              <button class="absolute top-1 right-1 w-6 h-6 rounded-full bg-black/60 text-white text-xs leading-none" @click="eliminarFoto(f)" title="Eliminar">✕</button>
            </div>
          </div>
          <p v-else class="text-sm text-slate-400">Sin fotos de {{ grupo.label.toLowerCase() }} todavía.</p>
        </div>
      </div>
    </template>
  </AppShell>
</template>

<script setup>
import { onBeforeUnmount, onMounted, reactive, ref } from 'vue';
import { useRoute } from 'vue-router';
import AppShell from '../components/AppShell.vue';
import BotonVolver from '../components/BotonVolver.vue';
import { api } from '../lib/api.js';

const route = useRoute();
const entrada = ref(null);
const subiendo = ref(null);
// El endpoint de fotos requiere el JWT (va en el header, vía el interceptor de axios), así que un
// <img src="..."> directo no funciona (no manda el header) — igual que AvatarUsuario.vue, se trae
// cada foto como blob y se arma un object URL en memoria, cacheado por id.
const miniaturas = reactive({});

const gruposFoto = [
  { tipo: 'remision', label: 'Remisión del proveedor' },
  { tipo: 'embarque', label: 'Embarque recibido' },
];

function fotosPorTipo(tipo) {
  return (entrada.value?.fotos || []).filter((f) => f.tipo === tipo);
}

async function cargarMiniatura(f) {
  if (miniaturas[f.id]) return;
  try {
    const { data } = await api.get(`/entradas-almacen/${route.params.id}/fotos/${f.id}`, { responseType: 'blob' });
    miniaturas[f.id] = URL.createObjectURL(data);
  } catch {
    // si falla, se queda el placeholder — no bloquea el resto de la pantalla
  }
}

async function cargar() {
  const { data } = await api.get(`/entradas-almacen/${route.params.id}`);
  entrada.value = data;
  await Promise.all((data.fotos || []).map(cargarMiniatura));
}

async function subirFoto(ev, tipo) {
  const archivo = ev.target.files?.[0];
  ev.target.value = '';
  if (!archivo) return;
  subiendo.value = tipo;
  try {
    const form = new FormData();
    form.append('tipo', tipo);
    form.append('archivo', archivo);
    await api.post(`/entradas-almacen/${route.params.id}/fotos`, form);
    await cargar();
  } catch (err) {
    window.alert(err.response?.data?.error || 'No se pudo subir la foto.');
  } finally {
    subiendo.value = null;
  }
}

async function verFoto(f) {
  window.open(miniaturas[f.id] || '', '_blank');
}

async function eliminarFoto(f) {
  if (!window.confirm('¿Eliminar esta foto?')) return;
  try {
    await api.delete(`/entradas-almacen/${route.params.id}/fotos/${f.id}`);
    if (miniaturas[f.id]) { URL.revokeObjectURL(miniaturas[f.id]); delete miniaturas[f.id]; }
    await cargar();
  } catch (err) {
    window.alert(err.response?.data?.error || 'No se pudo eliminar la foto.');
  }
}

onMounted(cargar);
onBeforeUnmount(() => {
  for (const url of Object.values(miniaturas)) URL.revokeObjectURL(url);
});
</script>
