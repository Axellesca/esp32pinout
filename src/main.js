/**
 * Application entry point. Owns the single source of truth for UI state, builds the
 * 3D board instances, and translates intents from the HUD and the pointer into animation
 * and panel updates.
 *
 * Data never reaches the renderer directly and the renderer never owns state, so adding a
 * board is a pure data change.
 */

import { Box3, Vector3 } from 'three';
import './style.css';

import { createStage } from './three/scene.js';
import { createBoardModel, createGround } from './three/boardModel.js';
import { targetColorFor, updatePins } from './three/pinMeshes.js';
import { createLabelController } from './three/labels.js';
import {
  crossFade,
  explodeBoard,
  flipBoard,
  framePin,
  introAnimation,
  resetView,
  viewBottom,
  viewTop
} from './three/animations.js';
import { createPointerControls } from './interaction/raycast.js';
import { createFilterState } from './interaction/filters.js';
import { createHud } from './ui/hud.js';
import { renderHiddenPinPanel, renderPinPanel } from './ui/pinPanel.js';
import { qs } from './ui/dom.js';
import { BOARD_BY_ID, BOARDS, buildBoardRecords, validateDataset } from './data/boards.js';
import { GPIOS } from './data/gpio.js';

/* ------------------------------------------------------------- state */

const state = {
  boardId: BOARDS[0].id,
  silk: BOARD_BY_ID[BOARDS[0].id].silk.defaultStyle,
  labels: true,
  wifiOn: false,
  flipped: false,
  exploded: false,
  filters: new Set(),
  search: '',
  selectedId: null,
  hoveredId: null
};

// Silkscreen convention chosen by hand, per board. A board's `defaultStyle` is the fallback;
// once the user picks a convention for a board, that choice survives every later board switch,
// so switching boards never silently resets a deliberate choice.
const silkOverride = new Map();

const panel = qs('#pin-panel');

const clampNum = (v, min, max) => Math.min(max, Math.max(min, v));

if (import.meta.env?.DEV) {
  const problems = validateDataset();
  if (problems.length) console.warn('[dataset]', problems);
}

/* ------------------------------------------------------------- scene */

const stage = createStage(qs('#canvas-host'), qs('#label-host'));
const labelController = createLabelController();
const filterState = createFilterState();

const ground = createGround(BOARD_BY_ID[state.boardId].pcb);
ground.position.y = -1.9;
stage.scene.add(ground);

const models = new Map();

// World-space bounds of the active board. The camera framing is solved against this box, so the
// board keeps a margin at any viewport size and aspect ratio instead of a distance that only
// happens to fit the window it was authored on.
const frameBox = new Box3();

function refreshFrameBox() {
  active.group.updateWorldMatrix(true, true);
  frameBox.setFromObject(active.group);
  return frameBox;
}

function buildModel(boardId) {
  const board = BOARD_BY_ID[boardId];
  const records = buildBoardRecords(boardId);
  const model = createBoardModel({ board, style: state.silk, records });
  model.records = records;
  model.group.rotation.x = state.flipped ? Math.PI : 0;
  model.group.visible = boardId === state.boardId;
  if (boardId !== state.boardId) model.setOpacity(0);
  if (state.exploded) {
    for (const part of model.parts) part.position.y = part.userData.baseY + part.userData.lift;
    for (const pin of model.pins) pin.group.position.y = 2.4;
  }
  stage.scene.add(model.group);
  models.set(boardId, model);
  return model;
}

let active = buildModel(state.boardId);
active.group.visible = true;
filterState.setRecords(active.records);

/* ------------------------------------------------------------- derived visuals */

function applyPinTargets() {
  const matching = filterState.matching;
  const filtering = filterState.isFiltering;

  for (const model of models.values()) {
    for (const pin of model.pins) {
      const rec = pin.record;
      const contested =
        state.wifiOn && rec.kind === 'gpio' && rec.data.adc?.unit === 'ADC2';
      pin.targetColor = targetColorFor(rec, contested);

      const isSelected = state.selectedId === rec.id;
      const isHovered = state.hoveredId === rec.id;
      const matched = !filtering || matching.has(rec.id);

      pin.targetGlow = isSelected ? 0.68 : isHovered ? 0.78 : filtering ? (matched ? 0.34 : 0.04) : 0.1;
      pin.targetLift = isSelected ? 0.45 : isHovered ? 0.5 : 0;
      pin.targetBeam = isSelected ? 1 : 0;
      pin.targetDim = filtering && !matched ? 0.82 : 0;
    }
  }
}

