# Tus Antojos

La empresa “Tus Antojos” necesita mejorar la administración de sus operaciones comerciales mediante la implementación de una plataforma digital que permita optimizar la gestión de sus productos y servicios.

Sistema de punto de venta y gestión: caja (con modo sin conexión), pantalla de cocina en tiempo real, inventario tipo kardex basado en recetas, pagos en efectivo y QR, tickets térmicos y reportes.

grupo  conformado por 5 personas que nos ayudará a distribuir mejor la organización de responsabilidades, mantener una comunicación directa y reducir la complejidad de desarrollo por esta razón se considera el uso de un arquitectura monolito modular, que permitirá organizar la plataforma en módulos funcionales con responsabilidades definidas. Esta estructura facilitará el mantenimiento, las pruebas y la incorporación de nuevas funcionalidades, como promociones, pagos digitales y reportes administrativos.


> Estado: módulo **platform** (base del sistema: monorepo, autenticación por roles, usuarios, CI y despliegue). Caja, cocina e inventario están en construcción.

## Stack

| Capa    | Tecnología                                                                                   |
| ------- | -------------------------------------------------------------------------------------------- |
| Web     | React 19, Vite, TypeScript, Tailwind CSS 4, shadcn/ui, TanStack Query, React Hook Form + Zod |
| API     | NestJS 12 (Express), pino, Sentry                                                            |
| Datos   | Supabase: PostgreSQL, Auth, Storage, Realtime (RLS de solo lectura para el cliente)          |
| Calidad | Vitest, Playwright, ESLint, Prettier, GitHub Actions                                         |

**Regla de arquitectura:** la API es la única que escribe. La web lee de Supabase (limitada por RLS) y escribe siempre a través de la API, que usa funciones SQL atómicas.

## Requisitos

- Node.js 22 (`.nvmrc`) y pnpm 10 (`corepack enable pnpm`)
- Docker (para Supabase local)

## Arranque local

```bash
pnpm install
pnpm db:start     # Supabase local en Docker: migraciones + usuarios de prueba (la 1.ª vez descarga varias imágenes)
pnpm env:local    # crea apps/api/.env y apps/web/.env con las claves locales (no sobrescribe)
pnpm dev          # web en http://localhost:5173 · API en http://localhost:3000
```

Usuarios de prueba (solo existen en local), contraseña `TusAntojos-local-2026`:

| Correo                   | Rol           | Pantalla                      |
| ------------------------ | ------------- | ----------------------------- |
| `cajero@tusantojos.test` | Cajero        | `/caja`                       |
| `cocina@tusantojos.test` | Cocina        | `/cocina`                     |
| `admin@tusantojos.test`  | Administrador | `/admin` (incluye _Usuarios_) |

Supabase Studio queda en http://127.0.0.1:54323. Para apagar Supabase: `pnpm db:stop`.

### Problemas comunes

- **La API responde `db: error` o 401 con usuarios válidos tras regenerar claves.** Las claves de `pnpm supabase status` se firman con `supabase/signing_keys.json`. Si ese archivo cambió, reinicia Supabase y regenera los `.env`: `pnpm db:stop && pnpm db:start`, borra `apps/api/.env` y `apps/web/.env`, y ejecuta `pnpm env:local`.
- **Docker Desktop: `mounts denied`.** La carpeta del proyecto debe estar compartida con Docker (_Settings → Resources → File Sharing_).

## Comandos

```bash
pnpm lint             # ESLint en todo el monorepo
pnpm format:check     # Prettier (pnpm format para corregir)
pnpm typecheck        # TypeScript estricto en todos los paquetes
pnpm test             # pruebas unitarias (no necesitan Docker)
pnpm test:db          # pruebas contra Supabase local: permisos, RLS, RPC e integración de la API
pnpm test:e2e         # Playwright: levanta la API y la web contra Supabase local
pnpm build            # compila shared, api y web

pnpm db:reset         # reinicia la base local (migraciones + seed)
pnpm db:types         # regenera los tipos de la base en packages/shared
pnpm supabase migration new <nombre>   # nueva migración en supabase/migrations
```

## Estructura

```
apps/web/          React PWA (caja, cocina, administración)
apps/api/          API NestJS (módulos por dominio en src/modules)
packages/shared/   Esquemas Zod, tipos y contratos compartidos por web y API
supabase/          Migraciones, seed local y pruebas de base de datos
scripts/           Utilidades del entorno local
docs/              Documentación (despliegue)
.github/workflows/ CI
```

## Imagen Docker de la API (opcional)

Para probar la API en un contenedor antes de desplegar:

```bash
docker build -f apps/api/Dockerfile -t tus-antojos-api:local .
```

Es solo una imagen de prueba local (~500 MB): ni `pnpm dev`, ni las pruebas, ni el CI, ni el despliegue la usan (Railway construye la suya desde el mismo `Dockerfile`). Se puede borrar sin riesgo con `docker image rm tus-antojos-api:local` y volver a construir cuando haga falta. Para ejecutarla y las variables que necesita, ver [docs/deployment.md](docs/deployment.md#3-api-en-railway).

## Despliegue

Supabase Cloud + Railway (API) + Vercel (web) + Sentry. Paso a paso, variables por plataforma y manejo de secretos: [docs/deployment.md](docs/deployment.md).
