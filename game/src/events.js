// Tiny event bus: systems announce things ("crime", "mission-stage",
// "heat-changed") and the HUD, audio and police listen without coupling.
export function createBus() {
  const map = new Map();
  return {
    on(type, fn) {
      if (!map.has(type)) map.set(type, []);
      map.get(type).push(fn);
      return () => { const l = map.get(type); const i = l.indexOf(fn); if (i >= 0) l.splice(i, 1); };
    },
    emit(type, data) {
      const l = map.get(type);
      if (!l) return;
      for (const fn of [...l]) { try { fn(data); } catch (e) { console.error('bus', type, e); } }
    },
  };
}
