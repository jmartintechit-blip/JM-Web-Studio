import assert from 'node:assert/strict';
import { existsSync, mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { after, describe, it } from 'node:test';
import { build } from '../scripts/build.mjs';
import { PAGES, SITE_URL } from './helpers.mjs';

const dirs = [];
const compile = (options) => {
  const outDir = mkdtempSync(join(tmpdir(), 'azahar-build-'));
  dirs.push(outDir);
  build({ siteUrl: SITE_URL, outDir, ...options });
  return outDir;
};
const read = (dir, file) => readFileSync(join(dir, file), 'utf8');
after(() => dirs.forEach((dir) => rmSync(dir, { recursive: true, force: true })));

describe('build en modo demostración', () => {
  const dir = compile({ indexable: false });

  it('genera todas las páginas y no deja tokens sin sustituir', () => {
    for (const page of PAGES) {
      assert.ok(existsSync(join(dir, page)), `falta ${page}`);
      assert.ok(!read(dir, page).includes('%SITE_URL%'), `%SITE_URL% sin sustituir en ${page}`);
    }
  });

  it('mantiene noindex y bloquea el rastreo', () => {
    for (const page of PAGES) assert.match(read(dir, page), /<meta name="robots" content="noindex, nofollow">/, page);
    assert.equal(read(dir, 'robots.txt'), 'User-agent: *\nDisallow: /\n');
    assert.ok(!existsSync(join(dir, 'sitemap.xml')));
  });

  it('versiona CSS y JS por hash de contenido', () => {
    assert.match(read(dir, 'index.html'), /assets\/css\/styles\.css\?v=[0-9a-f]{8}"/);
    assert.match(read(dir, 'index.html'), /assets\/js\/main\.js\?v=[0-9a-f]{8}"/);
  });

  it('usa URLs absolutas en canonical y Open Graph', () => {
    const html = read(dir, 'index.html');
    assert.ok(html.includes(`<link rel="canonical" href="${SITE_URL}/">`));
    assert.ok(html.includes(`content="${SITE_URL}/assets/img/og-image.jpg"`));
    assert.ok(read(dir, 'aviso-legal.html').includes(`href="${SITE_URL}/aviso-legal.html"`));
  });
});

describe('build indexable', () => {
  const dir = compile({ indexable: true });

  it('quita noindex de las páginas de contenido (la 404 lo conserva), permite el rastreo y genera sitemap.xml', () => {
    for (const page of PAGES) {
      if (page === '404.html') assert.match(read(dir, page), /<meta name="robots" content="noindex, nofollow">/, 'la 404 conserva noindex');
      else assert.ok(!read(dir, page).includes('noindex'), `noindex en ${page}`);
    }
    assert.match(read(dir, 'robots.txt'), /Allow: \/\nSitemap: https:\/\/azahar\.test\/sitemap\.xml/);
    const sitemap = read(dir, 'sitemap.xml');
    assert.ok(sitemap.includes(`<loc>${SITE_URL}/</loc>`));
    assert.ok(!sitemap.includes('404.html'));
  });
});

describe('validación de entrada', () => {
  it('falla con un mensaje claro si falta SITE_URL', () => {
    assert.throws(() => build({ siteUrl: '', outDir: join(tmpdir(), 'azahar-x') }), /SITE_URL/);
  });
});
