<template>
  <AppShell>
    <div class="flex items-center justify-between mb-4 flex-wrap gap-2">
      <div>
        <h2 class="font-display text-[36px]">Personal</h2>
        <p class="text-xs text-slate-500">
          Catálogo de personal — de campo (jornaleros) y administrativo. Se usa para el desglose de Mano de
          Obra en las requisiciones y para el expediente de cada persona. No es nómina ni un registro fiscal.
        </p>
      </div>
      <label v-if="puedeEditar" class="flex items-center gap-1.5 text-xs text-slate-500 flex-none">
        <input type="checkbox" v-model="incluirInactivos" @change="cargar" class="w-4 h-4" /> Mostrar inactivos
      </label>
    </div>

    <div v-if="vencimientos.length" class="bg-amber-50 border border-warning/30 rounded-xl p-4 mb-5">
      <h3 class="text-xs font-bold uppercase text-warning mb-2">Certificaciones/documentos por vencer en los próximos 30 días ({{ vencimientos.length }})</h3>
      <ul class="text-sm space-y-1">
        <li v-for="v in vencimientos" :key="v.id">
          <RouterLink :to="`/trabajadores/${v.trabajador_id}`" class="text-primary underline">{{ v.nombre }}</RouterLink>
          — {{ v.tipo_documento }} vence {{ formatoFecha(v.fecha) }}
        </li>
      </ul>
    </div>

    <div v-if="aniversarios.length" class="bg-sky-50 border border-primary/30 rounded-xl p-4 mb-5">
      <h3 class="text-xs font-bold uppercase text-primary mb-2">Aniversarios de antigüedad en los próximos 30 días ({{ aniversarios.length }})</h3>
      <ul class="text-sm space-y-1">
        <li v-for="a in aniversarios" :key="a.trabajador_id">
          <RouterLink :to="`/trabajadores/${a.trabajador_id}`" class="text-primary underline">{{ a.nombre }}</RouterLink>
          — cumple {{ a.anios_cumple }} año(s) el {{ formatoFecha(a.fecha) }}
          <span class="text-slate-500">(+{{ a.dias_vacaciones_nuevos }} días de vacaciones)</span>
        </li>
      </ul>
    </div>

    <form v-if="puedeCrear" class="bg-white border border-slate-200 rounded-xl p-4 mb-5 grid sm:grid-cols-6 gap-3 items-end" @submit.prevent="crear">
      <div class="sm:col-span-2">
        <label class="block text-[11px] font-bold uppercase text-slate-500 mb-1">Nombre</label>
        <input v-model="form.nombre" required class="w-full border border-slate-300 rounded-lg px-2.5 min-h-[42px]" />
      </div>
      <div>
        <label class="block text-[11px] font-bold uppercase text-slate-500 mb-1">Tipo</label>
        <select v-model="form.tipo" class="w-full border border-slate-300 rounded-lg px-2.5 min-h-[42px]">
          <option value="jornalero">Jornalero</option>
          <option value="administrativo">Administrativo</option>
        </select>
      </div>
      <div>
        <label class="block text-[11px] font-bold uppercase text-slate-500 mb-1">Oficio (opcional)</label>
        <input v-model="form.oficio" placeholder="Ej. Albañil, Peón, Fierrero…" class="w-full border border-slate-300 rounded-lg px-2.5 min-h-[42px]" />
      </div>
      <div>
        <label class="block text-[11px] font-bold uppercase text-slate-500 mb-1">Puesto (opcional)</label>
        <input v-model="form.puesto" placeholder="Ej. Auxiliar contable" class="w-full border border-slate-300 rounded-lg px-2.5 min-h-[42px]" />
      </div>
      <button type="submit" class="min-h-[42px] bg-primary text-white font-bold rounded-lg px-5 text-sm" :disabled="guardando">
        {{ guardando ? 'Guardando…' : '+ Dar de alta' }}
      </button>
    </form>

    <p v-if="error" class="bg-red-50 border border-danger/30 text-danger text-sm rounded-lg px-4 py-3 mb-4">{{ error }}</p>

    <div class="overflow-x-auto bg-white border border-slate-200 rounded-xl">
      <table class="w-full text-sm">
        <thead>
          <tr class="bg-slate-50 text-[11px] uppercase tracking-wide text-slate-500">
            <th class="text-left px-4 py-2.5 font-normal">Nombre</th>
            <th class="text-left px-4 py-2.5 font-normal">Tipo</th>
            <th class="text-left px-4 py-2.5 font-normal">Oficio / Puesto</th>
            <th class="text-left px-4 py-2.5 font-normal">Obra asignada</th>
            <th v-if="puedeEditar" class="text-left px-4 py-2.5 font-normal">Estatus</th>
            <th v-if="puedeEditar" class="text-left px-4 py-2.5 font-normal">Acciones</th>
          </tr>
        </thead>
        <tbody>
          <template v-for="t in trabajadores" :key="t.id">
            <tr v-if="editando !== t.id" class="border-t border-slate-200">
              <td class="px-4 py-2.5 font-semibold">
                <RouterLink :to="`/trabajadores/${t.id}`" class="text-primary hover:underline">{{ t.nombre }}</RouterLink>
              </td>
              <td class="px-4 py-2.5 text-slate-500 capitalize">{{ t.tipo }}</td>
              <td class="px-4 py-2.5 text-slate-500">{{ t.puesto || t.oficio || '—' }}</td>
              <td class="px-4 py-2.5 text-slate-500">{{ t.obra_nombre || '—' }}</td>
              <td v-if="puedeEditar" class="px-4 py-2.5">
                <span class="inline-flex text-[11.5px] font-bold px-2.5 py-0.5 rounded-full" :class="t.activo ? 'bg-emerald-50 text-success' : 'bg-slate-100 text-slate-500'">
                  {{ t.activo ? 'Activo' : 'Inactivo' }}
                </span>
              </td>
              <td v-if="puedeEditar" class="px-4 py-2.5 space-x-2">
                <button class="text-xs font-semibold text-primary underline" @click="empezarEdicion(t)">Editar rápido</button>
                <RouterLink :to="`/trabajadores/${t.id}`" class="text-xs font-semibold text-slate-500 underline">Expediente</RouterLink>
              </td>
            </tr>
            <tr v-else class="border-t border-slate-200 bg-slate-50">
              <td class="px-4 py-2.5"><input v-model="edicion.nombre" class="w-full border border-slate-300 rounded px-2 py-1.5 text-sm" /></td>
              <td class="px-4 py-2.5 text-slate-400 text-xs">{{ t.tipo }}</td>
              <td class="px-4 py-2.5"><input v-model="edicion.oficio" class="w-full border border-slate-300 rounded px-2 py-1.5 text-sm" /></td>
              <td class="px-4 py-2.5 text-slate-400 text-xs">{{ t.obra_nombre || '—' }}</td>
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
            <td colspan="6" class="px-4 py-8 text-center text-slate-400 text-sm">Sin personal dado de alta todavía.</td>
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
const vencimientos = ref([]);
const aniversarios = ref([]);
const error = ref('');
const guardando = ref(false);
const incluirInactivos = ref(false);

function formatoFecha(fecha) {
  return new Date(fecha).toLocaleDateString('es-MX', { day: '2-digit', month: 'short', year: 'numeric', timeZone: 'UTC' });
}

async function cargarVencimientos() {
  const { data } = await api.get('/trabajadores/vencimientos');
  vencimientos.value = data;
}

async function cargarAniversarios() {
  const { data } = await api.get('/trabajadores/aniversarios');
  aniversarios.value = data;
}
const form = reactive({ nombre: '', oficio: '', tipo: 'jornalero', puesto: '' });
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
    error.value = err.response?.data?.error || 'No se pudo actualizar el personal.';
  }
}

async function crear() {
  error.value = '';
  guardando.value = true;
  try {
    await api.post('/trabajadores', form);
    Object.assign(form, { nombre: '', oficio: '', tipo: 'jornalero', puesto: '' });
    await cargar();
  } catch (err) {
    error.value = err.response?.data?.error || 'No se pudo dar de alta.';
  } finally {
    guardando.value = false;
  }
}

onMounted(() => {
  cargar();
  cargarVencimientos();
  cargarAniversarios();
});
</script>
