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

## Cuentas y servicios externos (fuera de Claude)

Todo lo que hay que dar de alta/gestionar por fuera de esta conversación para que el sistema en
la nube funcione. Los valores secretos (contraseñas, tokens, connection strings) **no se
repiten aquí** porque este archivo se sube al repositorio de GitHub — viven únicamente como
variables de entorno en el panel de Render (Settings → Environment de cada servicio).

| Servicio | Para qué se usa | Panel / URL | Cómo se conecta con el resto |
|---|---|---|---|
| **GitHub** | Guarda el código fuente (control de versiones). Render lo lee para construir y desplegar. | `github.com/struktivaic-glitch/struktiva-compras` (privado) | Cada `git push` a `main` dispara un redeploy automático en Render (backend y frontend). |
| **Render** | Hospeda el backend (Web Service, Node/Fastify) y el frontend (Static Site) en el plan gratis. | `dashboard.render.com` | Backend: `struktiva-backend.onrender.com`. Frontend: `struktiva-frontend.onrender.com`. El backend tiene como variables de entorno la conexión a Neon (`DATABASE_URL`), el origen permitido de CORS (`CORS_ORIGIN`, apunta al frontend), y las credenciales de Telegram. |
| **Neon** | Base de datos real (Postgres), plan gratis. Aquí vive toda la información: obras, requisiciones, usuarios, etc. | `console.neon.tech` | El backend en Render se conecta a través de `DATABASE_URL`. Las migraciones (`npm run migrate`) se corren manualmente contra esta base cuando hay cambios de estructura — no es automático en cada deploy. |
| **Telegram** | Canal de avisos (alternativa a WhatsApp, ver abajo). Bot `@StruktivaAvisosBot`. | Se administra desde la propia app de Telegram, hablando con **@BotFather** | El backend tiene el token del bot y un "webhook secret" como variables de entorno; Telegram le avisa al backend (`/api/telegram/webhook`) cuando alguien escribe `/start` para vincular su cuenta desde `/perfil`. |
| **Upstash (Redis)** | Se dio de alta al planear el stack original, pero **no se está usando** — se revisó el código y ninguna función depende de Redis; todo el estado vive en Neon/Postgres. Se puede dar de baja sin afectar nada. | `console.upstash.com` | No conectado a ningún servicio activo actualmente. |
| **Meta / WhatsApp Business (Cloud API)** | Se intentó como canal de avisos por WhatsApp, pero Meta bloqueó la cuenta con "acceso restringido a publicidad" antes de poder crear el Business Portfolio — sin nada puntual que apelar en Soporte. **Pausado**, se usa Telegram en su lugar. | `developers.facebook.com` / `business.facebook.com` | No conectado — no hay nada configurado del lado del backend para WhatsApp. Se puede retomar más adelante si Meta levanta la restricción o se usa otra cuenta de negocio. |

**Resumen del flujo de despliegue:** editas código → `git push` a GitHub → Render reconstruye
backend y frontend automáticamente (unos ~100 s) → el backend ya apunta a Neon (datos reales) y
a Telegram (avisos) sin pasos manuales adicionales, salvo correr una migración nueva si hubo
cambio de estructura de base de datos.

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

- **Fotos en Entrada de Almacén (remisión + embarque).** Pedido del usuario (07/08/2026). Hoy
  `entradas_almacen` no guarda ninguna imagen — solo el número de remisión como texto
  (`remision_proveedor VARCHAR`). Es viable y encaja con un patrón que ya existe en el sistema:
  BYTEA en Postgres para archivos pequeños, igual que `documentos_personal`/`documentos_equipo`
  y las fotos de perfil (`AvatarUsuario`). Falta decidir: ¿1 foto de cada tipo o varias por
  entrada (a veces la remisión trae 2-3 hojas, o el embarque llega repartido en varios
  camiones)? Recomiendo permitir varias de cada tipo desde el inicio (una tabla
  `fotos_entrada_almacen(entrada_id, tipo['remision','embarque'], imagen BYTEA, ...)`) en vez
  de una columna única — así no hay que migrar de nuevo cuando alguien suba la segunda. En
  móvil, usar `capture="environment"` (cámara trasera) en el `<input type="file">`, igual que ya
  se usa `capture="user"` (cámara frontal) para selfies de asistencia.

- **Fotos en Salida de Almacén (personal + material entregado).** Mismo pedido, mismo patrón que
  el punto anterior — aplica igual a `salidas_almacen`. Aquí hay un matiz: "foto del personal"
  ¿es para identificar a quién se le entregó (ya existe `usuario_recibe_nombre` como texto
  libre, sin verificación) o es evidencia tipo "foto de la persona en el momento de la entrega"
  (como ya se hace con el selfie opcional de Asistencia)? Conviene resolverlo igual que
  Asistencia — foto de evidencia, no biometría — para no reabrir el tema de datos biométricos
  que ya se descartó ahí. Misma estructura de tabla que en Entrada (`tipo['personal',
  'material']`).

