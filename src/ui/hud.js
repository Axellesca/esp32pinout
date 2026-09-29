/**
 * HUD: board selector, silkscreen selector, view toggles, capability filter chips,
 * search, legend, board notes and the provenance panel.
 *
 * The HUD owns no state of its own. It renders from the app state and emits intents, which
 * keeps the 3D scene and the DOM impossible to desynchronise.
 *
 * Copy is in Spanish with the technical terms left in English, so a datasheet name and the
 * app text can be compared word for word.
 */

import { clear, el, qs, toggleClass } from './dom.js';
import { FILTERS, searchAllGpiOs } from '../interaction/filters.js';
import { STATE_COLORS } from '../three/palette.js';
import { BOARDS, HEADER_LEFT, HEADER_RIGHT } from '../data/boards.js';
import { ELECTRICAL, GPIOS, SOURCES } from '../data/gpio.js';
import { MATRIX_QUOTE } from '../data/peripherals.js';

const LEGEND = [
  { state: 'safe', text: 'Seguro: sin ninguna restricción. Libre para cualquier uso.' },
  { state: 'strapping', text: 'Strapping: se muestrea en el reset. Mantén un nivel de arranque definido.' },
  { state: 'input-only', text: 'Solo entrada: no tiene driver de salida ni resistencias pull-up internas.' },
  { state: 'flash', text: 'Flash: está unido al SPI flash del módulo, no se puede usar.' },
  { state: 'not-bonded', text: 'No está vinculado (bonded out) en el módulo WROOM-32.' },
  { state: 'contested', text: 'ADC2 con la radio Wi-Fi activa: las lecturas expiran, no son erróneas.' },
  { state: 'selected', text: 'Pin seleccionado: haz de luz pulsante.' },
  { state: 'hovered', text: 'Pin bajo el cursor: aumento de escala y brillo.' },
  { state: 'rail', text: 'Pads de alimentación y control: EN, VIN, 3V3, GND.' }
];

