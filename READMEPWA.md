# Tus Antojos como PWA

Esta guía explica qué significa que Tus Antojos sea una **PWA (Progressive Web App)**, qué está implementado, qué todavía depende de internet y cómo probar, instalar y presentar la aplicación.

Está escrita para el equipo administrativo, pero incluye referencias a los archivos reales del proyecto para que pueda verificarse cada afirmación.

---

## 1. Resumen ejecutivo

Tus Antojos es una aplicación web construida con React y desplegada en Vercel que se puede instalar en escritorio y dispositivos móviles. Se comporta como una aplicación independiente: tiene su propio ícono, abre una ventana sin pestañas del navegador y puede mostrar la parte visual de la aplicación sin conexión.

La PWA tiene tres componentes principales:

| Componente | Responsabilidad |
| --- | --- |
| **Manifest** | Describe el nombre, ícono, idioma, colores y modo de apertura |
| **Service worker** | Guarda una copia de la aplicación en el navegador y decide cuándo usar archivos guardados |
| **Capa de integración** | Conecta la actualización del service worker con avisos visibles y permite comprobar versiones nuevas |

Importante: **PWA no significa que todos los datos estén disponibles sin conexión**. La PWA guarda el código y las imágenes, pero el login, la base de datos, Realtime y los pagos necesitan internet.

---

## 2. ¿Qué requisitos tiene una PWA?

Una PWA necesita, como mínimo:

1. Servirse mediante **HTTPS**.
2. Tener un **manifest** válido.
3. Tener un **service worker** registrado.

Vercel entrega el sitio por HTTPS. El manifest se genera durante el build. El service worker se genera con Workbox y se registra desde `PwaUpdater.tsx`.

### Conceptos que conviene diferenciar

- **Instalación:** crea un acceso directo que abre Tus Antojos en su propia ventana.
- **Caché:** guarda recursos en el dispositivo para poder reutilizarlos.
- **Precache:** descarga con anticipación el JavaScript, el CSS y las imágenes del build.
- **Runtime cache:** guarda recursos encontrados durante el uso, por ejemplo fotos del catálogo.
- **Service worker:** proceso del navegador que controla las solicitudes de red de la aplicación.
- **IndexedDB:** almacenamiento local del navegador reservado para datos que deben sobrevivir una recarga o la pérdida de conexión. Todavía no contiene la cola offline de pedidos.
- **Sincronización:** proceso posterior que envía pedidos offline al servidor al recuperar la conexión.

---

## 3. ¿Por qué se eligió una PWA para Tus Antojos?

### 3.1 Continuidad en la caja

El problema central es que una caída de internet no debería obligar a cerrar la caja. La PWA permite que la interfaz cargue sin conexión y prepara la base para guardar pedidos localmente.

Sin embargo, el límite actual es preciso:

- Sí está preparada la PWA y la caché del app shell.
- Sí está previsto que la caja pueda crear pedidos sin red.
- Todavía no está implementada la cola en IndexedDB ni el aviso de estado de red.
- Por eso, actualmente no se debe presentar como comprobado el flujo completo de “crear pedidos offline y sincronizarlos”.
- Cuando el módulo `offline-print` esté implementado, según el `SPEC.md`, sin internet solo se aceptarán pagos en efectivo.

### 3.2 Un solo código para varios dispositivos

React se usa una sola vez para escritorio, tablet y móvil:

| Rol | Uso previsto | Navegador recomendado |
| --- | --- | --- |
| Caja | PC o laptop | Chrome o Edge |
| Cocina | Tablet | Chrome o Edge |
| Administración | Laptop o celular | Chrome, Edge o Safari para uso básico |

No hace falta publicar una aplicación separada en Google Play o en App Store, ni mantener binarios distintos para Windows, Android e iOS.

### 3.3 Instalación sin tiendas

La instalación se hace directamente desde el navegador:

- Chrome y Edge pueden mostrar un botón o ícono de instalación.
- Android permite desde el menú del navegador una opción como _Instalar aplicación_ o _Agregar a pantalla principal_.
- iPhone y iPad no ofrecen una instalación automática igual: se usa _Compartir → Añadir a pantalla de inicio_ en Safari.

