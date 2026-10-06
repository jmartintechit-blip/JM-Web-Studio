# Web de salón de uñas y estética: demostración y plantilla

Este repositorio contiene **dos cosas en una**:

1. **Una web de demostración** de [JM Web Studio](https://wa.me/34624293129): *Azahar Nail Studio*, un **salón ficticio** de uñas y estética en Triana, Sevilla, hecho con calidad de cliente real para enseñárselo a dueñas de salones. El negocio, la dirección y las reseñas son inventados (y la web lo dice); los servicios y las reservas funcionan de verdad con el Cal.com de la demo.
2. **Una plantilla**: toda la web (textos, servicios, precios, enlaces de Cal.com, contacto, horario, dirección, colores y datos legales) sale de **un solo archivo, [`site.config.mjs`](site.config.mjs)**. Para la web de un cliente se cambia ese archivo y las fotos; con `modoDemo: false` queda lista para producción.

| Escritorio | Móvil (primera pantalla) |
| --- | --- |
| ![Portada en escritorio](docs/screenshots/desktop-hero.jpg) | ![Primera pantalla en móvil](docs/screenshots/mobile-hero.jpg) |
| ![Servicios y precios](docs/screenshots/desktop-servicios.jpg) | ![Barra de demo personalizada con ?para](docs/screenshots/mobile-hero-para.jpg) |

---

## La demostración

### Personalizar el enlace con `?para=`

Añade `?para=Nombre` a la dirección y la barra de demo se dirige a esa persona:

| Enlace | Texto de la barra |
| --- | --- |
| `https://tu-demo.netlify.app/` | *Web de ejemplo de JM Web Studio. ¿Quieres una así para tu salón?* |
| `https://tu-demo.netlify.app/?para=Beauty%20Lola` | *Propuesta para Beauty Lola: así quedaría tu web. ¿La quieres?* |

- El nombre se inserta **siempre como texto** (nunca como HTML), sin caracteres de control y con un **máximo de 60 caracteres**. Si queda vacío, se usa el texto por defecto.
- El botón de la barra abre WhatsApp (`wa.me/34624293129`) con *«Hola Juan, he visto la web de ejemplo y me interesa para mi salón»* y, con `?para=`, ese mismo texto + ` (Nombre)`.
- La barra es fina, se cierra con la ×, y el cierre se recuerda durante la sesión (`sessionStorage`).
- En una captura de **móvil (390×844) sin scroll** se ven la barra de demo, el nombre del salón, una foto grande y el botón *Reservar cita*, incluso con el banner de cookies abierto. Es la captura pensada para mandar por WhatsApp.

### Qué es de ejemplo y cómo se avisa

| Elemento | Qué hace la demo |
| --- | --- |
| Botón de WhatsApp del «salón» | Escribe al autor de la demo (`+34 624 29 31 29`) con *«Hola Juan, he probado el botón de WhatsApp de la web de ejemplo 😊»*. El teléfono (`tel:`) es el mismo. No hay correo electrónico. |
| Reseñas | Tres reseñas inventadas, con la nota *«Reseñas de ejemplo»* en letra pequeña debajo. |
| Dirección | Ficticia (no corresponde a ningún negocio real), marcada *«Dirección de ejemplo»*. El mapa apunta al barrio, no a la dirección. |
| Páginas legales | Arriba, la nota *«Página de ejemplo. En tu web irán tus datos reales.»*; los datos del titular aparecen como *Pendiente*. |
| Google | `noindex, nofollow` en **todas** las páginas, `robots.txt` con `Disallow: /`, sin `sitemap.xml` y **sin datos estructurados** de negocio local. |
| Vista previa al compartir | `og:title` *«Web de ejemplo · JM Web Studio»*, descripción corta y `og:image` de 1200×630 (≈ 53 KB) hecha a partir de la portada, con URL absoluta. |
| Servicios y reservas | Exactamente los 5 servicios de abajo, cada uno con su propio calendario de Cal.com. Su disponibilidad (lunes a viernes, de 9:00 a 17:00) coincide con el horario de la web. |

| Servicio | Duración | Precio | Calendario de Cal.com |
| --- | --- | --- | --- |
| Manicura semipermanente | 45 min | 18 € | `jmwebstudio/manicura-semipermanente` |
| Uñas de gel | 90 min | 35 € | `jmwebstudio/unas-gel` |
| Relleno de gel | 75 min | 28 € | `jmwebstudio/relleno-gel` |
| Pedicura semipermanente | 60 min | 25 € | `jmwebstudio/pedicura-semipermanente` |
| Limpieza facial | 45 min | 30 € | `jmwebstudio/limpieza-facial` |

---

## Crear la web de un cliente nuevo

Todo lo que no es de este salón vive en `site.config.mjs` y en `src/assets/img/photos/`. No hay que tocar HTML, CSS ni JavaScript.

1. **Copia el proyecto** (clona o usa el repositorio como plantilla) e instala: `npm install`.
2. **Edita [`site.config.mjs`](site.config.mjs)** (cada bloque está comentado):
   - `negocio`: nombre, marca, zona, **dirección** y consulta del mapa.
   - `contacto`: teléfono, WhatsApp y mensaje, correo (vacío = no se muestra).
   - `horario`: franjas por días. **Debe coincidir con la disponibilidad de Cal.com.**
   - `reservas`: usuario de Cal.com y la lista de `servicios` (nombre, categoría, minutos, precio y `slug`). Cada servicio abre `cal.com/<usuario>/<slug>`: crea esos eventos en Cal.com con la misma duración.
   - `textos`: titular, bajadas, descripción SEO, textos de *Estudio* y de la ubicación.
   - `resenas`: **solo reseñas reales** (con permiso) o una lista vacía.
   - `colores`: la paleta (el test de contraste avisa si una combinación deja de cumplir WCAG AA).
   - `legal`: titular, NIF y domicilio. Lo que quede vacío se muestra como *Pendiente*.
3. **Sustituye las fotos** en `src/assets/img/photos/` (ver [Fotografía](#fotografía)) y marca en `fotos` `provisional: false` con su `alt`.
4. **Regenera la imagen para compartir y los iconos**: `npm run assets` (usa el nombre, el titular, los colores y la foto de portada). Si quieres otro icono de pestaña, cambia `src/assets/img/favicon.svg` antes.
5. **Desactiva el modo demo**: en `site.config.mjs`, `modoDemo: false` y `sitio.url: 'https://www.minegocio.es'`.
6. **Comprueba**: `npm run build` imprime avisos de lo que falta (datos legales, fotos provisionales, textos de la demo que sigan en la configuración) y `npm test` verifica contraste, enlaces, SEO y reservas.
7. **Publica** en Netlify (ver abajo) y asocia el dominio.

### Qué cambia con `modoDemo`

| | `modoDemo: true` (demo) | `modoDemo: false` (producción) |
| --- | --- | --- |
| Barra de demo y `?para=` | Sí | No existen |
| «Reseñas de ejemplo», «Dirección de ejemplo», notas de «Página de ejemplo» | Sí | No |
| WhatsApp del salón | Escribe al autor de la demo | Escribe al negocio (`contacto.whatsappTexto`) |
| `<meta name="robots">` | `noindex, nofollow` en todas las páginas | Ninguna (la 404 conserva `noindex`) |
| `robots.txt` | `Disallow: /` | `Allow: /` + enlace al sitemap |
| `sitemap.xml` | No se genera | Se genera |
| Datos estructurados (schema.org) | Ninguno | Del negocio local, generados desde la configuración |
| Título y descripción al compartir | `demo.ogTitulo` y `demo.ogDescripcion` | `textos.titulo` y `textos.descripcionCorta` |
| URL pública | `SITE_URL` / `URL` de Netlify | `sitio.url` (obligatoria) |

Con `modoDemo: false` el build **falla** si faltan datos imprescindibles (URL del sitio, dirección completa) y **avisa** de lo que sigue pendiente. El texto de las páginas legales es orientativo: que lo revise un profesional antes de publicar.

### Fotografía

Archivos de `src/assets/img/photos/` (WebP, JPG o PNG; el ancho y el alto se leen solos). Reemplaza el archivo manteniendo el nombre o cambia `archivo` en `fotos`.

| Clave en `fotos` | Dónde sale | Proporción | Notas |
| --- | --- | --- | --- |
| `portada` | Portada (imagen LCP) | Vertical, 4:5 recomendada | Se recorta entre ~2:3 y 1:1 según la pantalla: el motivo, centrado. |
| `estudio` | Sección *Estudio* | 3:2 | Foto real del local. |
| `galeria[0]`, `[1]`, `[2]` | Galería | 4:5, 1:1 y 4:3 | Exactamente tres (el diseño tiene tres huecos). |

**Las cinco fotos actuales son provisionales** (estudios de luz generados por código, sin personas ni productos): hay que sustituirlas por fotografía real con permiso. Con `provisional: true` llevan `alt=""` y `data-placeholder`, y `npm test` muestra un aviso.

---

## Publicar en Netlify

**La carpeta que se publica es `dist/`.** Se genera con `node scripts/build.mjs` (sin dependencias) a partir de `src/` + `site.config.mjs`, no se guarda en git y `netlify.toml` ya lo configura (`command = "node scripts/build.mjs"`, `publish = "dist"`). Netlify aporta la variable `URL`, así que en modo demo no hace falta definir nada. En producción manda `sitio.url`.

Caché y cabeceras de seguridad: `netlify.toml`. CSS, JS y fuentes se cachean un año; las imágenes se revalidan en cada visita, para poder sustituir las fotos sin que quede la antigua. No hay `Content-Security-Policy` porque el calendario de Cal.com no se pudo probar contra una política concreta.

---

## Referencia técnica

**Estructura**

```
site.config.mjs            ÚNICO archivo de datos del negocio (modoDemo, servicios, contacto, textos, colores, legal, fotos…)
src/                       Plantillas HTML y recursos
  index.html               Portada (plantilla)
  aviso-legal.html · politica-privacidad.html · politica-cookies.html · 404.html
  _partials/               Trozos comunes (cabecera, pie, datos del titular…); no se publican
  assets/css/styles.css    Componentes, secciones y responsive (los colores salen de la configuración)
  assets/js/main.js        Menú, barra de demo y ?para, consentimiento, Cal.com, mapa, barra móvil, «abierto ahora»
  assets/fonts/            Instrument Serif y Hanken Grotesk (woff2, SIL OFL)
  assets/img/              Favicon, icono iOS e imagen para compartir (se regeneran con npm run assets)
  assets/img/photos/       Fotografías (hoy, placeholders)
scripts/
  build.mjs                Compila src/ + configuración a dist/ (demo o producción)
  config.mjs · template.mjs · image-size.mjs   Carga y validación de la configuración, motor de plantillas, tamaño de fotos
  dev.mjs · serve.mjs      Servidor local con recompilación (también al cambiar site.config.mjs)
  brand-assets.mjs         Regenera favicon PNG, icono iOS e imagen Open Graph desde la configuración
  validate.mjs             Valida el HTML compilado en modo demo y en modo producción
  screenshots.mjs          Regenera docs/screenshots/
tests/                     Pruebas automáticas (Node test runner + Playwright)
netlify.toml · .env.example · .gitignore · .htmlvalidate.json
```

**Comandos** (Node.js ≥ 20.12)

```bash
npm install                      # herramientas de desarrollo
npx playwright install chromium  # solo la primera vez, para los tests
npm run dev                      # http://localhost:8765 (compila y recompila al guardar src/ o site.config.mjs)
npm run build                    # genera dist/
npm run validate                 # compila en modo demo y producción y valida el HTML de ambos
npm test                         # 132 pruebas (ver abajo)
npm run assets                   # regenera og-image.jpg y los iconos desde la configuración
npm run screenshots              # actualiza docs/screenshots/
```

**Pruebas.** Chromium real, cinco anchos (360–1920 px): consola, red y desbordes; enlaces y anclas; SEO y accesibilidad estática; que la web muestre exactamente lo configurado; consentimiento y reservas por servicio (con un doble local de Cal.com); móvil, teclado, movimiento reducido y peso; contraste AA de la paleta de la configuración. Además:

- **Demo**: texto exacto de la barra y de los mensajes de WhatsApp, `?para=` (inyección de HTML, patrones `$&`, caracteres de control, 60 caracteres, vacío), cierre en `sessionStorage`, contacto sin correo, reseñas y dirección de ejemplo, notas legales, `noindex` + `robots.txt` + sin sitemap ni schema, Open Graph, y la **primera pantalla en 390×844**.
- **Producción**: sin rastro de la demo, indexable, schema.org coherente con lo que se ve, `robots.txt` y `sitemap.xml`.
- **Plantilla**: un negocio de prueba completamente distinto (`tests/fixtures/otro-negocio.config.mjs`) se compila sin que quede ni un dato de la demo.
- **Build**: validación de la configuración, motor de plantillas y lector de dimensiones de imagen.

## Límites conocidos

- Verificado únicamente en Chromium (no en Safari ni en Firefox) y sin lectores de pantalla.
- El calendario real de Cal.com y el mapa de Google no se pudieron cargar desde el entorno de desarrollo (sin salida a internet); la integración se verifica con un doble de `embed.js`. Los enlaces externos no se han comprobado en vivo. Los eventos de Cal.com y su disponibilidad se verificaron por la API.
- Las fotos son provisionales y los textos legales, orientativos.
- La imagen para compartir (`og-image.jpg`) es un archivo: tras cambiar el negocio hay que ejecutar `npm run assets`.
- No se ha medido con Lighthouse. Peso aproximado de la primera pantalla móvil: unos 175 KB sin comprimir (HTML, CSS, JS, fuentes y foto de portada).

## Licencias

Sin licencia de código abierto declarada para el código del proyecto. Tipografías *Instrument Serif* y *Hanken Grotesk*: SIL Open Font License 1.1. Fotografías provisionales: generadas por código para este proyecto.
