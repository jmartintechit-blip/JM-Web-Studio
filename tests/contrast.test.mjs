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
  ['cobalt-deep', 'bone', 'texto principal sobre fondo claro'],
  ['muted', 'bone', 'texto secundario sobre fondo claro'],
  ['muted', 'bone-2', 'texto secundario sobre superficie'],
  ['bone', 'cobalt', 'texto sobre hero y reservas'],
  ['bone', 'cobalt-deep', 'texto sobre pie'],
  ['saffron', 'cobalt', 'etiquetas azafrán sobre cobalto'],
  ['saffron', 'cobalt-deep', 'enlaces azafrán sobre pie'],
  ['cobalt-deep', 'saffron', 'franja de datos'],
  ['cobalt-deep', 'orange', 'botón de reserva'],
  ['bone', 'cobalt-deep', 'botón outline al pasar el ratón'],
  ['bone', 'cobalt', 'botón principal'],
];

describe('contraste de color (WCAG AA)', () => {
  for (const [fg, bg, uso] of PAIRS) {
    it(`${fg} sobre ${bg}: ${uso}`, () => {
      const value = ratio(token(fg), token(bg));
      assert.ok(value >= 4.5, `contraste ${value.toFixed(2)} < 4,5`);
    });
  }

  it('texto blanco sobre el verde de WhatsApp', () => {
    assert.ok(ratio('#FFFFFF', token('whatsapp')) >= 4.5);
  });
});
