// The screenshot scenes behind ?shot=start|drive|chase|mission (seeded, so
// the same URL always draws the same frame). Each one stages the real
// gameplay systems — a driven car, a wanted chase, a mission in progress —
// then lets the fixed-step loop settle for a second or two before the paint.

/** Place the city and the actors for the named scene; returns the screen to draw. */
export function stageShot(name, state, ctx) {
  const { driving, missions, police, vehicles, step } = ctx;
  const cam = state.camera;
  state.screen = 'play';
  const settle = (steps) => {
    for (let i = 0; i < steps; i += 1) step(1 / 60);
  };

  if (name === 'drive' || name === 'play') {
    // Street level on Paseo del Mar at dusk, Rico in the Tormenta, traffic
    // rolling past the palm-lined avenue. Low camera, car big in frame.
    state.dayTime = 0.72;
    state.player.x = 0;
    state.player.z = -60;
    state.player.heading = Math.PI / 2;
    state.player.onFoot = false;
    // Spawn the Vagabundo itself at the staged spot: the Tormenta S reads
    // smaller (low sport-car roofline, ~13% of frame) and is on the export
    // list, so it clutters the shot with the export banner; the Vagabundo
    // (mission-1 car) measures 24% of frame with a clean top.
    const car = vehicles.spawnVehicle('vagabundo', 0, -60, Math.PI / 2, { kind: 'parked', color: 0x3f6fb5 });
    driving.enterVehicle(car);
    // enterVehicle teleports the player TO the car — put the car itself on
    // the staged street afterwards, or the shot is wherever that car was.
    car.x = 0; car.z = -60; car.heading = Math.PI / 2;
    state.player.x = 0; state.player.z = -60; state.player.heading = Math.PI / 2;
    car.speed = 24;
    cam.yaw = Math.PI / 2;
    cam.pitch = 0.18;
    cam.dist = 8;
    settle(90);
  } else if (name === 'chase') {
    // Golden hour, three stars on the board: Rico threads traffic in the
    // Camioneta Alba while Maravilla PD patrol cars and foot cops converge.
    // Staged on the Paseo del Mar avenue (same proven street as the drive
    // shot) — the (0,0) staging was an empty beige plaza.
    state.dayTime = 0.68;
    state.player.x = 0;
    state.player.z = -60;
    state.player.heading = Math.PI / 2;
    state.player.onFoot = false;
    const car = state.vehicles.find((v) => v.defId === 'camioneta') || state.vehicles[0];
    driving.enterVehicle(car);
    // enterVehicle teleports the player TO the car — put the car itself on
    // the staged avenue afterwards, or the shot is wherever that car was
    // (the old shot ended up at the map's west edge, in empty beige).
    car.x = 0; car.z = -60; car.heading = Math.PI / 2;
    state.player.x = 0; state.player.z = -60; state.player.heading = Math.PI / 2;
    car.speed = 26;
    state.player.wanted = 3;
    cam.yaw = Math.PI / 2;
    cam.pitch = 0.18;
    cam.dist = 9;
    // Short settle: with 180 steps the ramming patrol cars shove the
    // Camioneta off the avenue into an empty lot before the paint.
    settle(90);
  } else if (name === 'mission' || name === 'end') {
    // Golden hour on the road south of the garage, Rico facing the garage
    // and its gold marker: mission one is live, banner and dialogue up.
    // Staged 6 m east of the garage axis so the FLORERÍA sign on the
    // corner building is not hard-clipped by the frame edge.
    state.dayTime = 0.68;
    state.player.x = -144;
    state.player.z = -60;
    state.player.heading = Math.PI;
    state.player.onFoot = true;
    cam.yaw = Math.PI;
    cam.pitch = 0.22;
    cam.dist = 8;
    missions.startMission(0);
    settle(30);
  } else {
    // Title: high over downtown at golden hour.
    state.screen = 'title';
    state.dayTime = 0.68;
    state.player.x = 0;
    state.player.z = 0;
    state.player.heading = 0;
    cam.yaw = 0.6;
    cam.pitch = 0.85;
    cam.dist = 90;
    settle(60);
  }
  return { screen: state.screen };
}
