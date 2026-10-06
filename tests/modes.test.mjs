import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { after, before, describe, it } from 'node:test';
import { PAGES, SITE_URL, blockExternal, business, config, launch, newContext, slugLink, startSite, track } from './helpers.mjs';

const REJECTED = { cal: false, maps: false };
const BAR_TEXT = 'Web de ejemplo de JM Web Studio. ¿Quieres una así para tu salón?';
const BAR_WA = 'Hola Juan, he visto la web de ejemplo y me interesa para mi salón';
const SALON_WA = 'Hola Juan, he probado el botón de WhatsApp de la web de ejemplo 😊';
const MY_WHATSAPP = '34624293129';

let demo;
let prod;
let browser;
before(async () => { demo = await startSite({ modoDemo: true }); prod = await startSite({ modoDemo: false }); browser = await launch(); });
after(async () => { await browser.close(); await demo.stop(); await prod.stop(); });

async function open(site, path, options = {}) {
  const context = await newContext(browser, options);
  const tab = await context.newPage();
  const log = track(tab, site.base);
  await blockExternal(tab, site.base);
  await tab.goto(`${site.base}/${path}`);
  await tab.waitForTimeout(300);
  return { tab, log, context, close: () => context.close() };
}
const decodeText = (href) => decodeURIComponent(href.split('?text=')[1]);
const barText = (tab) => tab.$eval('#demo-bar .demo-bar__text', (e) => e.textContent.replace(/\s+/g, ' ').trim());

describe('modoDemo: true · barra de demo', () => {
  it('por defecto: texto exacto y botón a WhatsApp con el mensaje indicado', async () => {
    const { tab, close } = await open(demo, 'index.html', { consent: REJECTED });
    const text = await barText(tab);
    const href = await tab.$eval('#demo-link', (a) => a.href);
    const attrs = await tab.$eval('#demo-link', (a) => ({ target: a.target, rel: a.rel }));
    await close();
    assert.equal(text, BAR_TEXT);
    assert.ok(href.startsWith(`https://wa.me/${MY_WHATSAPP}?text=`), href);
    assert.equal(decodeText(href), BAR_WA);
    assert.equal(attrs.target, '_blank');
    assert.match(attrs.rel, /noopener/);
  });

  it('?para=Nombre personaliza el texto y añade el nombre al mensaje de WhatsApp', async () => {
    const { tab, close } = await open(demo, 'index.html?para=Mar%C3%ADa%20del%20Mar', { consent: REJECTED });
    const text = await barText(tab);
    const href = await tab.$eval('#demo-link', (a) => a.href);
    await close();
    assert.equal(text, 'Propuesta para María del Mar: así quedaría tu web. ¿La quieres?');
    assert.equal(decodeText(href), `${BAR_WA} (María del Mar)`);
  });

  it('el nombre se inserta siempre como texto: sin HTML, sin scripts y sin interpretar patrones', async () => {
    for (const [raw, expectedName] of [
      ['<img src=x onerror="window.__xss=1">', '<img src=x onerror="window.__xss=1">'],
      ['<script>window.__xss=1</script>', '<script>window.__xss=1</script>'],
      ['A$&B$1$`C', 'A$&B$1$`C'],
      ['Ana%0A%0D%00%E2%80%AEoculta', 'Ana oculta'],
    ]) {
      const { tab, close } = await open(demo, `index.html?para=${encodeURIComponent(decodeURIComponent(raw.includes('%') ? raw : raw))}`, { consent: REJECTED });
      const info = await tab.evaluate(() => ({ xss: window.__xss, injected: document.querySelectorAll('#demo-bar img, #demo-bar script').length, html: document.querySelector('#demo-msg').innerHTML }));
      const text = await barText(tab);
      await close();
      assert.equal(info.xss, undefined, `ejecutó código con ${raw}`);
      assert.equal(info.injected, 0, `inyectó elementos con ${raw}`);
      assert.ok(text.includes(`Propuesta para ${expectedName}:`), `${raw} → ${text}`);
      assert.ok(!info.html.includes('<'), `innerHTML con etiquetas: ${info.html}`);
    }
  });

  it('el nombre tiene como máximo 60 caracteres y un nombre vacío deja el texto por defecto', async () => {
    const long = 'N'.repeat(100);
    let { tab, close } = await open(demo, `index.html?para=${long}`, { consent: REJECTED });
    const text = await barText(tab);
    await close();
    assert.equal(text, `Propuesta para ${'N'.repeat(60)}: así quedaría tu web. ¿La quieres?`);
    ({ tab, close } = await open(demo, 'index.html?para=%20%20%20', { consent: REJECTED }));
    const empty = await barText(tab);
    await close();
    assert.equal(empty, BAR_TEXT);
  });

  it('se puede cerrar y el cierre se recuerda en sessionStorage (también con ?para)', async () => {
    const { tab, close } = await open(demo, 'index.html?para=Lola', { consent: REJECTED });
    assert.ok(await tab.isVisible('#demo-bar'));
    const height = await tab.$eval('#demo-bar', (e) => e.getBoundingClientRect().height);
    assert.ok(height <= 60, `la barra debe ser fina (alto ${height}px)`);
    await tab.click('#demo-close');
    await tab.waitForTimeout(500);
    assert.ok(!(await tab.isVisible('#demo-bar')));
    assert.equal(await tab.evaluate(() => sessionStorage.getItem('azahar-demo-closed')), '1');
    await tab.reload();
    assert.ok(!(await tab.isVisible('#demo-bar')));
    await close();
  });
});

