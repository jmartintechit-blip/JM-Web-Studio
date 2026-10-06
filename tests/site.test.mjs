import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { after, before, describe, it } from 'node:test';
import {
  CAL_STUB, CONSENT_KEY, PAGES, SITE_URL, VIEWPORTS, blockExternal, business, launch, newContext, slugLink, startSite, track,
} from './helpers.mjs';

let site;
let browser;
const url = (page) => `${site.base}/${page}`;
const REJECTED = { cal: false, maps: false };

before(async () => { site = await startSite(); browser = await launch(); });
after(async () => { await browser.close(); await site.stop(); });

/** Abre una página con el contexto indicado y devuelve utilidades de limpieza. */
async function open(page, options = {}) {
  const context = await newContext(browser, options);
  const tab = await context.newPage();
  const log = track(tab, site.base);
  await blockExternal(tab, site.base);
  await tab.goto(url(page));
  await tab.waitForTimeout(300);
  return { tab, log, context, close: () => context.close() };
}

describe('calidad técnica: consola, red y desbordes', () => {
  for (const page of PAGES) {
    for (const [width, height] of VIEWPORTS) {
      it(`${page} a ${width}px`, async () => {
        const { tab, log, close } = await open(page, { width, height, consent: REJECTED });
        const overflow = await tab.evaluate(() => {
          const vw = document.documentElement.clientWidth;
          const out = [];
          if (document.documentElement.scrollWidth > vw + 1) out.push(`scrollWidth ${document.documentElement.scrollWidth} > ${vw}`);
          document.querySelectorAll('body *').forEach((el) => {
            const r = el.getBoundingClientRect();
            if (!r.width || !r.height || getComputedStyle(el).position === 'fixed') return;
            if (el.closest('svg') && el.tagName !== 'svg') return;
            if (r.right > vw + 1 || r.left < -1) {
              let a = el.parentElement;
              let clipped = false;
              while (a && a !== document.body) {
                const o = getComputedStyle(a);
                const ar = a.getBoundingClientRect();
                if (/(hidden|clip|auto|scroll)/.test(o.overflowX) && ar.right <= vw + 1 && ar.left >= -1) { clipped = true; break; }
                a = a.parentElement;
              }
              if (!clipped) out.push(`${el.tagName}.${el.getAttribute('class') || ''} [${Math.round(r.left)},${Math.round(r.right)}]`);
            }
          });
          return out.slice(0, 8);
        });
        await close();
        assert.deepEqual(log.console, [], 'errores o avisos de consola');
        assert.deepEqual(log.failed.concat(log.bad), [], 'peticiones fallidas o 4xx');
        assert.deepEqual(log.external, [], 'peticiones a terceros antes del consentimiento');
        assert.deepEqual(overflow, [], 'elementos que desbordan el ancho');
      });
    }
  }
});

describe('enlaces', () => {
  for (const page of PAGES) {
    it(`${page}: enlaces internos, anclas y enlaces externos`, async () => {
      const { tab, close } = await open(page, { consent: REJECTED });
      const links = await tab.evaluate(() => Array.from(document.querySelectorAll('a[href]')).map((a) => ({ href: a.getAttribute('href'), target: a.target, rel: a.rel })));
      const ids = await tab.evaluate(() => Array.from(document.querySelectorAll('[id]')).map((e) => e.id));
      await close();
      const problems = [];
      for (const link of links) {
        if (link.href.startsWith('#')) {
          if (link.href.length > 1 && !ids.includes(link.href.slice(1))) problems.push(`ancla rota ${link.href}`);
        } else if (/^https?:/.test(link.href)) {
          if (link.target !== '_blank' || !/noopener/.test(link.rel)) problems.push(`externo sin target/noopener: ${link.href}`);
        } else if (!/^(tel|mailto):/.test(link.href)) {
          const [file, hash] = link.href.split('#');
          if (!existsSync(join(site.outDir, file || page))) problems.push(`archivo inexistente ${link.href}`);
          else if (hash && hash !== 'cookies' && !readFileSync(join(site.outDir, file || page), 'utf8').includes(`id="${hash}"`)) problems.push(`ancla ausente ${link.href}`);
        }
      }
      assert.deepEqual(problems, []);
    });
  }
});

