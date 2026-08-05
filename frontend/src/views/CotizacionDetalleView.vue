<template>
  <AppShell>
    <div v-if="!proceso" class="text-sm text-slate-500">Cargando…</div>
    <template v-else>
      <div class="flex items-center justify-between flex-wrap gap-3 mb-1 no-print">
        <div>
          <h2 class="font-display text-lg">{{ proceso.folio }}</h2>
          <p class="text-xs text-slate-500">
            {{ proceso.obra_nombre }} · Requisiciones: {{ proceso.requisiciones.map(r => r.folio).join(', ') }}
          </p>
        </div>
        <div class="flex items-center gap-2 flex-none">
          <span class="inline-flex text-[11.5px] font-bold px-2.5 py-0.5 rounded-full" :class="proceso.estatus === 'cerrado' ? 'bg-emerald-50 text-success' : 'bg-amber-50 text-warning'">
            {{ proceso.estatus === 'cerrado' ? 'Cerrado' : 'En cotización' }}
          </span>
          <button class="min-h-[40px] bg-primary text-white text-sm font-bold rounded-lg px-4" @click="window.print()">Imprimir / Guardar PDF</button>
        </div>
      </div>

      <p v-if="error" class="bg-red-50 border border-danger/30 text-danger text-sm rounded-lg px-4 py-3 my-4 no-print">{{ error }}</p>
      <p v-if="aviso" class="bg-emerald-50 border border-success/30 text-success text-sm rounded-lg px-4 py-3 my-4 no-print">{{ aviso }}</p>

      <div class="print-sheet bg-white border border-slate-200 rounded-xl p-5 mb-6">
        <ReportePrintHeader
          :titulo="`Cuadro comparativo ${proceso.folio}`"
          :subtitulo="`${proceso.obra_nombre} · Requisiciones: ${proceso.requisiciones.map(r => r.folio).join(', ')} · Estatus: ${proceso.estatus === 'cerrado' ? 'Cerrado' : 'En cotización'}`"
        />
        <table class="w-full text-sm tabular-nums">
          <thead>
            <tr class="bg-slate-50 text-[11px] uppercase tracking-wide text-slate-500">
              <th class="text-left px-4 py-2.5 font-normal font-sans">Insumo</th>
              <th class="text-left px-4 py-2.5 font-normal">Cant.</th>
              <th v-for="prov in proceso.proveedores" :key="prov.id" class="text-left px-4 py-2.5 font-normal font-sans">
                {{ prov.razon_social }}
              </th>
              <th class="text-left px-4 py-2.5 font-normal font-sans">Ganador</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="ins in proceso.insumos" :key="ins.id" class="border-t border-slate-200">
              <td class="px-4 py-2.5 font-sans font-semibold">{{ ins.clave }} · {{ ins.descripcion }}</td>
              <td class="px-4 py-2.5">{{ Number(ins.cantidad_total).toLocaleString('es-MX') }} {{ ins.unidad }}</td>
              <td v-for="prov in proceso.proveedores" :key="prov.id" class="px-4 py-2.5">
                <span v-if="precioDe(prov, ins.id)" :class="esGanador(ins.id, prov, ins.id) ? 'text-success font-bold' : ''">
                  {{ mxn(precioDe(prov, ins.id)) }}
                </span>
                <span v-else class="text-slate-300">—</span>
              </td>
              <td class="px-4 py-2.5 font-sans">
                <select
                  v-if="proceso.estatus !== 'cerrado' && puedeComprar"
                  :value="ganadorPorInsumo[ins.id] || ''"
                  class="border border-slate-300 rounded px-2 py-1 text-xs no-print"
                  @change="marcarGanador(ins.id, $event.target.value)"
                >
                  <option value="" disabled>Elegir…</option>
                  <option v-for="opt in opcionesGanador(ins.id)" :key="opt.detalleId" :value="opt.detalleId">
                    {{ opt.proveedor }} — {{ mxn(opt.precio) }}
                  </option>
                </select>
                <span v-else class="text-success text-xs font-bold">{{ nombreGanador(ins.id) || (proceso.estatus === 'cerrado' ? '—' : 'Pendiente de elegir') }}</span>
                <span v-if="proceso.estatus !== 'cerrado' && puedeComprar" class="print-only text-success text-xs font-bold">{{ nombreGanador(ins.id) || 'Pendiente de elegir' }}</span>
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      <template v-if="proceso.estatus !== 'cerrado' && puedeComprar">
        <h3 class="text-sm font-display mb-2 no-print">Agregar cotización de proveedor</h3>
        <form class="bg-white border border-slate-200 rounded-xl p-4 mb-6 no-print" @submit.prevent="agregarProveedor">
          <div class="grid sm:grid-cols-3 gap-3 mb-3">
            <div>
              <label class="block text-[11px] font-bold uppercase text-slate-500 mb-1">Proveedor</label>
              <select v-model.number="formProv.proveedorId" required class="w-full border border-slate-300 rounded-lg px-2.5 min-h-[42px]">
                <option v-for="p in proveedoresDisponibles" :key="p.id" :value="p.id">{{ p.razon_social }}</option>
              </select>
            </div>
            <div>
              <label class="block text-[11px] font-bold uppercase text-slate-500 mb-1">Condiciones de pago</label>
              <input v-model="formProv.condicionesPago" placeholder="Ej. 30 días" class="w-full border border-slate-300 rounded-lg px-2.5 min-h-[42px]" />
            </div>
            <div>
              <label class="block text-[11px] font-bold uppercase text-slate-500 mb-1">Tiempo de entrega (días)</label>
              <input v-model.number="formProv.tiempoEntregaDias" type="number" inputmode="numeric" min="0" class="w-full border border-slate-300 rounded-lg px-2.5 min-h-[42px]" />
            </div>
          </div>
          <div class="grid sm:grid-cols-2 gap-3 mb-3">
            <div v-for="ins in proceso.insumos" :key="ins.id">
              <label class="block text-[11px] font-bold uppercase text-slate-500 mb-1">{{ ins.clave }} · {{ ins.descripcion }} ({{ ins.unidad }})</label>
              <input v-model.number="precios[ins.id]" type="number" inputmode="decimal" min="0" step="any" placeholder="Precio unitario" class="w-full border border-slate-300 rounded-lg px-2.5 min-h-[42px]" />
            </div>
          </div>
          <button type="submit" class="min-h-[44px] bg-primary text-white font-bold rounded-lg px-5 text-sm" :disabled="!formProv.proveedorId || guardandoProv">
            {{ guardandoProv ? 'Guardando…' : 'Agregar cotización' }}
          </button>
        </form>

        <button
          class="min-h-[48px] bg-success text-white font-bold rounded-lg px-5 text-sm disabled:opacity-50 no-print"
          :disabled="!todosConGanador || cerrando"
          @click="cerrar"
        >
          {{ cerrando ? 'Cerrando…' : 'Cerrar cuadro comparativo' }}
        </button>
        <span v-if="!todosConGanador" class="text-xs text-slate-400 ml-3 no-print">Elige proveedor ganador para todos los insumos antes de cerrar.</span>
      </template>

      <template v-else-if="proceso.estatus === 'cerrado' && puedeComprar">
        <button class="min-h-[48px] bg-primary text-white font-bold rounded-lg px-5 text-sm no-print" :disabled="generando" @click="generarOc">
          {{ generando ? 'Generando…' : 'Generar Orden(es) de Compra' }}
        </button>
        <div v-if="ocsGeneradas.length" class="mt-4 flex flex-col gap-2 no-print">
          <RouterLink v-for="oc in ocsGeneradas" :key="oc.id" :to="`/ordenes-compra/${oc.id}`" class="text-sm font-semibold text-primary underline">
            {{ oc.folio }} — {{ oc.proveedor_nombre }} generada ✓
          </RouterLink>
        </div>
      </template>

      <p v-else class="text-xs text-slate-400 no-print">Solo Compras/Dirección pueden agregar cotizaciones, cerrar el cuadro o generar la Orden de Compra.</p>
    </template>
  </AppShell>