- **Ligar la factura con la Entrada de Almacén (no solo con la OC).** Repasé el esquema: hoy
  `facturas.oc_id` referencia directo a la Orden de Compra, y `entradas_almacen.oc_id` también
  — pero **factura y entrada no se referencian entre sí**, solo comparten la misma OC como punto
  en común indirecto. Esto ya genera un hueco real: una OC puede tener varias entradas
  (recepción parcial) y, en teoría, varias facturas (facturación parcial del proveedor); hoy no
  hay forma de saber en el sistema "esta factura corresponde a cuál entrada específica" — el
  three-way matching actual (Bloque 7) compara factura vs. OC, no factura vs. lo realmente
  recibido en cada remisión. Dos caminos, con mi recomendación:
  1. **Selector en la pantalla de captura de factura** ("Entrada relacionada", un `<select>` con
     las entradas de esa OC que aún no tienen factura ligada) — **más simple, no toca el modelo
     de three-way matching existente**, solo agrega `factura_detalle.entrada_id` opcional o una
     tabla puente `factura_entrada`.
  2. Registrar la factura *desde* la pantalla de la Entrada (como una acción "Facturar esta
     entrada") — más natural para el flujo de captura en campo, pero requiere mover/duplicar
     lógica que hoy vive en el módulo de Facturas.
  Recomiendo la opción 1: cambio acotado, no reescribe el matching actual, y dado que puede
  haber facturas que no vengan ligadas 1-a-1 con una sola entrada (ej. una factura que cubre dos
  remisiones), conviene que la relación sea muchos-a-muchos desde el principio
  (`factura_entrada(factura_id, entrada_id)`) en vez de una columna única en `facturas`.

- **Checklist de módulos visibles por usuario (permisos granulares).** Pedido del usuario
  (07/08/2026). Este es el de mayor alcance de los cinco — vale la pena que quede claro antes de
  construirlo. Hoy el sistema **no tiene permisos por usuario**: tiene 6 roles fijos
  (`residente`, `superintendente`, `comprador`, `almacenista`, `direccion`, `auditor`) definidos
  en la tabla `roles`, y cada módulo decide a mano, en su propio código (backend y frontend, más
  de 15 archivos distintos con arreglos `ROLES_GESTION`/`ROLES_AUTORIZA`), qué roles pueden
  entrar. No existe ningún concepto de "el usuario X, que es Superintendente, pero sin acceso a
  Destajos" — todos los Superintendentes ven exactamente lo mismo. Implementar un checklist real
  de módulos por usuario significa decidir primero:
  - ¿Los permisos son **por usuario individual** (cada quien su propia lista, como pediste) o
    seguimos con roles pero editables (Dirección redefine qué puede ver cada rol, y todos los
    usuarios de ese rol heredan el cambio)? Lo primero es más flexible pero significa dar de
    alta permisos uno por uno cada vez que entra alguien nuevo; lo segundo es menos trabajo de
    mantenimiento pero no permite la excepción individual que describes.
  - Si es por usuario individual, sigue haciendo falta un rol base (para separar "quién puede
    autorizar/firmar" de "qué pantallas ve") — el checklist resolvería la *visibilidad* de
    módulos, no reemplazaría por sí solo los candados de autorización (firma de Dirección,
    montos de OC, etc.) que hoy dependen del rol.
  - Habría que migrar las ~15+ verificaciones de rol hardcodeadas (`ROLES_GESTION.includes(rol)`)
    a una tabla de permisos (`usuario_modulo(usuario_id, modulo_clave, puede_ver)`) y un
    middleware/composable centralizado que las consulte — es un cambio transversal, no un
    módulo nuevo aislado como los últimos cuatro que construimos, así que conviene planearlo
    como su propio bloque de trabajo, no colarlo dentro de otro.
  Sugiero platicarlo con calma antes de empezar (por eso lo dejo aquí anotado, no lo arranco de
  una vez como los otros cuatro).

- **Formas de pago fijas (catálogo cerrado).** Pedido del usuario (07/08/2026): efectivo,
  transferencia, tarjeta de débito, tarjeta de crédito. Revisé el código: hoy
  `pagos_proveedor.forma_pago` es texto libre (`VARCHAR(40)`, sin `CHECK`) y en
  `PagoNuevoView.vue` es un `<input>` de texto con placeholder "Transferencia, cheque…" — cada
  quien lo escribe como quiere, sin estandarizar. Es el más sencillo de los cinco: cambiar el
  campo a un `<select>` con las 4 opciones fijas, y agregar el `CHECK` correspondiente en la
  columna (con una migración chica para normalizar los valores que ya existan capturados como
  texto libre, si los hay). Un detalle a confirmar contigo: ¿esta lista de 4 aplica solo a Pagos
  a Proveedor, o también quieres el mismo candado en Pagos a Personal (`pagos_personal`), que
  hoy ni siquiera tiene un campo de forma de pago?

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
- **Bloque 14** (04/08/2026): Modo de prueba gratis en la nube, sin VPS. Se creó el repositorio
  git del proyecto (`.gitignore` cuidando `.env`, `node_modules`, `uploads/` y los Excel de
  referencia del negocio) y se subió a GitHub (`struktiva-compras`, privado). Base de datos real
  en **Neon** (Postgres free tier) — se corrieron ahí las 7 migraciones y el seed; encontré y
  corregí un bug real en el proceso: `seeds/001_demo.sql` todavía insertaba en
  `presupuesto_partida_insumo`, tabla que la migración 007 ya había eliminado al pasar el control
  de presupuesto a nivel Obra — corregido para insertar en `presupuesto_obra_insumo`. Redis
  (Upstash) se evaluó y se descartó: revisé el código y ninguna funcionalidad construida hasta
  ahora lo usa realmente (quedó en el stack original por diseño, pero el estado siempre vivió en
  Postgres). Backend desplegado en **Render** (Web Service, free) conectado a Neon; frontend
  desplegado en Render (Static Site, free) — único cambio de código necesario:
  `frontend/src/lib/api.js` ahora lee `VITE_API_URL` en vez de asumir siempre `/api` relativo
  (con fallback a `/api` para que el proxy de Vite en desarrollo local siga funcionando igual).
  Un despliegue del frontend quedó con caché corrupta la primera vez (index.html apuntando a un
  JS que ya no existía) — se resolvió con "Clear build cache & deploy" en Render. `CORS_ORIGIN`
  del backend configurado a la URL del frontend. Probado de punta a punta en el navegador: login
  real, saldos reales de la obra Horizontes cargando desde Neon, sin errores de consola.
  🔗 **https://struktiva-frontend.onrender.com** — mismos usuarios demo, contraseña
  `struktiva123`. Limitaciones del plan gratis: el backend se duerme tras 15 min de inactividad
  (primera carga del día ~30-50s), y los archivos subidos no persisten de forma confiable
  (sistema de archivos efímero en el plan free de Render) — aceptable para probar el flujo, no
  para operar en serio; ahí es donde entra el VPS.
- **Bloque 15** (04/08/2026): Sistema de notificaciones — campanita en el topbar + página
  `/notificaciones` con pestañas por categoría, a partir de la primera duda real del usuario
  probando el sistema ("¿cómo se notifica a alguien que tiene que autorizar algo?" — hasta este
  bloque, nada avisaba, había que entrar a revisar manualmente). Se evaluó Telegram vs. WhatsApp
  para notificar por celular — el usuario eligió WhatsApp (su equipo ya lo usa a diario) vía la
  API oficial de Meta (Cloud API, con número de prueba gratis para hasta 5 destinatarios sin
  verificación de negocio) — queda pendiente que el usuario complete el registro en
  developers.facebook.com (Bloque 16). Mientras tanto, se construyó la campanita en la app:
  - Nueva tabla `notificaciones` (categoría/entidad genérica) y helper `notificarPorRol()`
    (`backend/src/lib/notificaciones.js`) para no repetir lógica de "a quién le toca enterarse".
  - **Requisiciones**: al enviar a autorizar, avisa a Superintendente + Dirección.
  - **Excedente**: categoría separada por decisión explícita del usuario — ambos roles
    (Superintendente y Dirección) pueden seguir autorizando normalmente, pero cuando cualquiera
    de los dos autoriza una requisición con renglones excedidos, se le avisa automáticamente al
    otro rol de que se hizo ese ajuste (aviso cruzado, no doble autorización).
  - **Cancelaciones**: aviso informativo a Dirección + Auditor (decisión del usuario: no
    bloquear al que cancela, solo mantenerlos enterados).
  - **Órdenes de compra** y **Cambio de precio**: categorías preparadas en la UI (pestaña propia,
    estado vacío) pero sin candado real todavía — el usuario pidió dejar OC como está por ahora
    ("necesito analizar cómo sería lo mejor operativamente"), y Cambio de precio quedó definido
    para el Bloque 16 (debe activarse en dos momentos: cotización vs. presupuestado, y factura
    vs. OC en el three-way matching) — falta definir el umbral de % y confirmar el autorizador.
  - Probado de punta a punta con datos reales (contra Neon, limpiando después la data de prueba
    para no ensuciar el ambiente que el usuario está probando): Residente crea requisición con
    excedente → Superintendente la ve en la campanita → autoriza con PIN → Dirección recibe el
    aviso cruzado de excedente → se cancela → Auditor recibe el aviso de cancelación. Los tres
    flujos verificados también ya desplegados en Render (no solo en local).
- **Bloques 16-22** (04-05/08/2026): serie de ajustes rápidos pedidos mientras el usuario probaba
  el sistema en vivo — cada uno confirmado en producción antes de pasar al siguiente: pivote de
  WhatsApp a Telegram para notificaciones (Meta bloqueó la cuenta personal por "acceso
  restringido a publicidad", sin nada que apelar — Telegram evita ese problema por completo;
  vinculación self-service desde `/perfil` vía webhook, mensajes enriquecidos con el detalle
  completo de la requisición); logo con sombra blanca de contraste + barra de título 50% más
  grande; menú de navegación convertido de barra horizontal a botón "☰ Menú" desplegable; vista
  de consulta para Requisiciones individuales (antes solo existía para Cotizaciones/OC) con el
  mismo candado de permisos (solo quien la creó o Dirección puede enviarla/cancelarla — antes
  cualquier usuario autenticado podía); impresión (mismo patrón de los 6 reportes) agregada a
  Requisición individual, Orden de Compra y cuadro comparativo de Cotización; modal "Ver catálogo
  completo" en Nueva Requisición (todos los insumos de la obra agrupados por familia, con
  filtro) para cuando no se conoce la clave/descripción exacta a buscar.
- **Bloque HR-A** (05/08/2026): Expediente de Personal — primer bloque de un módulo de Recursos
  Humanos más amplio (asistencia e incidencias quedan para bloques siguientes), acordado
  explícitamente con el cliente: control interno de gasto, **nunca nómina fiscal real** (sin ISR,
  IMSS ni timbrado CFDI) — si algún día se necesita nómina fiscal, la recomendación es conectar
  con un proveedor de nómina certificado (PAC), no construirlo aquí. Cubre tanto personal de
  campo (jornaleros) como administrativo (oficina). Se amplió el catálogo `trabajadores` (el
  mismo que ya usaba Mano de Obra) en vez de crear uno nuevo, para no duplicar el catálogo:
  tipo (jornalero/administrativo), puesto, obra/frente asignado, fecha de ingreso, salario de
  referencia (con periodo diario/mensual, solo control interno), teléfono, CURP, RFC, NSS,
  dirección, contacto de emergencia y notas. Nueva tabla `documentos_personal` (INE, comprobante
  de domicilio, contrato, etc.) — igual que la selfie de perfil (Bloque anterior), los documentos
  se guardan en la base de datos y no en disco (Render free tier los borraría en cada deploy);
  queda anotado como punto a revisar si el catálogo crece mucho (migrar a Object Storage real).
  Nueva pantalla `/trabajadores/:id` con el expediente completo editable y gestión de documentos
  (subir/ver/eliminar). El menú se renombró de "Trabajadores" a "Personal". Probado de punta a
  punta contra Neon: alta de un administrativo, edición del expediente completo, subida de un
  documento (verificado byte a byte que lo que se sube es exactamente lo que se descarga),
  acceso sin sesión bloqueado (401), rol sin permiso (Auditor) puede consultar pero no dar de
  alta (403) — datos de prueba eliminados después.
- **Bloque HR-B** (05/08/2026): Asistencia / checador. Segundo bloque del módulo de RH, mismas
  reglas del Bloque HR-A (control interno, sin nómina fiscal). Nueva tabla `asistencias`
  (trabajador + fecha, único por día) con hora de entrada/salida y GPS best-effort en cada una
  (mismo patrón de `obtenerGps()` que ya usan las Firmas — no bloquea si el navegador niega el
  permiso). Nueva pantalla `/asistencia` con dos vistas: **Checador** (personal activo del día,
  filtrable por obra, con botones "Marcar entrada"/"Marcar salida") e **Histórico** (rango de
  fechas, filtrable por obra, con horas trabajadas calculadas e impresión). El backend valida
  que no se pueda marcar entrada dos veces el mismo día, ni salida sin entrada previa, ni salida
  dos veces — probado explícitamente los tres casos de error. Permisos: Residente/
  Superintendente/Dirección pueden marcar; el resto de roles solo consulta. Probado de punta a
  punta contra Neon (marcar entrada con GPS, marcar salida con GPS, ambos rechazos de duplicado,
  aparece correcto en checador e histórico) y limpiado después.
- **Bloque HR-C** (05/08/2026): Incidencias (faltas, permisos, vacaciones, incapacidades). Tercer
  bloque del módulo de RH, mismas reglas HR-A/HR-B (control interno, sin nómina fiscal). Los
  trabajadores no tienen cuenta propia, así que Residente/Superintendente/Dirección solicita a su
  nombre; Superintendencia/Dirección autoriza o rechaza — mismo patrón de flujo de dos roles que
  Requisiciones. Se reutilizó la campanita de notificaciones ya existente (Bloque 15): nueva
  categoría `incidencia` (avisa a Superintendencia/Dirección cuando hay una pendiente, y al
  solicitante cuando se resuelve, aprobada o rechazada). Nueva pantalla `/incidencias`: alta,
  listado filtrable por estatus con acciones Autorizar/Rechazar, impresión. Probado de punta a
  punta contra Neon: solicitud → notificación a Dirección confirmada → autorización → notificación
  de vuelta al solicitante confirmada → intento de autorizar dos veces rechazado (422) →
  segundo caso con rechazo (con comentario) → validación de fecha fin antes de inicio (400) →
  permisos verificados (Auditor solo lectura, Residente no puede autorizar) — datos de prueba y
  sus notificaciones eliminados después.
- **Bloque HR-D** (05/08/2026): Control interno de pagos a Personal, generalizado más allá de
  una requisición de Mano de Obra (cierra el plan original del módulo de RH). Nueva pantalla
  `/pagos-personal`: se captura un pago por persona y rango de fechas, con un botón "Calcular
  sugerencia" que propone días trabajados (contados desde Asistencia) y monto (días × salario de
  referencia diario, o el salario mensual completo si es administrativo) — siempre editable antes
  de guardar. Flujo de dos roles, igual que Incidencias: Residente/Superintendente/Dirección
  capturan y pueden cancelar mientras esté pendiente; solo Dirección puede "Marcar pagado" (deja
  de poder editarse o cancelarse una vez pagado — la API lo bloquea explícitamente). Sigue siendo
  control interno: "marcar pagado" solo registra que el pago ya se hizo por fuera del sistema, no
  mueve dinero real ni calcula ISR/IMSS. Probado de punta a punta contra Neon: sugerencia (3 días
  × $350 = $1,050) verificada exacta, creación, bloqueo de "marcar pagado" para quien no es
  Dirección, edición/cancelación bloqueadas después de pagado, cancelación de un pendiente,
  permisos de Auditor (solo lectura) — datos de prueba eliminados y el salario de referencia de
  prueba revertido después.

  **Con esto queda cerrado el plan original del módulo de Recursos Humanos**: Expediente de
  Personal (HR-A) → Asistencia/checador (HR-B) → Incidencias (HR-C) → Pagos a Personal (HR-D).
