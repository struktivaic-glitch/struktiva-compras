-- Bloque HR-C: Incidencias (faltas, permisos, vacaciones, incapacidades). Tercer bloque del
-- módulo de RH, mismas reglas de HR-A/HR-B: control interno, sin nómina fiscal. Quien captura la
-- solicitud es un usuario del sistema a nombre del trabajador (los trabajadores no tienen cuenta
-- propia), y Superintendencia/Dirección autoriza o rechaza — mismo patrón de flujo que
-- Requisiciones.

CREATE TABLE incidencias (
  id                     SERIAL PRIMARY KEY,
  trabajador_id          INTEGER NOT NULL REFERENCES trabajadores(id),
  tipo                   VARCHAR(20) NOT NULL CHECK (tipo IN ('falta', 'permiso', 'vacaciones', 'incapacidad')),
  fecha_inicio           DATE NOT NULL,
  fecha_fin              DATE NOT NULL,
  motivo                 TEXT,
  estatus                VARCHAR(20) NOT NULL DEFAULT 'pendiente' CHECK (estatus IN ('pendiente', 'autorizada', 'rechazada')),
  solicitado_por         UUID NOT NULL REFERENCES usuarios(id),
  autorizado_por         UUID REFERENCES usuarios(id),
  fecha_autorizacion     TIMESTAMPTZ,
  comentario_autorizacion TEXT,
  creado_en              TIMESTAMPTZ NOT NULL DEFAULT now(),
  CHECK (fecha_fin >= fecha_inicio)
);

CREATE INDEX idx_incidencias_trabajador ON incidencias (trabajador_id);
CREATE INDEX idx_incidencias_estatus ON incidencias (estatus);

-- Reutiliza la campanita de notificaciones ya existente (Bloque 15) — se agrega la categoría.
ALTER TABLE notificaciones DROP CONSTRAINT notificaciones_categoria_check;
ALTER TABLE notificaciones ADD CONSTRAINT notificaciones_categoria_check CHECK (categoria IN
  ('requisicion', 'excedente', 'orden_compra', 'cambio_precio', 'cancelacion', 'incidencia'));
