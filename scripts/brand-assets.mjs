#!/usr/bin/env node
/**
 * Regenera los recursos gráficos derivados de la marca a partir de las fuentes de `src/`:
 *   favicon-32.png, apple-touch-icon.png y og-image.jpg (imagen al compartir en redes).
 * Reutiliza la ilustración del hero de index.html, así que siempre coincide con la web.
 * Requiere Playwright con Chromium (npx playwright install chromium).
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { chromium } from 'playwright';
import { SRC } from './build.mjs';
import { serve } from './serve.mjs';

const IMG = join(SRC, 'assets/img');
const index = readFileSync(join(SRC, 'index.html'), 'utf8');
const art = index.slice(index.indexOf('<svg class="art"'), index.indexOf('</svg>', index.indexOf('<svg class="art"')) + 6);
const favicon = readFileSync(join(IMG, 'favicon.svg'), 'utf8').replace('<svg ', '<svg width="100%" height="100%" ');

const server = await serve(SRC, 0);
const base = `http://localhost:${server.address().port}/`;
const browser = await chromium.launch(process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {});

async function icon(size, file, radius) {
  const page = await browser.newPage({ viewport: { width: size, height: size } });
  await page.setContent(`<body style="margin:0;background:#1B3590"><div style="width:${size}px;height:${size}px;border-radius:${radius}px;overflow:hidden">${favicon}</div></body>`);
  await page.screenshot({ path: join(IMG, file) });
  await page.close();
}
await icon(32, 'favicon-32.png', 0);
await icon(180, 'apple-touch-icon.png', 0);

const page = await browser.newPage({ viewport: { width: 1200, height: 630 } });
// Mismo origen que las fuentes y el sprite (si no, el navegador los bloquea)
await page.goto(`${base}404.html`);
await page.setContent(`<!DOCTYPE html><html><head><meta charset="utf-8"><base href="${base}"><style>
@font-face{font-family:"Young Serif";src:url("assets/fonts/young-serif.woff2") format("woff2")}
@font-face{font-family:"DM Sans";src:url("assets/fonts/dm-sans.woff2") format("woff2");font-weight:400 700}
*{box-sizing:border-box}
body{margin:0;width:1200px;height:630px;position:relative;overflow:hidden;color:#FBF6EA;font-family:"DM Sans",sans-serif;
  background:radial-gradient(800px 500px at 0% 0%,rgba(255,255,255,.12),transparent 60%),radial-gradient(700px 500px at 100% 100%,rgba(8,18,70,.6),transparent 60%),#1B3590}
.pat{position:absolute;inset:0;background:url("assets/img/tile-dark.svg") 0 0/80px 80px;-webkit-mask-image:linear-gradient(90deg,transparent 30%,#000 80%)}
.brand{position:absolute;left:72px;top:64px;display:flex;align-items:center;gap:16px}
.brand svg{width:56px;height:56px;color:#FBF6EA;--petal:#12236B}
.brand b{display:block;font:400 40px/1 "Young Serif",serif}.brand i{display:block;margin-top:6px;font:700 13px/1 "DM Sans";font-style:normal;letter-spacing:.26em;text-transform:uppercase;color:rgba(251,246,234,.8)}
h1{position:absolute;left:72px;top:190px;width:600px;margin:0;font:400 70px/1.04 "Young Serif",serif;letter-spacing:-.012em}
h1 span{color:#F2B63B}
p{position:absolute;left:72px;bottom:64px;margin:0;font:500 26px/1.3 "DM Sans";color:rgba(251,246,234,.9)}
.art{position:absolute;right:66px;top:34px;width:462px;transform:rotate(1.6deg);filter:drop-shadow(0 26px 30px rgba(5,12,52,.5))}
</style></head><body><div class="pat"></div>
<div class="brand"><svg viewBox="-24 -24 48 48"><use href="assets/img/sprite.svg#azahar" x="-24" y="-24" width="48" height="48"/></svg><div><b>Azahar</b><i>Nail Studio</i></div></div>
<h1>Uñas y limpieza facial en <span>Triana</span>, Sevilla</h1>
<p>Reserva tu hora online</p>
<div class="art">${art.replace('class="art"', 'width="462"')}</div></body></html>`);
await page.waitForTimeout(1200);
await page.screenshot({ path: join(IMG, 'og-image.jpg'), type: 'jpeg', quality: 84 });

await browser.close();
server.close();
console.log('Recursos de marca regenerados en src/assets/img/');