export function createHud({ onIntent }) {
  const boardSelect = qs('#board-select');
  const silkSelect = qs('#silk-select');
  const boardName = qs('#board-name');
  const toggleButtons = [...document.querySelectorAll('#view-toggles .toggle')];
  const chipsHost = qs('#filter-chips');
  const legendHost = qs('#legend-items');
  const searchInput = qs('#search-input');
  const resultsHost = qs('#search-results');
  const notesHost = qs('#board-notes');
  const sourcesBody = qs('#sources-body');
  const sidebar = qs('#sidebar');
  const sidebarToggle = qs('#sidebar-toggle');
  const filterClear = qs('#filter-clear');
  const hoverReadout = qs('#hover-readout');

  const chipButtons = new Map();

  /* ---- static content ---- */

  for (const board of BOARDS) {
    boardSelect.append(el('option', { value: board.id }, board.name));
  }

  for (const item of LEGEND) {
    legendHost.append(
      el(
        'li',
        {},
        el('span', { className: 'swatch', style: { background: STATE_COLORS[item.state] } }),
        el('span', {}, item.text)
      )
    );
  }

  for (const f of FILTERS) {
    const btn = el(
      'button',
      {
        type: 'button',
        className: 'chip',
        dataset: { filter: f.id },
        title: f.hint,
        onClick: () => onIntent({ type: 'toggle-filter', id: f.id })
      },
      // A neutral ring, not a colour swatch. Pin colour means pin STATE (see the legend), so a
      // coloured dot on a capability chip implied a pin colour that no pin ever carries.
      el('span', { className: 'dot' }),
      f.label
    );
    chipButtons.set(f.id, btn);
    chipsHost.append(btn);
  }

  renderProvenance(sourcesBody);

  /* ---- wiring ---- */

  boardSelect.addEventListener('change', (e) =>
    onIntent({ type: 'set-board', id: e.target.value })
  );
  silkSelect.addEventListener('change', (e) =>
    onIntent({ type: 'set-silk', id: e.target.value })
  );
  for (const btn of toggleButtons) {
    btn.addEventListener('click', () =>
      onIntent({ type: 'toggle-view', id: btn.dataset.view })
    );
  }
  filterClear.addEventListener('click', () => onIntent({ type: 'clear-filters' }));
  sidebarToggle.addEventListener('click', () => {
    const open = sidebar.classList.toggle('is-open');
    sidebarToggle.setAttribute('aria-expanded', String(open));
  });
  searchInput.addEventListener('input', (e) =>
    onIntent({ type: 'search', query: e.target.value })
  );
  searchInput.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      searchInput.value = '';
      onIntent({ type: 'search', query: '' });
      searchInput.blur();
    }
  });

  /* ---- rendering ---- */

  function renderSearchResults(query) {
    clear(resultsHost);
    if (!query.trim()) return;

    const all = Object.values(GPIOS);
    const results = searchAllGpiOs(query, all).slice(0, 8);
    if (!results.length) {
      resultsHost.append(el('li', { className: 'muted-text' }, 'Ningún pin coincide con la búsqueda.'));
      return;
    }
    for (const { pin } of results) {
      const onHeader = HEADER_GPIOS.has(pin.gpio);
      resultsHost.append(
        el(
          'li',
          {},
          el(
            'button',
            {
              type: 'button',
              onClick: () => {
                onIntent({ type: 'select-pin', id: onHeader ? `gpio-${pin.gpio}` : `hidden-gpio${pin.gpio}` });
                if (window.matchMedia('(max-width: 1000px)').matches) {
                  sidebar.classList.add('is-open');
                  sidebarToggle.setAttribute('aria-expanded', 'true');
                }
              }
            },
            el('span', { className: 'r-silk' }, `GPIO${pin.gpio}`),
            el(
              'span',
              { className: 'r-meta' },
              pin.arduino ? `Arduino ${pin.arduino}` : pin.flags.flash ? 'SPI flash' : ''
            ),
            onHeader ? null : el('span', { className: 'r-hidden' }, 'NO ESTÁ EN EL HEADER')
          )
        )
      );
    }
  }

  function render(state) {
    const board = BOARDS.find((b) => b.id === state.boardId);
    if (boardSelect.value !== state.boardId) boardSelect.value = state.boardId;
    boardName.textContent = board.name;

    clear(silkSelect);
    for (const style of board.silk.styles) {
      silkSelect.append(el('option', { value: style.id }, style.label));
    }
    silkSelect.value = state.silk;
    silkSelect.disabled = board.silk.styles.length < 2;

    const viewState = {
      top: state.flipped ? '' : 'is-on',
      bottom: state.flipped ? 'is-on' : '',
      explode: state.exploded ? 'is-on' : '',
      labels: state.labels ? 'is-on' : '',
      wifi: state.wifiOn ? 'is-on' : '',
      reset: ''
    };
    for (const btn of toggleButtons) {
      toggleClass(btn, 'is-on', viewState[btn.dataset.view] === 'is-on');
    }
    const wifiBtn = toggleButtons.find((b) => b.dataset.view === 'wifi');
    if (wifiBtn) wifiBtn.textContent = state.wifiOn ? 'Wi-Fi activa' : 'Wi-Fi inactiva';

    for (const [id, btn] of chipButtons) {
      toggleClass(btn, 'is-on', state.filters.has(id));
    }

    clear(notesHost);
    notesHost.append(
      el('p', {}, board.subtitle),
      el(
        'ul',
        {},
        board.notes.map((n) => el('li', { html: n }))
      ),
      el('p', { className: 'muted-text' }, `PCB modelado como ${board.pcb.width} x ${board.pcb.depth} mm, paso del header 2.54 mm.`),
      el(
        'p',
        { className: 'muted-text' },
        `Puente USB-UART: ${board.usbUart.label}. Regulador: ${board.regulator.label}.`
      )
    );

    renderSearchResults(state.search);
  }

  function setHoverReadout(text) {
    hoverReadout.textContent = text ?? '';
  }

  return { render, setHoverReadout, searchInput, boardSelect, silkSelect, sidebar };
}

