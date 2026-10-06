#!/usr/bin/env node
/** Compila la web en modo demo y en modo producción y valida el HTML resultante con html-validate. */
import { spawnSync } from 'node:child_process';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { build, ROOT } from './build.mjs';
import { loadConfig } from './config.mjs';

const cfg = await loadConfig();
const variants = [
  ['modoDemo: true', { ...cfg, modoDemo: true }],
  ['modoDemo: false', { ...cfg, modoDemo: false, sitio: { ...cfg.sitio, url: cfg.sitio?.url || 'https://www.ejemplo.test' } }],
];
let failed = false;
for (const [label, config] of variants) {
  const dir = mkdtempSync(join(tmpdir(), 'web-validate-'));
  try {
    await build({ config, siteUrl: 'https://www.ejemplo.test', outDir: dir });
    const pages = ['index.html', 'aviso-legal.html', 'politica-privacidad.html', 'politica-cookies.html', '404.html'].map((p) => join(dir, p));
    const run = spawnSync('npx', ['html-validate', '--config', join(ROOT, '.htmlvalidate.json'), ...pages], { cwd: ROOT, encoding: 'utf8' });
    process.stdout.write(`\n== ${label} ==\n${run.stdout || ''}${run.stderr || ''}`);
    if (run.status !== 0) failed = true;
    else console.log('HTML válido');
  } finally { rmSync(dir, { recursive: true, force: true }); }
}
process.exit(failed ? 1 : 0);
