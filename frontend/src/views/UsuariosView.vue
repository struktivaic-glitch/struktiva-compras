<template>
  <AppShell>
    <div class="flex items-center justify-between mb-4">
      <h2 class="font-display text-[36px]">Usuarios</h2>
    </div>

    <form v-if="puedeEditar" class="bg-white border border-slate-200 rounded-xl p-4 mb-5 grid sm:grid-cols-5 gap-3 items-end" @submit.prevent="crear">
      <div>
        <label class="block text-[11px] font-bold uppercase text-slate-500 mb-1">Nombre</label>
        <input v-model="nuevo.nombre" required class="w-full border border-slate-300 rounded-lg px-2.5 min-h-[42px]" />
      </div>
      <div>
        <label class="block text-[11px] font-bold uppercase text-slate-500 mb-1">Correo institucional</label>
        <input v-model="nuevo.email" type="email" required class="w-full border border-slate-300 rounded-lg px-2.5 min-h-[42px]" />
      </div>
      <div>
        <label class="block text-[11px] font-bold uppercase text-slate-500 mb-1">Rol</label>
        <select v-model.number="nuevo.rolId" required class="w-full border border-slate-300 rounded-lg px-2.5 min-h-[42px]">
          <option v-for="r in roles" :key="r.id" :value="r.id">{{ r.nombre }}</option>
        </select>
      </div>
      <div>
        <label class="block text-[11px] font-bold uppercase text-slate-500 mb-1">Contraseña inicial</label>
        <input v-model="nuevo.password" type="text" required minlength="6" placeholder="mín. 6 caracteres" class="w-full border border-slate-300 rounded-lg px-2.5 min-h-[42px]" />
      </div>
      <button type="submit" class="min-h-[42px] bg-primary text-white font-bold rounded-lg px-5 text-sm" :disabled="guardando">
        {{ guardando ? 'Guardando…' : '+ Dar de alta' }}
      </button>
    </form>

    <p v-if="error" class="bg-red-50 border border-danger/30 text-danger text-sm rounded-lg px-4 py-3 mb-4">{{ error }}</p>
    <p v-if="mensaje" class="bg-emerald-50 border border-success/30 text-success text-sm rounded-lg px-4 py-3 mb-4">{{ mensaje }}</p>

    <div class="flex items-center gap-1 text-sm mb-3">
      <button
        class="min-h-[30px] px-3 rounded-lg font-semibold"
        :class="vista === 'activos' ? 'bg-primary text-white' : 'border border-slate-300 text-slate-600'"
        @click="vista = 'activos'"
      >
        Activos ({{ usuarios.filter((u) => u.activo).length }})
      </button>
      <button
        class="min-h-[30px] px-3 rounded-lg font-semibold"
        :class="vista === 'inactivos' ? 'bg-primary text-white' : 'border border-slate-300 text-slate-600'"
        @click="vista = 'inactivos'"
      >
        Inactivos ({{ usuarios.filter((u) => !u.activo).length }})
      </button>
    </div>
    <p v-if="vista === 'inactivos'" class="text-xs text-slate-500 mb-3">
      Solo consulta — cuentas que ya no pueden iniciar sesión. Para reactivar una, usa "Editar" y marca "Activo" de nuevo.
    </p>

    <div class="overflow-x-auto bg-white border border-slate-200 rounded-xl">
      <table class="w-full text-sm">
        <thead>
          <tr class="bg-slate-50 text-[11px] uppercase tracking-wide text-slate-500">
            <th class="px-4 py-2.5 font-normal w-10"></th>
            <th class="text-left px-4 py-2.5 font-normal">Nombre</th>
            <th class="text-left px-4 py-2.5 font-normal">Correo</th>
            <th class="text-left px-4 py-2.5 font-normal">Rol</th>
            <th class="text-left px-4 py-2.5 font-normal">Estatus</th>
            <th v-if="puedeEditar" class="text-left px-4 py-2.5 font-normal">Acciones</th>
          </tr>
        </thead>
        <tbody>
          <tr v-if="!usuariosVista.length">
            <td :colspan="puedeEditar ? 6 : 5" class="px-4 py-8 text-center text-slate-400 text-sm">
              {{ vista === 'activos' ? 'No hay usuarios activos.' : 'No hay usuarios inactivos.' }}
            </td>
          </tr>
          <template v-for="u in usuariosVista" :key="u.id">
            <tr v-if="editando !== u.id" class="border-t border-slate-200">
              <td class="px-4 py-2.5">
                <AvatarUsuario :usuario-id="u.id" :nombre="u.nombre" :tiene-foto="u.tiene_foto" size-class="w-8 h-8" text-size-class="text-xs" />
              </td>
              <td class="px-4 py-2.5 font-semibold">{{ u.nombre }}</td>
              <td class="px-4 py-2.5 font-sans">{{ u.email }}</td>
              <td class="px-4 py-2.5 font-sans">{{ u.rol_nombre }}</td>
              <td class="px-4 py-2.5 font-sans">
                <span class="inline-flex text-[11.5px] font-bold px-2.5 py-0.5 rounded-full" :class="u.activo ? 'bg-emerald-50 text-success' : 'bg-slate-100 text-slate-500'">
                  {{ u.activo ? 'Activo' : 'Inactivo' }}
                </span>
              </td>
              <td v-if="puedeEditar" class="px-4 py-2.5 font-sans space-x-2 whitespace-nowrap">
                <button class="text-xs font-semibold text-primary underline" @click="empezarEdicion(u)">Editar</button>
                <button class="text-xs font-semibold text-primary underline" @click="abrirPermisos(u)">Permisos</button>
                <button class="text-xs font-semibold text-warning underline" @click="restablecer(u)">Restablecer contraseña</button>
                <button class="text-xs font-semibold text-danger underline" @click="eliminar(u)">Eliminar</button>
              </td>
            </tr>
            <tr v-else class="border-t border-slate-200 bg-slate-50">
              <td class="px-4 py-2.5">
                <AvatarUsuario :usuario-id="u.id" :nombre="u.nombre" :tiene-foto="u.tiene_foto" size-class="w-8 h-8" text-size-class="text-xs" />
              </td>
              <td class="px-4 py-2.5"><input v-model="edicion.nombre" class="w-full border border-slate-300 rounded px-2 py-1.5 text-sm" /></td>
              <td class="px-4 py-2.5"><input v-model="edicion.email" type="email" class="w-full border border-slate-300 rounded px-2 py-1.5 text-sm" /></td>
              <td class="px-4 py-2.5">
                <select v-model.number="edicion.rolId" class="w-full border border-slate-300 rounded px-2 py-1.5 text-sm">
                  <option v-for="r in roles" :key="r.id" :value="r.id">{{ r.nombre }}</option>
                </select>
              </td>
              <td class="px-4 py-2.5">
                <label class="flex items-center gap-1.5 text-xs">
                  <input type="checkbox" v-model="edicion.activo" class="w-4 h-4" /> Activo
                </label>
              </td>
              <td class="px-4 py-2.5 space-x-2">
                <button class="text-xs font-semibold text-success underline" @click="guardarEdicion(u.id)">Guardar</button>
                <button class="text-xs font-semibold text-slate-500 underline" @click="editando = null">Cancelar</button>
              </td>
            </tr>
          </template>
        </tbody>
      </table>
    </div>

    <div v-if="permisosUsuario" class="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4" @click.self="permisosUsuario = null">
      <div class="bg-white rounded-xl p-5 w-full max-w-md max-h-[85vh] overflow-y-auto">
        <h3 class="text-sm font-display mb-1">Módulos visibles — {{ permisosUsuario.nombre }}</h3>
        <p class="text-xs text-slate-500 mb-4">
          Qué pantallas puede ver en el menú y al navegar. No afecta quién puede autorizar/editar
          en cada módulo — eso lo sigue definiendo el rol.
        </p>

        <div class="flex justify-end gap-2 mb-3 text-[11px]">
          <button class="font-semibold text-primary underline" @click="marcarTodos(true)">Marcar todos</button>
          <button class="font-semibold text-primary underline" @click="marcarTodos(false)">Quitar todos</button>
        </div>

        <div v-for="g in GRUPOS_NAV" :key="g.clave" class="mb-4 last:mb-0">
          <div class="text-[11px] font-bold uppercase tracking-wide text-slate-500 mb-1.5">{{ g.icono }} {{ g.label }}</div>
          <label v-for="item in g.items" :key="item.to" class="flex items-center gap-2 text-sm py-1">
            <input type="checkbox" :value="item.to" v-model="modulosSeleccionados" class="w-4 h-4" />
            {{ item.label }}
          </label>
        </div>

        <p v-if="errorPermisos" class="bg-red-50 border border-danger/30 text-danger text-xs rounded-lg px-3 py-2 mt-2 mb-2">{{ errorPermisos }}</p>

        <div class="flex gap-2 justify-end mt-4">
          <button class="min-h-[42px] border border-slate-300 text-slate-600 font-bold rounded-lg px-4 text-sm" @click="permisosUsuario = null">Cancelar</button>
          <button class="min-h-[42px] bg-primary text-white font-bold rounded-lg px-4 text-sm disabled:opacity-50" :disabled="guardandoPermisos" @click="guardarPermisos">
            {{ guardandoPermisos ? 'Guardando…' : 'Guardar permisos' }}
          </button>
        </div>
      </div>
    </div>
  </AppShell>