/** GPIO numbers that have a position on the 30-pin header (both boards share the layout). */
const HEADER_GPIOS = new Set(
  HEADER_LEFT.concat(HEADER_RIGHT)
    .filter((entry) => entry.type === 'gpio')
    .map((entry) => entry.gpio)
);

function renderProvenance(host) {
  const section = (title, body) => host.append(el('h3', {}, title), body);
  const ul = (items) => el('ul', {}, items.map((i) => el('li', { html: i })));

  section(
    'Procedencia de los datos',
    el(
      'p',
      {},
      'Todas las capacidades de este explorador proceden de fuentes primarias de Espressif. ' +
        'Las dos fuentes comunitarias de la lista siguiente solo se usan como corroboración.'
    )
  );
  section(
    'Fuentes primarias',
    ul([
      SOURCES.series,
      SOURCES.wroom,
      SOURCES.idfAdc,
      SOURCES.idfGpio,
      SOURCES.idfDac,
      SOURCES.idfTouch,
      SOURCES.devkitc,
      SOURCES.esptool,
      SOURCES.variants
    ])
  );
  section('Fuente corroborante', ul([SOURCES.doit]));

  section(
    'Tres correcciones aplicadas tras la verificación',
    el(
      'ol',
      {},
      el(
        'li',
        {},
        'ADC1 es solo GPIO32-39 (8 canales). ADC2 es GPIO0, 2, 4, 12, 13, 14, 15, 25, 26, 27 ' +
          '(10 canales). La intuición de que "ADC1 = pares, ADC2 = impares" es falsa.'
      ),
      el(
        'li',
        {},
        'El ESP32 tiene exactamente dos canales DAC: DAC1 = GPIO25 y DAC2 = GPIO26. No existe ' +
          'DAC3 y GPIO18 no es un pin DAC.'
      ),
      el(
        'li',
        {},
        'GPIO34, 35, 36 y 39 no tienen función touch. También son solo entrada y no tienen ' +
          'resistencias pull internas. Touch CH0-CH9 = GPIO 4, 0, 2, 15, 13, 12, 14, 27, 33, 32.'
      )
    )
  );

  section(
    'Ambigüedades conocidas, declaradas en lugar de ocultas',
    ul([
      'Rotación entre columnas y borde físico: el orden del header está fijado por dos fuentes ' +
        'que coinciden, pero no se pudo verificar por máquina contra una fotografía qué columna ' +
        'queda en qué borde del PCB. La rotación que se muestra aquí es una decisión de render.',
      'Conflicto en el tamaño del PCB: las fuentes indican 51.45 x 28.33, 51.8 x 28.2 y ' +
        '53.3 x 25.0 mm. El modelo usa 51.6 x 28.4 mm.',
      'GPIO0 no está expuesto en el header de 30 pines. Se modela y se marca como tal porque ' +
        'es un strapping real e importante, pero no tiene posición en el header.',
      '"ESP-32S" no es un nombre de placa de Espressif y no tiene documentación autorizada. Se ' +
        'representa como una skin cosmética sobre los datos del DOIT DevKit V1. No se afirma ' +
        'ninguna diferencia eléctrica.',
      'La orientación del módulo y del borde USB en el modelo 3D es una aproximación de ' +
        'render; no se pudo verificar por programa la referencia fotográfica.'
    ])
  );

  section('Límites eléctricos', ul(Object.values(ELECTRICAL)));
  section('Matriz GPIO', el('p', { style: { fontStyle: 'italic' } }, `"${MATRIX_QUOTE}"`));
  section('Aritmética del header', ul(['25 GPIO + 3V3 + EN + VIN + 2 x GND = 30 posiciones.']));
}
