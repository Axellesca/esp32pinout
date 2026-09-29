/**
 * Procedural 3D board model. No external assets: every mesh is a Three.js primitive and
 * every texture is drawn at runtime on a <canvas>.
 *
 * Units are millimetres and the PCB top surface sits at y = 0, so component heights read
 * directly off the layout table. The board is 51.6 x 28.4 mm (see the size ambiguity
 * disclosure in boards.js).
 */

import {
  BoxGeometry,
  CanvasTexture,
  CircleGeometry,
  Color,
  CylinderGeometry,
  DoubleSide,
  ExtrudeGeometry,
  Group,
  LinearFilter,
  Mesh,
  MeshPhysicalMaterial,
  MeshStandardMaterial,
  PlaneGeometry,
  SRGBColorSpace,
  Shape
} from 'three';
import { createLabel, createPinMesh, updateLabel } from './pinMeshes.js';

/** Physical layout of the modelled board, in millimetres. */
export const LAYOUT = {
  pitch: 2.54,
  headerZ: 11.4,
  housingLength: 40.0,
  housingDepth: 2.54,
  housingHeight: 2.5,
  pinStartX: -((15 - 1) * 2.54) / 2,
  module: {
    // The carrier sits at the antenna end of the host board with its antenna tip FLUSH to the
    // PCB edge: pcbLength (25.5) added to x0 must equal the half width (25.8). The antenna is
    // a printed edge feature and needs the board edge as its ground reference, not a 2 mm shelf
    // of air beyond it. Everything on the other half (USB, CP2102, regulator, buttons, LEDs)
    // is at a negative x, so moving the carrier inboard by 2 mm collides with nothing.
    x0: 0.3,
    width: 18.0,
    pcbLength: 25.5,
    pcbThickness: 0.8,
    // The shield can covers the chip section only. On a real ESP-WROOM-32 the can is about
    // 14 mm of the 25.5 mm length, leaving the component strip and the antenna end exposed.
    canLength: 14.0,
    canWidth: 17.2,
    canHeight: 2.35,
    // Distance from the far end of the can to the outer tip: crystal strip plus the printed
    // antenna keep-out.
    antennaLength: 11.5
  },
  usb: { x: -22.05, width: 7.5, depth: 5.0, height: 3.55 },
  cp2102: { x: -13.0, z: -6.5, size: 5.0, height: 0.95 },
  ams1117: { x: -20.0, z: -7.5, len: 6.5, depth: 3.5, height: 1.8, tabLen: 3.4 },
  button: { x1: -19.0, z1: 5.5, x2: -14.5, z2: -1.0, base: 6.2, baseH: 1.2, cap: 3.4, capH: 1.9 },
  s8050: [
    { x: -24.0, z: 5.0 },
    { x: -24.0, z: -5.0 }
  ],
  ledPower: { x: -20.0, z: 1.0 },
  ledGpio2: { x: -20.0, z: -1.5 },
  bulkCap: { x: -15.0, z: 6.5, radius: 3.15, height: 7.0 },
  schottky: { x: -8.0, z: 7.0, len: 2.7, depth: 1.6, height: 1.1 },
  decouplers: [
    { x: -11.0, z: 7.6 },
    { x: -9.2, z: 7.6 }
  ],
  crystalPad: { x: 19.6, z: 0 }
};

const SILK_TEX_W = 2048;

/**
 * Vertical gradient used as the tint of the shield can: bright at the crown, darker down the
 * skirt. Metalness 1 removes all diffuse response, so without a gradient the can reflects a
 * uniformly bright room and reads as a light grey box.
 */
function makeCanGradient() {
  const canvas = makeCanvas(8, 128);
  const ctx = canvas.getContext('2d');
  const grad = ctx.createLinearGradient(0, 0, 0, 128);
  grad.addColorStop(0, '#e9edf1');
  grad.addColorStop(0.55, '#b9c0c6');
  grad.addColorStop(1, '#6d757c');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, 8, 128);
  const tex = new CanvasTexture(canvas);
  tex.colorSpace = SRGBColorSpace;
  return tex;
}

/* ------------------------------------------------------------------ helpers */

function roundedRectShape(width, depth, radius) {
  const w = width / 2;
  const d = depth / 2;
  const r = Math.min(radius, w, d);
  const s = new Shape();
  s.moveTo(-w + r, -d);
  s.lineTo(w - r, -d);
  s.quadraticCurveTo(w, -d, w, -d + r);
  s.lineTo(w, d - r);
  s.quadraticCurveTo(w, d, w - r, d);
  s.lineTo(-w + r, d);
  s.quadraticCurveTo(-w, d, -w, d - r);
  s.lineTo(-w, -d + r);
  s.quadraticCurveTo(-w, -d, -w + r, -d);
  return s;
}