function refreshLabels() {
  for (const model of models.values()) {
    labelController.sync(model, { silk: state.silk, wifiOn: state.wifiOn });
    labelController.applyState(model, {
      selectedId: state.selectedId,
      hoveredId: state.hoveredId,
      filterActive: filterState.isFiltering,
      matchingIds: filterState.matching
    });
  }
}

const layoutArgs = {
  selectedId: null,
  hoveredId: null,
  filterActive: false,
  matchingIds: null,
  // Which face of the board is pointing up. When the board is turned over, the pin labels live
  // on the buried face and CSS2D has no depth test to hide them, so the layer is emptied.
  faceUp: true
};

function refreshLayout() {
  layoutArgs.selectedId = state.selectedId;
  layoutArgs.hoveredId = state.hoveredId;
  layoutArgs.filterActive = filterState.isFiltering;
  layoutArgs.matchingIds = filterState.matching;
  layoutArgs.faceUp = !state.flipped;
}

function refreshHud() {
  hud.render(state);
}

function refreshPanel() {
  if (!state.selectedId) {
    renderPinPanel(panel, null, active.board, state);
    return;
  }
  const record = active.records.find((r) => r.id === state.selectedId);
  if (record) renderPinPanel(panel, record, active.board, state);
  else if (state.selectedId.startsWith('hidden-gpio')) {
    const n = Number(state.selectedId.replace('hidden-gpio', ''));
    renderHiddenPinPanel(panel, GPIOS[n]);
  } else {
    renderPinPanel(panel, null, active.board, state);
  }
}

function refreshAll() {
  applyPinTargets();
  refreshLabels();
  refreshLayout();
  refreshHud();
  refreshPanel();
}

/* ------------------------------------------------------------- frame loop */

const tmp = new Vector3();

stage.onUpdate((dt, elapsed) => {
  for (const model of models.values()) {
    if (!model.group.visible) continue;
    updatePins(model.pins, dt, elapsed);
    // The GPIO2 LED breathes gently so the board does not look like a static render.
    for (const led of model.ledMeshes) {
      led.material.emissiveIntensity = 0.85 + 0.25 * Math.sin(elapsed * 1.6);
    }
  }
  // A board that has just finished fading out must drop its CSS2D labels, otherwise the
  // label layer keeps both boards' pins stacked on top of each other.
  for (const model of models.values()) {
    if (model.labelVisibilityKey !== model.group.visible) {
      model.labelVisibilityKey = model.group.visible;
      if (model.group.visible) refreshLabels();
      else labelController.detach(model);
    }
  }
  // Declutter every frame, after the camera has been updated for this frame, so the labels
  // stay readable while the user orbits.
  const host = stage.renderer.domElement;
  for (const model of models.values()) {
    labelController.layout(
      model,
      stage.camera,
      host.clientWidth,
      host.clientHeight,
      layoutArgs
    );
  }
});

/* ------------------------------------------------------------- selection helpers */

function findPin(id) {
  for (const model of models.values()) {
    const pin = model.pins.find((p) => p.id === id);
    if (pin) return { model, pin };
  }
  return null;
}

function selectPin(id) {
  state.selectedId = id;
  refreshAll();
}

function hoverPin(id) {
  if (state.hoveredId === id) return;
  state.hoveredId = id;
  const found = id ? findPin(id) : null;
  hud.setHoverReadout(
    found
      ? describeRecord(found.pin.record)
      : 'Arrastra para orbitar, usa la rueda para hacer zoom, haz clic en un pin para ver todos sus detalles y doble clic para encuadrarlo.'
  );
  applyPinTargets();
  refreshLabels();
}

