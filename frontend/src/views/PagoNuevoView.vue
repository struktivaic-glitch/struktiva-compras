<template>
  <AppShell>
    <h2 class="font-display text-[36px] mb-1">Nuevo pago a proveedor</h2>
    <p class="text-xs text-slate-500 mb-4">Aplica el pago a una o varias facturas con saldo pendiente (permite abonos parciales).</p>

    <div class="bg-white border border-slate-200 rounded-xl p-4 mb-5 grid sm:grid-cols-4 gap-3">
      <div>
        <label class="block text-[11px] font-bold uppercase text-slate-500 mb-1">Proveedor</label>
        <select v-model.number="proveedorId" class="w-full border border-slate-300 rounded-lg px-2.5 min-h-[42px]">
          <option v-for="p in proveedores" :key="p.id" :value="p.id">{{ p.razon_social }}</option>
        </select>
      </div>
      <div>
        <label class="block text-[11px] font-bold uppercase text-slate-500 mb-1">Monto del pago</label>
        <input v-model.number="monto" type="number" inputmode="decimal" min="0" step="any" class="w-full border border-slate-300 rounded-lg px-2.5 min-h-[42px]" />
      </div>
      <div>
        <label class="block text-[11px] font-bold uppercase text-slate-500 mb-1">Forma de pago</label>
        <select v-model="formaPago" class="w-full border border-slate-300 rounded-lg px-2.5 min-h-[42px]">
          <option value="" disabled>Selecciona…</option>
          <option v-for="f in FORMAS_PAGO" :key="f.clave" :value="f.clave">{{ f.label }}</option>
        </select>
      </div>
      <div>
        <label class="block text-[11px] font-bold uppercase text-slate-500 mb-1">Referencia</label>
        <input v-model="referencia" placeholder="Folio SPEI, cheque…" class="w-full border border-slate-300 rounded-lg px-2.5 min-h-[42px]" />
      </div>
    </div>

    <p v-if="error" class="bg-red-50 border border-danger/30 text-danger text-sm rounded-lg px-4 py-3 mb-4">{{ error }}</p>

    <h3 class="text-sm font-display mb-2">Facturas con saldo pendiente</h3>
    <div class="overflow-x-auto bg-white border border-slate-200 rounded-xl mb-5">
      <table class="w-full text-sm tabular-nums">
        <thead>
          <tr class="bg-slate-50 text-[11px] uppercase tracking-wide text-slate-500">
            <th class="text-left px-4 py-2.5 font-normal font-sans">Factura</th>
            <th class="text-left px-4 py-2.5 font-normal font-sans">Total</th>
            <th class="text-left px-4 py-2.5 font-normal font-sans">Saldo</th>
            <th class="text-left px-4 py-2.5 font-normal font-sans">Aplicar</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="f in facturasConSaldo" :key="f.id" class="border-t border-slate-200">
            <td class="px-4 py-2.5 font-semibold">
              {{ f.folio }}
              <span v-if="bloqueadaPorVariacion(f)" class="block text-[10px] font-bold text-danger normal-case">▲ Variación de precio sin autorizar</span>
            </td>
            <td class="px-4 py-2.5">{{ mxn(f.total) }}</td>
            <td class="px-4 py-2.5">{{ mxn(f.saldo) }}</td>
            <td class="px-4 py-2.5">
              <input
                v-model.number="aplicaciones[f.id]"
                type="number" inputmode="decimal" min="0" :max="f.saldo" step="any"
                :disabled="bloqueadaPorVariacion(f)"
                class="w-28 border border-slate-300 rounded px-2 py-1.5 disabled:bg-slate-100 disabled:text-slate-400"
              />
            </td>
          </tr>
          <tr v-if="proveedorId && facturasConSaldo.length === 0">
            <td colspan="4" class="px-4 py-8 text-center text-slate-400 text-sm font-sans">Este proveedor no tiene facturas con saldo pendiente.</td>
          </tr>
        </tbody>
      </table>
    </div>

    <p class="text-xs text-slate-500 mb-3">Suma aplicada: <b class="tabular-nums">{{ mxn(sumaAplicada) }}</b> de <b class="tabular-nums">{{ mxn(monto || 0) }}</b> del pago</p>

    <button class="min-h-[48px] bg-primary text-white font-bold rounded-lg px-5 text-sm disabled:opacity-50" :disabled="!puedeGuardar || guardando" @click="guardar">
      {{ guardando ? 'Guardando…' : 'Registrar pago' }}
    </button>
  </AppShell>
</template>

<script setup>
import { computed, onMounted, reactive, ref, watch } from 'vue';
import { useRouter } from 'vue-router';
import AppShell from '../components/AppShell.vue';
import { api } from '../lib/api.js';
import { FORMAS_PAGO } from '../lib/formasPago.js';

const router = useRouter();
const proveedores = ref([]);
const proveedorId = ref(null);
const monto = ref(null);
const formaPago = ref('');
const referencia = ref('');
const facturasConSaldo = ref([]);
const aplicaciones = reactive({});
const error = ref('');
const guardando = ref(false);

const sumaAplicada = computed(() => facturasConSaldo.value.reduce((s, f) => s + Number(aplicaciones[f.id] || 0), 0));

function bloqueadaPorVariacion(f) {
  return f.excede_variacion_precio && !f.variacion_precio_autorizada;
}

const puedeGuardar = computed(() => {
  if (!proveedorId.value || !monto.value || !formaPago.value.trim()) return false;
  if (sumaAplicada.value <= 0 || sumaAplicada.value > Number(monto.value) + 0.01) return false;
  if (facturasConSaldo.value.some((f) => bloqueadaPorVariacion(f) && aplicaciones[f.id] > 0)) return false;
  return facturasConSaldo.value.every((f) => !aplicaciones[f.id] || aplicaciones[f.id] <= f.saldo + 0.01);
});

function mxn(n) {
  return new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN' }).format(n || 0);
}

async function cargarEstadoCuenta() {
  if (!proveedorId.value) return;
  const { data } = await api.get(`/proveedores/${proveedorId.value}/estado-cuenta`);
  facturasConSaldo.value = data.facturas.filter((f) => f.saldo > 0.01);
  for (const k of Object.keys(aplicaciones)) delete aplicaciones[k];
}
watch(proveedorId, cargarEstadoCuenta);

async function guardar() {
  error.value = '';
  guardando.value = true;
  try {
    const aplicacionesArr = facturasConSaldo.value
      .filter((f) => aplicaciones[f.id] > 0)
      .map((f) => ({ facturaId: f.id, montoAplicado: aplicaciones[f.id] }));
    const { data } = await api.post('/pagos-proveedor', {
      proveedorId: proveedorId.value, monto: monto.value, moneda: 'MXN',
      formaPago: formaPago.value, referencia: referencia.value, aplicaciones: aplicacionesArr,
    });
    router.push(`/pagos/${data.id}`);
  } catch (err) {
    error.value = err.response?.data?.error || 'No se pudo registrar el pago.';
  } finally {
    guardando.value = false;
  }
}

onMounted(async () => {
  const { data } = await api.get('/proveedores');
  proveedores.value = data;
  proveedorId.value = data[0]?.id ?? null;
  await cargarEstadoCuenta();
});
</script>
