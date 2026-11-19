// A tiny event bus: systems announce things (crime committed, mission stage
// done, car stolen) and other systems react, without importing each other.

export function createEvents() {
  const listeners = new Map();
  return {
    on(name, fn) {
      if (!listeners.has(name)) listeners.set(name, []);
      listeners.get(name).push(fn);
    },
    emit(name, data) {
      const list = listeners.get(name);
      if (!list) return;
      for (const fn of list) fn(data);
    },
  };
}
