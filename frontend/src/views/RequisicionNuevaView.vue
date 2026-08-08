<template>
  <AppShell>
    <div class="flex items-center justify-between mb-4 flex-wrap gap-3">
      <div>
        <h2 class="font-display text-[36px]">Nueva requisición</h2>
        <p class="text-xs text-slate-500">
          {{ tipoRequisicion === 'nomina'
            ? 'Cada renglón es un rubro de Mano de Obra; se desglosa en las personas que cobran contra él (días × tarifa).'
            : 'Selecciona la obra y el frente/partida donde se usará el material, y agrega los insumos requeridos.' }}
        </p>
      </div>
      <div class="flex items-center gap-2 flex-wrap">
        <div class="inline-flex border border-slate-300 rounded-lg overflow-hidden">
          <button
            class="text-xs font-semibold px-4 py-2"
            :class="tipoRequisicion === 'materiales' ? 'bg-primary text-white' : 'bg-white text-slate-500'"
            @click="tipoRequisicion = 'materiales'"
          >
            Materiales
          </button>
          <button
            class="text-xs font-semibold px-4 py-2"
            :class="tipoRequisicion === 'nomina' ? 'bg-primary text-white' : 'bg-white text-slate-500'"
            @click="tipoRequisicion = 'nomina'; cargarInsumosManoDeObra()"
          >
            Nómina
          </button>
        </div>
        <div v-if="tipoRequisicion === 'materiales'" class="inline-flex border border-slate-300 rounded-lg overflow-hidden">
          <button
            class="text-xs font-semibold px-4 py-2"
            :class="vista === 'desktop' ? 'bg-primary text-white' : 'bg-white text-slate-500'"
            @click="vista = 'desktop'"
          >
            Vista escritorio
          </button>
          <button
            class="text-xs font-semibold px-4 py-2"
            :class="vista === 'mobile' ? 'bg-primary text-white' : 'bg-white text-slate-500'"
            @click="vista = 'mobile'"
          >
            Vista campo (móvil)
          </button>
        </div>
      </div>
    </div>

    <div class="bg-white border border-slate-200 rounded-xl p-4 mb-5 grid sm:grid-cols-3 gap-3">
      <div>
        <label class="block text-[11px] font-bold uppercase text-slate-500 mb-1">Obra</label>
        <select v-model.number="obraId" class="w-full border border-slate-300 rounded-lg px-2.5 min-h-[42px]">
          <option v-for="o in obras" :key="o.id" :value="o.id">{{ o.nombre }}</option>
        </select>
      </div>
      <div>
        <label class="block text-[11px] font-bold uppercase text-slate-500 mb-1">Etapa</label>
        <select v-model.number="etapaId" class="w-full border border-slate-300 rounded-lg px-2.5 min-h-[42px]">
          <option v-for="e in etapas" :key="e.id" :value="e.id">{{ e.nombre }}</option>
        </select>
      </div>
      <div>
        <label class="block text-[11px] font-bold uppercase text-slate-500 mb-1">Frente</label>
        <select v-model.number="frenteId" class="w-full border border-slate-300 rounded-lg px-2.5 min-h-[42px]">
          <option v-for="f in frentes" :key="f.id" :value="f.id">{{ f.nombre }}</option>
        </select>
      </div>
      <div class="sm:col-span-3">
        <label class="block text-[11px] font-bold uppercase text-slate-500 mb-1">Partida</label>
        <select v-model.number="partidaId" class="w-full border border-slate-300 rounded-lg px-2.5 min-h-[42px]">
          <option v-for="p in partidas" :key="p.id" :value="p.id">{{ p.clave }} — {{ p.nombre }}</option>
        </select>
      </div>
    </div>

    <template v-if="tipoRequisicion === 'materiales'">
    <div v-if="obraId" class="bg-white border border-slate-200 rounded-xl p-4 mb-5">
      <label class="block text-[11px] font-bold uppercase text-slate-500 mb-1">Agregar insumo</label>
      <div class="flex gap-2">
        <div class="relative flex-1">
          <input
            v-model="busqueda"
            type="text"
            placeholder="Buscar por clave o descripción…"
            class="w-full border border-slate-300 rounded-lg px-3 min-h-[44px]"
            @input="buscarInsumos"
          />
          <ul v-if="sugerencias.length" class="absolute z-10 bg-white border border-slate-200 rounded-lg shadow-lg mt-1 w-full max-h-64 overflow-y-auto">
            <li
              v-for="s in sugerencias"
              :key="s.id"
              class="px-3 py-2 text-sm hover:bg-slate-50 cursor-pointer flex justify-between"
              @click="agregarInsumo(s)"
            >
              <span>{{ s.clave }} · {{ s.descripcion }} ({{ s.unidad }})</span>
              <span class="tabular-nums text-slate-400">saldo: {{ Number(s.saldo_disponible).toLocaleString('es-MX') }}</span>
            </li>
          </ul>
        </div>
        <button
          type="button"
          class="min-h-[44px] flex-none border-[1.5px] border-primary text-primary font-bold rounded-lg px-4 text-sm whitespace-nowrap"
          @click="abrirCatalogo"
        >
          Ver catálogo completo
        </button>
      </div>
    </div>

    <!-- Modal: catálogo completo de insumos de la obra, agrupado por familia -->
    <div v-if="catalogoAbierto" class="fixed inset-0 bg-black/40 z-50 flex items-start sm:items-center justify-center p-3" @click.self="catalogoAbierto = false">
      <div class="bg-white rounded-xl shadow-lg w-full max-w-2xl max-h-[85vh] flex flex-col">
        <div class="p-4 border-b border-slate-200 flex-none">
          <div class="flex items-center justify-between mb-2">
            <h3 class="font-display text-base">Catálogo de insumos — {{ obraNombre }}</h3>
            <button class="text-slate-400 hover:text-slate-600 text-lg leading-none" @click="catalogoAbierto = false">✕</button>
          </div>
          <input
            v-model="catalogoFiltro"
            type="text"
            placeholder="Filtrar por clave, descripción o familia…"
            class="w-full border border-slate-300 rounded-lg px-3 min-h-[42px] text-sm"
          />
        </div>
        <div class="overflow-y-auto p-4 flex-1">
          <p v-if="catalogoCargando" class="text-sm text-slate-400 text-center py-8">Cargando catálogo…</p>
          <template v-else-if="familiasFiltradas.length">
            <div v-for="fam in familiasFiltradas" :key="fam.nombre" class="mb-5 last:mb-0">
              <h4 class="text-[11px] font-bold uppercase tracking-wide text-slate-400 mb-1.5">{{ fam.nombre }}</h4>
              <div class="border border-slate-200 rounded-lg divide-y divide-slate-100">
                <button
                  v-for="s in fam.insumos"
                  :key="s.id"
                  type="button"
                  class="w-full text-left px-3 py-2.5 text-sm hover:bg-slate-50 flex items-center justify-between gap-3"
                  @click="agregarInsumo(s); catalogoFiltro = ''"
                >
                  <span class="min-w-0">
                    <span class="font-semibold">{{ s.clave }}</span> · {{ s.descripcion }}
                    <span class="text-slate-400"> ({{ s.unidad }})</span>
                  </span>
                  <span class="tabular-nums text-slate-400 flex-none text-xs">saldo: {{ Number(s.saldo_disponible).toLocaleString('es-MX') }}</span>
                </button>
              </div>
            </div>
          </template>
          <p v-else class="text-sm text-slate-400 text-center py-8">
            {{ catalogoInsumos.length ? 'No hay insumos que coincidan con el filtro.' : 'Ya agregaste todos los insumos presupuestados de esta obra.' }}
          </p>
        </div>
      </div>
    </div>

    <p v-if="errorGeneral" class="bg-red-50 border border-danger/30 text-danger text-sm rounded-lg px-4 py-3 mb-4">{{ errorGeneral }}</p>
    <p v-if="guardadoOffline" class="bg-amber-50 border border-warning/30 text-warning text-sm rounded-lg px-4 py-3 mb-4">
      📴 Sin conexión — se guardó como borrador local en este dispositivo. Se enviará solo cuando vuelvas a tener internet (revisa "Borradores pendientes" en Requisiciones).
    </p>

    <!-- Vista escritorio: matriz densa -->
    <div v-if="vista === 'desktop' && items.length" class="overflow-x-auto bg-white border border-slate-200 rounded-xl mb-3">
      <table class="w-full text-sm tabular-nums">
        <thead>
          <tr class="bg-slate-50 text-[11px] uppercase tracking-wide text-slate-500">
            <th class="text-left px-4 py-2.5 font-normal">Clave</th>
            <th class="text-left px-4 py-2.5 font-normal">Descripción</th>
            <th class="text-left px-4 py-2.5 font-normal">Un.</th>
            <th class="text-left px-4 py-2.5 font-normal">Presupuestado</th>
            <th class="text-left px-4 py-2.5 font-normal">Disponible</th>
            <th class="text-left px-4 py-2.5 font-normal">Cant. requerida</th>
            <th class="text-left px-4 py-2.5 font-normal">P.U.</th>
            <th class="text-left px-4 py-2.5 font-normal">Total sugerido</th>
            <th class="text-left px-4 py-2.5 font-normal">Estado</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          <template v-for="item in items" :key="item.insumoId">
            <tr :class="excede(item) ? 'bg-red-50' : ''" class="border-t border-slate-200">
              <td class="px-4 py-2.5 font-sans">{{ item.clave }}</td>
              <td class="px-4 py-2.5 font-sans">{{ item.descripcion }}</td>
              <td class="px-4 py-2.5 font-sans">{{ item.unidad }}</td>
              <td class="px-4 py-2.5">{{ item.cantidadPresupuestada }}</td>
              <td class="px-4 py-2.5">{{ item.saldoDisponible }}</td>
              <td class="px-4 py-2.5">
                <input v-if="!item.esManoDeObra" v-model.number="item.cantidadRequerida" type="number" inputmode="decimal" min="0" step="any" class="w-24 border border-slate-300 rounded px-2 py-1.5" />
                <span v-else class="text-slate-400 text-xs">ver desglose ↓</span>
              </td>
              <td class="px-4 py-2.5">
                <input v-if="!item.esManoDeObra" v-model.number="item.precioUnitario" type="number" inputmode="decimal" min="0" step="any" class="w-24 border border-slate-300 rounded px-2 py-1.5" />
                <span v-else class="text-slate-400 text-xs">ver desglose ↓</span>
              </td>
              <td class="px-4 py-2.5 font-semibold">{{ mxn(totalSugerido(item)) }}</td>
              <td class="px-4 py-2.5 font-sans">
                <span v-if="excede(item)" class="text-[11.5px] font-bold px-2.5 py-0.5 rounded-full bg-red-50 text-danger">Excede</span>
                <span v-else class="text-[11.5px] font-bold px-2.5 py-0.5 rounded-full bg-emerald-50 text-success">OK</span>
              </td>
              <td class="px-4 py-2.5 font-sans"><button class="text-slate-400 hover:text-danger" @click="quitarInsumo(item)">✕</button></td>
            </tr>

            <!-- Renglón de Mano de Obra: la cantidad y el P.U. de arriba se derivan de este
                 desglose — la suma total del cargo alimenta automáticamente el renglón del
                 insumo (pedido del usuario 07/08/2026), nunca se captura aparte. -->
            <tr v-if="item.esManoDeObra" class="border-t border-slate-100 bg-slate-50/60">
              <td colspan="10" class="px-4 py-3">
                <p class="text-[11px] font-bold uppercase tracking-wide text-slate-500 mb-2">Personal asignado — {{ item.descripcion }}</p>
                <div v-if="item.personal.length" class="border border-slate-200 rounded-lg divide-y divide-slate-100 mb-2 bg-white max-w-md">
                  <div v-for="(p, pidx) in item.personal" :key="pidx" class="flex items-center justify-between px-3 py-2 text-sm">
                    <span>{{ nombreTrabajador(p.trabajadorId) }}</span>
                    <div class="flex items-center gap-3">
                      <span class="tabular-nums font-semibold">{{ mxn(p.monto) }}</span>
                      <button class="text-slate-400 hover:text-danger" @click="item.personal.splice(pidx, 1)">✕</button>
                    </div>
                  </div>
                </div>
                <div class="flex flex-wrap items-end gap-2">
                  <div class="flex-1 min-w-[160px] max-w-xs">
                    <label class="block text-[11px] font-bold uppercase text-slate-500 mb-1">Trabajador</label>
                    <select v-model.number="item.nuevoPersonal.trabajadorId" class="w-full border border-slate-300 rounded-lg px-2.5 min-h-[42px] text-sm">
                      <option :value="null" disabled>Elegir…</option>
                      <option v-for="t in trabajadores" :key="t.id" :value="t.id">{{ t.nombre }}{{ t.oficio ? ' · ' + t.oficio : '' }}</option>
                    </select>
                  </div>
                  <div class="w-32">
                    <label class="block text-[11px] font-bold uppercase text-slate-500 mb-1">Monto</label>
                    <input v-model.number="item.nuevoPersonal.monto" type="number" inputmode="decimal" min="0" step="any" class="w-full border border-slate-300 rounded-lg px-2.5 min-h-[42px] text-sm" />
                  </div>
                  <button type="button" class="min-h-[42px] border-[1.5px] border-primary text-primary font-bold rounded-lg px-4 text-sm" :disabled="!item.nuevoPersonal.trabajadorId || !item.nuevoPersonal.monto" @click="agregarPersonalItem(item)">
                    + Agregar
                  </button>
                  <button type="button" class="text-xs text-slate-400 underline ml-auto" @click="renglonAltaTrabajador = item; mostrarAltaTrabajador = true">¿No está en la lista? Dar de alta</button>
                </div>
                <p class="text-sm font-bold mt-2">Suma total del cargo: {{ mxn(totalPersonalItem(item)) }}</p>
              </td>
            </tr>

            <tr v-if="excede(item)" class="border-t border-danger/20">
              <td colspan="10" class="px-4 py-3 bg-red-50">
                <label class="block text-[11.5px] font-bold text-danger mb-1">
                  Justificación técnica obligatoria — {{ item.descripcion }} excede saldo disponible por {{ (cantidadEquivalente(item) - item.saldoDisponible).toFixed(2) }} {{ item.unidad }}
                </label>
                <textarea v-model="item.justificacion" rows="2" class="w-full border border-danger rounded-md px-2.5 py-1.5 text-sm" placeholder="Describe el motivo del excedente…" />
              </td>
            </tr>
          </template>
        </tbody>
      </table>
    </div>

    <!-- Vista móvil: tarjetas -->
    <div v-else-if="vista === 'mobile' && items.length" class="flex flex-col gap-3 max-w-md mb-3">
      <div v-for="item in items" :key="item.insumoId" class="bg-white border rounded-xl p-4 shadow-sm" :class="excede(item) ? 'border-danger' : 'border-slate-200'">
        <div class="flex justify-between gap-2 mb-1.5">
          <span class="font-semibold text-[14.5px]">{{ item.descripcion }}</span>
          <span v-if="excede(item)" class="text-[11.5px] font-bold px-2.5 py-0.5 rounded-full bg-red-50 text-danger h-fit">Excede</span>
          <span v-else class="text-[11.5px] font-bold px-2.5 py-0.5 rounded-full bg-emerald-50 text-success h-fit">OK</span>
        </div>
        <div class="text-[11px] text-slate-500 mb-2">{{ item.clave }} · {{ item.unidad }}</div>
        <div class="flex justify-between text-[12.5px] text-slate-500 py-0.5"><span>Presupuestado</span><b class="text-slate-800">{{ item.cantidadPresupuestada }} {{ item.unidad }}</b></div>
        <div class="flex justify-between text-[12.5px] text-slate-500 py-0.5"><span>Disponible</span><b class="text-slate-800">{{ item.saldoDisponible }} {{ item.unidad }}</b></div>
        <template v-if="!item.esManoDeObra">
          <div class="flex items-center gap-2.5 mt-2.5">
            <label class="text-xs text-slate-500 flex-none">Cant.</label>
            <input v-model.number="item.cantidadRequerida" type="number" inputmode="decimal" min="0" step="any" class="flex-1 min-h-[48px] text-lg text-center border border-slate-300 rounded-lg" />
          </div>
          <div class="flex items-center gap-2.5 mt-2.5">
            <label class="text-xs text-slate-500 flex-none">P.U.</label>
            <input v-model.number="item.precioUnitario" type="number" inputmode="decimal" min="0" step="any" class="flex-1 min-h-[48px] text-lg text-center border border-slate-300 rounded-lg" />
          </div>
        </template>

        <!-- Renglón de Mano de Obra: cantidad y P.U. se derivan del desglose de personal — la
             suma total del cargo alimenta automáticamente el renglón (pedido del usuario
             07/08/2026), nunca se captura aparte. -->
        <div v-else class="mt-2.5 bg-slate-50 border border-slate-200 rounded-lg p-3">
          <p class="text-[11px] font-bold uppercase tracking-wide text-slate-500 mb-2">Personal asignado</p>
          <div v-if="item.personal.length" class="border border-slate-200 rounded-lg divide-y divide-slate-100 mb-2 bg-white">
            <div v-for="(p, pidx) in item.personal" :key="pidx" class="flex items-center justify-between px-3 py-2 text-sm">
              <span>{{ nombreTrabajador(p.trabajadorId) }}</span>
              <div class="flex items-center gap-3">
                <span class="tabular-nums font-semibold">{{ mxn(p.monto) }}</span>
                <button class="text-slate-400 hover:text-danger" @click="item.personal.splice(pidx, 1)">✕</button>
              </div>
            </div>
          </div>
          <div class="flex items-center gap-2.5 mb-2">
            <select v-model.number="item.nuevoPersonal.trabajadorId" class="flex-1 min-h-[44px] border border-slate-300 rounded-lg text-sm">
              <option :value="null" disabled>Trabajador…</option>
              <option v-for="t in trabajadores" :key="t.id" :value="t.id">{{ t.nombre }}{{ t.oficio ? ' · ' + t.oficio : '' }}</option>
            </select>
            <input v-model.number="item.nuevoPersonal.monto" type="number" inputmode="decimal" min="0" step="any" placeholder="Monto" class="w-24 min-h-[44px] text-center border border-slate-300 rounded-lg" />
          </div>
          <button type="button" class="min-h-[44px] w-full border-[1.5px] border-primary text-primary font-bold rounded-lg text-sm mb-1" :disabled="!item.nuevoPersonal.trabajadorId || !item.nuevoPersonal.monto" @click="agregarPersonalItem(item)">
            + Agregar
          </button>
          <button type="button" class="text-xs text-slate-400 underline" @click="renglonAltaTrabajador = item; mostrarAltaTrabajador = true">¿No está en la lista? Dar de alta</button>
          <p class="text-sm font-bold mt-2">Suma total del cargo: {{ mxn(totalPersonalItem(item)) }}</p>
        </div>

        <div class="flex justify-between text-[12.5px] text-slate-500 py-0.5 mt-2"><span>Total sugerido</span><b class="text-slate-800">{{ mxn(totalSugerido(item)) }}</b></div>
        <div v-if="excede(item)" class="mt-2.5 bg-red-50 border border-dashed border-danger rounded-md px-2.5 py-2">
          <label class="text-[11px] font-bold text-danger block mb-1">Justificación técnica obligatoria</label>
          <textarea v-model="item.justificacion" rows="2" class="w-full border border-danger rounded-md px-2.5 py-1.5 text-sm" placeholder="Describe el motivo del excedente…" />
        </div>
        <button class="text-xs text-slate-400 mt-2" @click="quitarInsumo(item)">Quitar</button>
      </div>
    </div>

    <p v-else-if="obraId" class="text-sm text-slate-400 mb-3">Agrega insumos con el buscador de arriba.</p>
    </template>

    <!-- ===== Requisición de Nómina (Bloque 28) ===== -->
    <template v-else-if="tipoRequisicion === 'nomina'">
      <div v-if="obraId" class="flex gap-2 mb-5">
        <button type="button" class="min-h-[44px] border-[1.5px] border-primary text-primary font-bold rounded-lg px-4 text-sm" @click="abrirCatalogoManoDeObra">
          + Agregar renglón de Mano de Obra
        </button>
      </div>

      <div v-for="(renglon, ridx) in renglonesNomina" :key="renglon.insumoId" class="bg-white border border-slate-200 rounded-xl p-4 mb-3" :class="excedeRenglon(renglon) ? 'border-danger' : ''">
        <div class="flex items-center justify-between mb-1">
          <div>
            <span class="font-semibold text-sm">{{ renglon.descripcion }}</span>
            <span class="text-xs text-slate-400 ml-1">({{ renglon.clave }}) · saldo disponible: {{ renglon.saldoDisponible }}</span>
          </div>
          <div class="flex items-center gap-2">
            <span v-if="excedeRenglon(renglon)" class="text-[11.5px] font-bold px-2.5 py-0.5 rounded-full bg-red-50 text-danger">Excede</span>
            <span v-else class="text-[11.5px] font-bold px-2.5 py-0.5 rounded-full bg-emerald-50 text-success">OK</span>
            <button class="text-slate-400 hover:text-danger" @click="renglonesNomina.splice(ridx, 1)">✕</button>
          </div>
        </div>

        <div v-if="renglon.personal.length" class="border border-slate-200 rounded-lg divide-y divide-slate-100 my-2">
          <div v-for="(p, pidx) in renglon.personal" :key="pidx" class="flex items-center justify-between px-3 py-2 text-sm">
            <span>{{ nombreTrabajador(p.trabajadorId) }} — {{ p.diasTrabajados }} día(s) × {{ mxn(p.tarifaDiaria) }}</span>
            <div class="flex items-center gap-3">
              <span class="tabular-nums font-semibold">{{ mxn(p.diasTrabajados * p.tarifaDiaria) }}</span>
              <button class="text-slate-400 hover:text-danger" @click="renglon.personal.splice(pidx, 1)">✕</button>
            </div>
          </div>
        </div>

        <div class="flex flex-wrap items-end gap-2 mt-2">
          <div class="flex-1 min-w-[140px]">
            <label class="block text-[11px] font-bold uppercase text-slate-500 mb-1">Trabajador</label>
            <select v-model.number="renglon.nuevoPersonal.trabajadorId" class="w-full border border-slate-300 rounded-lg px-2.5 min-h-[42px] text-sm" @change="precargarTarifa(renglon)">
              <option :value="null" disabled>Elegir…</option>
              <option v-for="t in trabajadores" :key="t.id" :value="t.id">{{ t.nombre }}{{ t.oficio ? ' · ' + t.oficio : '' }}</option>
            </select>
          </div>
          <div class="w-24">
            <label class="block text-[11px] font-bold uppercase text-slate-500 mb-1">Días</label>
            <input v-model.number="renglon.nuevoPersonal.diasTrabajados" type="number" inputmode="decimal" min="0" step="0.5" class="w-full border border-slate-300 rounded-lg px-2.5 min-h-[42px] text-sm" />
          </div>
          <div class="w-28">
            <label class="block text-[11px] font-bold uppercase text-slate-500 mb-1">Tarifa diaria</label>
            <input v-model.number="renglon.nuevoPersonal.tarifaDiaria" type="number" inputmode="decimal" min="0" step="any" class="w-full border border-slate-300 rounded-lg px-2.5 min-h-[42px] text-sm" />
          </div>
          <button
            type="button"
            class="min-h-[42px] border-[1.5px] border-primary text-primary font-bold rounded-lg px-4 text-sm"
            :disabled="!renglon.nuevoPersonal.trabajadorId || !renglon.nuevoPersonal.diasTrabajados || !renglon.nuevoPersonal.tarifaDiaria"
            @click="agregarPersonalRenglon(renglon)"
          >
            + Agregar
          </button>
          <button type="button" class="text-xs text-slate-400 underline ml-auto" @click="renglonAltaTrabajador = renglon; mostrarAltaTrabajador = true">¿No está en la lista? Dar de alta</button>
        </div>

        <p class="text-sm font-bold mt-2">Total del renglón: {{ mxn(totalRenglon(renglon)) }}</p>

        <div v-if="excedeRenglon(renglon)" class="mt-2.5 bg-red-50 border border-dashed border-danger rounded-md px-2.5 py-2">
          <label class="text-[11px] font-bold text-danger block mb-1">
            Justificación técnica obligatoria — excede saldo disponible por {{ (totalRenglon(renglon) / (renglon.costoUnitario || 1) - renglon.saldoDisponible).toFixed(2) }}
          </label>
          <textarea v-model="renglon.justificacion" rows="2" class="w-full border border-danger rounded-md px-2.5 py-1.5 text-sm" placeholder="Describe el motivo del excedente…" />
        </div>
      </div>

      <p v-if="!renglonesNomina.length && obraId" class="text-sm text-slate-400 mb-3">Agrega un renglón de Mano de Obra con el botón de arriba.</p>

      <p v-if="renglonesNomina.length" class="text-sm font-display mb-5">Total de Nómina: <b>{{ mxn(totalNomina) }}</b></p>

      <!-- Modal: catálogo de insumos de Mano de Obra (+ dar de alta uno nuevo) -->
      <div v-if="catalogoMdOAbierto" class="fixed inset-0 bg-black/40 z-50 flex items-start sm:items-center justify-center p-3" @click.self="catalogoMdOAbierto = false">
        <div class="bg-white rounded-xl shadow-lg w-full max-w-lg max-h-[85vh] flex flex-col">
          <div class="p-4 border-b border-slate-200 flex-none flex items-center justify-between">
            <h3 class="font-display text-base">Rubros de Mano de Obra — {{ obraNombre }}</h3>
            <button class="text-slate-400 hover:text-slate-600 text-lg leading-none" @click="catalogoMdOAbierto = false">✕</button>
          </div>
          <div class="overflow-y-auto p-4 flex-1">
            <div v-if="insumosManoDeObraDisponibles.length" class="border border-slate-200 rounded-lg divide-y divide-slate-100 mb-4">
              <button
                v-for="s in insumosManoDeObraDisponibles"
                :key="s.id"
                type="button"
                class="w-full text-left px-3 py-2.5 text-sm hover:bg-slate-50 flex items-center justify-between gap-3"
                @click="agregarRenglonNomina(s)"
              >
                <span><span class="font-semibold">{{ s.clave }}</span> · {{ s.descripcion }}</span>
                <span class="tabular-nums text-slate-400 flex-none text-xs">saldo: {{ Number(s.saldo_disponible).toLocaleString('es-MX') }}</span>
              </button>
            </div>
            <p v-else class="text-sm text-slate-400 mb-4">Ya agregaste todos los rubros de Mano de Obra existentes, o no hay ninguno aún.</p>

            <button type="button" class="text-xs font-semibold text-primary underline" @click="mostrarInsumoNuevo = true">+ Dar de alta un rubro nuevo de Mano de Obra</button>
          </div>
        </div>
      </div>

      <!-- Alta de insumo nuevo (Mano de Obra) — arranca con presupuesto en $0 a propósito -->
      <div v-if="mostrarInsumoNuevo" class="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-3" @click.self="mostrarInsumoNuevo = false">
        <form class="bg-white rounded-xl shadow-lg w-full max-w-sm p-4" @submit.prevent="darDeAltaInsumo">
          <div class="flex items-center justify-between mb-3">
            <h3 class="font-display text-base">Nuevo rubro de Mano de Obra</h3>
            <button type="button" class="text-slate-400 hover:text-slate-600 text-lg leading-none" @click="mostrarInsumoNuevo = false">✕</button>
          </div>
          <p class="text-xs text-slate-500 mb-3">Arranca con presupuesto en $0 — cualquier cargo mostrará "excede" hasta que Dirección autorice un estimado.</p>
          <label class="block text-[11px] font-bold uppercase text-slate-500 mb-1">Clave</label>
          <input v-model="insumoNuevo.clave" required placeholder="Ej. MO-004" class="w-full border border-slate-300 rounded-lg px-2.5 min-h-[42px] mb-3" />
          <label class="block text-[11px] font-bold uppercase text-slate-500 mb-1">Descripción</label>
          <input v-model="insumoNuevo.descripcion" required placeholder="Ej. Fierrero" class="w-full border border-slate-300 rounded-lg px-2.5 min-h-[42px] mb-3" />
          <label class="block text-[11px] font-bold uppercase text-slate-500 mb-1">Tarifa diaria de referencia</label>
          <input v-model.number="insumoNuevo.costoUnitarioReferencia" type="number" min="0.01" step="any" required class="w-full border border-slate-300 rounded-lg px-2.5 min-h-[42px] mb-3" />
          <p v-if="errorInsumoNuevo" class="text-xs text-danger mb-2">{{ errorInsumoNuevo }}</p>
          <button type="submit" class="min-h-[44px] bg-primary text-white font-bold rounded-lg px-5 text-sm w-full" :disabled="guardandoInsumo">
            {{ guardandoInsumo ? 'Guardando…' : '+ Agregar y seleccionar' }}
          </button>
        </form>
      </div>
    </template>

    <!-- Alta rápida de trabajador, sin salir de la requisición en progreso -->
    <div v-if="mostrarAltaTrabajador" class="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-3" @click.self="mostrarAltaTrabajador = false">
      <form class="bg-white rounded-xl shadow-lg w-full max-w-sm p-4" @submit.prevent="darDeAltaTrabajador">
        <div class="flex items-center justify-between mb-3">
          <h3 class="font-display text-base">Dar de alta trabajador</h3>
          <button type="button" class="text-slate-400 hover:text-slate-600 text-lg leading-none" @click="mostrarAltaTrabajador = false">✕</button>
        </div>
        <label class="block text-[11px] font-bold uppercase text-slate-500 mb-1">Nombre</label>
        <input v-model="altaTrabajador.nombre" required class="w-full border border-slate-300 rounded-lg px-2.5 min-h-[42px] mb-3" />
        <label class="block text-[11px] font-bold uppercase text-slate-500 mb-1">Oficio (opcional)</label>
        <input v-model="altaTrabajador.oficio" placeholder="Ej. Albañil, Peón, Fierrero…" class="w-full border border-slate-300 rounded-lg px-2.5 min-h-[42px] mb-3" />
        <p v-if="errorAltaTrabajador" class="text-xs text-danger mb-2">{{ errorAltaTrabajador }}</p>
        <button type="submit" class="min-h-[44px] bg-primary text-white font-bold rounded-lg px-5 text-sm w-full" :disabled="guardandoTrabajador">
          {{ guardandoTrabajador ? 'Guardando…' : '+ Agregar y seleccionar' }}
        </button>
      </form>
    </div>

    <div class="flex gap-2.5">
      <button class="min-h-[48px] border-[1.5px] border-slate-300 rounded-lg px-5 font-semibold text-sm" @click="guardar('borrador')" :disabled="!puedeGuardar || guardando">
        Guardar borrador
      </button>
      <button class="min-h-[48px] bg-primary text-white rounded-lg px-5 font-bold text-sm" @click="guardar('enviar')" :disabled="!puedeGuardar || guardando">
        {{ guardando ? 'Guardando…' : 'Guardar y enviar a autorizar' }}
      </button>
    </div>
  </AppShell>