function describeRecord(record) {
  if (record.kind === 'rail') return `${record.railId} - ${record.data.name}`;
  const pin = record.data;
  // Datasheet literals, not paraphrases: the hover readout has to be comparable word for word
  // with the panel and the data sheet.
  const bits = [record.silks[state.silk] ?? record.silks.clone, `GPIO${pin.gpio}`];
  if (pin.arduino) bits.push(pin.arduino);
  if (pin.adc) bits.push(`${pin.adc.unit}_CH${pin.adc.channel}`);
  if (pin.dac) bits.push(`DAC${pin.dac}`);
  if (pin.touch !== null && pin.touch !== undefined) bits.push(`T${pin.touch}`);
  if (pin.strapping) bits.push('strapping');
  if (pin.direction === 'input-only') bits.push('input only');
  return bits.join('  /  ');
}

function focusPin(id) {
  const found = findPin(id);
  if (!found) return;
  found.pin.group.getWorldPosition(tmp);
  framePin(stage, tmp, 24);
}

/* ------------------------------------------------------------- view intents */

function setView(id) {
  switch (id) {
    case 'top':
      state.flipped = false;
      flipBoard(stage, active, 0);
      viewTop(stage, state, refreshFrameBox());
      break;
    case 'bottom':
      // Turn the board over and look DOWN at the face now pointing up. Moving the camera below
      // as well used to cancel the flip out and show the component side from underneath, which
      // left the modelled underside - pads, keep-out and underside silkscreen - with no control
      // that could reach it.
      state.flipped = true;
      flipBoard(stage, active, Math.PI);
      viewBottom(stage, state, refreshFrameBox());
      break;
    case 'explode':
      state.exploded = !state.exploded;
      explodeBoard(stage, active, state.exploded ? 1 : 0);
      break;
      case 'labels':
        state.labels = !state.labels;
        for (const model of models.values()) labelController.setVisible(model, state.labels);
        refreshLabels();
        break;
    case 'wifi':
      state.wifiOn = !state.wifiOn;
      refreshAll();
      break;
    case 'reset':
      resetView(stage, state, refreshFrameBox());
      break;
    default:
      break;
  }
  refreshHud();
  refreshLayout();
}

function setBoard(id) {
  if (id === state.boardId || !BOARD_BY_ID[id]) return;
  const outgoing = active;
  state.boardId = id;
  state.selectedId = null;
  state.hoveredId = null;
  pointer.clearHover();
  // Each board has its own default silkscreen convention (the DOIT DevKit V1 prints VP/VN and
  // A4..A9, the ESP-32S prints D-numbers), so switching boards applies the target board's
  // default unless the user has already chosen a convention for that board by hand.
  state.silk = silkOverride.get(id) ?? BOARD_BY_ID[id].silk.defaultStyle;

  active = models.get(id) ?? buildModel(id);
  filterState.setRecords(active.records);
  // The outgoing board's labels leave the DOM now, not when the fade ends: for the length of
  // a 620 ms cross-fade they would otherwise sit on top of the incoming board's 30 labels.
  labelController.suppress(outgoing, true);
  labelController.suppress(active, false);
  crossFade(stage, outgoing, active);
  if (state.exploded) {
    for (const part of active.parts) {
      part.position.y = part.userData.baseY + part.userData.lift;
    }
    for (const pin of active.pins) pin.group.position.y = 2.4;
  }
  // A board switch can change the model, so the framing box is re-solved against the new one.
  stage.setFrame(refreshFrameBox());
  refreshAll();
}

function setSilk(style) {
  state.silk = style;
  // Remember the manual choice so a later board switch does not undo it.
  silkOverride.set(state.boardId, style);
  for (const model of models.values()) {
    model.setSilkStyle(style);
  }
  refreshAll();
}

/* ------------------------------------------------------------- HUD + pointer */

const hud = createHud({
  onIntent(intent) {
    switch (intent.type) {
      case 'set-board':
        setBoard(intent.id);
        break;
      case 'set-silk':
        setSilk(intent.id);
        break;
      case 'toggle-view':
        setView(intent.id);
        break;
      case 'toggle-filter':
        filterState.toggle(intent.id);
        break;
      case 'clear-filters':
        filterState.clear();
        hud.searchInput.value = '';
        break;
      case 'search':
        filterState.setQuery(intent.query);
        break;
      case 'select-pin':
        selectPin(intent.id);
        if (intent.id.startsWith('hidden-gpio')) {
          // A pin that is not on the header cannot be framed, so just show the panel.
          hud.setHoverReadout('Este GPIO no tiene posición en el header de 30 pines de ninguna de las dos placas.');
        }
        break;
      default:
        break;
    }
  }
});

