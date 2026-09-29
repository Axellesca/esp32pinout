/**
 * Capability filter and search state.
 *
 * Filters are OR-ed with each other (any active chip highlights its pins) and AND-ed with
 * the search box. Everything is derived from the pin dataset, so a filter can never drift
 * out of sync with the data it describes.
 *
 * Note on the UART / SPI / I2C / PWM chips: on the ESP32 almost every usable GPIO is
 * matrix-routable to almost every peripheral, so filtering on "can be an I2C pin" would
 * match nearly everything and tell the user nothing. Those chips therefore match pins
 * with a NAMED default assignment, and the chip hint says so.
 *
 * A chip is a FILTER, not a colour. Pin colour encodes pin STATE (safe, strapping,
 * input-only, flash, not bonded, ADC2 contested) and nothing else, so the chips carry no
 * colour swatch of their own: giving the DAC chip a swatch made the legend claim a pin colour
 * that no pin ever has.
 */

const isGpio = (r) => r.kind === 'gpio';

export const FILTERS = [
  {
    id: 'safe',
    label: 'Solo seguros',
    hint: 'Sin ninguna restricción: sin papel strapping, con salida, fuera del flash y solo ADC1.',
    test: (r) => isGpio(r) && r.state === 'safe'
  },
  {
    id: 'strapping',
    label: 'Strapping',
    hint: 'Se muestrean en el reset. Algo externo debe mantener un nivel definido o la placa se comportará mal.',
    test: (r) => isGpio(r) && Boolean(r.data.strapping)
  },
  {
    id: 'input-only',
    label: 'Solo entrada',
    hint: 'GPIO34, 35, 36 y 39. Sin driver de salida ni resistencias pull internas.',
    test: (r) => isGpio(r) && r.data.direction === 'input-only'
  },
  {
    id: 'adc1',
    label: 'ADC1',
    hint: 'Solo GPIO32-39. Nunca bloqueado por la radio Wi-Fi.',
    test: (r) => isGpio(r) && r.data.adc?.unit === 'ADC1'
  },
  {
    id: 'adc2',
    label: 'ADC2',
    hint: 'GPIO0, 2, 4, 12, 13, 14, 15, 25, 26, 27. En conflicto con la radio Wi-Fi.',
    test: (r) => isGpio(r) && r.data.adc?.unit === 'ADC2'
  },
  {
    id: 'dac',
    label: 'DAC',
    hint: 'Exactamente dos canales: DAC1 en GPIO25 y DAC2 en GPIO26. No existe DAC3.',
    test: (r) => isGpio(r) && Boolean(r.data.dac)
  },
  {
    id: 'touch',
    label: 'Touch',
    hint: 'CH0-CH9 en GPIO 4, 0, 2, 15, 13, 12, 14, 27, 33, 32. GPIO34-39 no tienen función touch.',
    test: (r) => isGpio(r) && r.data.touch !== null && r.data.touch !== undefined
  },
  {
    id: 'uart',
    label: 'UART',
    hint: 'Pines con un papel UART con nombre propio. Los tres UART son enrutables por matriz a cualquier pin.',
    test: (r) => isGpio(r) && r.data.roles.uart.length > 0
  },
  {
    id: 'spi',
    label: 'SPI',
    hint: 'Pines con un papel VSPI o HSPI con nombre propio.',
    test: (r) => isGpio(r) && r.data.roles.spi.length > 0
  },
  {
    id: 'i2c',
    label: 'I2C',
    hint: 'Pines I2C por defecto de Arduino. En el ESP32 cualquier GPIO puede ser SDA o SCL.',
    test: (r) => isGpio(r) && Boolean(r.data.flags.arduinoI2c)
  },
  {
    id: 'pwm',
    label: 'PWM',
    hint: 'Con salida, así que LEDC/MCPWM puede manejarlos. GPIO34-39 no pueden sacar nada.',
    test: (r) => isGpio(r) && r.data.direction === 'bidirectional'
  },
  {
    id: 'jtag',
    label: 'JTAG',
    hint: 'Compartidos con la interfaz de depuración JTAG.',
    test: (r) => isGpio(r) && r.data.roles.jtag.length > 0
  },
  {
    id: 'rtc',
    label: 'RTC',
    hint: 'Utilizables mientras la CPU principal está en deep sleep.',
    test: (r) => isGpio(r) && r.data.roles.rtc.length > 0
  },
  {
    id: 'recommended',
    label: 'Recomendados',
    hint: 'Los pines sin restricciones ni carga en la placa: 16, 17, 18, 19, 21, 22, 23.',
    test: (r) => isGpio(r) && Boolean(r.data.flags.recommended)
  },
  {
    id: 'alias-trap',
    label: 'Alias engañoso',
    hint: 'El alias de Arduino no significa lo que parece: A11 = GPIO0, A12 = GPIO2, A13 = GPIO15, A15 = GPIO12.',
    test: (r) => isGpio(r) && Boolean(r.data.flags.arduinoTrap)
  },
  {
    id: 'power',
    label: 'Alimentación / EN',
    hint: 'Las posiciones del header que no son GPIO: EN, VIN, 3V3 y los dos pads de GND.',
    test: (r) => r.kind === 'rail'
  }
];

