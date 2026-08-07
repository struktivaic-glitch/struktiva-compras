<template>
  <AppShell>
    <h2 class="font-display text-[36px] mb-1">Importar Explosión de Insumos</h2>
    <p class="text-xs text-slate-500 mb-5">Sube el Excel exportado de Neodata ("Listado de Insumos"). El presupuesto se carga a nivel Obra completa.</p>

    <div class="bg-white border border-slate-200 rounded-xl p-4 mb-5 grid sm:grid-cols-2 gap-4">
      <div>
        <label class="block text-[11px] font-bold uppercase text-slate-500 mb-1">Obra destino</label>
        <select v-model="obraSeleccion" class="w-full border border-slate-300 rounded-lg px-2.5 min-h-[42px]">
          <option v-for="o in obras" :key="o.id" :value="o.id">{{ o.nombre }}</option>
          <option value="__nueva__">+ Crear obra nueva…</option>
        </select>

        <div v-if="obraSeleccion === '__nueva__'" class="mt-3 grid gap-2.5 bg-slate-50 border border-slate-200 rounded-lg p-3">
          <input v-model="nuevaObra.nombre" placeholder="Nombre de la obra" class="border border-slate-300 rounded-lg px-2.5 min-h-[40px] text-sm" />
          <input v-model="nuevaObra.ubicacion" placeholder="Ubicación" class="border border-slate-300 rounded-lg px-2.5 min-h-[40px] text-sm" />
          <input v-model="nuevaObra.cliente" placeholder="Cliente" class="border border-slate-300 rounded-lg px-2.5 min-h-[40px] text-sm" />
          <button class="min-h-[38px] bg-primary text-white text-xs font-bold rounded-lg px-4 w-fit" :disabled="!nuevaObra.nombre.trim() || creandoObra" @click="crearObra">
            {{ creandoObra ? 'Creando…' : 'Crear obra' }}
          </button>
        </div>
      </div>

      <div>
        <label class="block text-[11px] font-bold uppercase text-slate-500 mb-1">Archivo Excel (.xlsx)</label>
        <input type="file" accept=".xlsx" @change="archivo = $event.target.files[0]" class="w-full text-xs border border-slate-300 rounded-lg px-2.5 min-h-[42px]" />
        <button class="mt-3 min-h-[42px] bg-primary text-white font-bold rounded-lg px-5 text-sm disabled:opacity-50" :disabled="!archivo || !obraIdFinal || analizando" @click="analizar">
          {{ analizando ? 'Analizando…' : 'Analizar archivo' }}
        </button>
      </div>
    </div>

    <p v-if="error" class="bg-red-50 border border-danger/30 text-danger text-sm rounded-lg px-4 py-3 mb-4">{{ error }}</p>
    <p v-if="exito" class="bg-emerald-50 border border-success/30 text-success text-sm rounded-lg px-4 py-3 mb-4">{{ exito }}</p>

    <template v-if="resultado">
      <div class="grid sm:grid-cols-3 gap-3.5 mb-5">
        <div v-for="r in resultado.resumenPorFamilia" :key="r.familia" class="bg-white border border-slate-200 rounded-xl p-4">
          <div class="text-[11px] font-bold uppercase text-slate-500">{{ r.familia }}</div>
          <div class="font-display text-xl tabular-nums">{{ mxn(r.importeTotal) }}</div>
          <div class="text-xs text-slate-500">{{ r.cantidadInsumos }} insumo(s)</div>
        </div>
      </div>

      <div class="overflow-x-auto bg-white border border-slate-200 rounded-xl mb-5 max-h-[420px] overflow-y-auto">
        <table class="w-full text-sm tabular-nums">
          <thead class="sticky top-0 bg-slate-50">
            <tr class="text-[11px] uppercase tracking-wide text-slate-500">
              <th class="text-left px-4 py-2.5 font-normal font-sans">Familia</th>
              <th class="text-left px-4 py-2.5 font-normal font-sans">Clave</th>
              <th class="text-left px-4 py-2.5 font-normal font-sans">Descripción</th>
              <th class="text-left px-4 py-2.5 font-normal font-sans">Un.</th>
              <th class="text-left px-4 py-2.5 font-normal font-sans">Cantidad</th>
              <th class="text-left px-4 py-2.5 font-normal font-sans">Precio</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="(item, i) in resultado.items" :key="i" class="border-t border-slate-100">
              <td class="px-4 py-2 font-sans text-slate-500">{{ item.familia }}</td>
              <td class="px-4 py-2 font-semibold">{{ item.clave }}</td>
              <td class="px-4 py-2 font-sans">{{ item.descripcion }}</td>
              <td class="px-4 py-2 font-sans">{{ item.unidad }}</td>
              <td class="px-4 py-2">{{ item.cantidad }}</td>
              <td class="px-4 py-2">{{ mxn(item.precio) }}</td>
            </tr>
          </tbody>
        </table>
      </div>

      <button class="min-h-[48px] bg-success text-white font-bold rounded-lg px-5 text-sm disabled:opacity-50" :disabled="confirmando" @click="confirmar">
        {{ confirmando ? 'Guardando…' : `Confirmar e importar ${resultado.items.length} insumos` }}
      </button>
    </template>
  </AppShell>
</template>

<script setup>
import { computed, onMounted, reactive, ref } from 'vue';
import AppShell from '../components/AppShell.vue';
import { api } from '../lib/api.js';

const obras = ref([]);
const obraSeleccion = ref(null);
const nuevaObra = reactive({ nombre: '', ubicacion: '', cliente: '' });
const creandoObra = ref(false);
const archivo = ref(null);
const analizando = ref(false);
const confirmando = ref(false);
const resultado = ref(null);
const error = ref('');
const exito = ref('');

const obraIdFinal = computed(() => (obraSeleccion.value === '__nueva__' ? null : obraSeleccion.value));

function mxn(n) {
  return new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN' }).format(n || 0);
}

async function cargarObras() {
  const { data } = await api.get('/catalogo/obras');
  obras.value = data;
  obraSeleccion.value = data[0]?.id ?? '__nueva__';
}

async function crearObra() {
  error.value = '';
  creandoObra.value = true;
  try {
    const { data } = await api.post('/obras', nuevaObra);
    await cargarObras();
    obraSeleccion.value = data.id;
  } catch (err) {
    error.value = err.response?.data?.error || 'No se pudo crear la obra.';
  } finally {
    creandoObra.value = false;
  }
}

async function analizar() {
  error.value = '';
  exito.value = '';
  resultado.value = null;
  analizando.value = true;
  try {
    const form = new FormData();
    form.append('archivo', archivo.value);
    const { data } = await api.post('/importaciones/explosion-insumos/analizar', form);
    resultado.value = data;
  } catch (err) {
    error.value = err.response?.data?.error || 'No se pudo leer el archivo.';
  } finally {
    analizando.value = false;
  }
}

async function confirmar() {
  error.value = '';
  confirmando.value = true;
  try {
    const { data } = await api.post('/importaciones/explosion-insumos/confirmar', {
      obraId: obraIdFinal.value,
      items: resultado.value.items,
    });
    exito.value = `Importación completa: ${data.totalItems} insumos (${data.insumosNuevos} nuevos, ${data.insumosActualizados} actualizados), ${data.familiasCreadas} familia(s) nueva(s).`;
    resultado.value = null;
    archivo.value = null;
  } catch (err) {
    error.value = err.response?.data?.error || 'No se pudo guardar la importación.';
  } finally {
    confirmando.value = false;
  }
}

onMounted(cargarObras);
</script>
