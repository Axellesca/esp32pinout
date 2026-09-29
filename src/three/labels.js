/**
 * 3D pin label management.
 *
 * Labels are CSS2D elements, so they always face the camera and stay crisp at any zoom.
 * Four things coordinate them:
 *
 *   1. The Labels toggle is authoritative. Labels off means no labels at all, including the
 *      selected and hovered ones. Selection and hover stay readable through the pin itself
 *      (glow, lift and the highlight beam) and through the information panel, which always
 *      shows the selected pin, so nothing depends on a stray label.
 *   2. Interaction state only changes classes: dimmed pins get dimmed labels, the hovered
 *      label is lifted rather than duplicated.
 *   3. A decluttering pass runs every frame. Thirty labels on a 50 mm board collide badly, so
 *      labels are placed in priority order and any label whose box overlaps one already
 *      placed is nudged along the screen's vertical axis to find a clear slot.
 *      Priority is selected, then hovered, then filter matches, then header order.
 *   4. A pin the active filter explicitly matched is never hidden. Two adjacent matches used
 *      to leave the user with a single label and a filter that looked broken, so a matched
 *      label keeps its slot even when nothing is clear: it is placed at the least-bad offset
 *      instead of disappearing. Plain header-order labels still get culled, because that is
 *      what decluttering is for.
 *
 * The offsets are applied through the CSS2DObject's own `center`, which is the element point
 * pinned to the projected 3D point. CSS2D has no depth test, so a label belonging to the buried
 * face of a flipped board would float on top of the visible face; the caller says which face is
 * up and the layer stays empty for the other one.
 */

import { Vector3 } from 'three';
import { marksFor, updateLabel } from './pinMeshes.js';

const tmpVec = new Vector3();
// CSS2DObject.center is (0.5, 1): the projected point is the bottom centre of the element.
const PAD = 4;
// Screen-vertical offsets tried, in pixels, when a label has to move to fit. The ladder is dense
// on purpose: the two header rows are only about 25 px apart at a narrow viewport, so a coarse
// ladder puts a shifted label straight onto the label in the next row. Fine steps let it slip
// between the rows instead. Signs alternate so a run of adjacent matches stacks above and below
// each other rather than all piling on the same side.
const OFFSET_STEPS = [0, 8, -8, 16, -16, 24, -24, 40, -40, 56, -56];
// Priority 2 and below (selected, hovered, matched by the ACTIVE filter) are never culled for
// want of a free slot. Note this only applies while a filter is active: with no filter, isMatch
// is true for every pin and nothing would ever be culled.
const KEEP_PRIORITY = 2;

/** Screen box of a candidate label shifted `offset` pixels DOWN from its anchor. */
function boxFor(candidate, offset) {
  return {
    offset,
    left: candidate.x - candidate.width / 2 - PAD,
    right: candidate.x + candidate.width / 2 + PAD,
    top: candidate.y - candidate.height + offset - PAD,
    bottom: candidate.y + offset + PAD
  };
}

/**
 * Where a candidate can go: the first offset whose box is inside the host and clear of every box
 * already placed, or - if there is none - the least bad of them, flagged as not clear. The
 * caller decides whether a not-clear slot is good enough (it always is for a filter match, and
 * never is for a plain header-order label).
 */
function findSlot(candidate, placed, width, height) {
  let best = null;
  let bestCost = Infinity;
  let bestClear = false;
  for (const offset of OFFSET_STEPS) {
    const box = boxFor(candidate, offset);
    const onHost = box.left >= 0 && box.right <= width && box.top >= 0 && box.bottom <= height;
    let area = 0;
    for (const p of placed) {
      const w = Math.min(box.right, p.right) - Math.max(box.left, p.left);
      const h = Math.min(box.bottom, p.bottom) - Math.max(box.top, p.top);
      if (w > 0 && h > 0) area += w * h;
    }
    if (area === 0 && onHost) return { box, clear: true };
    const cost = area + (onHost ? 0 : 1e7);
    if (cost < bestCost) {
      bestCost = cost;
      best = box;
      bestClear = area === 0;
    }
  }
  return best ? { box: best, clear: bestClear } : null;
}

