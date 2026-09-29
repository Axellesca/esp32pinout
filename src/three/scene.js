/**
 * Renderer, camera, controls, lighting, image-based environment and the render loop.
 *
 * The environment is procedural: RoomEnvironment is prefiltered through PMREMGenerator,
 * so there is no HDR file to download and the repo stays installable offline.
 */

import {
  ACESFilmicToneMapping,
  AmbientLight,
  Color,
  DirectionalLight,
  Fog,
  Group,
  HemisphereLight,
  PCFSoftShadowMap,
  PerspectiveCamera,
  PointLight,
  PMREMGenerator,
  SRGBColorSpace,
  Scene,
  Vector3,
  WebGLRenderer
} from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { CSS2DRenderer } from 'three/examples/jsm/renderers/CSS2DRenderer.js';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import { RectAreaLightUniformsLib } from 'three/examples/jsm/lights/RectAreaLightUniformsLib.js';
import { RectAreaLight } from 'three';
import { Tweener } from './tween.js';

export const HOME = {
  // ~40 degrees of elevation: high enough to read the board as a board, low enough to keep
  // the header pin heights and the component stack legible.
  position: new Vector3(30, 68, 54),
  target: new Vector3(0, 1.5, 0)
};

/** Direction from the orbit target toward the default camera. */
export const HOME_DIR = HOME.position.clone().sub(HOME.target).normalize();

/**
 * Off-vertical angle used by the two axial views, in radians (0.6 degrees).
 *
 * Deliberately not zero. With the camera exactly on the target's vertical axis the orbit basis
 * is degenerate: the world up vector is parallel to the view direction, so the screen-up
 * direction stops being defined and the frame can roll arbitrarily as the camera moves. A hair
 * of tilt keeps the basis well defined while the frame is still unambiguously straight down or
 * straight up - 0.6 degrees is three orders of magnitude inside "top view".
 */
export const AXIAL_TILT = 0.6 * (Math.PI / 180);

/**
 * Camera direction for the two axial views: straight down (and straight up when the board is flipped).
 *
 * The hair of tilt points along +Z, not +X, and that is not cosmetic. OrbitControls derives the
 * screen basis from cross(worldUp, viewDirection), so a tilt toward +X turns the frame a quarter
 * turn: the board comes out portrait with the silkscreen running up the side. Tilting toward +Z
 * keeps the natural reading, the same one the default view has: +X to the right (USB on the left,
 * antenna end on the right) and -Z up, so the left header column is the top row.
 */
export const AXIAL_DIR = new Vector3(0, Math.cos(AXIAL_TILT), Math.sin(AXIAL_TILT)).normalize();

/** Fraction of the half-viewport kept clear around the board when framing it. */
export const FIT_MARGIN = 0.08;

const WORLD_UP = new Vector3(0, 1, 0);
const fitRel = new Vector3();
const fitX = new Vector3();
const fitY = new Vector3();
const fitCorner = new Vector3();

/**
 * Camera distance at which a world-space box fits the viewport with a margin, for a camera that
 * looks at `target` from along the unit vector `dir` (target -> camera).
 *
 * The projected size depends on the distance itself, so this is a fixed-point iteration rather
 * than a closed form: measure how much of the half-viewport the box occupies at the current
 * distance, scale the distance by the ratio, repeat. It converges in two or three passes and
 * settles to well under a percent, which is far tighter than any visible framing difference.
 *
 * This is what keeps a real margin at every aspect ratio. Framing by a fixed distance instead
 * (or by a bounding sphere) fills the frame at 16:10 and then crops it at 4:3 or on a short
 * viewport, which is exactly where the board was ending up a few pixels from the edge.
 */