describe('SEO y accesibilidad estática', () => {
  const titles = new Set();
  const descriptions = new Set();

  for (const page of PAGES) {
    it(`${page}: metadatos, encabezados y nombres accesibles`, async () => {
      const { tab, close } = await open(page, { consent: REJECTED });
      const d = await tab.evaluate(() => {
        const headings = Array.from(document.querySelectorAll('h1,h2,h3,h4')).map((h) => +h.tagName[1]);
        const meta = (sel, attr = 'content') => (document.querySelector(sel) || {})[attr] || '';
        return {
          lang: document.documentElement.lang,
          title: document.title,
          description: meta('meta[name=description]'),
          canonical: meta('link[rel=canonical]', 'href'),
          h1: document.querySelectorAll('h1').length,
          skipsLevel: headings.some((h, i) => i > 0 && h - headings[i - 1] > 1),
          unnamed: Array.from(document.querySelectorAll('a,button')).filter((e) => !(e.innerText || '').trim() && !e.getAttribute('aria-label')).length,
          imgsWithoutAlt: Array.from(document.querySelectorAll('img')).filter((i) => !i.hasAttribute('alt')).length,
          roleImgWithoutLabel: Array.from(document.querySelectorAll('[role=img]')).filter((e) => !e.getAttribute('aria-label')).length,
          inputsWithoutLabel: Array.from(document.querySelectorAll('input')).filter((i) => !i.getAttribute('aria-label') && !i.closest('label')).length,
          viewport: !!document.querySelector('meta[name=viewport]'),
          favicon: !!document.querySelector('link[rel~=icon]'),
          mains: document.querySelectorAll('main').length,
          ogImage: meta('meta[property="og:image"]'),
        };
      });
      await close();
      titles.add(d.title);
      descriptions.add(d.description);
      assert.equal(d.lang, 'es');
      assert.ok(d.title.length >= 10 && d.title.length <= 65, `title de ${d.title.length} caracteres`);
      assert.ok(d.description.length >= 70 && d.description.length <= 160, `description de ${d.description.length} caracteres`);
      assert.equal(d.h1, 1, 'debe haber un único H1');
      assert.ok(!d.skipsLevel, 'jerarquía de encabezados con saltos');
      assert.equal(d.unnamed, 0, 'enlaces o botones sin nombre accesible');
      assert.equal(d.imgsWithoutAlt, 0);
      assert.equal(d.roleImgWithoutLabel, 0);
      assert.equal(d.inputsWithoutLabel, 0);
      assert.ok(d.viewport && d.favicon && d.mains === 1);
      if (page !== '404.html') assert.ok(d.canonical.startsWith(SITE_URL), `canonical ${d.canonical}`);
      if (page === 'index.html') assert.ok(d.ogImage.startsWith(SITE_URL), 'og:image debe ser absoluta');
    });
  }

  it('títulos y descripciones únicos', () => {
    assert.equal(titles.size, PAGES.length);
    assert.equal(descriptions.size, PAGES.length);
  });

  it('el Schema.org coincide con los datos reales y con el contenido visible', async () => {
    const { tab, close } = await open('index.html', { consent: REJECTED });
    const schemas = await tab.$$eval('script[type="application/ld+json"]', (nodes) => nodes.map((n) => JSON.parse(n.textContent)));
    const text = await tab.evaluate(() => document.body.innerText);
    await close();
    assert.equal(schemas.length, 1, 'solo el Schema del negocio (no hay FAQ en la web)');
    const salon = schemas[0];
    assert.equal(salon['@type'], 'BeautySalon');
    assert.equal(salon.name, business.name);
    assert.equal(salon.telephone, business.phone);
    assert.equal(salon.url, `${SITE_URL}/`);
    assert.equal(salon.openingHoursSpecification[0].opens, '09:00');
    assert.equal(salon.openingHoursSpecification[0].closes, '17:00');
    assert.equal(salon.address.addressLocality, 'Sevilla');
    assert.deepEqual(Object.keys(salon.address).sort(), ['@type', 'addressCountry', 'addressLocality', 'addressRegion'], 'sin campos de dirección inventados');
    const offers = salon.hasOfferCatalog.itemListElement.map((o) => [o.itemOffered.name, Number(o.price)]);
    assert.deepEqual(offers, business.services.map((s) => [s.name, s.price]));
    for (const [name] of offers) assert.ok(text.includes(name), `el Schema menciona "${name}" pero la web no`);
  });
});

