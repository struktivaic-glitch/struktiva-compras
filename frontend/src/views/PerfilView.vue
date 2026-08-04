<template>
  <AppShell>
    <h2 class="font-display text-lg mb-1">Mi perfil</h2>
    <p class="text-xs text-slate-500 mb-5">{{ auth.usuario?.nombre }} · {{ auth.usuario?.rolNombre }} · {{ auth.usuario?.email }}</p>

    <div class="bg-white border border-slate-200 rounded-xl p-5 max-w-sm">
      <h3 class="text-sm font-display mb-1">PIN de firma</h3>
      <p class="text-xs text-slate-500 mb-4">
        4 dígitos que usarás para autorizar requisiciones cuando no puedas firmar con el dedo
        (ej. desde escritorio). Estado actual:
        <span class="font-bold" :class="configurado ? 'text-success' : 'text-warning'">{{ configurado ? 'Configurado' : 'Sin configurar' }}</span>
      </p>

      <p v-if="mensaje" class="text-sm rounded-lg px-3 py-2 mb-3" :class="error ? 'bg-red-50 text-danger border border-danger/30' : 'bg-emerald-50 text-success border border-success/30'">{{ mensaje }}</p>

      <label class="block text-[11px] font-bold uppercase text-slate-500 mb-1">Nuevo PIN (4 dígitos)</label>
      <input
        v-model="pin"
        type="password"
        inputmode="numeric"
        maxlength="4"
        pattern="\d{4}"
        placeholder="••••"
        class="w-full min-h-[44px] border border-slate-300 rounded-lg px-3 mb-3 text-center tracking-[0.4em] text-lg"
      />
      <button class="min-h-[44px] bg-primary text-white font-bold rounded-lg px-5 text-sm w-full disabled:opacity-50" :disabled="!/^\d{4}$/.test(pin) || guardando" @click="guardar">
        {{ guardando ? 'Guardando…' : configurado ? 'Cambiar PIN' : 'Configurar PIN' }}
      </button>
    </div>

    <div class="bg-white border border-slate-200 rounded-xl p-5 max-w-sm mt-5">
      <h3 class="text-sm font-display mb-1">Contraseña de acceso</h3>
      <p class="text-xs text-slate-500 mb-4">Cambia la contraseña con la que inicias sesión.</p>

      <p v-if="mensajePass" class="text-sm rounded-lg px-3 py-2 mb-3" :class="errorPass ? 'bg-red-50 text-danger border border-danger/30' : 'bg-emerald-50 text-success border border-success/30'">{{ mensajePass }}</p>

      <label class="block text-[11px] font-bold uppercase text-slate-500 mb-1">Contraseña actual</label>
      <input v-model="passwordActual" type="password" class="w-full min-h-[44px] border border-slate-300 rounded-lg px-3 mb-3" />
      <label class="block text-[11px] font-bold uppercase text-slate-500 mb-1">Nueva contraseña (mín. 6 caracteres)</label>
      <input v-model="passwordNueva" type="password" class="w-full min-h-[44px] border border-slate-300 rounded-lg px-3 mb-3" />
      <button class="min-h-[44px] bg-primary text-white font-bold rounded-lg px-5 text-sm w-full disabled:opacity-50" :disabled="!passwordActual || passwordNueva.length < 6 || guardandoPass" @click="cambiarPassword">
        {{ guardandoPass ? 'Guardando…' : 'Cambiar contraseña' }}
      </button>
    </div>
  </AppShell>
</template>

<script setup>
import { onMounted, ref } from 'vue';
import AppShell from '../components/AppShell.vue';
import { api } from '../lib/api.js';
import { useAuthStore } from '../stores/auth.js';

const auth = useAuthStore();
const configurado = ref(false);
const pin = ref('');
const mensaje = ref('');
const error = ref(false);
const guardando = ref(false);

const passwordActual = ref('');
const passwordNueva = ref('');
const mensajePass = ref('');
const errorPass = ref(false);
const guardandoPass = ref(false);

async function cambiarPassword() {
  mensajePass.value = '';
  guardandoPass.value = true;
  try {
    await api.post('/usuarios/mi-password', { passwordActual: passwordActual.value, passwordNueva: passwordNueva.value });
    errorPass.value = false;
    mensajePass.value = 'Contraseña actualizada correctamente.';
    passwordActual.value = '';
    passwordNueva.value = '';
  } catch (err) {
    errorPass.value = true;
    mensajePass.value = err.response?.data?.error || 'No se pudo cambiar la contraseña.';
  } finally {
    guardandoPass.value = false;
  }
}

async function guardar() {
  mensaje.value = '';
  guardando.value = true;
  try {
    await api.post('/usuarios/pin', { pin: pin.value });
    configurado.value = true;
    pin.value = '';
    error.value = false;
    mensaje.value = 'PIN guardado correctamente.';
  } catch (err) {
    error.value = true;
    mensaje.value = err.response?.data?.error || 'No se pudo guardar el PIN.';
  } finally {
    guardando.value = false;
  }
}

onMounted(async () => {
  const { data } = await api.get('/usuarios/pin/estado');
  configurado.value = data.configurado;
});
</script>
