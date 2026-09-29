/**
 * Per-pin 3D objects and their visual state machine.
 *
 * Each header position is a small assembly:
 *   post    - the gold header pin
 *   pad     - the solder pad ring on the PCB
 *   sleeve  - a coloured marker sleeve around the pin: this is what carries the state colour
 *   ring    - a flat coloured collar on the PCB, readable from a top-down camera
 *   beam    - the additive vertical highlight shown for the selected pin
 *   proxy   - an invisible but ray-pickable box, so clicking is forgiving
 *   label   - a CSS2D element that always faces the camera
 *
 * State is communicated by three channels at once: the sleeve/ring colour, a glyph in the
 * label (see STATE_GLYPHS) and plain text in the info panel. Colour is never load-bearing.
 */

import {
  AdditiveBlending,
  BoxGeometry,
  CanvasTexture,
  CylinderGeometry,
  DoubleSide,
  Group,
  Mesh,
  MeshBasicMaterial,
  MeshStandardMaterial,
  SRGBColorSpace,
  TorusGeometry
} from 'three';
import { CSS2DObject } from 'three/examples/jsm/renderers/CSS2DRenderer.js';
import { dimColor, stateColor, STATE_GLYPHS } from './palette.js';
import { damp } from './tween.js';

export const PIN_GEOM = {
  postRadius: 0.34,
  postHeight: 6.6,
  padRadius: 1.15,
  padHeight: 0.12,
  sleeveRadius: 0.78,
  sleeveHeight: 2.2,
  sleeveBase: 2.5,
  ringRadius: 1.25,
  ringTube: 0.24,
  // The selection beam is a hint, not a spotlight. A wide bright column dominated the frame and
  // washed out the board under it, so it is narrow (about a third of the sleeve diameter),
  // short, and heavily faded along its length.
  beamRadius: 0.36,
  beamHeight: 14,
  labelHeight: 7.7,
  proxySize: 3.0,
  proxyHeight: 7.4
};

// Vertical falloff for the selection beam: bright at the pin, gone well before the top. The
// stop at 0.06 keeps the last few millimetres invisible, so the beam dissolves instead of
// ending in a hard elliptical cap the way a solid column does.
const BEAM_FALLOFF = (() => {
  const canvas = document.createElement('canvas');
  canvas.width = 4;
  canvas.height = 256;
  const ctx = canvas.getContext('2d');
  // Canvas bottom (v = 0) is the bottom of the cylinder, which is the pin end.
  const grad = ctx.createLinearGradient(0, 256, 0, 0);
  grad.addColorStop(0, 'rgba(255,255,255,0.85)');
  grad.addColorStop(0.22, 'rgba(255,255,255,0.34)');
  grad.addColorStop(0.5, 'rgba(255,255,255,0.1)');
  grad.addColorStop(0.8, 'rgba(255,255,255,0.02)');
  grad.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, 4, 256);
  const tex = new CanvasTexture(canvas);
  tex.colorSpace = SRGBColorSpace;
  return tex;
})();

// Shared geometry: 30 positions per board and two boards live at once, so reusing buffers
// keeps the draw-call and memory cost flat.
const SHARED = {
  post: new CylinderGeometry(PIN_GEOM.postRadius, PIN_GEOM.postRadius, PIN_GEOM.postHeight, 10, 1),
  pad: new CylinderGeometry(PIN_GEOM.padRadius, PIN_GEOM.padRadius, PIN_GEOM.padHeight, 20, 1),
  // Closed at both ends: an open-ended tube viewed from above shows its inner wall and reads
  // as a cup rather than a marker sleeve.
  sleeve: new CylinderGeometry(
    PIN_GEOM.sleeveRadius,
    PIN_GEOM.sleeveRadius,
    PIN_GEOM.sleeveHeight,
    20,
    1,
    false
  ),
  ring: new TorusGeometry(PIN_GEOM.ringRadius, PIN_GEOM.ringTube, 8, 22),
  // Selection beam: a narrow cone that is widest at the pin and tapers away upward,
  // additively blended with a steep vertical falloff and left out of the tone mapping so it
  // stays just above the board's brightness instead of being compressed into it. It has to
  // read as emitted light, not as a white pillar standing on the board.
  beam: new CylinderGeometry(
    PIN_GEOM.beamRadius * 1.5,
    PIN_GEOM.beamRadius * 0.8,
    PIN_GEOM.beamHeight,
    18,
    1,
    true
  ),
  proxy: new BoxGeometry(PIN_GEOM.proxySize, PIN_GEOM.proxyHeight, PIN_GEOM.proxySize)
};
SHARED.ring.rotateX(-Math.PI / 2);

