<template>
  <AppShell>
    <div v-if="!equipo" class="text-sm text-slate-500">Cargando…</div>
    <template v-else>
      <BotonVolver fallback="/equipos" />
      <div class="flex items-center justify-between flex-wrap gap-3 mb-1">
        <div>
          <h2 class="font-display text-[36px]">{{ equipo.clave }} · {{ equipo.descripcion }}</h2>
          <p class="text-xs text-slate-500">{{ equipo.marca }} {{ equipo.modelo }} · {{ equipo.obra_nombre || 'Sin obra asignada' }}</p>
        </div>
        <span class="inline-flex text-[11.5px] font-bold px-2.5 py-0.5 rounded-full" :class="estatusClase(equipo.estatus)">{{ estatusTexto(equipo.estatus) }}</span>
      </div>

      <p v-if="mensaje" class="bg-emerald-50 border border-success/30 text-success text-sm rounded-lg px-4 py-3 my-4">{{ mensaje }}</p>
      <p v-if="error" class="bg-red-50 border border-danger/30 text-danger text-sm rounded-lg px-4 py-3 my-4">{{ error }}</p>

      <div class="bg-white border border-slate-200 rounded-xl p-5 my-5">
        <h3 class="text-sm font-display mb-4">Datos del equipo</h3>
        <fieldset :disabled="!puedeEditar" class="grid sm:grid-cols-3 gap-3">
          <div>
            <label class="block text-[11px] font-bold uppercase text-slate-500 mb-1">Clave</label>
            <input v-model="form.clave" class="w-full border border-slate-300 rounded-lg px-2.5 min-h-[42px]" />
          </div>
          <div>
            <label class="block text-[11px] font-bold uppercase text-slate-500 mb-1">Tipo</label>
            <input v-model="form.tipo" class="w-full border border-slate-300 rounded-lg px-2.5 min-h-[42px]" />
          </div>
          <div>
            <label class="block text-[11px] font-bold uppercase text-slate-500 mb-1">Estatus</label>
            <select v-model="form.estatus" class="w-full border border-slate-300 rounded-lg px-2.5 min-h-[42px]">
              <option value="activo">Activo</option>
              <option value="mantenimiento">En mantenimiento</option>
              <option value="baja">De baja</option>
            </select>
          </div>
          <div class="sm:col-span-3">
            <label class="block text-[11px] font-bold uppercase text-slate-500 mb-1">Descripción</label>
            <input v-model="form.descripcion" class="w-full border border-slate-300 rounded-lg px-2.5 min-h-[42px]" />
          </div>
          <div>
            <label class="block text-[11px] font-bold uppercase text-slate-500 mb-1">Marca</label>
            <input v-model="form.marca" class="w-full border border-slate-300 rounded-lg px-2.5 min-h-[42px]" />
          </div>
          <div>
            <label class="block text-[11px] font-bold uppercase text-slate-500 mb-1">Modelo</label>
            <input v-model="form.modelo" class="w-full border border-slate-300 rounded-lg px-2.5 min-h-[42px]" />
          </div>
          <div>
            <label class="block text-[11px] font-bold uppercase text-slate-500 mb-1">Número de serie</label>
            <input v-model="form.numeroSerie" class="w-full border border-slate-300 rounded-lg px-2.5 min-h-[42px]" />
          </div>
          <div>
            <label class="block text-[11px] font-bold uppercase text-slate-500 mb-1">Modalidad</label>
            <select v-model="form.modalidad" class="w-full border border-slate-300 rounded-lg px-2.5 min-h-[42px]">
              <option value="propio">Propio</option>
              <option value="rentado">Rentado</option>
            </select>
          </div>
          <div>
            <label class="block text-[11px] font-bold uppercase text-slate-500 mb-1">Obra asignada</label>
            <select v-model="form.obraId" class="w-full border border-slate-300 rounded-lg px-2.5 min-h-[42px]">
              <option :value="null">— Sin asignar —</option>
              <option v-for="o in obras" :key="o.id" :value="o.id">{{ o.nombre }}</option>
            </select>
          </div>
          <template v-if="form.modalidad === 'rentado'">
            <div>
              <label class="block text-[11px] font-bold uppercase text-slate-500 mb-1">Proveedor de la renta</label>
              <input v-model="form.proveedorRenta" class="w-full border border-slate-300 rounded-lg px-2.5 min-h-[42px]" />
            </div>
            <div>
              <label class="block text-[11px] font-bold uppercase text-slate-500 mb-1">Inicio de renta</label>
              <input v-model="form.fechaInicioRenta" type="date" class="w-full border border-slate-300 rounded-lg px-2.5 min-h-[42px]" />
            </div>
            <div>
              <label class="block text-[11px] font-bold uppercase text-slate-500 mb-1">Vencimiento de renta</label>
              <input v-model="form.fechaVencimientoRenta" type="date" class="w-full border border-slate-300 rounded-lg px-2.5 min-h-[42px]" />
            </div>
          </template>
          <div class="sm:col-span-3">
            <label class="block text-[11px] font-bold uppercase text-slate-500 mb-1">Notas</label>
            <textarea v-model="form.notas" rows="2" class="w-full border border-slate-300 rounded-lg px-2.5 py-2"></textarea>
          </div>
        </fieldset>
        <button v-if="puedeEditar" class="min-h-[42px] bg-primary text-white font-bold rounded-lg px-5 text-sm mt-4 disabled:opacity-50" :disabled="guardando" @click="guardar">
          {{ guardando ? 'Guardando…' : 'Guardar cambios' }}
        </button>
      </div>

      <div class="bg-white border border-slate-200 rounded-xl p-5 my-5">
        <h3 class="text-sm font-display mb-1">Documentos</h3>
        <p class="text-xs text-slate-500 mb-4">Factura de compra, póliza de seguro, tarjeta de circulación, verificación, contrato de renta, etc.</p>

        <div v-if="equipo.documentos.length" class="divide-y divide-slate-100 mb-4">
          <div v-for="d in equipo.documentos" :key="d.id" class="flex items-center justify-between py-2.5 text-sm">
            <div>
              <span class="font-semibold">{{ d.tipo_documento }}</span>
              <span class="text-slate-400 text-xs ml-2">{{ d.nombre_archivo }} · {{ formatoTamano(d.tamano_bytes) }} · {{ formatoFecha(d.creado_en) }}</span>
              <span v-if="d.fecha_vencimiento" class="block text-[11px] text-warning font-semibold">Vence: {{ formatoFecha(d.fecha_vencimiento) }}</span>
            </div>
            <div class="flex items-center gap-3 flex-none">
              <button class="text-xs font-semibold text-primary underline" @click="verDocumento(d)">Ver</button>
              <button v-if="puedeEditar" class="text-xs font-semibold text-danger underline" @click="eliminarDocumento(d)">Eliminar</button>
            </div>
          </div>
        </div>
        <p v-else class="text-sm text-slate-400 mb-4">Sin documentos cargados todavía.</p>

        <form v-if="puedeEditar" class="grid sm:grid-cols-4 gap-3 items-end" @submit.prevent="subirDocumento">
          <div>
            <label class="block text-[11px] font-bold uppercase text-slate-500 mb-1">Tipo de documento</label>
            <select v-model="nuevoDoc.tipo" class="w-full border border-slate-300 rounded-lg px-2.5 min-h-[42px]">
              <option v-for="t in TIPOS_DOCUMENTO" :key="t" :value="t">{{ t }}</option>
            </select>
          </div>
          <div>
            <label class="block text-[11px] font-bold uppercase text-slate-500 mb-1">Vence (opcional)</label>
            <input v-model="nuevoDoc.fechaVencimiento" type="date" class="w-full border border-slate-300 rounded-lg px-2.5 min-h-[42px]" />
          </div>
          <div>
            <label class="block text-[11px] font-bold uppercase text-slate-500 mb-1">Archivo</label>
            <input type="file" accept="image/*,application/pdf" class="w-full border border-slate-300 rounded-lg px-2.5 min-h-[42px]" @change="alSeleccionarDocumento" />
          </div>
          <button type="submit" class="min-h-[42px] bg-primary text-white font-bold rounded-lg px-5 text-sm disabled:opacity-50" :disabled="!archivoSeleccionado || subiendoDoc">
            {{ subiendoDoc ? 'Subiendo…' : '+ Subir' }}
          </button>
        </form>
      </div>

      <div class="bg-white border border-slate-200 rounded-xl p-5 my-5">
        <h3 class="text-sm font-display mb-1">Bitácora de mantenimiento</h3>
        <p class="text-xs text-slate-500 mb-4">Preventivo y correctivo. El costo aquí es solo informativo — no genera ningún gasto en Requisiciones.</p>

        <div v-if="equipo.bitacora.length" class="divide-y divide-slate-100 mb-4">
          <div v-for="b in equipo.bitacora" :key="b.id" class="py-2.5 text-sm">
            <div class="flex items-center justify-between">
              <span class="font-semibold capitalize">{{ b.tipo }}</span>
              <span class="text-slate-400 text-xs">{{ formatoFecha(b.fecha) }} · {{ b.registrado_por_nombre }}</span>
            </div>
            <p class="text-slate-600">{{ b.descripcion }}</p>
            <p class="text-xs text-slate-400">
              <span v-if="b.horometro_km">Horómetro/Km: {{ b.horometro_km }} · </span>
              <span v-if="b.costo">Costo: {{ mxn(b.costo) }} · </span>
              <span v-if="b.taller_proveedor">Taller: {{ b.taller_proveedor }} · </span>
              <span v-if="b.proximo_mantenimiento">Próximo: {{ formatoFecha(b.proximo_mantenimiento) }}</span>
            </p>
          </div>
        </div>
        <p v-else class="text-sm text-slate-400 mb-4">Sin registros de mantenimiento todavía.</p>

        <form v-if="puedeEditar" class="grid sm:grid-cols-3 gap-3" @submit.prevent="registrarMantenimiento">
          <div>
            <label class="block text-[11px] font-bold uppercase text-slate-500 mb-1">Tipo</label>
            <select v-model="nuevoMant.tipo" class="w-full border border-slate-300 rounded-lg px-2.5 min-h-[42px]">
              <option value="preventivo">Preventivo</option>
              <option value="correctivo">Correctivo</option>
            </select>
          </div>
          <div>
            <label class="block text-[11px] font-bold uppercase text-slate-500 mb-1">Fecha</label>
            <input v-model="nuevoMant.fecha" type="date" class="w-full border border-slate-300 rounded-lg px-2.5 min-h-[42px]" />
          </div>
          <div>
            <label class="block text-[11px] font-bold uppercase text-slate-500 mb-1">Horómetro / Km (opcional)</label>
            <input v-model.number="nuevoMant.horometroKm" type="number" min="0" step="any" class="w-full border border-slate-300 rounded-lg px-2.5 min-h-[42px]" />
          </div>
          <div class="sm:col-span-3">
            <label class="block text-[11px] font-bold uppercase text-slate-500 mb-1">Descripción</label>
            <textarea v-model="nuevoMant.descripcion" rows="2" class="w-full border border-slate-300 rounded-lg px-2.5 py-2 text-sm"></textarea>
          </div>
          <div>
            <label class="block text-[11px] font-bold uppercase text-slate-500 mb-1">Costo (opcional, informativo)</label>
            <input v-model.number="nuevoMant.costo" type="number" min="0" step="any" class="w-full border border-slate-300 rounded-lg px-2.5 min-h-[42px]" />
          </div>
          <div>
            <label class="block text-[11px] font-bold uppercase text-slate-500 mb-1">Taller / Proveedor (opcional)</label>
            <input v-model="nuevoMant.tallerProveedor" class="w-full border border-slate-300 rounded-lg px-2.5 min-h-[42px]" />
          </div>
          <div>
            <label class="block text-[11px] font-bold uppercase text-slate-500 mb-1">Próximo mantenimiento (opcional)</label>
            <input v-model="nuevoMant.proximoMantenimiento" type="date" class="w-full border border-slate-300 rounded-lg px-2.5 min-h-[42px]" />
          </div>
          <button type="submit" class="sm:col-span-3 min-h-[42px] bg-primary text-white font-bold rounded-lg px-5 text-sm disabled:opacity-50" :disabled="!nuevoMant.descripcion.trim() || guardandoMant">
            {{ guardandoMant ? 'Guardando…' : '+ Registrar mantenimiento' }}
          </button>
        </form>
      </div>
    </template>
  </AppShell>
