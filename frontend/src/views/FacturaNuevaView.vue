<template>
  <AppShell>
    <h2 class="font-display text-[36px] mb-1">Nueva factura</h2>
    <p class="text-xs text-slate-500 mb-4">Coincidencia triple: la factura solo puede vincular lo que ya fue físicamente recibido en almacén contra esta Orden de Compra.</p>

    <div class="bg-white border border-slate-200 rounded-xl p-4 mb-5 grid sm:grid-cols-4 gap-3">
      <div class="sm:col-span-2">
        <label class="block text-[11px] font-bold uppercase text-slate-500 mb-1">Orden de compra</label>
        <select v-model.number="ocId" class="w-full border border-slate-300 rounded-lg px-2.5 min-h-[42px]">
          <option v-for="o in ordenes" :key="o.id" :value="o.id">{{ o.folio }} — {{ o.proveedor_nombre }}</option>
        </select>
      </div>
      <div>
        <label class="block text-[11px] font-bold uppercase text-slate-500 mb-1">Serie / folio fiscal</label>
        <input v-model="serieFolio" placeholder="Ej. A-1023" class="w-full border border-slate-300 rounded-lg px-2.5 min-h-[42px]" />
      </div>
      <div>
        <label class="block text-[11px] font-bold uppercase text-slate-500 mb-1">UUID fiscal (CFDI)</label>
        <input v-model="folioFiscalUuid" placeholder="XXXXXXXX-XXXX-…" class="w-full border border-slate-300 rounded-lg px-2.5 min-h-[42px]" />
      </div>
      <div>
        <label class="block text-[11px] font-bold uppercase text-slate-500 mb-1">Archivo XML</label>
        <input type="file" accept=".xml" @change="xmlFile = $event.target.files[0]" class="w-full text-xs border border-slate-300 rounded-lg px-2.5 min-h-[42px]" />
      </div>
      <div>
        <label class="block text-[11px] font-bold uppercase text-slate-500 mb-1">Archivo PDF</label>
        <input type="file" accept=".pdf" @change="pdfFile = $event.target.files[0]" class="w-full text-xs border border-slate-300 rounded-lg px-2.5 min-h-[42px]" />
      </div>
    </div>

    <p v-if="error" class="bg-red-50 border border-danger/30 text-danger text-sm rounded-lg px-4 py-3 mb-4">{{ error }}</p>

    <div class="bg-white border border-slate-200 rounded-xl p-4 mb-5">
      <label class="block text-[11px] font-bold uppercase text-slate-500 mb-1">Entrada(s) relacionada(s) (opcional)</label>
      <p class="text-xs text-slate-500 mb-2">A qué remisión(es) recibida(s) en almacén corresponde esta factura — solo trazabilidad, no afecta el three-way matching.</p>
      <div v-if="entradasOc.length" class="flex flex-col gap-1.5">
        <label v-for="e in entradasOc" :key="e.id" class="flex items-center gap-2 text-sm">
          <input type="checkbox" :value="e.id" v-model="entradaIdsSeleccionadas" class="w-4 h-4" />
          {{ e.folio }} — Remisión {{ e.remision_proveedor }} · {{ new Date(e.fecha).toLocaleDateString('es-MX') }}
        </label>
      </div>
      <p v-else class="text-sm text-slate-400">Esta Orden de Compra no tiene entradas de almacén registradas todavía.</p>
    </div>

    <div v-if="lineas.length" class="overflow-x-auto bg-white border border-slate-200 rounded-xl mb-5">
      <table class="w-full text-sm tabular-nums">
        <thead>
          <tr class="bg-slate-50 text-[11px] uppercase tracking-wide text-slate-500">
            <th class="text-left px-4 py-2.5 font-normal font-sans">Insumo</th>
            <th class="text-left px-4 py-2.5 font-normal font-sans">Disponible para facturar</th>
            <th class="text-left px-4 py-2.5 font-normal font-sans">Cantidad a facturar</th>
            <th class="text-left px-4 py-2.5 font-normal font-sans">Precio unitario</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="l in lineas" :key="l.insumo_id" class="border-t border-slate-200" :class="Number(cantidades[l.insumo_id] || 0) > l.disponible ? 'bg-red-50' : ''">
            <td class="px-4 py-2.5 font-sans font-semibold">{{ l.clave }} · {{ l.descripcion }}</td>
            <td class="px-4 py-2.5">{{ l.disponible }} {{ l.unidad }}</td>
            <td class="px-4 py-2.5"><input v-model.number="cantidades[l.insumo_id]" type="number" inputmode="decimal" min="0" step="any" class="w-24 border border-slate-300 rounded px-2 py-1.5" /></td>
            <td class="px-4 py-2.5"><input v-model.number="precios[l.insumo_id]" type="number" inputmode="decimal" min="0" step="any" class="w-24 border border-slate-300 rounded px-2 py-1.5" /></td>
          </tr>
        </tbody>
      </table>
    </div>
    <p v-else-if="ocId" class="text-sm text-slate-400 mb-5">No hay saldo pendiente de facturar en esta Orden de Compra.</p>

    <div class="bg-white border border-slate-200 rounded-xl p-4 mb-5 grid sm:grid-cols-3 gap-3 max-w-xl">
      <div>
        <label class="block text-[11px] font-bold uppercase text-slate-500 mb-1">Subtotal</label>
        <input :value="subtotalCalculado.toFixed(2)" readonly class="w-full border border-slate-200 bg-slate-50 rounded-lg px-2.5 min-h-[42px] tabular-nums" />
      </div>
      <div>
        <label class="block text-[11px] font-bold uppercase text-slate-500 mb-1">IVA</label>
        <input v-model.number="iva" type="number" inputmode="decimal" min="0" step="any" class="w-full border border-slate-300 rounded-lg px-2.5 min-h-[42px]" />
      </div>
      <div>
        <label class="block text-[11px] font-bold uppercase text-slate-500 mb-1">Total</label>
        <input :value="(subtotalCalculado + Number(iva || 0)).toFixed(2)" readonly class="w-full border border-slate-200 bg-slate-50 rounded-lg px-2.5 min-h-[42px] tabular-nums font-bold" />
      </div>
    </div>

    <button class="min-h-[48px] bg-primary text-white font-bold rounded-lg px-5 text-sm disabled:opacity-50" :disabled="!puedeGuardar || guardando" @click="guardar">
      {{ guardando ? 'Guardando…' : 'Registrar factura' }}
    </button>
  </AppShell>
