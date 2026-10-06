#!/usr/bin/env node
/** Desarrollo local: compila `src/` + `site.config.mjs` a `dist/`, lo sirve y recompila al guardar cualquiera de los dos. */
import { watch } from 'node:fs';
import { build, DIST, SRC } from './build.mjs';
import { DEFAULT_CONFIG } from './config.mjs';
import { serve } from './serve.mjs';

const port = Number(process.env.PORT || 8765);
const siteUrl = `http://localhost:${port}`;

const rebuild = async () => {
  try { await build({ siteUrl, log: (message) => console.log(`[build] ${message}`), warn: (message) => console.warn(`[build] ${message}`) }); }
  catch (error) { console.error(`[build] ${error.message}`); }
};

await rebuild();
await serve(DIST, port);
console.log(`Servidor en ${siteUrl}  (Ctrl+C para salir)`);

let timer;
const schedule = () => { clearTimeout(timer); timer = setTimeout(rebuild, 150); };
watch(SRC, { recursive: true }, schedule);
watch(process.env.SITE_CONFIG || DEFAULT_CONFIG, schedule);
