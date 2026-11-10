import * as THREE from 'three';

const PORTS = {
  feather: { angle: .89, cloudY: 4.14, color: '#ffdaa2' },
  wave: { angle: 0, cloudY: 3.30, color: '#8df4e2' },
  star: { angle: -.89, cloudY: 3.32, color: '#e3bcff' },
};
const v = (value) => new THREE.Vector3(...value);
const up = v([0, 1, 0]);

export function createSkyScene(canvas) {
  const scene = new THREE.Scene();
  scene.background = new THREE.Color('#719ba8');
  scene.fog = new THREE.FogExp2('#91b5bb', .021);
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.17;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.shadowMap.autoUpdate = false;
  renderer.shadowMap.needsUpdate = true;
  scene.add(new THREE.HemisphereLight('#d3f3fd', '#677f6e', 2.1));
  const sun = new THREE.DirectionalLight('#fff0c8', 3.12);
  sun.position.set(-8, 12, 8);
  sun.castShadow = true;
  sun.shadow.mapSize.set(1024, 1024);
  Object.assign(sun.shadow.camera, { left: -8, right: 8, top: 8, bottom: -8, far: 38 });
  sun.shadow.normalBias = .032;
  scene.add(sun);
  const edge = new THREE.DirectionalLight('#d1f6ff', 1.12);
  edge.position.set(6, 5, -7);
  scene.add(edge);

  const stage = new THREE.Group();
  scene.add(stage);
  const matte = (color, extra = {}) => new THREE.MeshStandardMaterial({ color, roughness: .82, ...extra });
  const light = (color) => new THREE.MeshBasicMaterial({ color });
  const wood = matte('#6b4c37', { flatShading: true });
  const grain = matte('#9a6846', { flatShading: true });
  const planks = ['#af885f', '#bc996e', '#987453'].map((color) => matte(color));
  const dark = matte('#375352');
  const stone = matte('#7e9b8b');
  const copper = matte('#ba8050', { metalness: .54, roughness: .39 });
  const gold = matte('#dcad64', { metalness: .52, roughness: .35 });
  const moss = ['#497d60', '#659266', '#86a873', '#5f947e'].map((color) => matte(color, { flatShading: true }));
  const cloudWhite = matte('#f1faf3', { roughness: 1 });
  const cloudBlue = matte('#c6e1e6', { roughness: 1 });
  const water = matte('#67c9d9', { emissive: '#3698a6', emissiveIntensity: .52, metalness: .25, roughness: .24 });
  const ico = new THREE.IcosahedronGeometry(1, 0);
  const puff = new THREE.SphereGeometry(1, 17, 11);

  function mesh(geometry, material, position, parent = stage, shadow = true) {
    const object = new THREE.Mesh(geometry, material);
    object.position.set(...position);
    object.castShadow = shadow;
    object.receiveShadow = true;
    parent.add(object);
    return object;
  }

  function round(top, base, height, position, material, parent = stage, sides = 16) {
    return mesh(new THREE.CylinderGeometry(top, base, height, sides), material, position, parent);
  }

  function block(size, position, material, parent = stage, shadow = true) {
    return mesh(new THREE.BoxGeometry(...size), material, position, parent, shadow);
  }

  function oval(geometry, size, position, material, parent = stage) {
    const object = mesh(geometry, material, position, parent, false);
    object.scale.set(...size);
    return object;
  }

  function branch(from, to, lower, upper, material = wood, parent = stage) {
    const start = v(from);
    const end = v(to);
    const segment = end.clone().sub(start);
    const object = round(upper, lower, segment.length(), start.lerp(end, .5).toArray(), material, parent, 9);
    object.quaternion.setFromUnitVectors(up, segment.normalize());
  }

  function line(points, radius, material, parent, closed = false) {
    const path = new THREE.CatmullRomCurve3(points.map(v), closed);
    mesh(new THREE.TubeGeometry(path, Math.max(12, points.length * 4), radius, 6, closed), material, [0, 0, 0], parent, false);
  }

  function ring(radius, thickness, position, material, parent, flat = true) {
    const object = mesh(new THREE.TorusGeometry(radius, thickness, 7, 48), material, position, parent, false);
    if (flat) object.rotation.x = -Math.PI / 2;
    return object;
  }

  function cloudCluster(parent, center, scale, main = cloudWhite) {
    const cluster = new THREE.Group();
    cluster.position.set(...center);
    cluster.scale.setScalar(scale);
    parent.add(cluster);
    for (const [index, [x, y, z, sx, sy, sz]] of [
      [-.72, -.16, 0, .76, .38, .50], [-.32, .09, -.14, .72, .58, .55],
      [.25, .19, -.06, .71, .59, .53], [.77, -.09, -.06, .67, .39, .44],
      [-.19, -.24, .21, .82, .27, .47], [.39, -.19, .16, .75, .30, .48],
    ].entries()) {
      oval(puff, [sx, sy, sz], [x, y, z], index < 4 ? main : cloudBlue, cluster);
    }
    return cluster;
  }

  for (const [x, y, z, size] of [[-9.4, -.7, -5, 3.4], [9, .6, -8.8, 3.3], [-6.9, -1.45, 4.6, 2.1],
    [7.2, -1.7, 4.5, 2.3], [-4.7, -2.1, -5.9, 2.4], [3.8, -2.35, -8.1, 3.7], [-10.9, 3.3, -13, 2.5]]) {
    cloudCluster(scene, [x, y, z], size, cloudBlue);
  }

  // The hub and the three stations sit on branches of the same canopy.
  const hub = v([0, 1.27, 2.39]);
  branch([.15, -3.6, 2.81], [-.07, -.95, 2.64], 1.30, .86);
  branch([-.07, -.95, 2.64], hub.toArray(), .88, .71, grain);
  for (const [index, end] of [[-2.86, -.65, 2.37], [2.86, -.81, 2.33], [-2.1, -.63, 4.27], [2.25, -1.01, 4.42]].entries()) {
    const elbow = [end[0] * .62, -.76, (end[2] + 2.64) / 2];
    branch([0, -1.46, 2.67], elbow, .48, .25);
    branch(elbow, end, .25, .074, grain);
    for (let j = 0; j < 4; j += 1) {
      const shift = (j - 1.5) * .43;
      const leaves = oval(ico, [1.02, .33 + j * .035, .86], [end[0] + shift, end[1] + .02, end[2] - .22 * Math.cos(j * 1.5)], moss[(j + index) % moss.length]);
      leaves.rotation.y = j * 1.45;
    }
  }
  round(1.42, 1.27, .26, [0, 1.02, 2.39], dark);
  round(1.41, 1.42, .09, [0, 1.192, 2.39], copper);
  round(1.31, 1.35, .082, [0, 1.266, 2.39], planks[1]);
  ring(1.26, .031, [0, 1.314, 2.39], gold, stage);
  for (let i = 0; i < 12; i += 1) {
    const angle = i * Math.PI / 6;
    const chip = block([.074, .025, .13], [Math.sin(angle) * 1.19, 1.32, 2.39 + Math.cos(angle) * 1.19], copper, stage, false);
    chip.rotation.y = angle;
  }

  const bridge = new THREE.Group();
  bridge.position.copy(hub);
  stage.add(bridge);
  for (let i = 0; i < 13; i += 1) {
    const slat = block([.76 + .11 * Math.cos(i * .25), .1, .281], [0, .008, -1.06 - i * .267], planks[i % planks.length], bridge);
    slat.rotation.z = Math.sin(i * 2.1) * .033;
  }
  for (const side of [-1, 1]) {
    const x = side * .40;
    branch([x, -.08, -1.02], [x, -.08, -4.39], .091, .072, wood, bridge);
    line([[x, .23, -1.17], [x * 1.05, .14, -2.47], [x, .22, -3.60], [x, .25, -4.20]], .025, copper, bridge);
    for (const z of [-1.17, -2.22, -3.22, -4.20]) {
      round(.033, .049, .23, [x, .12, z], wood, bridge, 7);
    }
  }
  block([.71, .064, .26], [0, .046, -4.37], copper, bridge);

  const glyphs = {
    feather: [
      [[-.19, -.23], [-.07, -.08], [.09, .09], [.19, .23]],
      [[-.16, -.12], [-.14, .05], [.01, .21], [.19, .23], [.16, .07], [.04, -.05], [-.16, -.12]],
      [[-.02, -.01], [-.03, .098]], [[.067, .076], [.139, .071]],
    ],
    wave: [
      [[-.21, .08], [-.135, .14], [-.06, .12], [.012, .045], [.085, .018], [.17, .08], [.21, .092]],
      [[-.21, -.045], [-.135, .015], [-.06, -.005], [.012, -.08], [.085, -.107], [.17, -.045], [.21, -.033]],
    ],
    star: [Array.from({ length: 11 }, (_, i) => {
      const angle = i * Math.PI / 5;
      const radius = i % 2 ? .10 : .239;
      return [Math.sin(angle) * radius, Math.cos(angle) * radius];
    })],
  };
  const stations = new Map();
  const anchors = Object.create(null);
  const overheadAnchors = Object.create(null);

  function floorRelief(name, center, scale, material, parent) {
    for (const points of glyphs[name]) {
      line(points.map(([x, y]) => [center[0] + x * scale, center[1], center[2] - y * scale]), .017, material, parent);
    }
  }

  round(.27, .28, .052, [0, 1.334, 3.07], dark, stage, 12);
  floorRelief('wave', [0, 1.372, 3.07], .91, gold, stage);

  for (const [index, [name, spec]] of Object.entries(PORTS).entries()) {
    const station = new THREE.Group();
    station.position.copy(hub).add(v([-Math.sin(spec.angle) * 4.79, 0, -Math.cos(spec.angle) * 4.79]));
    station.rotation.y = spec.angle;
    stage.add(station);
    const base = station.position;
    branch([0, -.96, 2.57], [base.x * .58, -.38, (base.z + 2.57) / 2], .52, .26);
    branch([base.x * .58, -.39, (base.z + 2.57) / 2], [base.x, 1.03, base.z], .28, .14, grain);
    round(1.07, .68, .30, [0, -.22, -.07], wood, station, 12);
    round(1.10, 1.08, .16, [0, -.055, -.07], stone, station, 12);
    round(1.02, 1.03, .068, [0, .06, -.07], dark, station, 12);
    ring(.91, .028, [0, .101, -.07], copper, station);
    const dock = ring(.33, .027, [0, .113, .10], light('#c0baa0'), station);
    const dockOuter = ring(.45, .018, [0, .116, .10], light('#c0baa0'), station);

    const glyphY = name === 'feather' ? 1.86 : 1.27;
    for (const side of [-1, 1]) {
      branch([side * .67, .04, -.43], [side * .64, glyphY - .19, -.53], .12, .10, wood, station);
      branch([side * .64, glyphY - .19, -.53], [side * .35, glyphY + .29, -.58], .10, .074, grain, station);
      branch([side * .35, glyphY + .29, -.58], [0, glyphY + .44, -.58], .076, .054, grain, station);
      const marker = oval(ico, [.105, .131, .083], [side * .63, glyphY - .22, -.34], gold, station);
      marker.rotation.y = Math.PI / 4;
    }
    const face = round(.49, .49, .12, [0, glyphY, -.38], copper, station, 12);
    face.rotation.x = Math.PI / 2;
    const inset = round(.399, .399, .044, [0, glyphY, -.304], dark, station, 24);
    inset.rotation.x = Math.PI / 2;
    ring(.393, .027, [0, glyphY, -.269], gold, station, false);
    const glyphMaterial = matte(spec.color, { emissive: spec.color, emissiveIntensity: .19 });
    floorRelief(name, [0, .117, -.46], .64, glyphMaterial, station);
    if (name === 'star') {
      const points = glyphs.star[0];
      for (let i = 1; i < points.length; i += 1) {
        const a = points[i - 1];
        const b = points[i];
        branch([a[0], glyphY + a[1], -.246], [b[0], glyphY + b[1], -.246], .021, .021, glyphMaterial, station);
      }
    } else {
      for (const points of glyphs[name]) {
        line(points.map(([x, y]) => [x, glyphY + y, -.247]), .024, glyphMaterial, station);
      }
    }

    const cloud = cloudCluster(station, [0, spec.cloudY - hub.y, -.94], .77, name === 'wave' ? cloudBlue : cloudWhite);
    const visual = {
      dock, dockOuter, cloud, cloudY: cloud.position.y, phase: index * 2,
      mouth: station.localToWorld(v([0, .28, .10])),
      emitter: station.localToWorld(v([0, spec.cloudY - hub.y - .27, -.57])),
    };
    stations.set(name, visual);
    anchors[name] = station.localToWorld(v([0, glyphY + .26, -.13]));
    overheadAnchors[name] = station.localToWorld(v([0, .12, -.89]));
  }

  const bowl = new THREE.Group();
  stage.add(bowl);
  const profile = [[0, .014], [.085, .014], [.105, .063], [.185, .074], [.261, .139], [.293, .211], [.261, .211], [.223, .141], [.159, .105], [0, .104]];
  mesh(new THREE.LatheGeometry(profile.map((point) => new THREE.Vector2(...point)), 24), copper, [0, 0, 0], bowl);
  ring(.282, .017, [0, .206, 0], gold, bowl);
  const bowlWater = round(.216, .216, .024, [0, .147, 0], water, bowl, 28);
  bowlWater.visible = false;

  const rewardBase = v([0, 1.72, 2.39]);
  round(.29, .37, .13, [0, 1.357, 2.39], gold);
  const rewardHalo = ring(.44, .026, [0, 1.448, 2.39], light('#7be5db'), stage);
  const orb = oval(new THREE.IcosahedronGeometry(1, 1), [.191, .24, .191], rewardBase.toArray(), water);
  anchors.reward = rewardBase.clone().add(v([0, .13, 0]));

  const rainBird = new THREE.Group();
  rainBird.name = '翎雨';
  rainBird.scale.setScalar(1.28);
  stage.add(rainBird);
  const mint = matte('#59aa93');
  const deepMint = matte('#377d75');
  const paleMint = matte('#a6e2be');
  const cream = matte('#f8e8b6');
  const eyeColor = matte('#1d3b3c', { roughness: .36 });
  oval(puff, [.178, .204, .252], [0, 0, 0], mint, rainBird);
  oval(puff, [.127, .152, .112], [0, -.059, .167], cream, rainBird);
  oval(puff, [.139, .127, .139], [0, .118, .179], paleMint, rainBird);
  const crest = oval(puff, [.035, .065, .038], [-.027, .234, .141], gold, rainBird);
  crest.rotation.z = -.32;
  branch([0, .104, .28], [0, .125, .62], .034, .004, gold, rainBird);
  for (const side of [-1, 1]) {
    oval(puff, [.021, .031, .026], [side * .105, .144, .253], eyeColor, rainBird);
    oval(puff, [.009, .01, .008], [side * .119, .154, .267], cream, rainBird);
  }
  for (let index = -1; index <= 1; index += 1) {
    const tail = oval(puff, [.052, .030, .205], [index * .055, -.048, -.250], index === 0 ? deepMint : mint, rainBird);
    tail.rotation.set(.18, index * -.30, 0);
  }

  const wingShape = new THREE.Shape();
  wingShape.moveTo(0, .026);
  wingShape.quadraticCurveTo(.24, .163, .60, .105);
  wingShape.quadraticCurveTo(.58, .055, .43, -.030);
  wingShape.lineTo(.46, -.068);
  wingShape.lineTo(.28, -.09);
  wingShape.lineTo(.29, -.135);
  wingShape.quadraticCurveTo(.106, -.105, 0, -.048);
  wingShape.closePath();
  const wingGeometry = new THREE.ExtrudeGeometry(wingShape, { depth: .018, bevelEnabled: false, curveSegments: 6 });
  const wings = [-1, 1].map((side) => {
    const joint = new THREE.Group();
    joint.position.set(side * .119, .024, -.08);
    rainBird.add(joint);
    const wing = mesh(wingGeometry, deepMint, [0, 0, 0], joint, false);
    wing.scale.x = side;
    const band = oval(puff, [.142, .028, .016], [side * .214, .045, .02], paleMint, joint);
    band.rotation.z = side * .09;
    return { joint, side };
  });

  const dropGeometry = new THREE.OctahedronGeometry(1);
  const particles = Array.from({ length: 32 }, () => oval(dropGeometry, [.03, .1, .03], [0, 0, 0], light('#bcfaff')));
  const airMotes = Array.from({ length: 13 }, (_, i) => {
    const center = v([Math.cos(i * 2.40) * (3.1 + (i % 5) * .58), .6 + (i % 6) * .58, Math.sin(i * 2.40) * 3.5]);
    return { object: oval(dropGeometry, [.035, .045, .034], center.toArray(), light('#e2f6e6')), center };
  });

  const cameraCenter = v([0, 1.78, -.04]);
  const perspective = new THREE.PerspectiveCamera(33, 1, .05, 95);
  const overhead = new THREE.OrthographicCamera(-7, 7, 7, -7, .05, 95);
  const direction = v([.25, .40, 1]).normalize();
  const fromAbove = v([0, 1, .08]).normalize();
  const framing = [[-5.5, .15, -.35], [5.5, .15, -.35], [0, -.5, 4.0], [0, 4.18, -3.7],
    [-4.65, 4.52, -1.22], [4.65, 3.8, -1.2], [-1.6, .2, 4.2], [1.6, .2, 4.2], [0, .37, -4.1]].map(v);
  const projected = new THREE.Vector3();
  const pointOnPlane = new THREE.Vector3();
  const caster = new THREE.Raycaster();
  const ndc = new THREE.Vector2();
  const handPlane = new THREE.Plane(up, -1.55);
  let camera = perspective;
  let width = 0;
  let height = 0;
  let dpr = 1;
  let selected = null;
  let phase = 'planning';
  let intakeState = 'idle';
  let hand = null;
  let action = null;
  let rewardReady = false;
  let celebrationAt = null;
  let frame = 0;

  function resize() {
    const nextWidth = Math.max(1, canvas.clientWidth);
    const nextHeight = Math.max(1, canvas.clientHeight);
    const nextDpr = Math.min(window.devicePixelRatio || 1, 1.75);
    if (width === nextWidth && height === nextHeight && dpr === nextDpr) return;
    width = nextWidth;
    height = nextHeight;
    dpr = nextDpr;
    renderer.setPixelRatio(dpr);
    renderer.setSize(width, height, false);
    const aspect = width / height;
    perspective.aspect = aspect;
    perspective.updateProjectionMatrix();
    let distance = 12.4;
    for (let step = 0; step < 20; step += 1) {
      perspective.position.copy(cameraCenter).addScaledVector(direction, distance);
      perspective.lookAt(cameraCenter);
      perspective.updateMatrixWorld();
      let fit = 0;
      for (const anchor of framing) {
        projected.copy(anchor).project(perspective);
        fit = Math.max(fit, Math.abs(projected.x), Math.abs(projected.y));
      }
      if (fit < .89) break;
      distance *= 1.083;
    }
    const halfHeight = Math.max(5.1, 5.8 / aspect);
    Object.assign(overhead, { left: -halfHeight * aspect, right: halfHeight * aspect, top: halfHeight, bottom: -halfHeight });
    overhead.position.copy(cameraCenter).addScaledVector(fromAbove, 19);
    overhead.lookAt(cameraCenter);
    overhead.updateProjectionMatrix();
    overhead.updateMatrixWorld();
  }

  function positionFor(anchor) {
    const showDock = phase === 'planning' || phase === 'ready' || phase === 'pouring';
    const point = anchor === 'intake' ? showDock && stations.get(selected)?.mouth
      : (camera === overhead ? overheadAnchors[anchor] : null) ?? anchors[anchor];
    if (!point) return null;
    resize();
    projected.copy(point).project(camera);
    return { x: (projected.x + 1) / 2, y: (1 - projected.y) / 2 };
  }

  function pick(x, y, activePhase = phase) {
    const anchor = activePhase === 'collect' ? 'reward' : activePhase === 'planning' || activePhase === 'ready' ? 'intake' : null;
    const point = positionFor(anchor);
    if (!point) return null;
    const radius = THREE.MathUtils.clamp(Math.min(width, height) * .067, 24, 59);
    return Math.hypot((point.x - x) * width, (point.y - y) * height) <= radius ? anchor : null;
  }

  function setRoute(gate1) {
    selected = stations.has(gate1) ? gate1 : null;
  }

  function setView(view) {
    camera = view === 'overhead' ? overhead : perspective;
  }

  function setPhase(nextPhase) {
    phase = nextPhase;
    if (phase === 'collect') rewardReady = true;
  }

  function setIntakeState(state) {
    intakeState = state;
  }

  function setHandPoint(point) {
    hand = point && Number.isFinite(point.x) && Number.isFinite(point.y) ? point : null;
  }

  function clearAction() {
    if (action) action.resolve(false);
    action = null;
    for (const particle of particles) particle.visible = false;
  }

  function startAction(type, outcome, duration) {
    clearAction();
    return new Promise((resolve) => {
      action = { type, outcome, duration, start: performance.now(), resolve };
    });
  }

  function playWater(outcome) {
    if (!stations.has(outcome)) return Promise.resolve(false);
    rewardReady = false;
    bowlWater.visible = false;
    return startAction('weather', outcome, outcome === 'wave' ? 1950 : 1380);
  }

  function playClaim() {
    celebrationAt = performance.now();
    return startAction('claim', null, 620);
  }

  function reset() {
    clearAction();
    selected = null;
    phase = 'planning';
    intakeState = 'idle';
    hand = null;
    rewardReady = false;
    celebrationAt = null;
    bowl.visible = false;
    bowlWater.visible = false;
    orb.visible = false;
    rewardHalo.visible = false;
  }

  function showWeather(outcome, elapsed, duration) {
    const station = stations.get(outcome);
    const fraction = elapsed / duration;
    bowl.position.copy(station.mouth);
    bowl.position.y -= .16;
    bowl.visible = true;
    for (const [index, particle] of particles.entries()) {
      const age = (elapsed / (outcome === 'wave' ? 490 : 710) - index * .036);
      particle.visible = age > 0 && fraction < .91;
      if (!particle.visible) continue;
      const progress = age % 1;
      const angle = index * 2.39996;
      const radius = .22 * Math.sqrt((index + 1) / particles.length);
      if (outcome === 'wave') {
        particle.material.color.set('#b4fbff');
        particle.scale.set(.028, .086, .028);
        particle.position.copy(station.emitter).lerp(station.mouth, progress);
        particle.position.x += Math.cos(angle) * radius;
        particle.position.z += Math.sin(angle) * radius;
      } else {
        const isWind = outcome === 'feather';
        particle.material.color.set(isWind ? '#fff5c9' : '#efd1ff');
        particle.scale.set(isWind ? .105 : .047, .035, .036).multiplyScalar(1 - progress * .4);
        particle.position.copy(station.emitter);
        particle.position.x += (isWind ? -1.9 * progress : Math.cos(angle) * progress * .95) + Math.cos(angle) * radius;
        particle.position.y += isWind ? Math.sin(progress * 2.6) * .46 : progress * 1.16;
        particle.position.z += Math.sin(angle) * (.2 + progress * .69);
        particle.rotation.z = angle + progress * 7;
      }
    }
    bowlWater.visible = outcome === 'wave' && fraction > .36;
    if (outcome === 'wave' && fraction > .74) {
      const travel = THREE.MathUtils.clamp((fraction - .74) / .26, 0, 1);
      orb.visible = true;
      orb.position.copy(station.mouth).lerp(rewardBase, travel);
      orb.position.y += .7 * Math.sin(travel * Math.PI);
    }
  }

  function animate(now) {
    frame = requestAnimationFrame(animate);
    resize();
    const time = now * .001;
    const celebration = celebrationAt === null ? 1 : THREE.MathUtils.clamp((now - celebrationAt) / 1180, 0, 1);
    const cheer = Math.sin(celebration * Math.PI);
    rainBird.position.set(-1.47 + Math.sin(time * 1.35) * .10 - cheer * .26, 2.18 + Math.sin(time * 2.7) * .085 + cheer * .53, 2.79);
    rainBird.rotation.set(.07 + cheer * -.28, -.86 + Math.sin(time * 1.3) * .13 + cheer * .28, Math.sin(time * 1.9) * .06);
    for (const { joint, side } of wings) {
      joint.rotation.z = side * (.23 + Math.sin(time * 20) * (.71 + cheer * .18));
      joint.rotation.y = side * -.28;
    }
    const active = stations.get(selected);
    bridge.rotation.y = THREE.MathUtils.lerp(bridge.rotation.y, PORTS[selected]?.angle ?? -.16, .115);
    for (const [name, station] of stations) {
      const dockState = name === selected ? intakeState : 'unselected';
      const color = { unselected: '#a89b7d', idle: '#f4cf8f', hover: '#fbe3a7', aligned: '#8bffde', won: '#f9e4a0' }[dockState];
      station.dock.material.color.set(color);
      station.dockOuter.material.color.set(color);
      const pulse = name === selected ? 1 + .052 * Math.sin(time * 4.3) : 1;
      station.dockOuter.scale.set(pulse, pulse, 1);
      station.cloud.position.y = station.cloudY + Math.sin(time * .88 + station.phase) * .075;
    }
    for (const [index, { object, center }] of airMotes.entries()) {
      object.position.copy(center);
      object.position.y += Math.sin(time + index) * .18;
      object.rotation.y = time + index;
    }
    orb.visible = rewardReady;
    orb.position.copy(rewardBase);
    orb.position.y += Math.sin(time * 3.4) * .085;
    orb.rotation.y = time * .91;
    rewardHalo.visible = rewardReady;
    const readyPulse = 1 + Math.sin(time * 3.4) * .08;
    rewardHalo.scale.set(readyPulse, readyPulse, 1);

    bowl.visible = false;
    if (active && (intakeState === 'aligned' || intakeState === 'hover')) {
      bowl.position.copy(active.mouth);
      bowl.position.y -= .16;
      bowl.visible = true;
    } else if (hand && (phase === 'planning' || phase === 'ready')) {
      ndc.set(hand.x * 2 - 1, 1 - hand.y * 2);
      caster.setFromCamera(ndc, camera);
      if (caster.ray.intersectPlane(handPlane, pointOnPlane)) {
        bowl.position.copy(pointOnPlane);
        bowl.visible = true;
      }
    } else if (phase === 'planning' || phase === 'ready') {
      bowl.position.set(-.63, 1.32, 2.78);
      bowl.visible = true;
    }
    if (action) {
      const elapsed = Math.min(now - action.start, action.duration);
      const fraction = elapsed / action.duration;
      if (action.type === 'weather') showWeather(action.outcome, elapsed, action.duration);
      if (action.type === 'claim') {
        orb.visible = true;
        orb.position.y += fraction * .93;
        orb.position.z += fraction * .36;
      }
      if (fraction === 1) {
        rewardReady = action.type === 'weather' && action.outcome === 'wave';
        action.resolve(true);
        action = null;
        for (const particle of particles) particle.visible = false;
      }
    }
    renderer.render(scene, camera);
  }

  function dispose() {
    cancelAnimationFrame(frame);
    clearAction();
    const geometries = new Set();
    const materials = new Set();
    scene.traverse((object) => {
      if (object.geometry) geometries.add(object.geometry);
      if (object.material) materials.add(object.material);
    });
    for (const geometry of geometries) geometry.dispose();
    for (const material of materials) material.dispose();
    sun.shadow.dispose();
    renderer.dispose();
  }

  resize();
  reset();
  frame = requestAnimationFrame(animate);
  return { setRoute, pick, positionFor, setView, setPhase, setIntakeState, setHandPoint, playWater, playClaim, reset, dispose };
}