</template>

<script setup>
import { computed, onMounted, reactive, ref, watch } from 'vue';
import { useRouter } from 'vue-router';
import AppShell from '../components/AppShell.vue';
import { api } from '../lib/api.js';

const router = useRouter();
const ordenes = ref([]);
const ocId = ref(null);
const lineas = ref([]);
const cantidades = reactive({});
const precios = reactive({});
const serieFolio = ref('');
const folioFiscalUuid = ref('');
const iva = ref(0);
const xmlFile = ref(null);
const pdfFile = ref(null);
const error = ref('');
const guardando = ref(false);
const entradasOc = ref([]);
const entradaIdsSeleccionadas = ref([]);

async function cargarEntradasOc() {
  entradaIdsSeleccionadas.value = [];
  if (!ocId.value) { entradasOc.value = []; return; }
  const { data } = await api.get('/entradas-almacen', { params: { ocId: ocId.value } });
  entradasOc.value = data;
}
watch(ocId, cargarEntradasOc);

const subtotalCalculado = computed(() =>
  lineas.value.reduce((s, l) => s + Number(cantidades[l.insumo_id] || 0) * Number(precios[l.insumo_id] || 0), 0)
);

const puedeGuardar = computed(() => {
  const conCantidad = lineas.value.filter((l) => cantidades[l.insumo_id] > 0);
  if (conCantidad.length === 0) return false;
  return conCantidad.every((l) => Number(cantidades[l.insumo_id]) <= l.disponible && Number(precios[l.insumo_id]) > 0);
});

async function cargarDisponible() {
  if (!ocId.value) return;
  const { data } = await api.get(`/facturas/disponible/${ocId.value}`);
  lineas.value = data.filter((l) => l.disponible > 0);
  for (const k of Object.keys(cantidades)) delete cantidades[k];
  for (const l of lineas.value) precios[l.insumo_id] = Number(l.precio_negociado);
}
watch(ocId, cargarDisponible);

async function guardar() {
  error.value = '';
  guardando.value = true;
  try {
    const detalle = lineas.value
      .filter((l) => cantidades[l.insumo_id] > 0)
      .map((l) => ({ insumoId: l.insumo_id, cantidad: cantidades[l.insumo_id], precioUnitario: precios[l.insumo_id] }));

    const form = new FormData();
    form.append('ocId', ocId.value);
    form.append('serieFolio', serieFolio.value);
    form.append('folioFiscalUuid', folioFiscalUuid.value);
    form.append('subtotal', subtotalCalculado.value.toFixed(2));
    form.append('iva', Number(iva.value || 0).toFixed(2));
    form.append('detalle', JSON.stringify(detalle));
    form.append('entradaIds', JSON.stringify(entradaIdsSeleccionadas.value));
    if (xmlFile.value) form.append('xml', xmlFile.value);
    if (pdfFile.value) form.append('pdf', pdfFile.value);

    const { data } = await api.post('/facturas', form);
    router.push(`/facturas/${data.id}`);
  } catch (err) {
    error.value = err.response?.data?.error || 'No se pudo registrar la factura.';
  } finally {
    guardando.value = false;
  }
}

onMounted(async () => {
  const { data } = await api.get('/ordenes-compra', { params: { estatus: 'confirmada' } });
  ordenes.value = data;
  ocId.value = data[0]?.id ?? null;
  await Promise.all([cargarDisponible(), cargarEntradasOc()]);
});
</script>
