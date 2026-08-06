-- Bloque 28: Requisición de Nómina. Segundo tipo de requisición (junto a "materiales"), pensado
-- para el desglose de personal de Mano de Obra por semana/quincena. Diseño acordado con el
-- cliente: cada renglón de la requisición es un rubro de Mano de Obra presupuestado (ej. Peón,
-- Albañil); cada renglón se desglosa en las personas que cobran contra él, con días trabajados x
-- tarifa diaria = monto (nunca se captura el monto directo). El total del renglón es la suma de
-- su propio desglose y es lo que se compara contra el presupuesto — en dinero, no en cantidad.
-- Una misma persona puede aparecer en varios renglones (ej. un contratista que trabajó unos días
-- como peón y otros como albañil) — el cargo cae en los insumos reales, no en uno nuevo inventado.
--
-- Los insumos nuevos de Mano de Obra se pueden dar de alta directamente (sin pasar por el
-- importador de Excel) y arrancan con presupuesto en $0 — por diseño, para que cualquier cargo
-- contra ellos dispare "excede presupuesto" hasta que Dirección autorice un estimado real.

ALTER TABLE requisiciones ADD COLUMN tipo VARCHAR(10) NOT NULL DEFAULT 'materiales' CHECK (tipo IN ('materiales', 'nomina'));

-- Liga el desglose de personal a un renglón específico (requisicion_detalle), no solo a la
-- requisición completa — así una persona puede repartirse entre varios renglones/rubros.
-- Se deja NULLABLE a propósito: el desglose "plano" del Bloque 23 (Personal asignado dentro de
-- una requisición de materiales con Mano de Obra mezclada) sigue funcionando sin cambios,
-- identificable porque requisicion_detalle_id es NULL en esos registros.
ALTER TABLE requisicion_personal ADD COLUMN requisicion_detalle_id INTEGER REFERENCES requisicion_detalle(id) ON DELETE CASCADE;
ALTER TABLE requisicion_personal ADD COLUMN dias_trabajados NUMERIC(5,2);
ALTER TABLE requisicion_personal ADD COLUMN tarifa_diaria NUMERIC(12,2);

CREATE INDEX idx_requisicion_personal_detalle ON requisicion_personal (requisicion_detalle_id);
