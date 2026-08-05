-- Desglose de personal para requisiciones de Mano de Obra — solo control interno de gasto,
-- nunca temas fiscales/nómina real (eso vive fuera del sistema).

-- Bandera explícita en vez de comparar el nombre de la familia por texto (los nombres vienen
-- libres de cada exportación de Neodata y pueden variar: "Mano de Obra", "MANO DE OBRA", etc.).
ALTER TABLE familias_insumo ADD COLUMN es_mano_de_obra BOOLEAN NOT NULL DEFAULT false;
UPDATE familias_insumo SET es_mano_de_obra = true WHERE nombre ILIKE '%mano de obra%';

-- Catálogo reutilizable de trabajadores (no son usuarios del sistema, son personal de campo).
CREATE TABLE trabajadores (
  id         SERIAL PRIMARY KEY,
  nombre     VARCHAR(150) NOT NULL,
  oficio     VARCHAR(80),
  activo     BOOLEAN NOT NULL DEFAULT true,
  creado_en  TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Desglose de a quién se le paga qué, dentro de una requisición. Sección aparte (no ligada a
-- un renglón de insumo específico) pero su suma se valida contra el total de Mano de Obra
-- de esa requisición al guardar.
CREATE TABLE requisicion_personal (
  id              SERIAL PRIMARY KEY,
  requisicion_id  INTEGER NOT NULL REFERENCES requisiciones(id) ON DELETE CASCADE,
  trabajador_id   INTEGER NOT NULL REFERENCES trabajadores(id),
  monto           NUMERIC(14,2) NOT NULL CHECK (monto > 0),
  creado_en       TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_requisicion_personal_requisicion ON requisicion_personal (requisicion_id);

-- Obra demo "Horizontes": agrega la familia Mano de Obra con un insumo de ejemplo, para que
-- la funcionalidad se pueda probar de inmediato sin esperar a un import real.
INSERT INTO familias_insumo (nombre, tolerancia_recepcion_pct, es_mano_de_obra)
VALUES ('Mano de Obra', 0, true)
ON CONFLICT (nombre) DO UPDATE SET es_mano_de_obra = true;

INSERT INTO insumos (clave, descripcion, unidad, familia_id)
SELECT 'MO-001', 'Peón', 'Jornal', id FROM familias_insumo WHERE nombre = 'Mano de Obra'
ON CONFLICT (clave) DO NOTHING;

INSERT INTO presupuesto_obra_insumo (obra_id, insumo_id, cantidad_presupuestada, costo_unitario, moneda)
SELECT o.id, i.id, 200, 350.00, 'MXN'
FROM obras o, insumos i
WHERE o.nombre = 'Horizontes' AND i.clave = 'MO-001'
ON CONFLICT (obra_id, insumo_id) DO NOTHING;
