<template>
  <AppShell>
    <div v-if="!persona" class="text-sm text-slate-500">Cargando…</div>
    <template v-else>
      <BotonVolver fallback="/trabajadores" />
      <div class="flex items-center justify-between flex-wrap gap-3 mb-1">
        <div>
          <h2 class="font-display text-lg">{{ persona.nombre }}</h2>
          <p class="text-xs text-slate-500 capitalize">
            {{ persona.tipo }} · {{ persona.puesto || persona.oficio || 'Sin puesto/oficio capturado' }}
            <span v-if="!persona.activo" class="ml-1.5 text-[11px] font-bold text-danger">· Inactivo</span>
          </p>
        </div>
      </div>

      <p v-if="mensaje" class="bg-emerald-50 border border-success/30 text-success text-sm rounded-lg px-4 py-3 my-4">{{ mensaje }}</p>
      <p v-if="error" class="bg-red-50 border border-danger/30 text-danger text-sm rounded-lg px-4 py-3 my-4">{{ error }}</p>

      <div class="bg-white border border-slate-200 rounded-xl p-5 my-5">
        <h3 class="text-sm font-display mb-4">Datos del expediente</h3>
        <fieldset :disabled="!puedeEditar" class="grid sm:grid-cols-3 gap-3">
          <div>
            <label class="block text-[11px] font-bold uppercase text-slate-500 mb-1">Nombre</label>
            <input v-model="form.nombre" class="w-full border border-slate-300 rounded-lg px-2.5 min-h-[42px]" />
          </div>
          <div>
            <label class="block text-[11px] font-bold uppercase text-slate-500 mb-1">Tipo</label>
            <select v-model="form.tipo" class="w-full border border-slate-300 rounded-lg px-2.5 min-h-[42px]">
              <option value="jornalero">Jornalero</option>
              <option value="administrativo">Administrativo</option>
            </select>
          </div>
          <div>
            <label class="block text-[11px] font-bold uppercase text-slate-500 mb-1">Estatus</label>
            <label class="flex items-center gap-1.5 min-h-[42px]">
              <input type="checkbox" v-model="form.activo" class="w-4 h-4" /> Activo
            </label>
          </div>

          <div>
            <label class="block text-[11px] font-bold uppercase text-slate-500 mb-1">Oficio (jornalero)</label>
            <input v-model="form.oficio" class="w-full border border-slate-300 rounded-lg px-2.5 min-h-[42px]" />
          </div>
          <div>
            <label class="block text-[11px] font-bold uppercase text-slate-500 mb-1">Puesto (administrativo)</label>
            <input v-model="form.puesto" class="w-full border border-slate-300 rounded-lg px-2.5 min-h-[42px]" />
          </div>
          <div>
            <label class="block text-[11px] font-bold uppercase text-slate-500 mb-1">Obra / frente asignado</label>
            <select v-model="form.obraId" class="w-full border border-slate-300 rounded-lg px-2.5 min-h-[42px]">
              <option :value="null">— Sin asignar —</option>
              <option v-for="o in obras" :key="o.id" :value="o.id">{{ o.nombre }}</option>
            </select>
          </div>

          <div>
            <label class="block text-[11px] font-bold uppercase text-slate-500 mb-1">Fecha de ingreso</label>
            <input v-model="form.fechaIngreso" type="date" class="w-full border border-slate-300 rounded-lg px-2.5 min-h-[42px]" />
          </div>
          <div>
            <label class="block text-[11px] font-bold uppercase text-slate-500 mb-1">Salario de referencia (control interno)</label>
            <input v-model.number="form.salarioReferencia" type="number" min="0" step="0.01" class="w-full border border-slate-300 rounded-lg px-2.5 min-h-[42px]" />
          </div>
          <div>
            <label class="block text-[11px] font-bold uppercase text-slate-500 mb-1">Periodo del salario</label>
            <select v-model="form.salarioPeriodo" class="w-full border border-slate-300 rounded-lg px-2.5 min-h-[42px]">
              <option :value="null">—</option>
              <option value="diario">Diario</option>
              <option value="mensual">Mensual</option>
            </select>
          </div>

          <div>
            <label class="block text-[11px] font-bold uppercase text-slate-500 mb-1">Teléfono</label>
            <input v-model="form.telefono" class="w-full border border-slate-300 rounded-lg px-2.5 min-h-[42px]" />
          </div>
          <div>
            <label class="block text-[11px] font-bold uppercase text-slate-500 mb-1">CURP</label>
            <input v-model="form.curp" class="w-full border border-slate-300 rounded-lg px-2.5 min-h-[42px] uppercase" />
          </div>
          <div>
            <label class="block text-[11px] font-bold uppercase text-slate-500 mb-1">RFC</label>
            <input v-model="form.rfc" class="w-full border border-slate-300 rounded-lg px-2.5 min-h-[42px] uppercase" />
          </div>

          <div>
            <label class="block text-[11px] font-bold uppercase text-slate-500 mb-1">NSS</label>
            <input v-model="form.nss" class="w-full border border-slate-300 rounded-lg px-2.5 min-h-[42px]" />
          </div>
          <div class="sm:col-span-2">
            <label class="block text-[11px] font-bold uppercase text-slate-500 mb-1">Dirección</label>
            <input v-model="form.direccion" class="w-full border border-slate-300 rounded-lg px-2.5 min-h-[42px]" />
          </div>

          <div>
            <label class="block text-[11px] font-bold uppercase text-slate-500 mb-1">Contacto de emergencia</label>
            <input v-model="form.contactoEmergenciaNombre" placeholder="Nombre" class="w-full border border-slate-300 rounded-lg px-2.5 min-h-[42px]" />
          </div>
          <div>
            <label class="block text-[11px] font-bold uppercase text-slate-500 mb-1">Teléfono de emergencia</label>
            <input v-model="form.contactoEmergenciaTelefono" class="w-full border border-slate-300 rounded-lg px-2.5 min-h-[42px]" />
          </div>
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
        <p class="text-xs text-slate-500 mb-4">INE, CURP, RFC, comprobante de domicilio, contrato, etc.</p>

        <div v-if="documentos.length" class="divide-y divide-slate-100 mb-4">
          <div v-for="d in documentos" :key="d.id" class="flex items-center justify-between py-2.5 text-sm">
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
            <label class="block text-[11px] font-bold uppercase text-slate-500 mb-1">Archivo (JPG, PNG, WEBP o PDF)</label>
            <input type="file" accept="image/*,application/pdf" class="w-full border border-slate-300 rounded-lg px-2.5 min-h-[42px]" @change="alSeleccionarDocumento" />
          </div>
          <button type="submit" class="min-h-[42px] bg-primary text-white font-bold rounded-lg px-5 text-sm disabled:opacity-50" :disabled="!archivoSeleccionado || subiendoDoc">
            {{ subiendoDoc ? 'Subiendo…' : '+ Subir documento' }}
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