const pointer = createPointerControls({
  stage,
  getPickables: () => active.pins.map((p) => p.proxy),
  onHover: hoverPin,
  onSelect: selectPin,
  onFrame: focusPin
});

filterState.subscribe(() => {
  state.filters = filterState.active;
  state.search = filterState.query;
  refreshAll();
});

/* ------------------------------------------------------------- boot */

refreshAll();
stage.setFrame(refreshFrameBox());
introAnimation(stage, active, frameBox);
labelController.setVisible(active, state.labels);
renderPinPanel(panel, null, active.board, state);

// Expose a small, stable surface for automated smoke tests. It only reads state, so it
// cannot be used to mutate the app.
window.__esp32Explorer = {
  get state() {
    return {
      boardId: state.boardId,
      silk: state.silk,
      labels: state.labels,
      wifiOn: state.wifiOn,
      flipped: state.flipped,
      exploded: state.exploded,
      selectedId: state.selectedId,
      hoveredId: state.hoveredId,
      filters: [...state.filters],
      search: state.search,
      pinCount: active.pins.length
    };
  },
  boards: BOARDS.map((b) => b.id),
  recordIds: () => active.records.map((r) => r.id),
  /** Ids of the header positions the current filter and search match. */
  matching: () => [...filterState.matching],
  // Expected silkscreen text per header position under the active convention, read from the
  // dataset rather than from the DOM, so an automated check can tell a stale DOM attribute
  // apart from a genuine convention change.
  recordSils: () =>
    active.records.map((r) => ({ id: r.id, silk: r.silks[state.silk] ?? r.silks.clone })),
  /**
   * Camera pose, so an automated check can measure how far a view button actually moved the
   * camera ("Arriba" and "Abajo" are only top and bottom views if this says they are), plus the
   * gap left between the board and each edge of the canvas.
   */
  pose() {
    const offset = stage.camera.position.clone().sub(stage.controls.target);
    const distance = offset.length();
    const up = distance > 1e-6 ? offset.y / distance : 1;
    const target = stage.controls.target;
    const host = stage.renderer.domElement;
    const w = host.clientWidth;
    const h = host.clientHeight;
    let minX = Infinity;
    let maxX = -Infinity;
    let minY = Infinity;
    let maxY = -Infinity;
    for (let corner = 0; corner < 8; corner += 1) {
      tmp.set(
        corner & 1 ? frameBox.max.x : frameBox.min.x,
        corner & 2 ? frameBox.max.y : frameBox.min.y,
        corner & 4 ? frameBox.max.z : frameBox.min.z
      );
      tmp.project(stage.camera);
      const x = (tmp.x * 0.5 + 0.5) * w;
      const y = (-tmp.y * 0.5 + 0.5) * h;
      minX = Math.min(minX, x);
      maxX = Math.max(maxX, x);
      minY = Math.min(minY, y);
      maxY = Math.max(maxY, y);
    }
    const margin = {
      left: Math.round(minX),
      right: Math.round(w - maxX),
      top: Math.round(minY),
      bottom: Math.round(h - maxY),
      min: Math.round(Math.min(minX, w - maxX, minY, h - maxY))
    };
    return {
      offVerticalDeg: (Math.acos(clampNum(up, -1, 1)) * 180) / Math.PI,
      distance,
      position: stage.camera.position.toArray(),
      target: target.toArray(),
      margin
    };
  },
  /** World-space AABBs of the board and of the module carrier, for the placement check. */
  bounds() {
    const boxOf = (object) => {
      const b = new Box3().setFromObject(object);
      return { min: b.min.toArray(), max: b.max.toArray() };
    };
    return {
      board: boxOf(active.group),
      module: boxOf(active.moduleCarrier),
      // How far the module carrier reaches past the host PCB's edge, in millimetres.
      moduleOverhangMm: active.moduleCarrier
        ? boxOf(active.moduleCarrier).max[0] - boxOf(active.group).max[0]
        : null
    };
  }
};
