/**
 * Per-pin information panel. This is the "show everything" surface: capabilities,
 * restrictions and the reasoning behind every restriction, in Spanish with the technical
 * terms kept in English.
 */

import { clear, el, orDash } from './dom.js';
import { STATE_COLORS, STATE_GLYPHS, CAP_COLORS } from '../three/palette.js';
import { ELECTRICAL, GPIO_MATRIX_QUOTE, UNDEFINED_ARDUINO_ALIASES } from '../data/gpio.js';
import {
  ADCCONFLICT_NOTES,
  I2C_NOTES,
  I2S_NOTES,
  MATRIX_QUOTE,
  SERIAL_PORTS,
  SPI_BUSES
} from '../data/peripherals.js';

const STATE_LABEL = {
  safe: 'Seguro',
  strapping: 'Strapping',
  'input-only': 'Solo entrada',
  flash: 'Flash',
  'not-bonded': 'No vinculado',
  absent: 'No existe',
  rail: 'Alimentación / control'
};

const SEVERITY_ORDER = { critical: 0, warning: 1, info: 2 };

function kv(pairs) {
  const list = el('dl', { className: 'kv' });
  for (const [label, value, wrap] of pairs) {
    if (value === null || value === undefined) continue;
    list.append(el('dt', {}, label));
    list.append(el('dd', { className: wrap ? 'wrap' : '' }, value));
  }
  return list;
}

function tags(items, kind = '') {
  return el(
    'div',
    { className: 'tag-row' },
    items.map((t) =>
      el(
        'span',
        {
          className: `tag ${kind}`,
          style: { borderColor: `${t.color ?? CAP_COLORS.rtc}55` }
        },
        t.text ?? t
      )
    )
  );
}

function section(title, body) {
  return el('div', {}, el('h3', {}, title), body);
}

function list(items) {
  return el(
    'ul',
    { className: 'note-list' },
    items.map((i) => el('li', { html: i }))
  );
}

/** Group the named roles by subsystem for a tidy summary. */
function roleGroups(pin) {
  const groupLabels = {
    uart: 'UART',
    spi: 'SPI',
    clkOut: 'Salida de reloj',
    emac: 'Ethernet MAC',
    jtag: 'JTAG',
    sdio: 'SDIO / flash',
    rtc: 'RTC'
  };
  const out = [];
  for (const [group, label] of Object.entries(groupLabels)) {
    const list = pin.roles[group] ?? [];
    if (list.length) out.push({ label, items: list });
  }
  return out;
}