describe('contenido contra los datos reales del negocio', () => {
  it('muestra nombre, zona, horario y teléfono', async () => {
    const { tab, close } = await open('index.html', { consent: REJECTED });
    const text = (await tab.evaluate(() => document.body.innerText)).replace(/ /g, ' ');
    const tels = await tab.$$eval('a[href^="tel:"]', (els) => els.map((e) => e.getAttribute('href')));
    await close();
    assert.ok(text.includes(business.name.split(' ')[0]));
    assert.ok(text.includes(business.locality.split(',')[0]));
    assert.ok(text.includes(`${business.hours.open} – ${business.hours.close}`));
    assert.ok(text.includes(business.hours.label));
    assert.ok(text.includes(business.phoneDisplay));
    assert.ok(tels.length >= 3 && tels.every((t) => t === `tel:${business.phone}`));
  });

  it('cada servicio tiene su nombre, duración, precio y botón de reserva', async () => {
    const { tab, close } = await open('index.html', { consent: REJECTED });
    const rows = await tab.$$eval('.svc', (els) => els.map((e) => ({
      name: e.querySelector('.svc__name').textContent.trim(),
      min: e.querySelector('.svc__min').textContent.trim(),
      price: e.querySelector('.svc__price').textContent.replace(/ /g, ' ').replace('Precio:', '').trim(),
      barMinutes: Number(e.querySelector('.svc__fill').style.getPropertyValue('--min')),
      link: e.querySelector('[data-cal-link]').getAttribute('data-cal-link'),
    })));
    await close();
    assert.deepEqual(rows, business.services.map((s) => ({ name: s.name, min: s.duration, price: `${s.price} €`, barMinutes: s.minutes, link: slugLink(s.slug) })));
  });

  it('todos los enlaces de WhatsApp apuntan al número real con mensaje', async () => {
    const { tab, close } = await open('index.html', { consent: REJECTED });
    const links = await tab.$$eval('a[href*="wa.me"]', (els) => els.map((e) => e.href));
    await close();
    assert.ok(links.length >= 5);
    for (const href of links) {
      assert.ok(href.startsWith(`https://wa.me/${business.whatsapp}?text=`), href);
      assert.ok(decodeURIComponent(href.split('text=')[1]).length > 10);
    }
  });

  it('los datos legales sin información real están marcados como pendientes (no inventados)', () => {
    for (const file of ['aviso-legal.html', 'politica-privacidad.html']) {
      const html = readFileSync(join(site.outDir, file), 'utf8');
      assert.ok((html.match(/class="pending"/g) || []).length >= 4, `${file}: faltan marcas de dato pendiente`);
      assert.ok(!/B0{8}|\.example|S\.L\./.test(html), `${file}: contiene datos de ejemplo que parecen reales`);
    }
  });

  it('no contiene afirmaciones inventadas típicas', () => {
    const banned = [/años de experiencia/i, /clientes satisfech/i, /n[úu]mero 1/i, /certificad/i, /premium/i, /desde 20\d\d/i, /testimonio/i, /esterilizad/i, /un solo uso/i, /duran semanas/i];
    for (const file of PAGES) {
      const text = readFileSync(join(site.outDir, file), 'utf8').replace(/<script[\s\S]*?<\/script>/g, '');
      for (const pattern of banned) assert.ok(!pattern.test(text), `${file}: coincide con ${pattern}`);
    }
  });
});

