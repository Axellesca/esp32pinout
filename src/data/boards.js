/**
 * Board definitions. Data only: header order, silkscreen conventions, cosmetic skin
 * and disclosure notes. Nothing here imports Three.js.
 *
 * HEADER ORDER IS LOCKED. Two independent sources (the DOIT DevKit V1 silkscreen and the
 * ESP32-DevKitC reference footprint) agree character for character on the perimeter
 * sequence. Count check: 25 GPIO + 3V3 + EN + VIN + 2 x GND = 30.
 *
 * The mapping of these two columns onto specific physical edges of the PCB could not be
 * machine-verified against a board photograph, so the rotation is a rendering choice and is
 * disclosed in the UI and the README.
 */

import { GPIOS, getGpio, stateOf } from './gpio.js';

const G = (gpio) => ({ type: 'gpio', gpio });
const RAIL = (id) => ({ type: 'rail', id });

/** Left header column, top to bottom. 15 positions. */
export const HEADER_LEFT = [
  RAIL('EN'),
  G(36),
  G(39),
  G(34),
  G(35),
  G(32),
  G(33),
  G(25),
  G(26),
  G(27),
  G(14),
  G(12),
  G(13),
  RAIL('GND'),
  RAIL('VIN')
];

/** Right header column, top to bottom. 15 positions. */
export const HEADER_RIGHT = [
  G(23),
  G(22),
  G(1),
  G(3),
  G(21),
  G(19),
  G(18),
  G(5),
  G(17),
  G(16),
  G(4),
  G(2),
  G(15),
  RAIL('GND'),
  RAIL('3V3')
];

/** Non-GPIO header positions, described well enough to drive the same UI as a GPIO. */
export const RAILS = {
  EN: {
    id: 'EN',
    name: 'EN (CHIP_PU / reset)',
    direction: 'input',
    kind: 'control',
    description:
      'Reset activo a nivel bajo y habilitación de alimentación del chip. Lo mantiene en HIGH una ' +
      'red RC de la placa para que el chip arranque. El botón EN lo lleva a LOW, lo que reinicia el ESP32.',
    restrictions: [
      {
        severity: 'warning',
        title: 'Pulsar EN reinicia el chip',
        detail:
          'Mantener EN en LOW durante más de un segundo aproximadamente reinicia el módulo. ' +
          'Soltarlo reinicia el chip. Este es el botón normal de "reset".'
      },
      {
        severity: 'info',
        title: 'Es una entrada lógica de 3.3 V',
        detail:
          'El ESP32 no es tolerante a 5 V. No excedas VDD + 0.3 V = 3.9 V en este pin.'
      }
    ],
    notes: ['Conectado al circuito de auto-reset DTR/RTS del CP2102 a través de dos transistores S8050.'],
    sources: ['ESP32-DevKitC V4 User Guide and schematic (Espressif)', 'DOIT DevKit V1 schematic']
  },
  VIN: {
    id: 'VIN',
    name: 'VIN / 5V',
    direction: 'power',
    kind: 'input',
    description:
      'Entrada de 5 V del conector micro-USB, enrutada a través del diodo Schottky SS14. La placa ' +
      'funciona enteramente a 3.3 V; este pin es una entrada, no una salida regulada de 5 V.',
    restrictions: [
      {
        severity: 'critical',
        title: 'Entrada de 5 V, lógica de 3.3 V',
        detail:
          'Alimentar VIN alimenta el AMS1117-3.3. El raíl resultante es de 3.3 V y los pines GPIO ' +
          'NO toleran 5 V: la entrada absoluta máxima es 3.9 V.'
      },
      {
        severity: 'info',
        title: 'No es una salida lógica de 5 V',
        detail:
          'Algunos shields de terceros asumen que VIN puede entregar 5 V. En esta placa no puede: ' +
          'solo es una entrada de 5 V procedente del USB.'
      }
    ],
    notes: ['Normalmente limitado a unos 500 mA a través del regulador y del conector USB.'],
    sources: ['DOIT ESP32 DEVKIT V1 schematic']
  },
  '3V3': {
    id: '3V3',
    name: '3V3',
    direction: 'power',
    kind: 'output',
    description:
      'Raíl regulado de 3.3 V producido por el LDO de la placa (AMS1117-3.3, o ME6211/HT7333 en ' +
      'clones más nuevos). Es la alimentación del WROOM-32 y el nivel lógico de todos los GPIO.',
    restrictions: [
      {
        severity: 'warning',
        title: 'No alimentes 3V3 y el USB a la vez',
        detail:
          'Realimentar 3V3 con el USB conectado puede pelearse con el LDO. Alimenta la placa desde ' +
          'una sola fuente.'
      },
      {
        severity: 'info',
        title: 'El regulador es el cuello de botella de corriente',
        detail:
          'El AMS1117 puede entregar unos 800 mA. El límite de 1100 mA de IO declarado es una ' +
          'cifra a nivel de chip, no lo que esta placa puede suministrar.'
      }
    ],
    notes: [],
    sources: ['DOIT ESP32 DEVKIT V1 schematic']
  },
  GND: {
    id: 'GND',
    name: 'GND',
    direction: 'power',
    kind: 'ground',
    description: 'Masa. Cada columna del header tiene su propia posición GND: dos en total.',
    restrictions: [],
    notes: [
      'Puedes usar cualquiera de los dos pads de GND; son la misma red. Hay un tercer pad de ' +
        'masa bajo la zona de keep-out de la antena del WROOM-32.'
    ],
    sources: ['DOIT ESP32 DEVKIT V1 schematic']
  }
};

