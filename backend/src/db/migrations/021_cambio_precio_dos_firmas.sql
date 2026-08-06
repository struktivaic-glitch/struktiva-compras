-- Struktiva · Control de Compras y Requisiciones
-- Migración 021 (Bloque 16): candado de "Cambio de precio" en Cotizaciones y Facturas, y
-- autorización por monto en Órdenes de Compra (con excepción de dos firmas).
--
-- Reglas confirmadas por el usuario:
--  - Cambio de precio: 5% de desviación ARRIBA del presupuestado/negociado dispara la alerta y
--    requiere autorización de Dirección antes de comprometer el gasto (cerrar cotización /
--    aplicar un pago a la factura).
--  - Órdenes de Compra < $20,000: Compras las confirma directamente (ya viene respaldada por la
--    autorización de la requisición).
--  - Órdenes de Compra >= $20,000: requieren autorización de Dirección, o como excepción — para
--    cuando Dirección no puede firmar (vacaciones, juntas, viaje sin conexión) — dos firmas de
--    Administrador + Superintendente.

-- Nuevo rol: Administrador — solo se usa, por ahora, como una de las dos firmas de la excepción
-- de autorización de Órdenes de Compra grandes.
INSERT INTO roles (clave, nombre) VALUES ('administrador', 'Administrador');

-- Cotizaciones: variación de precio del ganador vs. presupuestado.
ALTER TABLE procesos_cotizacion ADD COLUMN variacion_precio_autorizada BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE procesos_cotizacion ADD COLUMN variacion_precio_autorizada_por UUID REFERENCES usuarios(id);
ALTER TABLE procesos_cotizacion ADD COLUMN variacion_precio_autorizada_en TIMESTAMPTZ;

-- Facturas: variación de precio facturado vs. lo negociado en la Orden de Compra.
ALTER TABLE facturas ADD COLUMN variacion_precio_autorizada BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE facturas ADD COLUMN variacion_precio_autorizada_por UUID REFERENCES usuarios(id);
ALTER TABLE facturas ADD COLUMN variacion_precio_autorizada_en TIMESTAMPTZ;