- **Bloque HR-E** (05/08/2026): Cumplimiento de jornada laboral (LFT Art. 132 Fracc. XXXIV,
  Art. 66-68, reforma de jornada de 40 horas DOF 01-05-2026). Pedido explícito del cliente tras
  compartir el marco normativo; se investigó el estado real de la reforma antes de construir
  (no se asumió nada): calendario gradual verificado 48h(2026)→46h(2027)→44h(2028)→42h(2029)→
  40h(2030), tope semanal de horas dobles 9h(2026-27)→10h(28)→11h(29)→12h(30), triple después de
  ese tope. **Aclarado explícitamente con el cliente que esto es infraestructura de apoyo, no una
  certificación legal** — la validación final requiere asesoría laboral, sobre todo porque hay
  ambigüedad publicada sobre el criterio exacto (diario vs. semanal) de cómputo de horas extra.
  Al revisar el horario real del cliente (L-V 8-13/14-18, sáb 8-13 = 50h/semana) se detectó que ya
  excede el máximo legal 2026 (48h) en 2 horas — dato que se le señaló directamente.
  - Migración 017: las marcas de entrada/salida/comida ahora son **inalterables de verdad** — se
    agregaron columnas `_original` que nunca se tocan después de creadas; toda corrección posterior
    exige motivo y queda en `asistencia_correcciones` (quién, cuándo, valor anterior/nuevo, por
    qué), sin pisar el original. Nueva tabla `configuracion_jornada` con el calendario de la
    reforma como datos editables (no hardcodeados en el código) — Dirección puede ajustarlo si la
    ley cambia o si su asesoría laboral confirma un criterio distinto.
  - Backend: `/api/asistencias/comida-inicio` y `/comida-fin` (mismo patrón de entrada/salida);
    `/api/asistencias/:id/corregir` (reemplaza el PUT anterior que sobrescribía sin dejar rastro);
    `/api/asistencias/horas-extra` (sugerencia semanal de ordinarias/dobles/triples según la
    configuración vigente); `/api/configuracion-jornada` (CRUD, solo Dirección para escribir).
  - Frontend: Checador con marcas de comida y badge "✎ corregido"; modal de corrección con motivo
    obligatorio; nueva pestaña "Horas extra" con la tabla semanal, aviso de que es una sugerencia
    (no dictamen legal) y una sección para que Dirección administre el calendario vigente.
  - **Bug real encontrado y corregido durante la prueba**: la comparación de fechas para encontrar
    la configuración vigente comparaba un objeto `Date` de JS contra un string ISO con `<=`, lo
    que usa `Date.toString()` (formato no comparable) en vez de la fecha — el resultado siempre
    daba `null` silenciosamente. Corregido normalizando ambos lados a `YYYY-MM-DD` antes de
    comparar.
  - Probado de punta a punta contra Neon con el horario real del cliente simulado (L-V 9h + sáb
    5h = 50h/semana): el sistema calculó exactamente 48h ordinarias + 2h dobles + 0h triples,
    coincidiendo con el cálculo manual. También probados: inmutabilidad del original tras
    corregir, historial de corrección completo, motivo corto rechazado (400), permisos de
    Dirección para configuración (403 para otros roles), fecha duplicada rechazada (409) — datos
    de prueba eliminados después.
- **Bloque HR-F** (05/08/2026): Selfie opcional al marcar asistencia. El usuario preguntó si el
  registro incluía foto o biométrico — no incluía ninguno. Se explicó la diferencia (esto no es
  biometría real, no hay matching automático de identidad) y por qué vale la pena: hoy es el
  supervisor quien marca a nombre del trabajador (no tiene cuenta propia), así que una selfie da
  evidencia fotográfica revisable si hay una disputa, sin la complejidad/costo de reconocimiento
  facial real. Mismo patrón que la selfie de perfil (Bloque anterior): comprimida en el navegador
  (más agresivo aquí — 320px/calidad 0.7, porque el volumen es mucho mayor: varias marcas por
  persona por día, todos los días, a diferencia de una sola foto de perfil) y guardada en la base
  de datos. **Diseño clave: la selfie nunca bloquea la marca del horario** — se marca la hora
  normal (instantáneo, como antes) y la foto se sube aparte como un botón secundario opcional
  junto a cada hora ya marcada, mismo principio "best-effort" que ya se usa para el GPS.
  - Migración 018: columnas `foto_entrada/salida/inicio_comida/fin_comida` (+ mime) en
    `asistencias`. **Se revisó y corrigió cada `RETURNING *`/`SELECT *` existente sobre esa
    tabla** (6 lugares) para que no viajen los bytea en cada respuesta de marcar/corregir —
    ahora usan una lista explícita de columnas + banderas `tiene_foto_*` calculadas.
  - Backend: `POST/GET /api/asistencias/:id/foto/:campo` (subir solo Residente/Superintendente/
    Dirección; ver, cualquier rol autenticado, igual que el resto de fotos del sistema).
  - Frontend: ícono 📷 junto a cada hora ya marcada (Checador) — capturar si no tiene foto, ver si
    ya tiene; también íconos de solo-ver en Histórico para consulta/auditoría.
  - Probado de punta a punta contra Neon: subida y descarga byte a byte idénticas, banderas
    `tiene_foto_*` reflejadas correctamente en checador e histórico, campo de foto inválido
    rechazado (400), sin foto da 404, sin sesión da 401, Auditor puede ver pero no subir (403) —
    dato de prueba eliminado después.
- **Bloque 27** (06/08/2026): auditoría visible en la impresión de Requisiciones. El usuario pidió
  verificar que autorización/cancelación/firmas salgan en la impresión — al revisar el código
  encontré 3 huecos reales: (1) "Autorizó: X (fecha)" vivía en el bloque `no-print`, nunca
  aparecía al imprimir; (2) cancelar una requisición no guardaba quién, cuándo ni por qué —
  solo cambiaba el estatus; (3) el detalle de firma (tipo, IP, GPS, hora exacta) ya se
  capturaba y tenía endpoint (`GET /api/firmas`) pero nunca se mostraba en ningún lado, ni
  pantalla ni impresión. Corregido:
  - Migración 019: `requisiciones.cancelado_por/fecha_cancelacion/motivo_cancelacion`.
  - Backend: `POST /:id/cancelar` ahora acepta `motivo` opcional y lo guarda.
  - Frontend: el bloque de auditoría (creó/autorizó/canceló+motivo/firma con ubicación e IP)
    ahora vive dentro del `print-sheet`, así que sí sale al imprimir. Cancelar ahora abre un
    modal pidiendo el motivo (opcional) en vez de cancelar directo.
  - Probado de punta a punta contra Neon: autorización con firma táctil + GPS confirmada
    recuperable vía `/api/firmas`; cancelación con motivo confirmada guardada y visible —
    datos de prueba eliminados después.
- **Bloque 23** (05/08/2026): desglose de personal para requisiciones de Mano de Obra — control
  interno de gasto, explícitamente sin tocar temas fiscales/nómina real. Decisiones tomadas por
  el usuario: la sección "Personal asignado" vive aparte (no ligada a un renglón de insumo
  específico) pero su suma debe cuadrar exacto con el total de Mano de Obra de la requisición;
  catálogo reutilizable de trabajadores (como Proveedores), no texto libre cada vez. Detalles
  técnicos: se agregó una bandera explícita `es_mano_de_obra` a `familias_insumo` en vez de
  comparar el nombre por texto (los nombres de familia vienen libres de cada exportación de
  Neodata) — el importador de Excel la detecta sola al crear una familia nueva, sin pisarla si
  ya fue ajustada a mano. Nuevo catálogo `/trabajadores` (Residente/Superintendente/Dirección).
  La validación de que la suma cuadre corre en el servidor (con tolerancia de 1 centavo) y
  también en el cliente antes de enviar, para un error más rápido. El desglose aparece también
  en la consulta e impresión de la Requisición. Se agregó la familia "Mano de Obra" con un
  insumo de ejemplo ("Peón", $350/jornal) a la obra demo Horizontes para poder probar de
  inmediato. Probado de punta a punta en producción: 20 jornales × $350 = $7,000 repartidos
  entre 2 trabajadores ($3,500 c/u) — guardó, se mostró correcto en consulta e impresión; caso
  con suma incorrecta ($5,000 en vez de $7,000) rechazado con error claro antes de guardar.
- **Bloque 28** (06/08/2026): segundo tipo de Requisición — "Nómina" — para cuando el gasto es
  Mano de Obra. El usuario notó que el Bloque 23 (desglose de personal) obligaba a capturar
  cantidades de insumo aunque lo que realmente varía persona a persona es el sueldo, no una
  cantidad; pidió un tipo de requisición aparte donde el cargo a la partida de Mano de Obra sea
  por MONTO, no por cantidad. Diseño acordado con el usuario tras varias rondas (incluyendo
  revisar un Excel real que compartió y resolver el caso "Tito": un contratista que en la misma
  requisición trabaja unos días como Peón y otros como Albañil):
  - Árbol: Requisición (tipo `nomina`) → Partida (igual que antes, a nivel cabecera) → **Renglón**
    (un rubro de Mano de Obra, ej. Peón, Albañil — cada uno con su propio presupuesto) →
    **desglose de personal** (trabajador + días trabajados + tarifa diaria; el monto = días×tarifa
    siempre se calcula, nunca se captura directo). El total del renglón es la suma de su propio
    desglose — por construcción nunca puede "no cuadrar".
  - Caso Tito resuelto de la forma más simple: el mismo trabajador puede aparecer en varios
    renglones de la misma requisición (cada uno con su propio días/tarifa) — el cargo cae
    directo sobre los insumos reales existentes, sin necesitar un "insumo compuesto" nuevo.
  - Para reusar toda la maquinaria ya existente de presupuesto/excedente/justificación (pensada
    para materiales): internamente se calcula una "cantidad equivalente" =
    montoDelRenglón ÷ costoUnitarioPresupuestado, de forma que cantidad × precio = exactamente
    el monto del renglón.
  - Alta directa de rubros nuevos de Mano de Obra (sin pasar por el importador de Excel) desde la
    misma pantalla de captura — nuevo endpoint `/api/insumos`. Arrancan con presupuesto en $0 a
    propósito (así cualquier uso muestra "excede" de inmediato); Dirección autoriza después el
    estimado real con `PUT /api/insumos/:id/presupuesto`. Si no se indica una familia, el
    backend busca o crea sola la familia "Mano de Obra" — así funciona igual aunque la obra no
    tenga todavía ningún rubro de Mano de Obra en su catálogo.
  - Migración 020: `requisiciones.tipo` (`materiales`/`nomina`); `requisicion_personal` ahora
    también puede colgar de un renglón (`requisicion_detalle_id`) además del uso plano anterior
    del Bloque 23, que se conservó sin cambios para no romper nada existente.
  - Frontend: toggle "Materiales / Nómina" en Nueva Requisición; captura por renglones con su
    propio catálogo de Mano de Obra y modal de alta rápida; en Consulta/Expediente, el árbol de
    renglones con su desglose de personal vive dentro del área imprimible (mismo criterio del
    Bloque 27); badge "Nómina" en el listado.
  - Probado de punta a punta: primero contra Neon por API (caso Tito completo: Pancho Perez con
    2 días de Peón sin excedente + 2 días de un rubro nuevo con excedente y justificación,
    autorización con firma, consumo de presupuesto verificado), y después repetido igual en el
    navegador de punta a punta (crear renglones, dar de alta un rubro nuevo desde la UI, ver el
    árbol en la impresión) — datos de prueba eliminados después en ambas rondas.
