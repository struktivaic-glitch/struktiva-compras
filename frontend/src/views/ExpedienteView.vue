<template>
  <AppShell>
    <div v-if="!datos" class="text-sm text-slate-500">Cargando…</div>
    <template v-else>
      <BotonVolver fallback="/requisiciones" />
      <div class="mb-1">
        <h2 class="font-display text-[36px]">Expediente — {{ datos.requisicion.partida_nombre }}</h2>
        <p class="text-xs text-slate-500">
          Un solo folio raíz ({{ datos.requisicion.folio }}) conecta cada eslabón. Nada de esto se consultó en otro módulo aparte.
        </p>
      </div>

      <div class="max-w-2xl mt-6">
        <!-- 1. Requisición -->
        <div class="flex gap-4">
          <div class="flex flex-col items-center">
            <div class="w-9 h-9 rounded-full bg-white border-2 border-primary flex items-center justify-center text-base">📋</div>
            <div class="w-0.5 flex-1 bg-slate-200 my-0.5" />
          </div>
          <div class="flex-1 bg-white border border-slate-200 rounded-xl px-4 py-3 mb-5 shadow-sm flex justify-between gap-3 flex-wrap">
            <div>
              <div class="text-[10.5px] uppercase tracking-wide text-slate-500 font-sans">1 · Requisición</div>
              <RouterLink :to="`/requisiciones`" class="font-bold text-sm text-primary">{{ datos.requisicion.folio }}</RouterLink>
              <div class="text-xs text-slate-500 font-sans">{{ datos.requisicion.obra_nombre }} / {{ datos.requisicion.frente_nombre }} · {{ datos.requisicion.solicitante_nombre }}</div>
            </div>
            <span class="h-fit text-[11.5px] font-bold px-2.5 py-0.5 rounded-full font-sans" :class="estatusReqClase(datos.requisicion.estatus)">
              {{ estatusReqTexto(datos.requisicion.estatus) }}
            </span>
          </div>
        </div>

        <!-- 2. Cotizacion(es) -->
        <div v-if="datos.cotizaciones.length" v-for="c in datos.cotizaciones" :key="'c'+c.id" class="flex gap-4">
          <div class="flex flex-col items-center">
            <div class="w-9 h-9 rounded-full bg-white border-2 border-primary flex items-center justify-center text-base">⚖️</div>
            <div class="w-0.5 flex-1 bg-slate-200 my-0.5" />
          </div>
          <RouterLink :to="`/cotizaciones/${c.id}`" class="flex-1 bg-white border border-slate-200 rounded-xl px-4 py-3 mb-5 shadow-sm flex justify-between gap-3 flex-wrap hover:border-primary">
            <div>
              <div class="text-[10.5px] uppercase tracking-wide text-slate-500 font-sans">2 · Cuadro comparativo</div>
              <div class="font-bold text-sm text-primary">{{ c.folio }}</div>
            </div>
            <span class="h-fit text-[11.5px] font-bold px-2.5 py-0.5 rounded-full font-sans" :class="c.estatus === 'cerrado' ? 'bg-emerald-50 text-success' : 'bg-amber-50 text-warning'">
              {{ c.estatus === 'cerrado' ? 'Cerrado' : 'En cotización' }}
            </span>
          </RouterLink>
        </div>
        <div v-else class="flex gap-4">
          <div class="flex flex-col items-center">
            <div class="w-9 h-9 rounded-full bg-slate-50 border-2 border-dashed border-slate-300 flex items-center justify-center text-base opacity-50">⚖️</div>
            <div class="w-0.5 flex-1 bg-slate-200 my-0.5" />
          </div>
          <div class="flex-1 px-4 py-3 mb-5 text-xs text-slate-400 font-sans">Aún sin cuadro comparativo.</div>
        </div>

        <!-- 3. Ordenes de compra (con Entradas y Facturas anidadas por OC) -->
        <template v-if="datos.ordenesCompra.length">
          <div v-for="oc in datos.ordenesCompra" :key="'oc'+oc.id" class="flex gap-4">
            <div class="flex flex-col items-center">
              <div class="w-9 h-9 rounded-full bg-white border-2 border-primary flex items-center justify-center text-base">🧾</div>
              <div class="w-0.5 flex-1 bg-slate-200 my-0.5" />
            </div>
            <RouterLink :to="`/ordenes-compra/${oc.id}`" class="flex-1 bg-white border border-slate-200 rounded-xl px-4 py-3 mb-5 shadow-sm flex justify-between gap-3 flex-wrap hover:border-primary">
              <div>
                <div class="text-[10.5px] uppercase tracking-wide text-slate-500 font-sans">3 · Orden de compra</div>
                <div class="font-bold text-sm text-primary">{{ oc.folio }}</div>
                <div class="text-xs text-slate-500 font-sans">{{ oc.proveedor_nombre }}</div>
              </div>
              <div class="font-display tabular-nums text-sm">{{ mxn(oc.importe_total) }}</div>
            </RouterLink>
          </div>
        </template>
        <div v-else class="flex gap-4">
          <div class="flex flex-col items-center">
            <div class="w-9 h-9 rounded-full bg-slate-50 border-2 border-dashed border-slate-300 flex items-center justify-center text-base opacity-50">🧾</div>
            <div class="w-0.5 flex-1 bg-slate-200 my-0.5" />
          </div>
          <div class="flex-1 px-4 py-3 mb-5 text-xs text-slate-400 font-sans">Aún sin Orden de Compra.</div>
        </div>

        <!-- 4. Entradas -->
        <template v-if="datos.entradas.length">
          <div v-for="e in datos.entradas" :key="'e'+e.id" class="flex gap-4">
            <div class="flex flex-col items-center">
              <div class="w-9 h-9 rounded-full bg-white border-2 border-primary flex items-center justify-center text-base">📥</div>
              <div class="w-0.5 flex-1 bg-slate-200 my-0.5" />
            </div>
            <RouterLink :to="`/almacen/entradas/${e.id}`" class="flex-1 bg-white border border-slate-200 rounded-xl px-4 py-3 mb-5 shadow-sm flex justify-between gap-3 flex-wrap hover:border-primary">
              <div>
                <div class="text-[10.5px] uppercase tracking-wide text-slate-500 font-sans">4 · Entrada de almacén</div>
                <div class="font-bold text-sm text-primary">{{ e.folio }}</div>
                <div class="text-xs text-slate-500 font-sans">Remisión {{ e.remision_proveedor }}</div>
              </div>
              <span v-if="e.tiene_excedente" class="h-fit text-[11.5px] font-bold px-2.5 py-0.5 rounded-full bg-amber-50 text-warning font-sans">Con excedente autorizado</span>
            </RouterLink>
          </div>
        </template>
        <div v-else class="flex gap-4">
          <div class="flex flex-col items-center">
            <div class="w-9 h-9 rounded-full bg-slate-50 border-2 border-dashed border-slate-300 flex items-center justify-center text-base opacity-50">📥</div>
            <div class="w-0.5 flex-1 bg-slate-200 my-0.5" />
          </div>
          <div class="flex-1 px-4 py-3 mb-5 text-xs text-slate-400 font-sans">Aún sin material recibido en almacén.</div>
        </div>

        <!-- 5. Salidas relacionadas -->
        <template v-if="datos.salidasRelacionadas.length">
          <div v-for="s in datos.salidasRelacionadas" :key="'s'+s.id" class="flex gap-4">
            <div class="flex flex-col items-center">
              <div class="w-9 h-9 rounded-full bg-white border-2 border-primary flex items-center justify-center text-base">📤</div>
              <div class="w-0.5 flex-1 bg-slate-200 my-0.5" />
            </div>
            <RouterLink :to="`/almacen/salidas/${s.id}`" class="flex-1 bg-white border border-slate-200 rounded-xl px-4 py-3 mb-5 shadow-sm hover:border-primary">
              <div class="text-[10.5px] uppercase tracking-wide text-slate-500 font-sans">5 · Salida de almacén (relacionada por frente/insumo)</div>
              <div class="font-bold text-sm text-primary">{{ s.folio }}</div>
              <div class="text-xs text-slate-500 font-sans">Entregado a: {{ s.usuario_recibe_nombre }}</div>
            </RouterLink>
          </div>
        </template>

        <!-- 6. Facturas -->
        <template v-if="datos.facturas.length">
          <div v-for="f in datos.facturas" :key="'f'+f.id" class="flex gap-4">
            <div class="flex flex-col items-center">
              <div class="w-9 h-9 rounded-full bg-white border-2 border-primary flex items-center justify-center text-base">🧷</div>
              <div class="w-0.5 flex-1 bg-slate-200 my-0.5" />
            </div>
            <RouterLink :to="`/facturas/${f.id}`" class="flex-1 bg-white border border-slate-200 rounded-xl px-4 py-3 mb-5 shadow-sm flex justify-between gap-3 flex-wrap hover:border-primary">
              <div>
                <div class="text-[10.5px] uppercase tracking-wide text-slate-500 font-sans">6 · Factura del proveedor</div>
                <div class="font-bold text-sm text-primary">{{ f.folio }}</div>
              </div>
              <div class="text-right">
                <div class="font-display tabular-nums text-sm">{{ mxn(f.total) }}</div>
                <span class="text-[11.5px] font-bold px-2.5 py-0.5 rounded-full font-sans" :class="estatusPagoClase(f.estatus_pago)">{{ estatusPagoTexto(f.estatus_pago) }}</span>
              </div>
            </RouterLink>
          </div>
        </template>
        <div v-else class="flex gap-4">
          <div class="flex flex-col items-center">
            <div class="w-9 h-9 rounded-full bg-slate-50 border-2 border-dashed border-slate-300 flex items-center justify-center text-base opacity-50">🧷</div>
            <div class="w-0.5 flex-1 bg-slate-200 my-0.5" />
          </div>
          <div class="flex-1 px-4 py-3 mb-5 text-xs text-slate-400 font-sans">Aún sin factura vinculada.</div>
        </div>

        <!-- 7. Pagos -->
        <template v-if="datos.pagos.length">
          <div v-for="(p, i) in datos.pagos" :key="'p'+p.id" class="flex gap-4">
            <div class="flex flex-col items-center">
              <div class="w-9 h-9 rounded-full bg-white border-2 border-primary flex items-center justify-center text-base">💳</div>
              <div v-if="i < datos.pagos.length - 1" class="w-0.5 flex-1 bg-slate-200 my-0.5" />
            </div>
            <RouterLink :to="`/pagos/${p.id}`" class="flex-1 bg-white border border-slate-200 rounded-xl px-4 py-3 mb-5 shadow-sm flex justify-between gap-3 flex-wrap hover:border-primary">
              <div>
                <div class="text-[10.5px] uppercase tracking-wide text-slate-500 font-sans">7 · Pago a proveedor</div>
                <div class="font-bold text-sm text-primary">{{ p.folio }}</div>
                <div class="text-xs text-slate-500 font-sans">{{ FORMAS_PAGO_TEXTO[p.forma_pago] || p.forma_pago }}</div>
              </div>
              <div class="font-display tabular-nums text-sm">{{ mxn(p.monto) }}</div>
            </RouterLink>
          </div>
        </template>
        <div v-else class="flex gap-4">
          <div class="w-9 h-9 rounded-full bg-slate-50 border-2 border-dashed border-slate-300 flex items-center justify-center text-base opacity-50">💳</div>
          <div class="flex-1 px-4 py-3 text-xs text-slate-400 font-sans">Aún sin pago registrado.</div>
        </div>
      </div>
    </template>
  </AppShell>