</template>

<script setup>
import { ref, reactive, computed, watch } from 'vue';
import { useRouter } from 'vue-router';
import AppShell from '../components/AppShell.vue';
import { api } from '../lib/api.js';
import { guardarBorradorLocal, esErrorDeRed } from '../lib/offlineQueue.js';

const router = useRouter();

const obras = ref([]);
const obraId = ref(null);
const etapaId = ref(null);
const frenteId = ref(null);
const partidaId = ref(null);
const items = ref([]);
const tipoRequisicion = ref('materiales'); // 'materiales' | 'nomina'
const busqueda = ref('');
const sugerencias = ref([]);
const vista = ref('desktop');
const errorGeneral = ref('');
const guardando = ref(false);
const guardadoOffline = ref(false);

const etapas = computed(() => obras.value.find((o) => o.id === obraId.value)?.etapas ?? []);
const frentes = computed(() => etapas.value.find((e) => e.id === etapaId.value)?.frentes ?? []);
const partidas = computed(() => frentes.value.find((f) => f.id === frenteId.value)?.partidas ?? []);
const obraNombre = computed(() => obras.value.find((o) => o.id === obraId.value)?.nombre ?? '');

const catalogoAbierto = ref(false);
const catalogoCargando = ref(false);
const catalogoInsumos = ref([]);
const catalogoFiltro = ref('');