function renderGpio(panel, record, board, ctx) {
  const pin = record.data;
  const silk = record.silks[ctx.silk] ?? record.silks.clone;
  const stateColorHex = STATE_COLORS[record.state] ?? STATE_COLORS.safe;
  const glyph = STATE_GLYPHS[record.state] ?? '';
  const contested = ctx.wifiOn && pin.adc?.unit === 'ADC2';

  panel.append(
    el(
      'div',
      { className: 'pin-head' },
      el('span', { className: 'badge' }, `GPIO${pin.gpio}`),
      el('span', { className: 'silk' }, silk),
      contested ? el('span', { className: 'tag danger' }, 'ADC2 en conflicto con Wi-Fi') : null,
      el(
        'span',
        { className: 'state', style: { color: stateColorHex } },
        `${glyph ? glyph + ' ' : ''}${STATE_LABEL[record.state]}`
      )
    ),
    el(
      'p',
      { className: 'pin-subtitle' },
      pin.flags.notDac
        ? 'Pin general seguro. No es un DAC: el ESP32 tiene exactamente dos canales DAC.'
        : 'Capacidades, restricciones y su fundamento, según las fuentes primarias de Espressif.'
    )
  );

  const dirText = {
    bidirectional: 'Entrada y salida (bidireccional)',
    'input-only': 'Solo entrada: sin driver de salida ni resistencias pull internas',
    'internal-only': 'Solo interno: unido al SPI flash del módulo',
    absent: 'No existe en el ESP32-WROOM-32'
  }[pin.direction];

  panel.append(
    kv([
      ['Serigrafía', `${silk}${ctx.silk === 'doit' ? ' (convención DOIT)' : ''}`],
      ['Alias Arduino', orDash(pin.arduino)],
      ['Alias touch', orDash(pin.touchAlias)],
      ['Dirección', dirText],
      [
        // The datasheet name leads, in English, and the Spanish explanation follows it: the
        // user asked for Spanish explanations with the datasheet literals kept verbatim, and
        // "ADC2 canal 8" is a paraphrase of a name the datasheet actually prints.
        'ADC',
        pin.adc
          ? `${pin.adc.unit}_CH${pin.adc.channel} (${
              pin.adc.unit === 'ADC1' ? 'nunca bloqueado por Wi-Fi' : 'compartido con la radio Wi-Fi'
            })`
          : 'Ninguno: este pin no tiene función ADC'
      ],
      [
        'Touch',
        pin.touch !== null && pin.touch !== undefined
          ? `T${pin.touch} (canal touch capacitivo)`
          : 'Ninguno: este pin no tiene función touch'
      ],
      ['DAC', pin.dac ? `DAC${pin.dac} (salida analógica)` : 'Ninguno'],
      ['En este header', record.exposed ? 'Sí' : 'No: no está expuesto en el header de 30 pines']
    ])
  );

  if (!record.exposed && pin.reasons?.notExposed) {
    panel.append(
      section(
        'Por qué no está en el header',
        el('p', { className: 'muted-text', html: pin.reasons.notExposed })
      )
    );
  }

  const groups = roleGroups(pin);
  if (groups.length) {
    panel.append(
      section(
        'Roles de periféricos',
        el(
          'div',
          {},
          groups.map((g) =>
            el(
              'div',
              { style: { marginBottom: '6px' } },
              el('div', { className: 'muted-text', style: { marginBottom: '3px' } }, g.label),
              tags(g.items.map((i) => ({ text: i })))
            )
          )
        )
      )
    );
  }

  panel.append(
    section(
      'Enrutable a cualquier pin',
      el(
        'p',
        { className: 'muted-text' },
        'PCNT, TWAI/CAN, RMT, LEDC/PWM, MCPWM, SDM, I2C e I2S son enrutables por matriz: '
      ),
      el('p', { className: 'muted-text', style: { fontStyle: 'italic' } }, `"${MATRIX_QUOTE}"`)
    )
  );

  if (pin.strapping) {
    panel.append(
      section(
        'Pin strapping',
        kv([
          ['Papel', pin.strapping.role, true],
          ['Valor por defecto', pin.strapping.boardDefault, true],
          ['Si es HIGH', pin.strapping.high, true],
          ['Si es LOW', pin.strapping.low, true],
          ['Temporización', ELECTRICAL.strappingHold, true]
        ])
      )
    );
  }

  if (pin.adc?.unit === 'ADC2') {
    panel.append(
      section(
        'ADC2 y la radio Wi-Fi',
        el(
          'p',
          { className: 'muted-text' },
          'Esto es una exclusión mutua por arbitraje, no un periférico roto. El bloque ADC2 está ' +
            'compartido con la radio y solo un controlador lo puede usar a la vez, así que el ' +
            'perdedor expira.'
        ),
        list(ADCCONFLICT_NOTES.slice(1))
      )
    );
  }

  const restrictions = [...pin.restrictions].sort(
    (a, b) => SEVERITY_ORDER[a.severity] - SEVERITY_ORDER[b.severity]
  );
  panel.append(
    section(
      'Restricciones y por qué importan',
      restrictions.length
        ? el(
            'div',
            {},
            restrictions.map((r) =>
              el(
                'div',
                { className: `warn-item ${r.severity}` },
                el('strong', {}, r.title),
                el('p', { html: r.detail })
              )
            )
          )
        : el('p', { className: 'muted-text' }, 'Ninguna.')
    )
  );

  const notes = [...(pin.notes ?? [])];
  if (pin.flags.onboardLed) notes.push(pin.flags.onboardLed);
  if (notes.length) panel.append(section('Notas de la placa', list(notes)));

  panel.append(
    section(
      'Límites eléctricos',
      list([
        ELECTRICAL.logic,
        ELECTRICAL.absMax,
        ELECTRICAL.pulls,
        ELECTRICAL.ioCurrent,
        ELECTRICAL.adcAttenuation
      ])
    )
  );

  panel.append(section('Fuentes', list(pin.sources ?? [])));
}

