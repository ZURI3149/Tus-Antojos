# Tus Antojos como PWA

Tus Antojos es una **PWA** (Progressive Web App): una aplicación web que se puede **instalar** en la computadora, la tablet o el celular y que funciona como una app nativa, sin tiendas de aplicaciones de por medio.

Este documento explica **por qué** elegimos este enfoque y **cómo** está configurado.

---

## ¿Qué es una PWA?

Una PWA es una página web que cumple tres condiciones:

1. Se sirve por **HTTPS**.
2. Tiene un **manifest** (`manifest.webmanifest`) con su nombre, íconos y colores.
3. Registra un **service worker**, un script que corre en segundo plano y guarda la app en caché.

Con eso, el navegador ofrece **"Instalar aplicación"** y la app se abre en su propia ventana, con su ícono, igual que un programa instalado.

---

## ¿Por qué es buena para Tus Antojos?

### 1. La caja no se detiene si se cae el internet

En un negocio de comida, una caída de conexión no puede frenar las ventas. El service worker guarda la app completa en el dispositivo, así que **la caja abre y funciona sin conexión**. Cuando el módulo `offline-print` esté listo, los pedidos hechos sin red se guardarán en el dispositivo y se sincronizarán solos al volver la conexión (solo con pago en efectivo, según el SPEC).

### 2. Una sola aplicación para todos los dispositivos

| Rol            | Dispositivo típico | Con PWA                                           |
| -------------- | ------------------ | ------------------------------------------------- |
| Caja           | PC o laptop        | Se instala desde Chrome o Edge                    |
| Cocina         | Tablet             | Se instala desde Chrome (Android) o Safari (iPad) |
| Administración | Laptop o celular   | Se instala o se usa en el navegador               |

No hace falta desarrollar ni mantener una app para Windows, otra para Android y otra para iOS: **es el mismo código** (React).

### 3. Sin tiendas de aplicaciones

- No hay que publicar en Google Play ni en la App Store.
- No hay revisiones, cuotas ni esperas de aprobación.
- Instalarla es tan simple como abrir la URL y pulsar "Instalar".

### 4. Actualizaciones inmediatas y controladas

Cada vez que se despliega en Vercel, la app detecta la versión nueva. En lugar de recargarse sola (lo que podría **borrar un pedido a medio cobrar**), muestra un aviso con **Actualizar** y **Más tarde**. Además, revisa si hay versión nueva cada hora, porque la caja y la cocina pasan el día abiertas.

### 5. Carga rápida

La app queda guardada en el dispositivo: al abrirla no descarga de nuevo el código, los estilos ni las fuentes. Las fotos del catálogo también se guardan en caché, así que se ven aunque la red esté lenta.

### 6. Acceso al hardware del local

Chrome y Edge permiten que una aplicación web se comunique con dispositivos por **WebUSB** y **Web Serial**. Así la caja puede imprimir tickets directamente en una **impresora térmica de 80 mm** sin instalar programas extra (el permiso ya está habilitado en `vercel.json`).

### 7. Experiencia de app real

- Ventana propia, sin barra de direcciones ni pestañas que distraigan.
- Ícono en el escritorio, la barra de tareas o la pantalla de inicio.
- Se abre directamente en pantalla completa en las tablets de cocina.

### 8. Bajo costo de desarrollo

Para un proyecto universitario (y para un negocio pequeño), mantener **un solo proyecto web** es mucho más barato y simple que mantener aplicaciones nativas por plataforma.

---

## Comparación rápida

|                          | Página web normal | **PWA (Tus Antojos)**    | App nativa           |
| ------------------------ | ----------------- | ------------------------ | -------------------- |
| Se instala con ícono     | No                | **Sí**                   | Sí                   |
| Funciona sin internet    | No                | **Sí**                   | Sí                   |
| Necesita tienda de apps  | No                | **No**                   | Sí                   |
| Un solo código para todo | Sí                | **Sí**                   | No                   |
| Actualización            | Inmediata         | **Inmediata, con aviso** | Depende de la tienda |
| Impresora USB/serial     | No                | **Sí (Chrome/Edge)**     | Sí                   |

---

## Limitaciones a tener en cuenta

- **iOS (iPhone/iPad):** la instalación se hace a mano desde Safari con _Compartir → Añadir a pantalla de inicio_; no aparece un botón automático.
- **Impresión ESC/POS:** WebUSB y Web Serial solo existen en Chrome y Edge de escritorio. En otros navegadores se usa `window.print()` con una plantilla de 80 mm.
- **Sin conexión no todo funciona:** el login, el tiempo real de cocina y los pagos QR necesitan internet. Sin conexión, la caja solo acepta efectivo.

---

## Cómo está configurada

