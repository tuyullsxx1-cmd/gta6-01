// input.js — keyboard and mouse input.
// Tracks which keys are held, which were just pressed this frame
// (edge detection), and mouse drag / wheel deltas. Attaches to window
// events; call detach() to remove the listeners.

export function createInput() {
  const down = new Set();
  const justPressed = new Set();
  let dragX = 0;
  let dragY = 0;
  let wheel = 0;
  let dragging = false;
  let lastX = 0;
  let lastY = 0;
  let attached = false;

  function onKeyDown(e) {
    if (e.repeat) return;
    down.add(e.code);
    justPressed.add(e.code);
  }

  function onKeyUp(e) {
    down.delete(e.code);
  }

  function onMouseDown(e) {
    dragging = true;
    lastX = e.clientX;
    lastY = e.clientY;
  }

  function onMouseMove(e) {
    if (!dragging) return;
    dragX += e.clientX - lastX;
    dragY += e.clientY - lastY;
    lastX = e.clientX;
    lastY = e.clientY;
  }

  function onMouseUp() {
    dragging = false;
  }

  function onWheel(e) {
    wheel += e.deltaY;
  }

  function onBlur() {
    // Losing the window clears held keys so the player never gets stuck
    // moving after alt-tabbing away.
    down.clear();
    dragging = false;
  }

  function attach(target) {
    if (attached) return;
    const el = target || (typeof window !== 'undefined' ? window : null);
    if (!el) return;
    el.addEventListener('keydown', onKeyDown);
    el.addEventListener('keyup', onKeyUp);
    el.addEventListener('mousedown', onMouseDown);
    el.addEventListener('mousemove', onMouseMove);
    el.addEventListener('mouseup', onMouseUp);
    el.addEventListener('wheel', onWheel);
    el.addEventListener('blur', onBlur);
    attached = true;
  }

  function detach(target) {
    const el = target || (typeof window !== 'undefined' ? window : null);
    if (!el || !attached) return;
    el.removeEventListener('keydown', onKeyDown);
    el.removeEventListener('keyup', onKeyUp);
    el.removeEventListener('mousedown', onMouseDown);
    el.removeEventListener('mousemove', onMouseMove);
    el.removeEventListener('mouseup', onMouseUp);
    el.removeEventListener('wheel', onWheel);
    el.removeEventListener('blur', onBlur);
    attached = false;
  }

  // True while the key is held down.
  function isDown(code) {
    return down.has(code);
  }

  // True only on the frame the key went down (edge detection).
  function pressed(code) {
    return justPressed.has(code);
  }

  // -1/0/1 movement axis from WASD (or arrow keys).
  function moveAxis() {
    let x = 0;
    let y = 0;
    if (down.has('KeyA') || down.has('ArrowLeft')) x -= 1;
    if (down.has('KeyD') || down.has('ArrowRight')) x += 1;
    if (down.has('KeyW') || down.has('ArrowUp')) y += 1;
    if (down.has('KeyS') || down.has('ArrowDown')) y -= 1;
    return { x, y };
  }

  // Consume the accumulated mouse drag since the last frame.
  function consumeDrag() {
    const out = { x: dragX, y: dragY };
    dragX = 0;
    dragY = 0;
    return out;
  }

  // Consume the accumulated wheel delta since the last frame.
  function consumeWheel() {
    const out = wheel;
    wheel = 0;
    return out;
  }

  // Call once per frame after the game has read inputs: clears the
  // just-pressed set so pressed() only fires on the first frame.
  function endFrame() {
    justPressed.clear();
  }

  return {
    attach,
    detach,
    isDown,
    pressed,
    moveAxis,
    consumeDrag,
    consumeWheel,
    endFrame,
  };
}

export default createInput;
