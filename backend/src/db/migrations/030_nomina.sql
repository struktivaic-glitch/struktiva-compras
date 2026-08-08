-- Struktiva · Control de Compras y Requisiciones
-- Migración 030: Nómina por lote (semanal/quincenal) — pedido del usuario (08/08/2026),
-- reemplaza el flujo de captura individual de "Pagos a Personal" (Bloque HR-D, migración 016).
-- Decisiones acordadas con el usuario antes de construir esto:
--   1. Nómina REEMPLAZA a Pagos a Personal (no coexisten) — de aquí en adelante todo pago a
--      personal pasa por generar una nómina, aunque sea de una sola persona.
--   2. Duplicado semanal (misma persona en dos nóminas que se traslapan): se ADVIERTE y se pide
--      justificación para guardar, no se bloquea de plano — mismo criterio que ya usa el sistema
--      para excedentes de presupuesto.
--   3. Vacaciones: además del registro de periodos tomados, se calculan los días que le
--      corresponden a cada quien por antigüedad según la Ley Federal del Trabajo (reforma
--      "Vacaciones Dignas" 2023, Art. 76) — el cálculo vive en código (lib/antiguedad.js), no en
--      la base de datos.
--   4. Asistencia como respaldo para calcular días trabajados: el toggle es POR PERSONA dentro de
--      la nómina, no uno solo para todo el lote.
--
-- IMPORTANTE: la tabla `pagos_personal` (migración 016) NO se toca ni se migra — el equipo ya la
-- usó con datos reales antes de este cambio. Se queda tal cual en la base de datos, de solo
-- lectura, y el frontend la sigue mostrando como historial "antes de Nómina" junto a los folios
-- nuevos, para no perder visibilidad de nada ya capturado.

CREATE SEQUENCE nominas_folio_seq;

CREATE TABLE nominas (
  id                 SERIAL PRIMARY KEY,
  folio              VARCHAR(20) NOT NULL UNIQUE,
  periodo_tipo       VARCHAR(10) NOT NULL CHECK (periodo_tipo IN ('semanal', 'quincenal')),
  fecha_inicio       DATE NOT NULL,
  fecha_fin          DATE NOT NULL,
  estatus            VARCHAR(20) NOT NULL DEFAULT 'borrador' CHECK (estatus IN ('borrador', 'pagada', 'cancelada')),
  forma_pago         VARCHAR(20) CHECK (forma_pago IN ('efectivo', 'transferencia', 'tarjeta_debito', 'tarjeta_credito')),
  fecha_pago         DATE,
  usuario_genero_id  UUID NOT NULL REFERENCES usuarios(id),
  pagado_por         UUID REFERENCES usuarios(id),
  creado_en          TIMESTAMPTZ NOT NULL DEFAULT now(),
  CHECK (fecha_fin >= fecha_inicio)
);
CREATE INDEX idx_nominas_estatus ON nominas (estatus);
CREATE INDEX idx_nominas_fechas ON nominas (fecha_inicio, fecha_fin);

-- Un renglón por persona incluida en la nómina. `sueldo_diario` es un SNAPSHOT del sueldo de
-- referencia del expediente al momento de generar — si después cambia en el catálogo, esta
-- nómina ya emitida no se altera retroactivamente (mismo criterio que el P.U. de una factura).
CREATE TABLE nomina_detalle (
  id                      SERIAL PRIMARY KEY,
  nomina_id               INTEGER NOT NULL REFERENCES nominas(id) ON DELETE CASCADE,
  trabajador_id           INTEGER NOT NULL REFERENCES trabajadores(id),
  sueldo_diario           NUMERIC(12,2) NOT NULL CHECK (sueldo_diario > 0),
  usar_asistencia         BOOLEAN NOT NULL DEFAULT true,
  dias_trabajados         NUMERIC(5,2) NOT NULL DEFAULT 0 CHECK (dias_trabajados >= 0),
  compensacion            NUMERIC(12,2) NOT NULL DEFAULT 0 CHECK (compensacion >= 0),
  compensacion_concepto   VARCHAR(150),
  descuento               NUMERIC(12,2) NOT NULL DEFAULT 0 CHECK (descuento >= 0),
  descuento_motivo        TEXT,
  monto_total             NUMERIC(12,2) NOT NULL CHECK (monto_total >= 0),
  -- Se llena solo si el sistema detectó que esta persona ya estaba en otra nómina de la misma
  -- semana y quien capturó decidió incluirla de todos modos.
  duplicado_justificacion TEXT,
  UNIQUE (nomina_id, trabajador_id)
);
CREATE INDEX idx_nomina_detalle_trabajador ON nomina_detalle (trabajador_id);
CREATE INDEX idx_nomina_detalle_nomina ON nomina_detalle (nomina_id);

-- Registro de periodos de vacaciones tomados — la vista de calendario/traslapes entre empleados
-- queda pendiente para un bloque futuro (lo pidió el usuario explícitamente); esto es solo el
-- registro base del que esa vista futura se alimentaría.
CREATE TABLE vacaciones_trabajador (
  id             SERIAL PRIMARY KEY,
  trabajador_id  INTEGER NOT NULL REFERENCES trabajadores(id),
  fecha_inicio   DATE NOT NULL,
  fecha_fin      DATE NOT NULL,
  dias           NUMERIC(4,1) NOT NULL CHECK (dias > 0),
  notas          TEXT,
  registrado_por UUID NOT NULL REFERENCES usuarios(id),
  creado_en      TIMESTAMPTZ NOT NULL DEFAULT now(),
  CHECK (fecha_fin >= fecha_inicio)
);
CREATE INDEX idx_vacaciones_trabajador ON vacaciones_trabajador (trabajador_id);

-- Aviso a Dirección cuando se genera una nómina nueva (queda en borrador hasta que se marca
-- pagada) — mismo patrón que excedente/cambio_precio/avance_obra.
ALTER TABLE notificaciones DROP CONSTRAINT notificaciones_categoria_check;
ALTER TABLE notificaciones ADD CONSTRAINT notificaciones_categoria_check CHECK (categoria IN
  ('requisicion', 'excedente', 'orden_compra', 'cambio_precio', 'cancelacion', 'avance_obra', 'nomina'));
