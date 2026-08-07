<template>
  <AppShell>
    <div class="flex items-center justify-between mb-4">
      <h2 class="font-display text-[36px]">Proveedores</h2>
      <label v-if="puedeEditar" class="flex items-center gap-1.5 text-xs text-slate-500">
        <input type="checkbox" v-model="incluirInactivos" @change="cargar" class="w-4 h-4" /> Mostrar inactivos
      </label>
    </div>

    <form v-if="puedeCrear" class="bg-white border border-slate-200 rounded-xl p-4 mb-5 grid sm:grid-cols-5 gap-3 items-end" @submit.prevent="crear">
      <div class="sm:col-span-2">
        <label class="block text-[11px] font-bold uppercase text-slate-500 mb-1">Razón social</label>
        <input v-model="form.razonSocial" required class="w-full border border-slate-300 rounded-lg px-2.5 min-h-[42px]" />
      </div>
      <div>
        <label class="block text-[11px] font-bold uppercase text-slate-500 mb-1">RFC</label>
        <input v-model="form.rfc" class="w-full border border-slate-300 rounded-lg px-2.5 min-h-[42px]" />
      </div>
      <div>
        <label class="block text-[11px] font-bold uppercase text-slate-500 mb-1">Días crédito</label>
        <input v-model.number="form.diasCredito" type="number" inputmode="numeric" min="0" class="w-full border border-slate-300 rounded-lg px-2.5 min-h-[42px]" />
      </div>
      <div>
        <label class="block text-[11px] font-bold uppercase text-slate-500 mb-1">Moneda</label>
        <select v-model="form.moneda" class="w-full border border-slate-300 rounded-lg px-2.5 min-h-[42px]">
          <option value="MXN">MXN</option>
          <option value="USD">USD</option>
        </select>
      </div>
      <div class="sm:col-span-4">
        <label class="block text-[11px] font-bold uppercase text-slate-500 mb-1">Contacto</label>
        <input v-model="form.contacto" placeholder="Nombre · correo / teléfono" class="w-full border border-slate-300 rounded-lg px-2.5 min-h-[42px]" />
      </div>
      <button type="submit" class="min-h-[42px] bg-primary text-white font-bold rounded-lg px-5 text-sm" :disabled="guardando">
        {{ guardando ? 'Guardando…' : '+ Agregar proveedor' }}
      </button>
    </form>

    <p v-if="error" class="bg-red-50 border border-danger/30 text-danger text-sm rounded-lg px-4 py-3 mb-4">{{ error }}</p>

    <div class="overflow-x-auto bg-white border border-slate-200 rounded-xl">
      <table class="w-full text-sm">
        <thead>
          <tr class="bg-slate-50 text-[11px] uppercase tracking-wide text-slate-500">
            <th class="text-left px-4 py-2.5 font-normal">Razón social</th>
            <th class="text-left px-4 py-2.5 font-normal">RFC</th>
            <th class="text-left px-4 py-2.5 font-normal">Días crédito</th>
            <th class="text-left px-4 py-2.5 font-normal">Moneda</th>
            <th class="text-left px-4 py-2.5 font-normal">Contacto</th>
            <th v-if="puedeEditar" class="text-left px-4 py-2.5 font-normal">Estatus</th>
            <th v-if="puedeEditar" class="text-left px-4 py-2.5 font-normal">Acciones</th>
          </tr>
        </thead>
        <tbody>
          <template v-for="p in proveedores" :key="p.id">
            <tr v-if="editando !== p.id" class="border-t border-slate-200">
              <td class="px-4 py-2.5 font-semibold">{{ p.razon_social }}</td>
              <td class="px-4 py-2.5 tabular-nums">{{ p.rfc || '—' }}</td>
              <td class="px-4 py-2.5 tabular-nums">{{ p.dias_credito }}</td>
              <td class="px-4 py-2.5">{{ p.moneda }}</td>
              <td class="px-4 py-2.5 text-slate-500">{{ p.contacto || '—' }}</td>
              <td v-if="puedeEditar" class="px-4 py-2.5">
                <span class="inline-flex text-[11.5px] font-bold px-2.5 py-0.5 rounded-full" :class="p.activo ? 'bg-emerald-50 text-success' : 'bg-slate-100 text-slate-500'">
                  {{ p.activo ? 'Activo' : 'Inactivo' }}
                </span>
              </td>
              <td v-if="puedeEditar" class="px-4 py-2.5">
                <button class="text-xs font-semibold text-primary underline" @click="empezarEdicion(p)">Editar</button>
              </td>
            </tr>
            <tr v-else class="border-t border-slate-200 bg-slate-50">
              <td class="px-4 py-2.5"><input v-model="edicion.razonSocial" class="w-full border border-slate-300 rounded px-2 py-1.5 text-sm" /></td>
              <td class="px-4 py-2.5"><input v-model="edicion.rfc" class="w-full border border-slate-300 rounded px-2 py-1.5 text-sm" /></td>
              <td class="px-4 py-2.5"><input v-model.number="edicion.diasCredito" type="number" min="0" class="w-full border border-slate-300 rounded px-2 py-1.5 text-sm" /></td>
              <td class="px-4 py-2.5">
                <select v-model="edicion.moneda" class="w-full border border-slate-300 rounded px-2 py-1.5 text-sm">
                  <option value="MXN">MXN</option>
                  <option value="USD">USD</option>
                </select>
              </td>
              <td class="px-4 py-2.5"><input v-model="edicion.contacto" class="w-full border border-slate-300 rounded px-2 py-1.5 text-sm" /></td>
              <td class="px-4 py-2.5">
                <label class="flex items-center gap-1.5 text-xs">
                  <input type="checkbox" v-model="edicion.activo" class="w-4 h-4" /> Activo
                </label>
              </td>
              <td class="px-4 py-2.5 space-x-2">
                <button class="text-xs font-semibold text-success underline" @click="guardarEdicion(p.id)">Guardar</button>
                <button class="text-xs font-semibold text-slate-500 underline" @click="editando = null">Cancelar</button>
              </td>
            </tr>
          </template>
        </tbody>
      </table>
    </div>
  </AppShell>
