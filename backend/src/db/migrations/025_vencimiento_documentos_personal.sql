-- Struktiva · Control de Compras y Requisiciones
-- Migración 025 (Bloque 32): Seguridad e Higiene — extensión ligera del Expediente de Personal
-- en vez de un módulo aparte (decisión del usuario). Certificaciones y DC-3 caben en los
-- documentos del expediente que ya existían; solo hacía falta poder capturarles una fecha de
-- vigencia para poder avisar cuando están por vencer — mismo patrón ya usado en
-- documentos_equipo (Bloque 31).

ALTER TABLE documentos_personal ADD COLUMN fecha_vencimiento DATE;
