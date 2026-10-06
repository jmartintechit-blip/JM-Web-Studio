/**
 * Carga, valida y completa `site.config.mjs`, y calcula los datos derivados que usan las plantillas
 * (enlaces de WhatsApp y teléfono, duraciones, precios, horario, schema.org, colores…).
 */
import { existsSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { imageSize } from './image-size.mjs';

export const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
export const DEFAULT_CONFIG = join(ROOT, 'site.config.mjs');
const PHOTOS_DIR = 'assets/img/photos';

const DIAS = {
  lun: { js: 'Mon', schema: 'Monday' }, mar: { js: 'Tue', schema: 'Tuesday' }, mie: { js: 'Wed', schema: 'Wednesday' },
  jue: { js: 'Thu', schema: 'Thursday' }, vie: { js: 'Fri', schema: 'Friday' }, sab: { js: 'Sat', schema: 'Saturday' }, dom: { js: 'Sun', schema: 'Sunday' },
};
/** Nombre en español de la configuración → variable CSS. */
const COLORES = {
  marfil: 'ivory', papel: 'paper', arena: 'sand', arena2: 'sand-2', tinta: 'ink', tinta2: 'ink-2', gris: 'mute',
  noche: 'night', nocheTexto: 'night-text', nocheGris: 'night-mute', bronce: 'bronze', bronceClaro: 'bronze-lt',
};
const NBSP = ' ';

export async function loadConfig(path = process.env.SITE_CONFIG || DEFAULT_CONFIG) {
  const file = resolve(path);
  if (!existsSync(file)) throw new Error(`No existe el archivo de configuración: ${file}`);
  const module = await import(`${pathToFileURL(file).href}?t=${Date.now()}`);   // ?t evita la caché en `npm run dev`
  if (!module.default || typeof module.default !== 'object') throw new Error(`${file} debe hacer «export default { … }»`);
  return module.default;
}

const isHex = (v) => typeof v === 'string' && /^#[0-9a-fA-F]{6}$/.test(v);
const isHour = (v) => typeof v === 'string' && /^([01]\d|2[0-3]):[0-5]\d$/.test(v);
const filled = (v) => typeof v === 'string' && v.trim() !== '';

/** Devuelve { errors, warnings }. Los errores impiden compilar; los avisos se muestran. */
export function validateConfig(cfg, { srcDir }) {
  const errors = [];
  const warnings = [];
  const need = (cond, message) => { if (!cond) errors.push(message); };
  const demo = cfg.modoDemo !== false;

  need(typeof cfg.modoDemo === 'boolean', 'modoDemo debe ser true o false');
  need(filled(cfg.negocio?.nombre), 'negocio.nombre es obligatorio');
  need(filled(cfg.negocio?.marca), 'negocio.marca es obligatorio');
  need(filled(cfg.negocio?.zona), 'negocio.zona es obligatorio');
  need(/^\+\d{8,15}$/.test(cfg.contacto?.telefono || ''), 'contacto.telefono debe estar en formato internacional sin espacios (p. ej. +34600000000)');
  need(/^\d{8,15}$/.test(cfg.contacto?.whatsapp || ''), 'contacto.whatsapp debe ser solo dígitos con prefijo de país (p. ej. 34600000000)');
  need(filled(cfg.reservas?.cal?.usuario), 'reservas.cal.usuario es obligatorio');
  need(/^https:\/\//.test(cfg.reservas?.cal?.origen || '') && /^https:\/\//.test(cfg.reservas?.cal?.base || ''), 'reservas.cal.origen y reservas.cal.base deben ser URL https');

  const servicios = cfg.reservas?.servicios;
  need(Array.isArray(servicios) && servicios.length > 0, 'reservas.servicios necesita al menos un servicio');
  const slugs = new Set();
  (servicios || []).forEach((s, i) => {
    const where = `reservas.servicios[${i}]${s?.nombre ? ` («${s.nombre}»)` : ''}`;
    need(filled(s?.nombre), `${where}: falta el nombre`);
    need(filled(s?.categoria), `${where}: falta la categoría`);
    need(Number.isInteger(s?.minutos) && s.minutos > 0, `${where}: «minutos» debe ser un entero mayor que 0`);
    need(typeof s?.precio === 'number' && s.precio >= 0, `${where}: «precio» debe ser un número`);
    need(/^[a-z0-9-]+$/.test(s?.slug || ''), `${where}: «slug» solo admite minúsculas, números y guiones (es el final del enlace de Cal.com)`);
    need(!slugs.has(s?.slug), `${where}: slug repetido`);
    slugs.add(s?.slug);
  });
  need(Array.isArray(cfg.reservas?.condiciones), 'reservas.condiciones debe ser una lista');

  need(Array.isArray(cfg.horario) && cfg.horario.length > 0, 'horario necesita al menos una fila');
  (cfg.horario || []).forEach((h, i) => {
    need(Array.isArray(h.dias) && h.dias.length > 0 && h.dias.every((d) => d in DIAS), `horario[${i}]: «dias» admite ${Object.keys(DIAS).join(', ')}`);
    need(filled(h.etiqueta), `horario[${i}]: falta la etiqueta`);
    if (!h.cerrado) need(isHour(h.abre) && isHour(h.cierra), `horario[${i}]: «abre» y «cierra» con formato HH:MM`);
  });
  need((cfg.horario || []).some((h) => !h.cerrado), 'horario: debe haber al menos una franja abierta');

  for (const [clave, hex] of Object.entries(cfg.colores || {})) need(clave in COLORES && isHex(hex), `colores.${clave}: color #RRGGBB y nombre válido`);
  for (const clave of Object.keys(COLORES)) need(isHex(cfg.colores?.[clave]), `colores.${clave} falta o no es un color #RRGGBB`);

  for (const k of ['titulo', 'descripcion', 'descripcionCorta']) need(filled(cfg.textos?.[k]), `textos.${k} es obligatorio`);
  for (const k of ['titulo', 'destacado', 'bajada']) need(filled(cfg.textos?.portada?.[k]), `textos.portada.${k} es obligatorio`);

  const fotos = [['portada', cfg.fotos?.portada], ['estudio', cfg.fotos?.estudio], ...(cfg.fotos?.galeria || []).map((f, i) => [`galeria[${i}]`, f])];
  need((cfg.fotos?.galeria || []).length === 3, 'fotos.galeria necesita exactamente 3 fotos (el diseño tiene 3 huecos)');
  for (const [name, foto] of fotos) {
    if (!foto || !filled(foto.archivo)) { errors.push(`fotos.${name}: falta «archivo»`); continue; }
    if (!existsSync(join(srcDir, PHOTOS_DIR, foto.archivo))) errors.push(`fotos.${name}: no existe src/${PHOTOS_DIR}/${foto.archivo}`);
    if (!foto.provisional && !filled(foto.alt)) errors.push(`fotos.${name}: una foto real necesita «alt» (texto alternativo que la describa)`);
    if (foto.provisional && !demo) warnings.push(`fotos.${name}: sigue marcada como provisional en una web de producción`);
  }

  if (demo) {
    for (const k of ['whatsapp', 'mensaje', 'pregunta', 'mensajePara', 'preguntaPara', 'whatsappBarra', 'whatsappSalon', 'ogTitulo', 'ogDescripcion', 'notaResenas', 'notaDireccion', 'notaLegal']) {
      need(filled(cfg.demo?.[k]), `demo.${k} es obligatorio con modoDemo: true`);
    }
    need(/^\d{8,15}$/.test(cfg.demo?.whatsapp || ''), 'demo.whatsapp debe ser solo dígitos con prefijo de país');
    need((cfg.demo?.mensajePara || '').includes('{nombre}'), 'demo.mensajePara debe contener {nombre}');
  } else {
    need(/^https:\/\/[^\s/]+(\/\S*)?$/.test(cfg.sitio?.url || ''), 'sitio.url es obligatorio con modoDemo: false (p. ej. https://www.minegocio.es)');
    const d = cfg.negocio?.direccion || {};
    for (const k of ['calle', 'codigoPostal', 'localidad', 'provincia', 'region', 'pais']) need(filled(d[k]), `negocio.direccion.${k} es obligatorio con modoDemo: false (datos estructurados)`);
    for (const k of ['titular', 'nif', 'domicilio']) if (!filled(cfg.legal?.[k])) warnings.push(`legal.${k} está vacío: las páginas legales mostrarán «Pendiente»`);
    if (!Array.isArray(cfg.resenas) || cfg.resenas.length === 0) warnings.push('resenas está vacío: la sección de reseñas no se mostrará');
    if (/Azahar|JM Web Studio/.test(JSON.stringify(cfg.negocio) + JSON.stringify(cfg.textos))) warnings.push('La configuración aún contiene textos de la demo (Azahar / JM Web Studio)');
  }
  return { errors, warnings };
}

const hhmm = (h) => h.replace(/^0/, '');
const durationText = (min) => { const h = Math.floor(min / 60); const m = min % 60; return h ? (m ? `${h} h ${m} min` : `${h} h`) : `${m} min`; };
const phoneText = (tel) => {
  const m = /^\+34(\d{3})(\d{2})(\d{2})(\d{2})$/.exec(tel);
  return m ? `+34${NBSP}${m[1]}${NBSP}${m[2]}${NBSP}${m[3]}${NBSP}${m[4]}` : tel;
};
const hexToRgb = (hex) => [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16));
const waUrl = (number, text) => `https://wa.me/${number}?text=${encodeURIComponent(text)}`;
const pending = '<span class="pending">Pendiente: lo facilita el titular</span>';

/** Datos que reciben las plantillas: la configuración más todo lo derivado. */
export function buildContext(cfg, { siteUrl, srcDir }) {
  const demo = cfg.modoDemo !== false;
  const { negocio, contacto } = cfg;
  const cal = cfg.reservas.cal;
  const d = negocio.direccion || {};

  const servicios = cfg.reservas.servicios.map((s, i) => ({
    ...s,
    numero: String(i + 1).padStart(2, '0'),
    duracion: durationText(s.minutos),
    precioTexto: `${s.precio}${NBSP}€`,
    calLink: `${cal.usuario}/${s.slug}`,
    etiqueta: s.corto || s.nombre,
  }));
  const primerServicio = servicios[0];

  const horario = cfg.horario.map((h) => ({
    ...h,
    abierto: !h.cerrado,
    rango: h.cerrado ? 'Cerrado' : `${hhmm(h.abre)} – ${hhmm(h.cierra)}`,
  }));
  const primeraFranja = horario.find((h) => h.abierto);
  const horarioJson = JSON.stringify(cfg.horario.filter((h) => !h.cerrado).map((h) => ({ d: h.dias.map((x) => DIAS[x].js), o: h.abre, c: h.cierra })));

  const waNumero = demo ? cfg.demo.whatsapp : contacto.whatsapp;
  const waSalon = waUrl(waNumero, demo ? cfg.demo.whatsappSalon : contacto.whatsappTexto);

  const foto = (f, extra = {}) => {
    const size = imageSize(join(srcDir, PHOTOS_DIR, f.archivo));
    const tipos = { webp: 'image/webp', jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png' };
    return { src: `${PHOTOS_DIR}/${f.archivo}`, tipo: tipos[f.archivo.split('.').pop().toLowerCase()] || 'image/webp', width: size.width, height: size.height, alt: f.alt || '', provisional: Boolean(f.provisional), ...extra };
  };

  const css = [':root{', ...Object.entries(COLORES).map(([k, v]) => `--${v}:${cfg.colores[k]};`)];
  const ink = hexToRgb(cfg.colores.tinta).join(',');
  css.push(`--line:rgba(${ink},.2);--line-soft:rgba(${ink},.11);--night-line:rgba(${hexToRgb(cfg.colores.nocheTexto).join(',')},.2);}`);

  const legalValor = (v) => (filled(v) ? escapeText(v) : pending);
  const tieneEmail = filled(contacto.email);
  const resenas = (Array.isArray(cfg.resenas) ? cfg.resenas : []).map((r) => ({ servicio: '', ...r }));

  let jsonld = '';
  if (!demo) {
    const data = {
      '@context': 'https://schema.org',
      '@type': negocio.tipoSchema || 'LocalBusiness',
      '@id': `${siteUrl}/#negocio`,
      name: negocio.nombre,
      url: `${siteUrl}/`,
      image: `${siteUrl}/assets/img/og-image.jpg`,
      telephone: contacto.telefono,
      ...(tieneEmail ? { email: contacto.email } : {}),
      address: { '@type': 'PostalAddress', streetAddress: d.calle, postalCode: d.codigoPostal, addressLocality: d.localidad, addressRegion: d.region, addressCountry: d.pais },
      openingHoursSpecification: cfg.horario.filter((h) => !h.cerrado).map((h) => ({ '@type': 'OpeningHoursSpecification', dayOfWeek: h.dias.map((x) => DIAS[x].schema), opens: h.abre, closes: h.cierra })),
      potentialAction: { '@type': 'ReserveAction', name: 'Reservar cita', target: `${cal.base}/${cal.usuario}` },
      hasOfferCatalog: {
        '@type': 'OfferCatalog',
        name: 'Servicios',
        itemListElement: servicios.map((s) => ({ '@type': 'Offer', price: String(s.precio), priceCurrency: 'EUR', itemOffered: { '@type': 'Service', name: s.nombre } })),
      },
    };
    jsonld = JSON.stringify(data, null, 2).replace(/</g, '\\u003c');
  }

  return {
    modoDemo: demo,
    produccion: !demo,
    siteUrl,
    anio: new Date().getFullYear(),
    negocio: { submarca: '', ...negocio, direccionLinea: [d.calle, [d.codigoPostal, d.localidad].filter(Boolean).join(' ')].filter(Boolean).join(', '), tieneSubmarca: filled(negocio.submarca) },
    contacto: { email: '', ...contacto, telHref: `tel:${contacto.telefono}`, telVisible: phoneText(contacto.telefono), tieneEmail, waHref: waSalon },
    horario,
    horarioResumen: `${primeraFranja.etiqueta}, de ${hhmm(primeraFranja.abre)} a ${hhmm(primeraFranja.cierra)}`,
    horarioJson,
    cal: { ...cal, enlaceExterno: `${cal.base}/${primerServicio.calLink}` },
    mapa: { consulta: negocio.mapa, incrustado: `https://www.google.com/maps?q=${encodeURIComponent(negocio.mapa)}&hl=es&z=15&output=embed`, enlace: `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(negocio.mapa)}` },
    servicios,
    primerServicio,
    condiciones: cfg.reservas.condiciones,
    textos: cfg.textos,
    resenas,
    tieneResenas: resenas.length > 0,
    fotos: { portada: foto(cfg.fotos.portada), estudio: foto(cfg.fotos.estudio), galeria: cfg.fotos.galeria.map((f, i) => foto(f, { slot: 'abc'[i] })) },
    tema: { css: css.join(''), color: cfg.colores.marfil, tinta: cfg.colores.tinta },
    legal: { titular: legalValor(cfg.legal?.titular), nif: legalValor(cfg.legal?.nif), domicilio: legalValor(cfg.legal?.domicilio), actualizado: cfg.legal?.actualizado || '' },
    demo: {
      ...(cfg.demo || {}),
      barraHref: demo ? waUrl(cfg.demo.whatsapp, cfg.demo.whatsappBarra) : '',
      barraBase: demo ? `https://wa.me/${cfg.demo.whatsapp}?text=` : '',
      textoBarraPara: demo ? cfg.demo.mensajePara : '',
    },
    meta: {
      ogTitulo: demo ? cfg.demo.ogTitulo : cfg.textos.titulo,
      ogDescripcion: demo ? cfg.demo.ogDescripcion : cfg.textos.descripcionCorta,
    },
    jsonld,
  };
}

function escapeText(value) {
  return String(value).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
}
