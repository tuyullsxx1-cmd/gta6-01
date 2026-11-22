// Car factory: realistic proportions, clearcoat paint, glass cabin,
// glowing headlights and taillights, wheels with rims and hubs.
// Damage, smoke, fire and chain explosions live here too.
import * as THREE from 'three';
import { makeRng } from './random.js';

const bodyGeo = new THREE.BoxGeometry(1, 1, 1);
const glassMat = new THREE.MeshPhysicalMaterial({ color: 0x101828, roughness: 0.08, metalness: 0.4, clearcoat: 1, transparent: true, opacity: 0.85 });
const tyreMat = new THREE.MeshStandardMaterial({ color: 0x141414, roughness: 0.95 });
const rimMat = new THREE.MeshStandardMaterial({ color: 0xd8d8d8, metalness: 0.95, roughness: 0.25 });
const chromeMat = new THREE.MeshStandardMaterial({ color: 0xe8e8e8, metalness: 1, roughness: 0.15 });

function makeWheel(radius, width) {
  const g = new THREE.Group();
  const tyre = new THREE.Mesh(new THREE.CylinderGeometry(radius, radius, width, 18), tyreMat);
  tyre.rotation.z = Math.PI / 2; tyre.castShadow = true; g.add(tyre);
  const rim = new THREE.Mesh(new THREE.CylinderGeometry(radius * 0.58, radius * 0.58, width + 0.02, 12), rimMat);
  rim.rotation.z = Math.PI / 2; g.add(rim);
  const hub = new THREE.Mesh(new THREE.CylinderGeometry(radius * 0.2, radius * 0.2, width + 0.06, 8), chromeMat);
  hub.rotation.z = Math.PI / 2; g.add(hub);
  // Five spokes read as a real rim at a glance.
  for (let i = 0; i < 5; i++) {
    const spoke = new THREE.Mesh(new THREE.BoxGeometry(0.09, radius * 1.05, width + 0.04), rimMat);
    spoke.rotation.z = (i / 5) * Math.PI;
    g.add(spoke);
  }
  return g;
}

function paintMaterial(color) {
  return new THREE.MeshPhysicalMaterial({
    color, roughness: 0.28, metalness: 0.3, clearcoat: 1, clearcoatRoughness: 0.08,
    envMapIntensity: 1.2,
  });
}

