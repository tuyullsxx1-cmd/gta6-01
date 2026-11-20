// render.js — three.js renderer, golden-hour lighting, day-night cycle,
// and the chase camera rig. Maravilla fresh build, written from the prose spec.
import * as THREE from 'three';

// Sky / fog palettes keyed by time of day. Golden hour is the hero look:
// warm amber low sun, peach sky, long soft shadows.
const SKY_STOPS = [
  { minutes: 0, sky: 0x0b1026, fog: 0x0b1026, sun: 0x8fa3ff, sunI: 0.12, hemiI: 0.25 },
  { minutes: 300, sky: 0x1b2340, fog: 0x1b2340, sun: 0x8fa3ff, sunI: 0.12, hemiI: 0.3 },
  { minutes: 360, sky: 0xffb37a, fog: 0xe8a06a, sun: 0xff9a4d, sunI: 1.4, hemiI: 0.55 },
  { minutes: 540, sky: 0x9fd4ff, fog: 0xa8d4e8, sun: 0xfff2d8, sunI: 2.2, hemiI: 0.9 },
  { minutes: 780, sky: 0x8ec8ee, fog: 0x9cc8de, sun: 0xffe9b8, sunI: 2.0, hemiI: 0.85 },
  { minutes: 980, sky: 0xffc98a, fog: 0xf0b070, sun: 0xffb347, sunI: 2.4, hemiI: 0.7 },
  { minutes: 1080, sky: 0xff8e6e, fog: 0xe0785a, sun: 0xff7a3d, sunI: 1.5, hemiI: 0.5 },
  { minutes: 1140, sky: 0x2c2350, fog: 0x2c2350, sun: 0x8fa3ff, sunI: 0.25, hemiI: 0.35 },
  { minutes: 1440, sky: 0x0b1026, fog: 0x0b1026, sun: 0x8fa3ff, sunI: 0.12, hemiI: 0.25 },
];

function lerpStops(minutes) {
  let a = SKY_STOPS[0];
  let b = SKY_STOPS[SKY_STOPS.length - 1];
  for (let i = 0; i < SKY_STOPS.length - 1; i++) {
    if (minutes >= SKY_STOPS[i].minutes && minutes <= SKY_STOPS[i + 1].minutes) {
      a = SKY_STOPS[i];
      b = SKY_STOPS[i + 1];
      break;
    }
  }
  const span = Math.max(1, b.minutes - a.minutes);
  const t = Math.min(1, Math.max(0, (minutes - a.minutes) / span));
  const mix = (ca, cb) => {
    const colA = new THREE.Color(ca);
    const colB = new THREE.Color(cb);
    return colA.lerp(colB, t);
  };
  return {
    sky: mix(a.sky, b.sky),
    fog: mix(a.fog, b.fog),
    sun: mix(a.sun, b.sun),
    sunI: a.sunI + (b.sunI - a.sunI) * t,
    hemiI: a.hemiI + (b.hemiI - a.hemiI) * t,
  };
}

