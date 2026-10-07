/**
 * CONFIGURACIÓN DE LA WEB: el único archivo que hay que editar para crear la web de otro negocio
 * (además de las fotos de `src/assets/img/photos/`). Todo lo que se ve, se enlaza o se publica
 * sale de aquí: nombre, servicios, precios, enlaces de Cal.com, contacto, horario, dirección,
 * textos, colores y datos legales.
 *
 * Esta versión describe la DEMOSTRACIÓN de JM Web Studio: un salón ficticio de Sevilla.
 *
 * ─── modoDemo ────────────────────────────────────────────────────────────────────────────
 *  true  → web de ejemplo: barra de demo (con ?para=Nombre), noindex en todas las páginas,
 *          robots.txt con "Disallow: /", sin sitemap, sin datos estructurados de negocio local,
 *          «Reseñas de ejemplo» y notas de «Página de ejemplo» en las páginas legales.
 *  false → web de producción: indexable, con canonical, sitemap.xml, robots.txt permisivo y
 *          datos estructurados (schema.org) del negocio local generados desde este archivo.
 *          Sin ninguna marca de demo. Requiere `sitio.url` y `negocio.direccion` completos.
 * ─────────────────────────────────────────────────────────────────────────────────────────
 *
 * Después de cambiar este archivo: `npm run build` (o `npm run dev` para verlo en local).
 * Si cambia la foto de portada o el nombre: `npm run assets` regenera la imagen para compartir.
 */
