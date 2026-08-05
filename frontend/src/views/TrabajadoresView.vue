<template>
  <AppShell>
    <div class="flex items-center justify-between mb-4">
      <div>
        <h2 class="font-display text-lg">Trabajadores</h2>
        <p class="text-xs text-slate-500">
          Catálogo de personal de campo para desglosar el gasto de Mano de Obra en las requisiciones —
          no es nómina ni un registro fiscal.
        </p>
      </div>
      <label v-if="puedeEditar" class="flex items-center gap-1.5 text-xs text-slate-500 flex-none">
        <input type="checkbox" v-model="incluirInactivos" @change="cargar" class="w-4 h-4" /> Mostrar inactivos
      </label>
    </div>

    <form v-if="puedeCrear" class="bg-white border border-slate-200 rounded-xl p-4 mb-5 grid sm:grid-cols-4 gap-3 items-end" @submit.prevent="crear">
      <div class="sm:col-span-2">
        <label class="block text-[11px] font-bold uppercase text-slate-500 mb-1">Nombre</label>
        <input v-model="form.nombre" required class="w-full border border-slate-300 rounded-lg px-2.5 min-h-[42px]" />
      </div>
      <div>
        <label class="block text-[11px] font-bold uppercase text-slate-500 mb-1">Oficio (opcional)</label>
        <input v-model="form.oficio" placeholder="Ej. Albañil, Peón, Fierrero…" class="w-full border border-slate-300 rounded-lg px-2.5 min-h-[42px]" />
      </div>
      <button type="submit" class="min-h-[42px] bg-primary text-white font-bold rounded-lg px-5 text-sm" :disabled="guardando">
        {{ guardando ? 'Guardando…' : '+ Agregar trabajador' }}
      </button>
    </form>

    <p v-if="error" class="bg-red-50 border border-danger/30 text-danger text-sm rounded-lg px-4 py-3 mb-4">{{ error }}</p>

    <div class="overflow-x-auto bg-white border border-slate-200 rounded-xl">
      <table class="w-full text-sm">
        <thead>
          <tr class="bg-slate-50 text-[11px] uppercase tracking-wide text-slate-500">
            <th class="text-left px-4 py-2.5 font-normal">Nombre</th>
            <th class="text-left px-4 py-2.5 font-normal">Oficio</th>
            <th v-if="puedeEditar" class="text-left px-4 py-2.5 font-normal">Estatus</th>
            <th v-if="puedeEditar" class="text-left px-4 py-2.5 font-normal">Acciones</th>
          </tr>
        </thead>
        <tbody>
          <template v-for="t in trabajadores" :key="t.id">
            <tr v-if="editando !== t.id" class="border-t border-slate-200">
              <td class="px-4 py-2.5 font-semibold">{{ t.nombre }}</td>
              <td class="px-4 py-2.5 text-slate-500">{{ t.oficio || '—' }}</td>
              <td v-if="puedeEditar" class="px-4 py-2.5">
                <span class="inline-flex text-[11.5px] font-bold px-2.5 py-0.5 rounded-full" :class="t.activo ? 'bg-emerald-50 text-success' : 'bg-slate-100 text-slate-500'">
                  {{ t.activo ? 'Activo' : 'Inactivo' }}
                </span>
              </td>
              <td v-if="puedeEditar" class="px-4 py-2.5">
                <button class="text-xs font-semibold text-primary underline" @click="empezarEdicion(t)">Editar</button>
              </td>
            </tr>
            <tr v-else class="border-t border-slate-200 bg-slate-50">
              <td class="px-4 py-2.5"><input v-model="edicion.nombre" class="w-full border border-slate-300 rounded px-2 py-1.5 text-sm" /></td>
              <td class="px-4 py-2.5"><input v-model="edicion.oficio" class="w-full border border-slate-300 rounded px-2 py-1.5 text-sm" /></td>
              <td class="px-4 py-2.5">
                <label class="flex items-center gap-1.5 text-xs">
                  <input type="checkbox" v-model="edicion.activo" class="w-4 h-4" /> Activo
                </label>
              </td>
              <td class="px-4 py-2.5 space-x-2">
                <button class="text-xs font-semibold text-success underline" @click="guardarEdicion(t.id)">Guardar</button>
                <button class="text-xs font-semibold text-slate-500 underline" @click="editando = null">Cancelar</button>
              </td>
            </tr>
          </template>
          <tr v-if="!trabajadores.length">
            <td colspan="4" class="px-4 py-8 text-center text-slate-400 text-sm">Sin trabajadores dados de alta todavía.</td>
          </tr>
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
const puedeCrear = ['residente', 'superintendente', 'direccion'].includes(auth.rol);
const puedeEditar = puedeCrear;
const trabajadores = ref([]);
const error = ref('');
const guardando = ref(false);
const incluirInactivos = ref(false);
const form = reactive({ nombre: '', oficio: '' });
const editando = ref(null);
const edicion = reactive({ nombre: '', oficio: '', activo: true });

async function cargar() {
  const { data } = await api.get('/trabajadores', { params: incluirInactivos.value ? { incluirInactivos: '1' } : {} });
  trabajadores.value = data;
}

function empezarEdicion(t) {
  editando.value = t.id;
  Object.assign(edicion, { nombre: t.nombre, oficio: t.oficio, activo: t.activo });
}

async function guardarEdicion(id) {
  error.value = '';
  try {
    await api.put(`/trabajadores/${id}`, edicion);
    editando.value = null;
    await cargar();
  } catch (err) {
    error.value = err.response?.data?.error || 'No se pudo actualizar el trabajador.';
  }
}

async function crear() {
  error.value = '';
  guardando.value = true;
  try {
    await api.post('/trabajadores', form);
    Object.assign(form, { nombre: '', oficio: '' });
    await cargar();
  } catch (err) {
    error.value = err.response?.data?.error || 'No se pudo crear el trabajador.';
  } finally {
    guardando.value = false;
  }
}

onMounted(cargar);
</script>
