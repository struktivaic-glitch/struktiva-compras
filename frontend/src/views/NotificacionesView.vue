<template>
  <AppShell>
    <h2 class="font-display text-[36px] mb-4">Notificaciones</h2>

    <div class="flex gap-1 overflow-x-auto mb-5 bg-white border border-slate-200 rounded-xl p-1">
      <button
        v-for="cat in CATEGORIAS"
        :key="cat.clave"
        class="px-3.5 py-2 rounded-lg text-[13px] font-semibold flex-none whitespace-nowrap flex items-center gap-1.5"
        :class="categoriaActiva === cat.clave ? 'bg-primary text-white' : 'text-slate-500 hover:bg-slate-50'"
        @click="categoriaActiva = cat.clave"
      >
        {{ cat.label }}
        <span
          v-if="resumen.porCategoria[cat.clave]?.noLeidas"
          class="min-w-[18px] h-[18px] px-1 rounded-full text-[10px] font-bold flex items-center justify-center"
          :class="categoriaActiva === cat.clave ? 'bg-white/25' : 'bg-brand-red text-white'"
        >
          {{ resumen.porCategoria[cat.clave].noLeidas }}
        </span>
      </button>
    </div>

    <div class="flex items-center justify-between mb-3">
      <p class="text-xs text-slate-500">{{ CATEGORIAS.find((c) => c.clave === categoriaActiva)?.descripcion }}</p>
      <button
        v-if="resumen.porCategoria[categoriaActiva]?.noLeidas"
        class="text-[12px] font-semibold text-primary underline flex-none"
        @click="marcarTodasLeidas"
      >
        Marcar esta categoría como leída
      </button>
    </div>

    <div class="bg-white border border-slate-200 rounded-xl divide-y divide-slate-100">
      <p v-if="cargando" class="px-4 py-8 text-sm text-slate-400 text-center">Cargando…</p>
      <p v-else-if="!items.length" class="px-4 py-8 text-sm text-slate-400 text-center">Sin novedades en esta categoría todavía.</p>
      <button
        v-for="n in items"
        :key="n.id"
        class="w-full text-left px-4 py-3.5 hover:bg-slate-50 flex gap-3"
        @click="irA(n)"
      >
        <span class="mt-1 w-2 h-2 rounded-full flex-none" :class="n.leida ? 'bg-transparent' : 'bg-accent'"></span>
        <span class="flex-1 min-w-0">
          <span class="block text-sm font-semibold">{{ n.titulo }}</span>
          <span v-if="n.mensaje" class="block text-[13px] text-slate-500 mt-0.5">{{ n.mensaje }}</span>
          <span class="block text-[11px] text-slate-400 mt-1">{{ formatoFecha(n.creado_en) }}</span>
        </span>
      </button>
    </div>
  </AppShell>
</template>

<script setup>
import { onMounted, ref, watch } from 'vue';
import { useRouter } from 'vue-router';
import AppShell from '../components/AppShell.vue';
import { api } from '../lib/api.js';

const router = useRouter();

const CATEGORIAS = [
  { clave: 'requisicion', label: 'Requisiciones', descripcion: 'Requisiciones pendientes de tu autorización.', ruta: '/requisiciones' },
  { clave: 'excedente', label: 'Excedente', descripcion: 'Ajustes de presupuesto excedido autorizados por Superintendencia o Dirección.', ruta: '/requisiciones' },
  { clave: 'orden_compra', label: 'Órdenes de compra', descripcion: 'Órdenes de compra de $20,000 o más, pendientes de autorización de Dirección (o excepción de dos firmas).', ruta: '/ordenes-compra' },
  { clave: 'cambio_precio', label: 'Cambio de precio', descripcion: 'Variaciones de precio (5% o más) en cotizaciones y facturas, pendientes de autorización de Dirección.', ruta: '/cotizaciones' },
  { clave: 'avance_obra', label: 'Avance de obra', descripcion: 'Avances físicos que superan lo contratado, pendientes de autorización de Superintendencia/Dirección.', ruta: '/avance-obra' },
  { clave: 'cancelacion', label: 'Cancelaciones', descripcion: 'Avisos informativos de requisiciones canceladas.', ruta: '/requisiciones' },
  { clave: 'incidencia', label: 'Incidencias', descripcion: 'Faltas, permisos, vacaciones e incapacidades pendientes de autorización.', ruta: '/incidencias' },
];

const categoriaActiva = ref('requisicion');
const items = ref([]);
const cargando = ref(false);
const resumen = ref({ totalNoLeidas: 0, porCategoria: {} });

function formatoFecha(fecha) {
  const d = new Date(fecha);
  return d.toLocaleString('es-MX', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}

async function cargarResumen() {
  const { data } = await api.get('/notificaciones/resumen');
  resumen.value = data;
}

async function cargarLista() {
  cargando.value = true;
  try {
    const { data } = await api.get('/notificaciones', { params: { categoria: categoriaActiva.value } });
    items.value = data;
  } finally {
    cargando.value = false;
  }
}

async function marcarTodasLeidas() {
  await api.post('/notificaciones/marcar-todas-leidas', { categoria: categoriaActiva.value });
  await Promise.all([cargarResumen(), cargarLista()]);
}

const RUTA_POR_ENTIDAD = {
  cotizacion: (id) => `/cotizaciones/${id}`,
  factura: (id) => `/facturas/${id}`,
  orden_compra: (id) => `/ordenes-compra/${id}`,
  requisicion: (id) => `/requisiciones/${id}`,
};

async function irA(n) {
  if (!n.leida) {
    await api.post(`/notificaciones/${n.id}/leida`);
    n.leida = true;
    await cargarResumen();
  }
  const rutaEntidad = n.entidad_tipo && n.entidad_id ? RUTA_POR_ENTIDAD[n.entidad_tipo]?.(n.entidad_id) : null;
  if (rutaEntidad) return router.push(rutaEntidad);
  const cat = CATEGORIAS.find((c) => c.clave === n.categoria);
  if (cat) router.push(cat.ruta);
}

watch(categoriaActiva, cargarLista);
onMounted(() => {
  cargarResumen();
  cargarLista();
});
</script>