export function createRenderer(canvas) {
  const renderer = new THREE.WebGLRenderer({
    canvas,
    antialias: true,
    powerPreference: 'high-performance',
  });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.05;

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0xffc98a);
  scene.fog = new THREE.Fog(0xf0b070, 180, 720);

  const camera = new THREE.PerspectiveCamera(
    58,
    window.innerWidth / window.innerHeight,
    0.1,
    1400
  );
  camera.position.set(0, 8, -14);

  // Golden-hour sun: warm directional light with shadows.
  const sun = new THREE.DirectionalLight(0xffb347, 2.4);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  sun.shadow.camera.left = -160;
  sun.shadow.camera.right = 160;
  sun.shadow.camera.top = 160;
  sun.shadow.camera.bottom = -160;
  sun.shadow.camera.near = 1;
  sun.shadow.camera.far = 700;
  sun.shadow.bias = -0.0004;
  scene.add(sun);
  scene.add(sun.target);

  // Cool fill from the sky so shadowed faces never go black.
  const hemi = new THREE.HemisphereLight(0xbfd9ff, 0x8a6a4a, 0.7);
  scene.add(hemi);

  // Faint night fill so the city stays readable after dark.
  const moon = new THREE.DirectionalLight(0x8fa3ff, 0.0);
  moon.position.set(-120, 180, -60);
  scene.add(moon);

  // Camera rig state. The rig trails behind the focus (player or car) and
  // slightly above it, so the car sits at roughly 24% of frame height.
  const rig = {
    yaw: Math.PI,
    pitch: 0.32,
    distance: 9.5,
    minDistance: 6,
    maxDistance: 15,
    height: 3.1,
    smooth: 1 - Math.pow(0.0001, 1 / 60),
  };

  let camPos = new THREE.Vector3(0, 8, -14);
  let camLook = new THREE.Vector3(0, 1, 0);

  function applyTimeOfDay(minutes) {
    const pal = lerpStops(minutes);
    scene.background.copy(pal.sky);
    scene.fog.color.copy(pal.fog);
    sun.color.copy(pal.sun);
    sun.intensity = pal.sunI;
    hemi.intensity = pal.hemiI;

    // Sun path: rises at 06:00, sets at 18:00, low warm arc at golden hour.
    const dayFrac = (minutes - 360) / 720; // 0 at dawn, 1 at dusk
    if (dayFrac >= 0 && dayFrac <= 1) {
      const ang = Math.PI * dayFrac;
      const elev = Math.sin(ang);
      const azim = Math.cos(ang);
      sun.position.set(azim * 260, 40 + elev * 260, 120 + azim * 60);
      sun.target.position.set(0, 0, 0);
      moon.intensity = 0;
    } else {
      // Night: sun parked below the horizon, moon takes over dimly.
      sun.position.set(-80, -40, 40);
      sun.intensity = 0.05;
      moon.intensity = 0.35;
    }
    sun.target.updateMatrixWorld();
  }

  function resize() {
    const w = window.innerWidth;
    const h = window.innerHeight;
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
    renderer.setSize(w, h);
  }
  window.addEventListener('resize', resize);

  // focus: { x, z, heading, inCar, speedKmh }
  // orbitDelta: { x, y } mouse-drag deltas for this frame (optional)
  // wheelDelta: zoom steps from the mouse wheel (optional)
  function update(dt, state, focus, orbitDelta, wheelDelta) {
    const minutes = state && state.clock ? state.clock.minutes : 980;
    applyTimeOfDay(minutes);

    if (wheelDelta) {
      rig.distance = Math.min(
        rig.maxDistance,
        Math.max(rig.minDistance, rig.distance + wheelDelta * 0.9)
      );
    }
    if (orbitDelta) {
      rig.yaw -= orbitDelta.x * 0.005;
      rig.pitch = Math.min(
        0.9,
        Math.max(0.08, rig.pitch + orbitDelta.y * 0.003)
      );
    }

    if (focus) {
      // When driving, the rig eases behind the car's heading; on foot it
      // trails the player's facing. Either way the subject stays low and
      // centred, about a quarter of the frame tall.
      const targetYaw = focus.heading != null ? focus.heading : rig.yaw;
      let dyaw = targetYaw - rig.yaw;
      while (dyaw > Math.PI) dyaw -= Math.PI * 2;
      while (dyaw < -Math.PI) dyaw += Math.PI * 2;
      const follow = focus.inCar ? 1.6 : 0.9;
      rig.yaw += dyaw * Math.min(1, follow * dt);

      const speedBoost = focus.inCar
        ? Math.min(3.5, (focus.speedKmh || 0) * 0.02)
        : 0;
      const dist = rig.distance + speedBoost;
      const height = rig.height + (focus.inCar ? 0.4 : -0.4);
      const backX = -Math.sin(rig.yaw) * Math.cos(rig.pitch) * dist;
      const backZ = -Math.cos(rig.yaw) * Math.cos(rig.pitch) * dist;
      const wantPos = new THREE.Vector3(
        focus.x + backX,
        height + Math.sin(rig.pitch) * dist * 0.55,
        focus.z + backZ
      );
      const wantLook = new THREE.Vector3(
        focus.x + Math.sin(rig.yaw) * 6,
        focus.inCar ? 1.6 : 1.4,
        focus.z + Math.cos(rig.yaw) * 6
      );
      const k = 1 - Math.pow(0.001, dt);
      camPos.lerp(wantPos, k);
      camLook.lerp(wantLook, k);
      camera.position.copy(camPos);
      camera.lookAt(camLook);
    }

    renderer.render(scene, camera);
  }

  function setZoom(distance) {
    rig.distance = Math.min(
      rig.maxDistance,
      Math.max(rig.minDistance, distance)
    );
  }

  function getYaw() {
    return rig.yaw;
  }

  return {
    renderer,
    scene,
    camera,
    sun,
    hemi,
    moon,
    rig,
    update,
    resize,
    setZoom,
    getYaw,
    applyTimeOfDay,
  };
}
