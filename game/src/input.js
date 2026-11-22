// Keyboard + mouse input, with a small queue of pressed keys so systems can
// react to single taps (E, F, Tab, number keys) without polling state.
export function createInput(canvas) {
  const keys = new Set();
  const pressed = [];
  let mouseDX = 0, mouseDY = 0, wheel = 0, mouseDown = false, dragging = false;
  let lastX = 0, lastY = 0;

  const onKeyDown = (e) => {
    if (e.repeat) return;
    keys.add(e.code);
    pressed.push(e.code);
    if (['Tab', 'Space'].includes(e.code)) e.preventDefault();
  };
  const onKeyUp = (e) => keys.delete(e.code);
  const onMouseDown = (e) => { mouseDown = true; dragging = true; lastX = e.clientX; lastY = e.clientY; };
  const onMouseMove = (e) => {
    if (!dragging) return;
    mouseDX += e.clientX - lastX; mouseDY += e.clientY - lastY;
    lastX = e.clientX; lastY = e.clientY;
  };
  const onMouseUp = () => { mouseDown = false; dragging = false; };
  const onWheel = (e) => { wheel += e.deltaY; e.preventDefault(); };

  window.addEventListener('keydown', onKeyDown);
  window.addEventListener('keyup', onKeyUp);
  canvas.addEventListener('mousedown', onMouseDown);
  window.addEventListener('mousemove', onMouseMove);
  window.addEventListener('mouseup', onMouseUp);
  canvas.addEventListener('wheel', onWheel, { passive: false });

  return {
    keys,
    down(code) { return keys.has(code); },
    axis() {
      // WASD as -1..1 axes, in screen space.
      let x = 0, y = 0;
      if (keys.has('KeyA')) x -= 1;
      if (keys.has('KeyD')) x += 1;
      if (keys.has('KeyW')) y += 1;
      if (keys.has('KeyS')) y -= 1;
      return { x, y };
    },
    consumePressed() { const out = pressed.splice(0, pressed.length); return out; },
    consumeMouse() { const d = { dx: mouseDX, dy: mouseDY, wheel }; mouseDX = 0; mouseDY = 0; wheel = 0; return d; },
    mouseDown() { return mouseDown; },
    // Test hooks: the in-page self-test drives the game through these.
    inject(code) { keys.add(code); pressed.push(code); },
    release(code) { keys.delete(code); },
    releaseAll() { keys.clear(); },
  };
}
