/** Servidor estático mínimo para desarrollo y pruebas (sirve `dist/`). */
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { extname, join, normalize, resolve, sep } from 'node:path';

const MIME = {
  '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8', '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json', '.svg': 'image/svg+xml', '.png': 'image/png', '.jpg': 'image/jpeg', '.webp': 'image/webp',
  '.woff2': 'font/woff2', '.xml': 'application/xml', '.txt': 'text/plain; charset=utf-8',
};

export function serve(root, port = 0) {
  const base = resolve(root);
  const server = createServer(async (req, res) => {
    let pathname;
    try { pathname = decodeURIComponent(new URL(req.url, 'http://localhost').pathname); }
    catch { res.writeHead(400, { 'Content-Type': 'text/plain; charset=utf-8' }); return res.end('400'); }
    const target = resolve(join(base, normalize(pathname === '/' ? '/index.html' : pathname)));
    let status = 200;
    let file = target;
    if (!target.startsWith(base + sep) && target !== base) { status = 404; file = join(base, '404.html'); }
    let body;
    try { body = await readFile(file); }
    catch { status = 404; file = join(base, '404.html'); body = await readFile(file).catch(() => Buffer.from('404')); }
    res.writeHead(status, { 'Content-Type': MIME[extname(file)] || 'application/octet-stream', 'Cache-Control': 'no-store' });
    res.end(body);
  });
  return new Promise((done) => server.listen(port, () => done(server)));
}