- **Bloque 16** (06/08/2026): candado real de "Cambio de precio" (Cotizaciones y Facturas) y
  autorización por monto en Órdenes de Compra — quedaba pendiente desde el Bloque 15. Reglas
  confirmadas por el usuario: 5% de desviación ARRIBA del presupuestado/negociado dispara la
  alerta y pide autorización de Dirección; OC menores a $20,000 las confirma Compras directo (ya
  vienen respaldadas por la autorización de la requisición); OC de $20,000 o más requieren
  autorización de Dirección, o como excepción — para cuando Dirección no pueda firmar (vacaciones,
  juntas, viaje sin conexión) — dos firmas de **Administrador** (rol nuevo, creado para esto) +
  Superintendente.
  - Migración 021: nuevo rol `administrador`; `procesos_cotizacion` y `facturas` ganan
    `variacion_precio_autorizada` (+ por/en).
  - Cotizaciones: al marcar un ganador que cotiza 5%+ arriba del presupuesto de esa obra/insumo,
    se notifica a Dirección (categoría "Cambio de precio") y se bloquea "Cerrar cuadro
    comparativo" hasta que Dirección autorice con firma (`POST /:id/autorizar-variacion`).
  - Facturas: si algún renglón factura 5%+ arriba de lo negociado en la OC (three-way matching,
    ahora también de precio y no solo de cantidad), se notifica a Dirección y se bloquea que esa
    factura reciba un pago hasta que se autorice (`POST /:id/autorizar-variacion`) — el registro
    de la factura en sí no se bloquea, solo aplicarle un pago.
  - Órdenes de Compra: `cargarOcCompleta` calcula `importe_total` y `requiere_autorizacion_monto`
    (>= $20,000); `POST /:id/confirmar` ahora rechaza directo (comprador) si aplica el umbral.
    Nuevo `POST /:id/autorizar-monto`: si firma Dirección, confirma con una sola firma; si firma
    Administrador o Superintendente, queda "1 de 2" hasta que firme el otro rol (reutiliza la
    tabla `firmas` genérica, `entidad_tipo='orden_compra_autorizacion'`) — con guardas para que
    el mismo usuario no pueda contar como las dos firmas y para que roles sin permiso (ej.
    Residente) no puedan autorizar.
  - Bug encontrado y corregido durante las pruebas: en Postgres, `poi.costo_unitario * (1 + $2)`
    sin cast explícito hace que el parámetro se infiera como `integer` (por el literal `1`) y
    truena al mandar `0.05` — se resolvió con `(1 + $2::numeric)` en las 3 consultas afectadas.
  - De paso se encontraron y limpiaron 13 notificaciones huérfanas (apuntaban a requisiciones ya
    borradas en limpiezas de pruebas de bloques anteriores) que inflaban con badges falsos la
    pantalla de Notificaciones — no relacionado al candado nuevo, pero visible justo ahí.
  - Probado de punta a punta contra Neon (API): variación de precio en cotización (9.5% arriba,
    bloqueo de cierre, autorización de Dirección, cierre exitoso después), variación de precio en
    factura (12.9% arriba, bloqueo de pago, autorización, pago exitoso después), y los tres
    caminos de autorización de OC (Dirección sola, excepción de dos firmas Administrador+
    Superintendente completa correctamente, y los candados de rol — 403 para roles sin permiso,
    409 al intentar firmar dos veces) — datos de prueba eliminados después, dejando intactos
    tanto los datos reales del usuario como una cotización previa ajena a esta prueba.
- **Bloque 29** (06-07/08/2026): Avance financiero de obra — primer módulo de una lista de 4 que
  el usuario planteó para el futuro (Destajos, Avance financiero, Maquinaria/Equipos, Seguridad e
  Higiene), acordado empezar por este porque los Destajos (próximo bloque) dependen de él. Es un
  presupuesto **distinto** al ya existente por insumo (`presupuesto_obra_insumo`, control de
  gasto ascendente): este es el catálogo de conceptos **contratados con el cliente**
  (Capítulo/Clave/Concepto/Unidad/Cantidad/P.U., típico de un presupuesto de obra formal),
  importable por Excel igual que la Explosión de Insumos. El avance se mide por volumen y monto
  ejecutado (no por generadores formales, decisión explícita del usuario por practicidad) y — a
  petición del usuario — si un avance hace que el acumulado supere lo contratado, requiere
  justificación y autorización de Superintendencia/Dirección antes de contar en el avance
  oficial, mismo espíritu que el candado de excedente ya usado en Requisiciones/Bloque 16.
  - Migración 022: `conceptos_obra`, `concepto_avance` (con `estatus`
    confirmado/pendiente_autorizacion), y nueva categoría `avance_obra` en notificaciones.
  - Backend: catálogo de conceptos (alta manual + importador `analizar`/`confirmar`, mismo patrón
    que Explosión de Insumos), captura de avance (bloquea con 422 si excede y falta
    justificación), autorización con firma (`POST /avance/:id/autorizar`, solo Superintendencia/
    Dirección), y `GET /api/reportes/avance-financiero` (valor contratado vs. ejecutado).
  - Frontend: `Avance de Obra` (tabla por concepto con barra de % avance, modal de captura que
    avisa en vivo si el número que estás tecleando va a exceder lo contratado y pide
    justificación, sección de pendientes con botón Autorizar solo para quien puede), `Importar
    Presupuesto General`, y el reporte imprimible `Avance Financiero` dentro del hub de Reportes.
  - **Dos bugs reales encontrados y corregidos en el lector de Excel compartido** (`xlsxReader.js`,
    usado también por el importador de Explosión de Insumos — se hizo una prueba de regresión
    para confirmar que ese importador siguió funcionando igual después del fix):
    1. No manejaba el formato `inlineStr` (`<c t="inlineStr"><is><t>texto</t></is></c>`), que
       usan algunas herramientas (ej. openpyxl) en vez de `sharedStrings.xml` — el texto vive en
       `<is>`, no en `<v>`, así que toda celda de texto llegaba como `null`.
    2. Las celdas se recorrían por posición en vez de por su referencia real (`r="B7"`) — una
       fila con huecos (columnas vacías que Excel simplemente no escribe) quedaba con todo
       recorrido una o más columnas a la izquierda. Se corrigió calculando el índice de columna
       real a partir de la referencia de celda.
  - Otro bug corregido durante pruebas: `SELECT ... GROUP BY ... FOR UPDATE` truena en Postgres
    ("FOR UPDATE is not allowed with GROUP BY") — se separó en dos consultas (lock de la fila +
    cálculo del acumulado aparte).
  - Probado de punta a punta contra Neon: avance dentro de lo contratado (directo), avance que
    excede sin justificación (bloqueado, 422), con justificación (queda pendiente, no cuenta
    todavía, notifica a Superintendencia/Dirección), autorización con firma (403 para quien no
    puede, éxito para Superintendente, ahora sí cuenta en el acumulado), importación real de un
    .xlsx con capítulos/conceptos, y el reporte de avance financiero — datos de prueba eliminados
    después.
- **Bloque 30** (07/08/2026): Destajos — segundo módulo de la lista de 4, apoyado en el Bloque 29.
  Catálogo de **destajistas separado** del catálogo de Personal/trabajadores (decisión explícita
  del usuario: no mezclar contratistas a destajo con jornaleros/administrativo). Un Destajo liga
  un destajista a UN concepto del presupuesto general con su propio precio pactado — normalmente
  distinto del P.U. general del concepto, porque el destajo cubre solo mano de obra + materiales
  inherentes a la actividad (ejemplo real del usuario: castillo colocado y colado a $50/ml,
  incluye cimbra; el concreto/varilla/alambre los suministra la empresa aparte). Confirmado con
  el usuario: **es el mismo concepto y el mismo volumen** del Bloque 29 — el monto que se le debe
  al destajista se calcula solo del avance físico ya CONFIRMADO de ese concepto, sin volver a
  capturarlo ni medirlo por separado.
  - Migración 023: `destajistas`, `destajos` (con `precio_destajo`, un solo destajo `activo` por
    concepto a la vez — índice único parcial), `destajo_pago` (anticipos).
  - Backend: catálogo de destajistas (alta/edición), `GET /api/destajos/conceptos-disponibles`
    (conceptos de la obra sin destajo activo, para elegir al armar uno nuevo), crear/cerrar
    destajo (liquidado/cancelado), registrar pagos con candado de saldo (no se puede pagar más
    del monto ganado pendiente) y candado de estatus (no se puede pagar un destajo ya
    cancelado/liquidado).
  - Frontend: `Destajistas` (catálogo simple) y `Destajos` (tabla con avance/ganado/pagado/saldo
    en vivo, modal para crear un destajo nuevo, modal de registrar pago, modal de detalle con
    historial de pagos y botones de cancelar/liquidar) — ambos dentro del grupo R.H.
  - Probado de punta a punta contra Neon: candado de "un destajo activo por concepto" (409 al
    intentar duplicar), captura de avance en el concepto reflejándose automáticamente en el monto
    ganado del destajo sin captura aparte, pago dentro de saldo, pago que excede saldo (422),
    cierre del destajo, pago bloqueado después de cerrado (409), y el concepto vuelve a quedar
    disponible para un destajo nuevo tras cancelar el anterior — datos de prueba eliminados
    después.