</template>

<script setup>
import { computed, onMounted, reactive, ref } from 'vue';
import AppShell from '../components/AppShell.vue';
import AvatarUsuario from '../components/AvatarUsuario.vue';
import { api } from '../lib/api.js';
import { GRUPOS_NAV } from '../lib/modulosNav.js';
import { useAuthStore } from '../stores/auth.js';

const auth = useAuthStore();
const puedeEditar = auth.rol === 'direccion';

const usuarios = ref([]);
const roles = ref([]);
// Los inactivos se separan a su propia pestaña, solo para consulta — no hacen volumen en la
// lista de activos, que es la que se usa en el día a día (pedido del usuario 07/08/2026).
const vista = ref('activos');
const usuariosVista = computed(() => usuarios.value.filter((u) => (vista.value === 'activos' ? u.activo : !u.activo)));
const nuevo = reactive({ nombre: '', email: '', rolId: null, password: '' });
const guardando = ref(false);
const error = ref('');
const mensaje = ref('');
const editando = ref(null);
const edicion = reactive({ nombre: '', email: '', rolId: null, activo: true });

async function cargar() {
  const [{ data: u }, { data: r }] = await Promise.all([api.get('/usuarios'), api.get('/roles')]);
  usuarios.value = u;
  roles.value = r;
}

