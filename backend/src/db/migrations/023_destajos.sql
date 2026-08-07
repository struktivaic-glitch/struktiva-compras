-- Struktiva · Control de Compras y Requisiciones
-- Migración 023 (Bloque 30): Destajos. Catálogo de destajistas SEPARADO del catálogo de
-- trabajadores (decisión explícita del usuario, para no mezclar personal de jornal/nómina con
-- contratistas a destajo). Un Destajo liga un destajista a un concepto del presupuesto general
-- (conceptos_obra, Bloque 29) con un precio de destajo propio — normalmente distinto del P.U.
-- general del concepto, porque el destajo cubre solo mano de obra + materiales inherentes a la
-- actividad (ej. cimbra), nunca los materiales que la empresa suministra aparte (concreto,
-- varilla, alambre). El monto ganado se calcula del MISMO avance físico confirmado ya capturado
-- en Bloque 29 — no se vuelve a medir ni capturar por separado.

CREATE TABLE destajistas (
  id            SERIAL PRIMARY KEY,
  nombre        VARCHAR(150) NOT NULL,
  telefono      VARCHAR(30),
  especialidad  VARCHAR(100),
  activo        BOOLEAN NOT NULL DEFAULT true,
  notas         TEXT,
  creado_en     TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE destajos (
  id              SERIAL PRIMARY KEY,
  destajista_id   INTEGER NOT NULL REFERENCES destajistas(id),
  concepto_id     INTEGER NOT NULL REFERENCES conceptos_obra(id),
  precio_destajo  NUMERIC(14,4) NOT NULL CHECK (precio_destajo > 0),
  notas           TEXT,
  estatus         VARCHAR(20) NOT NULL DEFAULT 'activo' CHECK (estatus IN ('activo', 'liquidado', 'cancelado')),
  creado_por      UUID NOT NULL REFERENCES usuarios(id),
  creado_en       TIMESTAMPTZ NOT NULL DEFAULT now(),
  cerrado_en      TIMESTAMPTZ
);

-- Un concepto solo puede tener un destajo activo a la vez (evita ambigüedad de a quién
-- corresponde el avance físico compartido). Si cambia el destajista, primero se cancela/liquida
-- el anterior.
CREATE UNIQUE INDEX idx_destajo_concepto_activo ON destajos (concepto_id) WHERE estatus = 'activo';

CREATE TABLE destajo_pago (
  id              SERIAL PRIMARY KEY,
  destajo_id      INTEGER NOT NULL REFERENCES destajos(id),
  fecha           DATE NOT NULL DEFAULT current_date,
  monto           NUMERIC(14,2) NOT NULL CHECK (monto > 0),
  notas           TEXT,
  registrado_por  UUID NOT NULL REFERENCES usuarios(id),
  creado_en       TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_destajo_pago_destajo ON destajo_pago (destajo_id);