const familiasFiltradas = computed(() => {
  const filtro = catalogoFiltro.value.trim().toLowerCase();
  const disponibles = catalogoInsumos.value.filter((s) => !items.value.some((i) => i.insumoId === s.id));
  const coincide = (s) =>
    !filtro ||
    s.clave.toLowerCase().includes(filtro) ||
    s.descripcion.toLowerCase().includes(filtro) ||
    (s.familia_nombre ?? '').toLowerCase().includes(filtro);

  const grupos = new Map();
  for (const s of disponibles) {
    if (!coincide(s)) continue;
    const nombre = s.familia_nombre ?? 'Sin familia';
    if (!grupos.has(nombre)) grupos.set(nombre, []);
    grupos.get(nombre).push(s);
  }
  return [...grupos.entries()].map(([nombre, insumos]) => ({ nombre, insumos }));
});

function excede(item) {
  if (item.esManoDeObra) return cantidadEquivalente(item) > Number(item.saldoDisponible);
  return Number(item.cantidadRequerida) > Number(item.saldoDisponible);
}

async function cargarArbol() {
  const { data } = await api.get('/catalogo/obras');
  obras.value = data;
  obraId.value = data[0]?.id ?? null;
}

watch(obraId, () => {
  etapaId.value = etapas.value[0]?.id ?? null;
  items.value = [];
  catalogoInsumos.value = [];
  renglonesNomina.value = [];
  insumosManoDeObra.value = [];
});
watch(etapaId, () => { frenteId.value = frentes.value[0]?.id ?? null; });
watch(frenteId, () => { partidaId.value = partidas.value[0]?.id ?? null; });