describe('consentimiento y reservas', () => {
  it('primera visita: banner visible, calendario y mapa sin cargar, y Aceptar/Rechazar con el mismo peso', async () => {
    const { tab, log, close } = await open('index.html');
    assert.ok(await tab.isVisible('#cookie-banner'));
    assert.ok(await tab.isVisible('#cal-gate'));
    const buttons = await tab.$$eval('#cookie-banner .cookie__actions .btn', (els) => els.map((e) => ({ text: e.textContent.trim(), cls: e.className, h: e.getBoundingClientRect().height })));
    await close();
    assert.deepEqual(log.external, []);
    const [reject, accept] = buttons;
    assert.equal(reject.text, 'Rechazar');
    assert.equal(accept.text, 'Aceptar');
    assert.equal(reject.cls, accept.cls, 'Aceptar y Rechazar deben compartir estilo');
    assert.ok(buttons.every((b) => b.h >= 44));
  });

  it('Rechazar guarda la decisión, no vuelve a preguntar y no carga terceros', async () => {
    const { tab, log, close } = await open('index.html');
    await tab.click('[data-consent="reject"]');
    assert.ok(!(await tab.isVisible('#cookie-banner')));
    assert.match(await tab.evaluate((k) => localStorage.getItem(k), CONSENT_KEY), /"cal":false.*"maps":false|"maps":false.*"cal":false/);
    await tab.reload();
    await tab.waitForTimeout(300);
    assert.ok(!(await tab.isVisible('#cookie-banner')));
    await close();
    assert.deepEqual(log.external, []);
  });

  it('aceptar carga Cal.com con el usuario real y el mapa; cada "Reservar" abre su servicio', async () => {
    const context = await newContext(browser);
    const tab = await context.newPage();
    const log = track(tab, site.base);
    await tab.route(`${business.cal.origin}/embed/embed.js`, (r) => r.fulfill({ contentType: 'application/javascript', body: CAL_STUB }));
    await tab.route((u) => u.href.startsWith('https://www.google.com/maps'), (r) => r.fulfill({ contentType: 'text/html', body: '<html><body>mapa</body></html>' }));
    await tab.route((u) => !u.href.startsWith(site.base) && !u.href.startsWith(business.cal.origin) && !u.href.startsWith('https://www.google.com/maps'), (r) => r.abort());
    await tab.goto(url('index.html'));

    await tab.click('[data-consent="config"]');
    assert.ok(await tab.isVisible('#cookie-config'));
    await tab.check('#consent-third');
    await tab.click('[data-consent="save"]');
    await tab.evaluate(() => document.querySelector('#reservar').scrollIntoView());
    await tab.waitForSelector('#cal-inline iframe', { timeout: 6000 });
    let calls = await tab.evaluate(() => window.__calCalls);
    assert.ok(calls.some((c) => c[0] === 'inline' && c[2] === business.cal.user), JSON.stringify(calls));
    const ui = calls.find((c) => c[0] === 'ui');
    assert.equal(ui[2].styles.branding.brandColor, '#1B3590', 'el calendario usa el color de marca');

    await tab.evaluate(() => document.querySelector('#contacto').scrollIntoView());
    await tab.waitForSelector('#map-wrap iframe', { timeout: 6000 });
    assert.match(await tab.$eval('#map-wrap iframe', (f) => f.src), /google\.com\/maps/);

    for (const service of business.services) {
      await tab.evaluate(() => window.scrollTo(0, 0));
      await tab.click(`.svc__cta[data-service="${service.name}"]`);
      await tab.waitForTimeout(700);
      assert.equal(await tab.$eval('#cal-inline iframe', (f) => f.getAttribute('data-cal-link')), slugLink(service.slug), service.name);
      assert.equal(await tab.$eval('#service-chips .chip.is-active', (c) => c.dataset.service), service.name);
    }
    await tab.click('#service-chips .chip[data-service="Todos los servicios"]');
    assert.equal(await tab.$eval('#cal-inline iframe', (f) => f.getAttribute('data-cal-link')), business.cal.user);

    await tab.evaluate(() => window.scrollTo(0, 0));
    await tab.click('.hero__actions [data-book]');
    await tab.waitForTimeout(800);
    const top = await tab.evaluate(() => Math.round(document.querySelector('#reservar').getBoundingClientRect().top));
    assert.ok(Math.abs(top) < 140, `"Reservar cita" del hero lleva a la reserva (top=${top})`);
    await context.close();
    assert.deepEqual(log.console, []);
  });

  it('si Cal.com no carga, ofrece el enlace directo', async () => {
    const { tab, close } = await open('index.html', { consent: { cal: true, maps: false } });
    await tab.evaluate(() => document.querySelector('#reservar').scrollIntoView());
    await tab.waitForTimeout(1500);
    assert.ok(await tab.isVisible('#cal-fallback'));
    assert.equal(await tab.$eval('#cal-fallback-link', (a) => a.href), `${business.cal.base}/${business.cal.user}`);
    await close();
  });

  it('el aviso de demostración se cierra y no reaparece durante la sesión', async () => {
    const { tab, close } = await open('index.html', { consent: REJECTED });
    assert.ok(await tab.isVisible('#demo-bar'));
    await tab.click('#demo-close');
    await tab.waitForTimeout(500);
    assert.ok(!(await tab.isVisible('#demo-bar')));
    await tab.reload();
    assert.ok(!(await tab.isVisible('#demo-bar')));
    await close();
  });

  it('todo el contenido revelado al hacer scroll acaba visible (red de seguridad)', async () => {
    const { tab, close } = await open('index.html', { consent: REJECTED });
    await tab.waitForTimeout(6500);
    assert.equal(await tab.$$eval('.reveal', (els) => els.filter((e) => !e.classList.contains('is-in')).length), 0);
    await close();
  });
});