- **Bloque 31** (07/08/2026): Control de Maquinaria y Equipos — tercer módulo de la lista de 4.
  Catálogo de equipos (propio/rentado), expediente por equipo (documentos, mismo patrón BYTEA que
  el Expediente de Personal) y bitácora de mantenimiento (preventivo/correctivo, horómetro/km,
  costo informativo, taller, próximo mantenimiento programado). Ajuste explícito del usuario para
  equipo **rentado**: solo se controlan fechas de vigencia de la renta + bitácora + documentación
  — el costo de la renta **no** se registra aquí, sigue su camino normal por Requisición/
  Cotización/OC/Factura como cualquier otro gasto, para no duplicar el control financiero.
  - Migración 024: `equipos`, `documentos_equipo`, `bitacora_mantenimiento`.
  - Backend: catálogo (alta/edición), expediente (subir/ver/eliminar documento, con fecha de
    vencimiento opcional), bitácora de mantenimiento, y `GET /api/equipos/vencimientos` — panel
    de renta/documentos/próximo mantenimiento que vencen en los próximos 30 días. Se calcula al
    cargar la pantalla (no hay infraestructura de tareas programadas/cron en este sistema, así
    que se optó por un panel visible en vez de notificaciones push automáticas por fecha).
  - Frontend: `Maquinaria y Equipos` (catálogo con panel de vencimientos arriba, alta) dentro del
    grupo Almacén, y su vista de detalle (datos editables, documentos, bitácora).
  - Probado de punta a punta contra Neon: equipo propio y rentado, panel de vencimientos
    detectando correctamente renta y documento próximos a vencer (dentro de 30 días) y
    excluyendo mantenimiento programado más lejano, descarga de documento byte a byte idéntica,
    candado de rol (403 para Almacenista) — datos de prueba eliminados después.
- **Bloque 32** (07/08/2026): Seguridad e Higiene — cuarto y último punto de la lista original,
  resuelto tal como se acordó: **sin módulo aparte**, como extensión ligera del Expediente de
  Personal ya existente. Certificaciones y DC-3 ya cabían como documento del expediente; solo
  hacía falta poder ponerles una fecha de vigencia para poder avisar cuándo vencen — mismo
  patrón ya usado en documentos_equipo (Bloque 31).
  - Migración 025: `documentos_personal.fecha_vencimiento` (columna nueva, nullable).
  - Backend: la subida de documentos del expediente ahora acepta `fechaVencimiento` opcional;
    nuevo `GET /api/trabajadores/vencimientos` (mismo patrón que el de Equipos) para
    certificaciones que vencen en los próximos 30 días de personal activo.
  - Frontend: nuevo tipo "Certificación / DC-3" en el selector de documentos del Expediente,
    campo de fecha de vencimiento al subir, aviso de vencimiento visible en cada documento, y
    panel de "por vencer" en el catálogo de Personal (mismo patrón visual que Equipos).
  - Probado contra Neon con un trabajador real existente: documento con vencimiento capturado y
    reflejado en el panel, documento de prueba eliminado después sin tocar al trabajador.
- **Ajustes de navegación** (07/08/2026): pedidos por el usuario tras probar el sistema.
  - Subtítulo bajo "STRUKTIVA" en el encabezado: "Control de Compras y Requisiciones · Obra" →
    "Sistema ERP".
  - El avatar del usuario (mismo componente `AvatarUsuario` que ya existía) ahora aparece junto
    a la campanita de notificaciones, al mismo tamaño (54px), como link directo a "Mi perfil" —
    se sacó de dentro de la píldora de texto para no duplicarlo.
  - Reorganización de los menús agrupados: **Insumos** gana "Destajos" (antes en R.H.); nuevo
    grupo **Obras** (Importar Presupuesto, Avance de Obra, "Dash de Avance de Obra" — enlaza al
    reporte de Avance Financiero ya existente) con lo que antes vivía suelto dentro de Insumos;
    **Almacén** se queda exactamente igual; **R.H.** pierde "Destajos" pero conserva
    "Destajistas". De paso se agregó la categoría `avance_obra` (Bloque 29) al mapa de rutas de
    la campanita rápida del header, que se había quedado sin registrar.
  - Probado en el navegador: los 4 grupos muestran exactamente los ítems esperados, avatar y
    campanita del mismo tamaño (54×54px) confirmado por medición directa del DOM.
- **Ajustes finos de estilo** (07/08/2026): segunda ronda tras probar el sistema.
  - "STRUKTIVA" en el header más grande (26px → 34px), "Sistema ERP" más chico (17px → 13px).
  - Botones de los menús agrupados ~25% más bajos de alto (padding vertical 8px → 6px), sin
    tocar el tamaño del texto.
  - Botones "Imprimir / Guardar PDF" (13 vistas) y "Por obra"/"Vista general" (Dashboard)
    ajustados a la altura real medida del selector de obra (39px) — antes eran 40px/42px/38px,
    ligeras inconsistencias entre sí.
  - Título de la sección visible (el `<h2>` de cada pantalla) al doble de tamaño: se identificaron
    y ajustaron los dos patrones usados en todo el proyecto — `font-display text-lg` (18px→36px,
    44 archivos) y `text-[16px] font-display` (16px→32px, Dashboard y Requisiciones) —
    reemplazo verificado uno-a-uno por archivo antes de aplicar (una sola ocurrencia por archivo).
  - Verificado en el navegador con medición directa del DOM: botones y selector a 39px exactos,
    título de sección a 36px, sin romper ningún layout.
  - Tercera vuelta: el usuario pidió que **todo botón del sistema** mida 30px de alto y 13px de
    texto, dejando la franja de título (header: logo, STRUKTIVA, campanita, foto) tal cual. Dado
    que hay decenas de botones con combinaciones de clases distintas en todo el proyecto, en vez
    de tocar cada vista se agregó una sola regla global en `style.css`
    (`button:not(header button) { min-height:30px; font-size:13px; padding-top/bottom:0; }` con
    `!important` para ganarle a las clases de Tailwind ya puestas en cada botón) — los botones
    dentro de `<header>` (campanita y "Salir") quedan excluidos automáticamente por el selector.
    Verificado en el navegador: campanita/avatar siguen en 54px y STRUKTIVA en 34px (sin tocar),
    botones normales y de modales a exactamente 30px/13px en varias pantallas distintas.
  - Cuarta vuelta: mismo criterio pero para **celdas de captura de datos** (`input`, `select`) —
    misma regla global en `style.css`, excluyendo `checkbox`/`radio`/`file` (son controles nativos,
    no "celdas de rellenar") y todo dentro de `<header>`. El `textarea` solo recibió el tamaño de
    texto (13px), sin quitarle el padding vertical, porque es multilínea y se ve mal con el texto
    pegado al borde.
  - De paso se detectó que algunos "botones" en realidad son `RouterLink` (etiqueta `<a>`, no
    `<button>`) y la regla global de botones no los alcanza — es el caso de "+ Nueva requisición"
    y enlaces equivalentes en las listas de Cotizaciones, Entradas/Salidas de Almacén, Facturas,
    Pagos y Requisiciones (7 archivos en total). Se corrigieron uno por uno a 30px/13px
    directamente en cada vista (no hay una clase común segura para engancharlos por CSS sin
    arriesgar enlaces de navegación normales), más una regla de respaldo en `style.css`
    (`a.min-h-\[30px\] { font-size:13px; }`) por si aparece alguno nuevo sin tocar.
  - Sombra blanca añadida a la campanita de notificaciones y al avatar del usuario en el header
    (`shadow-[0_0_10px_rgba(255,255,255,0.6)]`), pedido explícito del usuario.
  - Verificado en el navegador: campos de formulario (selects e input de texto) en `/requisiciones/
    nueva` a 30px/13px, enlace "+ Nueva requisición" y selector de estatus en `/requisiciones` a
    30px/13px, campanita y avatar con el boxShadow blanco confirmado por lectura directa del DOM.
  - Quinta vuelta (mismo día): el "azul de halo" pendiente se resolvió preguntando al usuario los
    dos ejes ambiguos — respondió **"todo el fondo general"** y **"azul medio vibrante"**. Se
    definió el color `halo` (`#2563EB`) en `tailwind.config.js` y se cambió el fondo raíz de
    `AppShell` (`bg-slate-100` → `bg-halo`); el header y la barra de menús agrupados conservan su
    propio fondo (`bg-primary`/blanco) y no se tocaron.
  - Contraste resuelto con herencia de `color` en CSS en vez de tocar archivo por archivo: `main {
    color:#fff }` por defecto, restaurado a oscuro (`#0f172a`) dentro de cualquier tarjeta clara
    (`bg-white`, `bg-slate-50`, `bg-slate-100/200`, `bg-red/emerald/amber/sky-50`) y tablas —
    aprovecha que la mayoría de los títulos de sección (`<h2>`) no tenían color explícito, así
    que se iluminan solos. Para el texto secundario y bordes que sí tenían clase explícita
    (`text-slate-400/500/600`, `border-slate-300`) y quedan sueltos fuera de cualquier tarjeta
    clara (párrafos bajo el título, botones tipo "outline" como los tabs de Asistencia o "Por
    obra/Vista general" del Dashboard), se agregó una regla con selectores `:not(.bg-white *)`
    (y equivalentes) que los aclara solo cuando NO están dentro de una tarjeta — lo mismo dentro
    de una tarjeta clara queda intacto.
  - Pendiente de verificación visual en producción tras el deploy de este cambio (fondo azul,
    títulos legibles, tarjetas sin alterar) — se hará contra el sitio en vivo, no en local, para
    no arriesgar usar una credencial de base de datos ambigua fuera de la ya establecida para
    este proyecto.
  - Corrección inmediata del usuario: no quería el azul vibrante sino "el azul tal cual del halo...
    obscuro" — se reinterpretó como el azul oscuro que ya existe en el sistema (el mismo `primary`
    del header/logo, `#123B54`), así que se cambió el valor de `halo` en `tailwind.config.js` de
    `#2563EB` a `#123B54` (idéntico a `primary`). La lógica de contraste (texto blanco por defecto,
    restaurado a oscuro dentro de tarjetas claras) no cambió — sigue aplicando igual de bien con
    un azul oscuro que con uno vibrante.
  - **Bug encontrado al verificar en producción**: la regla de "aclarar texto suelto" (párrafos
    descriptivos, botones outline) nunca se aplicaba en ningún lado del sitio. Causa: el `<body>`
    del sistema ya trae su propia clase `bg-slate-50` de fondo (ajena a este cambio), y como es
    ancestro de absolutamente todo, la exclusión `:not(.bg-slate-50 *)` se cumplía siempre (todo
    es "descendiente de un bg-slate-50", el del body) — anulando la regla por completo en toda la
    app. Corregido prefijando cada exclusión con `main ` (`:not(main .bg-slate-50 *)` en vez de
    `:not(.bg-slate-50 *)`, y así con las demás), para que solo cuenten tarjetas reales dentro del
    contenido de la página, no el fondo del body. Verificado con `Element.matches()` directo en
    producción antes y después del fix: el párrafo suelto de `/reportes` pasó de no matchear nunca
    a matchear correctamente, y una celda de tabla dentro de una tarjeta blanca en `/proveedores`
    sigue sin matchear (se queda con su gris normal), confirmando que la exclusión ahora sí
    distingue "suelto sobre el azul" vs "dentro de una tarjeta clara".
  - **Segundo bug encontrado por el usuario**: en los botones tipo pestaña "Materiales/Nómina" y
    "Vista escritorio/Vista campo" de Requisición Nueva, el estado inactivo usa
    `bg-white text-slate-500` **en el mismo elemento** (no dentro de una tarjeta, el propio botón
    trae su fondo blanco). La exclusión anterior solo cubría "es descendiente de un `.bg-white`",
    no "el propio elemento ya es `.bg-white`" — así que el texto se volvía blanco (regla de
    contraste) sobre su propio fondo blanco, quedando invisible. Corregido agregando la pareja
    `:not(.bg-white)` (auto-exclusión, sin el prefijo de ancestro) junto a cada
    `:not(main .bg-white *)` ya existente, para las 8 clases de fondo claro. Verificado con
    `Element.matches()` en producción: el botón "Nómina" (bg-white propio) pasó de `true` a
    `false` en el selector (ya no se le aplica el blanco), y el párrafo suelto de `/reportes`
    se mantiene en `true` (sigue aclarándose correctamente) — ambos casos verificados sin
    regresión antes de desplegar.
  - **Tercer bug, misma familia, encontrado por el usuario**: los `<select>` (y por extensión
    cualquier `<input>`/`<textarea>`) sueltos sobre el azul (ej. el selector de obra del
    Dashboard) tenían el mismo problema pero por una causa distinta — su fondo blanco NO viene de
    una clase `.bg-white` de Tailwind, es el fondo nativo que dibuja el navegador para controles
    de formulario, así que la regla de contraste (que detecta clases, no estilos nativos) no
    podía verlo. Resultado: fondo blanco nativo + texto blanco heredado de `main` = invisible.
    Se hizo un mapeo del proyecto completo (55 `<select>`, 126 `<input>` de texto/número/fecha,
    8 vistas con `<textarea>`) — inviable auditar campo por campo cuál está "suelto" y cuál
    dentro de una tarjeta, así que se optó por la solución robusta: forzar `background-color:#fff`
    y `color:#0f172a` explícitos en la misma regla global de 30px/13px de inputs/selects/
    textareas, sin importar dónde estén. Es seguro porque no existe en todo el proyecto un solo
    campo de formulario con fondo oscuro intencional — todos están pensados como celda clara con
    texto oscuro. Verificado en producción: selector de obra del Dashboard pasó de
    `bg:#fff / color:#fff` (invisible) a `bg:#fff / color:#0f172a` (legible), sin afectar los
    campos que ya vivían dentro de tarjetas blancas (mismo resultado que antes).
  - Barrido de verificación en producción tras el deploy (5 puntos distintos, `getComputedStyle`
    directo): selector de obra suelto en Dashboard, dos `<select>` de filtro sueltos en Equipos
    (incl. `filtroEstatus`), input de fecha suelto en Asistencia, `<textarea>` del modal "Nuevo
    destajo" en Destajos, y un `<select>` dentro de una tarjeta blanca en Requisición Nueva (para
    confirmar que no hay regresión) — los 5 dieron `bg:#fff / color:#0f172a`, ninguno quedó
    invisible. No se encontró ningún caso adicional pendiente en este barrido.

