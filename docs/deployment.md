# Despliegue de Tus Antojos

Esta guía deja el sistema funcionando en la nube. La configuración ya está en el repositorio; lo que falta son **tus cuentas y tus secretos**, que cargas tú directamente en cada plataforma.

| Pieza                                  | Plataforma                                       | Archivo en el repo                                                   |
| -------------------------------------- | ------------------------------------------------ | -------------------------------------------------------------------- |
| Base de datos, Auth, Storage, Realtime | Supabase Cloud                                   | `supabase/migrations/`, `supabase/config.toml`                       |
| API (NestJS)                           | Railway (alternativas: Render, Fly.io)           | `apps/api/Dockerfile`, `apps/api/railway.json`                       |
| Web (React PWA)                        | Vercel (alternativas: Netlify, Cloudflare Pages) | `apps/web/vercel.json`                                               |
| Errores                                | Sentry                                           | `apps/api/src/observability/sentry.ts`, `apps/web/src/lib/sentry.ts` |
| CI                                     | GitHub Actions                                   | `.github/workflows/ci.yml`                                           |

---

## 0. Regla de oro de los secretos

- Los secretos **nunca** van al repositorio, a un issue, a un PR ni al chat con el asistente.
- Cada valor se pega **directamente** en el panel de variables de entorno de su plataforma.
- `.env`, `.env.*` (salvo `.env.example`) y `supabase/signing_keys.json` están en `.gitignore`.
- Si un secreto se filtra: rótalo en su plataforma (Supabase → _API Keys_, Sentry → _Client Keys_) y actualiza la variable donde se use.

| Secreto                                                         | Dónde vive       | Quién lo usa                                        |
| --------------------------------------------------------------- | ---------------- | --------------------------------------------------- |
| `SUPABASE_SERVICE_ROLE_KEY` (o la _secret key_ `sb_secret_…`)   | Railway          | Solo la API. **Jamás** en Vercel ni en el navegador |
| `SUPABASE_JWT_SECRET` (solo proyectos con firma HS256 heredada) | Railway          | Solo la API                                         |
| DSN de Sentry                                                   | Railway y Vercel | No es secreto crítico, pero no lo publiques         |

La clave **pública** de Supabase (_publishable_ `sb_publishable_…` o _anon_) sí puede ir en Vercel: viaja al navegador y RLS la limita a solo lectura.

---

## 1. Variables por plataforma

### Railway (API)

| Variable                                   | Valor                                                                                | Obligatoria                 |
| ------------------------------------------ | ------------------------------------------------------------------------------------ | --------------------------- |
| `NODE_ENV`                                 | `production`                                                                         | Sí                          |
| `SUPABASE_URL`                             | `https://<ref>.supabase.co`                                                          | Sí                          |
| `SUPABASE_SERVICE_ROLE_KEY`                | Supabase → _Project Settings → API Keys_ → service role / secret                     | Sí                          |
| `CORS_ORIGINS`                             | URL de la web, p. ej. `https://tus-antojos.vercel.app` (varias: separadas por comas) | Sí                          |
| `APP_VERSION`                              | `${{RAILWAY_GIT_COMMIT_SHA}}` (variable de referencia de Railway)                    | Recomendada                 |
| `LOG_LEVEL`                                | `info`                                                                               | No (por defecto `info`)     |
| `SENTRY_DSN`                               | DSN del proyecto Sentry de la API                                                    | No                          |
| `SENTRY_ENVIRONMENT`                       | `production` o `staging`                                                             | No (por defecto `NODE_ENV`) |
| `SUPABASE_JWT_SECRET`                      | Solo si el proyecto firma los JWT con HS256 (ver §2.3)                               | No                          |
| `SUPABASE_JWKS_URL`, `SUPABASE_JWT_ISSUER` | Solo si usas un dominio propio para Auth                                             | No                          |
| `PORT`                                     | **No la definas**: Railway la inyecta y la API la usa                                | —                           |

