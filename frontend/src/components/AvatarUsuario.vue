<template>
  <span class="rounded-full overflow-hidden bg-accent text-[#06282a] font-bold flex items-center justify-center shrink-0" :class="[sizeClass, textSizeClass]">
    <img v-if="fotoUrl" :src="fotoUrl" alt="" class="w-full h-full object-cover" />
    <template v-else>{{ iniciales }}</template>
  </span>
</template>

<script setup>
import { onBeforeUnmount, ref, watch } from 'vue';
import { api } from '../lib/api.js';

const props = defineProps({
  usuarioId: { type: [String, Number], default: null },
  nombre: { type: String, default: '' },
  tieneFoto: { type: Boolean, default: true }, // si se sabe de antemano que no tiene, evita el intento de fetch
  version: { type: [String, Number], default: 0 }, // cambia cuando se sube/quita la foto, para evitar caché vieja
  sizeClass: { type: String, default: 'w-6 h-6' },
  textSizeClass: { type: String, default: 'text-[11px]' },
});

const fotoUrl = ref('');
const iniciales = ref('');

function calcularIniciales(nombre) {
  return (nombre ?? '')
    .split(' ')
    .map((p) => p[0])
    .filter(Boolean)
    .slice(0, 2)
    .join('')
    .toUpperCase();
}

function limpiarUrl() {
  if (fotoUrl.value) URL.revokeObjectURL(fotoUrl.value);
  fotoUrl.value = '';
}

async function cargar() {
  limpiarUrl();
  iniciales.value = calcularIniciales(props.nombre);
  if (!props.usuarioId || !props.tieneFoto) return;
  try {
    const { data } = await api.get(`/usuarios/${props.usuarioId}/foto`, { params: { v: props.version || undefined }, responseType: 'blob' });
    fotoUrl.value = URL.createObjectURL(data);
  } catch {
    // sin foto o error de red — se queda con las iniciales
  }
}

watch(() => [props.usuarioId, props.tieneFoto, props.nombre, props.version], cargar, { immediate: true });
onBeforeUnmount(limpiarUrl);
</script>
