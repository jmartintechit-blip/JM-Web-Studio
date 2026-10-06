# Azahar Nail Studio · Web de demostración (JM Web Studio)

Web estática (HTML + CSS + JavaScript vanilla, sin dependencias ni paso de compilación) de un estudio ficticio de uñas y estética en Triana, Sevilla. Sirve como demo para enseñar a salones de belleza, uñas y peluquería.

## Estructura

```
index.html                 Página principal (hero, servicios, reservas, estudio, galería, FAQ, contacto)
aviso-legal.html           Aviso legal (datos de titular de EJEMPLO)
politica-privacidad.html   Política de privacidad
politica-cookies.html      Política de cookies
404.html                   Página de error
assets/css/styles.css      Estilos (tokens, componentes, secciones, responsive)
assets/js/main.js          Lógica: menú, cookies/consentimiento, Cal.com, mapa, revelados
assets/fonts/              Fraunces y DM Sans (licencia SIL OFL), autoalojadas
assets/img/                Favicon, icono iOS e imagen para compartir
netlify.toml · robots.txt  Despliegue y rastreo
```

## Reservas (Cal.com)

- Cuenta: `https://cal.com/jmwebstudio`. El calendario se incrusta en línea (`#reservar`) y se carga **solo tras el consentimiento** de la persona.
- Cada botón "Reservar" lleva `data-cal-link="jmwebstudio/<slug>"`. Los slugs de los 5 servicios: `manicura-semipermanente`, `unas-gel`, `relleno-gel`, `pedicura-semipermanente`, `limpieza-facial`.
- Si el calendario no carga (bloqueador, red caída), aparece un enlace directo a Cal.com.

## Cambiar de demo a web de cliente real

1. **WhatsApp / teléfono**: buscar y reemplazar `34624293129` y `+34 624 29 31 29` (index.html y legales).
2. **Cal.com**: sustituir `jmwebstudio` por el usuario del cliente en `data-cal-link`, `data-cal-base` y los enlaces `cal.com/...`; ajustar nombres, duraciones y precios para que coincidan con los eventos de su cuenta.
3. **Textos, servicios, horario y dirección**: editar `index.html` (y los datos JSON-LD del `<head>`).
4. **Legales**: sustituir los datos de ejemplo del titular (marcados "dato de ejemplo") y hacer revisar los textos por un profesional.
5. **Quitar el modo demo**: eliminar el bloque `#demo-bar` del HTML, la línea `noindex` de cada página y el `Disallow: /` de `robots.txt`; añadir dominio, `canonical`, `og:url` y `sitemap.xml`.
6. **Fotos reales**: sustituir las composiciones SVG por fotos del cliente en WebP/AVIF, con `alt`, `width`/`height` y `loading="lazy"`.
7. Actualizar `?v=AAAAMMDD` en los enlaces a CSS/JS cuando se modifiquen.

## Despliegue en Netlify

Arrastrar la carpeta a Netlify (o conectar el repositorio): no hay comando de build, el directorio de publicación es la raíz (`.`). Después, asociar el dominio del cliente.
