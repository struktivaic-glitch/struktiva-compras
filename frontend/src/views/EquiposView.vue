<template>
  <AppShell>
    <div class="flex items-center justify-between mb-1 flex-wrap gap-2">
      <div>
        <h2 class="font-display text-lg">Maquinaria y Equipos</h2>
        <p class="text-xs text-slate-500">
          Catálogo, expediente (documentos) y bitácora de mantenimiento. Para equipo rentado solo se controlan
          fechas de vigencia y documentación — el costo de la renta se registra como cualquier otro gasto en Requisiciones/Facturas.
        </p>
      </div>
    </div>

    <div v-if="vencimientos && totalVencimientos > 0" class="bg-amber-50 border border-warning/30 rounded-xl p-4 my-4">
      <h3 class="text-xs font-bold uppercase text-warning mb-2">Vencimientos en los próximos 30 días ({{ totalVencimientos }})</h3>
      <ul class="text-sm space-y-1">
        <li v-for="r in vencimientos.renta" :key="'r' + r.id">
          <RouterLink :to="`/equipos/${r.id}`" class="text-primary underline">{{ r.clave }}</RouterLink> — renta vence {{ formatoFecha(r.fecha) }}
        </li>
        <li v-for="d in vencimientos.documentos" :key="'d' + d.id">
          <RouterLink :to="`/equipos/${d.equipo_id}`" class="text-primary underline">{{ d.clave }}</RouterLink> — {{ d.tipo_documento }} vence {{ formatoFecha(d.fecha) }}
        </li>
        <li v-for="m in vencimientos.mantenimiento" :key="'m' + m.id">
          <RouterLink :to="`/equipos/${m.equipo_id}`" class="text-primary underline">{{ m.clave }}</RouterLink> — próximo mantenimiento {{ formatoFecha(m.fecha) }}
        </li>
      </ul>
    </div>

    <div class="flex items-center justify-between flex-wrap gap-2 my-4">
      <div class="flex items-center gap-2">
        <select v-model="filtroObra" class="text-sm border border-slate-300 rounded-lg px-2.5 py-2" @change="cargar">
          <option value="">Todas las obras</option>
          <option v-for="o in obras" :key="o.id" :value="o.id">{{ o.nombre }}</option>
        </select>
        <select v-model="filtroEstatus" class="text-sm border border-slate-300 rounded-lg px-2.5 py-2" @change="cargar">
          <option value="">Todos los estatus</option>
          <option value="activo">Activo</option>
          <option value="mantenimiento">En mantenimiento</option>
          <option value="baja">De baja</option>
        </select>
      </div>
      <button v-if="puedeCrear" class="min-h-[42px] bg-primary text-white font-bold rounded-lg px-5 text-sm" @click="nuevoAbierto = true">+ Nuevo equipo</button>
    </div>

    <p v-if="error" class="bg-red-50 border border-danger/30 text-danger text-sm rounded-lg px-4 py-3 mb-4">{{ error }}</p>

    <div class="overflow-x-auto bg-white border border-slate-200 rounded-xl">
      <table class="w-full text-sm">
        <thead>
          <tr class="bg-slate-50 text-[11px] uppercase tracking-wide text-slate-500">
            <th class="text-left px-4 py-2.5 font-normal">Clave</th>
            <th class="text-left px-4 py-2.5 font-normal">Descripción</th>
            <th class="text-left px-4 py-2.5 font-normal">Modalidad</th>
            <th class="text-left px-4 py-2.5 font-normal">Obra</th>
            <th class="text-left px-4 py-2.5 font-normal">Estatus</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="e in equipos" :key="e.id" class="border-t border-slate-200">
            <td class="px-4 py-2.5 font-semibold">
              <RouterLink :to="`/equipos/${e.id}`" class="text-primary hover:underline">{{ e.clave }}</RouterLink>
            </td>
            <td class="px-4 py-2.5">{{ e.descripcion }} <span class="text-slate-400 text-xs">{{ e.marca }} {{ e.modelo }}</span></td>
            <td class="px-4 py-2.5">
              <span class="capitalize">{{ e.modalidad }}</span>
              <span v-if="e.renta_por_vencer" class="ml-1.5 text-[10px] font-bold text-warning">● vence pronto</span>
            </td>
            <td class="px-4 py-2.5 text-slate-500">{{ e.obra_nombre || '—' }}</td>
            <td class="px-4 py-2.5">
              <span class="inline-flex text-[11.5px] font-bold px-2.5 py-0.5 rounded-full" :class="estatusClase(e.estatus)">{{ estatusTexto(e.estatus) }}</span>
            </td>
          </tr>
          <tr v-if="!cargando && !equipos.length">
            <td colspan="5" class="px-4 py-8 text-center text-slate-400 text-sm">Sin equipos dados de alta todavía.</td>
          </tr>
        </tbody>
      </table>
    </div>

    <!-- Modal: nuevo equipo -->
    <div v-if="nuevoAbierto" class="fixed inset-0 bg-black/40 flex items-center justify-center z-50 px-4" @click.self="nuevoAbierto = false">
      <div class="bg-white rounded-xl shadow-xl w-full max-w-lg p-5 max-h-[90vh] overflow-y-auto">
        <h3 class="font-display text-base mb-4">Nuevo equipo</h3>
        <p v-if="errorNuevo" class="bg-red-50 border border-danger/30 text-danger text-xs rounded-lg px-3 py-2 mb-3">{{ errorNuevo }}</p>

        <div class="grid sm:grid-cols-2 gap-3 mb-3">
          <div>
            <label class="block text-[11px] font-bold uppercase text-slate-500 mb-1">Clave</label>
            <input v-model="nuevo.clave" class="w-full border border-slate-300 rounded-lg px-2.5 min-h-[42px]" placeholder="Ej. RETRO-01" />
          </div>
          <div>
            <label class="block text-[11px] font-bold uppercase text-slate-500 mb-1">Tipo</label>
            <input v-model="nuevo.tipo" class="w-full border border-slate-300 rounded-lg px-2.5 min-h-[42px]" placeholder="Ej. Retroexcavadora" />
          </div>
        </div>
        <label class="block text-[11px] font-bold uppercase text-slate-500 mb-1">Descripción</label>
        <input v-model="nuevo.descripcion" class="w-full border border-slate-300 rounded-lg px-2.5 min-h-[42px] mb-3" />

        <div class="grid sm:grid-cols-2 gap-3 mb-3">
          <div>
            <label class="block text-[11px] font-bold uppercase text-slate-500 mb-1">Marca</label>
            <input v-model="nuevo.marca" class="w-full border border-slate-300 rounded-lg px-2.5 min-h-[42px]" />
          </div>
          <div>
            <label class="block text-[11px] font-bold uppercase text-slate-500 mb-1">Modelo</label>
            <input v-model="nuevo.modelo" class="w-full border border-slate-300 rounded-lg px-2.5 min-h-[42px]" />
          </div>
        </div>
        <label class="block text-[11px] font-bold uppercase text-slate-500 mb-1">Número de serie</label>
        <input v-model="nuevo.numeroSerie" class="w-full border border-slate-300 rounded-lg px-2.5 min-h-[42px] mb-3" />

        <div class="grid sm:grid-cols-2 gap-3 mb-3">
          <div>
            <label class="block text-[11px] font-bold uppercase text-slate-500 mb-1">Modalidad</label>
            <select v-model="nuevo.modalidad" class="w-full border border-slate-300 rounded-lg px-2.5 min-h-[42px]">
              <option value="propio">Propio</option>
              <option value="rentado">Rentado</option>
            </select>
          </div>
          <div>
            <label class="block text-[11px] font-bold uppercase text-slate-500 mb-1">Obra asignada</label>
            <select v-model="nuevo.obraId" class="w-full border border-slate-300 rounded-lg px-2.5 min-h-[42px]">
              <option :value="null">— Sin asignar —</option>
              <option v-for="o in obras" :key="o.id" :value="o.id">{{ o.nombre }}</option>
            </select>
          </div>
        </div>

        <template v-if="nuevo.modalidad === 'rentado'">
          <div class="bg-slate-50 border border-slate-200 rounded-lg p-3 mb-3">
            <p class="text-[11px] text-slate-500 mb-2">Solo control de vigencia — el costo de la renta se registra en Requisiciones/Facturas como cualquier otro gasto.</p>
            <label class="block text-[11px] font-bold uppercase text-slate-500 mb-1">Proveedor de la renta</label>
            <input v-model="nuevo.proveedorRenta" class="w-full border border-slate-300 rounded-lg px-2.5 min-h-[42px] mb-2" />
            <div class="grid sm:grid-cols-2 gap-3">
              <div>
                <label class="block text-[11px] font-bold uppercase text-slate-500 mb-1">Inicio de renta</label>
                <input v-model="nuevo.fechaInicioRenta" type="date" class="w-full border border-slate-300 rounded-lg px-2.5 min-h-[42px]" />
              </div>
              <div>
                <label class="block text-[11px] font-bold uppercase text-slate-500 mb-1">Vencimiento de renta</label>
                <input v-model="nuevo.fechaVencimientoRenta" type="date" class="w-full border border-slate-300 rounded-lg px-2.5 min-h-[42px]" />
              </div>
            </div>
          </div>
        </template>

        <label class="block text-[11px] font-bold uppercase text-slate-500 mb-1">Notas (opcional)</label>
        <textarea v-model="nuevo.notas" rows="2" class="w-full border border-slate-300 rounded-lg px-2.5 py-2 mb-4 text-sm"></textarea>

        <div class="flex gap-2">
          <button class="flex-1 min-h-[44px] border border-slate-300 rounded-lg text-sm font-semibold" @click="nuevoAbierto = false">Cancelar</button>
          <button class="flex-1 min-h-[44px] bg-primary text-white rounded-lg text-sm font-bold disabled:opacity-50" :disabled="!nuevo.clave.trim() || !nuevo.descripcion.trim() || guardandoNuevo" @click="guardarNuevo">
            {{ guardandoNuevo ? 'Guardando…' : 'Dar de alta' }}
          </button>
        </div>
      </div>
    </div>
  </AppShell>
