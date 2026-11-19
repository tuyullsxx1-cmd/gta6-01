// The three.js renderer: scene, sun and sky, day-night cycle, third-person
// camera rig. Gameplay systems add meshes to `scene` and never touch the
// camera; the rig reads the player/vehicle state every frame.
//
// Refinements (Builder A): camera collision against building AABBs
// (via city.collide when a city is registered with setCity() or passed to
// updateCamera), warmer sunset palette, streetlamp glow at night, and
// distance fog that tracks the sky colour / time of day.

import * as THREE from 'three';
import { PALETTE } from './config.js';

const tmpColor = new THREE.Color();

export function createRenderer(canvas) {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.05;

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(PALETTE.skyDay);
  scene.fog = new THREE.Fog(PALETTE.fogDay, 180, 700);

  const camera = new THREE.PerspectiveCamera(62, 1, 0.1, 1400);
  camera.position.set(0, 30, 40);

  const hemi = new THREE.HemisphereLight(0xbfd9ff, 0x8a7a5a, 0.9);
  scene.add(hemi);

  const sun = new THREE.DirectionalLight(PALETTE.sun, 2.2);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  sun.shadow.camera.left = -110;
  sun.shadow.camera.right = 110;
  sun.shadow.camera.top = 110;
  sun.shadow.camera.bottom = -110;
  sun.shadow.camera.near = 10;
  sun.shadow.camera.far = 500;
  sun.shadow.bias = -0.0004;
  scene.add(sun);
  scene.add(sun.target);

  // A visible sun disc and moon so the sky never reads flat.
  const sunDisc = new THREE.Mesh(
    new THREE.SphereGeometry(9, 16, 16),
    new THREE.MeshBasicMaterial({ color: 0xfff6c8, fog: false }),
  );
  scene.add(sunDisc);
  const moonDisc = new THREE.Mesh(
    new THREE.SphereGeometry(6, 16, 16),
    new THREE.MeshBasicMaterial({ color: 0xdde6f2, fog: false }),
  );
  moonDisc.visible = false;
  scene.add(moonDisc);

  // Optional city handle for camera collision; set via setCity() or by
  // passing the city as the third argument to updateCamera().
  let cityRef = null;
  // Streetlamp bulb materials, collected lazily so setDayTime can make them
  // glow at night without a per-frame scene traversal.
  let lampMats = null;
  function collectLamps() {
    lampMats = [];
    scene.traverse((o) => {
      if (o.name === 'lamp' && o.material) lampMats.push(o.material);
    });
  }

  function resize(width, height) {
    renderer.setSize(width, height, false);
    camera.aspect = width / height;
    camera.updateProjectionMatrix();
  }

  /** Advance the sky for dayTime 0..1 (0 = midnight, 0.25 = dawn, 0.5 = noon, 0.75 = dusk). */
  function setDayTime(dayTime) {
    const sunAngle = (dayTime - 0.25) * Math.PI * 2; // 0 at dawn, PI at dusk
    const elevation = Math.sin(sunAngle);
    const azimuth = Math.cos(sunAngle);
    const isDay = elevation > -0.08;
    const duskness = Math.max(0, 1 - Math.abs(elevation) * 3.2);
    const nightness = Math.max(0, -elevation * 2.2);

    sun.intensity = isDay ? 2.4 - duskness * 0.6 : 0.25;
    sun.color.setHex(isDay ? (duskness > 0.35 ? 0xff9a3d : 0xfff2d0) : 0x8fa8d8);
    hemi.intensity = isDay ? 0.95 - duskness * 0.12 : 0.28;

    const sky = scene.background;
    if (nightness > 0.5) sky.setHex(PALETTE.skyNight);
    else if (duskness > 0.25) {
      // Warmer sunset: push further toward orange than the plain day sky.
      sky.setHex(PALETTE.skyDay).lerp(tmpColor.setHex(PALETTE.skyDusk), Math.min(1, duskness * 1.4));
      if (duskness > 0.6) sky.lerp(tmpColor.setHex(0xff7a3c), (duskness - 0.6) * 0.9);
    } else sky.setHex(PALETTE.skyDay);
    // Distance fog matches the sky and closes in at night.
    scene.fog.color.copy(sky);
    if (nightness > 0.5) { scene.fog.near = 110; scene.fog.far = 480; }
    else if (duskness > 0.25) { scene.fog.near = 150; scene.fog.far = 620; }
    else { scene.fog.near = 180; scene.fog.far = 700; }
    // Dusk gets a small exposure lift so the road surface still reads.
    renderer.toneMappingExposure = isDay ? (duskness > 0.25 ? 1.18 : 1.05) : 0.9;

    // Streetlamps: dim grey-blue by day, warm glowing amber at night/dusk.
    if (!lampMats) collectLamps();
    const lampHex = nightness > 0.4 ? 0xffe9a8 : (duskness > 0.25 ? 0xffd98a : 0x9a9484);
    for (const m of lampMats) m.color.setHex(lampHex);

    sunDisc.visible = elevation > -0.05;
    sunDisc.position.set(azimuth * 800, elevation * 800 + 30, 320);
    moonDisc.visible = elevation < -0.08;
    moonDisc.position.set(-azimuth * 800, -elevation * 800 + 40, 320);
    return { isDay, duskness, nightness };
  }

  const camPos = new THREE.Vector3(0, 26, 46);
  const camLook = new THREE.Vector3(0, 0, 0);
  const tmpEye = new THREE.Vector3();
  const tmpTarget = new THREE.Vector3();

  /**
   * Third-person rig: sits behind the focus point at the camera yaw/pitch the
   * player steers (drag to orbit), eases toward it, and keeps the sun's shadow
   * box centred on the action. When a city is available, the camera is pushed
   * out of building AABBs (horizontal push + a minimum height) so it never
   * ends up inside a building.
   */
  function updateCamera(state, dt, cityArg) {
    const p = state.player;
    const focus = p.vehicleId !== null
      ? state.vehicles.find((v) => v.id === p.vehicleId)
      : null;
    const fx = focus ? focus.x : p.x;
    const fz = focus ? focus.z : p.z;
    const heading = focus ? focus.heading : p.heading;
    const cam = state.camera;
    // Ease the rig yaw toward the focus heading so driving feels planted.
    let dyaw = heading - cam.yaw;
    while (dyaw > Math.PI) dyaw -= Math.PI * 2;
    while (dyaw < -Math.PI) dyaw += Math.PI * 2;
    cam.yaw += dyaw * Math.min(1, dt * 1.6);
    const dist = focus ? cam.dist + 0.5 : cam.dist; // the car fills ~20% of the frame while driving
    const height = 2.2 + Math.sin(cam.pitch) * dist;
    const back = Math.cos(cam.pitch) * dist;
    tmpEye.set(
      fx - Math.sin(cam.yaw) * back,
      height + (focus ? 1 : 0),
      fz - Math.cos(cam.yaw) * back,
    );
    camPos.lerp(tmpEye, Math.min(1, dt * 7));
    // Camera collision: keep the rig out of buildings.
    const city = cityArg || cityRef;
    if (city && typeof city.collide === 'function') {
      const fixed = city.collide(camPos.x, camPos.z, 2.0);
      camPos.x = fixed.x;
      camPos.z = fixed.z;
      if (camPos.y < 2.4) camPos.y = 2.4;
    }
    tmpTarget.set(fx, 1.6, fz);
    camLook.lerp(tmpTarget, Math.min(1, dt * 9));
    camera.position.copy(camPos);
    camera.lookAt(camLook);
    // Shadow box follows the player so shadows stay crisp where it matters.
    sun.position.set(fx + 140, 160, fz + 60);
    sun.target.position.set(fx, 0, fz);
    sun.target.updateMatrixWorld();
  }

  return {
    renderer, scene, camera, sun, hemi,
    resize, setDayTime, updateCamera,
    /** Register the city so updateCamera can keep the rig out of buildings. */
    setCity(c) { cityRef = c; },
    draw() {
      renderer.render(scene, camera);
    },
  };
}
