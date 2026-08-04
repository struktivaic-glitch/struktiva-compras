-- Struktiva · Control de Compras y Requisiciones
-- Migración 007: el control de presupuesto por insumo pasa de Partida a Obra completa.
-- Motivo: el export real de Neodata ("Listado de Insumos que interviene en la integración de
-- la propuesta") es una lista plana a nivel Obra/Concurso, sin desglose por partida — así es
-- como el cliente controla su presupuesto realmente. Partida/Frente se conserva como la
-- etiqueta de "a dónde va" el material en la requisición, pero deja de ser el límite de saldo.

CREATE TABLE presupuesto_obra_insumo (
  id                     SERIAL PRIMARY KEY,
  obra_id                INTEGER NOT NULL REFERENCES obras(id) ON DELETE CASCADE,
  insumo_id              INTEGER NOT NULL REFERENCES insumos(id),
  cantidad_presupuestada NUMERIC(14,4) NOT NULL,
  costo_unitario         NUMERIC(14,4) NOT NULL,
  moneda                 VARCHAR(3) NOT NULL DEFAULT 'MXN' CHECK (moneda IN ('MXN','USD')),
  UNIQUE (obra_id, insumo_id)
);

-- Migra los datos demo existentes: agrega cantidades por Obra x Insumo (promedio ponderado del
-- costo unitario, por si el mismo insumo aparecía en más de una partida con precios distintos).
INSERT INTO presupuesto_obra_insumo (obra_id, insumo_id, cantidad_presupuestada, costo_unitario, moneda)
SELECT e.obra_id, ppi.insumo_id,
       SUM(ppi.cantidad_presupuestada) AS cantidad_presupuestada,
       SUM(ppi.cantidad_presupuestada * ppi.costo_unitario) / NULLIF(SUM(ppi.cantidad_presupuestada), 0) AS costo_unitario,
       MIN(ppi.moneda) AS moneda
FROM presupuesto_partida_insumo ppi
JOIN partidas p ON p.id = ppi.partida_id
JOIN frentes f ON f.id = p.frente_id
JOIN etapas e ON e.id = f.etapa_id
GROUP BY e.obra_id, ppi.insumo_id;

DROP VIEW vw_saldo_partida_insumo;
DROP TABLE presupuesto_partida_insumo;

-- Saldo disponible por Obra x Insumo: Cant. Presupuestada − Σ(Cant. Requerida Aprobada).
CREATE VIEW vw_saldo_obra_insumo AS
SELECT
  poi.obra_id,
  poi.insumo_id,
  poi.cantidad_presupuestada,
  poi.costo_unitario,
  poi.moneda,
  COALESCE(SUM(rd.cantidad_aprobada) FILTER (
    WHERE r.estatus IN ('autorizada','atendida_parcial','atendida_total')
  ), 0) AS cantidad_aprobada_acumulada,
  poi.cantidad_presupuestada - COALESCE(SUM(rd.cantidad_aprobada) FILTER (
    WHERE r.estatus IN ('autorizada','atendida_parcial','atendida_total')
  ), 0) AS saldo_disponible
FROM presupuesto_obra_insumo poi
LEFT JOIN requisicion_detalle rd ON rd.insumo_id = poi.insumo_id
LEFT JOIN requisiciones r ON r.id = rd.requisicion_id AND r.obra_id = poi.obra_id
GROUP BY poi.obra_id, poi.insumo_id, poi.cantidad_presupuestada, poi.costo_unitario, poi.moneda;
