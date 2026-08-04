-- Struktiva · Control de Compras y Requisiciones
-- Migración inicial: catálogo maestro + módulo de Requisiciones (Bloque 4)
-- Los módulos de Cotizaciones, Órdenes de Compra, Almacén y CxP se agregan en bloques siguientes.

CREATE EXTENSION IF NOT EXISTS "pgcrypto";

CREATE TABLE roles (
  id            SMALLSERIAL PRIMARY KEY,
  clave         VARCHAR(30) NOT NULL UNIQUE,
  nombre        VARCHAR(80) NOT NULL
);

INSERT INTO roles (clave, nombre) VALUES
  ('residente',       'Residente de Obra'),
  ('superintendente',  'Superintendente'),
  ('comprador',        'Comprador / Compras'),
  ('almacenista',      'Almacenista'),
  ('direccion',        'Dirección'),
  ('auditor',          'Auditor');

CREATE TABLE usuarios (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nombre        VARCHAR(150) NOT NULL,
  email         VARCHAR(180) NOT NULL UNIQUE,
  password_hash VARCHAR(200) NOT NULL,
  rol_id        SMALLINT NOT NULL REFERENCES roles(id),
  activo        BOOLEAN NOT NULL DEFAULT true,
  creado_en     TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE obras (
  id            SERIAL PRIMARY KEY,
  nombre        VARCHAR(150) NOT NULL,
  ubicacion     VARCHAR(200),
  cliente       VARCHAR(150),
  estatus       VARCHAR(20) NOT NULL DEFAULT 'activa' CHECK (estatus IN ('activa','cerrada','suspendida')),
  creado_en     TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE etapas (
  id            SERIAL PRIMARY KEY,
  obra_id       INTEGER NOT NULL REFERENCES obras(id) ON DELETE CASCADE,
  nombre        VARCHAR(120) NOT NULL,
  orden         SMALLINT NOT NULL DEFAULT 1,
  UNIQUE (obra_id, nombre)
);

CREATE TABLE frentes (
  id            SERIAL PRIMARY KEY,
  etapa_id      INTEGER NOT NULL REFERENCES etapas(id) ON DELETE CASCADE,
  nombre        VARCHAR(120) NOT NULL,
  orden         SMALLINT NOT NULL DEFAULT 1,
  UNIQUE (etapa_id, nombre)
);

CREATE TABLE familias_insumo (
  id                       SERIAL PRIMARY KEY,
  nombre                   VARCHAR(100) NOT NULL UNIQUE,
  tolerancia_recepcion_pct NUMERIC(5,2) NOT NULL DEFAULT 0
);

CREATE TABLE insumos (
  id            SERIAL PRIMARY KEY,
  clave         VARCHAR(30) NOT NULL UNIQUE,
  descripcion   VARCHAR(250) NOT NULL,
  unidad        VARCHAR(20) NOT NULL,
  familia_id    INTEGER REFERENCES familias_insumo(id),
  creado_en     TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE EXTENSION IF NOT EXISTS pg_trgm;
CREATE INDEX idx_insumos_descripcion_trgm ON insumos USING gin (descripcion gin_trgm_ops);

CREATE TABLE partidas (
  id                       SERIAL PRIMARY KEY,
  frente_id                INTEGER NOT NULL REFERENCES frentes(id) ON DELETE CASCADE,
  clave                    VARCHAR(30) NOT NULL,
  nombre                   VARCHAR(150) NOT NULL,
  tolerancia_recepcion_pct NUMERIC(5,2),
  UNIQUE (frente_id, clave)
);

-- Explosión de insumos: cantidad presupuestada por combinación Partida x Insumo.
-- Intangible: no se modifica por transacciones de compra, solo por carga/ajuste autorizado.
CREATE TABLE presupuesto_partida_insumo (
  id                    SERIAL PRIMARY KEY,
  partida_id            INTEGER NOT NULL REFERENCES partidas(id) ON DELETE CASCADE,
  insumo_id             INTEGER NOT NULL REFERENCES insumos(id),
  cantidad_presupuestada NUMERIC(14,4) NOT NULL,
  costo_unitario        NUMERIC(14,4) NOT NULL,
  moneda                VARCHAR(3) NOT NULL DEFAULT 'MXN' CHECK (moneda IN ('MXN','USD')),
  UNIQUE (partida_id, insumo_id)
);

CREATE SEQUENCE requisiciones_folio_seq;

CREATE TABLE requisiciones (
  id                    SERIAL PRIMARY KEY,
  folio                 VARCHAR(20) NOT NULL UNIQUE,
  obra_id               INTEGER NOT NULL REFERENCES obras(id),
  etapa_id              INTEGER NOT NULL REFERENCES etapas(id),
  frente_id             INTEGER NOT NULL REFERENCES frentes(id),
  partida_id            INTEGER NOT NULL REFERENCES partidas(id),
  usuario_solicitante_id UUID NOT NULL REFERENCES usuarios(id),
  usuario_autoriza_id   UUID REFERENCES usuarios(id),
  estatus               VARCHAR(25) NOT NULL DEFAULT 'borrador'
                          CHECK (estatus IN ('borrador','pendiente_autorizacion','autorizada','atendida_parcial','atendida_total','cancelada')),
  fecha_autorizacion    TIMESTAMPTZ,
  creado_en             TIMESTAMPTZ NOT NULL DEFAULT now(),
  actualizado_en        TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE requisicion_detalle (
  id                  SERIAL PRIMARY KEY,
  requisicion_id      INTEGER NOT NULL REFERENCES requisiciones(id) ON DELETE CASCADE,
  insumo_id           INTEGER NOT NULL REFERENCES insumos(id),
  cantidad_requerida  NUMERIC(14,4) NOT NULL CHECK (cantidad_requerida > 0),
  cantidad_aprobada   NUMERIC(14,4),
  excede_presupuesto  BOOLEAN NOT NULL DEFAULT false,
  justificacion       TEXT,
  UNIQUE (requisicion_id, insumo_id)
);

CREATE TABLE bitacora_auditoria (
  id                  BIGSERIAL PRIMARY KEY,
  tabla_afectada      VARCHAR(60) NOT NULL,
  registro_id         VARCHAR(40) NOT NULL,
  usuario_id          UUID REFERENCES usuarios(id),
  accion              VARCHAR(20) NOT NULL,
  valores_anteriores  JSONB,
  valores_nuevos      JSONB,
  creado_en           TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Saldo disponible por Partida x Insumo:
--   Saldo Disponible = Cant. Presupuestada − Σ(Cant. Requerida Aprobada)
-- Solo cuenta lo aprobado en requisiciones ya autorizadas/atendidas (no borradores ni canceladas).
CREATE VIEW vw_saldo_partida_insumo AS
SELECT
  ppi.partida_id,
  ppi.insumo_id,
  ppi.cantidad_presupuestada,
  ppi.costo_unitario,
  ppi.moneda,
  COALESCE(SUM(rd.cantidad_aprobada) FILTER (
    WHERE r.estatus IN ('autorizada','atendida_parcial','atendida_total')
  ), 0) AS cantidad_aprobada_acumulada,
  ppi.cantidad_presupuestada - COALESCE(SUM(rd.cantidad_aprobada) FILTER (
    WHERE r.estatus IN ('autorizada','atendida_parcial','atendida_total')
  ), 0) AS saldo_disponible
FROM presupuesto_partida_insumo ppi
LEFT JOIN requisicion_detalle rd ON rd.insumo_id = ppi.insumo_id
LEFT JOIN requisiciones r ON r.id = rd.requisicion_id AND r.partida_id = ppi.partida_id
GROUP BY ppi.partida_id, ppi.insumo_id, ppi.cantidad_presupuestada, ppi.costo_unitario, ppi.moneda;
