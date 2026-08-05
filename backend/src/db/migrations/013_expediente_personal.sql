-- Bloque HR-A: Expediente de Personal. Amplía el catálogo `trabajadores` (ya usado por el
-- desglose de Mano de Obra en Requisiciones — migración 010) para que sirva como catálogo único
-- de personal, tanto de campo (jornaleros) como administrativo (oficina), y le agrega expediente
-- con documentos. Sigue siendo control interno: salario_referencia es solo para control de gasto
-- interno, no hay cálculo fiscal (ISR/IMSS) ni timbrado — eso vive fuera del sistema, por decisión
-- explícita del cliente.

ALTER TABLE trabajadores ADD COLUMN tipo VARCHAR(20) NOT NULL DEFAULT 'jornalero'; -- 'jornalero' | 'administrativo'
ALTER TABLE trabajadores ADD COLUMN puesto VARCHAR(100);
ALTER TABLE trabajadores ADD COLUMN obra_id INTEGER REFERENCES obras(id); -- obra/frente asignado actualmente (opcional, más útil para jornaleros)
ALTER TABLE trabajadores ADD COLUMN fecha_ingreso DATE;
ALTER TABLE trabajadores ADD COLUMN salario_referencia NUMERIC(12,2);
ALTER TABLE trabajadores ADD COLUMN salario_periodo VARCHAR(10); -- 'diario' | 'mensual'
ALTER TABLE trabajadores ADD COLUMN telefono VARCHAR(30);
ALTER TABLE trabajadores ADD COLUMN curp VARCHAR(18);
ALTER TABLE trabajadores ADD COLUMN rfc VARCHAR(13);
ALTER TABLE trabajadores ADD COLUMN nss VARCHAR(11);
ALTER TABLE trabajadores ADD COLUMN direccion TEXT;
ALTER TABLE trabajadores ADD COLUMN contacto_emergencia_nombre VARCHAR(150);
ALTER TABLE trabajadores ADD COLUMN contacto_emergencia_telefono VARCHAR(30);
ALTER TABLE trabajadores ADD COLUMN notas TEXT;

-- Documentos del expediente (INE, CURP, RFC, NSS, contrato, comprobante de domicilio, etc.).
-- Igual que la selfie de perfil (migración 012): se guarda en la base de datos, no en disco,
-- porque el disco de Render (plan gratis) es efímero. Si el catálogo de personal crece mucho,
-- este es el punto a revisar para migrar a un Object Storage real (ver nota en storage.js).
CREATE TABLE documentos_personal (
  id             SERIAL PRIMARY KEY,
  trabajador_id  INTEGER NOT NULL REFERENCES trabajadores(id) ON DELETE CASCADE,
  tipo_documento VARCHAR(40) NOT NULL,
  nombre_archivo VARCHAR(255) NOT NULL,
  mime           VARCHAR(50) NOT NULL,
  archivo        BYTEA NOT NULL,
  tamano_bytes   INTEGER NOT NULL,
  subido_por     UUID REFERENCES usuarios(id),
  creado_en      TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_documentos_personal_trabajador ON documentos_personal (trabajador_id);
