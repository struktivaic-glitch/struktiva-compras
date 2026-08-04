-- Struktiva · Control de Compras y Requisiciones
-- Migración 005 (Bloque 7): Facturación (Three-Way Matching) y Cuentas por Pagar.
-- Cierra la cadena completa: Requisición -> Cotización -> OC -> Entrada -> Factura -> Pago.

CREATE SEQUENCE facturas_folio_seq;

CREATE TABLE facturas (
  id                  SERIAL PRIMARY KEY,
  folio               VARCHAR(20) NOT NULL UNIQUE,
  folio_fiscal_uuid   VARCHAR(36),
  serie_folio         VARCHAR(40),
  proveedor_id        INTEGER NOT NULL REFERENCES proveedores(id),
  oc_id               INTEGER NOT NULL REFERENCES ordenes_compra(id),
  subtotal            NUMERIC(14,4) NOT NULL,
  iva                 NUMERIC(14,4) NOT NULL DEFAULT 0,
  total               NUMERIC(14,4) NOT NULL,
  moneda              VARCHAR(3) NOT NULL DEFAULT 'MXN' CHECK (moneda IN ('MXN','USD')),
  fecha               DATE NOT NULL DEFAULT current_date,
  xml_url             TEXT,
  pdf_url             TEXT,
  estatus_pago        VARCHAR(20) NOT NULL DEFAULT 'pendiente' CHECK (estatus_pago IN ('pendiente','pagada_parcial','pagada_total')),
  usuario_captura_id  UUID NOT NULL REFERENCES usuarios(id),
  creado_en           TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE factura_detalle (
  id              SERIAL PRIMARY KEY,
  factura_id      INTEGER NOT NULL REFERENCES facturas(id) ON DELETE CASCADE,
  insumo_id       INTEGER NOT NULL REFERENCES insumos(id),
  cantidad        NUMERIC(14,4) NOT NULL CHECK (cantidad > 0),
  precio_unitario NUMERIC(14,4) NOT NULL,
  UNIQUE (factura_id, insumo_id)
);

CREATE SEQUENCE pagos_folio_seq;

CREATE TABLE pagos_proveedor (
  id                  SERIAL PRIMARY KEY,
  folio               VARCHAR(20) NOT NULL UNIQUE,
  proveedor_id        INTEGER NOT NULL REFERENCES proveedores(id),
  fecha               DATE NOT NULL DEFAULT current_date,
  monto               NUMERIC(14,4) NOT NULL CHECK (monto > 0),
  moneda              VARCHAR(3) NOT NULL DEFAULT 'MXN' CHECK (moneda IN ('MXN','USD')),
  forma_pago          VARCHAR(40) NOT NULL,
  referencia          VARCHAR(100),
  comprobante_url     TEXT,
  usuario_registro_id UUID NOT NULL REFERENCES usuarios(id),
  creado_en           TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE pago_factura (
  pago_id         INTEGER NOT NULL REFERENCES pagos_proveedor(id) ON DELETE CASCADE,
  factura_id      INTEGER NOT NULL REFERENCES facturas(id),
  monto_aplicado  NUMERIC(14,4) NOT NULL CHECK (monto_aplicado > 0),
  PRIMARY KEY (pago_id, factura_id)
);