### Vercel (web)

| Variable                  | Valor                                                                             | Obligatoria |
| ------------------------- | --------------------------------------------------------------------------------- | ----------- |
| `VITE_SUPABASE_URL`       | `https://<ref>.supabase.co`                                                       | Sí          |
| `VITE_SUPABASE_ANON_KEY`  | Clave **pública** (_publishable_ o _anon_)                                        | Sí          |
| `VITE_API_URL`            | URL pública de la API en Railway, p. ej. `https://tus-antojos-api.up.railway.app` | Sí          |
| `VITE_SENTRY_DSN`         | DSN del proyecto Sentry de la web                                                 | No          |
| `VITE_SENTRY_ENVIRONMENT` | `production` o `preview`                                                          | No          |

`VITE_APP_VERSION` no hace falta: `vercel.json` la toma de `VERCEL_GIT_COMMIT_SHA` al compilar.

> Las variables `VITE_*` se incrustan **al compilar**. Si cambias una, vuelve a desplegar.
> La web rechaza al arrancar una clave secreta pegada por error en `VITE_SUPABASE_ANON_KEY`.

### GitHub Actions

El CI **no necesita secretos** (usa un Supabase local en Docker). Si más adelante se agrega un despliegue desde Actions, los secretos se cargan con la CLI, que pide el valor sin mostrarlo:

```bash
gh secret set NOMBRE_DEL_SECRETO   # en la terminal del asistente: ! gh secret set NOMBRE_DEL_SECRETO
```

---

## 2. Supabase Cloud

### 2.1 Crear el proyecto

1. Crea un proyecto en una región cercana a los usuarios (y a la región de Railway).
2. Guarda la contraseña de la base de datos en tu gestor de contraseñas.

### 2.2 Configurar Auth (_Authentication → Sign In / Providers_ y _URL Configuration_)

- **Desactiva** _Allow new users to sign up_: solo un admin crea usuarios.
- _Site URL_: la URL de la web en Vercel.
- _Redirect URLs_: la URL de la web (y la de _preview_ de Vercel si la usas).

### 2.3 Claves de firma de los JWT

La API verifica los tokens con las claves públicas del proyecto (JWKS, ES256/RS256). Los proyectos nuevos usan claves asimétricas por defecto. Compruébalo en _Project Settings → JWT Keys_:

- Si la clave actual es **ECC (ES256)** o **RSA**: no hagas nada.
- Si el proyecto aún usa el **secreto compartido (HS256)**: lo ideal es migrar a claves asimétricas desde ese panel. Mientras tanto, define `SUPABASE_JWT_SECRET` en Railway.

### 2.4 Aplicar las migraciones

Desde la raíz del repo (los comandos interactivos, en la terminal del asistente, con `!`):

```bash
! pnpm supabase login
pnpm supabase link --project-ref <ref-del-proyecto>
pnpm supabase db push
```

`db push` aplica `supabase/migrations/` y **no** ejecuta `seed.sql` (los usuarios de prueba solo existen en local).

### 2.5 Crear el primer admin

El panel de Supabase no permite fijar `app_metadata.role`, y el trigger de perfiles rechaza usuarios sin rol. Usa el script:

1. Crea `apps/api/.env.cloud` (está en `.gitignore`) con:
   ```bash
   SUPABASE_URL=https://<ref>.supabase.co
   SUPABASE_SERVICE_ROLE_KEY=<service role / secret key>
   ```
2. Ejecuta (pide la contraseña sin mostrarla):
   ```bash
   ! pnpm --filter @tus-antojos/api admin:create --credentials .env.cloud --email tu@correo.com --name "Tu Nombre"
   ```
3. **Borra `apps/api/.env.cloud`** al terminar. El resto de usuarios se crean desde la web (_Administración → Usuarios_).

### 2.6 Verificación en la nube (pendiente, hazla una vez)