const GOLD = 0xd9b558;
const HOVER_RATE = 14;

function goldMaterial() {
  return new MeshStandardMaterial({
    color: GOLD,
    metalness: 0.95,
    roughness: 0.34,
    transparent: true
  });
}

function pickMaterial() {
  // Writes nothing to colour or depth, but stays `visible` so the raycaster still sees it.
  return new MeshBasicMaterial({
    transparent: true,
    opacity: 0,
    colorWrite: false,
    depthWrite: false
  });
}

/** Build the CSS2D label element for a header record. */
export function createLabel(record, silk) {
  const el = document.createElement('div');
  el.className = 'pin-label';
  el.dataset.pin = record.id;
  el.dataset.silk = silk;
  const object = new CSS2DObject(el);
  object.position.set(0, PIN_GEOM.labelHeight, 0);
  object.center.set(0.5, 1);
  return { el, object };
}

/** Short capability marks shown on the 3D label. */
export function marksFor(record, contested) {
  if (record.kind !== 'gpio') return [];
  const marks = [];
  const pin = record.data;
  if (pin.dac) marks.push(`DAC${pin.dac}`);
  if (pin.touch !== null && pin.touch !== undefined) marks.push(`T${pin.touch}`);
  // The datasheet name, not a paraphrase: ADC2_CH8 is what the pin is called in the register
  // documentation, and it is also unambiguous next to the Arduino alias A10 (which a bare "A8"
  // or "A18" would not be).
  if (pin.adc) marks.push(`${pin.adc.unit}_CH${pin.adc.channel}`);
  if (contested) marks.push('WIFI');
  return marks;
}

/** Recompute the label contents. `contested` switches the glyph to the ADC2 / Wi-Fi marker. */
export function updateLabel(record, el, silk, marks, contested) {
  const glyph = contested ? STATE_GLYPHS.contested : STATE_GLYPHS[record.state] ?? '';
  const alias = record.kind === 'gpio' && record.data.arduino ? record.data.arduino : null;
  const title = record.kind === 'gpio' ? `GPIO${record.gpio}` : record.railId;
  el.innerHTML = [
    `<b>${silk}</b>`,
    glyph ? `<span class="glyphs">${glyph}</span>` : '',
    marks.length ? `<span class="glyphs">${marks.join(' ')}</span>` : '',
    alias ? `<span class="alt">${alias}</span>` : ''
  ]
    .filter(Boolean)
    .join('');
  // data-silk is read by the verification pass and by anything inspecting the DOM, so it has
  // to follow the silkscreen convention instead of freezing at whatever createLabel saw.
  el.dataset.silk = silk;
  el.title = `${silk} - ${title}${
    record.kind === 'gpio' && !record.exposed ? ' - no expuesto en este header' : ''
  }`;
}

/** The colour a pin should be aiming at right now. */
export function targetColorFor(record, contested) {
  return contested ? stateColor('contested') : stateColor(record.state);
}

/**
 * Create the assembly for one header position. `pos` is the local position inside the
 * header group (board coordinates, Y up from the PCB top surface).
 */
export function createPinMesh(record, pos, labelObject) {
  const group = new Group();
  group.name = `pin:${record.id}`;
  group.position.copy(pos);

  const pad = new Mesh(SHARED.pad, goldMaterial());
  pad.position.y = PIN_GEOM.padHeight / 2;
  pad.castShadow = false;
  group.add(pad);

  const post = new Mesh(SHARED.post, goldMaterial());
  post.position.y = PIN_GEOM.postHeight / 2;
  post.castShadow = true;
  group.add(post);

  const sleeveMat = new MeshStandardMaterial({
    color: stateColor(record.state),
    emissive: stateColor(record.state),
    emissiveIntensity: 0.18,
    roughness: 0.4,
    metalness: 0.1,
    transparent: true,
    opacity: 1
  });
  const sleeve = new Mesh(SHARED.sleeve, sleeveMat);
  sleeve.position.y = PIN_GEOM.sleeveBase + PIN_GEOM.sleeveHeight / 2;
  sleeve.castShadow = true;
  group.add(sleeve);

  const ringMat = new MeshStandardMaterial({
    color: stateColor(record.state),
    emissive: stateColor(record.state),
    emissiveIntensity: 0.3,
    roughness: 0.5,
    metalness: 0.05,
    transparent: true,
    opacity: 1
  });
  const ring = new Mesh(SHARED.ring, ringMat);
  ring.position.y = 0.2;
  group.add(ring);

  const beamMat = new MeshBasicMaterial({
    color: 0xffffff,
    map: BEAM_FALLOFF,
    transparent: true,
    opacity: 0,
    blending: AdditiveBlending,
    depthWrite: false,
    side: DoubleSide,
    toneMapped: false
  });
  const beam = new Mesh(SHARED.beam, beamMat);
  beam.position.y = PIN_GEOM.postHeight + PIN_GEOM.beamHeight / 2 - 1.5;
  beam.visible = false;
  group.add(beam);

  const proxy = new Mesh(SHARED.proxy, pickMaterial());
  proxy.position.y = PIN_GEOM.proxyHeight / 2;
  proxy.userData.pinId = record.id;
  group.add(proxy);

  if (labelObject) group.add(labelObject);

  return {
    record,
    id: record.id,
    group,
    pad,
    post,
    sleeve,
    ring,
    beam,
    proxy,
    materials: [pad.material, post.material, sleeveMat, ringMat, beamMat],
    // Animated state, mutated every frame by updatePins().
    anim: {
      color: stateColor(record.state),
      glow: 0,
      lift: 0,
      beam: 0,
      opacity: 1,
      dim: 0
    }
  };
}

