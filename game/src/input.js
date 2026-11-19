// Keyboard and mouse input. Held keys are read every frame; one-shot presses
// (enter a car, reload, change weapon, radio, pause) are queued as bit flags
// and taken once by the loop, so a press between two frames is never lost.

export const ACTION_CONFIRM = 1;
export const ACTION_PAUSE = 2;
export const ACTION_ENTER = 4;
export const ACTION_WEAPON_NEXT = 8;
export const ACTION_WEAPON_PREV = 16;
export const ACTION_RELOAD = 32;
export const ACTION_RADIO = 64;
export const ACTION_HORN = 128;
export const ACTION_MUTE = 256;
export const ACTION_MAP = 512;

const HELD = new Set([
  'KeyW', 'KeyA', 'KeyS', 'KeyD', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight',
  'ShiftLeft', 'ShiftRight', 'Space', 'KeyE', 'KeyF', 'KeyR', 'KeyQ', 'KeyM', 'KeyC',
]);
const PRESS = new Map([
  ['Enter', ACTION_CONFIRM], ['Space', ACTION_CONFIRM],
  ['KeyP', ACTION_PAUSE], ['Escape', ACTION_PAUSE],
  ['KeyE', ACTION_ENTER],
  ['KeyQ', ACTION_WEAPON_PREV],
  ['KeyR', ACTION_RELOAD],
  ['KeyH', ACTION_HORN],
  ['KeyM', ACTION_MUTE],
  ['Tab', ACTION_MAP],
]);

export function createInput(canvas) {
  const keys = new Set();
  let actions = 0;
  let mouseDown = false;
  let mouseX = 0;
  let mouseY = 0;
  let dragDX = 0;
  let dragDY = 0;
  let wheel = 0;

  window.addEventListener('keydown', (event) => {
    if (HELD.has(event.code)) keys.add(event.code);
    const flag = PRESS.get(event.code);
    if (flag !== undefined && !event.repeat) actions |= flag;
    if (event.code === 'Digit1') actions |= ACTION_WEAPON_PREV;
    if (event.code === 'Digit2') actions |= ACTION_WEAPON_NEXT;
    if (HELD.has(event.code) || PRESS.has(event.code)) event.preventDefault();
  });
  window.addEventListener('keyup', (event) => {
    keys.delete(event.code);
  });
  window.addEventListener('blur', () => {
    keys.clear();
    mouseDown = false;
  });
  canvas.addEventListener('pointerdown', (event) => {
    mouseDown = true;
    mouseX = event.clientX;
    mouseY = event.clientY;
    if (event.button === 0) actions |= ACTION_CONFIRM;
  });
  window.addEventListener('pointerup', () => {
    mouseDown = false;
  });
  window.addEventListener('pointermove', (event) => {
    if (!mouseDown) return;
    dragDX += event.clientX - mouseX;
    dragDY += event.clientY - mouseY;
    mouseX = event.clientX;
    mouseY = event.clientY;
  });
  canvas.addEventListener('wheel', (event) => {
    wheel += event.deltaY;
    event.preventDefault();
  }, { passive: false });
  canvas.addEventListener('contextmenu', (event) => event.preventDefault());

  return {
    /** True while the named code (e.g. 'KeyW') is held. */
    held(code) {
      return keys.has(code);
    },
    /** Forward/back axis: W/Up = +1, S/Down = -1. */
    moveAxis() {
      return (keys.has('KeyW') || keys.has('ArrowUp') ? 1 : 0)
        - (keys.has('KeyS') || keys.has('ArrowDown') ? 1 : 0);
    },
    /** Strafe/steer axis: D/Right = +1, A/Left = -1. */
    strafeAxis() {
      return (keys.has('KeyD') || keys.has('ArrowRight') ? 1 : 0)
        - (keys.has('KeyA') || keys.has('ArrowLeft') ? 1 : 0);
    },
    running() {
      return keys.has('ShiftLeft') || keys.has('ShiftRight');
    },
    jumping() {
      return keys.has('Space');
    },
    mouseDown() {
      return mouseDown;
    },
    /** Mouse drag since the last call, in pixels; resets after reading. */
    takeDrag() {
      const d = { x: dragDX, y: dragDY };
      dragDX = 0;
      dragDY = 0;
      return d;
    },
    /** Wheel delta since the last call; resets after reading. */
    takeWheel() {
      const w = wheel;
      wheel = 0;
      return w;
    },
    /** The one-shot presses since the last call, as ACTION_* flags. */
    takeActions() {
      const taken = actions;
      actions = 0;
      return taken;
    },
  };
}
