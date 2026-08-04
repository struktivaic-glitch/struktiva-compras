<template>
  <div class="flex items-start justify-between border-b-2 border-primary pb-3 mb-4">
    <div class="flex items-center gap-2.5">
      <img src="/brand/logo-horizontal.png" alt="Struktiva Ingeniería y Construcción" class="h-9 w-auto" />
    </div>
    <div class="text-right text-[11.5px] text-slate-500">
      <div class="font-semibold text-slate-800">{{ titulo }}</div>
      <div v-if="subtitulo">{{ subtitulo }}</div>
      <div>Generado: {{ fechaGenerado }}</div>
    </div>
  </div>
</template>

<script setup>
import { computed } from 'vue';

defineProps({ titulo: { type: String, required: true }, subtitulo: { type: String, default: '' } });

const fechaGenerado = computed(() => new Date().toLocaleString('es-MX'));
</script>