describe('modoDemo: true · contacto, honestidad y Google', () => {
  it('todos los WhatsApp escriben al autor de la demo con el mensaje indicado y el teléfono es el suyo; no hay correos', async () => {
    const { tab, close } = await open(demo, 'index.html', { consent: REJECTED });
    const wa = await tab.$$eval('a[href*="wa.me"]', (els) => els.map((e) => ({ href: e.href, inBar: !!e.closest('#demo-bar') || /Web de demostración/.test(e.parentElement.textContent) })));
    const tels = await tab.$$eval('a[href^="tel:"]', (els) => els.map((e) => e.getAttribute('href')));
    const mails = await tab.$$eval('a[href^="mailto:"]', (els) => els.length);
    await close();
    assert.ok(wa.length >= 6);
    for (const link of wa) {
      assert.ok(link.href.startsWith(`https://wa.me/${MY_WHATSAPP}?text=`), link.href);
      assert.equal(decodeText(link.href), link.inBar ? BAR_WA : SALON_WA);
    }
    assert.ok(tels.length >= 3 && tels.every((t) => t === 'tel:+34624293129'));
    assert.equal(mails, 0, 'sin correo electrónico');
    for (const page of PAGES) assert.ok(!readFileSync(join(demo.outDir, page), 'utf8').includes('mailto:'), `${page} contiene mailto:`);
  });

  it('las reseñas llevan debajo, en letra pequeña, «Reseñas de ejemplo»', async () => {
    const { tab, close } = await open(demo, 'index.html', { consent: REJECTED });
    const info = await tab.evaluate(() => {
      const list = document.querySelector('.reviews__list').getBoundingClientRect();
      const note = document.querySelector('.reviews__note');
      return { items: document.querySelectorAll('.review').length, note: note.textContent.trim(), below: note.getBoundingClientRect().top >= list.bottom, size: parseFloat(getComputedStyle(note).fontSize) };
    });
    await close();
    assert.equal(info.items, config.resenas.length);
    assert.equal(info.note, 'Reseñas de ejemplo');
    assert.ok(info.below, 'la nota va debajo de las reseñas');
    assert.ok(info.size <= 13, `letra pequeña (${info.size}px)`);
  });

  it('la dirección es ficticia y se marca como de ejemplo', async () => {
    const { tab, close } = await open(demo, 'index.html', { consent: REJECTED });
    const text = (await tab.$eval('.visit__address', (e) => e.textContent)).replace(/\s+/g, ' ');
    await close();
    assert.ok(text.includes(config.negocio.direccion.calle) && text.includes(config.negocio.direccion.codigoPostal));
    assert.ok(text.includes('Dirección de ejemplo'));
  });

  it('las páginas legales abren con «Página de ejemplo. En tu web irán tus datos reales.»', async () => {
    for (const page of ['aviso-legal.html', 'politica-privacidad.html', 'politica-cookies.html']) {
      const { tab, close } = await open(demo, page, { consent: REJECTED });
      const info = await tab.evaluate(() => {
        const note = document.querySelector('.legal__note');
        const firstSection = document.querySelector('.legal section');
        return { text: note && note.textContent.trim(), before: !!(note && note.compareDocumentPosition(firstSection) & Node.DOCUMENT_POSITION_FOLLOWING) };
      });
      await close();
      assert.equal(info.text, 'Página de ejemplo. En tu web irán tus datos reales.', page);
      assert.ok(info.before, `${page}: la nota va arriba`);
    }
  });

  it('no aparece en Google: noindex en todas las páginas, robots.txt con Disallow, sin sitemap ni datos estructurados', async () => {
    for (const page of PAGES) {
      const { tab, close } = await open(demo, page, { consent: REJECTED });
      const robots = await tab.$eval('meta[name=robots]', (m) => m.content);
      const ld = await tab.$$eval('script[type="application/ld+json"]', (n) => n.length);
      await close();
      assert.equal(robots, 'noindex, nofollow', page);
      assert.equal(ld, 0, page);
    }
    const { tab, close } = await open(demo, 'robots.txt');
    assert.equal((await tab.textContent('body')).trim(), 'User-agent: *\nDisallow: /');
    const sitemap = await tab.goto(`${demo.base}/sitemap.xml`);
    assert.equal(sitemap.status(), 404);
    await close();
  });

  it('la vista previa de WhatsApp: título, descripción corta e imagen absoluta de 1200×630', async () => {
    const { tab, close } = await open(demo, 'index.html', { consent: REJECTED });
    const og = await tab.evaluate(() => Object.fromEntries([...document.querySelectorAll('meta[property^="og:"]')].map((m) => [m.getAttribute('property'), m.content])));
    await close();
    assert.equal(og['og:title'], 'Web de ejemplo · JM Web Studio');
    assert.ok(og['og:description'].length >= 40 && og['og:description'].length <= 160, og['og:description']);
    assert.equal(og['og:image'], `${SITE_URL}/assets/img/og-image.jpg`);
    assert.equal(og['og:image:width'], '1200');
    assert.equal(og['og:image:height'], '630');
  });
});

