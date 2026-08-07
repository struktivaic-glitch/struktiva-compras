-- Struktiva · Control de Compras y Requisiciones
-- Migración 028: formas de pago fijas — pedido del usuario (07/08/2026). Catálogo cerrado:
-- efectivo, transferencia, tarjeta de débito, tarjeta de crédito.
--
-- pagos_proveedor.forma_pago ya existía como texto libre (VARCHAR(40), sin CHECK, capturado a
-- mano por cada usuario — "Transferencia", "transferencia bancaria", "Efectivo", "Cheque"…). Antes
-- de amarrar el CHECK hay que normalizar lo que ya esté capturado, si algo hay, para no dejar
-- filas inválidas que rompan la migración. "Cheque" y cualquier otro valor no reconocido se
-- normaliza a 'transferencia' (el equivalente institucional más cercano que sigue existiendo en
-- el catálogo cerrado).
UPDATE pagos_proveedor SET forma_pago = 'transferencia' WHERE forma_pago ILIKE '%transf%' OR forma_pago ILIKE '%spei%' OR forma_pago ILIKE '%cheque%';
UPDATE pagos_proveedor SET forma_pago = 'efectivo' WHERE forma_pago ILIKE '%efect%' OR forma_pago ILIKE '%cash%';
UPDATE pagos_proveedor SET forma_pago = 'tarjeta_credito' WHERE forma_pago ILIKE '%cr%dito%' OR forma_pago ILIKE '%credit%';
UPDATE pagos_proveedor SET forma_pago = 'tarjeta_debito' WHERE forma_pago ILIKE '%d%bito%' OR forma_pago ILIKE '%debit%';
UPDATE pagos_proveedor SET forma_pago = 'transferencia' WHERE forma_pago NOT IN ('efectivo', 'transferencia', 'tarjeta_debito', 'tarjeta_credito');

ALTER TABLE pagos_proveedor ADD CONSTRAINT chk_pagos_proveedor_forma_pago
  CHECK (forma_pago IN ('efectivo', 'transferencia', 'tarjeta_debito', 'tarjeta_credito'));

-- pagos_personal no tenía ningún campo de forma de pago — se agrega, opcional en la captura
-- inicial (el registro nace "pendiente") y se vuelve el campo natural a llenar al marcar el pago
-- como efectivamente realizado (mismo momento en que hoy se captura fecha_pago).
ALTER TABLE pagos_personal ADD COLUMN forma_pago VARCHAR(20)
  CHECK (forma_pago IN ('efectivo', 'transferencia', 'tarjeta_debito', 'tarjeta_credito'));
