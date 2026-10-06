#!/usr/bin/env node
/**
 * Regenera los recursos gráficos derivados de la marca a partir de las fuentes de `src/`:
 *   favicon-32.png, apple-touch-icon.png (desde favicon.svg) y og-image.jpg (imagen al compartir en redes).
 * La imagen Open Graph (1200×630, la que se ve al compartir el enlace por WhatsApp o redes) se compone con el nombre,
 * el titular de la portada y la fotografía de portada, todo leído de site.config.mjs: al cambiar el negocio, los textos,
 * los colores o la foto de portada, conviene volver a ejecutar este script (`npm run assets`).
 * Requiere Playwright con Chromium (npx playwright install chromium).
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { chromium } from 'playwright';
import { SRC } from './build.mjs';
import { loadConfig } from './config.mjs';
import { serve } from './serve.mjs';

const cfg = await loadConfig();
const c = cfg.colores;
const esc = (t) => String(t).replace(/[&<>"]/g, (x) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[x]);
const IMG = join(SRC, 'assets/img');
const favicon = readFileSync(join(IMG, 'favicon.svg'), 'utf8').replace('<svg ', '<svg width="100%" height="100%" ');

const server = await serve(SRC, 0);
const base = `http://localhost:${server.address().port}/`;
const browser = await chromium.launch(process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {});

async function icon(size, file) {
  const page = await browser.newPage({ viewport: { width: size, height: size } });
  await page.setContent(`<body style="margin:0;background:${c.tinta}"><div style="width:${size}px;height:${size}px">${favicon}</div></body>`);
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
body{margin:0;width:1200px;height:630px;position:relative;overflow:hidden;background:${c.marfil};color:${c.tinta};font-family:"Hanken Grotesk",sans-serif}
.brand{position:absolute;left:72px;top:60px;display:flex;align-items:baseline;gap:14px}
.brand b{font:400 40px/1 "Instrument Serif",serif;letter-spacing:-.01em}
.brand i{font:500 12px/1 "Hanken Grotesk";font-style:normal;letter-spacing:.2em;text-transform:uppercase;color:${c.tinta2}}
h1{position:absolute;left:72px;top:176px;width:660px;margin:0;font:400 88px/.95 "Instrument Serif",serif;letter-spacing:-.022em}
h1 em{letter-spacing:-.012em;white-space:nowrap}
p{position:absolute;left:72px;bottom:60px;margin:0;font:400 24px/1.3 "Hanken Grotesk";color:${c.tinta2}}
img{position:absolute;right:0;top:0;width:440px;height:630px;object-fit:cover}
</style></head><body>
<div class="brand"><b>${esc(cfg.negocio.marca)}</b><i>${esc(cfg.negocio.submarca)}</i></div>
<h1>${esc(cfg.textos.portada.titulo)} <em>${esc(cfg.textos.portada.destacado)}</em></h1>
<p>${esc(cfg.modoDemo === false ? 'Reserva tu cita online' : cfg.demo.ogTitulo)}</p>
<img src="assets/img/photos/${cfg.fotos.portada.archivo}" alt=""></body></html>`);
await page.evaluate(() => document.fonts.ready);
await page.waitForFunction(() => Array.from(document.images).every((i) => i.complete));
await page.waitForTimeout(600);
await page.screenshot({ path: join(IMG, 'og-image.jpg'), type: 'jpeg', quality: 86 });

await browser.close();
server.close();
console.log('Recursos de marca regenerados en src/assets/img/');