export const RAIL_COLORS = {
  EN: 0x6f7d8c,
  VIN: 0xd94f4f,
  '3V3': 0x4f9ad9,
  GND: 0x2a2f36
};

/**
 * Boards. Adding a board must be pure data: the renderer, filters and panels read these
 * fields and nothing else.
 */
export const BOARDS = [
  {
    id: 'devkitv1',
    name: 'ESP32 DevKit V1',
    shortName: 'DevKit V1',
    subtitle: 'DOIT ESP32 DEVKIT V1 - ESP-WROOM-32',    pcb: {
      width: 51.6,
      depth: 28.4,
      thickness: 1.6,
      // The DOIT DevKit V1 is blue on genuine parts. It must not be green: green is the
      // load-bearing state colour for "safe pin" in the legend, and a green board turns the
      // whole object into a safety signal. This blue is deep and desaturated so it cannot be
      // mistaken for the bright #0072b2 that marks input-only pins.
      color: 0x0f2c56,
      edgeColor: 0x0b2142,
      roughness: 0.72
    },
    silk: {
      color: '#eef4f8',
      styles: [
        { id: 'doit', label: 'DOIT original (VP, VN, A4..A7, A8, A9)' },
        { id: 'clone', label: 'Clone habitual (D25, D32..D36, D39)' }
      ],
      defaultStyle: 'doit'
    },
    module: { name: 'ESP-WROOM-32', width: 18.0, length: 25.5, height: 3.1 },
    usbUart: {
      label: 'CP2102',
      variants: [
        'CP2102 (DOIT original)',
        'CH340C (muy común en clones)',
        'CH9102F (clones más nuevos)',
        'FT232RL (clones poco comunes)'
      ]
    },
    regulator: {
      label: 'AMS1117-3.3',
      variants: ['AMS1117-3.3 (original)', 'ME6211C33 (clones más nuevos)', 'HT7333 (clones más nuevos)']
    },
    leds: { power: 0xff2f2f, gpio2: 0x3d7bff },
    notes: [
      'La placa de referencia de 30 pines para ESP32. La serigrafía de DOIT etiqueta GPIO32-36 y ' +
        'GPIO39 como A4, A5, A6, A7, VP, VN, y GPIO25/GPIO26 como A8 y A9.',
      'Las etiquetas A8 / A9 de la serigrafía para GPIO25 / GPIO26 NO coinciden con los alias de ' +
        'arduino-esp32, que son A18 y A19. Las etiquetas A4..A7 para GPIO32..35 sí coinciden.',
      'Un conflicto documental de larga data: las fuentes del tamaño del PCB no coinciden ' +
        '(51.45 x 28.33, 51.8 x 28.2, 53.3 x 25.0 mm). El modelo usa 51.6 x 28.4 mm, la mediana ' +
        'de las fuentes.',
      'Las únicas diferencias de serigrafía entre placas auténticas y clones son el chip USB-UART ' +
        'y el tipo de regulador. No se afirma ninguna diferencia eléctrica más allá de eso.'
    ]
  },
  {
    id: 'esp32s',
    name: 'ESP-32S / NodeMCU-32S',
    shortName: 'ESP-32S',
    subtitle: 'Nombre de mercado para un equivalente del DOIT DevKit V1 - ESP-WROOM-32',
    pcb: {
      width: 51.6,
      depth: 28.4,
      thickness: 1.6,
      // Dark near-black indigo for the ESP-32S skin, kept clearly apart from the DevKit V1
      // blue above and from every pin-state colour.
      color: 0x141c2e,
      edgeColor: 0x0f1626,
      roughness: 0.66
    },
    silk: {
      color: '#f2f6fb',
      styles: [
        { id: 'clone', label: 'Convención NodeMCU-32S (D13, D25, D32..D39)' },
        { id: 'doit', label: 'DOIT original (VP, VN, A4..A7, A8, A9)' }
      ],
      defaultStyle: 'clone'
    },
    module: { name: 'ESP-WROOM-32', width: 18.0, length: 25.5, height: 3.1 },
    usbUart: {
      label: 'CH340G',
      variants: ['CH340G (el más común)', 'CH340C', 'CP2102', 'CH9102F']
    },
    regulator: {
      label: 'AMS1117-3.3',
      variants: ['AMS1117-3.3', 'ME6211C33 (placas más nuevas)', 'HT7333 (placas más nuevas)']
    },
    leds: { power: 0xff2f2f, gpio2: 0x3d7bff },
    notes: [
      '"ESP-32S" NO es un nombre de placa de Espressif y no tiene documentación autorizada. Es un ' +
        'nombre de mercado para placas funcionalmente idénticas al DOIT DevKit V1: mismo módulo ' +
        'ESP-WROOM-32, mismo header de 30 pines, mismo comportamiento eléctrico.',
      'Esta entrada es una skin cosmética sobre el conjunto de datos de pines compartido. No se ' +
        'afirma ni se inventa ninguna diferencia eléctrica respecto al DevKit V1.',
      'Las variaciones documentadas entre clones son el chip USB-UART y el tipo de regulador, más ' +
        'la corriente en deep sleep, que depende sobre todo de la corriente en reposo del AMS1117, ' +
        'del puente USB-UART alimentado permanentemente y del LED de alimentación.'
    ]
  }
];