describe('modoDemo: true · primera pantalla en móvil (390×844, sin scroll)', () => {
  for (const [label, options] of [['con la decisión de cookies ya tomada', { consent: REJECTED }], ['con el banner de cookies abierto', {}]]) {
    it(`se ven la barra de demo, el nombre del salón, una foto grande y el botón de reservar ${label}`, async () => {
      const { tab, close } = await open(demo, 'index.html', { width: 390, height: 844, touch: true, ...options });
      await tab.waitForTimeout(900);
      const info = await tab.evaluate(() => {
        const box = (sel) => { const r = document.querySelector(sel).getBoundingClientRect(); return { top: Math.round(r.top), bottom: Math.round(r.bottom), left: Math.round(r.left), right: Math.round(r.right), height: Math.round(r.height) }; };
        const banner = document.querySelector('#cookie-banner');
        const img = document.querySelector('.hero__media img');
        return {
          vh: innerHeight, scrollY, bar: box('#demo-bar'), brand: box('.header .brand__name'), photo: box('.hero__media'), cta: box('#hero-cta'), title: box('.hero__title'),
          bannerTop: banner && !banner.hidden ? Math.round(banner.getBoundingClientRect().top) : null,
          photoLoaded: img.complete && img.naturalWidth > 0,
          brandText: document.querySelector('.header .brand__name').textContent.trim(),
        };
      });
      await close();
      assert.equal(info.scrollY, 0);
      assert.ok(info.bar.top >= 0 && info.bar.bottom <= info.vh, `barra de demo ${JSON.stringify(info.bar)}`);
      assert.equal(info.brandText, config.negocio.marca);
      assert.ok(info.brand.bottom <= info.vh);
      assert.ok(info.photoLoaded, 'la foto de la portada está cargada');
      assert.ok(info.photo.top < 400 && info.photo.bottom <= info.vh && info.photo.height >= 240 && info.photo.right - info.photo.left >= 389, `foto ${JSON.stringify(info.photo)}`);
      assert.ok(info.cta.bottom <= info.vh, `botón de reservar ${JSON.stringify(info.cta)}`);
      if (info.bannerTop !== null) assert.ok(info.cta.bottom <= info.bannerTop, `el banner (${info.bannerTop}) tapa el botón (${info.cta.bottom})`);
    });
  }
});

