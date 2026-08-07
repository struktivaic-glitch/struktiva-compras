-- Struktiva · Control de Compras y Requisiciones
-- Migración 022 (Bloque 29): Avance financiero de obra — presupuesto general por conceptos
-- (distinto del presupuesto por insumo ya existente: este es el catálogo de conceptos
-- contratados con el cliente, tipo "1. Preliminares / CIM-01 Cimentación / $x") y captura de
-- avance físico acumulado por concepto. El mismo avance físico se reutilizará después para
-- calcular pagos a Destajos (Bloque 30) sin volver a capturarlo.

CREATE TABLE conceptos_obra (
  id                    SERIAL PRIMARY KEY,
  obra_id               INTEGER NOT NULL REFERENCES obras(id),
  capitulo              VARCHAR(150),
  clave                 VARCHAR(30) NOT NULL,
  descripcion           VARCHAR(250) NOT NULL,
  unidad                VARCHAR(20) NOT NULL,
  cantidad_contratada   NUMERIC(14,4) NOT NULL CHECK (cantidad_contratada > 0),
  precio_unitario       NUMERIC(14,4) NOT NULL CHECK (precio_unitario > 0),
  creado_en             TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (obra_id, clave)
);

-- Captura de avance físico. Si una captura hace que el acumulado supere la cantidad contratada,
-- queda "pendiente_autorizacion" (con justificación obligatoria) y NO cuenta todavía en el
-- avance oficial hasta que Superintendente/Dirección la autorice con firma — mismo espíritu que
-- el candado de excedente ya usado en Requisiciones y Cotizaciones/Facturas (Bloque 16).
CREATE TABLE concepto_avance (
  id                  SERIAL PRIMARY KEY,
  concepto_id         INTEGER NOT NULL REFERENCES conceptos_obra(id) ON DELETE CASCADE,
  fecha               DATE NOT NULL DEFAULT current_date,
  cantidad_ejecutada  NUMERIC(14,4) NOT NULL CHECK (cantidad_ejecutada > 0),
  excede_contratado   BOOLEAN NOT NULL DEFAULT false,
  justificacion       TEXT,
  estatus             VARCHAR(24) NOT NULL DEFAULT 'confirmado' CHECK (estatus IN ('confirmado', 'pendiente_autorizacion')),
  autorizado_por      UUID REFERENCES usuarios(id),
  fecha_autorizacion  TIMESTAMPTZ,
  registrado_por      UUID NOT NULL REFERENCES usuarios(id),
  notas               TEXT,
  creado_en           TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_concepto_avance_concepto ON concepto_avance (concepto_id);

-- Nueva categoría de notificación para avances que exceden lo contratado.
ALTER TABLE notificaciones DROP CONSTRAINT notificaciones_categoria_check;
ALTER TABLE notificaciones ADD CONSTRAINT notificaciones_categoria_check CHECK (categoria IN
  ('requisicion', 'excedente', 'orden_compra', 'cambio_precio', 'cancelacion', 'avance_obra'));
