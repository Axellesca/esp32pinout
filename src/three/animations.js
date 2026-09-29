/**
 * Camera, board and view animations.
 *
 * Every transition is tween-driven with a real easing curve and is interruptible: a new
 * tween with the same tag cancels the previous one and starts from the current value, so
 * rapid clicking never produces a jump.
 */

import { Vector3 } from 'three';
import { Ease, clamp, lerp } from './tween.js';
import { AXIAL_DIR, fitDistance, HOME, HOME_DIR } from './scene.js';

const UP = new Vector3(0, 1, 0);

/** Ease the camera to a new position/target pair. */
export function tweenCamera(stage, position, target, { duration = 700, ease = Ease.inOutCubic } = {}) {
  const fromPos = stage.camera.position.clone();
  const fromTarget = stage.controls.target.clone();
  stage.controls.enabled = false;
  stage.tweener.to({
    tag: 'camera',
    duration,
    ease,
    onUpdate: (t) => {
      stage.camera.position.lerpVectors(fromPos, position, t);
      stage.controls.target.lerpVectors(fromTarget, target, t);
      stage.controls.update();
    },
    onComplete: () => {
      stage.controls.enabled = true;
    }
  });
}

/**
 * Camera position that frames the board from `dir` with a sensible margin, at whatever aspect
 * ratio the window currently has. The direction is what defines the view; the distance is solved
 * per viewport, which is what stops a short or narrow window from cropping the board.
 */
function framedPosition(stage, box, dir, target) {
  if (!box) return target.clone().add(dir.clone().multiplyScalar(HOME.position.distanceTo(HOME.target)));
  const distance = fitDistance(box, target, dir, stage.camera);
  return target.clone().add(dir.clone().multiplyScalar(distance));
}

function boardTarget(state) {
  return new Vector3(0, 1.5 + (state.exploded ? 4 : 0) * 0.5, 0);
}

export function resetView(stage, state, box) {
  const target = boardTarget(state);
  tweenCamera(stage, framedPosition(stage, box, HOME_DIR, target), target, {
    duration: 760,
    ease: Ease.inOutQuart
  });
}

/**
 * Straight-down view: the camera sits on the board's vertical axis (0.6 degrees off it, see
 * AXIAL_TILT) and looks down at the component side. The distance is fitted, so the whole board
 * keeps its margin instead of running off the edge of a short window.
 */
export function viewTop(stage, state, box) {
  const target = boardTarget(state);
  tweenCamera(stage, framedPosition(stage, box, AXIAL_DIR, target), target, { duration: 720 });
}

/**
 * Underside view.
 *
 * The board is TURNED OVER first (see setView in main.js), which is what makes the bare underside
 * - solder pads, antenna keep-out and the underside silkscreen - the face pointing up at the
 * camera. An earlier version also sent the camera below the board, and the two transforms
 * cancelled out: the user got the component side seen from underneath, and the modelled
 * underside was reachable by no control at all. Keeping the camera above is the only
 * self-consistent reading of "Abajo": flip the board, then look down at the face now facing up.
 * It also means the underside is lit by the key light instead of being lit only by its own
 * emissive silkscreen.
 */
export function viewBottom(stage, state, box) {
  viewTop(stage, state, box);
}

/** Frame a single pin: centre the orbit target on it and pull the camera in. */
export function framePin(stage, worldPos, distance = 26) {
  const dir = stage.camera.position.clone().sub(stage.controls.target).normalize();
  const target = worldPos.clone();
  const pos = target.clone().add(dir.multiplyScalar(distance));
  tweenCamera(stage, pos, target, { duration: 620, ease: Ease.outQuint });
}

/**
 * Tumble the board to show the other face. Rotating about the X axis (the long edge) is
 * the physical action of turning a board over: the two header rows swap sides and the
 * underside faces the camera.
 */
export function flipBoard(stage, model, targetRotation) {
  const from = model.group.rotation.x;
  stage.tweener.to({
    tag: 'flip',
    duration: 900,
    ease: Ease.inOutQuart,
    onUpdate: (t) => {
      model.group.rotation.x = lerp(from, targetRotation, t);
    },
    onComplete: () => {
      model.group.rotation.x = targetRotation;
    }
  });
}

