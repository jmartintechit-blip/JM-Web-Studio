#!/usr/bin/env node
/**
 * Genera las capturas de docs/screenshots/ a partir de la web real compilada.
 * Requiere Playwright con Chromium (npx playwright install chromium).
 */
import { mkdirSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { chromium } from 'playwright';
import { build } from './build.mjs';
import { loadConfig } from './config.mjs';
import { serve } from './serve.mjs';

const OUT = new URL('../docs/screenshots/', import.meta.url).pathname;
const cfg = await loadConfig();
const dist = mkdtempSync(join(tmpdir(), 'web-shots-'));
const distProd = mkdtempSync(join(tmpdir(), 'web-shots-prod-'));
await build({ config: { ...cfg, modoDemo: true }, siteUrl: 'https://example.com', outDir: dist });
// Variante de producción (modoDemo: false) para enseñar la diferencia: sin barra de demo ni reseñas de ejemplo
await build({ config: { ...cfg, modoDemo: false, sitio: { url: 'https://www.ejemplo-salon.es' } }, outDir: distProd });
const server = await serve(dist, 0);
const serverProd = await serve(distProd, 0);
const base = `http://localhost:${server.address().port}/`;
const baseProd = `http://localhost:${serverProd.address().port}/`;
mkdirSync(OUT, { recursive: true });

const browser = await chromium.launch(process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {});

async function capture(file, { width, height, mobile = false, scrollTo, fullPage = false, origin = base, query = '' }) {
  const context = await browser.newContext({ viewport: { width, height }, deviceScaleFactor: 1, ...(mobile ? { hasTouch: true, isMobile: true } : {}) });
  // Sin banner de cookies tapando el diseño y sin salida a internet: la captura es determinista.
  await context.addInitScript(() => localStorage.setItem('azahar-consent-v1', JSON.stringify({ cal: false, maps: false })));
  const page = await context.newPage();
  await page.route((url) => !url.href.startsWith(origin), (route) => route.abort());
  await page.goto(origin + query);
  await page.waitForTimeout(600);
  if (fullPage) {   // recorre la página para que las fotos en diferido y las entradas animadas estén ya cargadas
    const total = await page.evaluate(() => document.documentElement.scrollHeight);
    for (let y = 0; y < total; y += 500) { await page.evaluate((v) => window.scrollTo(0, v), y); await page.waitForTimeout(100); }
    await page.evaluate(() => window.scrollTo(0, 0));
  }
  await page.evaluate(() => document.querySelectorAll('.reveal').forEach((el) => el.classList.add('is-in')));
  if (scrollTo) await page.evaluate((selector) => document.querySelector(selector).scrollIntoView(), scrollTo);
  await page.waitForTimeout(1300);
  await page.screenshot({ path: join(OUT, file), fullPage, type: 'jpeg', quality: 86 });
  await context.close();
}

await capture('desktop-hero.jpg', { width: 1440, height: 900 });
await capture('desktop-servicios.jpg', { width: 1440, height: 900, scrollTo: '#servicios .section-head' });
await capture('desktop-resenas.jpg', { width: 1440, height: 900, scrollTo: '#resenas' });
await capture('desktop-produccion.jpg', { width: 1440, height: 900, origin: baseProd });
await capture('mobile-hero.jpg', { width: 390, height: 844, mobile: true });
await capture('mobile-hero-para.jpg', { width: 390, height: 844, mobile: true, query: '?para=Beauty%20Lola' });
await capture('mobile-pagina-completa.jpg', { width: 390, height: 844, mobile: true, fullPage: true });

await browser.close();
server.close();
serverProd.close();
rmSync(dist, { recursive: true, force: true });
rmSync(distProd, { recursive: true, force: true });
console.log(`Capturas guardadas en ${OUT}`);
