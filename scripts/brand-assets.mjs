#!/usr/bin/env node
/**
 * Regenera los recursos gráficos derivados de la marca a partir de las fuentes de `src/`:
 *   favicon-32.png, apple-touch-icon.png (desde favicon.svg) y og-image.jpg (imagen al compartir en redes).
 * La imagen Open Graph usa la fotografía de portada: al sustituir el placeholder por una foto real,
 * conviene volver a ejecutar este script.
 * Requiere Playwright con Chromium (npx playwright install chromium).
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { chromium } from 'playwright';
import { SRC } from './build.mjs';
import { serve } from './serve.mjs';

const IMG = join(SRC, 'assets/img');
const favicon = readFileSync(join(IMG, 'favicon.svg'), 'utf8').replace('<svg ', '<svg width="100%" height="100%" ');

const server = await serve(SRC, 0);
const base = `http://localhost:${server.address().port}/`;
const browser = await chromium.launch(process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {});

async function icon(size, file) {
  const page = await browser.newPage({ viewport: { width: size, height: size } });
  await page.setContent(`<body style="margin:0;background:#1E1C1A"><div style="width:${size}px;height:${size}px">${favicon}</div></body>`);
  await page.screenshot({ path: join(IMG, file) });
  await page.close();
}
await icon(32, 'favicon-32.png');
await icon(180, 'apple-touch-icon.png');

const page = await browser.newPage({ viewport: { width: 1200, height: 630 } });
// Mismo origen que las fuentes y la fotografía (si no, el navegador las bloquea)
await page.goto(`${base}404.html`);
await page.setContent(`<!DOCTYPE html><html><head><meta charset="utf-8"><base href="${base}"><style>
@font-face{font-family:"Instrument Serif";src:url("assets/fonts/instrument-serif.woff2") format("woff2")}
@font-face{font-family:"Instrument Serif";font-style:italic;src:url("assets/fonts/instrument-serif-italic.woff2") format("woff2")}
@font-face{font-family:"Hanken Grotesk";src:url("assets/fonts/hanken-grotesk.woff2") format("woff2");font-weight:300 600}
*{box-sizing:border-box}
body{margin:0;width:1200px;height:630px;position:relative;overflow:hidden;background:#F5F1E9;color:#1E1C1A;font-family:"Hanken Grotesk",sans-serif}
.brand{position:absolute;left:72px;top:60px;display:flex;align-items:baseline;gap:14px}
.brand b{font:400 40px/1 "Instrument Serif",serif;letter-spacing:-.01em}
.brand i{font:500 12px/1 "Hanken Grotesk";font-style:normal;letter-spacing:.2em;text-transform:uppercase;color:#4A4640}
h1{position:absolute;left:72px;top:176px;width:660px;margin:0;font:400 88px/.95 "Instrument Serif",serif;letter-spacing:-.022em}
h1 em{letter-spacing:-.012em;white-space:nowrap}
p{position:absolute;left:72px;bottom:60px;margin:0;font:400 24px/1.3 "Hanken Grotesk";color:#4A4640}
img{position:absolute;right:0;top:0;width:440px;height:630px;object-fit:cover}
</style></head><body>
<div class="brand"><b>Azahar</b><i>Nail Studio</i></div>
<h1>Uñas y limpieza facial en <em>Triana, Sevilla</em></h1>
<p>Reserva tu cita online</p>
<img src="assets/img/photos/portada.webp" alt=""></body></html>`);
await page.evaluate(() => document.fonts.ready);
await page.waitForFunction(() => Array.from(document.images).every((i) => i.complete));
await page.waitForTimeout(600);
await page.screenshot({ path: join(IMG, 'og-image.jpg'), type: 'jpeg', quality: 86 });

await browser.close();
server.close();
console.log('Recursos de marca regenerados en src/assets/img/');
