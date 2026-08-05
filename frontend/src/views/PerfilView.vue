<template>
  <AppShell>
    <h2 class="font-display text-lg mb-1">Mi perfil</h2>
    <p class="text-xs text-slate-500 mb-5">{{ auth.usuario?.nombre }} · {{ auth.usuario?.rolNombre }} · {{ auth.usuario?.email }}</p>

    <div class="bg-white border border-slate-200 rounded-xl p-5 max-w-sm">
      <h3 class="text-sm font-display mb-1">Foto de perfil (selfie)</h3>
      <p class="text-xs text-slate-500 mb-4">
        Se usa como tu avatar dentro del sistema. La imagen se guarda en la base de datos, así que no se pierde con
        las actualizaciones del sistema.
      </p>

      <p v-if="mensajeFoto" class="text-sm rounded-lg px-3 py-2 mb-3" :class="errorFoto ? 'bg-red-50 text-danger border border-danger/30' : 'bg-emerald-50 text-success border border-success/30'">{{ mensajeFoto }}</p>

      <div class="flex items-center gap-4 mb-4">
        <span class="w-20 h-20 rounded-full overflow-hidden bg-slate-100 border border-slate-200 flex items-center justify-center shrink-0">
          <img v-if="previewUrl" :src="previewUrl" alt="Vista previa" class="w-full h-full object-cover" />
          <AvatarUsuario
            v-else
            :usuario-id="auth.usuario?.id"
            :nombre="auth.usuario?.nombre"
            :tiene-foto="auth.usuario?.tieneFoto !== false"
            :version="auth.usuario?.fotoVersion"
            size-class="w-20 h-20"
            text-size-class="text-xl"
          />
        </span>
        <div class="flex flex-col gap-2">
          <label class="min-h-[40px] inline-flex items-center justify-center border border-slate-300 text-slate-600 font-bold rounded-lg px-4 text-sm cursor-pointer">
            {{ procesandoFoto ? 'Procesando…' : 'Tomar / elegir foto' }}
            <input type="file" accept="image/*" capture="user" class="hidden" :disabled="procesandoFoto" @change="alSeleccionarArchivo" />
          </label>
          <button
            v-if="previewUrl"
            class="min-h-[40px] bg-primary text-white font-bold rounded-lg px-4 text-sm disabled:opacity-50"
            :disabled="guardandoFoto"
            @click="subirFoto"
          >
            {{ guardandoFoto ? 'Guardando…' : 'Guardar foto' }}
          </button>
          <button
            v-else-if="auth.usuario?.tieneFoto !== false"
            class="min-h-[40px] border border-danger text-danger font-bold rounded-lg px-4 text-sm disabled:opacity-50"
            :disabled="guardandoFoto"
            @click="quitarFoto"
          >
            Quitar foto
          </button>
        </div>
      </div>
    </div>

    <div class="bg-white border border-slate-200 rounded-xl p-5 max-w-sm mt-5">
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

    <div class="bg-white border border-slate-200 rounded-xl p-5 max-w-sm mt-5">
      <h3 class="text-sm font-display mb-1">Avisos por Telegram</h3>
      <p class="text-xs text-slate-500 mb-4">
        Recibe las mismas notificaciones de la campanita también en Telegram. Estado actual:
        <span class="font-bold" :class="telegramVinculado ? 'text-success' : 'text-warning'">{{ telegramVinculado ? 'Vinculado' : 'Sin vincular' }}</span>
      </p>

      <p v-if="mensajeTg" class="text-sm rounded-lg px-3 py-2 mb-3" :class="errorTg ? 'bg-red-50 text-danger border border-danger/30' : 'bg-emerald-50 text-success border border-success/30'">{{ mensajeTg }}</p>

      <template v-if="telegramVinculado">
        <button class="min-h-[44px] border border-slate-300 text-slate-600 font-bold rounded-lg px-5 text-sm w-full disabled:opacity-50" :disabled="cargandoTg" @click="desvincularTelegram">
          Desvincular Telegram
        </button>
      </template>
      <template v-else>
        <a
          v-if="enlaceTg"
          :href="enlaceTg"
          target="_blank"
          rel="noopener"
          class="block text-center min-h-[44px] leading-[44px] bg-primary text-white font-bold rounded-lg px-5 text-sm w-full"
        >
          Abrir Telegram y vincular
        </a>
        <button v-else class="min-h-[44px] bg-primary text-white font-bold rounded-lg px-5 text-sm w-full disabled:opacity-50" :disabled="cargandoTg" @click="generarEnlace">
          {{ cargandoTg ? 'Generando…' : 'Vincular Telegram' }}
        </button>
        <p v-if="enlaceTg" class="text-[11px] text-slate-400 mt-2">
          Se abre Telegram con el bot listo — solo dale "Enviar" al mensaje que aparece precargado.
        </p>
      </template>
    </div>
  </AppShell>