describe('móvil', () => {
  it('menú, barra fija de reserva, WhatsApp y llamada', async () => {
    const { tab, log, close } = await open('index.html', { width: 390, height: 844, consent: REJECTED, touch: true });
    assert.ok(await tab.$eval('#mobile-bar', (b) => b.classList.contains('is-hidden')), 'la barra no debe duplicar el botón del hero al cargar');
    assert.ok(!(await tab.isVisible('#nav')), 'menú cerrado');

    await tab.tap('#burger');
    await tab.waitForTimeout(450);
    assert.equal(await tab.getAttribute('#burger', 'aria-expanded'), 'true');
    assert.ok(await tab.isVisible('#nav'));
    assert.match(await tab.getAttribute('#burger use', 'href'), /sprite\.svg#i-close$/, 'el icono del menú pasa a "cerrar" usando el sprite externo');
    await tab.keyboard.press('Escape');
    await tab.waitForTimeout(450);
    assert.equal(await tab.getAttribute('#burger', 'aria-expanded'), 'false');
    await tab.tap('#burger');
    await tab.waitForTimeout(450);
    await tab.tap('.nav__list a[href="#servicios"]');
    await tab.waitForTimeout(1000);
    assert.ok(!(await tab.isVisible('#nav')), 'el menú se cierra al elegir un enlace');

    assert.ok(!(await tab.$eval('#mobile-bar', (b) => b.classList.contains('is-hidden'))), 'la barra aparece al salir del hero');
    const actions = await tab.$$eval('#mobile-bar a', (els) => els.map((e) => ({ href: e.getAttribute('href'), h: Math.round(e.getBoundingClientRect().height), w: Math.round(e.getBoundingClientRect().width) })));
    assert.equal(actions.length, 3);
    assert.ok(actions.every((a) => a.h >= 44 && a.w >= 44), JSON.stringify(actions));
    assert.ok(actions[1].href.startsWith(`https://wa.me/${business.whatsapp}`));
    assert.equal(actions[2].href, `tel:${business.phone}`);

    await tab.evaluate(() => document.querySelector('#reservar').scrollIntoView());
    await tab.waitForTimeout(800);
    assert.ok(await tab.$eval('#mobile-bar', (b) => b.classList.contains('is-hidden')), 'la barra se oculta mientras se ve el calendario');
    await close();
    assert.deepEqual(log.console, []);
  });

  it('el banner de cookies oculta la barra fija mientras está abierto', async () => {
    const { tab, close } = await open('index.html', { width: 390, height: 844, touch: true });
    await tab.evaluate(() => document.querySelector('#servicios').scrollIntoView());
    await tab.waitForTimeout(600);
    const barY = await tab.$eval('#mobile-bar', (b) => Math.round(b.getBoundingClientRect().top));
    assert.ok(barY >= 844, `barra fuera de pantalla con el banner abierto (top=${barY})`);
    await close();
  });

  it('objetivos táctiles de botones y enlaces propios >= 44 px de alto', async () => {
    const { tab, close } = await open('index.html', { width: 390, height: 844, consent: REJECTED, touch: true });
    const small = await tab.$$eval('.btn, .chip, .burger, .nav__list a, .text-link, .embed__alt, .footer__nav a, .footer__nav button', (els) => els
      .filter((e) => { const r = e.getBoundingClientRect(); return r.width > 0 && r.height > 0 && getComputedStyle(e).visibility !== 'hidden' && r.height < 43.5; })
      .map((e) => `${(e.textContent || e.getAttribute('aria-label') || '').trim().slice(0, 24)} (${Math.round(e.getBoundingClientRect().height)}px)`));
    await close();
    assert.deepEqual(small, []);
  });
});

describe('teclado, movimiento reducido y rendimiento', () => {
  it('el foco recorre la página con contorno visible y sin caer en elementos ocultos', async () => {
    const { tab, close } = await open('index.html', { consent: REJECTED });
    await tab.keyboard.press('Tab');
    assert.match(await tab.evaluate(() => document.activeElement.className), /skip-link/);
    let hidden = 0;
    let noOutline = 0;
    for (let i = 0; i < 60; i++) {
      await tab.keyboard.press('Tab');
      const info = await tab.evaluate(() => {
        const e = document.activeElement;
        if (!e || e === document.body) return null;
        const r = e.getBoundingClientRect();
        const cs = getComputedStyle(e);
        return { visible: r.width > 0 && r.height > 0 && cs.visibility !== 'hidden', outline: cs.outlineStyle !== 'none' && parseFloat(cs.outlineWidth) >= 2 };
      });
      if (!info) continue;
      if (!info.visible) hidden++;
      if (!info.outline) noOutline++;
    }
    await close();
    assert.equal(hidden, 0);
    assert.equal(noOutline, 0);
  });

  it('con "reducir movimiento" no hay animaciones continuas ni contenido oculto', async () => {
    const context = await browser.newContext({ viewport: { width: 1280, height: 800 }, reducedMotion: 'reduce' });
    const tab = await context.newPage();
    await blockExternal(tab, site.base);
    await tab.goto(url('index.html'));
    await tab.waitForTimeout(1200);
    const state = await tab.evaluate(() => ({
      nail: getComputedStyle(document.querySelector('.nail--3')).animationName,
      scroll: getComputedStyle(document.documentElement).scrollBehavior,
      title: getComputedStyle(document.querySelector('.hero__title')).opacity,
    }));
    await context.close();
    assert.deepEqual(state, { nail: 'none', scroll: 'auto', title: '1' });
  });

  it('el indicador "abierto ahora" coincide con el horario en hora de Madrid', async () => {
    const { tab, close } = await open('index.html', { consent: REJECTED });
    const shown = await tab.$eval('#open-now', (e) => e.textContent);
    await close();
    const parts = new Intl.DateTimeFormat('en-GB', { timeZone: 'Europe/Madrid', weekday: 'short', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).formatToParts(new Date());
    const get = (t) => parts.find((p) => p.type === t).value;
    const minutes = Number(get('hour')) * 60 + Number(get('minute'));
    const isOpen = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri'].includes(get('weekday')) && minutes >= 540 && minutes < 1020;
    assert.equal(shown, isOpen ? 'Abierto ahora, hasta las 17:00' : 'Cerrado ahora');
  });

  it('presupuesto de peso: la portada carga poco y sin imágenes ni recursos externos', async () => {
    const context = await newContext(browser, { width: 390, height: 844, consent: REJECTED, touch: true });
    const tab = await context.newPage();
    let bytes = 0;
    const images = [];
    tab.on('response', async (r) => {
      const body = await r.body().catch(() => Buffer.alloc(0));
      bytes += body.length;
      if (r.request().resourceType() === 'image') images.push(r.url());
    });
    await blockExternal(tab, site.base);
    await tab.goto(url('index.html'), { waitUntil: 'networkidle' });
    await context.close();
    assert.ok(bytes < 260 * 1024, `la portada pesa ${(bytes / 1024).toFixed(0)} KB sin comprimir`);
    const raster = images.filter((src) => !/\.svg$|favicon|apple-touch-icon/.test(src));
    assert.deepEqual(raster, [], 'la portada no debe descargar imágenes de mapa de bits (solo SVG y favicon)');
  });
});
