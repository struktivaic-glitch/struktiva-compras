<template>
  <AppShell>
    <div class="flex items-center justify-between mb-1 flex-wrap gap-3">
      <h2 class="font-display text-[36px]">Destajos</h2>
      <select v-model.number="obraId" class="text-sm border border-slate-300 rounded-lg px-2.5 py-2">
        <option v-for="o in obras" :key="o.id" :value="o.id">{{ o.nombre }}</option>
      </select>
    </div>
    <p class="text-xs text-slate-500 mb-4">
      Cada destajo liga un destajista a un concepto del presupuesto general, con su propio precio pactado
      (normalmente cubre solo mano de obra + materiales inherentes a la actividad). El monto ganado se calcula
      del mismo avance físico ya confirmado en "Avance de Obra" — no se vuelve a capturar aparte.
    </p>

    <p v-if="error" class="bg-red-50 border border-danger/30 text-danger text-sm rounded-lg px-4 py-3 mb-4">{{ error }}</p>
    <p v-if="aviso" class="bg-emerald-50 border border-success/30 text-success text-sm rounded-lg px-4 py-3 mb-4">{{ aviso }}</p>

    <button class="min-h-[42px] bg-primary text-white font-bold rounded-lg px-5 text-sm mb-5" @click="abrirNuevo">
      + Nuevo destajo
    </button>

    <div class="overflow-x-auto bg-white border border-slate-200 rounded-xl">
      <table class="w-full text-sm tabular-nums">
        <thead>
          <tr class="bg-slate-50 text-[11px] uppercase tracking-wide text-slate-500">
            <th class="text-left px-4 py-2.5 font-normal font-sans">Destajista</th>
            <th class="text-left px-4 py-2.5 font-normal font-sans">Concepto</th>
            <th class="text-left px-4 py-2.5 font-normal font-sans">Precio destajo</th>
            <th class="text-left px-4 py-2.5 font-normal font-sans">Avance</th>
            <th class="text-left px-4 py-2.5 font-normal font-sans">Ganado</th>
            <th class="text-left px-4 py-2.5 font-normal font-sans">Pagado</th>
            <th class="text-left px-4 py-2.5 font-normal font-sans">Saldo</th>
            <th class="text-left px-4 py-2.5 font-normal font-sans">Estatus</th>
            <th class="text-left px-4 py-2.5 font-normal font-sans"></th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="d in destajos" :key="d.id" class="border-t border-slate-200">
            <td class="px-4 py-2.5 font-sans font-semibold">{{ d.destajista_nombre }}</td>
            <td class="px-4 py-2.5 font-sans">{{ d.concepto_clave }} · {{ d.concepto_descripcion }}</td>
            <td class="px-4 py-2.5">{{ mxn(d.precio_destajo) }} / {{ d.concepto_unidad }}</td>
            <td class="px-4 py-2.5">{{ Number(d.cantidad_avance_confirmado).toLocaleString('es-MX') }} {{ d.concepto_unidad }}</td>
            <td class="px-4 py-2.5">{{ mxn(d.monto_ganado) }}</td>
            <td class="px-4 py-2.5">{{ mxn(d.monto_pagado) }}</td>
            <td class="px-4 py-2.5 font-bold">{{ mxn(d.saldo) }}</td>
            <td class="px-4 py-2.5">
              <span class="inline-flex text-[11.5px] font-bold px-2.5 py-0.5 rounded-full" :class="estatusClase(d.estatus)">
                {{ estatusTexto(d.estatus) }}
              </span>
            </td>
            <td class="px-4 py-2.5 space-x-2">
              <template v-if="d.estatus === 'activo'">
                <button class="text-xs font-semibold text-primary underline" @click="abrirPago(d)">+ Pago</button>
                <button class="text-xs font-semibold text-slate-500 underline" @click="verDetalle(d)">Detalle</button>
              </template>
              <button v-else class="text-xs font-semibold text-slate-500 underline" @click="verDetalle(d)">Detalle</button>
            </td>
          </tr>
          <tr v-if="!cargando && !destajos.length">
            <td colspan="9" class="px-4 py-8 text-center text-slate-400 text-sm">Esta obra no tiene destajos todavía.</td>
          </tr>
        </tbody>
      </table>
    </div>

    <!-- Modal: nuevo destajo -->
    <div v-if="nuevoAbierto" class="fixed inset-0 bg-black/40 flex items-center justify-center z-50 px-4" @click.self="nuevoAbierto = false">
      <div class="bg-white rounded-xl shadow-xl w-full max-w-md p-5">
        <h3 class="font-display text-base mb-4">Nuevo destajo</h3>
        <p v-if="errorNuevo" class="bg-red-50 border border-danger/30 text-danger text-xs rounded-lg px-3 py-2 mb-3">{{ errorNuevo }}</p>

        <label class="block text-[11px] font-bold uppercase text-slate-500 mb-1">Destajista</label>
        <select v-model.number="nuevo.destajistaId" class="w-full border border-slate-300 rounded-lg px-2.5 min-h-[42px] mb-3">
          <option :value="null" disabled>Elegir…</option>
          <option v-for="d in destajistas" :key="d.id" :value="d.id">{{ d.nombre }}</option>
        </select>

        <label class="block text-[11px] font-bold uppercase text-slate-500 mb-1">Concepto (presupuesto general)</label>
        <select v-model.number="nuevo.conceptoId" class="w-full border border-slate-300 rounded-lg px-2.5 min-h-[42px] mb-1" @change="actualizarConceptoElegido">
          <option :value="null" disabled>Elegir…</option>
          <option v-for="c in conceptosDisponibles" :key="c.id" :value="c.id">{{ c.clave }} · {{ c.descripcion }} ({{ c.unidad }})</option>
        </select>
        <p v-if="conceptoElegido" class="text-[11px] text-slate-500 mb-3">
          Contratado: {{ Number(conceptoElegido.cantidad_contratada).toLocaleString('es-MX') }} {{ conceptoElegido.unidad }} ·
          P.U. general: {{ mxn(conceptoElegido.precio_unitario) }}
        </p>

        <label class="block text-[11px] font-bold uppercase text-slate-500 mb-1">Precio de destajo ({{ conceptoElegido?.unidad || 'unidad' }})</label>
        <input v-model.number="nuevo.precioDestajo" type="number" inputmode="decimal" min="0" step="any" class="w-full border border-slate-300 rounded-lg px-2.5 min-h-[42px] mb-1" />
        <p class="text-[11px] text-slate-400 mb-3">Normalmente distinto al P.U. general: cubre solo mano de obra + materiales que aporta el destajista.</p>

        <label class="block text-[11px] font-bold uppercase text-slate-500 mb-1">Notas (opcional)</label>
        <textarea v-model="nuevo.notas" rows="2" class="w-full border border-slate-300 rounded-lg px-2.5 py-2 mb-4 text-sm"></textarea>

        <div class="flex gap-2">
          <button class="flex-1 min-h-[44px] border border-slate-300 rounded-lg text-sm font-semibold" @click="nuevoAbierto = false">Cancelar</button>
          <button class="flex-1 min-h-[44px] bg-primary text-white rounded-lg text-sm font-bold disabled:opacity-50" :disabled="!puedeGuardarNuevo || guardandoNuevo" @click="guardarNuevo">
            {{ guardandoNuevo ? 'Guardando…' : 'Crear destajo' }}
          </button>
        </div>
      </div>
    </div>

    <!-- Modal: registrar pago -->
    <div v-if="destajoParaPago" class="fixed inset-0 bg-black/40 flex items-center justify-center z-50 px-4" @click.self="destajoParaPago = null">
      <div class="bg-white rounded-xl shadow-xl w-full max-w-sm p-5">
        <h3 class="font-display text-base mb-1">{{ destajoParaPago.destajista_nombre }}</h3>
        <p class="text-xs text-slate-500 mb-4">Saldo pendiente: {{ mxn(destajoParaPago.saldo) }}</p>
        <p v-if="errorPago" class="bg-red-50 border border-danger/30 text-danger text-xs rounded-lg px-3 py-2 mb-3">{{ errorPago }}</p>

        <label class="block text-[11px] font-bold uppercase text-slate-500 mb-1">Fecha</label>
        <input v-model="pago.fecha" type="date" class="w-full border border-slate-300 rounded-lg px-2.5 min-h-[42px] mb-3" />

        <label class="block text-[11px] font-bold uppercase text-slate-500 mb-1">Monto</label>
        <input v-model.number="pago.monto" type="number" inputmode="decimal" min="0" :max="destajoParaPago.saldo" step="any" class="w-full border border-slate-300 rounded-lg px-2.5 min-h-[42px] mb-3" />

        <label class="block text-[11px] font-bold uppercase text-slate-500 mb-1">Notas (opcional)</label>
        <textarea v-model="pago.notas" rows="2" class="w-full border border-slate-300 rounded-lg px-2.5 py-2 mb-4 text-sm"></textarea>

        <div class="flex gap-2">
          <button class="flex-1 min-h-[44px] border border-slate-300 rounded-lg text-sm font-semibold" @click="destajoParaPago = null">Cancelar</button>
          <button class="flex-1 min-h-[44px] bg-primary text-white rounded-lg text-sm font-bold disabled:opacity-50" :disabled="!pago.monto || pago.monto <= 0 || guardandoPago" @click="guardarPago">
            {{ guardandoPago ? 'Guardando…' : 'Registrar pago' }}
          </button>
        </div>
      </div>
    </div>

    <!-- Modal: detalle / historial -->
    <div v-if="detalle" class="fixed inset-0 bg-black/40 flex items-center justify-center z-50 px-4" @click.self="detalle = null">
      <div class="bg-white rounded-xl shadow-xl w-full max-w-lg p-5">
        <div class="flex items-center justify-between mb-1">
          <h3 class="font-display text-base">{{ detalle.destajista_nombre }} — {{ detalle.concepto_clave }}</h3>
          <span class="inline-flex text-[11.5px] font-bold px-2.5 py-0.5 rounded-full" :class="estatusClase(detalle.estatus)">{{ estatusTexto(detalle.estatus) }}</span>
        </div>
        <p class="text-xs text-slate-500 mb-4">{{ detalle.concepto_descripcion }} · {{ detalle.obra_nombre }}</p>

        <div class="grid grid-cols-3 gap-2 mb-4 text-center">
          <div class="bg-slate-50 rounded-lg p-2"><div class="text-[10px] text-slate-500 uppercase">Ganado</div><div class="font-bold tabular-nums">{{ mxn(detalle.monto_ganado) }}</div></div>
          <div class="bg-slate-50 rounded-lg p-2"><div class="text-[10px] text-slate-500 uppercase">Pagado</div><div class="font-bold tabular-nums">{{ mxn(detalle.monto_pagado) }}</div></div>
          <div class="bg-slate-50 rounded-lg p-2"><div class="text-[10px] text-slate-500 uppercase">Saldo</div><div class="font-bold tabular-nums">{{ mxn(detalle.saldo) }}</div></div>
        </div>

        <h4 class="text-xs font-bold uppercase text-slate-500 mb-2">Pagos</h4>
        <div class="divide-y divide-slate-100 mb-4 max-h-40 overflow-y-auto">
          <p v-if="!detalle.pagos.length" class="text-xs text-slate-400 py-2">Sin pagos registrados todavía.</p>
          <div v-for="p in detalle.pagos" :key="p.id" class="flex justify-between text-sm py-1.5">
            <span class="text-slate-500">{{ formatoFecha(p.fecha) }} · {{ p.registrado_por_nombre }}</span>
            <span class="font-semibold tabular-nums">{{ mxn(p.monto) }}</span>
          </div>
        </div>

        <div v-if="detalle.estatus === 'activo'" class="flex gap-2">
          <button class="flex-1 min-h-[40px] border border-danger/30 text-danger rounded-lg text-xs font-semibold" @click="cerrarDestajo('cancelado')">Cancelar destajo</button>
          <button class="flex-1 min-h-[40px] border border-success/30 text-success rounded-lg text-xs font-semibold" @click="cerrarDestajo('liquidado')">Marcar liquidado</button>
        </div>
        <button class="mt-2 w-full min-h-[40px] border border-slate-300 rounded-lg text-sm font-semibold" @click="detalle = null">Cerrar</button>
      </div>
    </div>
  </AppShell>
