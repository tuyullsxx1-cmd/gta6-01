// Environment map: a small procedural dusk sky baked through PMREM, so
// clearcoat paint, glass and water have something real to reflect.
// Without an environment, metals render black.
export function createEnvironment(scene, renderer) {
  const c = document.createElement('canvas');
  c.width = 512; c.height = 256;
  const g = c.getContext('2d');
  const grad = g.createLinearGradient(0, 0, 0, 256);
  grad.addColorStop(0, '#1a2a55');
  grad.addColorStop(0.45, '#4a5a8a');
  grad.addColorStop(0.52, '#e88a3a');
  grad.addColorStop(0.58, '#ffd76a');
  grad.addColorStop(0.62, '#3a2a1a');
  grad.addColorStop(1, '#0a0a12');
  g.fillStyle = grad; g.fillRect(0, 0, 512, 256);
  // A bright sun patch on the horizon for the paint to catch.
  const sun = g.createRadialGradient(150, 140, 4, 150, 140, 60);
  sun.addColorStop(0, 'rgba(255,230,160,1)');
  sun.addColorStop(1, 'rgba(255,180,80,0)');
  g.fillStyle = sun; g.fillRect(0, 0, 512, 256);
  const tex = new THREE.CanvasTexture(c);
  tex.mapping = THREE.EquirectangularReflectionMapping;
  tex.colorSpace = THREE.SRGBColorSpace;
  const pmrem = new THREE.PMREMGenerator(renderer);
  scene.environment = pmrem.fromEquirectangular(tex).texture;
  pmrem.dispose();
  return scene.environment;
}

// Renderer, sky, sun and moon, day-night cycle, wet-asphalt neon glow and
// the low chase camera that frames the car at ~24% of frame height.
import * as THREE from 'three';

export function createRenderer(canvas) {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, preserveDrawingBuffer: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.15;
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  return renderer;
}

export function createLights(scene) {
  const sun = new THREE.DirectionalLight(0xffc070, 2.4);
  sun.position.set(120, 90, 40);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  sun.shadow.camera.left = -160; sun.shadow.camera.right = 160;
  sun.shadow.camera.top = 160; sun.shadow.camera.bottom = -160;
  sun.shadow.camera.far = 500;
  scene.add(sun);
  const hemi = new THREE.HemisphereLight(0x8fb8ff, 0x3a2a1a, 0.7);
  scene.add(hemi);
  const moon = new THREE.DirectionalLight(0x7a9aff, 0.35);
  moon.position.set(-80, 120, -60);
  scene.add(moon);
  const amb = new THREE.AmbientLight(0x404050, 0.5);
  scene.add(amb);
  return { sun, hemi, moon, amb };
}

// Sky dome: a big gradient sphere whose colours shift with the time of day.
export function createSky(scene) {
  const geo = new THREE.SphereGeometry(900, 24, 16);
  const mat = new THREE.ShaderMaterial({
    side: THREE.BackSide, depthWrite: false, fog: false,
    uniforms: {
      top: { value: new THREE.Color(0x2a4a8a) },
      mid: { value: new THREE.Color(0xe88a3a) },
      bot: { value: new THREE.Color(0x1a1426) },
    },
    vertexShader: 'varying vec3 vP; void main(){ vP = position; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }',
    fragmentShader: `varying vec3 vP; uniform vec3 top; uniform vec3 mid; uniform vec3 bot;
      void main(){ float h = normalize(vP).y;
        vec3 c = h > 0.12 ? mix(mid, top, smoothstep(0.12, 0.65, h)) : mix(bot, mid, smoothstep(-0.08, 0.12, h));
        gl_FragColor = vec4(c, 1.0); }`,
  });
  const sky = new THREE.Mesh(geo, mat);
  scene.add(sky);
  // A low golden sun disc + a pale moon.
  const sunDisc = new THREE.Mesh(new THREE.SphereGeometry(18, 16, 12),
    new THREE.MeshBasicMaterial({ color: 0xffd9a0, fog: false }));
  sunDisc.position.set(500, 90, 300); scene.add(sunDisc);
  const sunGlow = new THREE.Mesh(new THREE.SphereGeometry(42, 16, 12),
    new THREE.MeshBasicMaterial({ color: 0xff9a40, transparent: true, opacity: 0.25, fog: false }));
  sunGlow.position.copy(sunDisc.position); scene.add(sunGlow);
  return { sky, sunDisc, sunGlow };
}

