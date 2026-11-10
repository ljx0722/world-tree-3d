import * as THREE from 'three';
import { createGuardian } from './guardian.js';

const ROUTES = {
  intake: [[0, 3.62, -2.35], [0, 3.62, -1.24], [0, 3.54, -.67], [0, 2.12, .13], [0, 2.03, .55]],
  stone: [[0, 2.03, .55], [-.71, 2.03, .71], [-1.68, 2.03, .82], [-2.63, 2.03, 1.18], [-3.47, 2.03, 1.18]],
  channel: [[0, 2.03, .55], [.68, 2.03, .75], [1.32, 2.03, 1.12], [1.44, 2.03, 1.72], [1.44, 2.03, 2.32]],
  pool: [[1.44, 2.03, 2.32], [.72, 2.02, 2.66], [-.03, .57, 3.27], [-.95, .55, 3.48], [-2.2, .55, 4.03], [-2.76, .55, 4.71]],
  corn: [[1.44, 2.03, 2.32], [2.2, 2.02, 2.66], [2.81, .57, 3.30], [3.43, .55, 3.77], [3.75, .55, 4.55], [4.01, .55, 4.84]],
};

const v = (coordinates) => new THREE.Vector3(...coordinates);
const yAxis = v([0, 1, 0]);
const forward = v([0, 0, 1]);

function bend(points) {
  const anchors = points.map(v);
  const path = new THREE.CurvePath();
  let cursor = anchors[0];
  for (let i = 1; i < anchors.length - 1; i += 1) {
    const point = anchors[i];
    const entering = point.clone().lerp(anchors[i - 1], .17);
    const leaving = point.clone().lerp(anchors[i + 1], .17);
    path.add(new THREE.LineCurve3(cursor, entering));
    path.add(new THREE.QuadraticBezierCurve3(entering, point, leaving));
    cursor = leaving;
  }
  path.add(new THREE.LineCurve3(cursor, anchors.at(-1)));
  return path;
}

function randomSequence(seed) {
  return () => {
    seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
    return seed / 4294967296;
  };
}

