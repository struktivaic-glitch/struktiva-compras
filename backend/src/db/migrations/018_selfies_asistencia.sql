-- Bloque HR-F: Selfie opcional al marcar asistencia — refuerza la evidencia de que la marca
-- corresponde a la persona real, ya que hoy es el supervisor quien marca a nombre del
-- trabajador (los trabajadores no tienen cuenta propia). No es biometría (no hay matching
-- automático de identidad) — es evidencia fotográfica revisable manualmente si hay una disputa.
-- Guardada en la base de datos (mismo patrón que la selfie de perfil, migración 012), comprimida
-- del lado del cliente. Es opcional/best-effort, igual que el GPS — nunca bloquea la marca del
-- horario, que es lo legalmente crítico (Art. 132 Fracc. XXXIV LFT).

ALTER TABLE asistencias ADD COLUMN foto_entrada BYTEA;
ALTER TABLE asistencias ADD COLUMN foto_entrada_mime VARCHAR(50);
ALTER TABLE asistencias ADD COLUMN foto_salida BYTEA;
ALTER TABLE asistencias ADD COLUMN foto_salida_mime VARCHAR(50);
ALTER TABLE asistencias ADD COLUMN foto_inicio_comida BYTEA;
ALTER TABLE asistencias ADD COLUMN foto_inicio_comida_mime VARCHAR(50);
ALTER TABLE asistencias ADD COLUMN foto_fin_comida BYTEA;
ALTER TABLE asistencias ADD COLUMN foto_fin_comida_mime VARCHAR(50);
