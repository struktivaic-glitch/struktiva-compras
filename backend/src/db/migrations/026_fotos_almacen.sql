-- Struktiva · Control de Compras y Requisiciones
-- Migración 026: fotos de evidencia en Entrada y Salida de Almacén — pedido del usuario
-- (07/08/2026). Mismo patrón BYTEA que documentos_personal/documentos_equipo (migraciones 013 y
-- 024): la base de datos guarda el archivo directamente porque el disco de Render (plan gratis)
-- es efímero. Se permite más de una foto por tipo desde el inicio (a veces la remisión trae
-- varias hojas, o el embarque llega repartido en varios camiones) — evita tener que migrar de
-- nuevo cuando alguien suba la segunda.

CREATE TABLE fotos_entrada_almacen (
  id             SERIAL PRIMARY KEY,
  entrada_id     INTEGER NOT NULL REFERENCES entradas_almacen(id) ON DELETE CASCADE,
  tipo           VARCHAR(20) NOT NULL CHECK (tipo IN ('remision', 'embarque')),
  nombre_archivo VARCHAR(255) NOT NULL,
  mime           VARCHAR(50) NOT NULL,
  archivo        BYTEA NOT NULL,
  tamano_bytes   INTEGER NOT NULL,
  subido_por     UUID REFERENCES usuarios(id),
  creado_en      TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_fotos_entrada_almacen_entrada ON fotos_entrada_almacen (entrada_id);

-- "personal" = evidencia fotográfica de quién recibió el material (mismo criterio ya usado en el
-- selfie opcional de Asistencia, migración 018: evidencia revisable, no biometría).
-- "material" = evidencia de lo físicamente entregado.
CREATE TABLE fotos_salida_almacen (
  id             SERIAL PRIMARY KEY,
  salida_id      INTEGER NOT NULL REFERENCES salidas_almacen(id) ON DELETE CASCADE,
  tipo           VARCHAR(20) NOT NULL CHECK (tipo IN ('personal', 'material')),
  nombre_archivo VARCHAR(255) NOT NULL,
  mime           VARCHAR(50) NOT NULL,
  archivo        BYTEA NOT NULL,
  tamano_bytes   INTEGER NOT NULL,
  subido_por     UUID REFERENCES usuarios(id),
  creado_en      TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_fotos_salida_almacen_salida ON fotos_salida_almacen (salida_id);