let debounce;
function buscarInsumos() {
  clearTimeout(debounce);
  debounce = setTimeout(async () => {
    if (!obraId.value) return;
    const { data } = await api.get(`/catalogo/obras/${obraId.value}/insumos`, { params: { q: busqueda.value } });
    sugerencias.value = data.filter((s) => !items.value.some((i) => i.insumoId === s.id));
  }, 200);
}

async function abrirCatalogo() {
  catalogoAbierto.value = true;
  catalogoFiltro.value = '';
  if (catalogoInsumos.value.length) return; // ya cargado en esta sesión de captura
  catalogoCargando.value = true;
  try {
    const { data } = await api.get(`/catalogo/obras/${obraId.value}/insumos`, { params: { todos: '1' } });
    catalogoInsumos.value = data;
  } finally {
    catalogoCargando.value = false;
  }
}

function agregarInsumo(s) {
  const esManoDeObra = Boolean(s.es_mano_de_obra);
  items.value.push({
    insumoId: s.id,
    clave: s.clave,
    descripcion: s.descripcion,
    unidad: s.unidad,
    cantidadPresupuestada: Number(s.cantidad_presupuestada),
    saldoDisponible: Number(s.saldo_disponible),
    costoUnitario: Number(s.costo_unitario ?? 0),
    // El P.U. se precarga con el del presupuesto (referencia útil) pero es editable — el total
    // sugerido de esta requisición se calcula con el P.U. que quede aquí, no el del presupuesto.
    // Para Mano de Obra no aplica: cantidad y P.U. se derivan solas del desglose de personal de
    // abajo (mismo criterio que la Requisición de Nómina — nunca se captura a mano, así el total
    // del renglón siempre es exactamente la suma de su propio personal).
    precioUnitario: esManoDeObra ? null : Number(s.costo_unitario ?? 0) || null,
    esManoDeObra,
    cantidadRequerida: esManoDeObra ? null : null,
    justificacion: '',
    personal: esManoDeObra ? [] : undefined,
    nuevoPersonal: esManoDeObra ? { trabajadorId: null, monto: null } : undefined,
  });
  busqueda.value = '';
  sugerencias.value = [];
}