- **Bloque 33** (07/08/2026): 4 de las 5 ideas anotadas el mismo día (la 4, checklist de módulos
  por usuario, se dejó pendiente de platicar el esquema y alcances). Migraciones 026-028.
  - **Fotos en Entrada de Almacén** (remisión + embarque): tablas `fotos_entrada_almacen` /
    `fotos_salida_almacen` (BYTEA, mismo patrón que `documentos_personal`), varias fotos por tipo
    permitidas desde el inicio. Rutas de subir/ver/eliminar (rol Almacenista/Dirección, igual que
    la captura de entradas/salidas). UI en `EntradaAlmacenDetalleView.vue` y
    `SalidaAlmacenDetalleView.vue`: dos secciones con `<input type="file" capture="environment">`
    (cámara trasera) y miniaturas. Importante: el endpoint de fotos requiere JWT (va en el header
    vía el interceptor de axios), así que las miniaturas NO se cargan con un `<img src="...">`
    directo — se traen como blob autenticado y se arma un object URL en memoria, igual que
    `AvatarUsuario.vue`.
  - **Fotos en Salida de Almacén** (personal que recibió + material entregado): mismo patrón y
    mismo componente de subida, tipos `personal`/`material`. "Personal" es evidencia fotográfica
    revisable, no biometría — mismo criterio ya usado en el selfie opcional de Asistencia.
  - **Ligar factura con Entrada de Almacén**: tabla `factura_entrada` (muchos-a-muchos). En
    `FacturaNuevaView.vue`, al elegir la OC aparece un checklist de sus entradas de almacén
    (`GET /entradas-almacen?ocId=`, filtro nuevo) para marcar a cuál(es) remisión(es) corresponde
    la factura — opcional, no afecta el three-way matching existente (que sigue comparando
    factura vs. OC). El backend valida que las entradas marcadas pertenezcan a esa OC antes de
    guardarlas. Se muestran como enlaces en `FacturaDetalleView.vue`.
  - **Formas de pago fijas** (efectivo/transferencia/tarjeta de débito/tarjeta de crédito):
    `pagos_proveedor.forma_pago` pasó de texto libre a `CHECK` (no había datos previos que
    normalizar); `pagos_personal` ganó la misma columna, capturada al "Marcar pagado" (antes no
    existía ahí — decisión del usuario de aplicarlo también a Personal, no solo a Proveedor). En
    `PagosPersonalView.vue` "Marcar pagado" ahora abre un modal pidiendo la forma de pago antes de
    confirmar. Nuevo `frontend/src/lib/formasPago.js` centraliza el catálogo de 4 opciones — se
    usa en 5 vistas (antes cada una lo hubiera repetido a mano) para que el texto mostrado en
    `PagosListView`, `PagoDetalleView` y `ExpedienteView` no muestre la clave cruda
    (`tarjeta_debito`) sino la etiqueta (`Tarjeta de débito`).
  - Probado de punta a punta contra Neon (usuario `direccion`/`almacen`): subida y eliminación de
    foto de remisión y de embarque en una entrada real, subida y eliminación de foto de personal
    en una salida real, factura nueva ligada a una entrada real (se vio correctamente en el
    detalle), pago a proveedor con forma de pago fija aplicado a esa factura, y "Marcar pagado" de
    un pago a personal con el modal de forma de pago — datos de prueba (factura, pago a
    proveedor, pago a personal, fotos) eliminados después sin tocar los registros reales de
    entradas/salidas ya existentes.

- **Filtros de consulta en Entradas y Salidas de Almacén** (07/08/2026): pedido del usuario —
  antes las listas de `/almacen/entradas` y `/almacen/salidas` eran planas, sin forma de acotar
  la búsqueda. Sin migración (solo parámetros de consulta nuevos en endpoints existentes).
  - `GET /entradas-almacen` gana `proveedorId`, `desde`, `hasta`. `GET /salidas-almacen` gana
    `usuarioRecibeNombre` (texto libre, `ILIKE` parcial — es "quien recibió/sacó el material",
    campo de texto libre capturado en la salida, no un catálogo), `obraId`, `desde`, `hasta`. Se
    aprovechó para subir el `LIMIT` de 200 a 500 en ambas, ya que ahora estas pantallas son
    pensadas para *consultar* historial, no solo ver actividad reciente.
  - Frontend: barra de filtros arriba de la tabla en ambas vistas (selects/inputs con `@change`,
    el de texto con `@keyup.enter`/`@blur`), botón "Quitar filtros" que solo aparece si hay algún
    filtro activo, y el mensaje de "sin resultados" distingue "no hay nada capturado" de "nada
    coincide con el filtro".
  - Probado contra Neon: filtro de proveedor sin coincidencias (mensaje correcto) y "Quitar
    filtros" restaurando el listado completo en Entradas; búsqueda parcial insensible a
    mayúsculas ("pedr" encontrando "PEDRO") y sin coincidencias en Salidas.
  - **Nota de caché de la PWA, no relacionada con este cambio en particular pero detectada al
    verificar este deploy**: la primera vez que se abrió `/almacen/entradas` en producción tras
    el deploy, el *service worker* de la PWA sirvió una versión cacheada de la pantalla sin la
    barra de filtros — no era un problema del deploy (el bundle nuevo ya estaba arriba, confirmado
    por hora de modificación), sino la caché del navegador de esa sesión. Al desregistrar el
    service worker y recargar, apareció correcto. Si en el equipo alguien no ve un cambio
    reciente del sistema, probablemente sea esto — cerrar y reabrir la pestaña (o, en el atajo
    instalado del celular, desinstalar/reinstalar si persiste) lo resuelve; no requiere ninguna
    acción de nuestro lado.