export function buildCarMesh(def, opts = {}) {
  const rng = makeRng((opts.seed || 7) + def.name.length * 131);
  const car = new THREE.Group();
  car.name = 'car-' + def.id;
  const paint = paintMaterial(opts.color !== undefined ? opts.color : def.color);
  const L = def.kind === 'van' ? 5.2 : def.kind === 'bike' ? 2.4 : 4.6;
  const W = def.kind === 'bike' ? 0.8 : 2.0;
  const H = def.kind === 'van' ? 2.2 : def.kind === 'bike' ? 1.1 : 1.35;

  if (def.kind === 'bike') {
    const body = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.5, 2.2), paint);
    body.position.y = 0.75; body.castShadow = true; car.add(body);
    const tank = new THREE.Mesh(new THREE.SphereGeometry(0.34, 12, 8), paint);
    tank.scale.set(1, 0.8, 1.8); tank.position.set(0, 1.0, 0.2); car.add(tank);
    const seat = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.14, 0.9),
      new THREE.MeshStandardMaterial({ color: 0x1a1a1a, roughness: 0.9 }));
    seat.position.set(0, 0.95, -0.55); car.add(seat);
    const screen = new THREE.Mesh(new THREE.PlaneGeometry(0.5, 0.45), glassMat);
    screen.position.set(0, 1.25, 0.95); screen.rotation.x = -0.5; car.add(screen);
    const wheels = [];
    for (const z of [0.85, -0.85]) {
      const w = makeWheel(0.36, 0.16);
      w.position.set(0, 0.36, z); car.add(w); wheels.push(w);
    }
    car.userData = { wheels, length: L, width: W, height: 1.4, kind: 'bike' };
  } else {
    // Lower body with a slight taper: hood, cabin, boot as separate masses.
    const body = new THREE.Mesh(bodyGeo, paint);
    body.scale.set(W, 0.62, L);
    body.position.y = 0.62; body.castShadow = true; body.receiveShadow = true;
    car.add(body);
    const hood = new THREE.Mesh(bodyGeo, paint);
    hood.scale.set(W * 0.96, 0.22, L * 0.3);
    hood.position.set(0, 0.98, L * 0.32); hood.castShadow = true; car.add(hood);
    const cabin = new THREE.Mesh(bodyGeo, glassMat);
    cabin.scale.set(W * 0.86, 0.55, L * 0.42);
    cabin.position.set(0, 1.18, -L * 0.06); cabin.castShadow = true; car.add(cabin);
    const roof = new THREE.Mesh(bodyGeo, paint);
    roof.scale.set(W * 0.88, 0.1, L * 0.4);
    roof.position.set(0, 1.5, -L * 0.06); car.add(roof);
    // Chrome trim + grille + bumpers
    const grille = new THREE.Mesh(new THREE.BoxGeometry(W * 0.7, 0.18, 0.08), chromeMat);
    grille.position.set(0, 0.55, L / 2 + 0.02); car.add(grille);
    for (const s of [-1, 1]) {
      const bumper = new THREE.Mesh(new THREE.BoxGeometry(W, 0.16, 0.14), chromeMat);
      bumper.position.set(0, 0.34, s * (L / 2 + 0.02)); car.add(bumper);
      const mirror = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.1, 0.22), chromeMat);
      mirror.position.set(s * (W / 2 + 0.08), 1.15, L * 0.12); car.add(mirror);
    }
    // Headlights: bright emissive lenses + glow; taillights: red strip.
    const headMat = new THREE.MeshStandardMaterial({ color: 0xfff6d8, emissive: 0xffe9a0, emissiveIntensity: 3 });
    const tailMat = new THREE.MeshStandardMaterial({ color: 0x881111, emissive: 0xff2020, emissiveIntensity: 1.6 });
    for (const s of [-1, 1]) {
      const hl = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.16, 0.08), headMat);
      hl.position.set(s * W * 0.32, 0.82, L / 2 + 0.03); car.add(hl);
      const glow = new THREE.Mesh(new THREE.SphereGeometry(0.3, 8, 6),
        new THREE.MeshBasicMaterial({ color: 0xffe9a0, transparent: true, opacity: 0.22 }));
      glow.position.set(s * W * 0.32, 0.82, L / 2 + 0.25); car.add(glow);
      const tl = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.14, 0.08), tailMat);
      tl.position.set(s * W * 0.3, 0.82, -L / 2 - 0.03); car.add(tl);
    }
    // Full-width taillight bar + rear glass + spoiler: the rear must read
    // as a real car, not a flat slab, from the chase camera.
    const tailBar = new THREE.Mesh(new THREE.BoxGeometry(W * 0.82, 0.12, 0.06), tailMat);
    tailBar.position.set(0, 0.86, -L / 2 - 0.04); car.add(tailBar);
    const rearGlass = new THREE.Mesh(new THREE.BoxGeometry(W * 0.78, 0.42, 0.06), glassMat);
    rearGlass.position.set(0, 1.22, -L * 0.27); rearGlass.rotation.x = 0.18; car.add(rearGlass);
    if (def.kind === 'sports' || def.kind === 'coupe') {
      const spoiler = new THREE.Mesh(new THREE.BoxGeometry(W * 0.92, 0.06, 0.42), paint);
      spoiler.position.set(0, 1.52, -L / 2 + 0.25); car.add(spoiler);
      for (const s of [-1, 1]) {
        const strut = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.22, 0.08), paint);
        strut.position.set(s * W * 0.36, 1.4, -L / 2 + 0.25); car.add(strut);
      }
    }
    // Number plate.
    const plate = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.2, 0.04),
      new THREE.MeshStandardMaterial({ color: 0xf0f0e0, roughness: 0.4 }));
    plate.position.set(0, 0.5, -L / 2 - 0.04); car.add(plate);
    // Taxi sign / van roof box
    if (def.kind === 'taxi') {
      const sign = new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.22, 0.4),
        new THREE.MeshStandardMaterial({ color: 0x222222, emissive: 0xffc020, emissiveIntensity: 0.8 }));
      sign.position.set(0, 1.68, 0); car.add(sign);
    }
    const wheels = [];
    const wy = 0.38, wx = W / 2 - 0.08;
    for (const [x, z] of [[-wx, L * 0.32], [wx, L * 0.32], [-wx, -L * 0.32], [wx, -L * 0.32]]) {
      const w = makeWheel(0.38, 0.3);
      w.position.set(x, wy, z); car.add(w); wheels.push(w);
    }
    car.userData = { wheels, length: L, width: W, height: H, kind: def.kind };
  }
  // Headlight beams for the player's car (added by main, toggled by caller).
  const beam = new THREE.SpotLight(0xffe9b0, 0, 40, 0.5, 0.5, 1.2);
  beam.position.set(0, 0.9, L / 2);
  const beamTarget = new THREE.Object3D();
  beamTarget.position.set(0, 0.2, L / 2 + 14);
  car.add(beamTarget); beam.target = beamTarget;
  car.add(beam);
  car.userData.beam = beam;
  car.userData.paint = paint;
  return car;
}

export function setCarDamage(mesh, damage) {
  // damage 0..100: smoke, then fire, then explosion handled by caller.
  mesh.userData.paint.color.setHex(mesh.userData.paint.color.getHex());
  const smoke = mesh.userData.smoke;
  if (smoke) smoke.visible = damage > 35;
  const fire = mesh.userData.fire;
  if (fire) fire.visible = damage > 70;
}

export function spawnExplosion(scene, pos, big = false) {
  const g = new THREE.Group();
  const core = new THREE.Mesh(new THREE.SphereGeometry(big ? 3.2 : 1.8, 14, 10),
    new THREE.MeshBasicMaterial({ color: 0xffa020, transparent: true, opacity: 0.95 }));
  core.position.copy(pos); core.position.y = 1.2; g.add(core);
  const shell = new THREE.Mesh(new THREE.SphereGeometry(big ? 5 : 3, 14, 10),
    new THREE.MeshBasicMaterial({ color: 0xff5a10, transparent: true, opacity: 0.4 }));
  shell.position.copy(core.position); g.add(shell);
  const light = new THREE.PointLight(0xff8020, 60, 30, 1.5);
  light.position.copy(core.position); g.add(light);
  scene.add(g);
  return { group: g, core, shell, light, life: 0, max: big ? 1.1 : 0.7 };
}

export function updateExplosion(e, dt) {
  e.life += dt;
  const k = e.life / e.max;
  e.core.scale.setScalar(1 + k * 1.6);
  e.core.material.opacity = Math.max(0, 0.95 - k);
  e.shell.scale.setScalar(1 + k * 2.4);
  e.shell.material.opacity = Math.max(0, 0.4 - k * 0.4);
  e.light.intensity = Math.max(0, 60 * (1 - k));
  return e.life < e.max;
}