### 3.4 Actualizaciones controladas

Si se publica una versión nueva, la aplicación:

1. Descarga el nuevo service worker.
2. Detecta que el build cambió.
3. Muestra una alerta sin recargar sola.
4. Permite actualizar ahora o posponer.

Esto se decidió así porque una actualización automática podría borrar un carrito o una venta que el cajero está atendiendo.

### 3.5 Menor carga de desarrollo

Mantener una PWA evita:

- Publicar en tiendas.
- Esperar revisiones de terceros.
- Crear proyectos nativos separados.
- Mantener instalaciones manuales en cada dispositivo.

La limitación es que una PWA no tiene acceso automático a todo el hardware o a todas las funciones de los sistemas operativos.

### 3.6 Hardware local

Chrome y Edge de escritorio permiten solicitar permisos para dispositivos USB o serial. Esto habilita la impresión directa en impresoras térmicas compatibles mediante WebUSB y Web Serial.

La política de Vercel permite:

- `usb=(self)` para WebUSB.
- `serial=(self)` para Web Serial.

Si el navegador o el hardware no admite WebUSB/Web Serial, el respaldo funcional previsto es `window.print()` usando una plantilla de 80 mm.

---

## 4. Comparación para presentar el proyecto

| Característica | Página web normal | PWA Tus Antojos | App nativa |
| --- | --- | --- | --- |
| Se abre con una URL | Sí | Sí | No necesariamente |
| Se puede instalar | No | Sí | Sí |
| Tiene ícono propio | Depende | Sí | Sí |
| Abre sin conexión visualmente | No | Sí, según caché | Sí |
| Requiere tienda | No | No | Generalmente sí |
| Usa un solo proyecto web | Sí | Sí | No |
| Actualización | Al recargar | Con aviso y decisión del usuario | Depende de tienda o actualización |
| Acceso USB/serial | Limitado | Sí en Chrome/Edge compatibles | Sí |
| Costo de mantenimiento | Bajo | Bajo | Mayor |

---

## 5. Arquitectura PWA de Tus Antojos

```text
Usuario
  |
  | abre la URL / instala el acceso
  v
Navegador
  |
  +--> Manifest: nombre, íconos, modo standalone
  |
  +--> Service worker
  |      +--> Precache: JS, CSS, HTML e íconos
  |      +--> Fotos: caché temporal del catálogo
  |      +--> Navegación: sirve index.html sin conexión
  |
  +--> React
         |
         +--> Supabase Auth / Base de datos / Realtime
         |    (requieren conexión)
         |
         +--> API NestJS
         |    (requieren conexión)
         |
         +--> IndexedDB
              (queda reservada para la cola offline futura)
```

El navegador controla los archivos guardados. React controla la interfaz. Supabase y NestJS controlan datos y operaciones en servidor.

---

## 6. Cómo está configurado

| Archivo | Función |
| --- | --- |
| `apps/web/vite.config.ts` | Configura el manifest, Workbox, caché y actualizaciones |
| `apps/web/src/app/PwaUpdater.tsx` | Registra el service worker y presenta toasts |
| `apps/web/src/app/PwaUpdater.test.tsx` | Prueba los avisos de actualización y modo offline |
| `apps/web/src/main.tsx` | Monta `PwaUpdater` dentro de la aplicación React |
| `apps/web/public/logo.svg` | Logo base para generar los íconos |
| `apps/web/pwa-assets.config.ts` | Configura la generación de íconos |
| `apps/web/public/` | Contiene favicon e íconos finales |
| `apps/web/index.html` | Define título, tema, viewport y etiquetas específicas de iOS |
| `apps/web/vercel.json` | Configura caché HTTP, SPA, seguridad y permisos USB/serial |

### 6.1 Manifest

El archivo final se genera como `manifest.webmanifest` al crear el build:

