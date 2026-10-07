import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { after, before, describe, it } from 'node:test';
import {
  CAL_STUB, CONSENT_KEY, PAGES, SITE_URL, VIEWPORTS, blockExternal, business, config, launch, newContext, slugLink, startSite, track,
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

  it('en modo demo no hay datos estructurados de negocio local (los de producción se prueban en modes.test.mjs)', async () => {
    const { tab, close } = await open('index.html', { consent: REJECTED });
    const schemas = await tab.$$eval('script[type="application/ld+json"]', (nodes) => nodes.length);
    await close();
    assert.equal(schemas, 0);
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
    for (const row of business.schedule) {
      assert.ok(text.includes(row.label), `falta la fila de horario «${row.label}»`);
      for (const range of row.ranges) assert.ok(text.includes(`${range.openText} – ${range.closeText}`), `falta la franja ${range.openText} – ${range.closeText} de «${row.label}»`);
    }
    if (business.schedule.some((row) => row.closed)) assert.ok(text.includes('Cerrado'), 'los días cerrados se muestran como «Cerrado»');
    const first = business.schedule.find((row) => !row.closed);
    const summary = `${first.label}, ${first.ranges.map((r) => `de ${r.openText} a ${r.closeText}`).join(' y ')}`;
    assert.ok(text.includes(summary), `el resumen de la portada debería decir «${summary}»`);
    assert.ok(text.includes(business.phoneDisplay));
    assert.ok(tels.length >= 3 && tels.every((t) => t === `tel:${business.phone}`));
  });

  it('cada servicio tiene su nombre, duración, precio y botón de reserva', async () => {
    const { tab, close } = await open('index.html', { consent: REJECTED });
    const rows = await tab.$$eval('.svc', (els) => els.map((e) => ({
      name: e.querySelector('.svc__name').textContent.trim(),
      min: e.querySelector('.svc__min').textContent.trim(),
      price: e.querySelector('.svc__price').textContent.replace(/ /g, ' ').replace('Precio:', '').trim(),
      link: e.querySelector('[data-cal-link]').getAttribute('data-cal-link'),
    })));
    await close();
    assert.deepEqual(rows, business.services.map((s) => ({ name: s.name, min: s.duration, price: `${s.price} €`, link: slugLink(s.slug) })));
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
      assert.ok((html.match(/class="pending"/g) || []).length >= 3, `${file}: faltan marcas de dato pendiente`);
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
    assert.ok(calls.some((c) => c[0] === 'inline' && c[2] === slugLink(business.services[0].slug)), JSON.stringify(calls));
    const ui = calls.find((c) => c[0] === 'ui');
    assert.equal(ui[2].styles.branding.brandColor, config.colores.tinta, 'el calendario usa el color de marca de la configuración');

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
    assert.equal(await tab.$$eval('#service-chips .chip', (chips) => chips.length), business.services.length, 'un selector por servicio y ninguno más');

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
    assert.equal(await tab.$eval('#cal-fallback-link', (a) => a.href), `${business.cal.base}/${slugLink(business.services[0].slug)}`);
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
    assert.equal((await tab.textContent('#burger')).trim(), 'Cerrar', 'el botón del menú cambia su etiqueta a "Cerrar"');
    await tab.keyboard.press('Escape');
    await tab.waitForTimeout(450);
    assert.equal(await tab.getAttribute('#burger', 'aria-expanded'), 'false');
    assert.equal((await tab.textContent('#burger')).trim(), 'Menú');
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
    const small = await tab.$$eval('.btn, .chip, .burger, .nav__list a, .link, .svc__cta span, .footer__col a, .footer__col button, .footer__legal a', (els) => els
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
      photoTransition: getComputedStyle(document.querySelector('.hero__media img')).transitionDuration,
      scroll: getComputedStyle(document.documentElement).scrollBehavior,
      title: getComputedStyle(document.querySelector('.hero__title')).opacity,
    }));
    await context.close();
    assert.deepEqual(state, { photoTransition: '0s', scroll: 'auto', title: '1' });
  });

  it('el indicador "abierto ahora" coincide con el horario en hora de Madrid, incluida la pausa entre franjas', async () => {
    // Semana de referencia sin cambio de hora: lunes 12 de octubre de 2026 (CEST, +02:00). Los instantes salen del horario configurado.
    const DAYS = ['lun', 'mar', 'mie', 'jue', 'vie', 'sab', 'dom'];
    const toMin = (hhmm) => Number(hhmm.slice(0, 2)) * 60 + Number(hhmm.slice(3));
    const shift = (hhmm, min) => { const t = toMin(hhmm) + Math.floor(min); return `${String(Math.floor(t / 60)).padStart(2, '0')}:${String(t % 60).padStart(2, '0')}`; };
    const expected = (day, hhmm) => {
      for (const row of business.schedule) {
        if (!row.days.includes(day)) continue;
        const current = row.ranges.find((r) => r.open <= hhmm && hhmm < r.close);
        if (current) return `Abierto ahora, hasta las ${current.closeText}`;
      }
      return 'Cerrado ahora';
    };
    const instants = [];
    for (const row of business.schedule) {
      const day = row.days[0];
      const times = new Set(['03:00', '12:00']);
      row.ranges.forEach((r, i) => {
        [shift(r.open, -1), r.open, shift(r.open, 1), shift(r.close, -1), r.close, shift(r.close, 1)].forEach((t) => times.add(t));
        if (row.ranges[i + 1]) times.add(shift(r.close, (toMin(row.ranges[i + 1].open) - toMin(r.close)) / 2));   // mitad de la pausa
      });
      for (const t of times) instants.push([day, t]);
      if (row.days.length > 1) instants.push([row.days[row.days.length - 1], row.ranges[0] ? row.ranges[0].open : '12:00']);
    }
    const context = await newContext(browser, { consent: REJECTED });
    const tab = await context.newPage();
    await blockExternal(tab, site.base);
    const wrong = [];
    for (const [day, hhmm] of instants) {
      await tab.clock.setFixedTime(new Date(`2026-10-${12 + DAYS.indexOf(day)}T${hhmm}:00+02:00`));
      await tab.goto(url('index.html'));
      const shown = await tab.$eval('#open-now', (e) => e.textContent);
      if (shown !== expected(day, hhmm)) wrong.push(`${day} ${hhmm}: «${shown}» en vez de «${expected(day, hhmm)}»`);
    }
    await context.close();
    assert.ok(instants.length >= 10, `pocos instantes probados (${instants.length})`);
    assert.deepEqual(wrong, []);
  });

  it('presupuesto de peso: la primera pantalla móvil carga poco y las fotografías lejanas se difieren', async () => {
    const context = await newContext(browser, { width: 390, height: 844, consent: REJECTED, touch: true });
    const tab = await context.newPage();
    const loaded = [];
    tab.on('response', async (r) => {
      const body = await r.body().catch(() => Buffer.alloc(0));
      loaded.push({ type: r.request().resourceType(), file: r.url().split('?')[0].split('/').pop(), bytes: body.length });
    });
    await blockExternal(tab, site.base);
    await tab.goto(url('index.html'), { waitUntil: 'networkidle' });
    await context.close();
    const kb = (list) => list.reduce((sum, x) => sum + x.bytes, 0) / 1024;
    const hero = config.fotos.portada.archivo;
    // Lo imprescindible para pintar la primera pantalla: documento, CSS, JS, fuentes y la foto de portada
    const critical = loaded.filter((x) => x.type !== 'image' || x.file === hero);
    assert.ok(kb(critical) < 250, `lo imprescindible pesa ${kb(critical).toFixed(0)} KB sin comprimir`);
    // Chrome puede adelantar algunas fotos en diferido que están cerca del borde de la pantalla; aun así, el total se acota
    assert.ok(kb(loaded) < 450, `la portada completa carga ${kb(loaded).toFixed(0)} KB sin comprimir`);
    const photos = loaded.filter((x) => x.type === 'image' && /\.(webp|jpe?g|png)$/.test(x.file)).map((x) => x.file);
    assert.ok(photos.includes(hero), 'la foto de portada debe cargar de inmediato');
    const last = config.fotos.galeria[config.fotos.galeria.length - 1].archivo;
    assert.ok(!photos.includes(last), `la galería final debe cargarse en diferido (cargadas: ${photos.join(', ')})`);
  });

  it('las imágenes declaran dimensiones, carga adecuada y marcan los placeholders', async () => {
    const { tab, close } = await open('index.html', { consent: REJECTED });
    const imgs = await tab.$$eval('img', (els) => els.map((i) => ({
      src: i.getAttribute('src'), w: i.getAttribute('width'), h: i.getAttribute('height'), alt: i.getAttribute('alt'),
      loading: i.getAttribute('loading'), priority: i.getAttribute('fetchpriority'), placeholder: i.hasAttribute('data-placeholder'),
    })));
    // El navegador decodifica cada foto y confirma que width/height del HTML (leídos del archivo por el build) son los reales
    const natural = await tab.$$eval('img', (els) => Promise.all(els.map(async (i) => { i.loading = 'eager'; await i.decode(); return [i.getAttribute('src'), i.naturalWidth, i.naturalHeight]; })));
    await close();
    assert.equal(imgs.length, 5, 'portada, estudio y tres de galería');
    for (const [src, w, h] of natural) {
      const img = imgs.find((i) => i.src === src);
      assert.deepEqual([Number(img.w), Number(img.h)], [w, h], `${src}: width/height del HTML no coinciden con la imagen real (${w}×${h})`);
    }
    // Los textos alternativos de las fotos son los de la configuración
    const configured = [config.fotos.portada, config.fotos.estudio, ...config.fotos.galeria];
    for (const foto of configured) {
      const img = imgs.find((i) => i.src === `assets/img/photos/${foto.archivo}`);
      assert.ok(img, `no aparece ${foto.archivo}`);
      assert.equal(img.alt, foto.alt || '', `alt de ${foto.archivo}`);
      assert.equal(img.placeholder, Boolean(foto.provisional), `data-placeholder de ${foto.archivo}`);
    }
    for (const img of imgs) {
      assert.ok(img.w && img.h, `${img.src}: sin width/height (provoca saltos de maquetación)`);
      assert.notEqual(img.alt, null, `${img.src}: falta el atributo alt`);
      if (img.placeholder) assert.equal(img.alt, '', `${img.src}: un placeholder decorativo debe tener alt vacío; al poner una foto real hay que describirla y quitar data-placeholder`);
      else assert.ok(img.alt.length > 5, `${img.src}: una foto real necesita un alt descriptivo`);
    }
    const hero = imgs.find((i) => /portada/.test(i.src));
    assert.equal(hero.priority, 'high');
    assert.notEqual(hero.loading, 'lazy');
    for (const img of imgs.filter((i) => i !== hero)) assert.equal(img.loading, 'lazy', `${img.src} debe cargarse en diferido`);
    const placeholders = imgs.filter((i) => i.placeholder).length;
    if (placeholders) console.log(`   (aviso) ${placeholders} de ${imgs.length} fotografías son provisionales y hay que sustituirlas por fotos reales`);
  });
});

