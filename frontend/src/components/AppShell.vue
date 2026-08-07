<template>
  <div class="min-h-screen bg-slate-100">
    <header class="bg-primary text-white border-b-[3px] border-brand-red no-print">
      <div class="max-w-6xl mx-auto px-[30px] py-[18px] flex items-center gap-[24px] flex-wrap">
        <BrandMark :size="51" />
        <div class="mr-auto leading-tight">
          <b class="font-display text-[26px] tracking-wide">STRUKTIVA</b>
          <div class="text-[17px] text-sky-100/80">Control de Compras y Requisiciones · Obra</div>
        </div>
        <NotificacionesBell />
        <div class="flex items-center gap-2 bg-white/10 border border-white/20 rounded-full pl-1 pr-3 py-1 text-xs">
          <AvatarUsuario
            :usuario-id="auth.usuario?.id"
            :nombre="auth.usuario?.nombre"
            :tiene-foto="auth.usuario?.tieneFoto !== false"
            :version="auth.usuario?.fotoVersion"
          />
          <span>{{ auth.usuario?.nombre }} · {{ auth.usuario?.rolNombre }}</span>
          <RouterLink to="/perfil" class="ml-2 underline decoration-white/40 hover:decoration-white">Perfil</RouterLink>
          <button class="ml-2 underline decoration-white/40 hover:decoration-white" @click="salir">Salir</button>
        </div>
      </div>
    </header>

    <nav class="bg-white border-b border-slate-200 no-print relative" ref="navRef">
      <div class="max-w-6xl mx-auto px-5 py-2 flex items-center gap-2 flex-wrap">
        <button
          v-for="g in gruposVisibles"
          :key="g.clave"
          class="flex items-center gap-1.5 px-3 py-2 rounded-lg text-[14px] font-bold"
          :class="grupoAbierto === g.clave || grupoActivo === g.clave ? 'bg-primary/10 text-primary' : 'text-slate-600 hover:bg-slate-50'"
          @click="grupoAbierto = grupoAbierto === g.clave ? null : g.clave"
        >
          <span class="text-[16px] leading-none">{{ g.icono }}</span>
          {{ g.label }}
          <span class="text-[10px]">▾</span>
        </button>
      </div>

      <div v-if="grupoAbierto" class="absolute left-0 right-0 bg-white border-b border-slate-200 shadow-lg z-40 max-h-[70vh] overflow-y-auto">
        <div class="max-w-6xl mx-auto px-5 py-2 flex flex-col">
          <RouterLink
            v-for="item in itemsDelGrupoAbierto"
            :key="item.to"
            :to="item.to"
            class="px-2 py-3 text-[14px] font-semibold text-slate-600 border-b border-slate-100 last:border-b-0"
            active-class="!text-primary"
            @click="grupoAbierto = null"
          >
            {{ item.label }}
          </RouterLink>
        </div>
      </div>
    </nav>

    <main class="max-w-6xl mx-auto px-5 py-6">
      <slot />
    </main>
  </div>
</template>

<script setup>
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import AvatarUsuario from './AvatarUsuario.vue';
import BrandMark from './BrandMark.vue';
import NotificacionesBell from './NotificacionesBell.vue';
import { useAuthStore } from '../stores/auth.js';

const auth = useAuthStore();
const router = useRouter();
const route = useRoute();
const grupoAbierto = ref(null);
const navRef = ref(null);

const grupos = [
  {
    clave: 'insumos', label: 'Insumos', icono: '📥',
    items: [
      { to: '/', label: 'Dashboard' },
      { to: '/requisiciones', label: 'Requisiciones' },
      { to: '/cotizaciones', label: 'Cotizaciones' },
      { to: '/proveedores', label: 'Proveedores' },
      { to: '/ordenes-compra', label: 'Órdenes de compra' },
      { to: '/importar-insumos', label: 'Importar Insumos' },
      { to: '/importar-presupuesto-general', label: 'Importar Presupuesto General' },
      { to: '/avance-obra', label: 'Avance de Obra' },
      { to: '/reportes', label: 'Reportes' },
    ],
  },
  {
    clave: 'almacen', label: 'Almacén', icono: '🏬',
    items: [
      { to: '/almacen/entradas', label: 'Entradas' },
      { to: '/almacen/salidas', label: 'Salidas' },
      { to: '/almacen/inventario', label: 'Inventario' },
      { to: '/facturas', label: 'Facturas' },
      { to: '/pagos', label: 'Pagos' },
      { to: '/equipos', label: 'Maquinaria y Equipos' },
    ],
  },
  {
    clave: 'rh', label: 'R.H.', icono: '👥',
    items: [
      { to: '/trabajadores', label: 'Personal' },
      { to: '/asistencia', label: 'Asistencia' },
      { to: '/incidencias', label: 'Incidencias' },
      { to: '/pagos-personal', label: 'Pagos a Personal' },
      { to: '/destajistas', label: 'Destajistas' },
      { to: '/destajos', label: 'Destajos' },
      { to: '/usuarios', label: 'Usuarios', roles: ['direccion', 'auditor'] },
    ],
  },
];

const gruposVisibles = computed(() =>
  grupos.map((g) => ({ ...g, items: g.items.filter((item) => !item.roles || item.roles.includes(auth.rol)) }))
);
const itemsDelGrupoAbierto = computed(() => gruposVisibles.value.find((g) => g.clave === grupoAbierto.value)?.items ?? []);

function rutaPerteneceA(to) {
  if (to === '/') return route.path === '/';
  return route.path === to || route.path.startsWith(`${to}/`);
}
const grupoActivo = computed(() => gruposVisibles.value.find((g) => g.items.some((item) => rutaPerteneceA(item.to)))?.clave ?? null);

watch(() => route.path, () => {
  grupoAbierto.value = null;
});

function alHacerClicFuera(ev) {
  if (grupoAbierto.value && navRef.value && !navRef.value.contains(ev.target)) {
    grupoAbierto.value = null;
  }
}
onMounted(() => document.addEventListener('click', alHacerClicFuera));
onBeforeUnmount(() => document.removeEventListener('click', alHacerClicFuera));

function salir() {
  auth.logout();
  router.push('/login');
}
</script>