function boxGeo(w, h, d) {
  return new BoxGeometry(w, h, d);
}

/* --------------------------------------------------- silkscreen generation */

function makeCanvas(width, height) {
  const c = document.createElement('canvas');
  c.width = width;
  c.height = height;
  return c;
}

/**
 * Draw the top silkscreen layer. Component outlines, reference designators, board title
 * and the per-pin labels for the active silkscreen convention.
 *
 * Orientation, verified rather than assumed. The overlay plane is a PlaneGeometry rotated
 * -90 degrees about X, so its local +Y (texture v = 1, the top row of the canvas) points at
 * world -Z and its local +X (texture u = 1) points at world +X. Mapping world x to canvas x
 * and world z to canvas y therefore puts the printing the right way up when the board is
 * read from above with the USB connector on the left: the board title reads left to right
 * along +X, and the pin labels read in header order along each column. This was checked by
 * rendering a frame from directly above and reading the title and the pin labels, not by
 * reading the code. The earlier comment in this file claimed the same thing on the strength
 * of a rendered frame, which is not a check anybody can repeat; the mapping below is the one
 * that renders correctly.
 */
function drawSilkscreen(canvas, board, style, records, pcb) {
  const w = canvas.width;
  const h = canvas.height;
  const s = w / pcb.width;
  const ctx = canvas.getContext('2d');
  ctx.clearRect(0, 0, w, h);
  // Board millimetres to canvas pixels. See the orientation note above.
  const X = (x) => (x + pcb.width / 2) * s;
  const Z = (z) => (z + pcb.depth / 2) * s;
  const M = (v) => v * s;

  ctx.strokeStyle = board.silk.color;
  ctx.fillStyle = board.silk.color;
  ctx.lineJoin = 'round';
  ctx.lineCap = 'round';

  // Board edge outline, inset like a real silkscreen keep-out.
  ctx.globalAlpha = 0.55;
  ctx.lineWidth = M(0.22);
  const inset = 0.8;
  ctx.strokeRect(
    X(-pcb.width / 2 + inset),
    Z(-pcb.depth / 2 + inset),
    M(pcb.width - inset * 2),
    M(pcb.depth - inset * 2)
  );
  ctx.globalAlpha = 1;

  // Header pad rings and their labels.
  const labelFont = `600 ${Math.round(M(1.45))}px ui-monospace, Consolas, monospace`;
  for (const rec of records) {
    const pos = headerPosition(rec);
    ctx.globalAlpha = 0.6;
    ctx.lineWidth = M(0.16);
    ctx.beginPath();
    ctx.arc(X(pos.x), Z(pos.z), M(1.75), 0, Math.PI * 2);
    ctx.stroke();
    ctx.globalAlpha = 1;

    const silk = rec.silks[style] ?? rec.silks.clone;
    ctx.font = labelFont;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    // Labels sit between the two header rows, reading along the board.
    const inward = rec.side === 'left' ? 3.1 : -3.1;
    ctx.fillText(silk, X(pos.x), Z(pos.z + inward));
  }

  // Component outlines.
  const outline = (cx, cz, cw, cd, r = 0.5) => {
    ctx.globalAlpha = 0.5;
    ctx.lineWidth = M(0.18);
    ctx.beginPath();
    ctx.roundRect
      ? ctx.roundRect(X(cx - cw / 2), Z(cz - cd / 2), M(cw), M(cd), M(r))
      : ctx.rect(X(cx - cw / 2), Z(cz - cd / 2), M(cw), M(cd));
    ctx.stroke();
    ctx.globalAlpha = 1;
  };

  outline(LAYOUT.usb.x, 0, LAYOUT.usb.width, LAYOUT.usb.depth, 0.6);
  outline(LAYOUT.cp2102.x, LAYOUT.cp2102.z, LAYOUT.cp2102.size, LAYOUT.cp2102.size);
  outline(
    LAYOUT.ams1117.x,
    LAYOUT.ams1117.z,
    LAYOUT.ams1117.len,
    LAYOUT.ams1117.depth
  );
  outline(LAYOUT.button.x1, LAYOUT.button.z1, LAYOUT.button.base, LAYOUT.button.base);
  outline(LAYOUT.button.x2, LAYOUT.button.z2, LAYOUT.button.base, LAYOUT.button.base);
  for (const t of LAYOUT.s8050) outline(t.x, t.z, 2.9, 1.3, 0.2);
  for (const d of LAYOUT.decouplers) outline(d.x, d.z, 1.6, 1.0, 0.15);
  outline(LAYOUT.schottky.x, LAYOUT.schottky.z, LAYOUT.schottky.len, LAYOUT.schottky.depth, 0.2);
  ctx.beginPath();
  ctx.arc(X(LAYOUT.bulkCap.x), Z(LAYOUT.bulkCap.z), M(LAYOUT.bulkCap.radius + 0.5), 0, Math.PI * 2);
  ctx.stroke();
  ctx.beginPath();
  ctx.arc(X(LAYOUT.ledPower.x), Z(LAYOUT.ledPower.z), M(1.4), 0, Math.PI * 2);
  ctx.stroke();
  ctx.beginPath();
  ctx.arc(X(LAYOUT.ledGpio2.x), Z(LAYOUT.ledGpio2.z), M(1.4), 0, Math.PI * 2);
  ctx.stroke();

  // Module outline and reference designators.
  const m = LAYOUT.module;
  outline(m.x0 + m.pcbLength / 2, 0, m.pcbLength, m.width, 0.4);
  ctx.globalAlpha = 0.38;
  ctx.lineWidth = M(0.14);
  ctx.beginPath();
  ctx.moveTo(X(m.x0 + m.canLength), Z(-m.width / 2 + 0.4));
  ctx.lineTo(X(m.x0 + m.canLength), Z(m.width / 2 - 0.4));
  ctx.stroke();
  ctx.globalAlpha = 1;

  const text = (str, x, z, size, alpha = 0.8, align = 'center') => {
    ctx.globalAlpha = alpha;
    ctx.font = `600 ${Math.round(M(size))}px ui-monospace, Consolas, monospace`;
    ctx.textAlign = align;
    ctx.textBaseline = 'middle';
    ctx.fillText(str, X(x), Z(z));
    ctx.globalAlpha = 1;
  };

  text(board.module.name, m.x0 + m.canLength / 2, -3.4, 1.7, 0.62);
  text(board.usbUart.label, LAYOUT.cp2102.x + 3.6, LAYOUT.cp2102.z, 1.25, 0.7);
  text(board.regulator.label, LAYOUT.ams1117.x, LAYOUT.ams1117.z + 3.3, 1.15, 0.62);
  text('EN', LAYOUT.button.x1, LAYOUT.button.z1, 1.5, 0.75);
  text('BOOT', LAYOUT.button.x2, LAYOUT.button.z2, 1.5, 0.75);
  text('PWR', LAYOUT.ledPower.x, LAYOUT.ledPower.z + 1.7, 1.0, 0.6);
  text('L2', LAYOUT.ledGpio2.x, LAYOUT.ledGpio2.z - 1.7, 1.0, 0.6);
  text('C1', LAYOUT.bulkCap.x, LAYOUT.bulkCap.z, 1.0, 0.5);

  // Board title, printed where a real board carries it: near the USB end.
  ctx.save();
  ctx.translate(X(-11.5), Z(-9.2));
  ctx.font = `700 ${Math.round(M(2.1))}px ui-monospace, Consolas, monospace`;
  ctx.textAlign = 'left';
  ctx.textBaseline = 'middle';
  ctx.globalAlpha = 0.85;
  ctx.fillText(board.name, 0, 0);
  ctx.restore();
  text('WiFi + Bluetooth', -11.5, -6.6, 1.25, 0.55, 'left');

  // Stylised logo block so the silkscreen does not look empty in the gap.
  ctx.globalAlpha = 0.4;
  ctx.lineWidth = M(0.2);
  ctx.beginPath();
  ctx.moveTo(X(-4.5), Z(-8.6));
  ctx.lineTo(X(1.2), Z(-8.6));
  ctx.moveTo(X(-4.5), Z(-8.6));
  ctx.lineTo(X(-4.5), Z(-4.6));
  ctx.moveTo(X(-3.4), Z(-8.6));
  ctx.lineTo(X(-3.4), Z(-5.9));
  ctx.stroke();
  ctx.globalAlpha = 1;
}