describe('regresiones de la revisión de diseño', () => {
  /** Contexto con el doble local de Cal.com y de Google Maps, sin más salida a internet. */
  async function openWithStubs(options = {}) {
    const context = await newContext(browser, options);
    const tab = await context.newPage();
    const log = track(tab, site.base);
    await tab.route(`${business.cal.origin}/embed/embed.js`, (r) => r.fulfill({ contentType: 'application/javascript', body: CAL_STUB }));
    await tab.route((u) => u.href.startsWith('https://www.google.com/maps'), (r) => r.fulfill({ contentType: 'text/html', body: '<html><body>mapa</body></html>' }));
    await tab.route((u) => !u.href.startsWith(site.base) && !u.href.startsWith(business.cal.origin) && !u.href.startsWith('https://www.google.com/maps'), (r) => r.abort());
    await tab.goto(url('index.html'));
    await tab.waitForTimeout(300);
    return { tab, log, context };
  }

  for (const [width, height] of [[1280, 720], [1366, 768], [1536, 864]]) {
    it(`portátil ${width}x${height}: el botón principal de la portada queda dentro del pliegue (con el aviso demo visible)`, async () => {
      const { tab, close } = await open('index.html', { width, height, consent: REJECTED });
      const bottom = await tab.$eval('#hero-cta', (b) => Math.round(b.getBoundingClientRect().bottom));
      await close();
      assert.ok(bottom <= height, `el botón termina en y=${bottom} con pliegue en ${height}`);
    });
  }

  it('el banner de cookies de escritorio no tapa el botón principal ni el texto de la portada', async () => {
    const { tab, close } = await open('index.html', { width: 1366, height: 768 });
    const overlap = await tab.evaluate(() => {
      const b = document.querySelector('#cookie-banner').getBoundingClientRect();
      return ['#hero-cta', '.hero__lead', '.hero__title'].filter((sel) => {
        const r = document.querySelector(sel).getBoundingClientRect();
        return r.left < b.right && r.right > b.left && r.top < b.bottom && r.bottom > b.top;
      });
    });
    await close();
    assert.deepEqual(overlap, []);
  });

  for (const width of [768, 820, 900]) {
    it(`servicios a ${width}px: el precio y «Reservar» no se tocan`, async () => {
      const { tab, close } = await open('index.html', { width, height: 1024, consent: REJECTED });
      const gaps = await tab.$$eval('.svc', (rows) => rows.map((row) => {
        const price = row.querySelector('.svc__price').getBoundingClientRect();
        const cta = row.querySelector('.svc__cta span').getBoundingClientRect();
        return Math.round(cta.left - price.right);
      }));
      await close();
      assert.ok(gaps.every((g) => g >= 16), `huecos precio→Reservar: ${gaps}`);
    });
  }

  it('la portada y el contenido siguen visibles si main.js no se carga', async () => {
    const context = await newContext(browser, { consent: REJECTED });
    const tab = await context.newPage();
    await blockExternal(tab, site.base);
    await tab.route('**/assets/js/main.js*', (r) => r.abort());
    await tab.goto(url('index.html'));
    await tab.waitForTimeout(1200);
    const early = await tab.evaluate(() => ({
      title: getComputedStyle(document.querySelector('.hero__title')).opacity,
      photo: getComputedStyle(document.querySelector('.hero__media')).opacity,
    }));
    assert.equal(early.photo, '1', 'la foto de la portada nunca nace oculta');
    assert.equal(early.title, '1');
    await tab.waitForTimeout(5700);
    const late = await tab.$$eval('.reveal', (els) => els.filter((e) => getComputedStyle(e).opacity !== '1').length);
    await context.close();
    assert.equal(late, 0, 'a los 6 s la red de seguridad CSS muestra todo el contenido');
  });

  it('el botón del calendario monta Cal.com una sola vez, avisa del estado y mueve el foco al selector', async () => {
    const { tab, log, context } = await openWithStubs();
    await tab.evaluate(() => document.querySelector('#reservar').scrollIntoView());
    await tab.click('#cal-load');
    await tab.waitForSelector('#cal-inline iframe', { timeout: 6000 });
    await tab.waitForTimeout(500);
    const calls = await tab.evaluate(() => window.__calCalls.filter((c) => c[0] === 'inline').length);
    const focus = await tab.evaluate(() => document.activeElement.className);
    const status = await tab.textContent('#embed-status');
    await context.close();
    assert.equal(calls, 1, 'una única llamada inline a Cal.com');
    assert.match(focus, /chip/);
    assert.match(status, /Cargando el calendario/);
    assert.deepEqual(log.console, []);
  });

  for (const [width, height, touch] of [[390, 844, true], [1440, 900, false]]) {
    it(`«Reservar» de un servicio a ${width}px deja visibles los selectores de servicio bajo la cabecera y con el foco`, async () => {
      const { tab, close } = await open('index.html', { width, height, consent: REJECTED, touch });
      await tab.click('.svc__cta[data-service="Uñas de gel"]');
      await tab.waitForTimeout(1500);
      const info = await tab.evaluate(() => {
        const chips = [...document.querySelectorAll('#service-chips .chip')].map((c) => c.getBoundingClientRect());
        return {
          headerBottom: document.querySelector('#header').getBoundingClientRect().bottom,
          chipsTop: Math.min(...chips.map((r) => r.top)),
          chipsBottom: Math.max(...chips.map((r) => r.bottom)),
          focus: document.activeElement.dataset.service,
          vh: innerHeight,
        };
      });
      await close();
      assert.ok(info.chipsTop >= info.headerBottom - 1, `selectores bajo la cabecera: ${JSON.stringify(info)}`);
      assert.ok(info.chipsBottom <= info.vh, JSON.stringify(info));
      assert.equal(info.focus, 'Uñas de gel');
    });
  }

  it('en móvil, «Reservar cita» de la cabecera cierra el menú abierto y lleva al calendario', async () => {
    const { tab, close } = await open('index.html', { width: 390, height: 844, consent: REJECTED, touch: true });
    await tab.tap('#burger');
    await tab.waitForTimeout(450);
    assert.ok(await tab.isVisible('#nav'));
    await tab.tap('.header__cta');
    await tab.waitForTimeout(1200);
    assert.equal(await tab.getAttribute('#burger', 'aria-expanded'), 'false');
    assert.ok(!(await tab.isVisible('#nav')));
    const top = await tab.evaluate(() => Math.round(document.querySelector('#cal-panel').getBoundingClientRect().top));
    await close();
    assert.ok(top >= 0 && top < 300, `el selector de servicio queda a la vista (top=${top})`);
  });

  it('con el menú abierto la primera entrada queda bajo la cabecera, también con el aviso demo visible', async () => {
    const { tab, close } = await open('index.html', { width: 390, height: 844, consent: REJECTED, touch: true });
    await tab.tap('#burger');
    await tab.waitForTimeout(450);
    const gap = await tab.evaluate(() => Math.round(document.querySelector('.nav__list a').getBoundingClientRect().top - document.querySelector('#header').getBoundingClientRect().bottom));
    await close();
    assert.ok(gap >= 4, `separación entre la cabecera y la primera entrada: ${gap}px`);
  });

  it('la barra móvil oculta no es enfocable ni se lee (visibility: hidden)', async () => {
    const { tab, close } = await open('index.html', { width: 390, height: 844, consent: REJECTED, touch: true });
    const visibility = await tab.$eval('#mobile-bar', (b) => getComputedStyle(b).visibility);
    await close();
    assert.equal(visibility, 'hidden');
  });

  it('retirar el consentimiento descarga Cal.com y el mapa', async () => {
    const { tab, context } = await openWithStubs();
    await tab.click('[data-consent="accept"]');
    await tab.evaluate(() => document.querySelector('#contacto').scrollIntoView());
    await tab.waitForSelector('#map-wrap iframe', { timeout: 6000 });
    await tab.click('#cookie-reopen');
    assert.equal(await tab.getAttribute('[data-consent="config"]', 'aria-expanded'), 'true');
    await tab.uncheck('#consent-third');
    await Promise.all([tab.waitForEvent('load'), tab.click('[data-consent="save"]')]);
    await tab.waitForTimeout(600);
    const state = await tab.evaluate(() => ({ iframes: document.querySelectorAll('#map-wrap iframe, #cal-inline iframe').length, gate: !document.querySelector('#map-gate').hidden }));
    await context.close();
    assert.equal(state.iframes, 0);
    assert.ok(state.gate, 'el recuadro de consentimiento del mapa vuelve a mostrarse');
  });

  it('el orden del DOM en «Visítanos» sigue el orden visual: título y contacto antes que el mapa', async () => {
    const { tab, close } = await open('index.html', { width: 390, height: 844, consent: REJECTED, touch: true });
    const ok = await tab.evaluate(() => {
      const before = (a, b) => !!(document.querySelector(a).compareDocumentPosition(document.querySelector(b)) & Node.DOCUMENT_POSITION_FOLLOWING);
      return before('#contacto-title', '#map-gate h3') && before('.visit__phone', '#map-load');
    });
    await close();
    assert.ok(ok);
  });

  it('el banner de cookies cabe en pantallas bajas (móvil apaisado) incluso con la configuración abierta', async () => {
    const { tab, close } = await open('index.html', { width: 667, height: 375, touch: true });
    await tab.click('[data-consent="config"]');
    const box = await tab.$eval('#cookie-banner', (b) => { const r = b.getBoundingClientRect(); return { top: r.top, bottom: r.bottom, overflow: getComputedStyle(b).overflowY }; });
    await close();
    assert.ok(box.top >= 0 && box.bottom <= 375, JSON.stringify(box));
    assert.equal(box.overflow, 'auto');
  });

  it('todas las reglas :hover están dentro de @media (hover: hover), para que no se queden "pegadas" en táctil', async () => {
    const { tab, close } = await open('index.html', { consent: REJECTED });
    const offenders = await tab.evaluate(() => {
      const bad = [];
      const walk = (rules, guarded) => {
        for (const rule of rules) {
          if (rule.cssRules && rule.conditionText !== undefined) walk(rule.cssRules, guarded || /hover:\s*hover/.test(rule.conditionText));
          else if (rule.selectorText && /:hover/.test(rule.selectorText) && !guarded) bad.push(rule.selectorText);
        }
      };
      for (const sheet of document.styleSheets) { try { walk(sheet.cssRules, false); } catch { /* hoja externa */ } }
      return bad;
    });
    await close();
    assert.deepEqual(offenders, []);
  });
});