export function fitDistance(box, target, dir, camera, { margin = FIT_MARGIN, steps = 5 } = {}) {
  const tanV = Math.tan((camera.fov * Math.PI) / 360);
  const tanH = tanV * camera.aspect;
  // Screen basis for this view direction. The axial views are 0.6 degrees off vertical, which
  // is enough for the cross product to be a real direction rather than a rounding artefact.
  fitX.crossVectors(WORLD_UP, dir).normalize();
  fitY.crossVectors(dir, fitX).normalize();

  const min = { x: box.min.x, y: box.min.y, z: box.min.z };
  const max = { x: box.max.x, y: box.max.y, z: box.max.z };
  // Start well outside the box so every iteration is on the far side of the fixed point and the
  // sequence approaches it monotonically.
  let distance = box.min.distanceTo(box.max) * 2 + 20;
  const limit = 1 - margin;

  for (let step = 0; step < steps; step += 1) {
    let fill = 0;
    for (let corner = 0; corner < 8; corner += 1) {
      fitCorner.set(
        corner & 1 ? max.x : min.x,
        corner & 2 ? max.y : min.y,
        corner & 4 ? max.z : min.z
      );
      fitRel.copy(fitCorner).sub(target);
      const depth = distance - fitRel.dot(dir);
      // A corner at or behind the camera plane cannot be fitted by moving further out.
      if (depth <= 0.5) return distance;
      fill = Math.max(fill, Math.abs(fitRel.dot(fitX)) / (depth * tanH));
      fill = Math.max(fill, Math.abs(fitRel.dot(fitY)) / (depth * tanV));
    }
    if (fill <= 0) break;
    distance *= fill / limit;
  }
  return distance;
}

