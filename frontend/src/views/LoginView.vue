<template>
  <div class="min-h-screen bg-primary flex items-center justify-center px-4">
    <form class="bg-white rounded-xl shadow-xl p-8 w-full max-w-sm" @submit.prevent="entrar">
      <div class="flex flex-col items-center mb-6">
        <img src="/brand/logo-vertical.png" alt="Struktiva Ingeniería y Construcción" class="h-24 w-auto mb-2" />
        <div class="text-[11px] text-slate-500 tracking-wide">Control de Compras y Requisiciones</div>
      </div>

      <label class="block text-xs font-semibold text-slate-600 mb-1">Correo institucional</label>
      <input
        v-model="email"
        type="email"
        required
        placeholder="residente@struktiva.com.mx"
        class="w-full min-h-[44px] border border-slate-300 rounded-lg px-3 mb-4 focus:outline-none focus:ring-2 focus:ring-accent"
      />

      <label class="block text-xs font-semibold text-slate-600 mb-1">Contraseña</label>
      <input
        v-model="password"
        type="password"
        required
        placeholder="••••••••"
        class="w-full min-h-[44px] border border-slate-300 rounded-lg px-3 mb-2 focus:outline-none focus:ring-2 focus:ring-accent"
      />

      <p v-if="error" class="text-danger text-xs bg-red-50 border border-danger/30 rounded-md px-3 py-2 my-3">{{ error }}</p>

      <button
        type="submit"
        :disabled="cargando"
        class="w-full min-h-[48px] bg-primary hover:bg-primary-light text-white font-bold rounded-lg mt-4 disabled:opacity-60"
      >
        {{ cargando ? 'Entrando…' : 'Entrar' }}
      </button>

      <p class="text-[11px] text-slate-400 mt-4 text-center">
        Acceso solo para usuarios dados de alta. Contacta a Dirección si no tienes cuenta.
      </p>
    </form>
  </div>
</template>

<script setup>
import { ref } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { useAuthStore } from '../stores/auth.js';

const email = ref('');
const password = ref('');
const error = ref('');
const cargando = ref(false);

const auth = useAuthStore();
const router = useRouter();
const route = useRoute();

async function entrar() {
  error.value = '';
  cargando.value = true;
  try {
    await auth.login(email.value, password.value);
    router.push(route.query.redirect || '/');
  } catch (err) {
    error.value = err.response?.data?.error || 'No se pudo iniciar sesión. Intenta de nuevo.';
  } finally {
    cargando.value = false;
  }
}
</script>