describe('modoDemo: false · producción', () => {
  it('sin barra de demo (ni con ?para), sin notas de ejemplo y con el WhatsApp del negocio', async () => {
    const { tab, close } = await open(prod, 'index.html?para=Lola', { consent: REJECTED });
    const info = await tab.evaluate(() => ({
      bar: !!document.querySelector('#demo-bar'),
      text: document.body.innerText,
      wa: [...document.querySelectorAll('a[href*="wa.me"]')].map((a) => a.href),
    }));
    await close();
    assert.ok(!info.bar);
    for (const trace of ['de ejemplo', 'JM Web Studio', 'Propuesta para']) assert.ok(!info.text.includes(trace), `aparece «${trace}»`);
    assert.ok(info.wa.length >= 4);
    for (const href of info.wa) {
      assert.ok(href.startsWith(`https://wa.me/${config.contacto.whatsapp}?text=`));
      assert.equal(decodeText(href), config.contacto.whatsappTexto);
    }
  });

  it('indexable: sin noindex en el contenido, canonical, schema.org coherente con la web y robots/sitemap', async () => {
    const { tab, log, close } = await open(prod, 'index.html', { consent: REJECTED });
    const info = await tab.evaluate(() => ({
      robots: !!document.querySelector('meta[name=robots]'),
      canonical: document.querySelector('link[rel=canonical]').href,
      ld: [...document.querySelectorAll('script[type="application/ld+json"]')].map((n) => JSON.parse(n.textContent)),
      text: document.body.innerText,
      ogTitle: document.querySelector('meta[property="og:title"]').content,
    }));
    await close();
    assert.ok(!info.robots, 'sin meta robots en producción');
    assert.equal(info.canonical, `${SITE_URL}/`);
    assert.equal(info.ld.length, 1);
    const [salon] = info.ld;
    assert.equal(salon.name, business.name);
    assert.equal(salon.telephone, business.phone);
    assert.deepEqual(Object.keys(salon.address).sort(), ['@type', 'addressCountry', 'addressLocality', 'addressRegion', 'postalCode', 'streetAddress']);
    assert.deepEqual(salon.hasOfferCatalog.itemListElement.map((o) => [o.itemOffered.name, Number(o.price)]), business.services.map((s) => [s.name, s.price]));
    for (const service of business.services) assert.ok(info.text.includes(service.name), `el schema menciona «${service.name}» pero la web no`);
    assert.equal(info.ogTitle, config.textos.titulo);
    assert.deepEqual(log.console, []);
    const robots = await open(prod, 'robots.txt');
    assert.match(await robots.tab.textContent('body'), /Allow: \/\s*Sitemap: https:\/\/azahar\.test\/sitemap\.xml/);
    const sitemap = await robots.tab.goto(`${prod.base}/sitemap.xml`);
    assert.equal(sitemap.status(), 200);
    await robots.close();
  });

  it('las páginas legales no llevan la nota de ejemplo y los datos sin rellenar siguen como «Pendiente»', async () => {
    const { tab, close } = await open(prod, 'aviso-legal.html', { consent: REJECTED });
    const info = await tab.evaluate(() => ({ note: !!document.querySelector('.legal__note'), pending: document.querySelectorAll('.pending').length }));
    await close();
    assert.ok(!info.note);
    assert.equal(info.pending, 3);
  });

  it('la reseñas se muestran sin la nota de ejemplo y cada servicio abre su propio calendario', async () => {
    const { tab, close } = await open(prod, 'index.html', { consent: REJECTED });
    const info = await tab.evaluate(() => ({ note: !!document.querySelector('.reviews__note'), reviews: document.querySelectorAll('.review').length, links: [...document.querySelectorAll('.svc__cta')].map((a) => a.dataset.calLink) }));
    await close();
    assert.ok(!info.note);
    assert.equal(info.reviews, config.resenas.length);
    assert.deepEqual(info.links, business.services.map((s) => slugLink(s.slug)));
  });

  for (const [width, height, touch] of [[390, 844, true], [1440, 900, false]]) {
    it(`humo a ${width}px: sin errores de consola, sin peticiones externas y sin desbordes`, async () => {
      const { tab, log, close } = await open(prod, 'index.html', { width, height, touch, consent: REJECTED });
      const overflow = await tab.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
      await close();
      assert.deepEqual(log.console, []);
      assert.deepEqual(log.external, []);
      assert.ok(overflow <= 1, `desborde de ${overflow}px`);
    });
  }
});