</template>

<script setup>
import { computed, onMounted, reactive, ref } from 'vue';
import { useRoute } from 'vue-router';
import AppShell from '../components/AppShell.vue';
import ReportePrintHeader from '../components/ReportePrintHeader.vue';
import { api } from '../lib/api.js';
import { useAuthStore } from '../stores/auth.js';

const auth = useAuthStore();
const puedeComprar = ['comprador', 'direccion'].includes(auth.rol);
const route = useRoute();
const proceso = ref(null);
const proveedoresTodos = ref([]);
const error = ref('');
const aviso = ref('');
const guardandoProv = ref(false);
const cerrando = ref(false);
const generando = ref(false);
const ocsGeneradas = ref([]);
const formProv = reactive({ proveedorId: null, condicionesPago: '', tiempoEntregaDias: null });
const precios = reactive({});

function mxn(n) {
  return new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN' }).format(n || 0);
}

const proveedoresDisponibles = computed(() => {
  const yaCotizaron = new Set((proceso.value?.proveedores ?? []).map((p) => p.proveedor_id));
  return proveedoresTodos.value.filter((p) => !yaCotizaron.has(p.id));
});

const ganadorPorInsumo = computed(() => {
  const map = {};
  for (const g of proceso.value?.ganadores ?? []) map[g.insumo_id] = g.cotizacion_detalle_id;
  return map;
});

