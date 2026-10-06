#!/usr/bin/env node
/**
 * Build estático sin dependencias: copia `src/` a `dist/` y le añade lo que depende del entorno.
 *
 *  - Sustituye %SITE_URL% (canonical, Open Graph, Schema.org) por la URL pública.
 *  - Añade ?v=<hash> a styles.css y main.js, de modo que cada cambio invalida la caché.
 *  - Genera robots.txt y, si el sitio es indexable, sitemap.xml.
 *  - Si INDEXABLE no es "true" (modo demostración), mantiene la etiqueta noindex.
 *
 * Variables (ver .env.example): SITE_URL (o URL, que aporta Netlify) e INDEXABLE.
 */
import { createHash } from 'node:crypto';
import { cpSync, existsSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
export const SRC = join(ROOT, 'src');
export const DIST = join(ROOT, 'dist');

const NOINDEX_TAG = /^[ \t]*<meta name="robots" content="noindex, nofollow">\r?\n/m;

function hashOf(file) {
  return createHash('sha1').update(readFileSync(file)).digest('hex').slice(0, 8);
}

function normalizeSiteUrl(value) {
  if (!value) {
    throw new Error('Falta SITE_URL (por ejemplo https://www.midominio.es). En Netlify la aporta la variable URL.');
  }
  const url = new URL(value); // lanza un error claro si no es una URL válida
  return `${url.origin}${url.pathname}`.replace(/\/+$/, '');
}

export function build({ siteUrl, indexable = false, outDir = DIST, log = () => {} } = {}) {
  const base = normalizeSiteUrl(siteUrl);

  rmSync(outDir, { recursive: true, force: true });
  cpSync(SRC, outDir, { recursive: true });

  const cssHash = hashOf(join(outDir, 'assets/css/styles.css'));
  const jsHash = hashOf(join(outDir, 'assets/js/main.js'));
  const pages = readdirSync(outDir).filter((name) => name.endsWith('.html'));

  for (const name of pages) {
    const file = join(outDir, name);
    let html = readFileSync(file, 'utf8')
      .replaceAll('%SITE_URL%', base)
      .replace('assets/css/styles.css"', `assets/css/styles.css?v=${cssHash}"`)
      .replace('assets/js/main.js"', `assets/js/main.js?v=${jsHash}"`);
    if (indexable) html = html.replace(NOINDEX_TAG, '');
    writeFileSync(file, html);
  }

  if (indexable) {
    const today = new Date().toISOString().slice(0, 10);
    const urls = pages.filter((name) => name !== '404.html').map((name) => (name === 'index.html' ? '/' : `/${name}`)).sort((a, b) => (a === '/' ? -1 : b === '/' ? 1 : a.localeCompare(b)));
    const entries = urls.map((path) => `  <url><loc>${base}${path}</loc><lastmod>${today}</lastmod></url>`).join('\n');
    writeFileSync(join(outDir, 'sitemap.xml'), `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${entries}\n</urlset>\n`);
    writeFileSync(join(outDir, 'robots.txt'), `User-agent: *\nAllow: /\nSitemap: ${base}/sitemap.xml\n`);
  } else {
    writeFileSync(join(outDir, 'robots.txt'), 'User-agent: *\nDisallow: /\n');
  }

  for (const name of pages) {
    if (readFileSync(join(outDir, name), 'utf8').includes('%SITE_URL%')) {
      throw new Error(`Quedó un %SITE_URL% sin sustituir en ${name}`);
    }
  }

  log(`${outDir === DIST ? 'dist/' : outDir} listo · ${pages.length} páginas · SITE_URL=${base} · ${indexable ? 'indexable (sitemap.xml generado)' : 'demo: noindex + robots Disallow'}`);
  return { base, pages, indexable };
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  if (existsSync(join(ROOT, '.env'))) process.loadEnvFile(join(ROOT, '.env'));
  try {
    build({
      siteUrl: process.env.SITE_URL || process.env.URL,
      indexable: process.env.INDEXABLE === 'true',
      log: console.log,
    });
  } catch (error) {
    console.error(`Error de build: ${error.message}`);
    process.exit(1);
  }
}