</template>

<script setup>
import { computed, onMounted, reactive, ref } from 'vue';
import AppShell from '../components/AppShell.vue';
import { api } from '../lib/api.js';
import { useAuthStore } from '../stores/auth.js';

const auth = useAuthStore();
const puedeCrear = ['residente', 'superintendente', 'direccion'].includes(auth.rol);

const obras = ref([]);
const equipos = ref([]);
const vencimientos = ref(null);
const filtroObra = ref('');
const filtroEstatus = ref('');
const cargando = ref(false);
const error = ref('');

const totalVencimientos = computed(() => {
  if (!vencimientos.value) return 0;
  return vencimientos.value.renta.length + vencimientos.value.documentos.length + vencimientos.value.mantenimiento.length;
});

function formatoFecha(fecha) {
  return new Date(fecha).toLocaleDateString('es-MX', { day: '2-digit', month: 'short', year: 'numeric' });
}
const ESTATUS_TEXTO = { activo: 'Activo', mantenimiento: 'En mantenimiento', baja: 'De baja' };
function estatusTexto(e) { return ESTATUS_TEXTO[e] ?? e; }
function estatusClase(e) {
  if (e === 'activo') return 'bg-emerald-50 text-success';
  if (e === 'mantenimiento') return 'bg-amber-50 text-warning';
  return 'bg-slate-100 text-slate-500';
}