function quitarInsumo(item) {
  items.value = items.value.filter((i) => i.insumoId !== item.insumoId);
}

// Suma total del cargo — pedido explícito del usuario (07/08/2026): esto es lo que alimenta
// automáticamente el renglón del insumo de Mano de Obra, en vez de capturar cantidad/P.U. aparte
// y tener que cuadrarlos a mano contra el personal asignado.
function totalPersonalItem(item) {
  return (item.personal || []).reduce((acc, p) => acc + Number(p.monto || 0), 0);
}

function totalSugerido(item) {
  if (item.esManoDeObra) return totalPersonalItem(item);
  return Number(item.cantidadRequerida || 0) * Number(item.precioUnitario || 0);
}

// Cantidad equivalente en la unidad del insumo (ej. "Jornal"), para poder comparar el cargo de
// Mano de Obra contra el saldo disponible presupuestado — mismo cálculo que ya usa el backend y
// la Requisición de Nómina: monto total ÷ costo unitario presupuestado.
function cantidadEquivalente(item) {
  if (!item.esManoDeObra) return Number(item.cantidadRequerida || 0);
  return item.costoUnitario > 0 ? totalPersonalItem(item) / item.costoUnitario : 0;
}

function agregarPersonalItem(item) {
  item.personal.push({ ...item.nuevoPersonal });
  item.nuevoPersonal = { trabajadorId: null, monto: null };
}

