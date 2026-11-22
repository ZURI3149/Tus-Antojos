# Tus Antojos

La empresa “Tus Antojos” necesita mejorar la administración de sus operaciones comerciales mediante la implementación de una plataforma digital que permita optimizar la gestión de sus productos y servicios.

Sistema de punto de venta y gestión: caja (con modo sin conexión), pantalla de cocina en tiempo real, inventario tipo kardex basado en recetas, pagos en efectivo y QR, tickets térmicos y reportes.

grupo conformado por 5 personas que nos ayudará a distribuir mejor la organización de responsabilidades, mantener una comunicación directa y reducir la complejidad de desarrollo por esta razón se considera el uso de un arquitectura monolito modular, que permitirá organizar la plataforma en módulos funcionales con responsabilidades definidas. Esta estructura facilitará el mantenimiento, las pruebas y la incorporación de nuevas funcionalidades, como promociones, pagos digitales y reportes administrativos.

> Estado: módulos **platform** (monorepo, autenticación por roles, usuarios, CI y despliegue), **catalog** (categorías, insumos, productos con receta y foto), **inventory** (stock, compras, mermas y kardex) y **promotions** (descuentos por porcentaje o monto fijo con vigencia y vista previa). Pedidos, caja y cocina en construcción.

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

| Correo                   | Rol           | Pantalla                       |
| ------------------------ | ------------- | ------------------------------ |
| `cajero@tusantojos.test` | Cajero        | `/caja`                        |
| `cocina@tusantojos.test` | Cocina        | `/cocina`                      |
| `admin@tusantojos.test`  | Administrador | `/admin` (catálogo y usuarios) |

La base local trae un menú de ejemplo: 3 categorías, 8 insumos y 7 productos (6 activos con receta y 1 inactivo).

Supabase Studio queda en http://127.0.0.1:54323. Para apagar Supabase: `pnpm db:stop`.

### Problemas comunes

- **La API responde `db: error` o 401 con usuarios válidos tras regenerar claves.** Las claves de `pnpm supabase status` se firman con `supabase/signing_keys.json`. Si ese archivo cambió, reinicia Supabase y regenera los `.env`: `pnpm db:stop && pnpm db:start`, borra `apps/api/.env` y `apps/web/.env`, y ejecuta `pnpm env:local`.
- **Docker Desktop: `mounts denied`.** La carpeta del proyecto debe estar compartida con Docker (_Settings → Resources → File Sharing_).

## Catálogo (administrador)

| Pantalla                                          | Qué se hace                                                                                                           |
| ------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------- |
| `/admin/categorias`                               | Alta, nombre, orden y activar/desactivar. No se desactiva una categoría con productos activos                         |
| `/admin/insumos`                                  | Alta con su medida (peso, volumen o unidades) y búsqueda. La medida se bloquea cuando el insumo ya está en una receta |
| `/admin/productos`                                | Lista con búsqueda, filtro por categoría y estado, y miniatura de la foto                                             |
| `/admin/productos/nuevo` y `/admin/productos/:id` | Datos, precio en Bs, receta (cantidades en g/kg, ml/L o unidades) y estado. En la edición, además, la foto            |

Reglas que conviene conocer:

- **Un producto solo se activa con receta**, con todos sus insumos y su categoría activos. El interruptor _Activo_ explica qué falta.
- **Nada se borra**: categorías, insumos y productos se desactivan, porque las ventas y el kardex los referencian.
- **Precios en centavos y cantidades en unidad base** (`12,50` → `1250`; `1,5 kg` → `1500 g`).
- **Fotos**: JPG, PNG o WebP de hasta 2 MB. El navegador las reduce a WebP de máx. 800 px y las sube directo a Supabase Storage con una URL firmada que emite la API; al reemplazarlas se borra la anterior.

## Promociones (administrador)

| Pantalla                                              | Qué se hace                                                                                                       |
| ----------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------- |
| `/admin/promociones`                                  | Lista con estado (vigente, programada, vencida, desactivada), descuento, vigencia y botón para activar/desactivar |
| `/admin/promociones/nueva` y `/admin/promociones/:id` | Alta y edición con selector de productos por categoría y vista previa en tiempo real de los precios calculados    |

Reglas de promociones:

- **Descuento por porcentaje o monto fijo**: se calcula por unidad sobre el precio del producto y se redondea al centavo. Un monto fijo mayor al precio se recorta a 0.
- **Sin acumulación**: si varias promociones vigentes aplican a un mismo producto, se otorga automáticamente la de mayor beneficio por unidad.
- **Vigencia en hora de Bolivia**: inicio obligatorio y fin opcional con zona horaria `America/La_Paz` (`-04:00`).

## Caja (cajero)