- **`name`:** Tus Antojos.
- **`short_name`:** Tus Antojos.
- **`description`:** Punto de venta, cocina y administración.
- **`lang`:** español.
- **`dir`:** izquierda a derecha.
- **`id`, `start_url`, `scope`:** `/`, por lo que toda la aplicación inicia en la raíz.
- **`display`:** `standalone`, para abrir en su propia ventana.
- **`orientation`:** `any`, compatible con distintas posiciones de tablet.
- **`theme_color`:** `#171717`, usado por el navegador y la ventana instalada.
- **`background_color`:** `#ffffff`.
- **Categorías:** negocio, alimentación y productividad.

Los íconos disponibles son:

| Archivo | Tamaño | Uso |
| --- | ---: | --- |
| `pwa-64x64.png` | 64 × 64 | Íconos pequeños |
| `pwa-192x192.png` | 192 × 192 | Android y accesos |
| `pwa-512x512.png` | 512 × 512 | Splash e instalación |
| `maskable-icon-512x512.png` | 512 × 512 | Android puede recortarlo de forma segura |
| `apple-touch-icon-180x180.png` | 180 × 180 | Acceso en iOS |
| `favicon.ico` | 48 × 48 | Pestaña del navegador |

El ícono _maskable_ tiene contenido protegido alrededor del borde para que Android pueda mostrarlo dentro de círculos o cuadrados redondeados sin cortar el logo.

### 6.2 Service worker

El modo `generateSW` de Workbox crea el archivo `sw.js` durante el build. Su comportamiento es el siguiente:

#### Precache

`globPatterns` incluye JavaScript, CSS, HTML, imágenes, SVG, fuentes WOFF2 e iconos. El service worker guarda todo el app shell de un build estable.

Cuando una ruta ya es conocida, el navegador puede mostrar la interfaz aunque no haya internet.

#### Navegación SPA

`navigateFallback: 'index.html'` hace que rutas como `/caja`, `/cocina` o `/admin/...` sean atendidas por `index.html` cuando no hay red. Luego React Router decide qué vista mostrar.

Esto evita que una PWA con React Router trate una ruta interna como si fuera una página inexistente.

#### Caché de fotos

Las imágenes cuyo nombre de ruta comienza con `/storage/v1/object/public/` usan la estrategia **StaleWhileRevalidate**:

1. Se muestra inmediatamente la foto guardada, si existe.
2. En segundo plano se consulta una copia nueva.
3. Si la red responde, la caché se reemplaza para usos posteriores.

Los límites son:

- Máximo 300 fotos.
- Máximo 30 días por entrada.
- Solo se guarda una respuesta HTTP sin error o una respuesta opaca válida.

#### Contenido que no se guarda

Por diseño no se almacenan automáticamente en caché:

- Login y autenticación.
- Pedidos y datos de Supabase.
- Suscripciones Realtime.
- Respuestas de la API NestJS.

Esto evita mostrar usuarios, inventarios o precios antiguos como si fueran datos vigentes. La cola offline se debe implementar por separado con IndexedDB.

#### Limpieza y toma de control

- `cleanupOutdatedCaches` elimina versiones viejas.
- `clientsClaim` permite que un service worker nuevo controle las pestañas abiertas después de activarse.

### 6.3 Registro y avisos

`PwaUpdater` se monta en `main.tsx` y usa `useRegisterSW` de `vite-plugin-pwa`.

La configuración usa `registerType: 'prompt'`, por lo que:

- La aplicación no recarga sola.
- Aparece un toast fijo al detectar una versión nueva.
- El usuario puede pulsar **Actualizar** o **Más tarde**.
- Actualizar recarga con `updateServiceWorker(true)`.
- Posponer cambia el estado local y no descarga la actualización.

Además, el componente revisa si hay una versión nueva cada hora:

- Intervalo: 60 minutos.
- Si `navigator.onLine` es falso, no consulta.
- Si el service worker está instalándose, tampoco consulta.
- Los errores de consulta no muestran mensajes al usuario ni bloquean la caja.

Al terminar el precache se muestra: **“La app ya funciona sin conexión.”**

> Este mensaje confirma que los recursos de la aplicación quedaron guardados. No confirma que el servidor, Supabase, el login o los pagos estén operativos sin internet.

### 6.4 Caché HTTP en Vercel

`vercel.json` asigna reglas distintas según el recurso:

