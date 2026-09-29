/**
 * Colour language for the explorer.
 *
 * The palette is Okabe-Ito based so it stays distinguishable for the common forms of
 * colour vision deficiency. Colour is never the only channel: every state also carries a
 * glyph in the pin label and a plain-English explanation in the info panel.
 */

import { Color } from 'three';

export const STATE_COLORS = {
  /** Fully general purpose. */
  safe: '#009e73',
  /** Sampled at reset: something must hold it at a defined level. */
  strapping: '#e69f00',
  /** No output driver and no internal pull resistors. */
  'input-only': '#0072b2',
  /** Bonded to the module SPI flash. */
  flash: '#6f7a86',
  /** Present in silicon but not bonded out on the WROOM-32 module. */
  'not-bonded': '#4c5560',
  /** Does not exist on this chip. */
  absent: '#2f3740',
  /** Power and control pads, not GPIOs. */
  rail: '#9aa7b4',
  /** ADC2 while the Wi-Fi radio is contending for the shared block. */
  contested: '#d55e00',
  selected: '#ffffff',
  hovered: '#ffe9a8'
};

/** Per-capability accent used in the panel tags and the filter chips. */
export const CAP_COLORS = {
  adc1: '#56b4e9',
  adc2: '#56b4e9',
  dac: '#cc79a7',
  touch: '#f0e442',
  uart: '#009e73',
  spi: '#e69f00',
  i2c: '#56b4e9',
  pwm: '#8ab4f8',
  jtag: '#cc79a7',
  sdio: '#d55e00',
  emac: '#bbbbbb',
  rtc: '#f0e442',
  'clk-out': '#bbbbbb',
  strapping: '#e69f00',
  output: '#009e73',
  'input-only': '#0072b2',
  flash: '#6f7a86',
  recommended: '#009e73',
  'alias-trap': '#d55e00',
  'not-bonded': '#4c5560',
  absent: '#2f3740',
  rail: '#9aa7b4'
};

/** Glyph shown next to a pin label, so state is not communicated by hue alone. */
export const STATE_GLYPHS = {
  safe: '',
  strapping: '!',
  'input-only': 'IN',
  flash: 'X',
  'not-bonded': 'NB',
  absent: '--',
  rail: 'PWR',
  contested: '~'
};

const scratch = new Color();

export function stateColor(state) {
  return new Color(STATE_COLORS[state] ?? STATE_COLORS.safe);
}

/** Blend two hex colours in linear space; returns a THREE.Color. */
export function mixColor(a, b, t) {
  return new Color(a).lerp(new Color(b), t);
}

/** Desaturated, darkened version used when a pin is filtered out. */
export function dimColor(color, amount = 0.82) {
  scratch.copy(color);
  const hsl = { h: 0, s: 0, l: 0 };
  scratch.getHSL(hsl);
  scratch.setHSL(hsl.h, hsl.s * (1 - amount), hsl.l * (1 - amount * 0.62));
  return scratch.clone();
}