async function cargar() {
  cargando.value = true;
  error.value = '';
  try {
    const { data } = await api.get('/equipos', { params: { obraId: filtroObra.value || undefined, estatus: filtroEstatus.value || undefined } });
    equipos.value = data;
  } catch (err) {
    error.value = err.response?.data?.error || 'No se pudo cargar el catálogo de equipos.';
  } finally {
    cargando.value = false;
  }
}

async function cargarVencimientos() {
  const { data } = await api.get('/equipos/vencimientos');
  vencimientos.value = data;
}

// --- Nuevo equipo ---
const nuevoAbierto = ref(false);
const errorNuevo = ref('');
const guardandoNuevo = ref(false);
const nuevo = reactive({
  clave: '', descripcion: '', tipo: '', marca: '', modelo: '', numeroSerie: '',
  modalidad: 'propio', obraId: null, proveedorRenta: '', fechaInicioRenta: '', fechaVencimientoRenta: '', notas: '',
});

async function guardarNuevo() {
  errorNuevo.value = '';
  guardandoNuevo.value = true;
  try {
    await api.post('/equipos', nuevo);
    nuevoAbierto.value = false;
    Object.assign(nuevo, {
      clave: '', descripcion: '', tipo: '', marca: '', modelo: '', numeroSerie: '',
      modalidad: 'propio', obraId: null, proveedorRenta: '', fechaInicioRenta: '', fechaVencimientoRenta: '', notas: '',
    });
    await Promise.all([cargar(), cargarVencimientos()]);
  } catch (err) {
    errorNuevo.value = err.response?.data?.error || 'No se pudo crear el equipo.';
  } finally {
    guardandoNuevo.value = false;
  }
}

onMounted(async () => {
  const { data } = await api.get('/catalogo/obras');
  obras.value = data;
  await Promise.all([cargar(), cargarVencimientos()]);
});
</script>
