-- Sistema de notificaciones internas (campanita). Genérico por tipo/entidad para poder cubrir
-- Requisiciones, Excedente, Cambio de precio (bloque siguiente) y Cancelaciones desde una sola tabla.

CREATE TABLE notificaciones (
  id            SERIAL PRIMARY KEY,
  usuario_id    UUID NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
  categoria     VARCHAR(30) NOT NULL CHECK (categoria IN
                  ('requisicion', 'excedente', 'orden_compra', 'cambio_precio', 'cancelacion')),
  entidad_tipo  VARCHAR(30) NOT NULL,
  entidad_id    INTEGER NOT NULL,
  titulo        VARCHAR(200) NOT NULL,
  mensaje       TEXT,
  leida         BOOLEAN NOT NULL DEFAULT false,
  creado_en     TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_notificaciones_usuario_leida ON notificaciones (usuario_id, leida);
CREATE INDEX idx_notificaciones_usuario_categoria ON notificaciones (usuario_id, categoria);
