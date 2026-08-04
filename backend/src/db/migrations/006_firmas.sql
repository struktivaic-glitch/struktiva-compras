-- Struktiva · Control de Compras y Requisiciones
-- Migración 006 (Bloque 10): Firmas digitales (Táctil / PIN) para autorización de requisiciones.
-- OTP por correo queda fuera hasta que haya SMTP configurado (ver PENDIENTES-STRUKTIVA.md).

ALTER TABLE usuarios ADD COLUMN pin_hash VARCHAR(200);

CREATE TABLE firmas (
  id              BIGSERIAL PRIMARY KEY,
  entidad_tipo    VARCHAR(30) NOT NULL,
  entidad_id      INTEGER NOT NULL,
  usuario_id      UUID NOT NULL REFERENCES usuarios(id),
  tipo            VARCHAR(10) NOT NULL CHECK (tipo IN ('tactil', 'pin', 'otp')),
  imagen_url      TEXT,
  ip              VARCHAR(45),
  user_agent      TEXT,
  gps_lat         NUMERIC(9,6),
  gps_lng         NUMERIC(9,6),
  creado_en       TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_firmas_entidad ON firmas (entidad_tipo, entidad_id);