/**
 * Underside silkscreen: board name and revision block, readable from below.
 *
 * The bottom overlay plane is rotated +90 degrees about X, so its local +Y (texture v = 1,
 * the top row of the canvas) points at world +Z: the Z axis runs the opposite way to the top
 * layer. Z is therefore mirrored about the canvas centre here. Without the mirror the block
 * lands on the wrong side of the board and the lines come out in reverse order.
 *
 * The CONTENT is still an approximation: the real underside printing differs between
 * manufacturers and revisions, and it could not be verified against a board photograph. Only
 * the orientation is exact.
 */
function drawBottomSilk(canvas, board, pcb) {
  const w = canvas.width;
  const h = canvas.height;
  const s = w / pcb.width;
  const ctx = canvas.getContext('2d');
  ctx.clearRect(0, 0, w, h);

  const X = (x) => (x + pcb.width / 2) * s;
  const Z = (z) => h - (z + pcb.depth / 2) * s;
  const M = (v) => v * s;

  ctx.strokeStyle = board.silk.color;
  ctx.fillStyle = board.silk.color;
  ctx.lineJoin = 'round';
  ctx.globalAlpha = 0.5;
  ctx.lineWidth = M(0.22);
  ctx.strokeRect(
    X(-pcb.width / 2 + 0.8),
    Z(-pcb.depth / 2 + 0.8),
    M(pcb.width - 1.6),
    M(pcb.depth - 1.6)
  );
  ctx.globalAlpha = 0.34;
  ctx.lineWidth = M(0.16);
  ctx.beginPath();
  ctx.arc(X(-18.5), Z(0), M(1.6), 0, Math.PI * 2);
  ctx.arc(X(15.0), Z(0), M(1.6), 0, Math.PI * 2);
  ctx.stroke();
  ctx.globalAlpha = 0.75;
  ctx.font = `700 ${Math.round(M(2.0))}px ui-monospace, Consolas, monospace`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(board.name, X(0), Z(-4.5));
  ctx.globalAlpha = 0.5;
  ctx.font = `600 ${Math.round(M(1.2))}px ui-monospace, Consolas, monospace`;
  ctx.fillText('REV 1.0', X(0), Z(-1.6));
  ctx.fillText(board.module.name, X(0), Z(1.4));
  ctx.globalAlpha = 1;
}

