-- Bloque HR-D: Control interno de pagos, generalizado más allá de una requisición de Mano de
-- Obra (el "Personal asignado" del Bloque 23 solo existía dentro de una requisición puntual).
-- Cierra el plan original de RH. Sigue siendo control interno de gasto — no calcula ISR/IMSS ni
-- genera recibos fiscales; "marcar pagado" solo registra que el pago ya se hizo fuera del
-- sistema, no mueve dinero real.

CREATE TABLE pagos_personal (
  id              SERIAL PRIMARY KEY,
  trabajador_id   INTEGER NOT NULL REFERENCES trabajadores(id),
  fecha_inicio    DATE NOT NULL,
  fecha_fin       DATE NOT NULL,
  concepto        VARCHAR(100) NOT NULL DEFAULT 'Pago de personal',
  dias_trabajados NUMERIC(5,2),
  monto           NUMERIC(12,2) NOT NULL CHECK (monto > 0),
  estatus         VARCHAR(20) NOT NULL DEFAULT 'pendiente' CHECK (estatus IN ('pendiente', 'pagado')),
  fecha_pago      DATE,
  notas           TEXT,
  registrado_por  UUID NOT NULL REFERENCES usuarios(id),
  pagado_por      UUID REFERENCES usuarios(id),
  creado_en       TIMESTAMPTZ NOT NULL DEFAULT now(),
  CHECK (fecha_fin >= fecha_inicio)
);

CREATE INDEX idx_pagos_personal_trabajador ON pagos_personal (trabajador_id);
CREATE INDEX idx_pagos_personal_estatus ON pagos_personal (estatus);