export function createStage(canvasHost, labelHost) {
  const renderer = new WebGLRenderer({
    antialias: true,
    powerPreference: 'high-performance',
    alpha: false
  });
  renderer.outputColorSpace = SRGBColorSpace;
  renderer.toneMapping = ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.02;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = PCFSoftShadowMap;
  canvasHost.appendChild(renderer.domElement);

  const labelRenderer = new CSS2DRenderer();
  labelRenderer.setSize(canvasHost.clientWidth || 1, canvasHost.clientHeight || 1);
  labelHost.appendChild(labelRenderer.domElement);

  const scene = new Scene();
  scene.background = new Color(0x080c12);
  scene.fog = new Fog(0x080c12, 120, 330);

  const camera = new PerspectiveCamera(38, 1, 0.5, 1200);
  camera.position.copy(HOME.position);

  const controls = new OrbitControls(camera, renderer.domElement);
  controls.enableDamping = true;
  controls.dampingFactor = 0.075;
  controls.rotateSpeed = 0.72;
  controls.zoomSpeed = 0.85;
  controls.panSpeed = 0.6;
  controls.minDistance = 22;
  // The far clamp has to clear the distance the fit can ask for on a short or narrow viewport,
  // or the board would be cropped exactly where the fit was supposed to save it.
  controls.maxDistance = 420;
  // The polar clamps exist to keep the user out of the degenerate poles, not to keep them away
  // from a real top view. The old 0.08 rad (4.6 degrees) floor meant no straight-down view could
  // ever be reached by dragging, which is why the top view could only be verified by fighting
  // the clamp. 0.004 rad (0.23 degrees) leaves the orbit basis defined while still allowing a
  // genuinely vertical camera; the two axial views use 0.6 degrees, comfortably inside it.
  controls.minPolarAngle = 0.004;
  controls.maxPolarAngle = Math.PI - 0.004;
  controls.target.copy(HOME.target);
  controls.update();

  // Neutral studio environment for image-based lighting.
  const pmrem = new PMREMGenerator(renderer);
  pmrem.compileEquirectangularShader();
  const room = new RoomEnvironment();
  const envRT = pmrem.fromScene(room, 0.035);
  scene.environment = envRT.texture;
  scene.environmentIntensity = 0.62;
  room.dispose?.();
  pmrem.dispose();

  RectAreaLightUniformsLib.init();

  const lights = new Group();
  lights.name = 'lights';

  // Key light: the only shadow caster, aimed to give the board a readable contact shadow.
  const key = new DirectionalLight(0xfff4e2, 2.35);
  key.position.set(46, 78, 52);
  key.castShadow = true;
  key.shadow.mapSize.set(2048, 2048);
  key.shadow.camera.near = 20;
  key.shadow.camera.far = 240;
  key.shadow.camera.left = -60;
  key.shadow.camera.right = 60;
  key.shadow.camera.top = 60;
  key.shadow.camera.bottom = -60;
  key.shadow.bias = -0.0006;
  key.shadow.normalBias = 0.35;
  key.shadow.radius = 2.2;
  lights.add(key);
  lights.add(key.target);

  // Cool rim from behind, to separate the board edge from the background.
  const rim = new DirectionalLight(0x8fd6ff, 1.35);
  rim.position.set(-58, 30, -66);
  lights.add(rim);

  // Large soft area light acting as the studio softbox over the board.
  const softbox = new RectAreaLight(0xdcecff, 2.1, 120, 70);
  softbox.position.set(0, 62, 26);
  softbox.lookAt(0, 0, 0);
  lights.add(softbox);

  const hemi = new HemisphereLight(0x8fb6d8, 0x0a0d12, 0.55);
  lights.add(hemi);

  const fill = new PointLight(0x9ec8ff, 140, 240, 2);
  fill.position.set(-34, 20, 40);
  lights.add(fill);

  const ambient = new AmbientLight(0x3d5568, 0.5);
  lights.add(ambient);

  scene.add(lights);

  // Ground plane: a large, very dark disc that catches the shadow and grounds the board.
  const ground = new Group();
  ground.name = 'ground';

  const tweener = new Tweener();
  const updaters = new Set();

  // World-space box the camera framing is solved against. The app sets it from the board model
  // once it exists; until then the camera is left wherever it is.
  let frameBox = null;

  /**
   * Re-solve the orbit distance for the current aspect ratio, keeping the direction.
   *
   * Called on every resize, because the distance that frames the board at 16:10 crops it at 4:3
   * and badly at a short viewport. The board keeps its angle and only the distance moves, so the
   * view the user was looking at survives the resize.
   */
  function refitDistance() {
    if (!frameBox || tweener.has('camera')) return;
    const offset = camera.position.clone().sub(controls.target);
    if (offset.lengthSq() < 1e-6) return;
    const distance = fitDistance(frameBox, controls.target, offset.normalize(), camera);
    camera.position
      .copy(controls.target)
      .add(offset.setLength(Math.min(Math.max(distance, controls.minDistance), controls.maxDistance)));
  }

  /**
   * Match the drawing buffer to the host element.
   *
   * Three things matter. `setSize` must be called with updateStyle enabled (the default), or the
   * canvas keeps the CSS size it was given on the first call and every later resize squashes
   * the new buffer into the boot-time box. The pixel ratio is re-read on every resize rather
   * than only at construction, so moving the window to a display with a different
   * devicePixelRatio does not need a reload. And three sizes the buffer as
   * floor(css * pixelRatio), so at a fractional ratio (1.25, 1.5) the buffer comes out up to
   * half a pixel short of the CSS box and the last column or row of the image is lost; the
   * buffer size is rounded here and the ratio fed back as the effective one, which makes the
   * buffer exactly round(css * dpr) while the CSS box stays exactly the host size.
   */
  function resize() {
    const w = canvasHost.clientWidth || 1;
    const h = canvasHost.clientHeight || 1;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const bufferW = Math.max(1, Math.round(w * dpr));
    const bufferH = Math.max(1, Math.round(h * dpr));
    renderer.setPixelRatio(bufferW / w);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
    renderer.setSize(w, h);
    labelRenderer.setSize(w, h);
    refitDistance();
  }

  const onResize = () => resize();
  window.addEventListener('resize', onResize);
  resize();

  let last = performance.now();
  let elapsed = 0;
  let running = true;

  function frame(now) {
    if (!running) return;
    requestAnimationFrame(frame);
    const dt = Math.min(0.05, (now - last) / 1000);
    last = now;
    elapsed += dt;

    tweener.update(now);
    // Camera first: the updaters (pin animation, label declutter) project against it, so they
    // need this frame's camera rather than the previous one.
    controls.update();
    for (const fn of updaters) fn(dt, elapsed);

    renderer.render(scene, camera);
    labelRenderer.render(scene, camera);
  }
  requestAnimationFrame(frame);

  return {
    renderer,
    labelRenderer,
    scene,
    camera,
    controls,
    lights,
    key,
    ground,
    tweener,
    /** World-space box the framing distance is solved against. */
    setFrame(box) {
      frameBox = box;
    },
    onUpdate(fn) {
      updaters.add(fn);
      return () => updaters.delete(fn);
    },
    resize,
    dispose() {
      running = false;
      window.removeEventListener('resize', onResize);
      controls.dispose();
      renderer.dispose();
      envRT.dispose();
    }
  };
}