const TIPOS_DOCUMENTO = ['INE', 'CURP', 'RFC', 'NSS', 'Contrato', 'Comprobante de domicilio', 'Acta de nacimiento', 'Certificación / DC-3', 'Otro'];

const auth = useAuthStore();
const route = useRoute();
const puedeEditar = ['residente', 'superintendente', 'direccion'].includes(auth.rol);

const persona = ref(null);
const documentos = ref([]);
const obras = ref([]);
const mensaje = ref('');
const error = ref('');
const guardando = ref(false);

const form = reactive({
  nombre: '', tipo: 'jornalero', activo: true, oficio: '', puesto: '', obraId: null,
  fechaIngreso: null, salarioReferencia: null, salarioPeriodo: null, telefono: '',
  curp: '', rfc: '', nss: '', direccion: '', contactoEmergenciaNombre: '',
  contactoEmergenciaTelefono: '', notas: '',
});

function llenarForm(p) {
  Object.assign(form, {
    nombre: p.nombre, tipo: p.tipo, activo: p.activo, oficio: p.oficio || '', puesto: p.puesto || '',
    obraId: p.obra_id, fechaIngreso: p.fecha_ingreso ? p.fecha_ingreso.slice(0, 10) : null,
    salarioReferencia: p.salario_referencia != null ? Number(p.salario_referencia) : null,
    salarioPeriodo: p.salario_periodo, telefono: p.telefono || '', curp: p.curp || '', rfc: p.rfc || '',
    nss: p.nss || '', direccion: p.direccion || '', contactoEmergenciaNombre: p.contacto_emergencia_nombre || '',
    contactoEmergenciaTelefono: p.contacto_emergencia_telefono || '', notas: p.notas || '',
  });
}

async function cargar() {
  const { data } = await api.get(`/trabajadores/${route.params.id}`);
  persona.value = data;
  documentos.value = data.documentos;
  llenarForm(data);
}

async function guardar() {
  error.value = '';
  mensaje.value = '';
  guardando.value = true;
  try {
    const { data } = await api.put(`/trabajadores/${route.params.id}`, form);
    persona.value = { ...persona.value, ...data };
    mensaje.value = 'Expediente actualizado.';
  } catch (err) {
    error.value = err.response?.data?.error || 'No se pudo guardar el expediente.';
  } finally {
    guardando.value = false;
  }
}

const nuevoDoc = reactive({ tipo: 'INE', fechaVencimiento: '' });
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
    const form2 = new FormData();
    form2.append('tipoDocumento', nuevoDoc.tipo);
    if (nuevoDoc.fechaVencimiento) form2.append('fechaVencimiento', nuevoDoc.fechaVencimiento);
    form2.append('archivo', archivoSeleccionado.value);
    await api.post(`/trabajadores/${route.params.id}/documentos`, form2);
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
  const { data } = await api.get(`/trabajadores/${route.params.id}/documentos/${d.id}`, { responseType: 'blob' });
  const url = URL.createObjectURL(data);
  window.open(url, '_blank');
}

async function eliminarDocumento(d) {
  if (!window.confirm(`¿Eliminar "${d.tipo_documento}" (${d.nombre_archivo})?`)) return;
  try {
    await api.delete(`/trabajadores/${route.params.id}/documentos/${d.id}`);
    await cargar();
  } catch (err) {
    error.value = err.response?.data?.error || 'No se pudo eliminar el documento.';
  }
}

function formatoTamano(bytes) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
function formatoFecha(fecha) {
  return new Date(fecha).toLocaleDateString('es-MX', { day: '2-digit', month: 'short', year: 'numeric' });
}

onMounted(async () => {
  const { data: obrasData } = await api.get('/catalogo/obras');
  obras.value = obrasData.map((o) => ({ id: o.id, nombre: o.nombre }));
  await cargar();
});
</script>
