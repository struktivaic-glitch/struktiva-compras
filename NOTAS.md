# Struktiva · Notas del proyecto

Documento vivo de notas operativas del proyecto (credenciales de desarrollo, decisiones rápidas,
cosas que no ameritan su propio documento). Para pendientes que requieren acción tuya, ver
`PENDIENTES-STRUKTIVA.md`. Para cómo correr el sistema, ver `README.md`.

## Usuarios demo (solo entorno de desarrollo local)

Creados por el seed (`backend/src/db/seeds/001_demo.sql`). Contraseña igual para todos:
**`struktiva123`**

| Correo                              | Rol              | Puede autorizar requisiciones |
|--------------------------------------|------------------|:---:|
| residente@struktiva.com.mx           | Residente de Obra | No |
| superintendente@struktiva.com.mx     | Superintendente   | Sí |
| direccion@struktiva.com.mx           | Dirección         | Sí |
| compras@struktiva.com.mx             | Comprador/Compras | No |
| almacen@struktiva.com.mx             | Almacenista       | No |
| auditor@struktiva.com.mx             | Auditor           | No |

Para generar un hash nuevo (ej. al preparar datos reales para producción):
```bash
cd backend
npm run hash -- "<contraseña nueva>"
```
Reemplaza el valor de `password_hash` en la tabla `usuarios` con el resultado.

⚠️ Estas credenciales son solo para desarrollo/demo. Antes de usar el sistema con datos y
usuarios reales, Dirección puede dar de alta a cada persona real desde `/usuarios` (con su
propia contraseña) y desactivar o eliminar el acceso de estas cuentas demo — ver Bloque 13 más
abajo.

## Cómo entrar

```bash
docker compose up -d      # Postgres + Redis
cd backend && npm run dev # http://localhost:4000
cd frontend && npm run dev # http://localhost:5173
```

## Temas abiertos de diseño (pendientes de definir en un futuro bloque)

- **Traslado de inventario entre obras.** Hoy el inventario (`vw_existencia_obra_insumo`) está
  aislado por obra: una salida solo puede ir a un frente de la misma obra donde entró el
  material, y no hay forma de mover un saldo sobrante de Almacén de la Obra A hacia la Obra B.
  Falta decidir: ¿se modela como una "Salida" en la obra origen + una "Entrada" especial en la
  obra destino (sin OC/proveedor de por medio)? ¿Necesita folio y documento propio
  (`TRASLADO-YYYY-NNNN`)? ¿Quién autoriza el traslado (Superintendente de la obra que lo
  recibe, Dirección)? ¿Se re-valúa el costo del insumo en la obra destino o viaja con el mismo
  costo unitario original? Esto afecta directamente el reporte de "Inventario actual" y el de
  "Explosión vs. Real" de ambas obras. Retomar antes de dar por cerrado el módulo de Almacén.

## Bitácora de bloques

