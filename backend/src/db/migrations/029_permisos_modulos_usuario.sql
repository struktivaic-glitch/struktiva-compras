-- Struktiva · Control de Compras y Requisiciones
-- Migración 029: checklist de módulos visibles por usuario — pedido del usuario (07/08/2026,
-- retomando el tema que se dejó pendiente de platicar en el Bloque 33).
--
-- Alcance decidido: esto controla QUÉ PANTALLAS VE cada usuario en el menú y al navegar
-- directamente a una URL (visibilidad de navegación) — NO reemplaza ni afloja los candados de
-- autorización que ya existen por rol (firmas, montos de OC, quién puede editar/crear en cada
-- módulo), que siguen exactamente igual que antes. Los roles (`roles`, tabla ya existente) siguen
-- siendo la base de "qué puede AUTORIZAR/MODIFICAR"; este catálogo nuevo es "qué puede VER" y es
-- independiente, por persona. "Usuarios" (`/usuarios`) queda fuera de este checklist a propósito
-- — sigue gobernado solo por rol (direccion/auditor) para no arriesgar que alguien se quite a sí
-- mismo (o al único administrador) el acceso a la pantalla que arregla los permisos.
--
-- Cada fila = "este usuario puede ver este módulo". La clave del módulo es la misma ruta del
-- menú (ej. '/requisiciones', '/almacen/entradas') — no se creó un catálogo aparte de claves
-- abstractas porque el menú (`frontend/src/lib/modulosNav.js`) ya es la lista canónica y así no
-- hay dos listas que se puedan desincronizar.
CREATE TABLE usuario_modulos (
  usuario_id    UUID NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
  modulo_clave  VARCHAR(60) NOT NULL,
  PRIMARY KEY (usuario_id, modulo_clave)
);

-- Todos los usuarios existentes arrancan con acceso a todos los módulos (mismo comportamiento
-- que tenían hasta hoy — nadie pierde acceso de golpe con esta migración). Dirección ajusta
-- desde /usuarios a partir de ahora.
INSERT INTO usuario_modulos (usuario_id, modulo_clave)
SELECT u.id, m.clave
FROM usuarios u
CROSS JOIN (VALUES
  ('/'), ('/requisiciones'), ('/cotizaciones'), ('/proveedores'), ('/ordenes-compra'),
  ('/importar-insumos'), ('/reportes'), ('/destajos'),
  ('/importar-presupuesto-general'), ('/avance-obra'), ('/reportes/avance-financiero'),
  ('/almacen/entradas'), ('/almacen/salidas'), ('/almacen/inventario'), ('/facturas'),
  ('/pagos'), ('/equipos'),
  ('/trabajadores'), ('/asistencia'), ('/incidencias'), ('/pagos-personal'), ('/destajistas')
) AS m(clave);
