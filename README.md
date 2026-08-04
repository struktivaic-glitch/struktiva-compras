# Struktiva · Control de Compras y Requisiciones

Sistema web de control de compras y requisiciones de obra, réplica operativa del módulo de
Compras de Neodata ERP. Construido para Struktiva Ingeniería y Construcción, S.A. de C.V.

## Stack

- **Backend**: Node.js + Fastify 5 (API REST), PostgreSQL 16, Redis 7.
- **Frontend**: Vue 3 + Vite + Tailwind CSS (SPA, mobile-first).
- **Auth**: JWT propio (usuario/contraseña + rol), sin proveedor externo.

## Estructura

```
ERP STRUKTIVA/
├── backend/            API Fastify
│   └── src/
│       ├── db/          pool, migraciones (.sql), seeds, scripts
│       ├── modules/     auth, catalogo, requisiciones (uno por dominio de negocio)
│       ├── plugins/     auth (JWT + guard de roles)
│       └── lib/         utilidades (bitácora de auditoría, etc.)
├── frontend/            SPA Vue 3 + Vite + Tailwind
│   └── src/
│       ├── views/        Login, Dashboard, Requisiciones (lista y captura)
│       ├── components/   AppShell (topbar+nav), BrandMark
│       └── stores/        auth (Pinia)
├── docker-compose.yml   Postgres + Redis para desarrollo/producción
└── PENDIENTES-STRUKTIVA.md   Checklist de lo que falta de tu lado
```

## Alcance de este bloque (Bloque 4)

Ya implementado, de punta a punta (DB → API → UI):
- Catálogo maestro: Obras → Etapas → Frentes → Partidas → Explosión de insumos.
- **Requisiciones**: captura con autocompletado de insumos, control de saldo
  (`Saldo Disponible = Presupuestada − Σ Aprobada`), bloqueo de guardado con
  justificación técnica obligatoria si excede, ciclo de estados
  (Borrador → Pendiente de autorización → Autorizada → Cancelada), bitácora de auditoría.
- Autenticación con roles (Residente, Superintendente, Comprador, Almacenista, Dirección, Auditor).

Pendiente para bloques siguientes (ya definido en el modelo de datos, no implementado aún):
Cotizaciones/cuadro comparativo, Órdenes de Compra, Entradas/Salidas de Almacén, Facturación y
CxP, Pagos a proveedor, Expediente de trazabilidad y Reportes imprimibles.

## Cómo correrlo localmente

**Requisitos**: Node.js 20+, y **Docker Desktop** (para Postgres/Redis) — o una instalación local
de PostgreSQL 16 si prefieres no usar Docker. *(Ninguno de los dos está instalado en esta máquina
todavía — ver `PENDIENTES-STRUKTIVA.md`.)*

```bash
# 1. Levantar Postgres + Redis
docker compose up -d

# 2. Backend
cd backend
cp .env.example .env
npm install
npm run migrate
npm run seed
npm run dev          # http://localhost:4000

# 3. Frontend (en otra terminal)
cd frontend
npm install
npm run dev           # http://localhost:5173
```

**Usuarios demo** (creados por el seed, contraseña `struktiva123` para todos):
- `residente@struktiva.com.mx`
- `superintendente@struktiva.com.mx` (puede autorizar)
- `direccion@struktiva.com.mx` (puede autorizar)
- `compras@struktiva.com.mx`, `almacen@struktiva.com.mx`, `auditor@struktiva.com.mx`

Cambia estas contraseñas antes de usar el sistema con datos reales (`npm run hash -- "<nueva>"`
dentro de `backend/` genera un hash nuevo para reemplazar en la base).

## Estado de las pruebas en esta máquina

Docker y PostgreSQL no están instalados aquí, así que no pude correr el flujo completo
(login real → dashboard con saldos → crear requisición → bloqueo por excedente) contra una base
de datos real. Sí se verificó en este entorno:
- El backend arranca sin errores y expone `/api/health`.
- El login intenta conectar a Postgres correctamente y responde con un error controlado y
  amigable cuando no hay base de datos (antes devolvía el error crudo de Fastify; se corrigió
  agregando un manejador de errores global).
- El frontend compila y renderiza sin errores de consola; el guard de rutas y el interceptor de
  sesión (redirección a `/login` si el token es inválido) funcionan correctamente.

En cuanto instales Docker Desktop (o Postgres local), corre los pasos de arriba y ya deberías
tener el flujo completo funcionando con los datos de ejemplo de Horizontes/Etapa 3/Drenajes.