</template>

<script setup>
import { onMounted, reactive, ref } from 'vue';
import { useRoute } from 'vue-router';
import AppShell from '../components/AppShell.vue';
import BotonVolver from '../components/BotonVolver.vue';
import { api } from '../lib/api.js';
import { useAuthStore } from '../stores/auth.js';

const TIPOS_DOCUMENTO = ['Factura de compra', 'Póliza de seguro', 'Tarjeta de circulación', 'Verificación', 'Contrato de renta', 'Otro'];

const auth = useAuthStore();
const route = useRoute();
const puedeEditar = ['residente', 'superintendente', 'direccion'].includes(auth.rol);

const equipo = ref(null);
const obras = ref([]);
const mensaje = ref('');
const error = ref('');
const guardando = ref(false);

const form = reactive({
  clave: '', descripcion: '', tipo: '', marca: '', modelo: '', numeroSerie: '', modalidad: 'propio',
  obraId: null, estatus: 'activo', proveedorRenta: '', fechaInicioRenta: '', fechaVencimientoRenta: '', notas: '',
});

function llenarForm(e) {
  Object.assign(form, {
    clave: e.clave, descripcion: e.descripcion, tipo: e.tipo || '', marca: e.marca || '', modelo: e.modelo || '',
    numeroSerie: e.numero_serie || '', modalidad: e.modalidad, obraId: e.obra_id, estatus: e.estatus,
    proveedorRenta: e.proveedor_renta || '', fechaInicioRenta: e.fecha_inicio_renta ? e.fecha_inicio_renta.slice(0, 10) : '',
    fechaVencimientoRenta: e.fecha_vencimiento_renta ? e.fecha_vencimiento_renta.slice(0, 10) : '', notas: e.notas || '',
  });
}