export function createLabelController() {
  let visible = true;
  // Per-label DOM measurement cache. Reading offsetWidth forces a layout, so it is only done
  // when the label text actually changes.
  const sizes = new Map();
  const signatures = new Map();
  // Boards whose labels are detached on purpose (mid board switch). Their label objects stay
  // invisible even while the model itself is still on screen, otherwise the CSS2D renderer
  // re-appends the detached elements on the very next frame.
  const suppressed = new Set();

  /**
   * Element size, from the DOM when the element is displayed. A label that is currently
   * hidden reports zero, so a zero measurement is never cached: the last known size is kept,
   * and a label that has never been measured falls back to an estimate from its text length.
   */
  function measure(entry) {
    const signature = `${entry.silksText}|${entry.marksKey}`;
    if (signatures.get(entry.el) !== signature) {
      signatures.set(entry.el, signature);
      sizes.delete(entry.el);
    }
    const w = entry.el.offsetWidth;
    const h = entry.el.offsetHeight;
    if (w > 0 && h > 0) {
      sizes.set(entry.el, { w, h });
      return sizes.get(entry.el);
    }
    const known = sizes.get(entry.el);
    if (known) return known;
    return {
      w: (entry.silksText?.length ?? 2) * 6.4 + (entry.marksKey?.length ?? 0) * 6.2 + 16,
      h: 16
    };
  }

  return {
    get visible() {
      return visible;
    },

    /** Rewrite every label of a board instance for the current silkscreen and Wi-Fi state. */
    sync(model, { silk, wifiOn }) {
      for (const pin of model.pins) {
        const rec = pin.record;
        const contested = wifiOn && rec.kind === 'gpio' && rec.data.adc?.unit === 'ADC2';
        const entry = model.labelObjects.get(rec.key);
        const text = rec.silks[silk] ?? rec.silks.clone;
        const marks = marksFor(rec, contested);
        updateLabel(rec, entry.el, text, marks, contested);
        // Cached geometry is now stale for this label.
        entry.silksText = text;
        entry.marksKey = marks.join(' ');
      }
    },

    /** Show or hide the whole label layer without touching the pin geometry. */
    setVisible(model, next) {
      visible = next;
      for (const pin of model.pins) {
        model.labelObjects.get(pin.record.key).object.visible = model.group.visible && next;
      }
    },

    /**
     * Apply interaction classes. `filterActive` false means nothing is dimmed, so the
     * labels are left in their neutral state. Visibility itself is decided by layout().
     */
    applyState(model, { selectedId, hoveredId, filterActive, matchingIds }) {
      for (const pin of model.pins) {
        const rec = pin.record;
        const entry = model.labelObjects.get(rec.key);
        const el = entry.el;
        const isSelected = selectedId === rec.id;
        const isHovered = hoveredId === rec.id;
        const isMatch = !filterActive || (matchingIds ? matchingIds.has(rec.id) : true);

        el.classList.toggle('is-selected', isSelected);
        el.classList.toggle('is-hovered', isHovered);
        el.classList.toggle('is-muted', filterActive && !isMatch);
        el.classList.toggle('is-match', filterActive && isMatch);

        // Hovered and selected labels always win over the filter dimming.
        el.style.opacity = isSelected || isHovered ? '1' : '';
      }
    },

    /**
     * Per-frame declutter. Labels are candidates in priority order; each is kept only if a slot
     * can be found where its box does not overlap a box already placed this frame. Runs every
     * frame so the layout stays readable while the user orbits.
     *
     * `faceUp` is false when the board is turned over: the pin labels belong to the face that is
     * now buried, and CSS2D has no depth test, so they would print straight over the visible
     * underside. The layer stays empty instead.
     */
    layout(
      model,
      camera,
      width,
      height,
      { selectedId, hoveredId, filterActive, matchingIds, faceUp = true }
    ) {
      const boardVisible = model.group.visible && !suppressed.has(model);
      if (!visible || !boardVisible || !faceUp) {
        for (const pin of model.pins) {
          const entry = model.labelObjects.get(pin.record.key);
          entry.object.visible = false;
          entry.object.center.set(0.5, 1);
        }
        return;
      }
      const candidates = [];
      for (const pin of model.pins) {
        const rec = pin.record;
        const entry = model.labelObjects.get(rec.key);
        const isSelected = selectedId === rec.id;
        const isHovered = hoveredId === rec.id;
        // Priority: selected, hovered, matched by the ACTIVE filter, then header order. The
        // filter-active test is deliberate: with no filter every pin "matches", and treating
        // them all as protected would leave the declutter with nothing to cull.
        const isMatch = filterActive && (matchingIds ? matchingIds.has(rec.id) : true);
        const priority = isSelected ? 0 : isHovered ? 1 : isMatch ? 2 : 3;
        const order = rec.side === 'left' ? 0 : 1;
        entry.object.updateWorldMatrix(true, false);
        entry.object.getWorldPosition(tmpVec);
        tmpVec.project(camera);
        const size = measure(entry);
        // Behind the camera, or off the host: nothing to declutter against.
        if (tmpVec.z > 1) {
          entry.object.visible = false;
          continue;
        }
        const x = (tmpVec.x * 0.5 + 0.5) * width;
        const y = (-tmpVec.y * 0.5 + 0.5) * height;
        if (
          x < -size.w ||
          y < -size.h ||
          x > width + size.w ||
          y > height + size.h
        ) {
          entry.object.visible = false;
          continue;
        }
        candidates.push({
          entry,
          priority,
          order,
          index: rec.index ?? 0,
          width: size.w,
          height: size.h,
          x,
          y
        });
      }

      candidates.sort(
        (a, b) =>
          a.priority - b.priority || a.order - b.order || a.index - b.index
      );

      const placed = [];
      for (const c of candidates) {
        const slot = findSlot(c, placed, width, height);
        if (!slot || (!slot.clear && c.priority > KEEP_PRIORITY)) {
          c.entry.object.visible = false;
          c.entry.object.center.set(0.5, 1);
          continue;
        }
        placed.push(slot.box);
        // Offsets are applied through the element's anchor point, not by moving the 3D object, so
        // the label still points at its pin.
        c.entry.object.center.set(0.5, 1 - slot.box.offset / c.height);
        c.entry.object.visible = true;
      }
    },

    /**
     * Detach the labels of a board that is no longer visible.
     *
     * CSS2DRenderer only ever appends a label element to its layer and never removes one, so
     * a board that is hidden or mid-fade would otherwise leave 30 elements behind, stacking
     * duplicate labels on screen. The renderer re-appends them when the board returns.
     *
     * `force` detaches even while the board is still on screen, which is what the board
     * switch needs: the outgoing board's labels go immediately instead of hanging around for
     * the length of the cross-fade, stacked on top of the incoming board's 30 labels.
     */
    detach(model, { force = false } = {}) {
      if (model.group.visible && !force) return false;
      let detached = false;
      for (const pin of model.pins) {
        const entry = model.labelObjects.get(pin.record.key);
        entry.object.visible = false;
        if (entry.el.parentNode) {
          entry.el.remove();
          detached = true;
        }
      }
      return detached;
    },

    /**
     * Keep a board's labels out of the layer even though its model is still visible. Used for
     * the outgoing board of a cross-fade, so its 30 labels go immediately instead of being
     * re-appended by the CSS2D renderer for the length of the transition.
     */
    suppress(model, on) {
      if (on) {
        suppressed.add(model);
        this.detach(model, { force: true });
      } else {
        suppressed.delete(model);
      }
    },

    dispose(model) {
      for (const pin of model.pins) {
        const entry = model.labelObjects.get(pin.record.key);
        entry.object.removeFromParent();
        entry.el.remove();
      }
    }
  };
}