</template>

<script setup>
import { computed, onMounted, reactive, ref, watch } from 'vue';
import AppShell from '../components/AppShell.vue';
import { api } from '../lib/api.js';

const obras = ref([]);
const obraId = ref(null);
const destajos = ref([]);
const destajistas = ref([]);
const conceptosDisponibles = ref([]);
const cargando = ref(false);
const error = ref('');
const aviso = ref('');

function mxn(n) {
  return new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN' }).format(n || 0);
}
function formatoFecha(fecha) {
  return new Date(fecha).toLocaleDateString('es-MX', { day: '2-digit', month: 'short', year: 'numeric' });
}
const ESTATUS_TEXTO = { activo: 'Activo', liquidado: 'Liquidado', cancelado: 'Cancelado' };
function estatusTexto(e) { return ESTATUS_TEXTO[e] ?? e; }
function estatusClase(e) {
  if (e === 'activo') return 'bg-emerald-50 text-success';
  if (e === 'liquidado') return 'bg-slate-100 text-slate-500';
  return 'bg-red-50 text-danger';
}

async function cargar() {
  if (!obraId.value) return;
  cargando.value = true;
  try {
    const [{ data: d }, { data: c }] = await Promise.all([
      api.get('/destajos', { params: { obraId: obraId.value } }),
      api.get('/destajos/conceptos-disponibles', { params: { obraId: obraId.value } }),
    ]);
    destajos.value = d;
    conceptosDisponibles.value = c;
  } catch (err) {
    error.value = err.response?.data?.error || 'No se pudo cargar la información.';
  } finally {
    cargando.value = false;
  }
}
watch(obraId, cargar);