| Recurso | Caché |
| --- | --- |
| `/assets/*` | Un año con `immutable` |
| `/sw.js` y scripts de Workbox | Sin caché persistente, siempre revalidar |
| `/index.html` | Sin caché persistente, siempre revalidar |
| `/manifest.webmanifest` | Sin caché persistente y tipo `application/manifest+json` |

Esta separación permite conservar archivos con nombre versionado durante mucho tiempo y exigir a Vercel que entrega siempre el HTML, manifest y service worker más recientes.

Vercel también reescribe todas las rutas internas hacia `index.html`, protegiendo las rutas del SPA.

---

## 7. Funcionamiento con y sin conexión

### Con conexión

El flujo normal utiliza Supabase para autenticación y datos, API NestJS para operaciones protegidas y Realtime para sincronizar la cocina.

```text
Navegador → API autenticada → validación de sesión y rol
          → RPC o operación segura → pedido/stock/pago
          → Realtime → pantallas de cocina actualizadas
```

### Sin conexión visual

Con el service worker correctamente instalado:

- Se puede cargar la interfaz guardada.
- React puede mostrar rutas conocidas.
- Las fotos ya guardadas pueden verse.
- Una acción que necesite servidor puede fallar o quedar sin respuesta.

### Sin conexión de operación

El límite actual se resume así:

| Función | Sin conexión |
| --- | --- |
| Abrir la aplicación y navegar por la interfaz cacheada | Sí, si el precache terminó |
| Ver fotos guardadas | Sí, según caché |
| Ver datos recién consultados | No garantizado |
| Iniciar sesión | No |
| Consultar Supabase o Realtime | No |
| Crear pedidos en servidor | No |
| Pagar por QR | No |
| Cobrar en efectivo offline | Previsto, no implementado en la cola actual |
| Sincronizar pedidos sin duplicarlos | Previsto, no implementado |

No se deben presentar ventas offline como disponibles hasta que el módulo `offline-print` haya sido implementado y probado.

---

## 8. Decisiones importantes y limitaciones

### Actualización con decisión humana

Si la actualización fuera automática, el navegador podría reemplazar archivos durante una venta. Por eso se usa modo `prompt`.

### Caché limitada de datos

Cachear API y autenticación podría mostrar pedidos, usuarios o stock de otro momento. Por eso el service worker no almacena Supabase ni respuestas NestJS.

### Cola offline separada

El service worker no reemplaza una cola de datos. Los pedidos offline deberán guardarse en IndexedDB y sincronizarse mediante una lógica propia que use un identificador único para evitar duplicados.

### Impresión

WebUSB y Web Serial tienen compatibilidad limitada. Safari no es compatible con este mecanismo. Para el escritorio de caja se recomienda Chrome o Edge.

La impresión debe evitar cambios que dependen de un pedido ya enviado al servidor: el ticket debe indicarse con una plantilla de 80 mm y un procedimiento probado.

---

## 9. Instalación en cada dispositivo

### PC con Chrome o Edge

1. Abrir el sitio publicado por HTTPS.
2. Esperar a que la PWA termine el primer precache.
3. Buscar el ícono de instalación en la barra de direcciones.
4. Seleccionar **Instalar** o **Instalar aplicación**.
5. Abrir desde el acceso directo o menú de aplicaciones.

No se requiere descargar una instalación `.exe`; el acceso lo crea el navegador.

### Android con Chrome

1. Abrir la aplicación en Chrome.
2. Pulsar el menú de tres puntos.
3. Elegir **Instalar aplicación** o **Agregar a pantalla principal**.
4. Confirmar el nombre.

### iPhone o iPad con Safari

1. Abrir la aplicación en Safari.
2. Pulsar **Compartir**.
3. Elegir **Añadir a pantalla de inicio**.
4. Confirmar.

iOS no muestra siempre el aviso automático de instalación y no admite el flujo USB/serial de escritorio para impresión.

---

## 10. Prueba paso a paso

### 10.1 Preparar el build

Desde la raíz del repositorio:

```bash
pnpm --filter @tus-antojos/web build
pnpm --filter @tus-antojos/web preview
```