async function cargar() {
  const { data } = await api.get(`/equipos/${route.params.id}`);
  equipo.value = data;
  llenarForm(data);
}

async function guardar() {
  error.value = ''; mensaje.value = '';
  guardando.value = true;
  try {
    const { data } = await api.put(`/equipos/${route.params.id}`, form);
    equipo.value = data;
    mensaje.value = 'Equipo actualizado.';
  } catch (err) {
    error.value = err.response?.data?.error || 'No se pudo guardar el equipo.';
  } finally {
    guardando.value = false;
  }
}

const nuevoDoc = reactive({ tipo: 'Factura de compra', fechaVencimiento: '' });
const archivoSeleccionado = ref(null);
const subiendoDoc = ref(false);

function alSeleccionarDocumento(ev) {
  archivoSeleccionado.value = ev.target.files?.[0] || null;
}

async function subirDocumento() {
  if (!archivoSeleccionado.value) return;
  subiendoDoc.value = true;
  error.value = '';
  try {
    const f = new FormData();
    f.append('tipoDocumento', nuevoDoc.tipo);
    if (nuevoDoc.fechaVencimiento) f.append('fechaVencimiento', nuevoDoc.fechaVencimiento);
    f.append('archivo', archivoSeleccionado.value);
    await api.post(`/equipos/${route.params.id}/documentos`, f);
    archivoSeleccionado.value = null;
    nuevoDoc.fechaVencimiento = '';
    mensaje.value = 'Documento agregado.';
    await cargar();
  } catch (err) {
    error.value = err.response?.data?.error || 'No se pudo subir el documento.';
  } finally {
    subiendoDoc.value = false;
  }
}