`admin_update_user` escribe en `auth.users` y `auth.sessions` desde SQL. En local funciona; en Supabase Cloud el esquema `auth` tiene restricciones (no se permite modificar su estructura; los datos sí deberían poder escribirse, pero no está verificado). Después del primer despliegue:

1. Crea un segundo usuario desde la web, cámbiale el rol y desactívalo.
2. Si alguna de esas acciones da error 500, revisa el log de la API (Railway) y avisa: la alternativa es hacer esos cambios con la API de administración de Auth.

---

## 3. API en Railway

1. _New Project → Deploy from GitHub repo_ y elige el repositorio (privado: autoriza a Railway).
2. En el servicio: _Settings → Config-as-code → Railway Config File_ = `apps/api/railway.json`. Así usa `apps/api/Dockerfile` (construido desde la raíz del monorepo) y el health check `/health`.
3. _Variables_: las de §1 (Railway).
4. _Networking → Generate Domain_ para obtener la URL pública.
5. Verifica: `https://<api>/health` debe responder `{"status":"ok","db":"ok","version":"<sha>"}`.

**Render / Fly.io:** el mismo `apps/api/Dockerfile` sirve. Contexto de build = raíz del repo, health check = `/health`, puerto = el que la plataforma inyecte en `PORT`.

Probar la imagen en local (opcional):

```bash
docker build -f apps/api/Dockerfile -t tus-antojos-api .
docker run --rm -p 3000:3000 --env-file apps/api/.env.cloud -e NODE_ENV=production tus-antojos-api
```

---

## 4. Web en Vercel

1. _Add New → Project_ e importa el repositorio.
2. _Root Directory_ = `apps/web`. Vercel detecta el monorepo pnpm y `apps/web/vercel.json` define instalación, build (compila `@tus-antojos/shared` primero), salida `dist`, redirección de la SPA a `index.html`, caché de `/assets` y encabezados de seguridad.
3. Deja activado _Include files outside of the Root Directory in the Build Step_ (lo necesita el monorepo).
4. _Environment Variables_: las de §1 (Vercel), al menos para _Production_.
5. Despliega y agrega la URL resultante a `CORS_ORIGINS` (Railway) y a _Site URL_ (Supabase).

**Netlify / Cloudflare Pages:** build `pnpm --filter @tus-antojos/shared build && pnpm --filter @tus-antojos/web build`, salida `apps/web/dist`, y la regla de SPA `/*  /index.html  200` (archivo `_redirects` en `apps/web/public/`).

---

## 5. Sentry

1. Crea dos proyectos: uno **Node.js** (API) y uno **React** (web).
2. Copia cada DSN en `SENTRY_DSN` (Railway) y `VITE_SENTRY_DSN` (Vercel).
3. Qué se envía: solo errores 5xx de la API (con `release` y la etiqueta `request_id`, para cruzarlos con los logs) y errores no controlados de la web. Sin cookies, cuerpos, parámetros de URL, correos ni IPs.

---

## 6. GitHub

- Repositorio **privado**: cada ejecución de Actions consume minutos de la cuenta; el job `integration` (Supabase + E2E) es el más pesado.
- Recomendado: _Settings → Branches → Branch protection_ en `main`, exigiendo los checks **Calidad** e **Integración** antes de hacer merge.

---

## 7. Orden recomendado y verificación final

1. Supabase (§2.1–2.4) → 2. Railway (§3) → 3. Vercel (§4) → 4. Completar `CORS_ORIGINS` y _Site URL_ con la URL de Vercel → 5. Primer admin (§2.5) → 6. Sentry (§5).

Verificación:

- [ ] `GET https://<api>/health` → `db: ok` y la versión es el SHA desplegado.
- [ ] El admin inicia sesión en la web y llega a _Administración_.
- [ ] Crea un cajero desde _Administración → Usuarios_; el cajero inicia sesión y llega a _Caja_.
- [ ] Cambiar el rol y desactivar a ese cajero funciona (§2.6).
- [ ] Un error forzado aparece en Sentry con `release` y `request_id`.
