-- Bloque HR-E: Cumplimiento de jornada laboral (LFT Art. 132 Fracc. XXXIV, Art. 66-68, reforma de
-- jornada de 40 horas DOF 01-05-2026). El registro de entrada/salida/comida debe ser inalterable
-- e íntegro: las marcas originales NUNCA se sobrescriben. Cualquier corrección posterior queda
-- como un evento aparte, con motivo obligatorio, en `asistencia_correcciones` — el campo
-- "efectivo" en `asistencias` sí se actualiza (para que reportes/cálculos usen el valor correcto),
-- pero el original queda visible para trazabilidad ante una auditoría (Art. 784 LFT).
--
-- IMPORTANTE (dejar constancia en el propio código, no solo en la conversación): la ley vigente
-- de la reforma de jornada tiene un calendario gradual y hay ambigüedad publicada sobre el
-- criterio exacto de cómputo diario vs. semanal de horas extra dobles/triples. Por eso los
-- umbrales viven en una tabla de configuración editable (`configuracion_jornada`), no
-- hardcodeados en el código — y el cálculo de horas extra en el sistema es una SUGERENCIA, no una
-- verdad legal absoluta. Se recomienda validar con asesoría laboral antes de usarlo para nómina
-- real o como prueba en una auditoría/juicio.

ALTER TABLE asistencias ADD COLUMN hora_entrada_original TIMESTAMPTZ;
ALTER TABLE asistencias ADD COLUMN hora_salida_original TIMESTAMPTZ;
ALTER TABLE asistencias ADD COLUMN hora_inicio_comida TIMESTAMPTZ;
ALTER TABLE asistencias ADD COLUMN hora_inicio_comida_original TIMESTAMPTZ;
ALTER TABLE asistencias ADD COLUMN hora_fin_comida TIMESTAMPTZ;
ALTER TABLE asistencias ADD COLUMN hora_fin_comida_original TIMESTAMPTZ;
ALTER TABLE asistencias ADD COLUMN corregido BOOLEAN NOT NULL DEFAULT false;

-- Backfill: los registros existentes (si los hay) toman su valor actual como "original" también,
-- para no dejar esas columnas vacías en filas previas a este bloque.
UPDATE asistencias SET hora_entrada_original = hora_entrada WHERE hora_entrada IS NOT NULL;
UPDATE asistencias SET hora_salida_original = hora_salida WHERE hora_salida IS NOT NULL;

CREATE TABLE asistencia_correcciones (
  id              SERIAL PRIMARY KEY,
  asistencia_id   BIGINT NOT NULL REFERENCES asistencias(id) ON DELETE CASCADE,
  campo           VARCHAR(30) NOT NULL CHECK (campo IN ('hora_entrada', 'hora_salida', 'hora_inicio_comida', 'hora_fin_comida')),
  valor_anterior  TIMESTAMPTZ,
  valor_nuevo     TIMESTAMPTZ NOT NULL,
  motivo          TEXT NOT NULL,
  corregido_por   UUID NOT NULL REFERENCES usuarios(id),
  corregido_en    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_asistencia_correcciones_asistencia ON asistencia_correcciones (asistencia_id);

-- Umbrales legales vigentes por fecha — editable por Dirección, para poder ajustarlos según
-- avance el calendario de la reforma (o si una asesoría laboral confirma un criterio distinto).
CREATE TABLE configuracion_jornada (
  id                          SERIAL PRIMARY KEY,
  vigente_desde               DATE NOT NULL UNIQUE,
  jornada_semanal_horas       NUMERIC(5,2) NOT NULL,
  limite_semanal_dobles_horas NUMERIC(5,2) NOT NULL,
  notas                       TEXT,
  creado_en                   TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Calendario publicado de la reforma (DOF 01-05-2026): 48h (2026) -> 46h (2027) -> 44h (2028) ->
-- 42h (2029) -> 40h (2030); tope semanal de horas dobles: 9h (2026-2027) -> 10h (2028) -> 11h
-- (2029) -> 12h (2030). Ajustable desde /configuracion-jornada si cambia o se aclara el criterio.
INSERT INTO configuracion_jornada (vigente_desde, jornada_semanal_horas, limite_semanal_dobles_horas, notas) VALUES
  ('2026-01-01', 48, 9,  'Calendario inicial de la reforma (DOF 01-05-2026).'),
  ('2027-01-01', 46, 9,  'Reducción gradual año 2.'),
  ('2028-01-01', 44, 10, 'Reducción gradual año 3.'),
  ('2029-01-01', 42, 11, 'Reducción gradual año 4.'),
  ('2030-01-01', 40, 12, 'Reducción gradual año 5 (jornada final: 40h).')
ON CONFLICT (vigente_desde) DO NOTHING;