/**
 * Explode view. Components separate vertically with a staggered, per-part easing so the
 * board comes apart in a readable order instead of everything moving at once.
 */
export function explodeBoard(stage, model, amount) {
  const parts = model.parts;
  const maxOrder = parts.reduce((m, p) => Math.max(m, p.userData.order), 0) || 1;
  for (const part of parts) {
    const baseY = part.userData.baseY;
    const lift = part.userData.lift;
    const order = part.userData.order / maxOrder;
    const delay = order * 190;
    stage.tweener.to({
      tag: `explode:${part.uuid}`,
      delay: amount > 0 ? delay : delay * 0.6,
      duration: amount > 0 ? 620 : 520,
      ease: amount > 0 ? Ease.outCubic : Ease.inOutCubic,
      onUpdate: (t) => {
        const eased = amount > 0 ? t : 1 - t;
        part.position.y = baseY + lift * amount * eased;
      }
    });
  }
  // The pin sleeves ride with their header, so extend the pins' visual height slightly.
  for (const pin of model.pins) {
    const group = pin.group;
    const baseY = 0;
    stage.tweener.to({
      tag: `explodePin:${group.uuid}`,
      delay: amount > 0 ? 60 : 30,
      duration: 560,
      ease: amount > 0 ? Ease.outCubic : Ease.inOutCubic,
      onUpdate: (t) => {
        const eased = amount > 0 ? t : 1 - t;
        group.position.y = baseY + 2.4 * amount * eased;
      }
    });
  }
}

/**
 * Board cross-fade. The outgoing board shrinks and fades while the incoming board grows
 * into place, so the transition reads as one object being replaced by another.
 */
export function crossFade(stage, outgoing, incoming, { duration = 620 } = {}) {
  if (outgoing) {
    stage.tweener.to({
      // Distinct tag from the incoming tween: Tweener.to() cancels any tween that shares a
      // tag, so using the same one here would kill the outgoing fade on the very next line.
      tag: 'boardfade-out',
      duration: duration * 0.62,
      ease: Ease.inCubic,
      onUpdate: (t) => {
        const o = 1 - t;
        outgoing.setOpacity(o);
        outgoing.group.scale.setScalar(lerp(1, 0.84, t));
        outgoing.group.visible = o > 0.004;
      },
      onComplete: () => {
        outgoing.setOpacity(0);
        outgoing.group.visible = false;
      }
    });
  }
  incoming.group.visible = true;
  stage.tweener.to({
    tag: 'boardfade-in',
    duration,
    delay: outgoing ? duration * 0.22 : 0,
    ease: Ease.outCubic,
    onUpdate: (t) => {
      incoming.setOpacity(t);
      incoming.group.scale.setScalar(lerp(1.16, 1, t));
    },
    onComplete: () => {
      incoming.setOpacity(1);
      incoming.group.scale.setScalar(1);
    }
  });
}

/**
 * Soft entry for the initial load: the board drops in and the camera settles.
 *
 * The resting camera position is the fitted home framing rather than the fixed literal in HOME,
 * so the app opens with the same margin it keeps after a resize.
 */
export function introAnimation(stage, model, box) {
  model.setOpacity(0);
  model.group.scale.setScalar(1.18);
  model.group.position.y = 14;
  stage.tweener.to({
    duration: 900,
    ease: Ease.outQuint,
    onUpdate: (t) => {
      model.setOpacity(clamp(t * 1.6, 0, 1));
      model.group.scale.setScalar(lerp(1.18, 1, t));
      model.group.position.y = lerp(14, 0, t);
    },
    onComplete: () => {
      model.setOpacity(1);
      model.group.scale.setScalar(1);
      model.group.position.y = 0;
    }
  });
  const rest = framedPosition(stage, box, HOME_DIR, HOME.target);
  stage.tweener.to({
    duration: 1200,
    delay: 120,
    ease: Ease.outQuint,
    onUpdate: (t) => {
      stage.camera.position.lerpVectors(rest.clone().multiplyScalar(1.28), rest, t);
      stage.controls.target.lerpVectors(new Vector3(0, 8, 0), HOME.target, t);
    }
  });
}

export { UP };