// dayTime 0..1: 0 = midnight, 0.25 = dawn, 0.5 = noon, 0.75 = dusk.
export function updateDayNight(state, lights, sky, dt) {
  const t = state.dayTime;
  const sunH = Math.sin((t - 0.25) * Math.PI * 2); // -1 night .. 1 noon
  const dusk = Math.exp(-Math.pow((t - 0.78) * 8, 2)) + Math.exp(-Math.pow((t - 0.22) * 8, 2));
  const night = THREE.MathUtils.clamp(-sunH, 0, 1);
  const day = THREE.MathUtils.clamp(sunH, 0, 1);
  lights.sun.intensity = 0.25 + day * 2.4 + dusk * 1.2;
  lights.sun.color.setHSL(0.09 - dusk * 0.02, 0.75, 0.55 + day * 0.1);
  lights.sun.position.set(Math.cos((t - 0.25) * Math.PI * 2) * 160, 40 + day * 90 + dusk * 18, 90);
  lights.hemi.intensity = 0.35 + day * 0.5;
  lights.moon.intensity = night * 0.5;
  lights.amb.intensity = 0.3 + day * 0.25;
  const u = sky.sky.material.uniforms;
  // Golden hour: orange band low, deep blue above. Night: dark indigo.
  u.top.value.setRGB(0.10 + day * 0.25, 0.22 + day * 0.35 + dusk * 0.1, 0.45 + day * 0.25);
  u.mid.value.setRGB(0.85 * dusk + 0.25 * day + 0.06, 0.42 * dusk + 0.35 * day + 0.06, 0.16 * dusk + 0.35 * day + 0.12);
  u.bot.value.setRGB(0.08, 0.06, 0.12 + night * 0.05);
  sky.sunDisc.position.set(Math.cos((t - 0.25) * Math.PI * 2) * 700, 30 + Math.max(0, sunH) * 260, 420);
  sky.sunGlow.position.copy(sky.sunDisc.position);
  sky.sunDisc.material.color.setHex(dusk > 0.3 ? 0xffb060 : 0xfff2c8);
  return { dusk, night, day };
}

export function clockText(state) {
  const mins = Math.floor(state.dayTime * 24 * 60);
  const hh = String(Math.floor(mins / 60)).padStart(2, '0');
  const mm = String(mins % 60).padStart(2, '0');
  return `${hh}:${mm}`;
}

// Low chase camera: close and low, car fills ~20-25% of frame height.
export function updateCamera(camera, state, carMesh, playerMesh, mouse, dt) {
  const target = carMesh || playerMesh;
  if (!target) return;
  const pos = target.position;
  const heading = carMesh ? carMesh.rotation.y : state.player.heading;
  const m = mouse.consumeMouse();
  state.camera.yaw += m.dx * 0.004;
  state.camera.dist = THREE.MathUtils.clamp(state.camera.dist + m.wheel * 0.004, 4.5, 13);
  const dist = carMesh ? state.camera.dist : 6.5;
  const height = carMesh ? 2.6 : 3.2;
  const orbit = state.camera.yaw;
  const cx = pos.x - Math.sin(heading + orbit) * dist;
  const cz = pos.z - Math.cos(heading + orbit) * dist;
  const desired = new THREE.Vector3(cx, pos.y + height, cz);
  if (state.flags.snapCamera) {
    // Staged shots (and respawns) snap the camera into place at once.
    camera.position.copy(desired);
    state.flags.snapCamera = false;
  } else {
    camera.position.lerp(desired, 1 - Math.pow(0.0001, Math.max(dt, 1 / 240)));
  }
  camera.lookAt(pos.x, pos.y + (carMesh ? 1.1 : 1.4), pos.z);
  if (Math.abs(orbit) > 0.01 && !mouse) { /* keep orbit until player drags again */ }
}
