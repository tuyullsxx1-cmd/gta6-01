// events.js — a tiny synchronous event bus.
// Modules talk to each other through named events instead of importing
// each other directly, which keeps the dependency graph flat.

export function createBus() {
  const handlers = new Map();

  function on(name, fn) {
    if (typeof fn !== 'function') return;
    if (!handlers.has(name)) handlers.set(name, []);
    handlers.get(name).push(fn);
  }

  function off(name, fn) {
    const list = handlers.get(name);
    if (!list) return;
    const idx = list.indexOf(fn);
    if (idx !== -1) list.splice(idx, 1);
    if (list.length === 0) handlers.delete(name);
  }

  function emit(name, data) {
    const list = handlers.get(name);
    if (!list) return;
    // Copy the list so a handler may unsubscribe itself mid-emit.
    for (const fn of list.slice()) fn(data);
  }

  // Remove every listener for one event, or all events when no name given.
  function clear(name) {
    if (name === undefined) handlers.clear();
    else handlers.delete(name);
  }

  function listenerCount(name) {
    const list = handlers.get(name);
    return list ? list.length : 0;
  }

  return { on, off, emit, clear, listenerCount };
}

export default createBus;
