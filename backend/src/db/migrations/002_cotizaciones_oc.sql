-- Struktiva · Control de Compras y Requisiciones
-- Migración 002 (Bloque 5): Proveedores, Cuadro Comparativo de Cotizaciones y Órdenes de Compra.
-- Continúa la cadena de trazabilidad: Requisición (autorizada) -> Cotización -> Orden de Compra.

CREATE TABLE proveedores (
  id            SERIAL PRIMARY KEY,
  rfc           VARCHAR(13) UNIQUE,
  razon_social  VARCHAR(200) NOT NULL,
  dias_credito  SMALLINT NOT NULL DEFAULT 0,
  moneda        VARCHAR(3) NOT NULL DEFAULT 'MXN' CHECK (moneda IN ('MXN','USD')),
  contacto      VARCHAR(150),
  activo        BOOLEAN NOT NULL DEFAULT true,
  creado_en     TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE SEQUENCE cotizaciones_folio_seq;

CREATE TABLE procesos_cotizacion (
  id            SERIAL PRIMARY KEY,
  folio         VARCHAR(20) NOT NULL UNIQUE,
  obra_id       INTEGER NOT NULL REFERENCES obras(id),
  estatus       VARCHAR(20) NOT NULL DEFAULT 'en_cotizacion' CHECK (estatus IN ('en_cotizacion','cerrado','cancelado')),
  creado_por    UUID NOT NULL REFERENCES usuarios(id),
  creado_en     TIMESTAMPTZ NOT NULL DEFAULT now(),
  cerrado_en    TIMESTAMPTZ
);

CREATE TABLE proceso_cotizacion_requisicion (
  proceso_id      INTEGER NOT NULL REFERENCES procesos_cotizacion(id) ON DELETE CASCADE,
  requisicion_id  INTEGER NOT NULL REFERENCES requisiciones(id),
  PRIMARY KEY (proceso_id, requisicion_id)
);

CREATE TABLE cotizaciones_proveedor (
  id                  SERIAL PRIMARY KEY,
  proceso_id          INTEGER NOT NULL REFERENCES procesos_cotizacion(id) ON DELETE CASCADE,
  proveedor_id        INTEGER NOT NULL REFERENCES proveedores(id),
  fecha               DATE NOT NULL DEFAULT current_date,
  condiciones_pago    VARCHAR(150),
  tiempo_entrega_dias SMALLINT,
  UNIQUE (proceso_id, proveedor_id)
);

CREATE TABLE cotizacion_detalle (
  id                        SERIAL PRIMARY KEY,
  cotizacion_proveedor_id   INTEGER NOT NULL REFERENCES cotizaciones_proveedor(id) ON DELETE CASCADE,
  insumo_id                 INTEGER NOT NULL REFERENCES insumos(id),
  precio_unitario           NUMERIC(14,4) NOT NULL CHECK (precio_unitario > 0),
  UNIQUE (cotizacion_proveedor_id, insumo_id)
);

-- Proveedor/precio ganador seleccionado por insumo dentro de un proceso de cotización.
CREATE TABLE proceso_cotizacion_ganador (
  proceso_id            INTEGER NOT NULL REFERENCES procesos_cotizacion(id) ON DELETE CASCADE,
  insumo_id             INTEGER NOT NULL REFERENCES insumos(id),
  cotizacion_detalle_id INTEGER NOT NULL REFERENCES cotizacion_detalle(id),
  PRIMARY KEY (proceso_id, insumo_id)
);

CREATE SEQUENCE oc_folio_seq;

CREATE TABLE ordenes_compra (
  id                    SERIAL PRIMARY KEY,
  folio                 VARCHAR(20) NOT NULL UNIQUE,
  proveedor_id          INTEGER NOT NULL REFERENCES proveedores(id),
  proceso_cotizacion_id INTEGER REFERENCES procesos_cotizacion(id),
  moneda                VARCHAR(3) NOT NULL DEFAULT 'MXN' CHECK (moneda IN ('MXN','USD')),
  estatus               VARCHAR(20) NOT NULL DEFAULT 'borrador' CHECK (estatus IN ('borrador','confirmada','cancelada')),
  usuario_compra_id     UUID NOT NULL REFERENCES usuarios(id),
  creado_en             TIMESTAMPTZ NOT NULL DEFAULT now(),
  confirmada_en         TIMESTAMPTZ
);

CREATE TABLE oc_requisicion (
  oc_id           INTEGER NOT NULL REFERENCES ordenes_compra(id) ON DELETE CASCADE,
  requisicion_id  INTEGER NOT NULL REFERENCES requisiciones(id),
  PRIMARY KEY (oc_id, requisicion_id)
);

CREATE TABLE oc_detalle (
  id                  SERIAL PRIMARY KEY,
  oc_id               INTEGER NOT NULL REFERENCES ordenes_compra(id) ON DELETE CASCADE,
  insumo_id           INTEGER NOT NULL REFERENCES insumos(id),
  cantidad_pedida     NUMERIC(14,4) NOT NULL CHECK (cantidad_pedida > 0),
  precio_negociado    NUMERIC(14,4) NOT NULL,
  cantidad_surtida    NUMERIC(14,4) NOT NULL DEFAULT 0,
  UNIQUE (oc_id, insumo_id)
);