// Qué renglón está recibiendo el alta rápida de trabajador ("¿No está en la lista?") — para
// saber a cuál de los desgloses de personal agregar al recién creado.
const renglonAltaTrabajador = ref(null);

// --- Personal asignado (Mano de Obra) — desglosado por renglón, ver agregarPersonalItem arriba.
// Rediseñado 07/08/2026 a pedido del usuario: antes cantidad/P.U. se capturaban aparte y debían
// "cuadrar" a mano contra la suma del personal; ahora el personal ES el renglón — no hay nada
// que capturar aparte ni que pueda dejar de cuadrar. ---
const trabajadores = ref([]);
const mostrarAltaTrabajador = ref(false);
const altaTrabajador = reactive({ nombre: '', oficio: '' });
const errorAltaTrabajador = ref('');
const guardandoTrabajador = ref(false);

async function darDeAltaTrabajador() {
  errorAltaTrabajador.value = '';
  guardandoTrabajador.value = true;
  try {
    const { data } = await api.post('/trabajadores', altaTrabajador);
    trabajadores.value.push(data);
    // Selecciona al recién creado en el renglón (materiales-MdO o nómina) desde donde se abrió
    // el alta rápida — ver renglonAltaTrabajador.
    if (renglonAltaTrabajador.value) renglonAltaTrabajador.value.nuevoPersonal.trabajadorId = data.id;
    altaTrabajador.nombre = '';
    altaTrabajador.oficio = '';
    mostrarAltaTrabajador.value = false;
  } catch (err) {
    errorAltaTrabajador.value = err.response?.data?.error || 'No se pudo dar de alta al trabajador.';
  } finally {
    guardandoTrabajador.value = false;
  }
}

