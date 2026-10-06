import assert from 'node:assert/strict';
import { existsSync, mkdtempSync, readFileSync, rmSync, statSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { after, before, describe, it } from 'node:test';
import { build, SRC } from '../scripts/build.mjs';
import { validateConfig } from '../scripts/config.mjs';
import { imageSize } from '../scripts/image-size.mjs';
import { render } from '../scripts/template.mjs';
import { PAGES, SITE_URL, config } from './helpers.mjs';
import otroNegocio from './fixtures/otro-negocio.config.mjs';

const dirs = [];
const compile = async (cfg, options = {}) => {
  const outDir = mkdtempSync(join(tmpdir(), 'web-build-'));
  dirs.push(outDir);
  const result = await build({ config: cfg, siteUrl: SITE_URL, outDir, ...options });
  return { dir: outDir, ...result };
};
const read = (dir, file) => readFileSync(join(dir, file), 'utf8');
const demoConfig = { ...config, modoDemo: true };
const prodConfig = { ...config, modoDemo: false, sitio: { ...config.sitio, url: SITE_URL } };
after(() => dirs.forEach((dir) => rmSync(dir, { recursive: true, force: true })));

describe('build con modoDemo: true', () => {
  let dir;
  before(async () => { ({ dir } = await compile(demoConfig)); });

  it('genera todas las páginas y no deja etiquetas de plantilla ni %SITE_URL% sin resolver', () => {
    for (const page of PAGES) {
      assert.ok(existsSync(join(dir, page)), `falta ${page}`);
      const html = read(dir, page);
      assert.ok(!/\{\{[^}]*\}\}/.test(html), `etiqueta de plantilla sin resolver en ${page}`);
      assert.ok(!html.includes('%SITE_URL%'), page);
    }
    assert.ok(!existsSync(join(dir, '_partials')), 'los parciales no se publican');
  });

  it('noindex en todas las páginas, robots.txt con Disallow y sin sitemap', () => {
    for (const page of PAGES) assert.match(read(dir, page), /<meta name="robots" content="noindex, nofollow">/, page);
    assert.equal(read(dir, 'robots.txt'), 'User-agent: *\nDisallow: /\n');
    assert.ok(!existsSync(join(dir, 'sitemap.xml')));
  });

  it('sin datos estructurados de negocio local', () => {
    for (const page of PAGES) assert.ok(!read(dir, page).includes('application/ld+json'), page);
  });

  it('versiona CSS y JS por hash de contenido', () => {
    assert.match(read(dir, 'index.html'), /assets\/css\/styles\.css\?v=[0-9a-f]{8}"/);
    assert.match(read(dir, 'index.html'), /assets\/js\/main\.js\?v=[0-9a-f]{8}"/);
  });

  it('usa URLs absolutas en canonical y Open Graph', () => {
    const html = read(dir, 'index.html');
    assert.ok(html.includes(`<link rel="canonical" href="${SITE_URL}/">`));
    assert.ok(html.includes(`content="${SITE_URL}/assets/img/og-image.jpg"`));
    assert.ok(read(dir, 'aviso-legal.html').includes(`href="${SITE_URL}/aviso-legal.html"`));
  });

  it('la imagen para compartir es un JPEG de 1200×630 ligero', () => {
    const file = join(SRC, 'assets/img/og-image.jpg');
    assert.deepEqual(imageSize(file), { width: 1200, height: 630 });
    assert.ok(statSync(file).size < 120 * 1024, `og-image.jpg pesa ${(statSync(file).size / 1024).toFixed(0)} KB`);
  });

  it('inyecta la paleta de la configuración como variables CSS', () => {
    const html = read(dir, 'index.html');
    assert.match(html, /<style id="tema">:root\{--ivory:#F5F1E9;/);
    assert.ok(html.includes(`<meta name="theme-color" content="${config.colores.marfil}">`));
  });
});

describe('build con modoDemo: false (producción)', () => {
  let dir;
  before(async () => { ({ dir } = await compile(prodConfig)); });

  it('quita noindex de las páginas de contenido (la 404 lo conserva) y publica robots.txt y sitemap.xml', () => {
    for (const page of PAGES) {
      if (page === '404.html') assert.match(read(dir, page), /<meta name="robots" content="noindex, nofollow">/, 'la 404 conserva noindex');
      else assert.ok(!read(dir, page).includes('noindex'), `noindex en ${page}`);
    }
    assert.match(read(dir, 'robots.txt'), /Allow: \/\nSitemap: https:\/\/azahar\.test\/sitemap\.xml/);
    const sitemap = read(dir, 'sitemap.xml');
    assert.ok(sitemap.includes(`<loc>${SITE_URL}/</loc>`));
    assert.ok(!sitemap.includes('404.html'));
  });

  it('genera los datos estructurados del negocio local desde la configuración', () => {
    const match = /<script type="application\/ld\+json">([\s\S]*?)<\/script>/.exec(read(dir, 'index.html'));
    assert.ok(match, 'falta el JSON-LD');
    const data = JSON.parse(match[1]);
    assert.equal(data['@type'], config.negocio.tipoSchema);
    assert.equal(data.name, config.negocio.nombre);
    assert.equal(data.telephone, config.contacto.telefono);
    assert.equal(data.address.streetAddress, config.negocio.direccion.calle);
    assert.equal(data.url, `${SITE_URL}/`);
  });

  it('no deja rastro de la demo', () => {
    for (const page of PAGES) {
      const html = read(dir, page);
      for (const trace of ['demo-bar', 'JM Web Studio', 'Reseñas de ejemplo', 'Página de ejemplo', 'Dirección de ejemplo', 'Hola Juan']) assert.ok(!html.includes(trace), `${page}: contiene «${trace}»`);
    }
  });
});

describe('validación de la configuración y del entorno', () => {
  const check = (mutate, mode = {}) => {
    const cfg = structuredClone({ ...demoConfig, ...mode });
    mutate(cfg);
    return validateConfig(cfg, { srcDir: SRC });
  };

  it('la configuración de la demo es válida', () => {
    assert.deepEqual(validateConfig(demoConfig, { srcDir: SRC }).errors, []);
    assert.deepEqual(validateConfig(prodConfig, { srcDir: SRC }).errors, []);
  });

  it('falla con un mensaje claro si falta la URL pública', async () => {
    await assert.rejects(() => build({ config: demoConfig, siteUrl: '', outDir: join(tmpdir(), 'web-x') }), /URL pública/);
  });

  it('modoDemo: false exige sitio.url, dirección completa y avisa de lo que falta', () => {
    const { errors, warnings } = check((c) => { c.sitio.url = ''; c.negocio.direccion.calle = ''; }, { modoDemo: false });
    assert.ok(errors.some((e) => /sitio\.url/.test(e)));
    assert.ok(errors.some((e) => /direccion\.calle/.test(e)));
    assert.ok(warnings.some((w) => /legal\.titular/.test(w)));
    assert.ok(warnings.some((w) => /provisional/.test(w)));
  });

  it('rechaza servicios, horarios, teléfonos y fotos mal definidos', () => {
    const { errors } = check((c) => {
      c.reservas.servicios[0].slug = 'Con Espacios';
      c.reservas.servicios[1].minutos = 0;
      c.reservas.servicios[2].precio = '18';
      c.horario[0].abre = '9h';
      c.contacto.telefono = '624 29 31 29';
      c.fotos.portada.archivo = 'no-existe.webp';
      c.colores.tinta = 'negro';
    });
    for (const pattern of [/slug/, /minutos/, /precio/, /abre/, /telefono/, /no-existe/, /colores\.tinta/]) assert.ok(errors.some((e) => pattern.test(e)), `no detecta ${pattern}: ${errors.join(' | ')}`);
  });

  it('una foto real necesita texto alternativo', () => {
    const { errors } = check((c) => { c.fotos.estudio.provisional = false; c.fotos.estudio.alt = ''; });
    assert.ok(errors.some((e) => /alt/.test(e)));
  });
});

describe('motor de plantillas', () => {
  it('escapa el HTML, admite bloques if/else/unless/each y parciales, y no deja líneas vacías por las etiquetas de bloque', () => {
    const out = render('<p>{{a}}</p>\n{{#if b}}\nsí\n{{else}}\nno\n{{/if}}\n{{#each xs}}\n<i>{{@index}}:{{this}}{{#unless @last}},{{/unless}}</i>\n{{/each}}\n{{{raw}}} {{> p}}', { a: '<b>&"\'', b: false, xs: ['x', 'y'], raw: '<u>' }, 't.html', { p: 'parcial {{a}}' });
    assert.equal(out, '<p>&lt;b&gt;&amp;&quot;&#39;</p>\nno\n<i>0:x,</i>\n<i>1:y</i>\n<u> parcial &lt;b&gt;&amp;&quot;&#39;');
  });

  it('una lista vacía cuenta como falso y null se imprime vacío', () => {
    assert.equal(render('{{#if xs}}A{{else}}B{{/if}}{{n}}.', { xs: [], n: null }), 'B.');
  });

  it('un dato que no existe falla con el archivo y la línea (los errores tipográficos no pasan en silencio)', () => {
    assert.throws(() => render('uno\ndos {{falta.dato}}', {}, 'src/x.html'), /src\/x\.html:2: «falta\.dato» no está definido/);
    assert.throws(() => render('{{#if a}}sin cerrar', { a: 1 }, 'src/y.html'), /y\.html:1: bloque «if» sin cerrar/);
    assert.throws(() => render('{{> nada}}', {}, 'src/z.html'), /parcial «nada»/);
  });
});

describe('lector de dimensiones de imagen', () => {
  it('coincide con el tamaño real de las fotos de la demo', () => {
    assert.deepEqual(imageSize(join(SRC, 'assets/img/photos/portada.webp')), { width: 1200, height: 1500 });
    assert.deepEqual(imageSize(join(SRC, 'assets/img/photos/estudio.webp')), { width: 1500, height: 1000 });
    assert.deepEqual(imageSize(join(SRC, 'assets/img/og-image.jpg')), { width: 1200, height: 630 });
    assert.deepEqual(imageSize(join(SRC, 'assets/img/apple-touch-icon.png')), { width: 180, height: 180 });
  });
});

describe('plantilla: otro negocio cambiando solo la configuración', () => {
  let dir;
  let html;
  before(async () => { ({ dir } = await compile(otroNegocio)); html = Object.fromEntries(PAGES.map((p) => [p, read(dir, p)])); });

  it('no queda ningún dato de la demo (nombre, zona, teléfono, Cal.com, servicios, reseñas, dirección)', () => {
    const traces = [
      config.negocio.nombre, config.negocio.marca, 'Triana', 'Sevilla', config.negocio.direccion.calle, config.contacto.telefono, config.contacto.whatsapp,
      config.contacto.telefono.replace(/^\+34(\d{3})(\d{2})(\d{2})(\d{2})$/, '$1 $2 $3 $4'), config.reservas.cal.usuario, 'JM Web Studio', 'Hola Juan',
      ...config.reservas.servicios.flatMap((s) => [s.nombre, s.slug]), ...config.resenas.map((r) => r.nombre), config.demo.pregunta,
    ];
    for (const [page, text] of Object.entries(html)) {
      const plain = text.replace(/ /g, ' ');
      for (const trace of traces) assert.ok(!plain.includes(trace), `${page} conserva «${trace}» de la demo`);
    }
  });

  it('muestra los datos del nuevo negocio: nombre, servicios, horario, contacto y colores', () => {
    const index = html['index.html'].replace(/ /g, ' ');
    for (const expected of ['Peluquería Luna', 'Corte y peinado', '50 min', '24 €', 'Color completo', '2 h', '55 €', 'peluquerialuna/corte-peinado', 'peluquerialuna/color-completo',
      'Martes a viernes', '10:00 – 20:00', 'Sábados', '9:00 – 14:00', 'Domingo y lunes', 'Cerrado', '+34 951 00 01 11', 'tel:+34951000111', 'https://wa.me/34951000111?text=Hola%2C%20quiero%20pedir%20cita',
      'mailto:hola@peluquerialuna.test', 'Plaza de la Constitución, 3, 29005 Málaga', 'Opiniones de clientas.', '--ivory:#FFFFFF', 'data-cal-color="#14121A"']) {
      assert.ok(index.includes(expected), `falta «${expected}»`);
    }
    assert.equal((index.match(/class="chip[ "]/g) || []).length, 2, 'un selector por servicio');
    assert.ok(!index.includes('class="brand__tag"'), 'sin submarca no se pinta la etiqueta');
    assert.ok(!index.includes('Reseñas de ejemplo') && !index.includes('demo-bar'));
    const legal = html['aviso-legal.html'];
    assert.ok(legal.includes('Luna Estilistas S. L.') && legal.includes('mailto:hola@peluquerialuna.test') && !legal.includes('class="pending"'));
  });

  it('genera schema.org, canonical y sitemap del nuevo negocio', () => {
    const ld = JSON.parse(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/.exec(html['index.html'])[1]);
    assert.equal(ld['@type'], 'HairSalon');
    assert.equal(ld.address.postalCode, '29005');
    assert.deepEqual(ld.openingHoursSpecification.map((o) => [o.dayOfWeek.join(), o.opens, o.closes]), [['Tuesday,Wednesday,Thursday,Friday', '10:00', '20:00'], ['Saturday', '09:00', '14:00']]);
    assert.deepEqual(ld.hasOfferCatalog.itemListElement.map((o) => [o.itemOffered.name, o.price]), [['Corte y peinado', '24'], ['Color completo', '55']]);
    assert.ok(html['index.html'].includes('<link rel="canonical" href="https://www.peluquerialuna.test/">'));
    assert.ok(read(dir, 'sitemap.xml').includes('https://www.peluquerialuna.test/politica-cookies.html'));
  });
});
