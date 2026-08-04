<template>
  <div class="fixed inset-0 bg-black/40 flex items-center justify-center z-50 px-4" @click.self="$emit('cerrar')">
    <div class="bg-white rounded-xl shadow-xl w-full max-w-sm p-5">
      <h3 class="font-display text-base mb-1">Firma para autorizar</h3>
      <p class="text-xs text-slate-500 mb-4">{{ etiqueta }}</p>

      <div class="inline-flex border border-slate-300 rounded-lg overflow-hidden mb-4 w-full">
        <button class="flex-1 text-xs font-semibold px-3 py-2" :class="modo === 'tactil' ? 'bg-primary text-white' : 'bg-white text-slate-500'" @click="modo = 'tactil'">Firma táctil</button>
        <button class="flex-1 text-xs font-semibold px-3 py-2" :class="modo === 'pin' ? 'bg-primary text-white' : 'bg-white text-slate-500'" @click="modo = 'pin'">PIN</button>
      </div>

      <p v-if="error" class="bg-red-50 border border-danger/30 text-danger text-xs rounded-lg px-3 py-2 mb-3">{{ error }}</p>

      <template v-if="modo === 'tactil'">
        <canvas
          ref="canvasEl"
          class="w-full h-40 border-2 border-dashed border-slate-300 rounded-lg touch-none bg-slate-50"
          @pointerdown="iniciarTrazo"
          @pointermove="trazar"
          @pointerup="terminarTrazo"
          @pointerleave="terminarTrazo"
        />
        <div class="flex justify-between items-center mt-2 mb-4">
          <span class="text-[11px] text-slate-400">Firma con el dedo o el mouse</span>
          <button class="text-xs font-semibold text-slate-500 underline" @click="limpiar">Limpiar</button>
        </div>
      </template>

      <template v-else>
        <label class="block text-[11px] font-bold uppercase text-slate-500 mb-1">PIN (4 dígitos)</label>
        <input
          v-model="pin"
          type="password"
          inputmode="numeric"
          maxlength="4"
          placeholder="••••"
          class="w-full min-h-[48px] border border-slate-300 rounded-lg px-3 mb-4 text-center tracking-[0.4em] text-lg"
        />
      </template>

      <div class="flex gap-2">
        <button class="flex-1 min-h-[44px] border border-slate-300 rounded-lg text-sm font-semibold" @click="$emit('cerrar')">Cancelar</button>
        <button class="flex-1 min-h-[44px] bg-primary text-white rounded-lg text-sm font-bold disabled:opacity-50" :disabled="!puedeFirmar || enviando" @click="confirmar">
          {{ enviando ? 'Firmando…' : 'Firmar y autorizar' }}
        </button>
      </div>
    </div>
  </div>
</template>

<script setup>
import { computed, onMounted, ref } from 'vue';

defineProps({ etiqueta: { type: String, default: '' } });
const emit = defineEmits(['firmado', 'cerrar']);

const modo = ref('tactil');
const pin = ref('');
const canvasEl = ref(null);
const trazando = ref(false);
const tieneTrazo = ref(false);
const error = ref('');
const enviando = ref(false);
let ctx = null;

onMounted(() => {
  const canvas = canvasEl.value;
  const rect = canvas.getBoundingClientRect();
  canvas.width = rect.width * 2;
  canvas.height = rect.height * 2;
  ctx = canvas.getContext('2d');
  ctx.scale(2, 2);
  ctx.strokeStyle = '#123B54';
  ctx.lineWidth = 2.2;
  ctx.lineCap = 'round';
});

function posicion(e) {
  const rect = canvasEl.value.getBoundingClientRect();
  return { x: e.clientX - rect.left, y: e.clientY - rect.top };
}
function iniciarTrazo(e) {
  trazando.value = true;
  const { x, y } = posicion(e);
  ctx.beginPath();
  ctx.moveTo(x, y);
}
function trazar(e) {
  if (!trazando.value) return;
  const { x, y } = posicion(e);
  ctx.lineTo(x, y);
  ctx.stroke();
  tieneTrazo.value = true;
}
function terminarTrazo() {
  trazando.value = false;
}
function limpiar() {
  ctx.clearRect(0, 0, canvasEl.value.width, canvasEl.value.height);
  tieneTrazo.value = false;
}

const puedeFirmar = computed(() => (modo.value === 'tactil' ? tieneTrazo.value : /^\d{4}$/.test(pin.value)));

function obtenerGps() {
  return new Promise((resolve) => {
    if (!navigator.geolocation) return resolve({});
    navigator.geolocation.getCurrentPosition(
      (pos) => resolve({ gpsLat: pos.coords.latitude, gpsLng: pos.coords.longitude }),
      () => resolve({}),
      { timeout: 2500 }
    );
  });
}

async function confirmar() {
  error.value = '';
  enviando.value = true;
  try {
    const gps = await obtenerGps();
    if (modo.value === 'tactil') {
      emit('firmado', { tipo: 'tactil', imagenBase64: canvasEl.value.toDataURL('image/png'), ...gps });
    } else {
      emit('firmado', { tipo: 'pin', pin: pin.value, ...gps });
    }
  } finally {
    enviando.value = false;
  }
}

defineExpose({ mostrarError: (msg) => { error.value = msg; } });
</script>