/** Position of a header record in board coordinates. */
export function headerPosition(record) {
  const z = record.side === 'left' ? -LAYOUT.headerZ : LAYOUT.headerZ;
  return { x: LAYOUT.pinStartX + record.index * LAYOUT.pitch, z };
}

/* ------------------------------------------------------------ board model */

function standard(color, opts = {}) {
  return new MeshStandardMaterial({
    color,
    roughness: 0.55,
    metalness: 0.12,
    transparent: true,
    ...opts
  });
}

/**
 * Build one board instance. Returns the group plus the handles the app needs: the pin
 * objects, the flip/explode targets and the material list used for cross-fading.
 */
export function createBoardModel({ board, style, records }) {
  const pcb = board.pcb;
  const content = new Group();
  content.name = `board:${board.id}`;

  const materials = [];
  const track = (m) => {
    materials.push(m);
    return m;
  };

  /* ---- PCB body ---- */

  // ExtrudeGeometry places its bevel OUTSIDE the [0, depth] range, so the solid spans
  // [-bevel, depth + bevel]. The extrude depth is reduced by the two bevels and the mesh is
  // offset so the finished top surface lands exactly on y = 0. Getting this wrong buries the
  // silkscreen plane inside the board.
  const BEVEL = 0.14;
  const extrudeDepth = pcb.thickness - BEVEL * 2;
  const shape = roundedRectShape(pcb.width, pcb.depth, 2.2);
  const pcbGeo = new ExtrudeGeometry(shape, {
    depth: extrudeDepth,
    bevelEnabled: true,
    bevelThickness: BEVEL,
    bevelSize: 0.16,
    bevelSegments: 2,
    curveSegments: 6
  });
  pcbGeo.rotateX(-Math.PI / 2);
  const pcbMat = track(
    new MeshPhysicalMaterial({
      color: new Color(pcb.color),
      roughness: pcb.roughness,
      metalness: 0.06,
      clearcoat: 0.35,
      clearcoatRoughness: 0.5,
      transparent: true
    })
  );
  const pcbMesh = new Mesh(pcbGeo, pcbMat);
  pcbMesh.position.y = -(extrudeDepth + BEVEL);
  pcbMesh.castShadow = true;
  pcbMesh.receiveShadow = true;
  content.add(pcbMesh);

  /* ---- silkscreen layers ---- */

  const texH = Math.round((SILK_TEX_W * pcb.depth) / pcb.width);
  const topCanvas = makeCanvas(SILK_TEX_W, texH);
  const bottomCanvas = makeCanvas(SILK_TEX_W, texH);

  const topTex = new CanvasTexture(topCanvas);
  topTex.colorSpace = SRGBColorSpace;
  topTex.anisotropy = 8;
  topTex.minFilter = LinearFilter;
  const topMat = track(
    new MeshStandardMaterial({
      map: topTex,
      // Silkscreen ink is reflective paint, not a light source. A small emissive contribution
      // keyed to the same texture keeps the printing legible in the dark studio lighting
      // without washing out the PCB itself.
      emissive: 0xffffff,
      emissiveMap: topTex,
      emissiveIntensity: 0.6,
      transparent: true,
      roughness: 0.72,
      metalness: 0,
      depthWrite: false,
      side: DoubleSide
    })
  );
  const topGeo = new PlaneGeometry(pcb.width, pcb.depth);
  topGeo.rotateX(-Math.PI / 2);
  const topMesh = new Mesh(topGeo, topMat);
  topMesh.position.y = 0.004;
  topMesh.renderOrder = 1;
  content.add(topMesh);

  const bottomTex = new CanvasTexture(bottomCanvas);
  bottomTex.colorSpace = SRGBColorSpace;
  bottomTex.anisotropy = 8;
  bottomTex.minFilter = LinearFilter;
  const bottomMat = track(
    new MeshStandardMaterial({
      map: bottomTex,
      emissive: 0xffffff,
      emissiveMap: bottomTex,
      emissiveIntensity: 0.3,
      transparent: true,
      roughness: 0.72,
      metalness: 0,
      depthWrite: false,
      side: DoubleSide
    })
  );
  const bottomGeo = new PlaneGeometry(pcb.width, pcb.depth);
  bottomGeo.rotateX(Math.PI / 2);
  const bottomMesh = new Mesh(bottomGeo, bottomMat);
  bottomMesh.position.y = -pcb.thickness - 0.004;
  bottomMesh.renderOrder = 1;
  content.add(bottomMesh);

  function paint(style) {
    drawSilkscreen(topCanvas, board, style, records, pcb);
    drawBottomSilk(bottomCanvas, board, pcb);
    topTex.needsUpdate = true;
    bottomTex.needsUpdate = true;
  }
  paint(style);

  /* ---- header housings ---- */

  const housingMat = track(standard(0x0d0f12, { roughness: 0.75, metalness: 0.02 }));
  const housings = {};
  for (const side of ['left', 'right']) {
    const z = side === 'left' ? -LAYOUT.headerZ : LAYOUT.headerZ;
    const mesh = new Mesh(
      boxGeo(LAYOUT.housingLength, LAYOUT.housingHeight, LAYOUT.housingDepth),
      housingMat
    );
    mesh.position.set(0, LAYOUT.housingHeight / 2, z);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    content.add(mesh);
    housings[side] = mesh;
  }

  /* ---- pins ---- */

  const pins = [];
  const labelObjects = new Map();
  for (const rec of records) {
    const { el, object } = createLabel(rec, rec.silks[style] ?? rec.silks.clone);
    labelObjects.set(rec.key, { el, object });
    const pos = headerPosition(rec);
    const pin = createPinMesh(rec, { x: pos.x, y: 0, z: pos.z }, object);
    content.add(pin.group);
    pins.push(pin);
  }

  /* ---- components ---- */

  // Every part is registered with a lift height so the explode view can separate them.
  const parts = [];
  const addPart = (mesh, lift, order) => {
    mesh.userData.baseY = mesh.position.y;
    mesh.userData.lift = lift;
    mesh.userData.order = order;
    parts.push(mesh);
    return mesh;
  };

  const silver = track(standard(0xc9d0d6, { roughness: 0.28, metalness: 0.92 }));
  const darkPlastic = track(standard(0x14171c, { roughness: 0.68, metalness: 0.03 }));
  const epoxy = track(standard(0x0e1013, { roughness: 0.42, metalness: 0.05 }));
  const alu = track(standard(0x9aa2ab, { roughness: 0.34, metalness: 0.88 }));
  const gold = track(standard(0xd9b558, { roughness: 0.3, metalness: 0.95 }));
  // The WROOM-32 shield can is a tin-plated steel lid, so it is a real metal: fully metallic
  // and smooth enough to pick up the RoomEnvironment as a specular highlight. A flat mirror
  // reflecting a uniformly bright room still reads as grey plastic, so the lid also carries a
  // vertical gradient tint (bright crown, darker skirt) the way a stamped can does, and the
  // envMapIntensity is lifted a little because the IBL is all a metal has to work with here.
  const canMat = track(
    new MeshStandardMaterial({
      color: 0xffffff,
      map: makeCanGradient(),
      roughness: 0.19,
      metalness: 1.0,
      envMapIntensity: 1.9,
      transparent: true
    })
  );
  // The module carrier board is the light cream/white laminate of a real WROOM-32, not the
  // dark green of the host PCB: that contrast is what makes the module read as a separate
  // part sitting on the board.
  const modulePcbMat = track(standard(0xded7c2, { roughness: 0.62, metalness: 0.04 }));

  let order = 0;

  // Micro-USB connector on the short edge opposite the antenna.
  const usb = LAYOUT.usb;
  const usbShell = new Mesh(boxGeo(usb.width, usb.height, usb.depth), silver);
  usbShell.position.set(usb.x, usb.height / 2, 0);
  usbShell.castShadow = true;
  addPart(usbShell, 9, order++);
  content.add(usbShell);

  const usbMouth = new Mesh(boxGeo(0.5, usb.height * 0.62, usb.depth * 0.8), darkPlastic);
  usbMouth.position.set(usb.x - usb.width / 2 - 0.05, usb.height * 0.46, 0);
  addPart(usbMouth, 9, order++);
  content.add(usbMouth);

  const usbTongue = new Mesh(boxGeo(2.6, 0.5, usb.depth * 0.66), darkPlastic);
  usbTongue.position.set(usb.x - usb.width / 2 + 1.5, usb.height * 0.3, 0);
  addPart(usbTongue, 9, order++);
  content.add(usbTongue);

  // CP2102 USB-UART bridge, QFN.
  const qfn = LAYOUT.cp2102;
  const cp = new Mesh(boxGeo(qfn.size, qfn.height, qfn.size), epoxy);
  cp.position.set(qfn.x, qfn.height / 2, qfn.z);
  addPart(cp, 5.5, order++);
  content.add(cp);
  const pin1 = new Mesh(new CircleGeometry(0.42, 14), track(standard(0x4a5158, { roughness: 0.5 })));
  pin1.rotation.x = -Math.PI / 2;
  pin1.position.set(qfn.x - 1.8, qfn.height + 0.01, qfn.z - 1.8);
  addPart(pin1, 5.5, order++);
  content.add(pin1);

  // AMS1117-3.3 LDO, SOT-223 with its tab.
  const ldo = LAYOUT.ams1117;
  const reg = new Mesh(boxGeo(ldo.len, ldo.height, ldo.depth), epoxy);
  reg.position.set(ldo.x, ldo.height / 2, ldo.z);
  addPart(reg, 4.5, order++);
  content.add(reg);
  const tab = new Mesh(boxGeo(ldo.tabLen, 0.22, ldo.depth + 0.4), alu);
  tab.position.set(ldo.x + 1.4, 0.11, ldo.z);
  addPart(tab, 4.5, order++);
  content.add(tab);

  // EN and BOOT tactile buttons.
  const b = LAYOUT.button;
  const addButton = (x, z, capColor) => {
    const base = new Mesh(boxGeo(b.base, b.baseH, b.base), darkPlastic);
    base.position.set(x, b.baseH / 2, z);
    addPart(base, 7.5, order++);
    content.add(base);
    const cap = new Mesh(
      boxGeo(b.cap, b.capH, b.cap),
      track(standard(capColor, { roughness: 0.5, metalness: 0.02 }))
    );
    cap.position.set(x, b.baseH + b.capH / 2, z);
    cap.castShadow = true;
    addPart(cap, 10.5, order++);
    content.add(cap);
  };
  addButton(b.x1, b.z1, 0x1a1d22);
  addButton(b.x2, b.z2, 0x1a1d22);

  // Auto-reset S8050 transistors.
  for (const t of LAYOUT.s8050) {
    const tr = new Mesh(boxGeo(2.9, 1.1, 1.3), epoxy);
    tr.position.set(t.x, 0.55, t.z);
    addPart(tr, 3.2, order++);
    content.add(tr);
  }

  // Power LED and the GPIO2 LED.
  const addLed = (pos, color, intensity) => {
    const body = new Mesh(boxGeo(2.0, 0.9, 1.2), track(standard(0x20242a, { roughness: 0.6 })));
    body.position.set(pos.x, 0.45, pos.z);
    addPart(body, 3.6, order++);
    content.add(body);
    const lens = new Mesh(
      boxGeo(1.0, 0.8, 1.25),
      track(
        new MeshStandardMaterial({
          color,
          emissive: color,
          emissiveIntensity: intensity,
          roughness: 0.25,
          metalness: 0,
          transparent: true
        })
      )
    );
    lens.position.set(pos.x, 1.25, pos.z);
    addPart(lens, 3.6, order++);
    content.add(lens);
    return lens;
  };
  addLed(LAYOUT.ledPower, board.leds.power, 1.6);
  const gpio2Led = addLed(LAYOUT.ledGpio2, board.leds.gpio2, 1.1);
  const ledMeshes = [gpio2Led];

  // 100 uF bulk capacitor.
  const bc = LAYOUT.bulkCap;
  const can = new Mesh(
    new CylinderGeometry(bc.radius, bc.radius, bc.height, 22, 1),
    alu
  );
  can.position.set(bc.x, bc.height / 2, bc.z);
  can.castShadow = true;
  addPart(can, 6.5, order++);
  content.add(can);
  const canTop = new Mesh(
    new CylinderGeometry(bc.radius * 0.98, bc.radius * 0.98, 0.12, 22, 1),
    track(standard(0x6d747c, { roughness: 0.5, metalness: 0.7 }))
  );
  canTop.position.set(bc.x, bc.height + 0.06, bc.z);
  addPart(canTop, 6.5, order++);
  content.add(canTop);

  // SS14 Schottky steering diode and two decoupling caps.
  const sk = LAYOUT.schottky;
  const diode = new Mesh(boxGeo(sk.len, sk.height, sk.depth), epoxy);
  diode.position.set(sk.x, sk.height / 2, sk.z);
  addPart(diode, 3.2, order++);
  content.add(diode);
  for (const d of LAYOUT.decouplers) {
    const c = new Mesh(boxGeo(1.6, 0.85, 1.0), track(standard(0xb2a06a, { roughness: 0.6, metalness: 0.4 })));
    c.position.set(d.x, 0.42, d.z);
    addPart(c, 3.2, order++);
    content.add(c);
  }

  /* ---- ESP-WROOM-32 module: carrier PCB, shield can, printed antenna ---- */

  // Real proportions: 18.0 x 25.5 x 3.1 mm. The carrier is the full 25.5 mm; the metal can
  // covers the chip section (14 mm) only, and the remaining 11.5 mm at the outer end carries
  // the crystal and the printed trace antenna.
  const m = LAYOUT.module;
  const modPcb = new Mesh(
    boxGeo(m.pcbLength, m.pcbThickness, m.width),
    modulePcbMat
  );
  modPcb.position.set(m.x0 + m.pcbLength / 2, m.pcbThickness / 2, 0);
  modPcb.castShadow = true;
  modPcb.receiveShadow = true;
  addPart(modPcb, 12, order++);
  content.add(modPcb);

  // Shield can: a stamped metal lid. The skirt sits slightly proud of the carrier so the
  // edge catches a highlight, and a flat lid plate on top keeps the top face from reading as
  // a plain box corner.
  const shield = new Mesh(boxGeo(m.canLength, m.canHeight, m.canWidth), canMat);
  shield.position.set(m.x0 + m.canLength / 2, m.pcbThickness + m.canHeight / 2, 0);
  shield.castShadow = true;
  addPart(shield, 17, order++);
  content.add(shield);

  const canLid = new Mesh(boxGeo(m.canLength - 0.9, 0.16, m.canWidth - 0.9), canMat);
  canLid.position.set(m.x0 + m.canLength / 2, m.pcbThickness + m.canHeight + 0.06, 0);
  addPart(canLid, 17, order++);
  content.add(canLid);

  // 40 MHz crystal, in the exposed strip between the can and the antenna.
  const crystal = new Mesh(
    boxGeo(2.6, 0.75, 2.0),
    track(standard(0xb9bcc0, { roughness: 0.18, metalness: 0.9 }))
  );
  const crystalX = m.x0 + m.canLength + 1.5;
  crystal.position.set(crystalX, m.pcbThickness + 0.375, 0);
  addPart(crystal, 14, order++);
  content.add(crystal);

  // Printed antenna: a meander trace on the exposed end of the carrier, with the bare
  // keep-out around it. Drawn as a texture rather than a slab so it reads as a printed
  // antenna instead of a block lying on the module.
  const antLen = m.antennaLength;
  // Canvas matched to the plane's aspect (module length x module width) so the trace is not
  // stretched by the UV mapping.
  const ANT_W = 512;
  const ANT_H = Math.round((ANT_W * (m.width - 0.6)) / (antLen - 0.4));
  const antCanvas = makeCanvas(ANT_W, ANT_H);
  const actx = antCanvas.getContext('2d');
  actx.clearRect(0, 0, ANT_W, ANT_H);
  // Feed line out of the crystal area, then a folded meander running the length of the
  // exposed end. Copper trace on the bare laminate, which is what an antenna end looks like.
  actx.strokeStyle = '#c9a961';
  actx.lineWidth = 12;
  actx.lineJoin = 'round';
  actx.lineCap = 'round';
  actx.beginPath();
  const inset = ANT_W * 0.07;
  const midY = ANT_H / 2;
  const topY = ANT_H * 0.16;
  const botY = ANT_H * 0.84;
  const runs = 5;
  const pitch = (ANT_W - inset * 2 - 40) / runs;
  actx.moveTo(inset, midY);
  actx.lineTo(inset + 20, midY);
  for (let i = 0; i < runs; i += 1) {
    const x0 = inset + 20 + pitch * i;
    actx.lineTo(x0 + 14, i % 2 === 0 ? topY : botY);
    actx.lineTo(x0 + pitch, i % 2 === 0 ? topY : botY);
  }
  actx.stroke();
  const antTex = new CanvasTexture(antCanvas);
  antTex.colorSpace = SRGBColorSpace;
  antTex.anisotropy = 8;
  const antMat = track(
    new MeshStandardMaterial({
      map: antTex,
      transparent: true,
      roughness: 0.42,
      metalness: 0.65,
      envMapIntensity: 1.2,
      depthWrite: false
    })
  );
  const antGeo = new PlaneGeometry(antLen - 0.4, m.width - 0.6);
  antGeo.rotateX(-Math.PI / 2);
  const antMesh = new Mesh(antGeo, antMat);
  antMesh.position.set(m.x0 + m.canLength + antLen / 2, m.pcbThickness + 0.02, 0);
  antMesh.renderOrder = 2;
  antMesh.userData.baseY = antMesh.position.y;
  antMesh.userData.lift = 12;
  antMesh.userData.order = order++;
  parts.push(antMesh);
  content.add(antMesh);

  /* ---- underside pads and the antenna keep-out ground ---- */

  const padMat = track(standard(0xd9b558, { roughness: 0.32, metalness: 0.95 }));
  const underPads = new Group();
  for (const rec of records) {
    if (rec.kind !== 'gpio') continue;
    const pos = headerPosition(rec);
    const p = new Mesh(new CylinderGeometry(1.2, 1.2, 0.12, 16, 1), padMat);
    p.position.set(pos.x, -pcb.thickness - 0.06, pos.z);
    underPads.add(p);
  }
  content.add(underPads);

  /* ---- API ---- */

  let opacity = 1;

  return {
    board,
    style,
    group: content,
    pins,
    ledMeshes,
    labelObjects,
    parts,
    materials,
    // The WROOM-32 carrier, exposed so its placement against the host PCB edge can be measured
    // instead of assumed.
    moduleCarrier: modPcb,
    get opacity() {
      return opacity;
    },
    setOpacity(value) {
      opacity = value;
      const fading = value < 0.995;
      for (const m of materials) {
        m.transparent = true;
        m.opacity = value;
        m.depthWrite = !fading;
        m.visible = value > 0.004;
      }
    },
    setSilkStyle(next) {
      paint(next);
      for (const rec of records) {
        const entry = labelObjects.get(rec.key);
        updateLabel(rec, entry.el, rec.silks[next] ?? rec.silks.clone, [], false);
      }
    }
  };
}

/**
 * A large dark disc under the board that catches the key light's shadow, so the board
 * reads as sitting on a surface rather than floating in a void.
 */
export function createGround(pcb) {
  const group = new Group();
  group.name = 'ground';
  // Large enough that the disc edge falls outside the frame, so the only horizon the viewer
  // ever sees is the fog fading into the background colour.
  const radius = Math.max(pcb.width, pcb.depth) * 6;

  const planeMat = new MeshStandardMaterial({
    color: 0x0a0f16,
    roughness: 0.97,
    metalness: 0.0
  });
  const plane = new Mesh(new CircleGeometry(radius, 96), planeMat);
  plane.rotation.x = -Math.PI / 2;
  plane.position.y = -0.6;
  plane.receiveShadow = true;
  group.add(plane);

  return group;
}

