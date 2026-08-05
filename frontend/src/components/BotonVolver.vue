<template>
  <button type="button" class="no-print flex items-center gap-1 text-xs font-semibold text-slate-500 hover:text-primary mb-3" @click="volver">
    <span aria-hidden="true">←</span> Volver
  </button>
</template>

<script setup>
import { useRouter } from 'vue-router';

const props = defineProps({
  // Ruta de respaldo si no hay historial previo dentro de la app (ej. se abrió el enlace
  // directo desde Telegram o se recargó la página) — router.back() no haría nada en ese caso.
  fallback: { type: String, default: '/' },
});

const router = useRouter();

function volver() {
  // window.history.state.back existe si hay una entrada previa en el historial del navegador
  // dentro de esta sesión; si no, evitamos que "Volver" saque al usuario de la app por completo.
  if (window.history.state?.back) {
    router.back();
  } else {
    router.push(props.fallback);
  }
}
</script>