</template>

<script setup>
import { onMounted, ref } from 'vue';
import { useRoute } from 'vue-router';
import AppShell from '../components/AppShell.vue';
import BotonVolver from '../components/BotonVolver.vue';
import { api } from '../lib/api.js';
import { FORMAS_PAGO_TEXTO } from '../lib/formasPago.js';

const route = useRoute();
const datos = ref(null);

function mxn(n) {
  return new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN' }).format(n || 0);
}

const ESTATUS_REQ = {
  borrador: 'Borrador', pendiente_autorizacion: 'Pend. autorización', autorizada: 'Autorizada',
  atendida_parcial: 'Atendida parcial', atendida_total: 'Atendida total', cancelada: 'Cancelada',
};
function estatusReqTexto(e) { return ESTATUS_REQ[e] ?? e; }
function estatusReqClase(e) {
  if (e === 'autorizada' || e === 'atendida_total') return 'bg-emerald-50 text-success';
  if (e === 'pendiente_autorizacion' || e === 'atendida_parcial') return 'bg-amber-50 text-warning';
  if (e === 'cancelada') return 'bg-slate-100 text-slate-500';
  return 'bg-slate-100 text-slate-600';
}
function estatusPagoTexto(e) {
  return { pendiente: 'Pendiente', pagada_parcial: 'Pagada parcial', pagada_total: 'Pagada total' }[e] ?? e;
}
function estatusPagoClase(e) {
  if (e === 'pagada_total') return 'bg-emerald-50 text-success';
  if (e === 'pagada_parcial') return 'bg-amber-50 text-warning';
  return 'bg-slate-100 text-slate-600';
}

onMounted(async () => {
  const { data } = await api.get(`/expediente/requisicion/${route.params.id}`);
  datos.value = data;
});
</script>
