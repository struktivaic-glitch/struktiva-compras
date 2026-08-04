# Struktiva · Control de Compras y Requisiciones — Pendientes por generar/entregar

Documento vivo. Lo voy actualizando en cada bloque de trabajo. Aquí quedan **solo** las cosas que
tú tienes que hacer, conseguir o decidir — nada que yo pueda resolver por código.

Proyecto alojado en: `C:\LOCAL\ERP STRUKTIVA\` (carpeta propia, separada de cualquier otro
proyecto).

## Identidad de marca
- [x] **Logotipo real** recibido y conectado (`assets/logo-vertical.png`,
      `assets/logo-horizontal.png`) — usado en `BrandMark.vue` (topbar, login), el lockup
      horizontal en encabezados de reportes impresos, y los íconos de la PWA regenerados desde
      el isotipo real recortado (`frontend/public/brand/isotipo.png`, vía
      `frontend/scripts/preparar-logo-real.mjs` + `generar-iconos.mjs`). El HEX que había
      estimado (`#123B54` / `#48B3AC` / `#E2432F`) resultó casi idéntico al real — no se tocó la
      paleta.
- [ ] Los PNG recibidos tienen buena resolución para pantalla, pero si en algún momento
      necesitas impresión física de gran formato (lonas, señalética de obra), sería mejor tener
      el vectorial original (SVG/AI/EPS) — opcional, no urgente.

## Infraestructura / Hosting
- [x] **Modo de prueba en la nube, gratis, ya en vivo** — mientras decides el VPS, el sistema
      está desplegado y funcionando en:
      🔗 **https://struktiva-frontend.onrender.com**
      Backend en Render (`struktiva-backend`), base de datos real en Neon (Postgres), código
      respaldado en GitHub (`struktiva-compras`, privado). Usuarios demo de siempre, contraseña
      `struktiva123`. Limitaciones a tener en cuenta mientras estén probando: el backend se
      "duerme" tras 15 min sin uso (la primera entrada del día tarda ~30-50s en responder), y los
      archivos subidos (fotos/PDFs de facturas) no persisten de forma confiable en este plan
      gratuito — para eso sí se necesita el VPS o Object Storage real.
- [ ] **VPS con acceso root/SSH** (HostPapa es cPanel, no sirve para este stack) — para cuando
      decidan pasar de "modo de prueba" a operar en serio. Elegir proveedor (recomendé Vultr por
      su región en Ciudad de México — ver `NOTAS.md`) y contratarlo, o darme acceso si ya
      tienes uno pensado.
- [ ] **Acceso al panel de DNS de HostPapa** (para crear el registro A/CNAME del subdominio,
      ej. `compras.struktiva.com.mx`, apuntando al VPS).
- [ ] Confirmar el **subdominio exacto** que quieres usar para el sistema.
- [ ] Cuenta de **Object Storage S3-compatible** (DigitalOcean Spaces, AWS S3, Backblaze B2…)
      para PDFs/XML/fotos — elegir proveedor y generar sus API keys. *(Mientras tanto, XML/PDF de
      facturas se guardan localmente en `backend/uploads/` — funciona para desarrollo, pero en el
      VPS de producción hay que migrar a Object Storage real: es un cambio de una sola función,
      `lib/storage.js`, ya aislada para eso.)*
- [x] ~~SMTP para OTP~~ — decidiste eliminar el OTP por correo del alcance (te quedas con Firma
      Táctil y PIN, ya construidas y probadas). Si algún día lo quieres de vuelta, ahí retomamos
      la necesidad de SMTP.

## Datos operativos
- [x] **Explosión de insumos real**: recibida y el importador ya está construido y probado con
      tu archivo real (`Insumos_e)Listado Insumos (E)_3-8-2026...xlsx`, obra "CCC González
      Ortega", 58 insumos, 3 familias). Pantalla en `/importar-insumos`. Puedes subir ahí
      cualquier export futuro de Neodata con el mismo formato — detecta familias y columnas
      automáticamente.
- [x] ~~Catálogo de usuarios y proveedores iniciales~~ — en vez de pedirte la lista, se construyó
      un módulo real en el sistema (`/usuarios`, solo Dirección/Auditor) donde Dirección da de
      alta usuarios, les asigna rol y puede editarlos/desactivarlos/restablecer su contraseña —
      con la misma jerarquía de permisos del resto del sistema. Igual en Proveedores: Compras y
      Dirección pueden editar en línea (razón social, RFC, crédito, moneda, contacto, activo) sin
      salir de la pantalla. Ya no necesitas mandarme la lista por fuera; se da de alta desde ahí
      directamente.

## Entorno de desarrollo local
- [x] Docker Desktop 4.84.0 instalado (vía `winget`).
- [x] WSL2 instalado (distribución Ubuntu, versión 2 por default).
- [x] Reinicio hecho, Docker corriendo, `docker compose up -d` + migraciones + seed ejecutados.
- [x] Flujo completo probado en vivo en el navegador: login (Residente y Superintendente),
      dashboard con saldos reales, requisición con excedente bloqueada hasta justificar,
      autorización visible solo para roles con permiso, saldo del dashboard actualizándose
      al autorizar. **Bloque 4 verificado de punta a punta con datos reales.**

## Base de datos real (NEO STRUKTIVA)
- [ ] Detecté en `C:\LOCAL\NEO STRUKTIVA\` archivos reales de SQL Server (`.mdf`/`.ldf`) de
      Neodata (`STRUKTIVA Ingeniería y Construcción.mdf`, `Construbase STRUKTIVA.mdf`, backups
      por año, etc.). **No los abrí ni los voy a tocar sin que me lo pidas explícitamente** — son
      datos reales de producción. Si en algún momento quieres que use esa base como fuente real
      de la Explosión de Insumos (en vez de una exportación manual), dime y vemos cómo conectar
      a ella de forma segura (idealmente un export/backup de solo lectura, no la base viva).

---
*Última actualización: Bloque 13 (módulo de Usuarios y edición de Proveedores, con jerarquía de
permisos) — 03/08/2026. Detalle completo de cada bloque en `NOTAS.md`.*