</template>

<script setup>
import { onBeforeUnmount, onMounted, ref } from 'vue';
import AppShell from '../components/AppShell.vue';
import AvatarUsuario from '../components/AvatarUsuario.vue';
import { api } from '../lib/api.js';
import { useAuthStore } from '../stores/auth.js';

const auth = useAuthStore();

// --- Foto de perfil (selfie) ---
const previewUrl = ref('');
const blobPendiente = ref(null);
const procesandoFoto = ref(false);
const guardandoFoto = ref(false);
const mensajeFoto = ref('');
const errorFoto = ref(false);

async function comprimirImagen(file, maxDim = 480, calidad = 0.82) {
  const bitmap = await createImageBitmap(file);
  let { width, height } = bitmap;
  if (width > maxDim || height > maxDim) {
    if (width >= height) {
      height = Math.round((height * maxDim) / width);
      width = maxDim;
    } else {
      width = Math.round((width * maxDim) / height);
      height = maxDim;
    }
  }
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  canvas.getContext('2d').drawImage(bitmap, 0, 0, width, height);
  return new Promise((resolve, reject) => canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('sin blob'))), 'image/jpeg', calidad));
}

function limpiarPreview() {
  if (previewUrl.value) URL.revokeObjectURL(previewUrl.value);
  previewUrl.value = '';
  blobPendiente.value = null;
}

async function alSeleccionarArchivo(ev) {
  const file = ev.target.files?.[0];
  ev.target.value = '';
  if (!file) return;
  mensajeFoto.value = '';
  procesandoFoto.value = true;
  try {
    const blob = await comprimirImagen(file);
    limpiarPreview();
    blobPendiente.value = blob;
    previewUrl.value = URL.createObjectURL(blob);
  } catch {
    errorFoto.value = true;
    mensajeFoto.value = 'No se pudo procesar esa imagen. Intenta con otra.';
  } finally {
    procesandoFoto.value = false;
  }
}

async function subirFoto() {
  if (!blobPendiente.value) return;
  guardandoFoto.value = true;
  mensajeFoto.value = '';
  try {
    const form = new FormData();
    form.append('foto', blobPendiente.value, 'selfie.jpg');
    await api.post('/usuarios/mi-foto', form);
    auth.actualizarUsuario({ tieneFoto: true, fotoVersion: Date.now() });
    errorFoto.value = false;
    mensajeFoto.value = 'Foto de perfil actualizada.';
    limpiarPreview();
  } catch (err) {
    errorFoto.value = true;
    mensajeFoto.value = err.response?.data?.error || 'No se pudo guardar la foto.';
  } finally {
    guardandoFoto.value = false;
  }
}

async function quitarFoto() {
  guardandoFoto.value = true;
  mensajeFoto.value = '';
  try {
    await api.delete('/usuarios/mi-foto');
    auth.actualizarUsuario({ tieneFoto: false, fotoVersion: Date.now() });
    errorFoto.value = false;
    mensajeFoto.value = 'Se quitó tu foto de perfil.';
  } catch (err) {
    errorFoto.value = true;
    mensajeFoto.value = err.response?.data?.error || 'No se pudo quitar la foto.';
  } finally {
    guardandoFoto.value = false;
  }
}

onBeforeUnmount(limpiarPreview);

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

const telegramVinculado = ref(false);
const enlaceTg = ref('');
const mensajeTg = ref('');
const errorTg = ref(false);
const cargandoTg = ref(false);

async function generarEnlace() {
  mensajeTg.value = '';
  cargandoTg.value = true;
  try {
    const { data } = await api.post('/telegram/vincular');
    if (data.enlace) {
      enlaceTg.value = data.enlace;
    } else {
      errorTg.value = true;
      mensajeTg.value = 'No se pudo generar el enlace. Intenta de nuevo en un momento.';
    }
  } catch (err) {
    errorTg.value = true;
    mensajeTg.value = err.response?.data?.error || 'No se pudo generar el enlace de vinculación.';
  } finally {
    cargandoTg.value = false;
  }
}

async function desvincularTelegram() {
  cargandoTg.value = true;
  try {
    await api.post('/telegram/desvincular');
    telegramVinculado.value = false;
    enlaceTg.value = '';
    errorTg.value = false;
    mensajeTg.value = 'Se desvinculó Telegram de tu cuenta.';
  } finally {
    cargandoTg.value = false;
  }
}

onMounted(async () => {
  const { data } = await api.get('/usuarios/pin/estado');
  configurado.value = data.configurado;

  const { data: tg } = await api.get('/telegram/estado');
  telegramVinculado.value = tg.vinculado;
});
</script>
