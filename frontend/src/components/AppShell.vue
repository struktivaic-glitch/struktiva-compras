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
        <div class="flex items-center gap-[12px] bg-white/10 border border-white/20 rounded-full pl-[6px] pr-[18px] py-[6px] text-[18px]">
          <span class="w-9 h-9 rounded-full bg-accent text-[#06282a] font-bold flex items-center justify-center text-[17px]">
            {{ iniciales }}
          </span>
          <span>{{ auth.usuario?.nombre }} · {{ auth.usuario?.rolNombre }}</span>
          <RouterLink to="/perfil" class="ml-3 underline decoration-white/40 hover:decoration-white">Perfil</RouterLink>
          <button class="ml-3 underline decoration-white/40 hover:decoration-white" @click="salir">Salir</button>
        </div>
      </div>
    </header>

    <nav class="bg-white border-b border-slate-200 no-print">
      <div class="max-w-6xl mx-auto px-5 flex gap-1 overflow-x-auto">
        <RouterLink
          v-for="item in navVisible"
          :key="item.to"
          :to="item.to"
          class="px-4 py-3 text-[13.5px] font-semibold text-slate-500 border-b-[2.5px] border-transparent flex-none whitespace-nowrap"
          active-class="!text-primary !border-brand-red"
        >
          {{ item.label }}
        </RouterLink>
      </div>
    </nav>

    <main class="max-w-6xl mx-auto px-5 py-6">
      <slot />
    </main>
  </div>
</template>

<script setup>
import { computed } from 'vue';
import { useRouter } from 'vue-router';
import BrandMark from './BrandMark.vue';
import NotificacionesBell from './NotificacionesBell.vue';
import { useAuthStore } from '../stores/auth.js';

const auth = useAuthStore();
const router = useRouter();

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
  { to: '/reportes', label: 'Reportes' },
  { to: '/importar-insumos', label: 'Importar Insumos' },
  { to: '/usuarios', label: 'Usuarios', roles: ['direccion', 'auditor'] },
];

const navVisible = computed(() => nav.filter((item) => !item.roles || item.roles.includes(auth.rol)));

const iniciales = computed(() =>
  (auth.usuario?.nombre ?? '')
    .split(' ')
    .map((p) => p[0])
    .slice(0, 2)
    .join('')
    .toUpperCase()
);

function salir() {
  auth.logout();
  router.push('/login');
}
</script>