function renderRail(panel, record, board, ctx) {
  const rail = record.data;
  panel.append(
    el(
      'div',
      { className: 'pin-head' },
      el('span', { className: 'badge' }, record.railId),
      el('span', { className: 'state', style: { color: STATE_COLORS.rail } }, 'Alimentación / control')
    ),
    el('p', { className: 'pin-subtitle' }, rail.name),
    kv([
      ['Tipo', rail.kind],
      ['Dirección', rail.direction],
      ['Descripción', rail.description, true]
    ])
  );

  panel.append(
    section(
      'Restricciones',
      rail.restrictions.length
        ? el(
            'div',
            {},
            rail.restrictions.map((r) =>
              el(
                'div',
                { className: `warn-item ${r.severity}` },
                el('strong', {}, r.title),
                el('p', { html: r.detail })
              )
            )
          )
        : el('p', { className: 'muted-text' }, 'Ninguna.')
    )
  );

  if (rail.notes?.length) panel.append(section('Notas', list(rail.notes)));

  panel.append(
    section(
      'Matriz GPIO',
      el('p', { className: 'muted-text', style: { fontStyle: 'italic' } }, `"${GPIO_MATRIX_QUOTE}"`)
    )
  );

  panel.append(section('Fuentes', list(rail.sources ?? [])));
}

export function renderPinPanel(panel, record, board, ctx) {
  clear(panel);
  panel.dataset.pin = record ? record.id : '';
  panel.dataset.silk = record ? (record.silks?.[ctx.silk] ?? '') : '';
  if (!record) {
    panel.append(
      el('p', { className: 'placeholder' }, 'Haz clic en cualquier pin del header 3D para inspeccionarlo.')
    );
    return;
  }
  if (record.kind === 'rail') renderRail(panel, record, board, ctx);
  else renderGpio(panel, record, board, ctx);
}

/** Shown when the user selects a pin that is not on the header. */
export function renderHiddenPinPanel(panel, pin) {
  clear(panel);
  panel.dataset.pin = `hidden-gpio${pin.gpio}`;
  panel.append(
    el(
      'div',
      { className: 'pin-head' },
      el('span', { className: 'badge' }, `GPIO${pin.gpio}`),
      el('span', { className: 'state', style: { color: STATE_COLORS.flash } }, 'No está en el header')
    ),
    el(
      'p',
      { className: 'pin-subtitle' },
      'Este GPIO existe en el silicio del ESP32 pero no tiene posición en el header de 30 ' +
        'pines de ninguna de las dos placas modeladas.'
    ),
    kv([
      ['Alias Arduino', orDash(pin.arduino)],
      ['ADC', pin.adc ? `${pin.adc.unit}_CH${pin.adc.channel}` : 'Ninguno'],
      ['Touch', pin.touch !== null && pin.touch !== undefined ? `T${pin.touch}` : 'Ninguno'],
      ['DAC', pin.dac ? `DAC${pin.dac}` : 'Ninguno']
    ]),
    section(
      'Por qué falta',
      el('p', { className: 'muted-text', html: pin.reasons?.notExposed ?? 'No está expuesto.' })
    )
  );
}

export const PANEL_REFERENCE = {
  SERIAL_PORTS,
  SPI_BUSES,
  I2C_NOTES,
  I2S_NOTES,
  UNDEFINED_ARDUINO_ALIASES
};
