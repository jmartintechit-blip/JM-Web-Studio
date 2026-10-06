# Azahar Nail Studio

Web de un estudio de uñas y estética en **Triana, Sevilla**, con **reservas online integradas mediante Cal.com**. Es una web estática (HTML, CSS y JavaScript sin frameworks), pensada para ser rápida, accesible y fácil de mantener, y preparada para desplegarse en Netlify.

> **Estado: web de demostración de JM Web Studio.** El negocio es ficticio: el nombre, el barrio y la ilustración son de ejemplo. Los servicios, precios, duraciones, horario y enlace de reservas son los configurados en la cuenta de Cal.com de la demostración. Los datos legales del titular aparecen marcados como *pendientes* porque no existen; no se han inventado.

| Escritorio | Móvil |
| --- | --- |
| ![Portada en escritorio](docs/screenshots/desktop-hero.jpg) | ![Portada en móvil](docs/screenshots/mobile-hero.jpg) |
| ![Servicios y precios](docs/screenshots/desktop-servicios.jpg) | [Página completa en móvil](docs/screenshots/mobile-pagina-completa.jpg) |

## Qué resuelve

Una persona llega desde Google o Instagram y necesita saber, en pocos segundos, **qué ofrece el salón, cuánto cuesta, cuánto dura, dónde está y cómo reservar**. La web pone esa información al alcance de un vistazo (franja de datos, carta con precios y duraciones) y deja la reserva a un toque en cualquier momento.

## Funcionalidades

- **Reservas con Cal.com** integradas en la página (embed en línea). Cada servicio tiene su botón *Reservar*, que abre su propio evento de Cal.com; un selector permite cambiar de servicio sin salir de la página.
- **Carta de servicios** con nombre, duración y precio, y una barra que visualiza la duración relativa de cada servicio.
- **Contacto directo**: WhatsApp con mensaje prellenado, teléfono (`tel:`), enlace a Google Maps y horario con indicador «abierto ahora» calculado en hora de Madrid.
- **Móvil primero**: menú accesible, barra fija con *Reservar*, WhatsApp y llamada que aparece cuando el botón del hero sale de pantalla.
- **Privacidad por defecto**: el calendario de Cal.com y el mapa de Google **no se cargan hasta que la persona acepta** (banner con *Aceptar* y *Rechazar* de igual peso, panel de configuración y recuadros con alternativa sin cookies). Si Cal.com no carga, se ofrece el enlace directo.
- **SEO local**: `title` y `description` únicos, un H1 por página, Open Graph, `canonical`, datos estructurados `BeautySalon` (con acción de reserva y catálogo de precios) coherentes con el contenido visible, `robots.txt` y `sitemap.xml` generados en el build.
- **Accesibilidad**: HTML semántico, enlace «saltar al contenido», foco visible, navegación por teclado, contraste AA verificado por test y respeto de `prefers-reduced-motion`.
- **Páginas legales**: aviso legal, política de privacidad y de cookies, más una 404.

## Decisiones de diseño y técnicas

- **Identidad propia**: el nombre (*Azahar*) y el barrio (Triana, famoso por su cerámica) dan el concepto: azulejo cobalto, azafrán del azahar y naranja de Sevilla. Tipografías *Young Serif* (títulos) y *DM Sans* (texto), autoalojadas.
- **Ilustración en lugar de fotos**: no hay fotografías reales del negocio, y no se usan imágenes de stock como si lo fueran. El hero es una ilustración SVG propia (marco de azulejos, naranja y cinco uñas). La web está preparada para sustituirla por fotografía real (ver *Mantenimiento*).
- **Solo contenido verificable**: no hay testimonios, años de experiencia, certificaciones ni descripciones de proceso inventadas. Un test impide que reaparezcan frases típicas de relleno.
- **Sin dependencias en producción**: JavaScript en una IIFE (sin módulos), sin librerías, sin imágenes de mapa de bits en la portada. Los únicos recursos externos son Cal.com y Google Maps, y solo tras consentimiento.
- **Build propio de menos de 100 líneas** (`scripts/build.mjs`, sin paquetes): sustituye la URL pública en `canonical`/Open Graph/Schema, añade un hash de contenido a CSS y JS (caché larga sin riesgo de ficheros obsoletos) y genera `robots.txt` y `sitemap.xml`. Mientras `INDEXABLE` no sea `true` mantiene `noindex`, porque es una demostración.
- **Reserva real, no simulada**: se usa el snippet oficial de Cal.com. En los tests se sustituye `embed.js` por un doble local para verificar la integración sin red.

## Tecnologías

