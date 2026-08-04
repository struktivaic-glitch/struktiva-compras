<template>
  <div v-if="borradores.length" class="bg-amber-50 border border-warning/40 rounded-xl p-4 mb-5">
    <div class="flex items-center justify-between flex-wrap gap-2 mb-2">
      <div>
        <h3 class="text-sm font-bold text-warning">📴 {{ borradores.length }} borrador(es) guardado(s) sin conexión en este dispositivo</h3>
        <p class="text-xs text-slate-600">Se capturaron cuando no había internet. Sincronízalos para que queden registrados en el sistema.</p>
      </div>
      <button class="min-h-[38px] bg-warning text-white text-xs font-bold rounded-lg px-4 disabled:opacity-50" :disabled="sincronizando" @click="sincronizarTodo">
        {{ sincronizando ? 'Sincronizando…' : 'Sincronizar ahora' }}
      </button>
    </div>
    <ul class="text-xs text-slate-600 space-y-1">
      <li v-for="b in borradores" :key="b.id" class="flex justify-between border-t border-warning/20 pt-1.5">
        <span>{{ b.payload.items.length }} insumo(s) · guardado el {{ new Date(b.creadoEn).toLocaleString('es-MX') }}</span>
        <span v-if="fallidos.has(b.id)" class="text-danger font-semibold">Error al sincronizar</span>
      </li>
    </ul>
  </div>
</template>

<script setup>
import { onMounted, onUnmounted, ref } from 'vue';
import { api } from '../lib/api.js';
import { listarBorradoresLocales, eliminarBorradorLocal } from '../lib/offlineQueue.js';

const emit = defineEmits(['sincronizado']);

const borradores = ref(listarBorradoresLocales());
const sincronizando = ref(false);
const fallidos = ref(new Set());

function refrescar() {
  borradores.value = listarBorradoresLocales();
}

async function sincronizarTodo() {
  sincronizando.value = true;
  fallidos.value = new Set();
  for (const b of borradores.value) {
    try {
      const { data } = await api.post('/requisiciones', b.payload);
      if (b.payload.siguiente === 'enviar') {
        await api.post(`/requisiciones/${data.id}/enviar`);
      }
      eliminarBorradorLocal(b.id);
    } catch {
      fallidos.value.add(b.id);
    }
  }
  refrescar();
  sincronizando.value = false;
  if (fallidos.value.size === 0) emit('sincronizado');
}

function alReconectar() {
  refrescar();
  if (borradores.value.length) sincronizarTodo();
}

onMounted(() => window.addEventListener('online', alReconectar));
onUnmounted(() => window.removeEventListener('online', alReconectar));
</script>
