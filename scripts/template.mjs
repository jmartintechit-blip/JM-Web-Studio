/**
 * Motor de plantillas mínimo (sin dependencias) para las páginas de `src/`.
 *
 *   {{ruta.a.dato}}            valor escapado para HTML (null → vacío; si no existe, error con archivo y línea)
 *   {{{ruta.a.html}}}          valor sin escapar (solo para HTML que genera el propio build)
 *   {{#if ruta}} … {{else}} … {{/if}}      condicional ({{#unless ruta}} lo invierte). Una lista vacía cuenta como falso.
 *   {{#each lista}} … {{/each}}            repite; dentro, los campos del elemento se leen directamente,
 *                                          {{this}} es el elemento y {{@index}}, {{@first}} y {{@last}} lo posicionan.
 *   {{> nombre}}               inserta el parcial `src/_partials/nombre.html` con los mismos datos
 *   {{! comentario }}          se elimina
 *
 * Las etiquetas de bloque que ocupan una línea entera no dejan líneas en blanco en el resultado.
 */

const TAG = /\{\{\{([\s\S]+?)\}\}\}|\{\{([\s\S]+?)\}\}/g;

export function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
}

function lineOf(source, index) {
  let line = 1;
  for (let i = 0; i < index; i++) if (source.charCodeAt(i) === 10) line++;
  return line;
}

function parse(source, file) {
  const root = [];
  const stack = [{ node: null, list: root }];
  let pos = 0;
  const fail = (index, message) => { throw new Error(`${file}:${lineOf(source, index)}: ${message}`); };
  const top = () => stack[stack.length - 1];

  for (const match of source.matchAll(TAG)) {
    const raw = match[1] !== undefined;
    const body = (raw ? match[1] : match[2]).trim();
    const start = match.index;
    let end = start + match[0].length;
    let before = source.slice(pos, start);
    const isBlock = !raw && /^(#|\/|!|>|else$)/.test(body);

    if (isBlock) {
      // Etiqueta sola en su línea: se elimina la línea entera
      const lineStart = source.lastIndexOf('\n', start - 1) + 1;
      const trailing = /^[ \t]*\r?\n/.exec(source.slice(end));
      if (trailing && /^[ \t]*$/.test(source.slice(lineStart, start)) && lineStart >= pos) {
        before = source.slice(pos, lineStart);
        end += trailing[0].length;
      }
    }
    if (before) top().list.push({ type: 'text', value: before });
    pos = end;

    if (!raw && body.startsWith('!')) continue;
    if (!raw && body.startsWith('>')) {
      const name = body.slice(1).trim();
      if (!/^[\w-]+$/.test(name)) fail(start, `parcial no válido «${body}»`);
      top().list.push({ type: 'partial', name, at: start });
      continue;
    }
    if (!isBlock) {
      if (!/^[\w@.]+$/.test(body)) fail(start, `expresión no válida «${body}»`);
      top().list.push({ type: 'var', path: body, raw, at: start });
      continue;
    }
    if (body === 'else') {
      const frame = top();
      if (!frame.node || frame.node.type === 'each' || frame.inElse) fail(start, '«else» fuera de un «if»');
      frame.inElse = true;
      frame.list = frame.node.otherwise;
      continue;
    }
    if (body.startsWith('#')) {
      const m = /^#(if|unless|each)\s+(!?[\w@.]+)$/.exec(body);
      if (!m) fail(start, `bloque no válido «${body}»`);
      const node = { type: m[1], path: m[2], at: start, body: [], otherwise: [] };
      top().list.push(node);
      stack.push({ node, list: node.body });
      continue;
    }
    const close = /^\/(if|unless|each)$/.exec(body);
    if (!close) fail(start, `etiqueta no válida «${body}»`);
    const frame = top();
    if (!frame.node || frame.node.type !== close[1]) fail(start, `«/${close[1]}» no coincide con el bloque abierto`);
    stack.pop();
  }
  const rest = source.slice(pos);
  if (rest) top().list.push({ type: 'text', value: rest });
  if (stack.length > 1) fail(stack[stack.length - 1].node.at, `bloque «${stack[stack.length - 1].node.type}» sin cerrar`);
  return root;
}

function lookup(scopes, path, ctx) {
  const parts = path.split('.');
  const head = parts.shift();
  let value;
  let found = false;
  for (let i = scopes.length - 1; i >= 0 && !found; i--) {
    const scope = scopes[i];
    if (head === 'this') { if (scope.hasThis) { value = scope.value; found = true; } continue; }
    if (head.startsWith('@')) { if (scope.loop) { value = scope.loop[head.slice(1)]; found = value !== undefined; } continue; }
    if (scope.value !== null && typeof scope.value === 'object' && head in scope.value) { value = scope.value[head]; found = true; }
  }
  if (!found) return { ok: false };
  for (const part of parts) {
    if (value === null || value === undefined || typeof value !== 'object' || !(part in value)) return { ok: false };
    value = value[part];
  }
  return { ok: true, value };
}

const truthy = (v) => (Array.isArray(v) ? v.length > 0 : Boolean(v));

function run(nodes, scopes, ctx) {
  let out = '';
  for (const node of nodes) {
    if (node.type === 'text') { out += node.value; continue; }
    if (node.type === 'partial') {
      const source = ctx.partials[node.name];
      if (source === undefined) throw new Error(`${ctx.file}:${lineOf(ctx.source, node.at)}: no existe el parcial «${node.name}» (src/_partials/${node.name}.html)`);
      const sub = { ...ctx, file: `src/_partials/${node.name}.html`, source };
      out += run(parse(source, sub.file), scopes, sub);
      continue;
    }
    if (node.type === 'var') {
      const r = lookup(scopes, node.path, ctx);
      if (!r.ok) throw new Error(`${ctx.file}:${lineOf(ctx.source, node.at)}: «${node.path}» no está definido en la configuración`);
      const v = r.value;
      if (v === null || v === undefined) continue;
      if (typeof v === 'object') throw new Error(`${ctx.file}:${lineOf(ctx.source, node.at)}: «${node.path}» es un objeto, no un texto`);
      out += node.raw ? String(v) : escapeHtml(v);
      continue;
    }
    const negate = node.path.startsWith('!');
    const path = negate ? node.path.slice(1) : node.path;
    const r = lookup(scopes, path, ctx);
    if (!r.ok && node.type !== 'each') throw new Error(`${ctx.file}:${lineOf(ctx.source, node.at)}: «${path}» no está definido en la configuración`);
    if (node.type === 'each') {
      if (!r.ok || !Array.isArray(r.value)) throw new Error(`${ctx.file}:${lineOf(ctx.source, node.at)}: «${path}» no es una lista`);
      r.value.forEach((item, index, list) => {
        out += run(node.body, scopes.concat({ value: item, hasThis: true, loop: { index, first: index === 0, last: index === list.length - 1 } }), ctx);
      });
      continue;
    }
    let ok = truthy(r.value);
    if (negate) ok = !ok;
    if (node.type === 'unless') ok = !ok;
    out += run(ok ? node.body : node.otherwise, scopes, ctx);
  }
  return out;
}

/** Renderiza `source` con `data`. `file` solo sirve para los mensajes de error. */
export function render(source, data, file = 'plantilla', partials = {}) {
  const tree = parse(source, file);
  return run(tree, [{ value: data }], { file, source, partials });
}
