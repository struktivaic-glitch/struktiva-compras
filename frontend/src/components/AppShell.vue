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
      <div class="max-w-6xl mx-auto px-5">
        <button
          class="w-full flex items-center justify-between gap-3 py-3 text-[14px] font-bold text-slate-700"
          @click="menuAbierto = !menuAbierto"
        >
          <span class="flex items-center gap-2">
            <span class="text-[18px] leading-none">☰</span>
            Menú
          </span>
          <span class="text-[13px] font-semibold text-primary truncate">{{ paginaActual }}</span>
        </button>
      </div>

      <div v-if="menuAbierto" class="absolute left-0 right-0 bg-white border-b border-slate-200 shadow-lg z-40 max-h-[70vh] overflow-y-auto">
        <div class="max-w-6xl mx-auto px-5 py-2 flex flex-col">
          <RouterLink
            v-for="item in navVisible"
            :key="item.to"
            :to="item.to"
            class="px-2 py-3 text-[14px] font-semibold text-slate-600 border-b border-slate-100 last:border-b-0"
            active-class="!text-primary"
            @click="menuAbierto = false"
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
const menuAbierto = ref(false);
const navRef = ref(null);

const nav = [
  { to: '/', label: 'Dashboard' },
  { to: '/requisiciones', label: 'Requisiciones' },
  { to: '/cotizaciones', label: 'Cotizaciones' },
  { to: '/ordenes-compra', label: 'Órdenes de compra' },
  { to: '/almacen/entradas', label: 'Entradas' },
  { to: '/almacen/salidas', label: 'Salidas' },
  { to: '/almacen/inventario', label: 'Inventario' },
  { to: '/facturas', label: 'Facturas' },
  { to: '/pagos', label: 'Pagos' },
  { to: '/proveedores', label: 'Proveedores' },
  { to: '/trabajadores', label: 'Personal' },
  { to: '/reportes', label: 'Reportes' },
  { to: '/importar-insumos', label: 'Importar Insumos' },
  { to: '/usuarios', label: 'Usuarios', roles: ['direccion', 'auditor'] },
];

const navVisible = computed(() => nav.filter((item) => !item.roles || item.roles.includes(auth.rol)));
const paginaActual = computed(() => navVisible.value.find((item) => item.to === route.path)?.label ?? '');

watch(() => route.path, () => {
  menuAbierto.value = false;
});

function alHacerClicFuera(ev) {
  if (menuAbierto.value && navRef.value && !navRef.value.contains(ev.target)) {
    menuAbierto.value = false;
  }
}
onMounted(() => document.addEventListener('click', alHacerClicFuera));
onBeforeUnmount(() => document.removeEventListener('click', alHacerClicFuera));

function salir() {
  auth.logout();
  router.push('/login');
}
</script>
