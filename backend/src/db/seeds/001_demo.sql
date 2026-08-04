-- Datos de arranque para desarrollo/demo — misma obra usada en los wireframes.

INSERT INTO obras (nombre, ubicacion, cliente) VALUES
  ('Horizontes', 'Querétaro, Qro.', 'Grupo Inmobiliario Horizontes');

INSERT INTO etapas (obra_id, nombre, orden) VALUES
  ((SELECT id FROM obras WHERE nombre = 'Horizontes'), 'Etapa 3', 3);

INSERT INTO frentes (etapa_id, nombre, orden) VALUES
  ((SELECT id FROM etapas WHERE nombre = 'Etapa 3'), 'Drenajes', 1);

INSERT INTO familias_insumo (nombre, tolerancia_recepcion_pct) VALUES
  ('Tuberías y conexiones', 0),
  ('Cementantes', 2),
  ('Pétreos', 5),
  ('Fundición y herrería', 0);

INSERT INTO insumos (clave, descripcion, unidad, familia_id) VALUES
  ('TUB-006', 'Tubo PVC sanitario 6"', 'ML', (SELECT id FROM familias_insumo WHERE nombre = 'Tuberías y conexiones')),
  ('CEM-050', 'Cemento gris 50kg', 'PZA', (SELECT id FROM familias_insumo WHERE nombre = 'Cementantes')),
  ('GRA-034', 'Grava 3/4"', 'M3', (SELECT id FROM familias_insumo WHERE nombre = 'Pétreos')),
  ('REJ-018', 'Rejilla pluvial fundición 40x40', 'PZA', (SELECT id FROM familias_insumo WHERE nombre = 'Fundición y herrería'));

INSERT INTO partidas (frente_id, clave, nombre, tolerancia_recepcion_pct) VALUES
  ((SELECT id FROM frentes WHERE nombre = 'Drenajes'), 'DRN-01', 'Tubería sanitaria PVC', NULL),
  ((SELECT id FROM frentes WHERE nombre = 'Drenajes'), 'DRN-02', 'Rejillas y coladeras pluviales', NULL);

INSERT INTO presupuesto_obra_insumo (obra_id, insumo_id, cantidad_presupuestada, costo_unitario, moneda) VALUES
  ((SELECT id FROM obras WHERE nombre = 'Horizontes'), (SELECT id FROM insumos WHERE clave = 'TUB-006'), 1200, 405.00, 'MXN'),
  ((SELECT id FROM obras WHERE nombre = 'Horizontes'), (SELECT id FROM insumos WHERE clave = 'CEM-050'), 850, 245.00, 'MXN'),
  ((SELECT id FROM obras WHERE nombre = 'Horizontes'), (SELECT id FROM insumos WHERE clave = 'GRA-034'), 180, 620.00, 'MXN'),
  ((SELECT id FROM obras WHERE nombre = 'Horizontes'), (SELECT id FROM insumos WHERE clave = 'REJ-018'), 120, 1187.75, 'MXN');

-- Usuarios demo — password para todos: "struktiva123" (bcrypt hash, cambiar en producción)
INSERT INTO usuarios (nombre, email, password_hash, rol_id) VALUES
  ('J. Ramírez',        'residente@struktiva.com.mx',       '$2a$10$opNiOW6YGjLZQzS1SQ3mf.glun4m/.EmB10WnSlkI73uKzmPfaNUu', (SELECT id FROM roles WHERE clave = 'residente')),
  ('Ing. R. Olivares',  'superintendente@struktiva.com.mx', '$2a$10$opNiOW6YGjLZQzS1SQ3mf.glun4m/.EmB10WnSlkI73uKzmPfaNUu', (SELECT id FROM roles WHERE clave = 'superintendente')),
  ('Compras',           'compras@struktiva.com.mx',         '$2a$10$opNiOW6YGjLZQzS1SQ3mf.glun4m/.EmB10WnSlkI73uKzmPfaNUu', (SELECT id FROM roles WHERE clave = 'comprador')),
  ('Almacén Obra',      'almacen@struktiva.com.mx',          '$2a$10$opNiOW6YGjLZQzS1SQ3mf.glun4m/.EmB10WnSlkI73uKzmPfaNUu', (SELECT id FROM roles WHERE clave = 'almacenista')),
  ('Dirección',         'direccion@struktiva.com.mx',        '$2a$10$opNiOW6YGjLZQzS1SQ3mf.glun4m/.EmB10WnSlkI73uKzmPfaNUu', (SELECT id FROM roles WHERE clave = 'direccion')),
  ('Auditoría',         'auditor@struktiva.com.mx',          '$2a$10$opNiOW6YGjLZQzS1SQ3mf.glun4m/.EmB10WnSlkI73uKzmPfaNUu', (SELECT id FROM roles WHERE clave = 'auditor'));
