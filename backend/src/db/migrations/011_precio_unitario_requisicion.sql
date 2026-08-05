-- P.U. capturado en la propia requisición (no solo el del presupuesto) — así el total sugerido
-- de cada renglón (cantidad × P.U.) queda visible y cuadrado desde que se captura, en vez de
-- depender de un cálculo oculto contra el presupuesto. Esto es lo que ahora usa el desglose de
-- Personal asignado (Mano de Obra) para saber cuánto debe sumar el personal, en vez de mezclar
-- cantidad (jornales) con un monto calculado aparte.
ALTER TABLE requisicion_detalle ADD COLUMN precio_unitario NUMERIC(14,4);
