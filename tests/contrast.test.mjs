import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { describe, it } from 'node:test';

const css = readFileSync(new URL('../src/assets/css/styles.css', import.meta.url), 'utf8');
const token = (name) => {
  const match = css.match(new RegExp(`--${name}:\\s*(#[0-9A-Fa-f]{6})`));
  assert.ok(match, `token --${name} no encontrado`);
  return match[1];
};
const luminance = (hex) => {
  const [r, g, b] = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255)
    .map((c) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4));
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
};
const ratio = (a, b) => {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
};

/** Parejas texto/fondo que usa realmente el diseño. Mínimo WCAG AA para texto normal: 4,5. */
const PAIRS = [
  ['ink', 'ivory', 'texto principal'],
  ['ink-2', 'ivory', 'texto secundario'],
  ['mute', 'ivory', 'etiquetas y numeración'],
  ['ink', 'sand', 'texto sobre la banda de reserva'],
  ['ink-2', 'sand', 'texto secundario sobre la banda de reserva'],
  ['mute', 'sand', 'etiquetas sobre la banda de reserva'],
  ['ink', 'paper', 'texto en el panel del calendario'],
  ['ink-2', 'paper', 'texto secundario en el panel del calendario'],
  ['ink', 'sand-2', 'texto sobre bloques de fotografía y mapa'],
  ['ink-2', 'sand-2', 'texto secundario sobre el bloque del mapa'],
  ['ivory', 'ink', 'botón principal'],
  ['ivory', 'bronze', 'botón principal al pasar el ratón'],
  ['bronze', 'ivory', 'enlaces al pasar el ratón'],
  ['bronze', 'sand', 'enlaces al pasar el ratón sobre la banda de reserva'],
  ['night-text', 'night', 'texto del pie'],
  ['night-mute', 'night', 'texto secundario del pie'],
  ['bronze-lt', 'night', 'enlaces del pie al pasar el ratón'],
];

describe('contraste de color (WCAG AA)', () => {
  for (const [fg, bg, uso] of PAIRS) {
    it(`${fg} sobre ${bg}: ${uso}`, () => {
      const value = ratio(token(fg), token(bg));
      assert.ok(value >= 4.5, `contraste ${value.toFixed(2)} < 4,5`);
    });
  }

});
