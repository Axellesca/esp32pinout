/**
 * Pointer interaction: raycast hover, click selection and double-click framing.
 *
 * Only the active board instance is pickable, so a mid-transition board can never steal a
 * click. Every pickable object carries `userData.pinId`, which maps straight back to a
 * header record.
 */

import { Raycaster, Vector2 } from 'three';

export function createPointerControls({ stage, getPickables, onHover, onSelect, onFrame }) {
  const raycaster = new Raycaster();
  const pointer = new Vector2();
  const dom = stage.renderer.domElement;

  let hoveredId = null;
  let enabled = true;
  let downPos = null;
  let lastClickTime = 0;

  function updatePointer(event) {
    const rect = dom.getBoundingClientRect();
    pointer.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
    pointer.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
  }

  function pick() {
    raycaster.setFromCamera(pointer, stage.camera);
    const hits = raycaster.intersectObjects(getPickables(), false);
    for (const hit of hits) {
      const id = hit.object.userData.pinId;
      if (id) return { id, point: hit.point, distance: hit.distance };
    }
    return null;
  }

  function onPointerMove(event) {
    if (!enabled) return;
    updatePointer(event);
    const hit = pick();
    const id = hit ? hit.id : null;
    if (id !== hoveredId) {
      hoveredId = id;
      dom.style.cursor = id ? 'pointer' : 'grab';
      onHover(id);
    }
  }

  function onPointerDown(event) {
    downPos = { x: event.clientX, y: event.clientY };
    if (!event.target.closest) dom.style.cursor = hoveredId ? 'pointer' : 'grabbing';
  }

  function onPointerUp(event) {
    if (!enabled || !downPos) return;
    const moved = Math.hypot(event.clientX - downPos.x, event.clientY - downPos.y);
    downPos = null;
    if (moved > 5) return; // it was an orbit drag, not a click

    updatePointer(event);
    const hit = pick();
    if (!hit) {
      onSelect(null);
      return;
    }
    const now = performance.now();
    if (now - lastClickTime < 320) {
      lastClickTime = 0;
      onFrame(hit.id);
    } else {
      lastClickTime = now;
      onSelect(hit.id);
    }
  }

  function onPointerLeave() {
    if (hoveredId !== null) {
      hoveredId = null;
      onHover(null);
    }
  }

  function onDoubleClick(event) {
    if (!enabled) return;
    updatePointer(event);
    const hit = pick();
    if (hit) onFrame(hit.id);
  }

  dom.addEventListener('pointermove', onPointerMove);
  dom.addEventListener('pointerdown', onPointerDown);
  dom.addEventListener('pointerup', onPointerUp);
  dom.addEventListener('pointerleave', onPointerLeave);
  dom.addEventListener('dblclick', onDoubleClick);

  return {
    get hoveredId() {
      return hoveredId;
    },
    setEnabled(next) {
      enabled = next;
      if (!next && hoveredId !== null) {
        hoveredId = null;
        onHover(null);
      }
    },
    /** Force-clear hover, e.g. when the board is swapping underneath the pointer. */
    clearHover() {
      if (hoveredId !== null) {
        hoveredId = null;
        onHover(null);
      }
    },
    dispose() {
      dom.removeEventListener('pointermove', onPointerMove);
      dom.removeEventListener('pointerdown', onPointerDown);
      dom.removeEventListener('pointerup', onPointerUp);
      dom.removeEventListener('pointerleave', onPointerLeave);
      dom.removeEventListener('dblclick', onDoubleClick);
    }
  };
}
