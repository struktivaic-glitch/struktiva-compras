<template>
  <div class="relative">
    <button
      class="relative w-[54px] h-[54px] rounded-full bg-white/10 border border-white/20 flex items-center justify-center hover:bg-white/20"
      title="Notificaciones"
      @click="abierto = !abierto"
    >
      <span class="text-[24px] leading-none">🔔</span>
      <span
        v-if="resumen.totalNoLeidas > 0"
        class="absolute -top-1 -right-1 min-w-[27px] h-[27px] px-1 rounded-full bg-brand-red text-white text-[15px] font-bold flex items-center justify-center"
      >
        {{ resumen.totalNoLeidas > 99 ? '99+' : resumen.totalNoLeidas }}
      </span>
    </button>

    <div
      v-if="abierto"
      class="absolute right-0 mt-2 w-80 max-w-[90vw] bg-white text-slate-800 rounded-xl border border-slate-200 shadow-lg overflow-hidden z-50"
    >
      <div class="px-4 py-2.5 border-b border-slate-100 flex items-center justify-between">
        <b class="text-sm font-display">Notificaciones</b>
        <button v-if="resumen.totalNoLeidas > 0" class="text-[11px] text-primary underline" @click="marcarTodasLeidas">
          Marcar todo leído
        </button>
      </div>

      <div class="max-h-96 overflow-y-auto">
        <p v-if="cargando" class="px-4 py-6 text-sm text-slate-400 text-center">Cargando…</p>
        <p v-else-if="!items.length" class="px-4 py-6 text-sm text-slate-400 text-center">Sin novedades por ahora.</p>
        <button
          v-for="n in items"
          :key="n.id"
          class="w-full text-left px-4 py-3 border-t border-slate-100 first:border-t-0 hover:bg-slate-50 flex gap-2"
          :class="!n.leida && 'bg-sky-50/60'"
          @click="irA(n)"
        >
          <span class="mt-0.5 w-2 h-2 rounded-full flex-none" :class="n.leida ? 'bg-transparent' : 'bg-accent'"></span>
          <span class="flex-1 min-w-0">
            <span class="block text-[13px] font-semibold leading-snug">{{ n.titulo }}</span>
            <span v-if="n.mensaje" class="block text-[12px] text-slate-500 leading-snug">{{ n.mensaje }}</span>
            <span class="block text-[10.5px] text-slate-400 mt-0.5">{{ formatoFecha(n.creado_en) }}</span>
          </span>
        </button>
      </div>

      <RouterLink
        to="/notificaciones"
        class="block text-center text-[12.5px] font-semibold text-primary py-2.5 border-t border-slate-100 hover:bg-slate-50"
        @click="abierto = false"
      >
        Ver todas
      </RouterLink>
    </div>
  </div>
</template>

<script setup>
import { onBeforeUnmount, onMounted, ref } from 'vue';
import { useRouter } from 'vue-router';
import { api } from '../lib/api.js';

const router = useRouter();
const abierto = ref(false);
const cargando = ref(false);
const items = ref([]);
const resumen = ref({ totalNoLeidas: 0, porCategoria: {} });
let intervalo = null;

const RUTA_POR_CATEGORIA = {
  requisicion: '/requisiciones',
  excedente: '/requisiciones',
  cancelacion: '/requisiciones',
  orden_compra: '/ordenes-compra',
  cambio_precio: '/cotizaciones',
};

function formatoFecha(fecha) {
  const d = new Date(fecha);
  return d.toLocaleString('es-MX', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' });
}

async function cargarResumen() {
  const { data } = await api.get('/notificaciones/resumen');
  resumen.value = data;
}

async function cargarLista() {
  cargando.value = true;
  try {
    const { data } = await api.get('/notificaciones');
    items.value = data.slice(0, 8);
  } finally {
    cargando.value = false;
  }
}

async function marcarTodasLeidas() {
  await api.post('/notificaciones/marcar-todas-leidas', {});
  await Promise.all([cargarResumen(), cargarLista()]);
}

async function irA(n) {
  if (!n.leida) {
    await api.post(`/notificaciones/${n.id}/leida`);
    await cargarResumen();
  }
  abierto.value = false;
  router.push(RUTA_POR_CATEGORIA[n.categoria] ?? '/notificaciones');
}

function alHacerClicFuera(ev) {
  if (!ev.target.closest('.relative')) abierto.value = false;
}

onMounted(() => {
  cargarResumen();
  cargarLista();
  intervalo = setInterval(cargarResumen, 60000);
  document.addEventListener('click', alHacerClicFuera);
});

onBeforeUnmount(() => {
  clearInterval(intervalo);
  document.removeEventListener('click', alHacerClicFuera);
});
</script>