// --- Nuevo destajo ---
const nuevoAbierto = ref(false);
const nuevo = reactive({ destajistaId: null, conceptoId: null, precioDestajo: null, notas: '' });
const errorNuevo = ref('');
const guardandoNuevo = ref(false);

const conceptoElegido = computed(() => conceptosDisponibles.value.find((c) => c.id === nuevo.conceptoId));
function actualizarConceptoElegido() {}
const puedeGuardarNuevo = computed(() => nuevo.destajistaId && nuevo.conceptoId && nuevo.precioDestajo > 0);

function abrirNuevo() {
  Object.assign(nuevo, { destajistaId: null, conceptoId: null, precioDestajo: null, notas: '' });
  errorNuevo.value = '';
  nuevoAbierto.value = true;
}

async function guardarNuevo() {
  errorNuevo.value = '';
  guardandoNuevo.value = true;
  try {
    await api.post('/destajos', nuevo);
    nuevoAbierto.value = false;
    aviso.value = 'Destajo creado.';
    await cargar();
  } catch (err) {
    errorNuevo.value = err.response?.data?.error || 'No se pudo crear el destajo.';
  } finally {
    guardandoNuevo.value = false;
  }
}

// --- Pagos ---
const destajoParaPago = ref(null);
const pago = reactive({ fecha: '', monto: null, notas: '' });
const errorPago = ref('');
const guardandoPago = ref(false);

