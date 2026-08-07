-- Struktiva · Control de Compras y Requisiciones
-- Migración 027: relación explícita Factura ↔ Entrada de Almacén — pedido del usuario
-- (07/08/2026). Hoy factura y entrada solo comparten la misma OC de forma indirecta
-- (facturas.oc_id, entradas_almacen.oc_id) — no hay forma de saber en el sistema "esta factura
-- corresponde a cuál remisión recibida". Muchos-a-muchos desde el inicio porque una factura
-- puede cubrir más de una remisión (entrada) de la misma OC, y viceversa (una entrada grande
-- facturada en dos partes). No reemplaza el three-way matching existente (Bloque 7, que sigue
-- comparando factura vs. OC) — es información adicional de trazabilidad, opcional en captura.

CREATE TABLE factura_entrada (
  factura_id  INTEGER NOT NULL REFERENCES facturas(id) ON DELETE CASCADE,
  entrada_id  INTEGER NOT NULL REFERENCES entradas_almacen(id),
  PRIMARY KEY (factura_id, entrada_id)
);
CREATE INDEX idx_factura_entrada_entrada ON factura_entrada (entrada_id);
