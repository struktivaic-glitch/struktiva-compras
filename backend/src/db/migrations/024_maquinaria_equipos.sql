-- Struktiva · Control de Compras y Requisiciones
-- Migración 024 (Bloque 31): Control de Maquinaria y Equipos — catálogo, expediente (documentos)
-- y bitácora de mantenimiento. Para equipo RENTADO, decisión explícita del usuario: aquí solo se
-- controlan fechas de vigencia de la renta + bitácora + documentación — el COSTO de la renta no
-- se registra en este módulo, sigue su camino normal por Requisición/Cotización/OC/Factura como
-- cualquier otro gasto, para no duplicar el control financiero.

CREATE TABLE equipos (
  id                       SERIAL PRIMARY KEY,
  clave                    VARCHAR(30) NOT NULL UNIQUE,
  descripcion              VARCHAR(250) NOT NULL,
  tipo                     VARCHAR(100),
  marca                    VARCHAR(100),
  modelo                   VARCHAR(100),
  numero_serie             VARCHAR(100),
  modalidad                VARCHAR(20) NOT NULL DEFAULT 'propio' CHECK (modalidad IN ('propio', 'rentado')),
  obra_id                  INTEGER REFERENCES obras(id),
  estatus                  VARCHAR(20) NOT NULL DEFAULT 'activo' CHECK (estatus IN ('activo', 'mantenimiento', 'baja')),
  -- Solo aplica/se captura cuando modalidad = 'rentado':
  proveedor_renta          VARCHAR(200),
  fecha_inicio_renta       DATE,
  fecha_vencimiento_renta  DATE,
  notas                    TEXT,
  creado_en                TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE documentos_equipo (
  id                 SERIAL PRIMARY KEY,
  equipo_id          INTEGER NOT NULL REFERENCES equipos(id) ON DELETE CASCADE,
  tipo_documento     VARCHAR(100) NOT NULL,
  nombre_archivo     VARCHAR(250),
  mime               VARCHAR(50) NOT NULL,
  archivo            BYTEA NOT NULL,
  tamano_bytes       INTEGER NOT NULL,
  fecha_vencimiento  DATE,
  subido_por         UUID NOT NULL REFERENCES usuarios(id),
  creado_en          TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_documentos_equipo_equipo ON documentos_equipo (equipo_id);

CREATE TABLE bitacora_mantenimiento (
  id                    SERIAL PRIMARY KEY,
  equipo_id             INTEGER NOT NULL REFERENCES equipos(id) ON DELETE CASCADE,
  tipo                  VARCHAR(20) NOT NULL CHECK (tipo IN ('preventivo', 'correctivo')),
  fecha                 DATE NOT NULL DEFAULT current_date,
  horometro_km          NUMERIC(12,2),
  descripcion           TEXT NOT NULL,
  costo                 NUMERIC(12,2),
  taller_proveedor      VARCHAR(200),
  proximo_mantenimiento DATE,
  registrado_por        UUID NOT NULL REFERENCES usuarios(id),
  creado_en             TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_bitacora_mantenimiento_equipo ON bitacora_mantenimiento (equipo_id);