- **Bloque 12** (03/08/2026): rediseño del control de presupuesto — de Partida a Obra completa,
  y construcción del importador real de la Explosión de Insumos de Neodata. Motivado por un
  archivo real que el cliente compartió (`assets` de referencia:
  `Insumos_e)Listado Insumos (E)_...xlsx`, Concurso 70230, obra "CCC González Ortega" para
  POWERTECNO ENERGIA MEXICANA): el export real de Neodata es una lista plana a nivel Obra, sin
  desglose por partida, con familias dinámicas (Materiales/Mano de Obra/Equipo y Herramienta en
  este ejemplo, pueden ser hasta ~10 según el cliente).
  - Migración 007: `presupuesto_partida_insumo` → `presupuesto_obra_insumo`. Partida/Frente
    siguen existiendo como etiqueta descriptiva de la requisición, pero ya no acotan el saldo.
  - **Bug real encontrado y corregido**: la librería `exceljs` truena ("Invalid row number in
    model") con los exports reales de Neodata porque sus filas/celdas no traen el atributo
    `r=` (índice) — válido según el estándar OOXML, pero mal soportado por esa librería. Se
    construyó un lector propio (`lib/xlsxReader.js`, con `yauzl` + `fast-xml-parser`, ambas sin
    vulnerabilidades conocidas) que no depende de ese atributo. También se descartó `xlsx`
    (SheetJS) desde el inicio por una vulnerabilidad alta sin parche en npm.
  - Importador (`/api/importaciones/explosion-insumos`): detecta encabezados por alias
    (Código/Clave, Concepto/Descripción...), agrupa por familia (detecta encabezados de familia
    y descarta filas "TOTAL ..."), dos pasos (analizar → confirmar) para poder previsualizar
    antes de guardar. Da de alta familias/insumos nuevos automáticamente.
  - Nuevo endpoint `POST /api/obras` para alta de obra (con Etapa/Frente/Partida inicial).
  - Dashboard rediseñado: selector de obra + "Saldos por familia" (antes "por partida").
  - **Probado con el archivo real completo**: 58 insumos importados a la obra real "CCC
    González Ortega" ($10,742,301 presupuestado total), los importes por familia coinciden con
    los subtotales del propio archivo de Neodata casi exacto (ej. Mano de Obra:
    $7,797,723.98 calculado vs $7,797,723.99 real). Se creó y guardó una requisición real
    (REQ-2026-0006) contra ese presupuesto real desde el navegador. Sin regresión en Horizontes.

- **Bloque 4** (02/08/2026): scaffolding del monorepo + módulo de Requisiciones completo
  (captura, validación de excedente con justificación obligatoria, ciclo de estados, roles,
  bitácora de auditoría). Probado de punta a punta en el navegador contra Postgres real.
- **Bloque 5** (02/08/2026): Proveedores, Cuadro Comparativo de Cotizaciones y Órdenes de Compra.
  Flujo completo: Requisición autorizada → se agrupa en un proceso de cotización → se capturan
  precios de 2+ proveedores → se marca ganador por insumo → se cierra → se genera 1 OC por
  proveedor ganador (cantidad y precio correctos, ligada a su(s) requisición(es) origen) → se
  confirma. Acciones de compra (agregar cotización, marcar ganador, cerrar, generar OC,
  confirmar) restringidas por rol a Comprador/Dirección; el resto de roles solo puede ver.
  Probado de punta a punta en el navegador (folio OC-2026-0003, $74,400.00 MXN).
- **Bloque 6** (02/08/2026): Entradas y Salidas de Almacén. Entrada amarrada a folio de OC
  confirmada, con control de tolerancia por familia de insumo (bloquea si excede, exige
  autorización de Superintendente/Dirección para pasar). Al recibir, actualiza automáticamente
  `oc_detalle.cantidad_surtida` y el estatus de la(s) requisición(es) origen a
  Atendida Parcial/Total. Salida de almacén valida existencia disponible antes de entregar a
  un frente. Vista de Inventario actual (Entradas − Salidas) por obra. Probado de punta a punta:
  bloqueo por tolerancia 0% (rol sin permiso ve mensaje, no puede forzar), entrada válida,
  ambas requisiciones (REQ-2026-0001 y REQ-2026-0002) pasaron solas a "Atendida total", salida
  parcial de cemento, inventario final correcto (120 PZA cemento, 150 PZA rejilla).
- **Bloque 7** (02/08/2026): Facturación (coincidencia triple) y Cuentas por Pagar. Factura
  ligada obligatoriamente a una OC, con carga real de XML/PDF (almacenamiento local en
  `backend/uploads/` como stand-in de Object Storage — ver pendiente de migrar a S3 real en
  `PENDIENTES-STRUKTIVA.md`). Validación antifraude: no se puede facturar más de lo físicamente
  recibido por insumo (probado el bloqueo). Pagos a proveedor con aplicación a una o varias
  facturas, abonos parciales, bloqueo de sobre-aplicación sobre el saldo de una factura, estatus
  de factura (pendiente/parcial/total) recalculado automáticamente. Probado de punta a punta en
  el navegador: FAC-2026-0002 ($187,920.00) → pago parcial PAG-2026-0003 ($100,000.00) →
  factura queda "Pagada parcial" con el saldo correcto.
- **Bloque 8** (02/08/2026): pantalla de Expediente (`/expediente/:requisicionId`), la vista
  diseñada en los wireframes del Bloque 3, ahora con datos reales: conecta
  Requisición → Cotización → OC → Entrada → Salida (relacionada por frente+insumo, no hay FK
  directa — ver nota de traslados arriba) → Factura → Pago(s) en una sola vista, cada tarjeta
  enlazando al detalle real de su módulo. Accesible desde el botón "Expediente" en el listado
  de Requisiciones. Probado con REQ-2026-0001 y REQ-2026-0002 (cadenas completas hasta el pago).
- **Bloque 9** (02/08/2026): Reportes imprimibles. Decisión de arquitectura: en vez de generar
  PDF en el servidor (Puppeteer/Chromium — dependencia pesada y otro punto de falla), cada
  reporte es una vista con CSS de impresión (`@media print`, clase `.no-print` oculta
  nav/topbar/filtros) y un botón "Imprimir / Guardar PDF" que usa `window.print()` — el usuario
  imprime o guarda como PDF con el diálogo nativo del navegador. Si más adelante se necesita
  generación automática/programada de PDF (ej. para enviarlos por correo), ahí sí se justifica
  agregar Puppeteer. 6 reportes: Requisiciones, Facturas, Inventario (se reutilizó la vista ya
  existente), Estado de cuenta por proveedor, Explosión vs. Real (2 endpoints nuevos de
  agregación) y Variación de precios. Probados los 6 con datos reales — cifras cruzadas contra
  lo ya verificado en bloques anteriores (ej. Explosión vs. Real: $948,380 presupuestado,
  $251,662.50 requerido — coincide con el Dashboard).
- **Bloque 10** (02/08/2026): Firmas digitales — Táctil (Canvas) y PIN. La acción "Autorizar"
  de una requisición ahora exige firma; queda registrada en tabla `firmas` con usuario, tipo,
  hora exacta, IP, user-agent y GPS opcional (best-effort, no bloquea si el navegador niega el
  permiso). El PIN se configura en `/perfil` (4 dígitos, hasheado con bcrypt, nunca en texto
  plano). El OTP por correo se dejó fuera de este bloque — necesita SMTP, que sigue pendiente
  en `PENDIENTES-STRUKTIVA.md`. **Bug real encontrado y corregido durante la prueba**: el
  interceptor de axios cerraba la sesión completa ante *cualquier* respuesta 401, incluyendo el
  401 que usaba el endpoint de autorizar para "PIN incorrecto" — un error de negocio, no de
  sesión. Se corrigió usando 401 exclusivamente para fallas de autenticación (login, JWT
  inválido) y 422 para "PIN incorrecto" en el resto del código. Probado de punta a punta en el
  navegador: PIN incorrecto ahora solo muestra el error sin desloguear; PIN correcto autoriza
  y la firma queda en bitácora (REQ-2026-0004, IP 127.0.0.1, usuario correcto).
- **Bloque 11** (02/08/2026): PWA — instalable + borradores offline. Íconos generados con
  `sharp` a partir del isotipo (`frontend/scripts/generar-iconos.mjs` — volver a correr cuando
  llegue el logo real). `vite-plugin-pwa` configurado: manifest.webmanifest con nombre/colores
  de marca, service worker que cachea el app shell (JS/CSS/HTML) para que abra sin conexión;
  las llamadas a `/api` van siempre a red real (`NetworkOnly`), nunca se sirven cacheadas — un
  dato viejo mostrado como si fuera actual sería peor que un error claro. Verifiqué manifest,
  SW registrado e íconos servidos, los 4 correctos.
  Borradores offline: si falla la red al capturar una Requisición, se guarda en `localStorage`
  (`lib/offlineQueue.js`) en vez de perderse, con aviso claro al usuario; un panel en el listado
  de Requisiciones detecta borradores pendientes y los sincroniza (manual o automático al
  reconectar vía evento `online`). Verificado extremo a extremo: con axios directo confirmé que
  una falla de red real (sin el proxy de Vite de por medio) produce `error.response === undefined`
  — exactamente la condición que dispara el guardado local — y probé la sincronización completa
  (borrador simulado → "Sincronizar ahora" → quedó como REQ-2026-0005 real en el servidor, cola
  local vacía después).
  *Nota de prueba:* el proxy de desarrollo de Vite convierte un backend caído en un 500 HTTP en
  vez de un fallo de red puro, así que apagar el backend detrás del proxy no dispara el modo
  offline en `localhost:5173` — es una particularidad del entorno de desarrollo, no del código;
  en producción (mismo origen, sin proxy de Vite) si el dispositivo pierde señal, la detección
  funciona como se probó directamente con axios.
- **Logo real** (02/08/2026): recibidos `assets/logo-vertical.png` y `assets/logo-horizontal.png`
  (839×647 y 1197×337, con canal alfa). Se recortó el isotipo solo-ícono desde el vertical
  (`frontend/scripts/preparar-logo-real.mjs` → `frontend/public/brand/isotipo.png`) para usos
  chicos (topbar, favicon, íconos PWA), y se regeneraron los íconos PWA a partir de ese isotipo
  real (`generar-iconos.mjs`, ya no la reconstrucción SVG a mano). `BrandMark.vue` ahora es una
  `<img>` al isotipo real; login usa el lockup vertical completo; encabezados de reportes usan
  el lockup horizontal completo. El HEX estimado desde el inicio resultó casi exacto — no hubo
  que tocar la paleta de colores en ningún componente.
- **Bloque 12** (03/08/2026): Presupuesto a nivel Obra (no Partida) + importador real de
  Explosión de Insumos. Decisión tomada explícitamente contigo: el control de saldo vive a nivel
  Obra completa (tabla `presupuesto_obra_insumo`, migración 007), no por Partida — coincide con
  cómo lo llevas realmente en Neodata. Compras/Requisiciones aplica a todas las familias de
  insumo (Materiales, Mano de Obra, Equipo y Herramienta, y hasta ~10 más si tu obra las trae).
  Construí un lector de XLSX propio (`backend/src/lib/xlsxReader.js`, con `yauzl` +
  `fast-xml-parser`) porque `exceljs` fallaba con tu export real de Neodata: sus filas/celdas no
  traen el atributo `r=` de índice (válido en la norma OOXML por posición, pero `exceljs` no lo
  tolera). Probado con tu archivo real (`Insumos_e)Listado Insumos (E)_3-8-2026...xlsx`): obra
  "CCC González Ortega", 58 insumos, 3 familias, $10,742,301 presupuestado — verificado en el
  Dashboard y en una Requisición real (REQ-2026-0006) contra saldo real importado.
- **Bloque 13** (03/08/2026): Módulo de Usuarios y edición de Proveedores, con la misma
  jerarquía de permisos del resto del sistema. En vez de pedirte la lista de usuarios/proveedores
  para precargarla manualmente, se construyó:
  - Backend: `POST/PUT /api/usuarios` (solo Dirección: alta, edición de nombre/correo/rol/activo,
    restablecer contraseña de otro usuario), guard explícito para que Dirección no pueda
    desactivar su propia cuenta, `POST /api/usuarios/mi-password` (cualquier usuario cambia su
    propia contraseña), `GET /api/usuarios` y `GET /api/roles` (Dirección/Auditor). `PUT
    /api/proveedores/:id` (Compras y Dirección).
  - Frontend: pantalla `/usuarios` (ruta protegida por rol, solo visible en el menú para
    Dirección/Auditor) con alta y edición en línea por fila; sección nueva "Contraseña de
    acceso" en `/perfil` para que cualquier usuario cambie la suya; edición en línea agregada a
    `/proveedores` (Compras/Dirección) con toggle "Mostrar inactivos".
  - El menú de navegación (`AppShell.vue`) ahora filtra los enlaces según el rol
    (`navVisible`) — un Residente ya no ve "Usuarios" ni puede llegar a `/usuarios` (el guard de
    rutas lo regresa al Dashboard aunque entre la URL directo).
  - Probado en el navegador de punta a punta: alta de usuario nuevo desde la UI → login inmediato
    con esa cuenta funcionó; edición en línea (nombre + desactivar) persistió correctamente;
    Residente confirmado sin acceso a `/usuarios` (redirigido) y sin ver el enlace en el menú;
    edición de proveedor (días de crédito) persistió correctamente; Residente confirmado con
    vista de Proveedores de solo lectura (sin alta, sin edición, sin columna de estatus).
