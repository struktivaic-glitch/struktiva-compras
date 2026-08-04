-- Struktiva · Control de Compras y Requisiciones
-- Migración 004 (Bloque 6): Entradas y Salidas de Almacén.
-- Cierra la cadena: Requisición -> Cotización -> OC -> Entrada -> Salida.

CREATE SEQUENCE entradas_folio_seq;

CREATE TABLE entradas_almacen (
  id                  SERIAL PRIMARY KEY,
  folio               VARCHAR(20) NOT NULL UNIQUE,
  oc_id               INTEGER NOT NULL REFERENCES ordenes_compra(id),
  remision_proveedor  VARCHAR(60) NOT NULL,
  fecha               DATE NOT NULL DEFAULT current_date,
  usuario_recibio_id  UUID NOT NULL REFERENCES usuarios(id),
  creado_en           TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE entrada_detalle (
  id                  SERIAL PRIMARY KEY,
  entrada_id          INTEGER NOT NULL REFERENCES entradas_almacen(id) ON DELETE CASCADE,
  insumo_id           INTEGER NOT NULL REFERENCES insumos(id),
  cantidad_recibida   NUMERIC(14,4) NOT NULL CHECK (cantidad_recibida > 0),
  cantidad_excedente  NUMERIC(14,4) NOT NULL DEFAULT 0,
  autorizado_por      UUID REFERENCES usuarios(id),
  UNIQUE (entrada_id, insumo_id)
);

CREATE SEQUENCE salidas_folio_seq;

CREATE TABLE salidas_almacen (
  id                    SERIAL PRIMARY KEY,
  folio                 VARCHAR(20) NOT NULL UNIQUE,
  obra_id               INTEGER NOT NULL REFERENCES obras(id),
  frente_id             INTEGER NOT NULL REFERENCES frentes(id),
  usuario_entrega_id    UUID NOT NULL REFERENCES usuarios(id),
  usuario_recibe_nombre VARCHAR(150) NOT NULL,
  fecha                 DATE NOT NULL DEFAULT current_date,
  creado_en             TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE salida_detalle (
  id                  SERIAL PRIMARY KEY,
  salida_id           INTEGER NOT NULL REFERENCES salidas_almacen(id) ON DELETE CASCADE,
  insumo_id           INTEGER NOT NULL REFERENCES insumos(id),
  cantidad_entregada  NUMERIC(14,4) NOT NULL CHECK (cantidad_entregada > 0),
  UNIQUE (salida_id, insumo_id)
);

-- Existencia actual por Obra x Insumo = Σ Entradas (vía OC->Cotización->Obra) − Σ Salidas.
CREATE VIEW vw_existencia_obra_insumo AS
SELECT obra_id, insumo_id, SUM(entradas) AS entradas, SUM(salidas) AS salidas, SUM(entradas) - SUM(salidas) AS existencia
FROM (
  SELECT pc.obra_id, ed.insumo_id, SUM(ed.cantidad_recibida) AS entradas, 0 AS salidas
  FROM entrada_detalle ed
  JOIN entradas_almacen ea ON ea.id = ed.entrada_id
  JOIN ordenes_compra oc ON oc.id = ea.oc_id
  JOIN procesos_cotizacion pc ON pc.id = oc.proceso_cotizacion_id
  GROUP BY pc.obra_id, ed.insumo_id

  UNION ALL

  SELECT sa.obra_id, sd.insumo_id, 0 AS entradas, SUM(sd.cantidad_entregada) AS salidas
  FROM salida_detalle sd
  JOIN salidas_almacen sa ON sa.id = sd.salida_id
  GROUP BY sa.obra_id, sd.insumo_id
) mov
GROUP BY obra_id, insumo_id;
