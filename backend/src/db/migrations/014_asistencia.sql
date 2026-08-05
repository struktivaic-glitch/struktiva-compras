-- Bloque HR-B: Asistencia / checador. Entrada y salida diaria por persona, capturable desde el
-- celular (mismo patrón de GPS best-effort que las firmas — no bloquea si el navegador niega el
-- permiso). Sigue siendo control interno: no calcula nómina ni faltas automáticamente todavía
-- (eso es del bloque de Incidencias).

CREATE TABLE asistencias (
  id               BIGSERIAL PRIMARY KEY,
  trabajador_id    INTEGER NOT NULL REFERENCES trabajadores(id),
  fecha            DATE NOT NULL,
  hora_entrada     TIMESTAMPTZ,
  hora_salida      TIMESTAMPTZ,
  obra_id          INTEGER REFERENCES obras(id),
  gps_lat_entrada  NUMERIC(9,6),
  gps_lng_entrada  NUMERIC(9,6),
  gps_lat_salida   NUMERIC(9,6),
  gps_lng_salida   NUMERIC(9,6),
  registrado_por   UUID REFERENCES usuarios(id),
  notas            TEXT,
  creado_en        TIMESTAMPTZ NOT NULL DEFAULT now(),
  actualizado_en   TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (trabajador_id, fecha)
);

CREATE INDEX idx_asistencias_fecha ON asistencias (fecha);
CREATE INDEX idx_asistencias_obra ON asistencias (obra_id);
CREATE INDEX idx_asistencias_trabajador ON asistencias (trabajador_id);