| Pantalla          | Qué se hace                                                                                                               |
| ----------------- | ------------------------------------------------------------------------------------------------------------------------- |
| `/caja`           | Carrito con promociones aplicadas, cobro en efectivo (con cambio) o QR, e impresión del ticket                            |
| `/caja/pedidos`   | Pedidos del día: entregar, anular los propios, **Reimprimir** el ticket y la sección **Sin sincronizar** (cola offline)   |
| `/caja/impresora` | Cómo imprimir en esta caja: navegador o impresora, papel de 80/58 mm, impresión automática, encabezado y ticket de prueba |

**Sin conexión** (detalle en [READMEPWA.md](READMEPWA.md), sección 7):

- Si ya se inició sesión, la caja abre sin red con el catálogo guardado ("Catálogo del dd/mm hh:mm") y el aviso **Modo sin conexión**.
- Se cobra **solo en efectivo**. El pedido queda en la cola con número provisional `OFF-XXXX` y se imprime con "PENDIENTE DE SINCRONIZAR".
- Al volver la red los pedidos se envían solos, sin duplicarse. Los que el servidor rechace quedan **por revisar** en `/caja/pedidos` para reintentarlos o descartarlos con un motivo.
- Para probarlo en local hace falta el build de producción (en `pnpm dev` el service worker está apagado): `pnpm --filter @tus-antojos/web build && pnpm --filter @tus-antojos/web preview`, y en DevTools → Network marcar **Offline**.

**Impresora**: por defecto se imprime con el diálogo del navegador. Si una impresora térmica muestra símbolos raros en lugar de tildes, activar **Solo caracteres básicos**. La conexión directa por USB/serie (Web Serial / WebUSB) está pendiente de conocer el modelo de impresora.

## Comandos

```bash
pnpm lint             # ESLint en todo el monorepo
pnpm format:check     # Prettier (pnpm format para corregir)
pnpm typecheck        # TypeScript estricto en todos los paquetes
pnpm test             # pruebas unitarias (no necesitan Docker)
pnpm test:db          # pruebas contra Supabase local: permisos, RLS, RPC e integración de la API
pnpm test:e2e         # Playwright: levanta la API y la web contra Supabase local (incluye el proyecto
                      # `offline`, que corre sobre el build de producción con service worker)
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

## Empaquetado y ejecución con Docker

El proyecto está completamente preparado para ejecutarse con Docker y Docker Compose:

| Componente           | Dockerfile            | Base                     | Puerto por defecto   | Descripción                                                      |
| :------------------- | :-------------------- | :----------------------- | :------------------- | :--------------------------------------------------------------- |
| **API** (`apps/api`) | `apps/api/Dockerfile` | `node:22-bookworm-slim`  | `3000`               | NestJS 12 compilado, healthcheck en `/health`                    |
| **Web** (`apps/web`) | `apps/web/Dockerfile` | `nginx:1.27-alpine-slim` | `8080` (host) → `80` | Build Vite SPA con Nginx, compresión gzip, caché PWA y seguridad |

### Levantar el proyecto con Docker Compose

1. Inicia la base de datos local y asegúrate de tener las claves de entorno:
   ```bash
   pnpm db:start
   pnpm env:local
   ```
2. Construye y levanta los servicios:
   ```bash
   pnpm docker:build   # construye las imágenes (docker compose build)
   pnpm docker:up      # levanta los contenedores (docker compose up -d)
   ```
3. Acceso a los servicios:
   - **Web:** [http://localhost:8080](http://localhost:8080)
   - **API:** [http://localhost:3000](http://localhost:3000) (Estado: [http://localhost:3000/health](http://localhost:3000/health))
   - **Supabase Studio:** [http://localhost:54323](http://localhost:54323)

4. Otros comandos útiles:
   ```bash
   pnpm docker:logs    # ver logs de los contenedores
   pnpm docker:down    # detener y remover los contenedores
   ```

Para personalizar variables o apuntar a Supabase Cloud, copia [.env.example](.env.example) al `.env` de la raíz:

```bash
cp .env.example .env
```

Docker Compose lee ese `.env` para rellenar las variables de `docker-compose.yml`, incluidas las `VITE_*`, que se usan al **construir** la imagen web: si cambias alguna, vuelve a ejecutar `pnpm docker:build`. La API recibe además `apps/api/.env` y el `.env` de la raíz.

| Archivo         | Uso                                                   |
| :-------------- | :---------------------------------------------------- |
| `.env` (raíz)   | Docker Compose (`pnpm docker:*`)                      |
| `apps/api/.env` | API en desarrollo (`pnpm dev`) y contenedor de la API |
| `apps/web/.env` | Web en desarrollo (`pnpm dev`)                        |

Todos se generan o copian desde su `.env.example` y están en `.gitignore`.

## Despliegue

Supabase Cloud + Railway (API) + Vercel (web) + Sentry. Paso a paso, variables por plataforma y manejo de secretos: [docs/deployment.md](docs/deployment.md).