function mxn(n) {
  return new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN' }).format(n || 0);
}
function nombreTrabajador(id) {
  return trabajadores.value.find((t) => t.id === id)?.nombre ?? '—';
}

// --- Requisición de Nómina (Bloque 28) ---
// Cada renglón es un rubro de Mano de Obra presupuestado; se desglosa en personal (días x tarifa
// diaria). El total del renglón SIEMPRE es la suma de su propio desglose — nunca se captura a
// mano — así nunca puede "no cuadrar". Una misma persona puede aparecer en varios renglones.
const renglonesNomina = ref([]);
const insumosManoDeObra = ref([]);
const catalogoMdOAbierto = ref(false);
const mostrarInsumoNuevo = ref(false);
const insumoNuevo = reactive({ clave: '', descripcion: '', costoUnitarioReferencia: null });
const errorInsumoNuevo = ref('');
const guardandoInsumo = ref(false);

const insumosManoDeObraDisponibles = computed(() =>
  insumosManoDeObra.value.filter((s) => !renglonesNomina.value.some((r) => r.insumoId === s.id))
);

async function cargarInsumosManoDeObra() {
  if (!obraId.value || insumosManoDeObra.value.length) return;
  const { data } = await api.get(`/catalogo/obras/${obraId.value}/insumos`, { params: { todos: '1' } });
  insumosManoDeObra.value = data.filter((s) => s.es_mano_de_obra);
}

function abrirCatalogoManoDeObra() {
  catalogoMdOAbierto.value = true;
  cargarInsumosManoDeObra();
}

function agregarRenglonNomina(s) {
  renglonesNomina.value.push({
    insumoId: s.id,
    clave: s.clave,
    descripcion: s.descripcion,
    saldoDisponible: Number(s.saldo_disponible),
    costoUnitario: Number(s.costo_unitario ?? 0),
    justificacion: '',
    personal: [],
    nuevoPersonal: { trabajadorId: null, diasTrabajados: null, tarifaDiaria: null },
  });
  catalogoMdOAbierto.value = false;
}

function precargarTarifa(renglon) {
  const t = trabajadores.value.find((tr) => tr.id === renglon.nuevoPersonal.trabajadorId);
  if (t?.salario_referencia && !renglon.nuevoPersonal.tarifaDiaria) {
    renglon.nuevoPersonal.tarifaDiaria = Number(t.salario_referencia);
  }
}