También puede compilarse toda la aplicación desde Vercel con el comando usado por `vercel.json`:

```bash
pnpm --filter @tus-antojos/shared build
VITE_APP_VERSION=<versión> pnpm build
```

El service worker está desactivado con `pnpm dev`; no se debe usar ese modo para comprobar caché o instalación.

### 10.2 Comprobar el build

Abrir la URL que imprime `vite preview`.

En Chrome DevTools:

1. Abrir **Application**.
2. Revisar **Manifest**.
3. Confirmar que el nombre, íconos y modo standalone aparecen.
4. Revisar **Service Workers**.
5. Confirmar que `sw.js` está activo.
6. Revisar **Cache Storage** para ver los recursos precacheados y `catalog-images`.

### 10.3 Probar sin conexión

1. Abrir la aplicación con conexión.
2. Esperar el toast **“La app ya funciona sin conexión.”**
3. Abrir DevTools → **Application** → **Service Workers**.
4. Marcar **Offline**.
5. Recargar la página.

Resultado esperado:

- La interfaz inicial carga.
- Las rutas conocidas pueden resolverse.
- Las fotos en caché se muestran.
- Login, API, pagos QR y datos nuevos no quedan disponibles.

### 10.4 Probar una actualización

1. Desplegar una versión nueva.
2. Mantener abierta una pestaña con la versión anterior.
3. Esperar la consulta automática o esperar hasta una hora.
4. Verificar que aparece **“Hay una nueva versión de Tus Antojos.”**
5. Probar primero **Más tarde** y luego **Actualizar**.

El botón **Más tarde** no recarga. El botón **Actualizar** recarga con la versión nueva.

### 10.5 Probar instalación

1. Abrir desde HTTPS.
2. Buscar el botón o menú de instalación.
3. Instalar.
4. Cerrar el navegador.
5. Abrir desde el acceso directo.

Confirmar que abre sin pestañas del navegador y conserva el nombre e icono definido.

### 10.6 Pruebas automatizadas

`PwaUpdater.test.tsx` prueba:

- Que no aparece aviso sin una novedad.
- Que se anuncia cuando el precache termina.
- Que la actualización solo ocurre al pulsar **Actualizar**.
- Que **Más tarde** pospone sin actualizar.

Ejecutar:

```bash
pnpm --filter @tus-antojos/web test -- PwaUpdater.test.tsx
```

---

## 11. Desplegar una nueva versión

Al desplegar a Vercel:

1. Se construye el paquete compartido.
2. Se aplica `VITE_APP_VERSION` con el SHA del commit.
3. Se ejecuta el build web.
4. Vite genera el manifest y `sw.js`.
5. Vercel sirve HTML, manifest y worker con caché mínimo.

Comandos y comportamiento definidos en `apps/web/vercel.json`.

Después del despliegue:

- Las pestañas abiertas buscan una actualización hasta una vez por hora.
- No actualizan automáticamente.
- El usuario recibe botones **Actualizar** y **Más tarde**.
- La actualización posterior debe probarse en una pestaña abierta antes de asumir que el despliegue llegó a todos los equipos.

---

## 12. Cambiar el logo o los íconos

1. Reemplazar `apps/web/public/logo.svg` por un logo cuadrado de calidad.
2. Mantener una zona segura alrededor del logo, ya que Android puede recortar los iconos.
3. Ejecutar:

   ```bash
   pnpm --filter @tus-antojos/web pwa:icons
   ```

4. Revisar los PNG generados en `apps/web/public/`.
5. Ejecutar el build y comprobar el manifest.
6. Confirmar los iconos en Chrome, Android e iOS.

No hace falta instalar Sharp por separado: el generador crea los PNG y luego se versionan en el repositorio.

---

## 13. Diagnóstico rápido

### El sitio no ofrece instalar

Comprobar:

- Que se usa HTTPS o localhost.
- Que el manifest fue generado.
- Que `sw.js` está registrado sin errores.
- Que el sitio cumple el modo instalable del navegador.
- Que no esté usando `pnpm dev`, pues el worker está desactivado.
- Que no haya una instalación anterior con caché vieja.

### Se abre una página antigua

