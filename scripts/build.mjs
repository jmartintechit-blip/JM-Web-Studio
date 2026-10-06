#!/usr/bin/env node
/**
 * Build estático sin dependencias: compila las plantillas de `src/` con los datos de `site.config.mjs`
 * y escribe la web lista para publicar en `dist/`.
 *
 *  - Renderiza cada `src/*.html` (plantilla) con la configuración y copia el resto de `src/` (css, js, fuentes, imágenes).
 *  - Añade ?v=<hash> a styles.css y main.js, de modo que cada cambio invalida la caché.
 *  - modoDemo: true  → noindex en todas las páginas, robots.txt con «Disallow: /», sin sitemap ni datos estructurados.
 *  - modoDemo: false → indexable: canonical, sitemap.xml, robots.txt permisivo y datos estructurados del negocio local.
 *
 * La URL pública sale de `sitio.url` (producción) o de SITE_URL / URL (Netlify la aporta sola) en modo demo.
 * Variables opcionales (ver .env.example): SITE_URL, SITE_CONFIG (ruta a otro archivo de configuración).
 */
import { createHash } from 'node:crypto';
import { cpSync, existsSync, mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { buildContext, loadConfig, ROOT, validateConfig } from './config.mjs';
import { render } from './template.mjs';

export { ROOT };
export const SRC = join(ROOT, 'src');
export const DIST = join(ROOT, 'dist');

const hashOf = (file) => createHash('sha1').update(readFileSync(file)).digest('hex').slice(0, 8);

function normalizeSiteUrl(value) {
  if (!value) throw new Error('Falta la URL pública: define sitio.url en site.config.mjs o la variable SITE_URL (Netlify aporta URL).');
  const url = new URL(value); // lanza un error claro si no es una URL válida
  return `${url.origin}${url.pathname}`.replace(/\/+$/, '');
}

/**
 * @param {object} options
 * @param {object} [options.config]    configuración ya cargada (si no, se lee `configPath`)
 * @param {string} [options.configPath] ruta de la configuración (por defecto site.config.mjs)
 * @param {string} [options.siteUrl]   URL pública (solo en modo demo; en producción manda sitio.url)
 * @param {string} [options.outDir]
 * @param {string} [options.srcDir]
 */
export async function build({ config, configPath, siteUrl, outDir = DIST, srcDir = SRC, log = () => {}, warn = () => {} } = {}) {
  const cfg = config || (await loadConfig(configPath));
  const { errors, warnings } = validateConfig(cfg, { srcDir });
  if (errors.length) throw new Error(`Configuración no válida:\n  - ${errors.join('\n  - ')}`);
  warnings.forEach((w) => warn(`Aviso: ${w}`));

  const demo = cfg.modoDemo !== false;
  const base = normalizeSiteUrl(demo ? siteUrl || cfg.sitio?.url : cfg.sitio.url);
  const ctx = buildContext(cfg, { siteUrl: base, srcDir });

  rmSync(outDir, { recursive: true, force: true });
  mkdirSync(outDir, { recursive: true });
  cpSync(srcDir, outDir, { recursive: true, filter: (from) => !from.endsWith('.html') && !from.includes('_partials') });
  const partialsDir = join(srcDir, '_partials');
  const partials = existsSync(partialsDir)
    ? Object.fromEntries(readdirSync(partialsDir).filter((f) => f.endsWith('.html')).map((f) => [f.replace(/\.html$/, ''), readFileSync(join(partialsDir, f), 'utf8')]))
    : {};

  const cssHash = hashOf(join(outDir, 'assets/css/styles.css'));
  const jsHash = hashOf(join(outDir, 'assets/js/main.js'));
  const pages = readdirSync(srcDir).filter((name) => name.endsWith('.html'));

  for (const name of pages) {
    const html = render(readFileSync(join(srcDir, name), 'utf8'), ctx, `src/${name}`, partials)
      .replace('assets/css/styles.css"', `assets/css/styles.css?v=${cssHash}"`)
      .replace('assets/js/main.js"', `assets/js/main.js?v=${jsHash}"`);
    writeFileSync(join(outDir, name), html);
  }

  if (demo) {
    writeFileSync(join(outDir, 'robots.txt'), 'User-agent: *\nDisallow: /\n');
  } else {
    const today = new Date().toISOString().slice(0, 10);
    const urls = pages.filter((name) => name !== '404.html').map((name) => (name === 'index.html' ? '/' : `/${name}`)).sort((a, b) => (a === '/' ? -1 : b === '/' ? 1 : a.localeCompare(b)));
    const entries = urls.map((path) => `  <url><loc>${base}${path}</loc><lastmod>${today}</lastmod></url>`).join('\n');
    writeFileSync(join(outDir, 'sitemap.xml'), `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${entries}\n</urlset>\n`);
    writeFileSync(join(outDir, 'robots.txt'), `User-agent: *\nAllow: /\nSitemap: ${base}/sitemap.xml\n`);
  }

  log(`${outDir === DIST ? 'dist/' : outDir} listo · ${pages.length} páginas · ${base} · ${demo ? 'modoDemo: noindex + robots Disallow, sin sitemap ni schema' : 'producción: indexable, sitemap.xml y schema.org generados'}`);
  return { base, pages, demo, warnings };
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  if (existsSync(join(ROOT, '.env'))) process.loadEnvFile(join(ROOT, '.env'));
  try {
    await build({ siteUrl: process.env.SITE_URL || process.env.URL, log: console.log, warn: console.warn });
  } catch (error) {
    console.error(`Error de build: ${error.message}`);
    process.exit(1);
  }
}