- **Bloque 34** (07/08/2026): checklist de módulos visibles por usuario (el pendiente que se
  dejó anotado en el Bloque 33 para platicar el esquema) + eliminar usuarios. Migración 029.
  - **Alcance decidido** (importante tenerlo claro): el checklist controla **qué pantallas ve**
    cada usuario — en el menú y al navegar directo a una URL. **No** afloja ni reemplaza los
    candados de autorización que ya existían por rol (firmas, montos de OC, quién puede crear/
    editar en cada módulo) — esos siguen exactamente igual, atados al rol como siempre. Es una
    capa nueva e independiente encima de lo que ya había. La enforcement es del lado del
    navegador (menú + guard de rutas), no en cada endpoint del API — coherente con que hoy casi
    todos los `GET` del backend ya eran de lectura abierta a cualquier usuario autenticado sin
    importar su rol (la app nunca tuvo, hasta hoy, diferenciación de *qué se puede ver* — solo de
    *qué se puede modificar*), así que esto no baja el nivel de seguridad que ya había, solo
    agrega una capa de visibilidad encima.
  - `usuario_modulos(usuario_id, modulo_clave)` — la clave del módulo es la misma ruta del menú
    (`/requisiciones`, `/almacen/entradas`, etc.), no se inventó un catálogo de claves aparte
    para no tener dos listas que se puedan desincronizar. Todos los usuarios existentes arrancan
    con acceso a todo (mismo comportamiento de siempre) — Dirección ajusta desde ahí en adelante.
  - **"Usuarios" queda fuera del checklist a propósito** — sigue gobernado solo por rol
    (direccion/auditor), para no arriesgar que alguien se quite a sí mismo (o al único
    administrador) el acceso a la pantalla que arregla los permisos.
  - Nuevo `frontend/src/lib/modulosNav.js` — extrae la lista de grupos/ítems del menú que antes
    vivía hardcodeada dentro de `AppShell.vue`, para que el mismo `AppShell.vue` (pinta el menú)
    y `UsuariosView.vue` (checklist de permisos) usen la misma fuente. El router
    (`router/index.js`) también la usa para el guard de navegación directa por URL — si la ruta
    cae dentro de un módulo del menú y el usuario no lo tiene permitido, redirige a Dashboard; si
    la ruta no corresponde a ningún ítem del menú (`/perfil`, `/notificaciones`,
    `/expediente/:id`), no se gatea, son pantallas de apoyo alcanzables por enlace.
  - Login (`/api/auth/login`) ahora devuelve `usuario.modulos` — viaja en la respuesta, no en el
    JWT, así que un cambio de permisos aplica hasta el siguiente inicio de sesión (igual que un
    cambio de rol hoy). Si por lo que sea `modulos` no viene (sesión vieja antes de este cambio),
    se trata como "ver todo" para no dejar a nadie fuera de golpe.
  - **Eliminar usuario** (`DELETE /api/usuarios/:id`, distinto de desactivar): borrado real, pero
    solo se completa si el usuario nunca quedó referenciado en ningún registro de negocio
    (requisiciones, firmas, entradas, facturas, ni siquiera su propia bitácora de auditoría) — se
    apoya en las llaves foráneas que ya existían en cada tabla (no se duplicó esa lógica a mano):
    si Postgres rechaza el `DELETE` por eso, se traduce a un mensaje claro sugiriendo desactivar
    en su lugar, en vez de un error crudo. Nunca se puede eliminar la propia cuenta.
  - Probado de punta a punta contra Neon, con dos usuarios de prueba creados directo por SQL
    (uno rol Dirección para administrar, otro rol Residente para probar el lado de "quién ve")
    — nunca se tocó ninguna cuenta real del equipo: login con `modulos` en la respuesta,
    checklist guardando y reflejándose (quitar "Facturas"/"Pagos" a un usuario y confirmar que
    desaparecen del menú y que `/facturas` redirige a Dashboard al navegar directo), alta de
    usuario nueva con los 22 módulos por default, eliminar bloqueado con mensaje claro sobre un
    usuario real con actividad (sin borrarlo), eliminar exitoso sobre un usuario sin actividad, y
    candado de "no puedes eliminarte a ti mismo" — datos de prueba (2 usuarios + su bitácora)
    eliminados por completo después, sin dejar rastro.
  - **Detectado de paso, no relacionado con este cambio**: la cuenta demo `direccion@struktiva.
    com.mx` está desactivada en producción (reemplazada por la cuenta real de Dirección) y el
    correo de "Fernando" (Superintendente) ya no es el demo `superintendente@struktiva.com.mx` —
    el equipo ya empezó a usar cuentas reales en el sistema en vivo. Bien — solo lo anoto porque
    cambia cuáles credenciales demo siguen sirviendo para pruebas futuras en este documento (ver
    sección "Usuarios demo" al inicio, que puede estar quedándose desactualizada).
  - **Pestañas Activos/Inactivos** (mismo día, ronda separada): el usuario preguntó si al no
    poder eliminar a alguien con actividad se podía al menos "eliminar el usuario como tal y solo
    dejar los registros" — se le explicó la diferencia real entre anonimizar (perder el nombre en
    cada registro) y congelar el nombre como texto en cada una de las ~15 tablas que referencian
    usuarios (cambio grande), y que "Desactivar" ya cubre el caso real ("quitarle acceso, conservar
    todo intacto") sin tocar nada de código — el usuario confirmó que eso es justo lo que
    necesitaba. Pidió, de paso, que los inactivos no "hagan volumen" en la lista de activos.
    Se agregaron dos pestañas tipo tab (mismo patrón visual que Dashboard/Asistencia) — "Activos"
    (default) e "Inactivos" (con nota de "solo consulta" y recordatorio de cómo reactivar) — cada
    una con su contador. Sin cambios de backend, es filtrado en el frontend sobre los mismos datos
    que ya llegaban de `/usuarios`. Probado contra Neon con un usuario Dirección de prueba
    (creado/eliminado por SQL directo, sin tocar cuentas reales): "Activos (8)" excluye
    correctamente a la cuenta demo inactiva, "Inactivos (1)" la muestra sola con el aviso.

- **Bloque 35** (08/08/2026): la ventana de "Personal asignado (Mano de Obra)" dentro de una
  requisición de tipo Materiales ahora calcula sola el total del renglón — pedido explícito del
  usuario. Antes había que capturar cantidad y P.U. del insumo por un lado y el personal por
  otro, y ambos debían "cuadrar" a mano (Bloque 23 original). Se le aplicó el mismo criterio que
  ya usaba la Requisición de Nómina (Bloque 28): el personal ES el renglón, nunca hay nada que
  capturar aparte ni que pueda dejar de cuadrar.
  - Backend: en la rama `materiales` de `POST /requisiciones`, los insumos de la familia Mano de
    Obra ya no reciben `cantidadRequerida`/`precioUnitario` del body — se derivan del desglose de
    personal de ese renglón (`item.personal`, monto directo por persona): P.U. = costo unitario
    presupuestado, cantidad = monto total del renglón ÷ ese costo unitario (misma fórmula que
    Nómina, para poder comparar contra el saldo disponible en la unidad del insumo). El
    `requisicion_personal` de estos renglones ahora se liga a `requisicion_detalle_id` (columna ya
    existente desde el Bloque 28) en vez de guardarse "plano" — los datos viejos (`
    requisicion_detalle_id IS NULL`) se siguen leyendo igual, sin migración de datos.
  - Se eliminó por completo la validación de "cuadrar" (`PERSONAL_NO_CUADRA`) — ya no puede pasar
    estructuralmente.
  - Frontend (`RequisicionNuevaView.vue`): el desglose de personal ahora vive por renglón (antes
    era una sección global al fondo, compartida entre todos los insumos de Mano de Obra de la
    requisición) — para un insumo de esa familia, las celdas de Cant./P.U. se reemplazan por "ver
    desglose ↓" y aparece un mini-formulario embebido (trabajador + monto + lista + **"Suma total
    del cargo"**) que alimenta directo el "Total sugerido" de ese renglón. Igual en la vista móvil.
  - `RequisicionDetalleView.vue`: la tabla de Materiales ahora muestra el personal asignado de
    cada renglón inline (antes solo existía esa tabla para Nómina); la tabla "plana" vieja de
    Personal asignado se queda como respaldo solo para requisiciones ya guardadas antes de este
    cambio.
  - **Bug de redondeo encontrado y corregido de paso (afectaba también a Nómina desde el
    Bloque 28, no es nuevo)**: `cantidad_requerida` se guarda con 4 decimales; al reconstruir el
    total como cantidad × precio, un monto de personal exacto (ej. $850.00) podía mostrarse como
    $850.01 por el redondeo de la cantidad equivalente. Se corrigió `cargarRequisicionCompleta`
    para que, cuando un renglón tiene personal ligado, el total se tome directo de la suma exacta
    de `requisicion_personal.monto` en vez de reconstruirlo — corrige el despliegue tanto en
    Materiales como en Nómina.
  - **Bug real encontrado en pruebas (no en el syntax-check, solo se vio al probar Nómina en
    vivo)**: al quitar la variable `montoManoDeObra` del flujo de materiales quedó una referencia
    huérfana dentro de la rama de Nómina (`montoManoDeObra += montoRenglon`), rompiendo el guardado
    de CUALQUIER requisición de Nómina con un 500. Detectado al probar el flujo de Nómina de punta
    a punta después del cambio (no solo el de Materiales que era el pedido original) — recordatorio
    de por qué se prueban ambos tipos aunque el cambio pedido solo tocara uno.
  - Probado de punta a punta contra Neon: renglón de Materiales con 2 personas ($500+$350=$850.00
    exacto, antes $850.01), Nómina sigue guardando bien (regresión detectada y corregida), y el
    caso de excedente (bloqueado sin justificación, guardado con ella) — las 3 requisiciones de
    prueba eliminadas después.
  - **Pendiente explícito del usuario, no resuelto en este bloque**: verificar que la nómina de
    Pagos a Personal sea donde efectivamente se hace el cargo de lo que aquí se asigna — hoy
    "Personal asignado" en la requisición y "Pagos a Personal" (`/pagos-personal`) son
    independientes, no hay ningún vínculo entre capturar un monto aquí y que aparezca allá. Falta
    decidir si deben conectarse (y cómo) antes de dar esto por cerrado del todo.

- **Bloque 36** (08/08/2026): módulo de **Nómina** completo — responde justo el pendiente que
  quedó abierto en el Bloque 35 ("verificar que la nómina de pagos de personal donde se hace el
  cargo"). Pedido del usuario: generar la nómina semanal o quincenal con su propio consecutivo
  (como una requisición), detectar personal repetido de otra nómina de la misma semana, tener el
  sueldo diario disponible, compensación opcional, la asistencia como respaldo opcional para
  sugerir días trabajados, columna de descuentos con motivo, y registro de vacaciones + avisos de
  antigüedad. Antes de construir se preguntaron 4 decisiones de arquitectura (ver hilo de
  `AskUserQuestion`):
  1. **Nómina reemplaza a Pagos a Personal** (no coexisten como dos flujos activos).
  2. Traslape de la misma semana: **advertir y pedir justificación**, no bloquear (mismo patrón
     que el excedente de presupuesto).
  3. Alcance de vacaciones: **registro de periodos + cálculo de los días que corresponden por
     ley** (no solo bitácora libre).
  4. El toggle de "tomar asistencia en cuenta" es **por persona dentro de cada nómina** (no un
     ajuste global).

  **Nómina (generar/consultar/pagar/cancelar):**
  - Migración `030_nomina.sql`: tablas `nominas` (folio único tipo `NOM-2026-00001` vía
    `siguienteFolio`, periodo semanal/quincenal, fechas, estatus borrador/pagada/cancelada, forma
    de pago del catálogo fijo del Bloque 33, quién generó/quién pagó), `nomina_detalle` (una fila
    por persona: sueldo diario **capturado en ese momento** — no depende de que después cambie el
    sueldo de referencia del expediente —, si usa asistencia, días trabajados, compensación +
    concepto, descuento + motivo, total, y la justificación si hubo traslape) y
    `vacaciones_trabajador` (periodos). Se agregó `'nomina'` al catálogo de categorías de
    notificaciones.
  - Backend nuevo `backend/src/modules/nomina/routes.js` — **reemplaza por completo** el módulo
    viejo `pagosPersonal/routes.js` (borrado, no solo desregistrado). `GET /nomina/sugerencia`
    calcula, para una persona y un rango de fechas, su sueldo diario actual, los días de
    asistencia registrados en ese rango, y si ya aparece en otra nómina no cancelada que se
    traslapa (mismo criterio que huecos de fechas: `fecha_inicio <= hasta AND fecha_fin >= desde`).
    `POST /nomina` vuelve a validar los traslapes en el servidor (nunca confiar solo en lo que
    mandó el frontend), exige justificación si hay traslape, todo en una transacción, y notifica
    por rol Dirección. `POST /:id/marcar-pagada` (solo rol Dirección, exige forma de pago del
    catálogo fijo) y `POST /:id/cancelar`.
  - **El histórico de `pagos_personal` NO se tocó ni se migró** — había un registro real de
    actividad del equipo (con foto real de una persona) capturado antes de este bloque; se dejó
    intacto en su tabla original y se expone de solo lectura en `NominasListView.vue` bajo
    "Historial anterior (antes de Nómina)", para no perder rastro de lo ya capturado. Todo lo
    nuevo entra exclusivamente por `nominas`/`nomina_detalle`.
  - Frontend: `NominasListView.vue` (lista con folio/estatus/totales + el histórico de solo
    lectura ya mencionado), `NominaNuevaView.vue` (selector de periodo que se bloquea en cuanto
    hay personal agregado, tarjeta por persona con sueldo/días/compensación/descuento — el
    descuento se captura en un modal con motivo obligatorio —, bloque rojo de traslape con
    textarea de justificación obligatoria antes de poder guardar), `NominaDetalleView.vue`
    (desglose de solo lectura, imprimible, botón "Marcar pagada" solo para Dirección y "Cancelar
    nómina"). Ruta `/pagos-personal` se mantiene igual (solo cambió la etiqueta del menú a
    "Nómina") a propósito, para no tener que migrar la tabla `usuario_modulos` del Bloque 34.

  **Vacaciones y aviso de antigüedad:**
  - `backend/src/lib/antiguedad.js` (funciones puras, nada se guarda en BD): tabla de la reforma
    "Vacaciones Dignas" (LFT Art. 76, vigente desde 2023) — año 1: 12 días, +2 por año hasta el
    año 5 (14/16/18/20), y desde el año 6, +2 días por cada bloque de 5 años cumplidos de más (22
    en años 6-10, 24 en 11-15…). El "año de servicio" corre de aniversario a aniversario (no es
    el año calendario) — es el periodo contra el que se cuentan los días ya tomados.
  - `GET/POST /trabajadores/:id/vacaciones` y `DELETE .../vacaciones/:vacId` (gestión por
    Residente/Superintendente/Dirección; consulta abierta) — devuelve los periodos registrados
    más el resumen (`aniosCumplidos`, `diasCorresponden`, `diasTomados`, `diasSaldo`,
    `proximoAniversario`, rango del año de servicio vigente). Nueva tarjeta "Vacaciones" en
    `PersonalDetalleView.vue` con el resumen, un grid de 3 estadísticas (Corresponden/Tomados/
    Saldo), la lista de periodos con botón eliminar, y el formulario de alta.
  - `GET /trabajadores/aniversarios` — mismo patrón que el panel de vencimientos de documentos ya
    existente (ventana de 30 días): trae a quién le toca cumplir años de antigüedad pronto, y de
    una vez los días de vacaciones que le van a corresponder a partir de ese aniversario. Nuevo
    panel en `TrabajadoresView.vue`, junto al de vencimientos.
  - **Bug real encontrado y corregido en pruebas**: el panel de aniversarios calculaba los "días
    que corresponden" con la antigüedad **de hoy** en vez de la que la persona **va a tener al
    cumplir el aniversario** que se está avisando — alguien que hoy tiene 5 años cumplidos y está
    a punto de cumplir 6 aparecía con "20 días" (los del año 5) en vez de "22 días" (los que
    realmente le tocan al entrar al año 6). Se corrigió para calcular los días con
    `anios_cumple` (el número que ya se mostraba en el aviso), no con la antigüedad actual.
  - **Bug menor de zona horaria corregido de paso**: `formatoFecha` en `PersonalDetalleView.vue`
    no fijaba `timeZone: 'UTC'` (a diferencia del resto de vistas que manejan fechas tipo DATE) —
    mostraba un día antes del real (ej. "19 ago" en vez de "20 ago"). Corregido para que coincida
    con el patrón ya usado en `NominaDetalleView.vue`/`NominasListView.vue`.
  - Probado de punta a punta contra Neon con un usuario Dirección y un trabajador desechables
    (creados/eliminados por SQL directo, sin tocar ninguna cuenta ni expediente real): generar
    sugerencia de nómina, guardar nómina, marcar pagada, cancelar; registrar un periodo de
    vacaciones y confirmar que el saldo baja, eliminarlo y confirmar que vuelve a subir; panel de
    aniversarios mostrando el aviso con los días corregidos (22, no 20) — todo el rastro de
    prueba (usuario, sus módulos, su bitácora, el trabajador, sus vacaciones) eliminado después.
  - **Pendiente explícito, dejado fuera a propósito** (palabras del usuario: "hay que dejar en
    pendientes ver una forma grafica... algo como un calendario, ver traslapes de vacaciones
    entre empleados... varios temas al respecto para detallar bien ese módulo"): una vista tipo
    calendario para ver de un vistazo a quién le toca vacaciones y cuándo, y detectar traslapes de
    vacaciones **entre distintos empleados** (lo ya construido solo evita que una misma persona
    aparezca en dos nóminas de la misma semana — no compara las vacaciones de una persona contra
    las de otra). Falta definir bien el alcance antes de construirlo. **Resuelto en el Bloque 37.**

- **Bloque 37** (08/08/2026): calendario de vacaciones — resuelve el pendiente que se dejó
  explícitamente abierto en el Bloque 36. Antes de construir se le mostró al usuario una
  maqueta comparando un calendario de mes (casillas por día) contra una línea de tiempo tipo
  Gantt agrupada por oficio, con la recomendación de la segunda (el problema real no es "¿hay
  alguien de vacaciones hoy?" sino "¿me quedo sin fierreros esa semana?", algo que una cuadrícula
  de días no muestra bien) — el usuario la aprobó con un ajuste: que el traslape se marque
  **rellenando la barra de rojo** (no solo un borde), y pidió poder ajustar las fechas de un
  periodo directo desde la barra, dejando la fecha "sugerida" original como punto de partida.
  - Backend (`trabajadores/routes.js`): `GET /trabajadores/vacaciones-calendario?desde=&hasta=
    &obraId=` — trae los periodos de vacaciones de todo el personal activo que caen en el rango,
    con oficio y obra ya incluidos; el cálculo de quién se traslapa con quién se hace en el
    frontend (agrupando por oficio), el backend solo entrega el dato crudo. `PUT
    /trabajadores/:id/vacaciones/:vacId` — nuevo, para editar las fechas de un periodo ya
    registrado (antes solo existía crear/eliminar) — pensado justo para ajustar la fecha
    "sugerida" una vez confirmada la disponibilidad real con la persona, sin tener que borrar y
    volver a capturar.
  - Frontend: `VacacionesCalendarioView.vue` (nueva, ruta `/trabajadores/vacaciones-calendario`,
    enlazada desde `TrabajadoresView.vue` y agregada al menú R.H.) — filtros de obra y rango
    (próximas 8 semanas / este mes / próximos 3 meses), línea de tiempo agrupada por oficio con
    una fila por persona, línea punteada de "hoy", y barras: azul normal, **rojo sólido cuando se
    traslapa con otra persona distinta del mismo oficio** (el traslape de una misma persona en
    dos nóminas de la misma semana ya se cuida aparte, en el módulo de Nómina del Bloque 36 — este
    es un traslape distinto: entre personas). Clic en una barra abre un modal con las fechas
    editables (prellenadas con lo ya registrado) y días, con botón de guardar o eliminar. Debajo
    de la línea de tiempo, un resumen en texto de cada traslape detectado ("Fulano y Zutano
    (oficio) se traslapan del … al …").
  - Probado de punta a punta contra Neon con un usuario Dirección y tres trabajadores desechables
    (dos del mismo oficio de prueba con periodos que se cruzan, uno de otro oficio sin cruce):
    confirmado que ambas barras del oficio cruzado salen en rojo sólido (no solo borde), que el
    resumen de traslape calcula bien la intersección de fechas, que editar una fecha desde la
    barra hasta que deja de cruzarse hace que el aviso de traslape desaparezca solo, y que
    eliminar desde el mismo modal quita la barra — todo el rastro de prueba (usuario, sus
    módulos, su bitácora, los tres trabajadores y sus vacaciones) eliminado después.
