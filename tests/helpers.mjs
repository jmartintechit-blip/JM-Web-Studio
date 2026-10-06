import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { chromium } from 'playwright';
import { build } from '../scripts/build.mjs';
import { loadConfig } from '../scripts/config.mjs';
import { serve } from '../scripts/serve.mjs';

/** Configuración real de la web (site.config.mjs): única fuente de verdad de los datos del negocio. */
export const config = await loadConfig();

const duration = (min) => (min >= 60 ? `${Math.floor(min / 60)} h${min % 60 ? ` ${min % 60} min` : ''}` : `${min} min`);   // cálculo independiente del build
const firstOpen = config.horario.find((h) => !h.cerrado);
/** Datos del negocio con la forma que usan los tests, leídos de la configuración. */
export const business = {
  name: config.negocio.nombre,
  locality: config.negocio.zona,
  phone: config.contacto.telefono,
  phoneDisplay: config.contacto.telefono.replace(/^\+34(\d{3})(\d{2})(\d{2})(\d{2})$/, '+34 $1 $2 $3 $4'),
  whatsapp: config.contacto.whatsapp,
  cal: { user: config.reservas.cal.usuario, origin: config.reservas.cal.origen, base: config.reservas.cal.base },
  hours: { label: firstOpen.etiqueta, open: firstOpen.abre.replace(/^0/, ''), close: firstOpen.cierra.replace(/^0/, '') },
  services: config.reservas.servicios.map((s) => ({ name: s.nombre, slug: s.slug, duration: duration(s.minutos), minutes: s.minutos, price: s.precio })),
};
export const PAGES = ['index.html', 'aviso-legal.html', 'politica-privacidad.html', 'politica-cookies.html', '404.html'];
/** Móvil pequeño, móvil grande, tablet, portátil y escritorio grande. */
export const VIEWPORTS = [[360, 740], [390, 844], [768, 1024], [1280, 800], [1920, 1080]];
export const SITE_URL = 'https://azahar.test';
export const CONSENT_KEY = 'azahar-consent-v1';

/** Compila a un directorio temporal y lo sirve en un puerto libre. */
export async function startSite({ modoDemo = true, overrides = {} } = {}) {
  const outDir = mkdtempSync(join(tmpdir(), 'azahar-dist-'));
  const cfg = { ...config, ...overrides, modoDemo, sitio: { ...config.sitio, url: modoDemo ? '' : SITE_URL } };
  await build({ config: cfg, siteUrl: SITE_URL, outDir });
  const server = await serve(outDir, 0);
  return {
    outDir,
    base: `http://localhost:${server.address().port}`,
    async stop() { server.close(); rmSync(outDir, { recursive: true, force: true }); },
  };
}

export const launch = () => chromium.launch(process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {});

/** Contexto con el consentimiento ya decidido (para que el banner no estorbe) o vacío. */
export async function newContext(browser, { width = 1280, height = 800, consent, touch = false } = {}) {
  const context = await browser.newContext({ viewport: { width, height }, ...(touch ? { hasTouch: true, isMobile: true } : {}) });
  if (consent) {
    await context.addInitScript(([key, value]) => { try { localStorage.setItem(key, JSON.stringify(value)); } catch { /* sin almacenamiento */ } }, [CONSENT_KEY, consent]);
  }
  return context;
}

/** Recoge consola, fallos de red y peticiones a terceros de una página. */
export function track(page, base) {
  const log = { console: [], failed: [], bad: [], external: [] };
  page.on('console', (m) => { if (['error', 'warning'].includes(m.type())) log.console.push(`${m.type()}: ${m.text()}`); });
  page.on('pageerror', (e) => log.console.push(`pageerror: ${e.message}`));
  page.on('requestfailed', (r) => log.failed.push(`${r.url()} ${(r.failure() || {}).errorText}`));
  page.on('response', (r) => { if (r.status() >= 400) log.bad.push(`${r.status()} ${r.url()}`); });
  page.on('request', (r) => { if (!r.url().startsWith(base)) log.external.push(r.url()); });
  return log;
}

/** Sin salida a internet en los tests: cualquier petición externa se corta (y queda registrada por track). */
export const blockExternal = (page, base) => page.route((url) => !url.href.startsWith(base), (route) => route.abort());

/**
 * Sustituto local de https://app.cal.com/embed/embed.js. Ejecuta la cola de llamadas que deja el
 * snippet oficial y crea un iframe con el calLink recibido, para verificar la integración sin red.
 * No prueba el calendario real de Cal.com.
 */
export const CAL_STUB = `(function () {
  var C = window.Cal; window.__calCalls = [];
  function run(ns, a) {
    if (a[0] === 'inline') {
      var cfg = a[1]; var el = document.querySelector(cfg.elementOrSelector);
      var f = document.createElement('iframe'); f.setAttribute('data-cal-link', cfg.calLink); f.title = 'stub'; f.style.cssText = 'width:100%;height:600px;border:0';
      el.appendChild(f); window.__calCalls.push(['inline', ns, cfg.calLink]);
    } else if (a[0] === 'ui') { window.__calCalls.push(['ui', ns, a[1]]); }
  }
  Object.keys(C.ns).forEach(function (k) {
    var q = C.ns[k].q || [];
    C.ns[k] = function () { run(k, Array.prototype.slice.call(arguments)); };
    q.forEach(function (a) { var args = Array.prototype.slice.call(a); if (args[0] !== 'init') run(k, args); });
  });
})();`;

export const slugLink = (slug) => `${business.cal.user}/${slug}`;
