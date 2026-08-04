-- La acción 'generar_desde_cotizacion' (24 caracteres) excedía VARCHAR(20).
ALTER TABLE bitacora_auditoria ALTER COLUMN accion TYPE VARCHAR(40);