HTML5 · CSS3 (variables, grid, `clip`/`mask`) · JavaScript (ES5/ES2015, sin transpilar) · Node.js ≥ 20.12 para los scripts · Netlify (alojamiento) · Cal.com y Google Maps (embeds).
Herramientas de desarrollo: [Playwright](https://playwright.dev) y [html-validate](https://html-validate.org).

## Estructura

```
src/                       Código fuente de la web (lo que se publica)
  index.html               Portada: hero, datos, servicios, reservas y contacto
  aviso-legal.html · politica-privacidad.html · politica-cookies.html · 404.html
  assets/css/styles.css    Tokens, componentes, secciones y responsive
  assets/js/main.js        Menú, consentimiento, Cal.com, mapa, barra móvil, «abierto ahora»
  assets/fonts/            Young Serif y DM Sans (woff2, licencia SIL OFL)
  assets/img/              Favicon, iconos, imagen para compartir, sprite SVG y motivos de azulejo
scripts/
  build.mjs                Compila src/ a dist/ (SITE_URL, hash de caché, robots, sitemap)
  dev.mjs · serve.mjs      Servidor local con recompilación
  brand-assets.mjs         Regenera favicon PNG, icono iOS e imagen Open Graph
  screenshots.mjs          Regenera docs/screenshots/
tests/                     Pruebas automáticas (Node test runner + Playwright)
netlify.toml · .env.example · .gitignore · .htmlvalidate.json
```

## Desarrollo

Requisitos: Node.js ≥ 20.12.

```bash
npm install                      # herramientas de desarrollo
npx playwright install chromium  # solo la primera vez, para los tests
npm run dev                      # http://localhost:8765 (compila y recompila al guardar)
npm run build                    # genera dist/ (necesita SITE_URL, ver abajo)
npm run validate                 # valida el HTML
npm test                         # 70+ pruebas: build, contraste, consola, enlaces, SEO, reservas, móvil, teclado
npm run screenshots              # actualiza docs/screenshots/
```

Los tests comprueban, en Chromium real y en cinco anchos (360 a 1920 px): ausencia de errores de consola y de peticiones fallidas, ausencia de desbordes horizontales, enlaces y anclas, SEO básico, que el Schema.org coincide con el contenido, que la web muestra exactamente los datos de `tests/business.json`, el flujo de consentimiento y de reserva por servicio (con doble local de Cal.com), el menú móvil, el foco de teclado y un presupuesto de peso.

## Configuración

Se define en variables de entorno (ver [`.env.example`](.env.example)). No hay secretos: todo el contenido es público.

| Variable | Uso |
| --- | --- |
| `SITE_URL` | URL pública, sin barra final. Netlify la aporta como `URL`, así que allí no hace falta. |
| `INDEXABLE` | `false` (por defecto): demostración, con `noindex` y `Disallow`. `true`: permite indexar y genera `sitemap.xml`. |
| `PORT` | Puerto del servidor local (por defecto 8765). |

## Despliegue en Netlify

1. Conectar el repositorio. `netlify.toml` ya define el comando (`node scripts/build.mjs`) y el directorio de publicación (`dist`).
2. Para una web real, añadir `INDEXABLE=true` en las variables de entorno del sitio y asociar el dominio.

Las cabeceras de seguridad y la caché están en `netlify.toml`. No se ha definido una política `Content-Security-Policy` porque el calendario de Cal.com no se pudo probar contra ninguna política concreta durante el desarrollo.

## Mantenimiento: dónde cambiar cada cosa

| Qué | Dónde |
| --- | --- |
| Servicios, precios y duraciones | `src/index.html` (carta, `data-cal-link`, JSON-LD) y `tests/business.json`. Deben coincidir con los eventos de Cal.com. |
| Usuario de Cal.com | `data-cal-link`, `data-cal-base`, `data-cal-origin` en `src/index.html`. |
| Horario | Tabla de contacto, franja de datos, `data-*` de `#open-now` y JSON-LD. |
| Teléfono y WhatsApp | Buscar y reemplazar el número en `src/` (enlaces `tel:` y `wa.me`) y en `tests/business.json`. |
| Mapa | `data-src` de `#map-wrap` en `src/index.html`. |
| Colores, tipografías y espaciado | Variables `:root` de `src/assets/css/styles.css`. |
| Datos legales | Campos marcados como *Pendiente* en `aviso-legal.html` y `politica-privacidad.html`. |
| Fotografía real | Sustituir la ilustración `#hero-art` por un `<img>` en WebP/AVIF con `alt`, `width` y `height`; añadir la galería solo con fotos reales y permiso. |
| Quitar el modo demostración | Eliminar `#demo-bar` (HTML y su lógica en `main.js`) y desplegar con `INDEXABLE=true`. |

## Límites conocidos

- Verificado únicamente en Chromium. No se ha probado en Safari ni en Firefox.
- El calendario real de Cal.com y el mapa de Google no se pudieron cargar durante el desarrollo (sin salida a internet); la integración se verificó con un doble de `embed.js`.
- Los enlaces externos (Cal.com, Google, AEPD, Netlify) no se han podido comprobar en vivo.
- Los textos legales son orientativos y deben revisarlos un profesional antes de publicar una web real.
- Peso medido de la portada: 169 KB sin comprimir (HTML 29 KB, CSS 30 KB, JS 19 KB, fuentes 88 KB), sin imágenes de mapa de bits. No se ha medido con Lighthouse.

## Licencias

Sin licencia de código abierto declarada para el código del proyecto. Tipografías *Young Serif* y *DM Sans*: SIL Open Font License 1.1. Ilustraciones: originales de este proyecto.
