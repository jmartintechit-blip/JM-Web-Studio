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
import { serve } from './serve.mjs';

const OUT = new URL('../docs/screenshots/', import.meta.url).pathname;
const dist = mkdtempSync(join(tmpdir(), 'azahar-shots-'));
build({ siteUrl: 'https://example.com', outDir: dist });
const server = await serve(dist, 0);
const base = `http://localhost:${server.address().port}/`;
mkdirSync(OUT, { recursive: true });

const browser = await chromium.launch(process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {});

async function capture(file, { width, height, mobile = false, scrollTo, fullPage = false }) {
  const context = await browser.newContext({ viewport: { width, height }, deviceScaleFactor: 1, ...(mobile ? { hasTouch: true, isMobile: true } : {}) });
  // Sin banner de cookies tapando el diseño y sin salida a internet: la captura es determinista.
  await context.addInitScript(() => localStorage.setItem('azahar-consent-v1', JSON.stringify({ cal: false, maps: false })));
  const page = await context.newPage();
  await page.route((url) => !url.href.startsWith(base), (route) => route.abort());
  await page.goto(base);
  await page.waitForTimeout(600);
  await page.evaluate(() => document.querySelectorAll('.reveal').forEach((el) => el.classList.add('is-in')));
  if (scrollTo) await page.evaluate((selector) => document.querySelector(selector).scrollIntoView(), scrollTo);
  await page.waitForTimeout(1300);
  await page.screenshot({ path: join(OUT, file), fullPage, type: 'jpeg', quality: 86 });
  await context.close();
}

await capture('desktop-hero.jpg', { width: 1440, height: 900 });
await capture('desktop-servicios.jpg', { width: 1440, height: 900, scrollTo: '#servicios .section-head' });
await capture('mobile-hero.jpg', { width: 390, height: 844, mobile: true });
await capture('mobile-pagina-completa.jpg', { width: 390, height: 844, mobile: true, fullPage: true });

await browser.close();
server.close();
rmSync(dist, { recursive: true, force: true });
console.log(`Capturas guardadas en ${OUT}`);