| Archivo                           | Para qué sirve                                                                      |
| --------------------------------- | ----------------------------------------------------------------------------------- |
| `apps/web/vite.config.ts`         | Plugin `vite-plugin-pwa`: manifest, service worker, caché y modo de actualización   |
| `apps/web/src/app/PwaUpdater.tsx` | Registra el service worker y muestra los avisos de actualización                    |
| `apps/web/public/`                | Logo (`logo.svg`) e íconos generados                                                |
| `apps/web/pwa-assets.config.ts`   | Configuración del generador de íconos                                               |
| `apps/web/index.html`             | `theme-color`, íconos y etiquetas para iOS                                          |
| `apps/web/vercel.json`            | Evita que `sw.js`, `index.html` y el manifest queden cacheados; permisos USB/serial |

### 1. Manifest

Lo genera `vite-plugin-pwa` al compilar (`dist/manifest.webmanifest`) a partir del bloque `manifest` de `apps/web/vite.config.ts`; no se edita a mano.

- `name` / `short_name`: «Tus Antojos»; idioma `es`; `id`, `start_url` y `scope` en `/`.
- `display: 'standalone'`: se abre en su propia ventana, sin barra de direcciones.
- `orientation: 'any'`: sirve en PC y en tablet en cualquier posición.
- `theme_color: '#171717'` y `background_color: '#ffffff'`.
- Íconos de 64, 192 y 512 px, más uno _maskable_ de 512 (Android lo recorta en círculo o en cuadrado redondeado). Se generan desde `public/logo.svg` con `pnpm pwa:icons`.
- `index.html` enlaza el manifest y además trae `theme-color`, `apple-touch-icon` y las etiquetas de iOS.

### 2. Service worker

Lo genera Workbox (modo `generateSW`) con el bloque `workbox` de `apps/web/vite.config.ts`.

- **Precache:** guarda todo el build (`js`, `css`, `html`, íconos y fuentes), así la app abre sin conexión.
- **`navigateFallback: 'index.html'`:** sin red, cualquier ruta (`/caja`, `/admin/...`) abre la app y React Router decide qué mostrar.
- **Fotos del catálogo** (`/storage/v1/object/public/`): se guardan con la estrategia _StaleWhileRevalidate_, que muestra la foto guardada y la actualiza por detrás (hasta 300 fotos y 30 días).
- **No se guardan en caché** la API ni Supabase (login, datos, tiempo real), a propósito: mostrarían información vieja. Los pedidos sin conexión irán por una cola en IndexedDB (módulo `offline-print`), no por el service worker.
- `cleanupOutdatedCaches` borra las cachés de versiones anteriores y `clientsClaim` hace que la versión nueva tome el control en cuanto se activa.
- **Registro:** `registerType: 'prompt'`; lo registra `src/app/PwaUpdater.tsx` con `useRegisterSW`. La app nunca se actualiza sola.
- **Apagado en `pnpm dev`** (`devOptions.enabled: false`) para no trabajar con cachés viejas.
- **En Vercel**, `vercel.json` hace que `sw.js`, `index.html` y el manifest no se cacheen, así las versiones nuevas llegan enseguida.

### 3. Avisos (toasts)

Están en `src/app/PwaUpdater.tsx` y usan los toasts de Sonner.

- **Versión nueva:** un aviso fijo, «Hay una nueva versión de Tus Antojos», con los botones **Actualizar** y **Más tarde**. Nunca recarga solo, para no perder una venta a medias.
- **Lista para usar sin conexión:** «La app ya funciona sin conexión.», la primera vez que termina de guardar todo.
- **Revisión cada hora** de si hay versión nueva, porque la caja y la cocina pasan el día abiertas. Si no hay red (`navigator.onLine`), no consulta.

### 4. Lo que todavía no existe

- **Hook de red** (`useOnlineStatus`, que escucharía los eventos `online` y `offline` del navegador): hoy la app no avisa si se cae la conexión.
- **Banner de «Sin conexión».**
- **Botón propio «Instalar app»** (capturar el evento `beforeinstallprompt`): hoy se instala solo desde el ícono o el menú del navegador.

El SPEC deja el hook de red y el banner para el módulo `offline-print`, junto con la cola de pedidos, porque la caja los usa para saber que sin red solo se cobra en efectivo. El botón de instalar no está asignado a ningún módulo.

---

## Cómo probarla

```bash
pnpm --filter @tus-antojos/web build
pnpm --filter @tus-antojos/web preview
```

Abre la URL que muestra la terminal en Chrome y pulsa el ícono **Instalar** en la barra de direcciones. Para probar el modo sin conexión: DevTools → _Application_ → _Service workers_ → marca **Offline** y recarga.

> En `pnpm dev` el service worker está desactivado a propósito, para no trabajar con cachés viejas.

## Cambiar el logo

1. Reemplaza `apps/web/public/logo.svg` por el logo real (cuadrado).
2. Ejecuta `pnpm --filter @tus-antojos/web pwa:icons`.
3. Haz commit de los íconos generados.