async function crear() {
  error.value = '';
  mensaje.value = '';
  guardando.value = true;
  try {
    await api.post('/usuarios', nuevo);
    Object.assign(nuevo, { nombre: '', email: '', rolId: null, password: '' });
    mensaje.value = 'Usuario dado de alta. Ya puede iniciar sesión con la contraseña que capturaste.';
    await cargar();
  } catch (err) {
    error.value = err.response?.data?.error || 'No se pudo dar de alta al usuario.';
  } finally {
    guardando.value = false;
  }
}

function empezarEdicion(u) {
  editando.value = u.id;
  Object.assign(edicion, { nombre: u.nombre, email: u.email, rolId: u.rol_id, activo: u.activo });
}

async function guardarEdicion(id) {
  error.value = '';
  try {
    await api.put(`/usuarios/${id}`, edicion);
    editando.value = null;
    await cargar();
  } catch (err) {
    error.value = err.response?.data?.error || 'No se pudo actualizar el usuario.';
  }
}

async function restablecer(u) {
  const nueva = window.prompt(`Nueva contraseña temporal para ${u.nombre} (mín. 6 caracteres):`);
  if (!nueva) return;
  error.value = '';
  mensaje.value = '';
  try {
    await api.post(`/usuarios/${u.id}/password`, { password: nueva });
    mensaje.value = `Contraseña de ${u.nombre} restablecida. Compártesela por un canal seguro.`;
  } catch (err) {
    error.value = err.response?.data?.error || 'No se pudo restablecer la contraseña.';
  }
}

async function eliminar(u) {
  if (!window.confirm(`¿Eliminar a "${u.nombre}" por completo? Solo es posible si nunca quedó registrado en ningún movimiento del sistema — si ya tiene actividad, desactívalo en su lugar desde "Editar".`)) return;
  error.value = '';
  mensaje.value = '';
  try {
    await api.delete(`/usuarios/${u.id}`);
    mensaje.value = `${u.nombre} fue eliminado.`;
    await cargar();
  } catch (err) {
    error.value = err.response?.data?.error || 'No se pudo eliminar el usuario.';
  }
}

// --- Checklist de módulos visibles (migración 029) ---
const permisosUsuario = ref(null);
const modulosSeleccionados = ref([]);
const guardandoPermisos = ref(false);
const errorPermisos = ref('');

async function abrirPermisos(u) {
  permisosUsuario.value = u;
  errorPermisos.value = '';
  const { data } = await api.get(`/usuarios/${u.id}/modulos`);
  modulosSeleccionados.value = data.modulos;
}

function marcarTodos(todos) {
  modulosSeleccionados.value = todos ? GRUPOS_NAV.flatMap((g) => g.items.map((i) => i.to)) : [];
}

async function guardarPermisos() {
  guardandoPermisos.value = true;
  errorPermisos.value = '';
  try {
    await api.put(`/usuarios/${permisosUsuario.value.id}/modulos`, { modulos: modulosSeleccionados.value });
    mensaje.value = `Permisos de ${permisosUsuario.value.nombre} actualizados. Se aplican la próxima vez que esa persona inicie sesión.`;
    permisosUsuario.value = null;
  } catch (err) {
    errorPermisos.value = err.response?.data?.error || 'No se pudieron guardar los permisos.';
  } finally {
    guardandoPermisos.value = false;
  }
}

onMounted(cargar);
</script>