const todosConGanador = computed(() => {
  if (!proceso.value) return false;
  return proceso.value.insumos.every((ins) => ganadorPorInsumo.value[ins.id]);
});

function precioDe(prov, insumoId) {
  return prov.detalle.find((d) => d.insumo_id === insumoId)?.precio_unitario;
}

function esGanador(insumoId, prov, targetInsumoId) {
  if (insumoId !== targetInsumoId) return false;
  const detalle = prov.detalle.find((d) => d.insumo_id === insumoId);
  return detalle && ganadorPorInsumo.value[insumoId] === detalle.id;
}

function opcionesGanador(insumoId) {
  return proceso.value.proveedores
    .map((prov) => {
      const d = prov.detalle.find((d) => d.insumo_id === insumoId);
      return d ? { detalleId: d.id, proveedor: prov.razon_social, precio: d.precio_unitario } : null;
    })
    .filter(Boolean);
}

function nombreGanador(insumoId) {
  const opts = opcionesGanador(insumoId);
  const detalleId = ganadorPorInsumo.value[insumoId];
  return opts.find((o) => o.detalleId === detalleId)?.proveedor ?? '—';
}

async function cargar() {
  const { data } = await api.get(`/cotizaciones/${route.params.id}`);
  proceso.value = data;
}

async function marcarGanador(insumoId, cotizacionDetalleId) {
  error.value = '';
  try {
    const { data } = await api.post(`/cotizaciones/${route.params.id}/ganador`, { insumoId, cotizacionDetalleId: Number(cotizacionDetalleId) });
    proceso.value = data;
  } catch (err) {
    error.value = err.response?.data?.error || 'No se pudo marcar el ganador.';
  }
}

async function agregarProveedor() {
  error.value = '';
  const detalle = proceso.value.insumos
    .filter((ins) => precios[ins.id] > 0)
    .map((ins) => ({ insumoId: ins.id, precioUnitario: precios[ins.id] }));
  if (detalle.length === 0) {
    error.value = 'Captura al menos un precio.';
    return;
  }
  guardandoProv.value = true;
  try {
    const { data } = await api.post(`/cotizaciones/${route.params.id}/proveedores`, { ...formProv, detalle });
    proceso.value = data;
    formProv.proveedorId = null;
    formProv.condicionesPago = '';
    formProv.tiempoEntregaDias = null;
    for (const k of Object.keys(precios)) delete precios[k];
  } catch (err) {
    error.value = err.response?.data?.error || 'No se pudo agregar la cotización.';
  } finally {
    guardandoProv.value = false;
  }
}

async function cerrar() {
  error.value = '';
  cerrando.value = true;
  try {
    const { data } = await api.post(`/cotizaciones/${route.params.id}/cerrar`);
    proceso.value = data;
    aviso.value = 'Cuadro comparativo cerrado. Ya puedes generar la(s) Orden(es) de Compra.';
  } catch (err) {
    error.value = err.response?.data?.error || 'No se pudo cerrar el cuadro comparativo.';
  } finally {
    cerrando.value = false;
  }
}

async function generarOc() {
  error.value = '';
  generando.value = true;
  try {
    const { data } = await api.post(`/ordenes-compra/generar/${route.params.id}`);
    ocsGeneradas.value = data;
  } catch (err) {
    error.value = err.response?.data?.error || 'No se pudo generar la Orden de Compra.';
  } finally {
    generando.value = false;
  }
}

onMounted(async () => {
  const { data } = await api.get('/proveedores');
  proveedoresTodos.value = data;
  await cargar();
});
</script>