async function verDocumento(d) {
  const { data } = await api.get(`/equipos/${route.params.id}/documentos/${d.id}`, { responseType: 'blob' });
  const url = URL.createObjectURL(data);
  window.open(url, '_blank');
}

async function eliminarDocumento(d) {
  if (!window.confirm(`¿Eliminar "${d.tipo_documento}" (${d.nombre_archivo})?`)) return;
  try {
    await api.delete(`/equipos/${route.params.id}/documentos/${d.id}`);
    await cargar();
  } catch (err) {
    error.value = err.response?.data?.error || 'No se pudo eliminar el documento.';
  }
}

const nuevoMant = reactive({ tipo: 'preventivo', fecha: '', horometroKm: null, descripcion: '', costo: null, tallerProveedor: '', proximoMantenimiento: '' });
const guardandoMant = ref(false);

async function registrarMantenimiento() {
  guardandoMant.value = true;
  error.value = '';
  try {
    await api.post(`/equipos/${route.params.id}/mantenimiento`, nuevoMant);
    Object.assign(nuevoMant, { tipo: 'preventivo', fecha: '', horometroKm: null, descripcion: '', costo: null, tallerProveedor: '', proximoMantenimiento: '' });
    mensaje.value = 'Mantenimiento registrado.';
    await cargar();
  } catch (err) {
    error.value = err.response?.data?.error || 'No se pudo registrar el mantenimiento.';
  } finally {
    guardandoMant.value = false;
  }
}

function mxn(n) { return new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN' }).format(n || 0); }
function formatoTamano(bytes) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
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

onMounted(async () => {
  const { data } = await api.get('/catalogo/obras');
  obras.value = data;
  await cargar();
});
</script>