export const BOARD_BY_ID = Object.fromEntries(BOARDS.map((b) => [b.id, b]));

/**
 * Silkscreen text for a header position in a given silkscreen convention.
 * The `doit` style reproduces the original DOIT printing, including the A8 / A9 labels that
 * disagree with the Arduino aliases.
 */
const DOIT_SPECIAL = {
  1: 'TX0',
  3: 'RX0',
  16: 'RX2',
  17: 'TX2',
  36: 'VP',
  39: 'VN',
  32: 'A4',
  33: 'A5',
  34: 'A6',
  35: 'A7',
  25: 'A8',
  26: 'A9'
};

export function silkFor(entry, style) {
  if (entry.type === 'rail') return entry.id;
  if (style === 'doit' && DOIT_SPECIAL[entry.gpio]) return DOIT_SPECIAL[entry.gpio];
  return `D${entry.gpio}`;
}

/**
 * Resolve one header position into a uniform record. GPIO positions get the full pin
 * dataset; rails get a synthetic record with the same shape, so filters, labels, search
 * and the info panel can treat all 30 positions identically.
 */
export function resolveEntry(entry, boardId) {
  if (entry.type === 'rail') {
    const rail = RAILS[entry.id];
    return {
      kind: 'rail',
      id: `rail-${entry.id.toLowerCase()}`,
      railId: entry.id,
      gpio: null,
      title: entry.id,
      data: rail,
      state: 'rail',
      exposed: true,
      silks: { doit: entry.id, clone: entry.id },
      tokens: [entry.id, rail.name, 'power', 'rail'],
      caps: ['rail']
    };
  }

  const pin = getGpio(entry.gpio);
  const exposed = isExposedOnBoard(entry.gpio, boardId);
  return {
    kind: 'gpio',
    id: `gpio-${entry.gpio}`,
    railId: null,
    gpio: entry.gpio,
    title: `GPIO${entry.gpio}`,
    data: pin,
    state: stateOf(pin),
    exposed,
    silks: { doit: silkFor(entry, 'doit'), clone: silkFor(entry, 'clone') },
    tokens: tokensFor(entry.gpio, pin),
    caps: null // filled by buildBoardRecords so capabilities stay derived from data
  };
}