export function createTerraceScene(canvas) {
  const random = randomSequence(418);
  const scene = new THREE.Scene();
  scene.background = new THREE.Color('#10282f');
  scene.fog = new THREE.FogExp2('#10282f', .023);

  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: false });
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.35;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.shadowMap.autoUpdate = false;
  renderer.shadowMap.needsUpdate = true;

  scene.add(new THREE.HemisphereLight('#d5f2ed', '#2a4d49', 2.25));
  const keyLight = new THREE.DirectionalLight('#ffe4b4', 3.05);
  keyLight.position.set(-7, 12, 8);
  keyLight.castShadow = true;
  keyLight.shadow.mapSize.set(1024, 1024);
  Object.assign(keyLight.shadow.camera, { left: -9, right: 9, top: 9, bottom: -9, far: 35 });
  keyLight.shadow.normalBias = .033;
  scene.add(keyLight);
  const rimLight = new THREE.DirectionalLight('#59d8d1', 1.22);
  rimLight.position.set(6, 6, -8);
  scene.add(rimLight);

  const stage = new THREE.Group();
  scene.add(stage);
  const matte = (color, extra = {}) => new THREE.MeshStandardMaterial({ color, roughness: .85, ...extra });
  const stone = ['#566c65', '#64786c', '#7e8271', '#718170', '#52685e'].map((color) => matte(color));
  const deepStone = matte('#233d3c');
  const edgeStone = matte('#879480');
  const gold = matte('#bb8843', { metalness: .56, roughness: .36 });
  const darkGold = matte('#735740', { metalness: .36 });
  const bark = matte('#694738', { flatShading: true });
  const barkGold = matte('#94623e', { flatShading: true });
  const moss = ['#2f6554', '#477857', '#559061', '#81a166'].map((color) => matte(color, { flatShading: true }));
  const soil = matte('#59473a');
  const stalk = matte('#6f963f');
  const leaf = matte('#4e913f', { side: THREE.DoubleSide });
  const kernel = matte('#edb94f');
  const rockGeometry = new THREE.IcosahedronGeometry(1, 0);
  const leafGeometry = new THREE.IcosahedronGeometry(1, 1);

  function mesh(geometry, material, coordinates, parent = stage, shadow = true) {
    const object = new THREE.Mesh(geometry, material);
    object.position.set(...coordinates);
    object.castShadow = shadow;
    object.receiveShadow = true;
    parent.add(object);
    return object;
  }

  function block(size, position, material, parent = stage) {
    return mesh(new THREE.BoxGeometry(...size), material, position, parent);
  }

  function cylinder(top, bottom, height, position, material, parent = stage, sides = 12) {
    return mesh(new THREE.CylinderGeometry(top, bottom, height, sides), material, position, parent);
  }

  function branch(from, to, bottom, top, material, parent = stage) {
    const start = v(from);
    const end = v(to);
    const object = cylinder(top, bottom, start.distanceTo(end), start.clone().lerp(end, .5).toArray(), material, parent, 8);
    object.quaternion.setFromUnitVectors(yAxis, end.sub(start).normalize());
    return object;
  }

  function tube(path, radius, material, parent = stage, segments = 60, sides = 8) {
    return mesh(new THREE.TubeGeometry(path, segments, radius, sides), material, [0, 0, 0], parent, false);
  }

  function ring(radius, thickness, position, material, parent = stage) {
    const object = mesh(new THREE.TorusGeometry(radius, thickness, 8, 64), material, position, parent, false);
    object.rotation.x = -Math.PI / 2;
    return object;
  }

  function terrace({ width, depth, top, height, center }) {
    block([width, height, depth], [0, top - height / 2, center], deepStone);
    block([width + .17, .15, depth + .16], [0, top - .075, center], edgeStone);
    const front = center + depth / 2;
    for (let row = 0; row < 2; row += 1) {
      const count = row === 0 ? Math.round(width / 1.1) : Math.round(width / 1.3);
      const brickWidth = width / count;
      for (let i = 0; i < count; i += 1) {
        block([brickWidth - .035, (height - .2) / 2, .18], [
          -width / 2 + (i + .5) * brickWidth,
          top - .16 - (row + .5) * (height - .14) / 2,
          front,
        ], stone[Math.floor(random() * stone.length)]);
      }
      const sideCount = Math.round(depth / 1.25);
      const brickDepth = depth / sideCount;
      for (const direction of [-1, 1]) {
        for (let i = 0; i < sideCount; i += 1) {
          block([.17, (height - .2) / 2, brickDepth - .04], [
            direction * width / 2, top - .16 - (row + .5) * (height - .14) / 2,
            center - depth / 2 + (i + .5) * brickDepth,
          ], stone[Math.floor(random() * stone.length)]);
        }
      }
    }
    block([width + .1, .08, .1], [0, top - .19, front + .12], darkGold);
  }

  terrace({ width: 12.2, depth: 9.9, top: .33, height: .9, center: 1.15 });
  terrace({ width: 10.45, depth: 6.55, top: 1.77, height: 1.44, center: -.58 });
  terrace({ width: 8.9, depth: 4.3, top: 3.33, height: 1.56, center: -2.84 });

  // Narrow stairs and engraved sill sit clear of the playable waterways.
  for (const [x, y, z] of [[-4.46, .34, 3.97], [4.27, 1.77, .35]]) {
    for (let step = 0; step < 6; step += 1) {
      const rise = (step + 1) * .22;
      block([1.07, rise, .36], [x, y + rise / 2, z - step * .31], stone[step % stone.length]);
      block([1.13, .045, .37], [x, y + rise, z - step * .31], edgeStone);
    }
  }

  const ground = mesh(new THREE.CircleGeometry(30, 80), matte('#1b3938'), [0, -.66, 1], scene, false);
  ground.rotation.x = -Math.PI / 2;
  const plinth = cylinder(8.1, 8.35, .16, [0, -.62, .5], deepStone, stage, 48);
  plinth.scale.z = .88;

  // Twisting roots leave the platform, then return as the central trunk.
  const tree = new THREE.Group();
  stage.add(tree);
  branch([-.7, 2.1, -4.13], [-.5, 5.42, -4.17], 1.2, .82, bark, tree);
  branch([-.5, 5.1, -4.17], [-.14, 7.62, -4.48], .84, .55, bark, tree);
  branch([-.14, 7.35, -4.48], [.73, 9.25, -4.3], .58, .17, barkGold, tree);

  const roots = [
    [[-.55, 4.19, -3.93], [-1.68, 3.64, -3.65], [-3.19, 3.43, -3.17], [-4.49, 3.14, -2.58], [-5.12, 1.84, -2.2], [-6.18, .15, -.85]],
    [[-.27, 4.03, -3.98], [1.03, 3.48, -3.78], [2.39, 3.42, -3.25], [3.8, 3.39, -2.5], [4.99, 2.48, -1.94], [5.55, .42, -.39]],
    [[-.42, 3.85, -4.07], [-1.3, 3.56, -3.15], [-2.07, 3.44, -2.56], [-2.65, 3.38, -1.78]],
  ];
  const rootLights = [];
  for (const root of roots) {
    for (let i = 1; i < root.length; i += 1) {
      branch(root[i - 1], root[i], .37 * .75 ** (i - 1), .37 * .75 ** i, bark, tree);
    }
    const material = new THREE.MeshBasicMaterial({ color: '#f0ca6c', transparent: true, opacity: .34 });
    rootLights.push(material);
    tube(bend(root.map(([x, y, z]) => [x, y + .16, z + .14])), .026, material, tree);
  }

  const canopy = new THREE.Group();
  stage.add(canopy);
  const branchEnds = [[-3.7, 7.64, -4.43], [-2.51, 8.72, -5.14], [-.3, 9.42, -5.05], [1.71, 9.18, -4.54], [3.32, 8.14, -4.19], [2.55, 8.14, -5.87], [-1.58, 8.31, -3.38]];
  for (const [index, tip] of branchEnds.entries()) {
    const stem = [-.32, 6.35 + (index % 3) * .52, -4.26];
    const elbow = [tip[0] * .58, tip[1] - .78, (tip[2] - 4.26) * .5];
    branch(stem, elbow, .35, .21, bark, canopy);
    branch(elbow, tip, .21, .068, barkGold, canopy);
    for (let i = 0; i < 6; i += 1) {
      const foliage = mesh(leafGeometry, moss[(index + i) % moss.length], [
        tip[0] + (random() - .5) * 2.15, tip[1] + (random() - .26) * .94,
        tip[2] + (random() - .5) * 1.7,
      ], canopy, false);
      foliage.scale.set(.62 + random() * .78, .29 + random() * .43, .53 + random() * .55);
      foliage.rotation.y = random() * Math.PI;
    }
  }

  // Platform planting and rubble use a fixed layout so the paths remain readable.
  for (const [x, y, z, size] of [[-5.35, .32, 5.25, .42], [5.48, .32, 4.84, .44], [-4.7, 1.77, -1.26, .46],
    [4.55, 1.77, -1.7, .36], [-3.78, 3.33, -4.03, .46], [3.99, 3.33, -3.48, .44],
    [-5.56, .31, -1.1, .42], [5.61, .32, 1.25, .4], [-4.11, .32, 5.5, .22], [.26, .32, 5.59, .28]]) {
    for (let i = 0; i < 5; i += 1) {
      const plant = mesh(rockGeometry, moss[i % moss.length], [x + (random() - .5) * .88, y + .1 + random() * .2, z + (random() - .5) * .74], stage, false);
      plant.scale.set(size * (1 + random() * .6), size * (.48 + random() * .65), size * (1 + random() * .4));
      plant.rotation.y = random() * Math.PI;
    }
  }

  for (let i = 0; i < 23; i += 1) {
    const angle = i * 2.39996;
    const radius = 8.4 + random() * 5.5;
    const object = mesh(rockGeometry, i % 3 ? deepStone : stone[0], [Math.cos(angle) * radius, -.67, Math.sin(angle) * radius], stage, false);
    object.rotation.y = angle;
    object.scale.set(.25 + random() * 1.2, .3 + random() * 1.9, .3 + random() * 1.1);
  }

  const channels = new Map();
  const selectedColor = new THREE.Color('#379e8f');
  const idleColor = new THREE.Color('#426b64');
  for (const [name, points] of Object.entries(ROUTES)) {
    const bed = matte('#354e4b');
    const routeMaterial = matte('#426b64', { emissive: '#2f8b7b', emissiveIntensity: .06 });
    for (let i = 1; i < points.length; i += 1) {
      const from = v(points[i - 1]);
      const to = v(points[i]);
      const delta = to.clone().sub(from);
      const mid = from.lerp(to, .5);
      const span = new THREE.Group();
      span.position.copy(mid);
      span.quaternion.setFromUnitVectors(forward, delta.clone().normalize());
      stage.add(span);
      const length = delta.length() + .10;
      block([.47, .11, length], [0, -.115, 0], bed, span);
      for (const side of [-1, 1]) {
        block([.074, .14, length], [side * .23, -.042, 0], edgeStone, span);
      }
    }
    const line = tube(bend(points), .055, routeMaterial);
    line.position.y = -.055;
    channels.set(name, routeMaterial);
  }

  const signal = (color) => new THREE.MeshBasicMaterial({ color, transparent: true, opacity: .88 });
  const intake = new THREE.Group();
  intake.position.set(0, 3.42, -2.35);
  stage.add(intake);
  cylinder(.83, .91, .15, [0, .06, 0], deepStone, intake, 16);
  cylinder(.69, .76, .12, [0, .19, 0], gold, intake, 16);
  cylinder(.54, .54, .049, [0, .26, 0], matte('#206d6d', { metalness: .48, roughness: .26 }), intake, 28);
  ring(.61, .038, [0, .266, 0], gold, intake);
  const intakeGlow = signal('#85d1a8');
  const pulse = ring(.77, .021, [0, .31, 0], intakeGlow, intake);
  ring(.33, .014, [0, .295, 0], intakeGlow, intake);
  for (let i = 0; i < 8; i += 1) {
    const angle = i * Math.PI / 4;
    const tile = block([.055, .021, .13], [.65 * Math.sin(angle), .279, .65 * Math.cos(angle)], darkGold, intake);
    tile.rotation.y = angle;
  }
  const bead = mesh(new THREE.OctahedronGeometry(.125), signal('#c5ffef'), [0, .61, 0], intake, false);

  function buildGate(position) {
    const group = new THREE.Group();
    group.position.set(...position);
    stage.add(group);
    cylinder(.47, .53, .14, [0, -.11, 0], deepStone, group, 16);
    cylinder(.365, .42, .13, [0, .003, 0], gold, group, 14);
    ring(.328, .018, [0, .084, 0], darkGold, group);
    const pointer = new THREE.Group();
    group.add(pointer);
    block([.10, .043, .34], [0, .099, .09], gold, pointer);
    const tip = cylinder(0, .09, .145, [0, .108, .28], gold, pointer, 3);
    tip.rotation.x = Math.PI / 2;
    const light = signal('#e2bb76');
    cylinder(.105, .105, .041, [0, .093, 0], light, group, 14);
    return { pointer, light, angle: 0 };
  }

  const gateA = buildGate(ROUTES.intake.at(-1));
  const gateB = buildGate(ROUTES.channel.at(-1));

  const stoneEnd = ROUTES.stone.at(-1);
  const stopStone = mesh(rockGeometry, stone[0], [stoneEnd[0] - .2, stoneEnd[1] + .08, stoneEnd[2]], stage);
  stopStone.scale.set(.49, .43, .52);
  stopStone.rotation.set(.13, .4, .23);
  const stoneSeal = block([.26, .032, .25], [stoneEnd[0] - .03, stoneEnd[1] + .34, stoneEnd[2] + .08], darkGold);
  stoneSeal.rotation.y = Math.PI / 4;

  const poolEnd = ROUTES.pool.at(-1);
  cylinder(.90, 1, .19, [poolEnd[0] - .22, .42, poolEnd[2] + .2], deepStone, stage, 16);
  cylinder(.77, .77, .034, [poolEnd[0] - .22, .53, poolEnd[2] + .2], matte('#286566', { metalness: .42, roughness: .27 }), stage, 24);
  ring(.79, .047, [poolEnd[0] - .22, .55, poolEnd[2] + .2], edgeStone);
  const poolRipple = ring(.57, .012, [poolEnd[0] - .22, .57, poolEnd[2] + .2], signal('#7edbd3'));

  const cornEnd = ROUTES.corn.at(-1);
  const plot = new THREE.Group();
  plot.position.set(cornEnd[0] + .23, .39, cornEnd[2] + .18);
  stage.add(plot);
  block([2.17, .17, 1.7], [0, .045, 0], soil, plot);
  for (const sign of [-1, 1]) {
    block([2.17, .14, .105], [0, .10, sign * .81], gold, plot);
    block([.105, .14, 1.59], [sign * 1.03, .10, 0], gold, plot);
  }
  const plants = new THREE.Group();
  plot.add(plants);
  const bladeGeometry = new THREE.BufferGeometry();
  bladeGeometry.setAttribute('position', new THREE.Float32BufferAttribute([
    0, 0, 0, -.09, .19, .15, -.04, .34, .39,
    0, 0, 0, -.04, .34, .39, .09, .21, .18,
  ], 3));
  bladeGeometry.computeVertexNormals();
  for (let i = 0; i < 8; i += 1) {
    const plant = new THREE.Group();
    const height = .62 + random() * .29;
    plant.position.set((i % 4 - 1.5) * .41, .13, (Math.floor(i / 4) - .5) * .6);
    plants.add(plant);
    cylinder(.021, .036, height, [0, height / 2, 0], stalk, plant, 6);
    for (let j = 0; j < 4; j += 1) {
      const blade = mesh(bladeGeometry, leaf, [0, .08 + j * height / 5, 0], plant, false);
      blade.rotation.y = i * 2 + j * 1.85;
      blade.scale.setScalar(.86 + random() * .3);
    }
    const cob = mesh(rockGeometry, kernel, [.06, height * .68, .07], plant, false);
    cob.scale.set(.064, .137, .057);
    cob.rotation.z = -.31;
  }
  const cornGlow = ring(.96, .014, [0, .13, 0], signal('#dddc79'), plot);
  cornGlow.material.opacity = .16;
  const guardian = createGuardian();
  guardian.group.position.set(2.43, .39, 5.04);
  guardian.group.rotation.y = .24;
  guardian.group.scale.setScalar(1.15);
  stage.add(guardian.group);

  for (const [x, y, z] of [[-5.33, .36, 3.11], [5.35, .36, 2.2], [-4.61, 1.80, .03], [4.41, 1.80, -.98], [-2.87, 3.37, -.99], [2.9, 3.37, -1.06]]) {
    block([.26, .59, .26], [x, y + .29, z], stone[2]);
    block([.35, .1, .35], [x, y + .62, z], gold);
    const lantern = mesh(new THREE.OctahedronGeometry(.12), signal('#a9e5ac'), [x, y + .78, z], stage, false);
    lantern.scale.y = 1.39;
  }

  const motes = [];
  const moteGeometry = new THREE.OctahedronGeometry(.035);
  const moteMaterial = signal('#f4dba2');
  moteMaterial.opacity = .64;
  for (let i = 0; i < 28; i += 1) {
    const base = v([(random() - .5) * 12.6, random() * 6.4 + .9, (random() - .5) * 9]);
    motes.push({ object: mesh(moteGeometry, moteMaterial, base.toArray(), stage, false), base, phase: random() * 10 });
  }

  const flowGroup = new THREE.Group();
  stage.add(flowGroup);
  const waterMaterial = new THREE.MeshStandardMaterial({ color: '#78eadb', emissive: '#279e9f', emissiveIntensity: .6, roughness: .26, metalness: .17 });
  const drops = [];
  const dropGeometry = new THREE.SphereGeometry(.071, 9, 7);
  for (let i = 0; i < 17; i += 1) {
    const object = mesh(dropGeometry, signal(i % 3 === 0 ? '#d0fff0' : '#68e7e1'), [0, 0, 0], stage, false);
    object.visible = false;
    drops.push(object);
  }

  const projectionAnchors = {
    intake: v([0, 3.93, -2.35]), gate1: v([0, 2.25, .55]), gate2: v([1.44, 2.25, 2.32]),
    stone: v([stoneEnd[0] - .2, stoneEnd[1] + .5, stoneEnd[2]]),
    pool: v([poolEnd[0] - .22, .60, poolEnd[2] + .2]),
    corn: v([cornEnd[0] + .23, 1.26, cornEnd[2] + .18]),
  };
  const bounds = [
    [-6.27, -.55, -3.8], [6.27, -.55, -3.8], [-6.27, -.55, 6.17], [6.27, -.55, 6.17],
    [-6.27, .37, -3.8], [6.27, .37, -3.8], [-6.27, .37, 6.17], [6.27, .37, 6.17],
    [-4.54, 3.35, -4.99], [4.54, 3.35, -4.99], [-4.54, 3.35, -.64], [4.54, 3.35, -.64],
    [-4.95, 8.05, -4.6], [4.49, 8.55, -4.2], [-.1, 10.4, -5.2], [2.75, 9.6, -6.4],
  ].map(v);
  const perspective = new THREE.PerspectiveCamera(34, 1, .05, 85);
  const overhead = new THREE.OrthographicCamera(-8, 8, 8, -8, .05, 85);
  const mainDirection = v([.37, .41, 1]).normalize();
  const overheadDirection = v([0, 1, .08]).normalize();
  const projected = new THREE.Vector3();
  const viewOffset = new THREE.Vector3();
  const picker = new THREE.Raycaster();
  const aimScreen = new THREE.Vector2();
  const aimNormal = new THREE.Vector3();
  const aimPoint = new THREE.Vector3();
  const aimPlane = new THREE.Plane();
  const carriedRain = new THREE.Vector3();
  const parkedRain = new THREE.Vector3();
  let carrying = false;
  let camera = perspective;
  let width = 0;
  let height = 0;
  let dpr = 1;
  let intakeState = 'idle';
  let flow = null;
  let flowMesh = null;
  let won = false;
  let frame = 0;

  function positionCamera() {
    const aspect = width / height;
    perspective.aspect = aspect;
    perspective.updateProjectionMatrix();
    const center = v([0, 3.66, .2]);
    let distance = 17;
    for (let i = 0; i < 18; i += 1) {
      perspective.position.copy(center).addScaledVector(mainDirection, distance);
      perspective.lookAt(center);
      perspective.updateMatrixWorld();
      let margin = 0;
      for (const point of bounds) {
        projected.copy(point).project(perspective);
        margin = Math.max(margin, Math.abs(projected.x), Math.abs(projected.y));
      }
      if (margin < .91) break;
      distance *= 1.095;
    }
    const halfHeight = Math.max(6.55, 7.1 / aspect);
    Object.assign(overhead, { left: -halfHeight * aspect, right: halfHeight * aspect, top: halfHeight, bottom: -halfHeight });
    const topCenter = v([0, 1.25, .57]);
    overhead.position.copy(topCenter).addScaledVector(overheadDirection, 21);
    overhead.lookAt(topCenter);
    overhead.updateProjectionMatrix();
    overhead.updateMatrixWorld();
  }

  function resize() {
    const nextWidth = Math.max(1, canvas.clientWidth);
    const nextHeight = Math.max(1, canvas.clientHeight);
    const nextDpr = Math.min(window.devicePixelRatio || 1, 1.75);
    if (nextWidth === width && nextHeight === height && nextDpr === dpr) return;
    width = nextWidth;
    height = nextHeight;
    dpr = nextDpr;
    renderer.setPixelRatio(dpr);
    renderer.setSize(width, height, false);
    positionCamera();
  }

  function positionFor(name) {
    const anchor = projectionAnchors[name];
    if (!anchor) return null;
    resize();
    const point = viewOffset.copy(anchor).project(camera);
    return { x: (point.x + 1) / 2, y: (1 - point.y) / 2 };
  }

  function projectHand(x, y) {
    resize();
    camera.getWorldDirection(aimNormal);
    aimPlane.setFromNormalAndCoplanarPoint(aimNormal, projectionAnchors.intake);
    picker.setFromCamera(aimScreen.set(x * 2 - 1, 1 - y * 2), camera);
    return picker.ray.intersectPlane(aimPlane, aimPoint);
  }

  function setHandPoint(point) {
    carrying = Boolean(point && projectHand(point.x, point.y));
    if (carrying) intake.worldToLocal(carriedRain.copy(aimPoint));
  }

  function pick(x, y) {
    if (!projectHand(x, y)) return null;
    const target = projectionAnchors.intake;
    const radius = THREE.MathUtils.clamp(Math.min(width, height) * .067, 26, 60);
    const viewHeight = camera.isPerspectiveCamera
      ? 2 * viewOffset.subVectors(target, camera.position).dot(aimNormal) * Math.tan(THREE.MathUtils.degToRad(camera.fov / 2))
      : (camera.top - camera.bottom) / camera.zoom;
    const worldRadius = viewHeight * radius / height;
    return aimPoint.distanceToSquared(target) <= worldRadius * worldRadius ? 'intake' : null;
  }

  function setRoute(gate1, gate2) {
    gateA.angle = gate1 === 'stone' ? -1.37 : gate1 === 'channel' ? 1.20 : Math.PI;
    gateB.angle = gate2 === 'pool' ? -1.02 : gate2 === 'corn' ? 1.02 : Math.PI;
    gateA.light.color.set(gate1 ? '#a1e0b5' : '#dcac67');
    gateB.light.color.set(gate2 ? '#a1e0b5' : '#dcac67');
    for (const [name, material] of channels) {
      const active = name === gate1 || name === gate2 || (name === 'intake' && gate1);
      material.color.copy(active ? selectedColor : idleColor);
      material.emissiveIntensity = active ? .32 : .06;
    }
  }

  function setView(view) {
    const fromAbove = view === 'overhead';
    camera = fromAbove ? overhead : perspective;
    canopy.visible = !fromAbove;
    renderer.shadowMap.needsUpdate = true;
    positionCamera();
  }

  function setIntakeState(state) {
    intakeState = state;
    intakeGlow.color.set({ idle: '#91d5a8', hover: '#c3f5b8', aligned: '#85fae5', won: '#fff0a5' }[state] ?? '#91d5a8');
  }

  function clearWater() {
    if (flow) flow.resolve(false);
    flow = null;
    if (flowMesh) {
      flowMesh.geometry.dispose();
      flowGroup.remove(flowMesh);
      flowMesh = null;
    }
    for (const drop of drops) drop.visible = false;
  }

  function playWater(outcome) {
    if (!['stone', 'pool', 'corn'].includes(outcome)) return Promise.resolve(false);
    clearWater();
    const parts = outcome === 'stone' ? ['intake', 'stone'] : ['intake', 'channel', outcome];
    const points = parts.flatMap((part, index) => ROUTES[part].slice(index === 0 ? 0 : 1));
    const path = bend(points);
    const segments = 148;
    flowMesh = tube(path, .088, waterMaterial, flowGroup, segments);
    flowMesh.geometry.setDrawRange(0, 0);
    return new Promise((resolve) => {
      flow = { path, segments, resolve, outcome, start: performance.now(), duration: outcome === 'stone' ? 1500 : 2100 };
    });
  }

  function reset() {
    clearWater();
    carrying = false;
    won = false;
    setRoute(null, null);
    setIntakeState('idle');
    plants.scale.y = 1;
    cornGlow.material.opacity = .16;
  }

  function animate(now) {
    frame = requestAnimationFrame(animate);
    resize();
    const time = now * .001;
    const pulseAmount = (1 + Math.sin(time * 3.3)) * .5;
    const pulseScale = 1 + pulseAmount * (intakeState === 'idle' ? .047 : .13);
    pulse.scale.set(pulseScale, pulseScale, 1);
    intakeGlow.opacity = .63 + pulseAmount * .33;
    parkedRain.set(0, .57 + Math.sin(time * 2.7) * .12, 0);
    bead.position.lerp(carrying ? carriedRain : parkedRain, .36);
    bead.visible = !flow && !won;
    bead.rotation.y = time * .9;
    for (const gate of [gateA, gateB]) {
      const delta = Math.atan2(Math.sin(gate.angle - gate.pointer.rotation.y), Math.cos(gate.angle - gate.pointer.rotation.y));
      gate.pointer.rotation.y += delta * .15;
    }
    poolRipple.material.opacity = .24 + pulseAmount * .2;
    poolRipple.scale.setScalar(.88 + pulseAmount * .15);
    for (const mote of motes) {
      const swing = time * .65 + mote.phase;
      mote.object.position.set(mote.base.x + Math.cos(swing) * .21, mote.base.y + Math.sin(swing * .84) * .22, mote.base.z + Math.sin(swing) * .16);
    }

    if (flow) {
      const elapsed = now - flow.start;
      const progress = THREE.MathUtils.clamp(elapsed / flow.duration, 0, 1);
      flowMesh.geometry.setDrawRange(0, Math.floor(progress * flow.segments) * 8 * 6);
      for (const [i, drop] of drops.entries()) {
        const offset = progress - i * .029;
        drop.visible = offset >= 0 && elapsed < flow.duration + 170 + i * 21;
        if (drop.visible) {
          drop.position.copy(flow.path.getPoint(Math.max(0, offset)));
          drop.position.y += .075 + Math.sin(time * 13 + i * .9) * .04;
        }
      }
      if (progress === 1 && flow.outcome === 'corn') won = true;
      if (progress === 1 && flow.outcome === 'pool') poolRipple.material.opacity = .92;
      if (elapsed > flow.duration + 515) {
        flow.resolve(true);
        flow = null;
        for (const drop of drops) drop.visible = false;
      }
    }

    for (const rootLight of rootLights) rootLight.opacity = won ? .72 + pulseAmount * .24 : .29;
    if (won) {
      plants.scale.y = THREE.MathUtils.lerp(plants.scale.y, 1.26, .047);
      cornGlow.material.opacity = .58 + pulseAmount * .35;
    }
    guardian.animate(time, won);
    renderer.render(scene, camera);
  }

  function dispose() {
    cancelAnimationFrame(frame);
    clearWater();
    const geometries = new Set();
    const materials = new Set();
    scene.traverse((object) => {
      if (object.geometry) geometries.add(object.geometry);
      if (object.material) materials.add(object.material);
    });
    for (const geometry of geometries) geometry.dispose();
    for (const material of materials) material.dispose();
    keyLight.shadow.dispose();
    renderer.dispose();
  }

  resize();
  reset();
  frame = requestAnimationFrame(animate);
  return { pick, positionFor, setHandPoint, setRoute, setView, setIntakeState, playWater, reset, dispose };
}