function agregarPersonalRenglon(renglon) {
  renglon.personal.push({ ...renglon.nuevoPersonal });
  renglon.nuevoPersonal = { trabajadorId: null, diasTrabajados: null, tarifaDiaria: null };
}

function totalRenglon(renglon) {
  return renglon.personal.reduce((acc, p) => acc + Number(p.diasTrabajados || 0) * Number(p.tarifaDiaria || 0), 0);
}
function excedeRenglon(renglon) {
  if (!renglon.costoUnitario) return false;
  const cantidadEquivalente = totalRenglon(renglon) / renglon.costoUnitario;
  return cantidadEquivalente > renglon.saldoDisponible;
}
const totalNomina = computed(() => renglonesNomina.value.reduce((acc, r) => acc + totalRenglon(r), 0));

async function darDeAltaInsumo() {
  errorInsumoNuevo.value = '';
  guardandoInsumo.value = true;
  try {
    const { data } = await api.post('/insumos', {
      clave: insumoNuevo.clave,
      descripcion: insumoNuevo.descripcion,
      unidad: 'Jornal',
      // Sin familiaId: el backend resuelve/crea la familia "Mano de Obra" automáticamente,
      // así funciona igual aunque la obra no tenga todavía ningún rubro de MdO en su catálogo.
      obraId: obraId.value,
      costoUnitarioReferencia: insumoNuevo.costoUnitarioReferencia,
    });
    agregarRenglonNomina({
      id: data.id, clave: data.clave, descripcion: data.descripcion,
      saldo_disponible: 0, costo_unitario: insumoNuevo.costoUnitarioReferencia,
    });
    insumoNuevo.clave = '';
    insumoNuevo.descripcion = '';
    insumoNuevo.costoUnitarioReferencia = null;
    mostrarInsumoNuevo.value = false;
    insumosManoDeObra.value = []; // refrescar en el próximo abrir catálogo
  } catch (err) {
    errorInsumoNuevo.value = err.response?.data?.error || 'No se pudo crear el insumo.';
  } finally {
    guardandoInsumo.value = false;
  }
}

const puedeGuardar = computed(() => {
  if (tipoRequisicion.value === 'nomina') {
    return renglonesNomina.value.length > 0 && renglonesNomina.value.every((r) => r.personal.length > 0);
  }
  return items.value.length > 0 && items.value.every((i) => !i.esManoDeObra || i.personal.length > 0);
});

async function guardar(siguiente) {
  errorGeneral.value = '';
  let payload;

  if (tipoRequisicion.value === 'nomina') {
    const faltantesJust = renglonesNomina.value.filter((r) => excedeRenglon(r) && !r.justificacion?.trim());
    if (faltantesJust.length) {
      errorGeneral.value = `Falta justificación técnica en: ${faltantesJust.map((r) => r.descripcion).join(', ')}`;
      return;
    }
    if (renglonesNomina.value.some((r) => r.personal.length === 0)) {
      errorGeneral.value = 'Cada renglón necesita al menos una persona con días y tarifa capturados.';
      return;
    }
    payload = {
      tipo: 'nomina',
      obraId: obraId.value,
      etapaId: etapaId.value,
      frenteId: frenteId.value,
      partidaId: partidaId.value,
      items: renglonesNomina.value.map((r) => ({
        insumoId: r.insumoId,
        justificacion: r.justificacion || null,
        personal: r.personal.map((p) => ({ trabajadorId: p.trabajadorId, diasTrabajados: p.diasTrabajados, tarifaDiaria: p.tarifaDiaria })),
      })),
    };
  } else {
    const faltantes = items.value.filter((i) => excede(i) && !i.justificacion?.trim());
    if (faltantes.length) {
      errorGeneral.value = `Falta justificación técnica en: ${faltantes.map((i) => i.descripcion).join(', ')}`;
      return;
    }
    if (items.value.some((i) => !i.esManoDeObra && (!i.cantidadRequerida || i.cantidadRequerida <= 0))) {
      errorGeneral.value = 'Captura una cantidad requerida mayor a cero en cada insumo.';
      return;
    }
    if (items.value.some((i) => !i.esManoDeObra && (!i.precioUnitario || i.precioUnitario <= 0))) {
      errorGeneral.value = 'Captura un precio unitario mayor a cero en cada insumo.';
      return;
    }
    if (items.value.some((i) => i.esManoDeObra && i.personal.length === 0)) {
      errorGeneral.value = 'Cada renglón de Mano de Obra necesita al menos una persona con un monto asignado.';
      return;
    }
    payload = {
      tipo: 'materiales',
      obraId: obraId.value,
      etapaId: etapaId.value,
      frenteId: frenteId.value,
      partidaId: partidaId.value,
      items: items.value.map((i) => ({
        insumoId: i.insumoId,
        cantidadRequerida: i.esManoDeObra ? undefined : i.cantidadRequerida,
        precioUnitario: i.esManoDeObra ? undefined : i.precioUnitario,
        justificacion: i.justificacion || null,
        personal: i.esManoDeObra ? i.personal.map((p) => ({ trabajadorId: p.trabajadorId, monto: p.monto })) : undefined,
      })),
    };
  }

  guardando.value = true;

  try {
    const { data } = await api.post('/requisiciones', payload);

    if (siguiente === 'enviar') {
      await api.post(`/requisiciones/${data.id}/enviar`);
    }
    router.push('/requisiciones');
  } catch (err) {
    if (esErrorDeRed(err)) {
      guardarBorradorLocal({ ...payload, siguiente });
      guardadoOffline.value = true;
      setTimeout(() => router.push('/requisiciones'), 1800);
      return;
    }
    errorGeneral.value = err.response?.data?.error || 'No se pudo guardar la requisición.';
  } finally {
    guardando.value = false;
  }
}

cargarArbol();
api.get('/trabajadores').then(({ data }) => { trabajadores.value = data; });
</script>