export function tokensFor(gpio, pin) {
  const t = [
    `gpio${gpio}`,
    `io${gpio}`,
    `d${gpio}`,
    `g${gpio}`,
    `pin${gpio}`,
    `${gpio}`,
    `GPIO ${gpio}`
  ];
  if (pin.arduino) t.push(pin.arduino.toLowerCase());
  if (pin.touchAlias) t.push(pin.touchAlias.toLowerCase());
  if (pin.dac) t.push(`dac${pin.dac}`, 'dac', 'analog out');
  if (pin.adc) t.push(pin.adc.unit.toLowerCase(), `ch${pin.adc.channel}`, 'adc', 'analog in');
  if (pin.touch !== null && pin.touch !== undefined) t.push('touch', 'capacitive');
  for (const role of pin.roles.uart) t.push(role.toLowerCase());
  for (const role of pin.roles.spi) t.push(role.toLowerCase());
  for (const role of pin.roles.jtag) t.push('jtag');
  if (pin.strapping) t.push('strapping', 'strap', 'boot');
  if (pin.direction === 'input-only') t.push('input', 'input only', 'read only');
  if (pin.flags.flash) t.push('flash', 'unusable', 'sdio');
  if (!exposedInEitherBoard(gpio)) t.push('not exposed', 'hidden');
  return t;
}

function exposedInEitherBoard(gpio) {
  const inHeader = HEADER_LEFT.concat(HEADER_RIGHT).some(
    (e) => e.type === 'gpio' && e.gpio === gpio
  );
  return inHeader;
}

export function isExposedOnBoard(gpio, boardId) {
  // Both modelled boards share the identical 30-pin layout, so exposure is board
  // independent. The signature keeps the data layer ready for a future divergent board.
  void boardId;
  return exposedInEitherBoard(gpio);
}

/**
 * The full 30-position header for a board, in physical reading order (left column top to
 * bottom, then right column top to bottom).
 *
 * `id` is the logical identity of a record (GND appears twice, so both GND pads share the
 * id `rail-gnd` and selecting either shows the same information). `key` is the unique
 * identity of a physical position and is what the renderer, the label map and the DOM use.
 */
export function buildBoardRecords(boardId) {
  const records = [];
  const push = (side) => (entry, index) => {
    const rec = resolveEntry(entry, boardId);
    rec.side = side;
    rec.index = index;
    rec.key = `${side}-${String(index).padStart(2, '0')}`;
    records.push(rec);
  };
  HEADER_LEFT.forEach(push('left'));
  HEADER_RIGHT.forEach(push('right'));
  return records;
}

/**
 * Dataset integrity check. Returns a list of problems; an empty list means the header
 * arrays and the dataset agree. Called in dev only so production logs stay clean.
 */
export function validateDataset() {
  const problems = [];
  if (HEADER_LEFT.length !== 15) problems.push(`HEADER_LEFT has ${HEADER_LEFT.length} entries, expected 15`);
  if (HEADER_RIGHT.length !== 15) problems.push(`HEADER_RIGHT has ${HEADER_RIGHT.length} entries, expected 15`);

  const all = HEADER_LEFT.concat(HEADER_RIGHT);
  const gpioEntries = all.filter((e) => e.type === 'gpio');
  const rails = all.filter((e) => e.type === 'rail').map((e) => e.id);
  if (gpioEntries.length !== 25) problems.push(`expected 25 GPIO positions, found ${gpioEntries.length}`);

  const gnd = rails.filter((r) => r === 'GND').length;
  if (gnd !== 2) problems.push(`expected 2 GND positions, found ${gnd}`);
  for (const required of ['EN', 'VIN', '3V3']) {
    if (!rails.includes(required)) problems.push(`missing ${required} header position`);
  }

  const seen = new Set();
  for (const e of gpioEntries) {
    if (seen.has(e.gpio)) problems.push(`GPIO${e.gpio} appears twice on the header`);
    seen.add(e.gpio);
    if (!GPIOS[e.gpio]) problems.push(`GPIO${e.gpio} is on the header but missing from the dataset`);
  }
  if (all.length !== 30) problems.push(`header has ${all.length} positions, expected 30`);

  return problems;
}