/**
 * Frame update for every pin of one board. Values are exponentially damped toward the
 * target assigned by the caller, so interrupted transitions never snap.
 */
export function updatePins(pins, dt, elapsed) {
  for (const pin of pins) {
    const a = pin.anim;
    const phase = (pin.record.index ?? 0) * 0.7;
    a.glow = damp(a.glow, pin.targetGlow ?? 0, HOVER_RATE, dt);
    a.lift = damp(a.lift, pin.targetLift ?? 0, HOVER_RATE, dt);
    a.opacity = damp(a.opacity, pin.targetOpacity ?? 1, 9, dt);
    a.beam = damp(a.beam, pin.targetBeam ?? 0, 12, dt);
    a.dim = damp(a.dim, pin.targetDim ?? 0, 8, dt);

    const base = pin.targetColor;
    const shown = a.dim > 0.001 ? dimColor(base, a.dim) : base;
    a.color.copy(shown);

    const glow = a.glow;
    const sleeve = pin.sleeve.material;
    sleeve.color.copy(shown);
    sleeve.emissive.copy(shown);
    sleeve.emissiveIntensity = 0.18 + glow * 0.95;
    sleeve.opacity = a.opacity;

    const ring = pin.ring.material;
    ring.color.copy(shown);
    ring.emissive.copy(shown);
    ring.emissiveIntensity = 0.3 + glow * 0.9;
    ring.opacity = a.opacity;

    // Hover lift: the whole pin grows a little, which reads clearly even without colour.
    const s = 1 + a.lift * 0.26;
    pin.sleeve.scale.set(s, 1 + a.lift * 0.06, s);
    pin.ring.scale.set(1 + a.lift * 0.34, 1, 1 + a.lift * 0.34);

    const beamOn = a.beam > 0.01;
    pin.beam.visible = beamOn;
    if (beamOn) {
      const pulseAmount = 0.72 + 0.28 * Math.sin(elapsed * 3.1 + phase);
      // Half the old peak: the falloff texture already carries most of the shape, and a beam
      // this narrow only needs to be bright enough to point at the pin, not to light the board.
      pin.beam.material.opacity = a.beam * 0.42 * pulseAmount * a.opacity;
      // Mostly white with a hint of the state colour, so the highlight reads as emitted light
      // while still carrying the pin's colour to anyone who cannot see the state glyph.
      pin.beam.material.color.setRGB(1, 1, 1).lerp(shown, 0.3);
      pin.beam.scale.set(1 + a.lift * 0.2, 1, 1 + a.lift * 0.2);
    }

    const fading = a.opacity < 0.995;
    for (const m of pin.materials) {
      if (m === pin.sleeve.material || m === pin.ring.material) {
        m.transparent = true;
        m.depthWrite = !fading;
        continue;
      }
      if (m.blending === AdditiveBlending) continue;
      m.transparent = fading;
      m.opacity = a.opacity;
      m.depthWrite = !fading;
    }
  }
}

/** Global opacity control, used by the board cross-fade. */
export function setPinGroupOpacity(pins, opacity) {
  const fading = opacity < 0.995;
  for (const pin of pins) {
    const sleeve = pin.sleeve.material;
    sleeve.transparent = true;
    sleeve.opacity = opacity;
    sleeve.depthWrite = !fading;
    const ring = pin.ring.material;
    ring.transparent = true;
    ring.opacity = opacity;
    ring.depthWrite = !fading;
    pin.pad.material.transparent = fading;
    pin.pad.material.opacity = opacity;
    pin.post.material.transparent = fading;
    pin.post.material.opacity = opacity;
    pin.pad.material.depthWrite = !fading;
    pin.post.material.depthWrite = !fading;
  }
}
