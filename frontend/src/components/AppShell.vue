<template>
  <div class="min-h-screen bg-halo">
    <header class="bg-primary text-white border-b-[3px] border-brand-red no-print">
      <div class="max-w-6xl mx-auto px-[30px] py-[18px] flex items-center gap-[24px] flex-wrap">
        <BrandMark :size="51" />
        <div class="mr-auto leading-tight">
          <b class="font-display text-[34px] tracking-wide">STRUKTIVA</b>
          <div class="text-[13px] text-sky-100/80">Sistema ERP</div>
        </div>
        <NotificacionesBell />
        <RouterLink to="/perfil" title="Mi perfil">
          <AvatarUsuario
            :usuario-id="auth.usuario?.id"
            :nombre="auth.usuario?.nombre"
            :tiene-foto="auth.usuario?.tieneFoto !== false"
            :version="auth.usuario?.fotoVersion"
            size-class="w-[54px] h-[54px] border border-white/20 shadow-[0_0_10px_rgba(255,255,255,0.6)]"
            text-size-class="text-[20px]"
          />
        </RouterLink>
        <div class="flex items-center gap-2 bg-white/10 border border-white/20 rounded-full pl-3 pr-3 py-1 text-xs">
          <span>{{ auth.usuario?.nombre }} · {{ auth.usuario?.rolNombre }}</span>
          <button class="ml-2 underline decoration-white/40 hover:decoration-white" @click="salir">Salir</button>
        </div>
      </div>
    </header>

    <nav class="bg-white border-b border-slate-200 no-print relative" ref="navRef">
      <div class="max-w-6xl mx-auto px-5 py-2 flex items-center gap-2 flex-wrap">
        <button
          v-for="g in gruposVisibles"
          :key="g.clave"
          class="flex items-center gap-1.5 px-3 py-[6px] rounded-lg text-[14px] font-bold"
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
import { GRUPOS_NAV } from '../lib/modulosNav.js';

const auth = useAuthStore();
const router = useRouter();
const route = useRoute();
const grupoAbierto = ref(null);
const navRef = ref(null);

// "Usuarios" vive fuera de la lista canónica (modulosNav.js) a propósito — no forma parte del
// checklist de permisos por usuario (migración 029), sigue gobernado solo por rol, para no
// arriesgar que alguien se quite a sí mismo el acceso a la pantalla que arregla los permisos. Se
// agrega aquí, en el grupo R.H., como el único ítem que todavía usa el filtro viejo por `roles`.
const grupos = GRUPOS_NAV.map((g) =>
  g.clave === 'rh' ? { ...g, items: [...g.items, { to: '/usuarios', label: 'Usuarios', roles: ['direccion', 'auditor'] }] } : g
);

// Un ítem se ve si: (a) tiene `roles` y el rol del usuario está en la lista (caso especial de
// Usuarios, arriba), o (b) no tiene `roles` — en ese caso se ve solo si el usuario tiene ese
// módulo en su checklist de permisos (migración 029). `auth.usuario.modulos` viaja en el login;
// si por lo que sea no viene (usuarios con sesión de antes de este cambio), se trata como "ver
// todo" para no dejar a nadie fuera de golpe hasta que vuelva a iniciar sesión.
const gruposVisibles = computed(() => {
  const modulos = auth.usuario?.modulos;
  return grupos.map((g) => ({
    ...g,
    items: g.items.filter((item) => {
      if (item.roles) return item.roles.includes(auth.rol);
      if (!modulos) return true;
      return modulos.includes(item.to);
    }),
  }));
});
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