function abrirPago(d) {
  destajoParaPago.value = d;
  pago.fecha = new Date().toISOString().slice(0, 10);
  pago.monto = null;
  pago.notas = '';
  errorPago.value = '';
}

async function guardarPago() {
  errorPago.value = '';
  guardandoPago.value = true;
  try {
    await api.post(`/destajos/${destajoParaPago.value.id}/pagos`, pago);
    destajoParaPago.value = null;
    aviso.value = 'Pago registrado.';
    await cargar();
  } catch (err) {
    errorPago.value = err.response?.data?.error || 'No se pudo registrar el pago.';
  } finally {
    guardandoPago.value = false;
  }
}

// --- Detalle ---
const detalle = ref(null);

async function verDetalle(d) {
  const { data } = await api.get(`/destajos/${d.id}`);
  detalle.value = data;
}

async function cerrarDestajo(estatus) {
  try {
    await api.post(`/destajos/${detalle.value.id}/cerrar`, { estatus });
    detalle.value = null;
    aviso.value = estatus === 'liquidado' ? 'Destajo marcado como liquidado.' : 'Destajo cancelado.';
    await cargar();
  } catch (err) {
    error.value = err.response?.data?.error || 'No se pudo actualizar el destajo.';
  }
}

onMounted(async () => {
  const [{ data: o }, { data: ds }] = await Promise.all([
    api.get('/catalogo/obras'),
    api.get('/destajistas'),
  ]);
  obras.value = o;
  destajistas.value = ds;
  obraId.value = o[0]?.id ?? null;
});
</script>
