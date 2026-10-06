#!/usr/bin/env node
/** Desarrollo local: compila `src/` a `dist/`, lo sirve y recompila al guardar. */
import { watch } from 'node:fs';
import { build, DIST, SRC } from './build.mjs';
import { serve } from './serve.mjs';

const port = Number(process.env.PORT || 8765);
const siteUrl = `http://localhost:${port}`;

const rebuild = () => {
  try { build({ siteUrl, log: (message) => console.log(`[build] ${message}`) }); }
  catch (error) { console.error(`[build] ${error.message}`); }
};

rebuild();
await serve(DIST, port);
console.log(`Servidor en ${siteUrl}  (Ctrl+C para salir)`);

let timer;
watch(SRC, { recursive: true }, () => { clearTimeout(timer); timer = setTimeout(rebuild, 150); });