Comprobar:

- En DevTools → **Application** → **Service Workers**, desregistrar solo la aplicación de desarrollo o prueba.
- Revisar que `/sw.js`, `/index.html` y `/manifest.webmanifest` no estén cacheados.
- Buscar una nueva versión con **Actualizar**.

No conviene borrar manualmente cachés en producción como solución normal; las reglas de actualización están diseñadas para reemplazarlas.

### Sin internet no carga

Comprobar:

- Que se visitó al menos una vez con conexión.
- Que apareció el toast de preparación offline.
- Que el precache terminó sin errores.
- Que se está usando HTTPS.
- Que no se abrió por una ruta privada o sin permisos.

### Aparece el sitio pero los datos no cargan

Es el comportamiento esperado. El shell puede estar disponible sin conexión, pero Supabase y NestJS sí necesitan internet.

### La impresora no aparece

Comprobar:

- Uso de Chrome o Edge de escritorio.
- Permisos USB/serial concedidos.
- Modelo de impresora compatible con ESC/POS.
- Política de permisos de Vercel.
- Uso de respaldo `window.print()` si WebUSB o Web Serial no están disponibles.

### iPhone no ofrece instalación automática

Instalar manualmente desde Safari:

**Compartir → Añadir a pantalla de inicio**

---

## 14. Preguntas frecuentes

### ¿Funciona completamente sin internet?

No. La interfaz y los recursos guardados sí pueden cargarse; login, datos, Realtime y pagos siguen necesitando conexión. La cola offline de pedidos está prevista pero no implementada.

### ¿Se puede vender con efectivo sin internet?

Todavía no está implementado el flujo completo probado. El `SPEC.md` establece que será permitido cuando exista el módulo offline.

### ¿Es una aplicación nativa?

No. Es una aplicación web instalada mediante el navegador. Puede parecer una app nativa al abrirse en su propia ventana, pero sigue ejecutándose dentro del motor web.

### ¿Se actualizará sola?

No. Revisa cada hora y solicita confirmación antes de recargar.

### ¿Qué datos conserva sin conexión?

Conserva el build de la aplicación y hasta 300 fotos del catálogo durante 30 días. No conserva automáticamente usuarios, pedidos, inventario ni respuestas de API.

### ¿Se puede enviar una venta sin duplicarla al volver internet?

Esa garantía forma parte del diseño futuro con IndexedDB e identificador único de pedido. La PWA por sí sola no garantiza idempotencia.

### ¿Se puede usar Safari en caja?

Sí para navegar e instalar en iOS, pero el flujo de impresión USB/serial está orientado a Chrome/Edge de escritorio. Para caja se recomienda Chrome o Edge.

---

## 15. Glosario corto

| Término | Explicación |
| --- | --- |
| PWA | Aplicación web instalable y preparada para funcionar con caché |
| Manifest | Archivo JSON que describe nombre, icono y modo de apertura |
| Service worker | Script del navegador que controla recursos y caché |
| Precache | Descarga inicial de recursos antes de perder conexión |
| Runtime cache | Caché creada al usar recursos posteriores |
| App shell | Marco visual básico de la aplicación |
| SPA | Aplicación de una sola página manejada por React Router |
| IndexedDB | Base de datos local del navegador |
| StaleWhileRevalidate | Mostrar caché y actualizarla en segundo plano |
| WebUSB | API para comunicarse con dispositivos USB compatibles |
| Web Serial | API para comunicarse con dispositivos serie compatibles |
| ESC/POS | Lenguaje común de impresión térmica |

---

## 16. Referencias dentro del proyecto

- Reglas generales: `SPEC.md`, secciones 1, 3, 9 y criterios CE-06/CE-13.
- Configuración PWA: `apps/web/vite.config.ts`.
- Avisos de actualización: `apps/web/src/app/PwaUpdater.tsx`.
- Prueba de avisos: `apps/web/src/app/PwaUpdater.test.tsx`.
- Montaje React: `apps/web/src/main.tsx`.
- Generación de iconos: `apps/web/pwa-assets.config.ts`.
- Despliegue: `apps/web/vercel.json`.