export const FILTER_BY_ID = Object.fromEntries(FILTERS.map((f) => [f.id, f]));

export function createFilterState() {
  const active = new Set();
  let query = '';
  const listeners = new Set();

  const emit = () => {
    const matching = computeMatching();
    for (const fn of listeners) fn({ active, query, matching });
  };

  function computeMatching() {
    const matching = new Set();
    const q = query.trim().toLowerCase();
    for (const rec of currentRecords) {
      if (active.size > 0) {
        let hit = false;
        for (const id of active) {
          const f = FILTER_BY_ID[id];
          if (f && f.test(rec)) {
            hit = true;
            break;
          }
        }
        if (!hit) continue;
      }
      if (q && !matchesQuery(rec, q)) continue;
      matching.add(rec.id);
    }
    return matching;
  }

  let currentRecords = [];

  return {
    get active() {
      return active;
    },
    get query() {
      return query;
    },
    get isFiltering() {
      return active.size > 0 || query.trim().length > 0;
    },
    get matching() {
      return computeMatching();
    },
    setRecords(records) {
      currentRecords = records;
    },
    toggle(id) {
      if (active.has(id)) active.delete(id);
      else active.add(id);
      emit();
    },
    setOnly(ids) {
      active.clear();
      for (const id of ids) active.add(id);
      emit();
    },
    clear() {
      active.clear();
      query = '';
      emit();
    },
    setQuery(next) {
      query = next;
      emit();
    },
    subscribe(fn) {
      listeners.add(fn);
      return () => listeners.delete(fn);
    },
    emit
  };
}

/**
 * Search matching. Accepts GPIO13, IO13, D13, G13, 13, A14, T4, TX0, EN, 3V3, VP and
 * role fragments such as "hspi" or "adc1".
 */
export function matchesQuery(record, rawQuery) {
  const q = rawQuery.trim().toLowerCase();
  if (!q) return true;
  if (record.tokens.some((t) => t.toLowerCase() === q)) return true;
  // Prefix match on numeric forms so "gp13" and "d1" still find something useful.
  if (record.tokens.some((t) => t.toLowerCase().startsWith(q) && q.length >= 2)) return true;
  return record.tokens.some((t) => t.toLowerCase().includes(q));
}

/** Search over the pins that are NOT on the header, for the "hidden" lookup. */
export function searchAllGpiOs(query, allGpiOs) {
  const q = query.trim().toLowerCase();
  if (!q) return [];
  return allGpiOs
    .map((pin) => {
      const tokens = [
        `gpio${pin.gpio}`,
        `io${pin.gpio}`,
        `d${pin.gpio}`,
        `${pin.gpio}`,
        pin.arduino?.toLowerCase() ?? '',
        pin.touchAlias?.toLowerCase() ?? ''
      ].filter(Boolean);
      const score = tokens.some((t) => t === q) ? 0 : tokens.some((t) => t.startsWith(q)) ? 1 : 2;
      return { pin, score, hit: tokens.some((t) => t.includes(q)) };
    })
    .filter((x) => x.hit)
    .sort((a, b) => a.score - b.score)
    .slice(0, 8);
}