export default {
  modoDemo: true,

  // ── Sitio ────────────────────────────────────────────────────────────────────────────
  sitio: {
    // Dominio público, sin barra final (p. ej. 'https://www.minegocio.es'). Obligatorio con modoDemo:false.
    // En modo demo se deja vacío: la URL la aporta Netlify (variable URL) o SITE_URL en local.
    url: '',
  },

  // ── Negocio ──────────────────────────────────────────────────────────────────────────
  negocio: {
    nombre: 'Azahar Nail Studio',
    marca: 'Azahar',            // palabra grande del logotipo y de la cabecera
    submarca: 'Nail Studio',    // palabra pequeña junto a la marca (puede ir vacía: '')
    tipoSchema: 'BeautySalon',  // tipo schema.org para los datos estructurados (solo producción)
    zona: 'Triana, Sevilla',    // barrio y ciudad, tal como se ve en la web
    direccion: {
      // DIRECCIÓN FICTICIA (demo). No corresponde a ningún negocio real.
      calle: 'Calle Flor de Azahar, 14, local 2',
      codigoPostal: '41010',
      localidad: 'Sevilla',
      provincia: 'Sevilla',
      region: 'Andalucía',
      pais: 'ES',
    },
    // Consulta del mapa de Google (barrio, no la dirección: así la demo no apunta a ningún local real).
    mapa: 'Triana, Sevilla',
  },

  // ── Contacto ─────────────────────────────────────────────────────────────────────────
  contacto: {
    telefono: '+34624293129',   // formato internacional, sin espacios
    whatsapp: '34624293129',    // solo dígitos, con prefijo de país
    // Mensaje que se prerrellena al pulsar WhatsApp en una web de producción.
    // (En modo demo se usa demo.whatsappSalon, para que el botón escriba al autor de la demo.)
    whatsappTexto: 'Hola, escribo desde vuestra web. Me gustaría pedir información.',
    email: '',                  // vacío = no se muestra ningún correo (la demo no tiene)
  },

  // ── Horario ──────────────────────────────────────────────────────────────────────────
  // dias: lun, mar, mie, jue, vie, sab, dom. Debe coincidir con la disponibilidad de Cal.com.
  // Cada fila lleva `franjas` (una o varias en el mismo día, en orden: p. ej. mañana y tarde),
  // o bien `abre` y `cierra` si solo hay una; o `cerrado: true`.
  horario: [
    { dias: ['lun', 'mar', 'mie', 'jue', 'vie'], etiqueta: 'Lunes a viernes', franjas: [{ abre: '10:00', cierra: '14:00' }, { abre: '17:00', cierra: '20:30' }] },
    { dias: ['sab'], etiqueta: 'Sábado', franjas: [{ abre: '10:00', cierra: '14:00' }] },
    { dias: ['dom'], etiqueta: 'Domingo', cerrado: true },
  ],

  // ── Servicios y reservas (Cal.com) ───────────────────────────────────────────────────
  // Cada servicio abre su propio calendario: `${reservas.cal.usuario}/${slug}` (debe existir en Cal.com).
  // `corto` es el nombre breve de la pestaña del selector (opcional: si falta, se usa el nombre completo).
  reservas: {
    cal: { usuario: 'jmwebstudio', origen: 'https://app.cal.com', base: 'https://cal.com' },
    servicios: [
      { nombre: 'Manicura semipermanente', corto: 'Manicura', categoria: 'Manos', minutos: 45, precio: 18, slug: 'manicura-semipermanente' },
      { nombre: 'Uñas de gel', corto: 'Uñas de gel', categoria: 'Manos', minutos: 90, precio: 35, slug: 'unas-gel' },
      { nombre: 'Relleno de gel', corto: 'Relleno', categoria: 'Manos', minutos: 75, precio: 28, slug: 'relleno-gel' },
      { nombre: 'Pedicura semipermanente', corto: 'Pedicura', categoria: 'Pies', minutos: 60, precio: 25, slug: 'pedicura-semipermanente' },
      { nombre: 'Limpieza facial', corto: 'Facial', categoria: 'Rostro', minutos: 45, precio: 30, slug: 'limpieza-facial' },
    ],
    // Condiciones junto al calendario. Deben reflejar lo configurado en Cal.com (aviso mínimo, cambios…).
    condiciones: [
      { titulo: 'Pago', texto: 'En el salón. Reservar no cuesta nada.' },
      { titulo: 'Antelación', texto: 'Hasta 2 horas antes, si hay hueco.' },
      { titulo: 'Cambios', texto: 'Desde el enlace del email de confirmación.' },
    ],
  },

  // ── Textos de la web ─────────────────────────────────────────────────────────────────
  textos: {
    titulo: 'Azahar Nail Studio | Uñas y estética en Triana, Sevilla',   // <title> de la portada (≤ 65 caracteres)
    descripcion: 'Manicura y pedicura semipermanente, uñas de gel, relleno de gel y limpieza facial en Triana, Sevilla. Consulta precios y reserva tu cita online.',
    descripcionCorta: 'Manicura y pedicura semipermanente, uñas de gel, relleno de gel y limpieza facial. Reserva tu cita online.',
    imagenCompartirAlt: 'Azahar Nail Studio: uñas y limpieza facial en Triana, Sevilla',
    portada: {
      titulo: 'Uñas y limpieza facial en',
      destacado: 'Triana, Sevilla',       // va en cursiva
      bajada: 'Manicura y pedicura semipermanente, uñas de gel, relleno de gel y limpieza facial.',
    },
    servicios: {
      titulo: 'Manos, pies y rostro.',
      nota: 'Duración y precio de cada servicio. Pago en el salón.',
      pie: '¿Dudas sobre cuál elegir?',
      pieEnlace: 'Pregúntanos por WhatsApp',
    },
    estudio: {
      titulo: 'Un estudio de uñas y estética en Triana, Sevilla.',
      texto: 'Eliges el servicio y reservas tu cita online.',
    },
    resenas: { titulo: 'Lo que cuentan quienes ya han venido.' },
    ubicacion: { lineas: ['Visítanos', 'en Triana'] },
  },

  // ── Reseñas ──────────────────────────────────────────────────────────────────────────
  // En modo demo se muestran con la nota «Reseñas de ejemplo». En producción, poner SOLO reseñas reales
  // (con permiso de quien las escribió) o dejar la lista vacía: la sección no se muestra.
  resenas: [
    { texto: 'Salí con las uñas impecables y sin esperas. Reservar online fue facilísimo.', nombre: 'Lucía M.', servicio: 'Uñas de gel' },
    { texto: 'Me explicaron cada paso con calma y el resultado me encantó. Repetiré.', nombre: 'Carmen R.', servicio: 'Manicura semipermanente' },
    { texto: 'Local tranquilo y trato cercano. Pedí mi cita desde el móvil en un minuto.', nombre: 'Marta G.', servicio: 'Limpieza facial' },
  ],

  // ── Fotografías ──────────────────────────────────────────────────────────────────────
  // Archivos de src/assets/img/photos/ (WebP, JPG o PNG: el ancho y el alto se leen solos).
  // provisional: true marca una imagen de relleno (alt vacío y data-placeholder; el test avisa).
  // Con foto real: provisional:false y un `alt` que la describa.
  // Las de la demo son fotografías de Unsplash (licencia de Unsplash). En la web de un cliente,
  // sustitúyelas por las suyas.
  fotos: {
    portada: { archivo: 'portada.webp', alt: 'Manos con manicura semipermanente en tono nude', provisional: false },        // vertical, 4:5
    estudio: { archivo: 'estudio.webp', alt: 'Técnica de uñas trabajando una manicura de gel', provisional: false },      // 3:2
    galeria: [
      { archivo: 'galeria-1.webp', alt: 'Aplicación de esmalte durante una manicura', provisional: false },              // 4:5
      { archivo: 'galeria-2.webp', alt: 'Limpieza facial con mascarilla', provisional: false },                          // 1:1
      { archivo: 'galeria-3.webp', alt: 'Toalla, crema y tulipanes en la cabina de estética', provisional: false },      // 4:3
    ],
  },

  // ── Colores ──────────────────────────────────────────────────────────────────────────
  // Neutros cálidos y un único acento (bronce) solo para estados de interacción.
  // `npm test` comprueba el contraste (WCAG AA) de las combinaciones que usa el diseño.
  colores: {
    marfil: '#F5F1E9',        // fondo general
    papel: '#FAF8F3',         // paneles (calendario, banner de cookies)
    arena: '#EBE5D9',         // banda de reserva y avisos
    arena2: '#E1D9CB',        // bloques de foto y mapa mientras cargan
    tinta: '#1E1C1A',         // texto principal y botón principal
    tinta2: '#4A4640',        // texto secundario
    gris: '#6B655C',          // etiquetas y numeración
    noche: '#24221F',         // fondo del pie
    nocheTexto: '#D9D3C8',    // texto del pie
    nocheGris: '#A29B8E',     // texto secundario del pie
    bronce: '#7A5838',        // acento (hover, indicador «abierto»)
    bronceClaro: '#C2A484',   // acento sobre fondo oscuro
  },

  // ── Datos legales ────────────────────────────────────────────────────────────────────
  // null = se muestra «Pendiente» (en producción el build avisa de lo que falta).
  legal: {
    titular: null,            // razón social o nombre y apellidos
    nif: null,
    domicilio: null,          // domicilio legal (puede coincidir con la dirección del negocio)
    actualizado: '6 de octubre de 2026',
  },

  // ── Solo modoDemo: true ──────────────────────────────────────────────────────────────
  demo: {
    autor: 'JM Web Studio',
    whatsapp: '34624293129',                 // WhatsApp del autor de la demo (barra de demo)
    // Barra de demo. Con ?para=Nombre se usa el segundo par de textos ({nombre} = nombre, máx. 60 caracteres).
    mensaje: 'Web de ejemplo de JM Web Studio.',
    pregunta: '¿Quieres una así para tu salón?',
    mensajePara: 'Propuesta para {nombre}: así quedaría tu web.',
    preguntaPara: '¿La quieres?',
    // Mensaje de WhatsApp de la barra de demo (con ?para se añade " (Nombre)").
    whatsappBarra: 'Hola Juan, he visto la web de ejemplo y me interesa para mi salón',
    // Mensaje que prerrellenan los botones de WhatsApp del «salón» (también escriben al autor de la demo).
    whatsappSalon: 'Hola Juan, he probado el botón de WhatsApp de la web de ejemplo 😊',
    // Vista previa al compartir el enlace (WhatsApp, redes).
    ogTitulo: 'Web de ejemplo · JM Web Studio',
    ogDescripcion: 'Así quedaría la web de tu salón: diseño a medida y reservas online. Demo con un salón ficticio de Sevilla.',
    notaResenas: 'Reseñas de ejemplo',
    notaDireccion: 'Dirección de ejemplo',
    notaLegal: 'Página de ejemplo. En tu web irán tus datos reales.',
  },
};
