-- La cancelación de una requisición no dejaba rastro de quién, cuándo ni por qué — solo cambiaba
-- el estatus. Se agrega para que la impresión pueda mostrarlo (igual que ya se muestra quién
-- autorizó), y como parte de la trazabilidad general del documento.
ALTER TABLE requisiciones ADD COLUMN cancelado_por UUID REFERENCES usuarios(id);
ALTER TABLE requisiciones ADD COLUMN fecha_cancelacion TIMESTAMPTZ;
ALTER TABLE requisiciones ADD COLUMN motivo_cancelacion TEXT;