</template>

<script setup>
import { onMounted, reactive, ref } from 'vue';
import AppShell from '../components/AppShell.vue';
import { api } from '../lib/api.js';
import { useAuthStore } from '../stores/auth.js';

const auth = useAuthStore();
const puedeCrear = ['comprador', 'direccion'].includes(auth.rol);
const puedeEditar = puedeCrear;
const proveedores = ref([]);
const error = ref('');
const guardando = ref(false);
const incluirInactivos = ref(false);
const form = reactive({ razonSocial: '', rfc: '', diasCredito: 0, moneda: 'MXN', contacto: '' });
const editando = ref(null);
const edicion = reactive({ razonSocial: '', rfc: '', diasCredito: 0, moneda: 'MXN', contacto: '', activo: true });

async function cargar() {
  const { data } = await api.get('/proveedores', { params: incluirInactivos.value ? { incluirInactivos: '1' } : {} });
  proveedores.value = data;
}

function empezarEdicion(p) {
  editando.value = p.id;
  Object.assign(edicion, { razonSocial: p.razon_social, rfc: p.rfc, diasCredito: p.dias_credito, moneda: p.moneda, contacto: p.contacto, activo: p.activo });
}

async function guardarEdicion(id) {
  error.value = '';
  try {
    await api.put(`/proveedores/${id}`, edicion);
    editando.value = null;
    await cargar();
  } catch (err) {
    error.value = err.response?.data?.error || 'No se pudo actualizar el proveedor.';
  }
}

async function crear() {
  error.value = '';
  guardando.value = true;
  try {
    await api.post('/proveedores', form);
    Object.assign(form, { razonSocial: '', rfc: '', diasCredito: 0, moneda: 'MXN', contacto: '' });
    await cargar();
  } catch (err) {
    error.value = err.response?.data?.error || 'No se pudo crear el proveedor.';
  } finally {
    guardando.value = false;
  }
}

onMounted(cargar);
</script>
