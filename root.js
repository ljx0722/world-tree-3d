import * as THREE from 'three';

const soil = [-2.82, .38, 2.05];
const crack = [0, .38, 2.78];
const flood = [2.82, .38, 2.05];
const ringCenter = [0, .52, -.48];
const heart = [-2.82, 1.76, 2.05];
const anchors = { soil, crack, flood, ring: ringCenter, reward: heart };
const roots = {
  spring: [[0, .39, -.48], [-1.08, .39, -.53], [-2.01, .3, -.73], [-3.6, .23, -.85]],
  trunk: [[0, .39, -.48], [.13, .39, -1.24], [0, .48, -1.98], [0, .68, -2.82]],
  sealed: [[0, .39, -.48], [1.1, .39, -.54], [2.1, .30, -.75], [3.28, .32, -.92]],
};
const axis = [
  [0, -.12, -2.91], [.10, 1.1, -2.81], [-.18, 3.45, -2.79],
  [.08, 5.45, -2.64], [.5, 7.06, -2.81], [.22, 8.55, -3.07],
];
const views = {
  perspective: { eye: [5.1, 7.15, 13.2], target: [0, .62, .28] },
  overhead: { eye: [0, 16.1, 4.2], target: [0, .14, .16] },
  reveal: { eye: [10.5, 10.65, 18.9], target: [0, 4.1, -1.78] },
};
const directions = { spring: Math.PI / 2, trunk: 0, sealed: -Math.PI / 2 };
const patchHighlight = { idle: '#9fcbad', hover: '#b9f2ce', aligned: '#f6d787', won: '#ffdc89' };
const vector = (point) => new THREE.Vector3(...point);
const path = (points) => new THREE.CatmullRomCurve3(points.map(vector));
const clamp = (value) => THREE.MathUtils.clamp(value, 0, 1);
const ease = (value) => THREE.MathUtils.smoothstep(value, 0, 1);

export function createRootScene(canvas) {
  const scene = new THREE.Scene();
  const caveColor = new THREE.Color('#111827');
  const revealColor = new THREE.Color('#233b40');
  scene.background = caveColor.clone();
  scene.fog = new THREE.FogExp2(caveColor, .026);
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: false });
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.35;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.shadowMap.autoUpdate = false;
  renderer.shadowMap.needsUpdate = true;

  scene.add(new THREE.HemisphereLight('#e4f0f1', '#36304f', 2.0));
  const key = new THREE.DirectionalLight('#ffdfae', 2.6);
  key.position.set(-4, 11, 8);
  key.castShadow = true;
  key.shadow.mapSize.set(1024, 1024);
  Object.assign(key.shadow.camera, { left: -9, right: 9, top: 10, bottom: -9, far: 40 });
  key.shadow.normalBias = .04;
  scene.add(key);
  const rim = new THREE.DirectionalLight('#5de0cb', 1.55);
  rim.position.set(5, 8, -7);
  scene.add(rim);

  const stage = new THREE.Group();
  scene.add(stage);
  const clay = (color, extra = {}) => new THREE.MeshStandardMaterial({ color, roughness: .8, flatShading: true, ...extra });
  const lit = (color, extra = {}) => new THREE.MeshBasicMaterial({ color, ...extra });
  const stone = ['#38394e', '#4c4d63', '#535670', '#65617a'].map((color) => clay(color));
  const deep = clay('#272b42');
  const damp = clay('#496455', { roughness: .56 });
  const jade = clay('#4d8c76');
  const bronze = clay('#ba8a53', { metalness: .58, roughness: .31 });
  const bark = clay('#605047');
  const oldBark = clay('#514d56');
  const rootVein = clay('#7e9a73', { emissive: '#245749', emissiveIntensity: .22 });
  const leaves = ['#42877b', '#60966c', '#82a378', '#b4aa69'].map((color) => clay(color));
  const sphere = new THREE.SphereGeometry(1, 18, 12);
  const pebble = new THREE.IcosahedronGeometry(1, 0);
  const clump = new THREE.IcosahedronGeometry(1, 1);
  let randomState = 1246;
  const random = () => {
    randomState = (Math.imul(randomState, 1664525) + 1013904223) >>> 0;
    return randomState / 4294967296;
  };

  function mesh(geometry, material, position, parent = stage, shadow = true) {
    const object = new THREE.Mesh(geometry, material);
    object.position.set(...position);
    object.castShadow = shadow;
    object.receiveShadow = shadow;
    parent.add(object);
    return object;
  }

  function oval(geometry, material, position, size, parent = stage, shadow = true) {
    const object = mesh(geometry, material, position, parent, shadow);
    object.scale.set(...size);
    return object;
  }

  function disc(radius, height, material, position, sides = 14, parent = stage) {
    return mesh(new THREE.CylinderGeometry(radius, radius * .93, height, sides), material, position, parent);
  }

  function torus(radius, width, material, position, parent = stage) {
    const object = mesh(new THREE.TorusGeometry(radius, width, 8, 60), material, position, parent, false);
    object.rotation.x = -Math.PI / 2;
    return object;
  }

  function tube(points, radius, material, parent = stage, segments = 36) {
    const curve = Array.isArray(points) ? path(points) : points;
    return mesh(new THREE.TubeGeometry(curve, segments, radius, 8), material, [0, 0, 0], parent, false);
  }

  function tapered(points, startRadius, endRadius, material, parent = stage) {
    const curve = path(points);
    const segments = 38;
    const sides = 8;
    const geometry = new THREE.TubeGeometry(curve, segments, 1, sides);
    const vertices = geometry.attributes.position;
    for (let i = 0; i <= segments; i += 1) {
      const t = i / segments;
      const center = curve.getPointAt(t);
      const radius = THREE.MathUtils.lerp(startRadius, endRadius, t) * (1 + .065 * Math.sin(t * 21));
      for (let j = 0; j <= sides; j += 1) {
        const index = i * (sides + 1) + j;
        vertices.setXYZ(index,
          center.x + (vertices.getX(index) - center.x) * radius,
          center.y + (vertices.getY(index) - center.y) * radius,
          center.z + (vertices.getZ(index) - center.z) * radius);
      }
    }
    geometry.computeVertexNormals();
    return mesh(geometry, material, [0, 0, 0], parent);
  }

  const water = clay('#2b7480', { metalness: .2, roughness: .22 });
  const island = disc(5.85, .55, stone[1], [0, -.22, .12], 10);
  island.scale.z = .84;
  const plinth = disc(6.26, .6, deep, [0, -.76, .12], 10);
  plinth.scale.z = .85;
  const undergroundWater = disc(9.4, .11, clay('#253c58', { metalness: .2, roughness: .37 }), [0, -1.12, .0], 28);
  undergroundWater.scale.z = .8;
  const shore = lit('#436980', { transparent: true, opacity: .53 });
  for (const [x, z, radius] of [[-6.5, 1.1, .93], [5.74, 3.6, .81], [-5.4, 4.2, .42], [3.95, -5.2, .88]]) {
    torus(radius, .012, shore, [x, -1.04, z]);
    torus(radius * .68, .012, shore, [x, -1.04, z]);
  }

  const rockFormations = new THREE.Group();
  stage.add(rockFormations);
  for (const [x, z, height] of [[-5.9, -2.4, 2.75], [-5.68, -.7, 1.3], [5.97, -2.54, 2.55], [5.8, -.85, 1.34], [-3.4, -4.7, 2.2], [3.6, -4.7, 2.45], [-6.05, 1.95, .76], [6.3, 1.5, .7]]) {
    const object = oval(pebble, stone[Math.floor(random() * stone.length)], [x, height * .34 - .2, z],
      [.82 + random() * .7, height * .68, .85 + random() * .42], rockFormations);
    object.rotation.set(random() * .23, random() * 3, (random() - .5) * .3);
  }
  const crystals = [clay('#52a1a2', { emissive: '#1d575d', emissiveIntensity: .37, roughness: .45 }),
    clay('#9d91c2', { emissive: '#423e69', emissiveIntensity: .45, roughness: .38 })];
  const crystalGeo = new THREE.ConeGeometry(.18, 1, 5);
  for (const [x, z] of [[-4.9, -.25], [4.68, .3], [-3.9, -2.91], [4.66, -3.06], [1.55, 4.05], [-4.1, 2.5]]) {
    for (let i = 0; i < 3; i += 1) {
      const height = .35 + random() * .64;
      const crystal = oval(crystalGeo, crystals[i % 2], [x + (i - 1) * .22, height * .44, z + (i % 2) * .23],
        [.55 + random() * .65, height, .7], stage, false);
      crystal.rotation.z = (i - 1) * .3;
    }
  }
  for (let i = 0; i < 48; i += 1) {
    const a = random() * Math.PI * 2;
    const radius = 4.78 + random() * .58;
    const scale = .07 + random() * .16;
    const rock = oval(pebble, stone[i % stone.length], [Math.cos(a) * radius, .07, Math.sin(a) * radius * .76 + .12], [scale, scale * .5, scale * 1.12]);
    rock.rotation.y = a;
  }

  const tree = new THREE.Group();
  stage.add(tree);
  tapered(axis, .66, .21, bark, tree);
  const boughs = [
    [[-.05, 4.35, -2.76], [-.98, 5.25, -2.6], [-2.37, 6.31, -2.49], [-3.12, 7.12, -2.85]],
    [[.27, 5.83, -2.71], [1.40, 6.13, -2.81], [2.6, 7.02, -3.18], [3.48, 7.93, -3.2]],
    [[.26, 6.8, -2.8], [-.19, 7.3, -3.76], [-1.1, 8.08, -4.48]],
    [[.12, 4.93, -2.64], [1.4, 5.15, -1.71], [2.06, 5.88, -1.47]],
  ];
  for (const branch of boughs) tapered(branch, .3, .059, bark, tree);
  for (const points of [
    [[0, .52, -2.73], [-1.2, .22, -2.7], [-2.35, .25, -2.91], [-3.76, .1, -3.0], [-4.6, -.02, -2.7]],
    [[0, .51, -2.78], [1.25, .33, -2.77], [2.32, .18, -2.59], [3.49, .06, -3.23], [4.5, -.04, -3.17]],
    [[-.11, .48, -2.48], [-.96, .21, -1.79], [-1.76, .14, -.42], [-3.04, .12, .54], [-3.8, .07, 1.35]],
    [[.1, .43, -2.57], [.8, .28, -1.63], [1.48, .12, -.61], [2.75, .10, .39], [4.0, .06, 1.16]],
    [[-.02, .51, -2.93], [-.4, .16, -3.7], [-.79, -.04, -4.54]],
  ]) tapered(points, .37, .045, oldBark, tree);
  tube([[0, .57, -2.55], [-.12, 1.58, -2.28], [-.43, 3.18, -2.46], [-.31, 4.28, -2.39], [.04, 5.38, -2.22]], .036, rootVein, tree);
  const crown = new THREE.Group();
  tree.add(crown);
  const canopyPatches = [[-3, 7.25, -2.72, 1.23], [-2.1, 7.62, -3.09, 1.42], [-.9, 8.52, -3.84, 1.23], [.24, 8.82, -3.04, 1.48],
    [1.51, 8.36, -3.17, 1.18], [2.78, 8.0, -3.3, 1.35], [3.58, 7.75, -3.24, 1.0], [1.85, 6.16, -1.48, .82], [-.76, 7.53, -1.85, .95]];
  for (const [index, [x, y, z, radius]] of canopyPatches.entries()) {
    const foliage = oval(clump, leaves[index % leaves.length], [x, y, z], [radius, radius * .58, radius * .8], crown);
    foliage.rotation.set(.18, random() * 4, (random() - .5) * .35);
    oval(pebble, leaves[(index + 1) % leaves.length], [x + .41, y + .3, z + .42], [radius * .72, radius * .49, radius * .58], crown);
  }
  const crownGlow = lit('#ffdf8b', { transparent: true, opacity: .15, toneMapped: false });
  const crownBeacons = [];
  for (const [x, y, z] of [[-2.84, 7.72, -1.73], [-1.71, 7.98, -1.96], [-.65, 8.91, -3.16], [.4, 9.27, -2.43], [1.43, 8.83, -2.48], [2.55, 8.36, -2.22], [3.42, 8.15, -2.55]]) {
    crownBeacons.push(oval(pebble, crownGlow, [x, y, z], [.16, .21, .14], crown, false));
  }
  const sun = torus(.68, .027, crownGlow, [.21, 10.05, -3.08], crown);
  sun.rotation.x = 0;
  const sunCore = oval(pebble, crownGlow, [.21, 10.05, -3.08], [.27, .35, .17], crown, false);

  const springPool = disc(.72, .1, water, [-3.67, .16, -.87], 19);
  springPool.scale.z = .71;
  const springRipple = lit('#9ce6cc', { transparent: true, opacity: .42 });
  torus(.53, .022, springRipple, [-3.67, .224, -.87]).scale.y = .74;
  const sealed = mesh(new THREE.BoxGeometry(.63, .68, .31), stone[0], [3.27, .37, -.92]);
  sealed.rotation.y = -.2;
  tube([[3.05, .19, -.744], [3.22, .37, -.72], [3.38, .49, -.74], [3.48, .64, -.75]], .029, bronze);

  const routeInk = new Map();
  for (const [name, coordinates] of Object.entries(roots)) {
    tube(coordinates, .115, deep);
    const material = clay('#638c7e', { emissive: '#37685f', emissiveIntensity: .21, roughness: .45 });
    tube(coordinates.map(([x, y, z]) => [x, y + .055, z]), .042, material);
    routeInk.set(name, material);
  }
  disc(1.02, .24, deep, [0, .17, -.48]);
  disc(.95, .22, jade, [0, .34, -.48], 18);
  const dial = new THREE.Group();
  dial.position.set(...ringCenter);
  stage.add(dial);
  torus(.86, .061, bronze, [0, 0, 0], dial);
  torus(.67, .028, rootVein, [0, .008, 0], dial);
  for (let i = 0; i < 12; i += 1) {
    const a = i * Math.PI / 6;
    const pin = mesh(new THREE.BoxGeometry(.082, .047, .13), i % 3 === 0 ? bronze : rootVein,
      [Math.sin(a) * .762, .042, Math.cos(a) * .762], dial, false);
    pin.rotation.y = a;
  }
  const arrow = new THREE.Shape();
  arrow.moveTo(-.11, .25);
  arrow.lineTo(.11, .25);
  arrow.lineTo(.11, -.27);
  arrow.lineTo(.23, -.27);
  arrow.lineTo(0, -.64);
  arrow.lineTo(-.23, -.27);
  arrow.lineTo(-.11, -.27);
  arrow.closePath();
  const dialNeedle = mesh(new THREE.ShapeGeometry(arrow), lit('#fee3a4', { side: THREE.DoubleSide }), [0, .057, 0], dial, false);
  dialNeedle.rotation.x = Math.PI / 2;
  oval(pebble, bronze, [0, .094, 0], [.152, .1, .152], dial);

  const patches = { soil: damp, crack: stone[2], flood: water };
  const patchGlows = new Map();
  for (const [name, material] of Object.entries(patches)) {
    const [x, , z] = anchors[name];
    disc(1.03, .25, stone[0], [x, .16, z], 12);
    disc(.89, .13, material, [x, .33, z], name === 'crack' ? 9 : 20);
    const trim = lit('#79bda8', { transparent: true, opacity: .43 });
    torus(.98, .022, trim, [x, .348, z]);
    patchGlows.set(name, trim);
  }
  const furrows = clay('#617659');
  for (const lane of [-.38, 0, .38]) {
    tube([[-3.42, .409, 2.05 + lane], [-3.09, .426, 1.99 + lane], [-2.74, .43, 2.10 + lane], [-2.31, .409, 2.03 + lane]], .027, furrows);
  }
  for (const [x, z, radius] of [[-3.37, 2.43, .15], [-2.55, 1.67, .12], [-2.25, 2.35, .15], [-3.12, 1.79, .12]]) {
    oval(pebble, leaves[1], [x, .42, z], [radius, radius * .43, radius * .9]);
  }
  for (const points of [
    [[-.6, .403, 2.36], [-.24, .403, 2.57], [.03, .406, 2.53], [.28, .406, 2.79], [.69, .403, 2.92]],
    [[.03, .407, 2.53], [.08, .407, 2.8], [-.18, .407, 3.24], [-.16, .403, 3.51]],
  ]) tube(points, .037, deep);
  oval(pebble, stone[3], [.52, .46, 2.42], [.21, .085, .17]);
  const floodRipple = lit('#83d8de', { transparent: true, opacity: .38 });
  for (const size of [.25, .46, .67]) torus(size, .013, floodRipple, [2.82, .409, 2.05]);
  const reed = clay('#778d65', { side: THREE.DoubleSide });
  for (let i = 0; i < 5; i += 1) {
    tube([[3.29 + i * .038, .35, 1.6 + i * .05], [3.31 + i * .038, .59 + i * .042, 1.57 + i * .05],
      [3.39 + i * .038, .63 + i * .043, 1.57 + i * .05]], .022, reed);
  }

  const snake = new THREE.Group();
  snake.position.set(3.45, .12, -2.57);
  stage.add(snake);
  const scales = clay('#479f8c', { roughness: .47 });
  const belly = clay('#bee0ad');
  const eyeWhite = clay('#f5e8bf');
  const ink = clay('#172c3b');
  const blush = clay('#d9a895');
  tapered([[0, .96, .27], [.26, .57, .06], [.85, .21, -.15], [1.28, .19, -.69], [.92, .2, -1.02], [.45, .17, -.79]], .24, .063, scales, snake);
  tube([[.19, .62, .22], [.49, .39, .05], [.79, .34, -.02], [1.1, .33, -.22]], .078, belly, snake);
  const snakeHead = new THREE.Group();
  snakeHead.position.set(0, .98, .27);
  snake.add(snakeHead);
  oval(sphere, scales, [0, 0, 0], [.47, .34, .35], snakeHead);
  oval(sphere, belly, [0, -.12, .245], [.32, .19, .146], snakeHead);
  const eyes = new THREE.Group();
  snakeHead.add(eyes);
  for (const side of [-1, 1]) {
    oval(sphere, eyeWhite, [side * .188, .075, .265], [.127, .144, .073], eyes);
    oval(sphere, ink, [side * .173, .064, .325], [.073, .09, .033], eyes);
    oval(sphere, lit('#ffffff'), [side * .173 - .026, .103, .351], [.023, .027, .011], eyes, false);
    oval(sphere, blush, [side * .263, -.082, .315], [.073, .043, .026], snakeHead);
  }
  tube([[-.108, -.101, .381], [-.041, -.145, .393], [.038, -.147, .395], [.103, -.098, .382]], .013, ink, snakeHead, 12);
  for (const [x, y, z] of [[-.13, .29, -.04], [.06, .32, -.04], [.24, .25, -.07]]) {
    const fin = oval(pebble, leaves[3], [x, y, z], [.075, .17, .072], snakeHead);
    fin.rotation.z = -.22 - x;
  }

  const sprout = new THREE.Group();
  sprout.position.set(soil[0], .394, soil[2]);
  stage.add(sprout);
  tube([[0, 0, 0], [-.09, .39, .012], [-.07, .63, .015], [.04, .86, -.03]], .047, clay('#78bc68'), sprout, 24);
  const leafMaterial = clay('#95ce76', { roughness: .58 });
  const leftLeaf = oval(sphere, leafMaterial, [-.19, .55, -.032], [.27, .064, .12], sprout);
  leftLeaf.rotation.z = -.46;
  const rightLeaf = oval(sphere, leafMaterial, [.14, .72, -.045], [.24, .057, .12], sprout);
  rightLeaf.rotation.z = .54;
  const bud = oval(pebble, clay('#f1c978', { emissive: '#986634', emissiveIntensity: .28 }),
    [.02, .87, -.018], [.10, .12, .094], sprout);

  const heartShape = new THREE.Shape();
  heartShape.moveTo(0, -.37);
  heartShape.bezierCurveTo(-.19, -.16, -.44, .015, -.40, .24);
  heartShape.bezierCurveTo(-.37, .47, -.12, .48, 0, .29);
  heartShape.bezierCurveTo(.12, .48, .37, .47, .40, .24);
  heartShape.bezierCurveTo(.44, .015, .19, -.16, 0, -.37);
  const reward = new THREE.Group();
  reward.position.set(...heart);
  stage.add(reward);
  const heartStone = mesh(new THREE.ExtrudeGeometry(heartShape, {
    depth: .14, bevelEnabled: true, bevelThickness: .06, bevelSize: .055, bevelSegments: 3,
  }), clay('#f8b76f', { metalness: .26, roughness: .36, emissive: '#db824d', emissiveIntensity: .48 }),
  [0, 0, -.08], reward, false);
  const heartHalo = torus(.53, .023, lit('#f8d889', { transparent: true, opacity: .63 }), [0, .037, 0], reward);
  heartHalo.rotation.x = 0;

  const seedMaterial = clay('#e6b468', { emissive: '#a76740', emissiveIntensity: .36, roughness: .45 });
  const seedToken = oval(pebble, seedMaterial, [0, 0, 0], [.126, .209, .116], stage, false);
  const carriedSeed = oval(pebble, seedMaterial, [0, 0, 0], [.13, .206, .121], stage, false);
  const flareMaterial = lit('#8eeacb', { transparent: true, opacity: .9 });
  const flare = oval(sphere, flareMaterial, [0, 0, 0], [.14, .14, .14], stage, false);
  const rippleMaterial = lit('#9ef2dc', { transparent: true, opacity: .9 });
  const effectRipple = torus(.45, .025, rippleMaterial, [0, 0, 0]);
  const sparks = [];
  const sparkGeometry = new THREE.OctahedronGeometry(1);
  for (let i = 0; i < 12; i += 1) sparks.push(oval(sparkGeometry, flareMaterial, [0, 0, 0], [.05, .075, .05], stage, false));
  const lifePath = path([
    [soil[0], .7, soil[2]], [-2.44, .62, .54], [-1.42, .48, -.38], [0, .7, -1.93],
    [.42, 1.62, -2.23], [-.15, 3.2, -2.19], [-.49, 4.43, -2.49], [.06, 5.37, -2.13],
    [.82, 6.38, -2.53], [.49, 7.48, -2.26], [.24, 8.57, -2.12], [.21, 9.77, -2.91],
  ]);
  const lifeMaterial = lit('#ffdc91', { transparent: true, opacity: .91, toneMapped: false });
  const lifeLine = tube(lifePath, .065, lifeMaterial, stage, 120);
  const lifeHalo = tube(lifePath, .15, lit('#ffce7a', { transparent: true, opacity: .14, depthWrite: false, toneMapped: false }), stage, 120);
  const lifeTip = oval(sparkGeometry, lifeMaterial, [0, 0, 0], [.19, .28, .19], stage, false);
  const motes = [];
  const moteMaterial = lit('#f5d995', { transparent: true, opacity: .64 });
  for (let i = 0; i < 22; i += 1) {
    const base = vector([(random() - .5) * 10.5, .35 + random() * 4.7, (random() - .5) * 8.3]);
    const size = .015 + random() * .022;
    motes.push({ object: oval(sparkGeometry, moteMaterial, base.toArray(), [size, size, size], stage, false), base, offset: random() * 7 });
  }

  const camera = new THREE.PerspectiveCamera(40, 1, .08, 80);
  const cameraTarget = vector(views.perspective.target);
  const nextPosition = new THREE.Vector3();
  const nextTarget = new THREE.Vector3();
  const revealPosition = vector(views.reveal.eye);
  const revealTarget = vector(views.reveal.target);
  camera.position.set(...views.perspective.eye);
  camera.lookAt(cameraTarget);
  camera.updateMatrixWorld();
  const pointer = new THREE.Vector2();
  const picker = new THREE.Raycaster();
  const handPlane = new THREE.Plane();
  const handPosition = new THREE.Vector3();
  const handNormal = new THREE.Vector3();
  const handCenter = vector([0, .81, 1.38]);
  const pickMaterial = new THREE.MeshBasicMaterial({ visible: false });
  const hits = new Map();
  for (const name of ['soil', 'crack', 'flood', 'reward']) {
    const hit = oval(sphere, pickMaterial, anchors[name], name === 'reward' ? [.70, .64, .58] : [1.03, .65, .99], stage, false);
    hit.userData.name = name;
    hits.set(name, hit);
  }
  const plantingTargets = ['soil', 'crack', 'flood'].map((name) => hits.get(name));
  const rewardTarget = [hits.get('reward')];
  const progressPoint = new THREE.Vector3();
  const projected = new THREE.Vector3();
  let width = 0;
  let height = 0;
  let frame;
  let phase = 'planning';
  let view = 'perspective';
  let intakeState = 'idle';
  let route = null;
  let patch = null;
  let handPoint = null;
  let growing = false;
  let won = false;
  let active = null;

  function resize() {
    const bounds = canvas.getBoundingClientRect();
    const nextWidth = Math.max(1, Math.round(bounds.width));
    const nextHeight = Math.max(1, Math.round(bounds.height));
    if (width === nextWidth && height === nextHeight) return;
    width = nextWidth;
    height = nextHeight;
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.65));
    renderer.setSize(width, height, false);
    camera.aspect = width / height;
    camera.updateProjectionMatrix();
  }

  function setRoute(gate1, gate2) {
    route = Object.hasOwn(directions, gate1) ? gate1 : null;
    patch = Object.hasOwn(patches, gate2) ? gate2 : null;
    for (const [name, material] of routeInk) {
      material.color.set(name === route ? '#97d6ac' : '#638c7e');
      material.emissiveIntensity = name === route ? .75 : .21;
    }
  }

  function setView(nextView) {
    view = nextView === 'overhead' ? 'overhead' : 'perspective';
  }

  function setPhase(nextPhase) {
    phase = nextPhase;
  }

  function setIntakeState(nextState) {
    intakeState = nextState;
  }

  function setHandPoint(point) {
    handPoint = point;
  }

  function pick(x, y, currentPhase = phase) {
    const eligible = currentPhase === 'collect' ? rewardTarget :
      currentPhase === 'planning' || currentPhase === 'ready' ? plantingTargets : null;
    if (!eligible || x < 0 || x > 1 || y < 0 || y > 1) return null;
    camera.updateMatrixWorld();
    picker.setFromCamera(pointer.set(x * 2 - 1, 1 - y * 2), camera);
    return picker.intersectObjects(eligible, false)[0]?.object.userData.name ?? null;
  }

  function positionFor(anchor) {
    const target = anchors[anchor];
    if (!target || (anchor === 'reward' && (phase !== 'collect' || active?.outcome === 'claim'))) return null;
    if (anchor === 'reward') projected.copy(reward.position);
    else projected.set(...target);
    projected.project(camera);
    if (projected.z < -1 || projected.z > 1) return null;
    return { x: (projected.x + 1) * .5, y: (1 - projected.y) * .5 };
  }

  function clearEffects() {
    active?.resolve(false);
    active = null;
    seedToken.visible = false;
    flare.visible = false;
    effectRipple.visible = false;
    lifeTip.visible = false;
    for (const spark of sparks) spark.visible = false;
  }

  function playWater(outcome) {
    if (!['crack', 'flood', 'spring', 'sealed', 'sprout'].includes(outcome)) return Promise.resolve(false);
    clearEffects();
    const durations = { crack: 1160, flood: 1340, spring: 1580, sealed: 1460, sprout: 2150 };
    return new Promise((resolve) => {
      active = { outcome, resolve, start: performance.now(), duration: durations[outcome] };
    });
  }

  function playClaim() {
    clearEffects();
    growing = true;
    return new Promise((resolve) => {
      active = { outcome: 'claim', resolve, start: performance.now(), duration: 3300 };
    });
  }

  function reset() {
    clearEffects();
    setRoute(null, null);
    setIntakeState('idle');
    setPhase('planning');
    growing = false;
    won = false;
    handPoint = null;
    reward.visible = false;
    sprout.visible = false;
    carriedSeed.visible = false;
    lifeLine.visible = false;
    lifeHalo.visible = false;
    lifeLine.geometry.setDrawRange(0, 0);
    lifeHalo.geometry.setDrawRange(0, 0);
  }

  function showRipple(point, color, progress) {
    effectRipple.visible = progress >= 0 && progress < 1;
    effectRipple.position.set(point[0], point[1] + .045, point[2]);
    effectRipple.scale.setScalar(.23 + ease(clamp(progress)) * 2.05);
    rippleMaterial.color.set(color);
    rippleMaterial.opacity = 1 - clamp(progress);
  }

  function scatter(point, color, progress, tall = false) {
    flareMaterial.color.set(color);
    flareMaterial.opacity = 1 - clamp(progress);
    for (let i = 0; i < sparks.length; i += 1) {
      const angle = i * Math.PI * 2 / sparks.length;
      const distance = (.23 + (i % 4) * .105) * ease(clamp(progress));
      sparks[i].visible = progress >= 0 && progress < 1;
      sparks[i].position.set(point[0] + Math.cos(angle) * distance,
        point[1] + Math.sin(clamp(progress) * Math.PI) * (tall ? .92 : .42) + .06,
        point[2] + Math.sin(angle) * distance);
    }
  }

  const routePaths = Object.fromEntries(Object.entries(roots).map(([name, points]) => [name, path(points)]));
  function animateAction(outcome, progress) {
    const bed = outcome === 'crack' ? crack : outcome === 'flood' ? flood : soil;
    const dip = ease(clamp(progress * 3.2));
    const bounce = (outcome === 'crack' || outcome === 'flood') ? Math.sin(ease(clamp((progress - .34) * 1.9)) * Math.PI) * .52 : 0;
    seedToken.position.set(bed[0], bed[1] + .085 + (1 - dip) * .94 + bounce, bed[2]);
    seedToken.rotation.set(progress * .85, progress * 3.2, .22);
    seedToken.visible = progress < (outcome === 'sprout' ? .55 : .91);

    if (outcome === 'crack' || outcome === 'flood') {
      const color = outcome === 'crack' ? '#e4ae82' : '#97e5ed';
      showRipple(bed, color, (progress - .30) * 1.8);
      scatter(bed, color, (progress - .30) * 1.8, outcome === 'flood');
      return;
    }
    const destination = outcome === 'sprout' ? 'trunk' : outcome;
    const color = outcome === 'sealed' ? '#ffbd8e' : '#9ef4db';
    const travel = clamp((progress - .21) / .46);
    flare.visible = progress > .21 && progress < .7;
    flareMaterial.color.set(color);
    flareMaterial.opacity = .95;
    routePaths[destination].getPointAt(ease(travel), progressPoint);
    flare.position.copy(progressPoint).addScaledVector(THREE.Object3D.DEFAULT_UP, .115);
    const terminal = roots[destination].at(-1);
    showRipple(terminal, color, (progress - .62) * 2.6);
    scatter(terminal, color, (progress - .62) * 2.6, outcome === 'spring');
    if (outcome === 'sprout') {
      const growth = ease(clamp((progress - .42) / .56));
      sprout.visible = growth > 0;
      sprout.scale.setScalar(Math.max(.03, growth));
      showRipple(soil, '#e8e9a4', (progress - .65) * 2.86);
    }
  }

  function animateClaim(progress) {
    const trail = ease(clamp((progress - .075) / .81));
    const drawCount = Math.floor(trail * 120) * 8 * 6;
    lifeLine.visible = true;
    lifeLine.geometry.setDrawRange(0, drawCount);
    lifeHalo.visible = true;
    lifeHalo.geometry.setDrawRange(0, drawCount);
    lifeTip.visible = trail > 0 && trail < 1;
    lifeTip.position.copy(lifePath.getPointAt(trail, progressPoint));
    lifeTip.rotation.y = progress * Math.PI * 5;
    showRipple(soil, '#ffdb8d', progress * 3.5);
    return ease(clamp((progress - .12) / .77));
  }

  function finishEffect() {
    const finished = active;
    if (finished.outcome === 'sprout') growing = true;
    if (finished.outcome === 'claim') won = true;
    active = null;
    clearEffects();
    finished.resolve(true);
  }

  function animate(now) {
    frame = requestAnimationFrame(animate);
    resize();
    const time = now * .001;
    const breath = (1 + Math.sin(time * 2.9)) * .5;
    const targetAngle = directions[route] ?? Math.PI;
    dial.rotation.y += Math.atan2(Math.sin(targetAngle - dial.rotation.y), Math.cos(targetAngle - dial.rotation.y)) * .15;
    snakeHead.position.y = .98 + Math.sin(time * 2.35) * .036;
    snakeHead.rotation.z = Math.sin(time * 1.45) * .047;
    eyes.scale.y = Math.min(1, .13 + Math.abs(Math.sin(time * .78 + 1.37)) * 5.4);
    for (const [name, material] of patchGlows) {
      const current = name === patch || (intakeState === 'won' && name === 'soil');
      material.color.set(current ? patchHighlight[intakeState] ?? patchHighlight.idle : '#709389');
      material.opacity = current ? .69 + .29 * breath : .36;
    }
    springRipple.opacity = .32 + .19 * breath;
    floodRipple.opacity = .35 + .2 * breath;
    for (const { object, base, offset } of motes) {
      object.position.set(base.x + Math.cos(time * .77 + offset) * .25, base.y + Math.sin(time * .61 + offset) * .22, base.z + Math.sin(time * .53 + offset) * .19);
    }
    bud.rotation.y = time * .69;
    reward.visible = phase === 'collect' && !active && !won;
    reward.position.y = heart[1] + Math.sin(time * 3.2) * .10;
    reward.rotation.y = Math.sin(time * 1.43) * .42;
    heartStone.rotation.z = Math.sin(time * 1.13) * .07;
    heartHalo.scale.setScalar(1 + breath * .12);
    sprout.visible = growing;
    if (growing) sprout.scale.setScalar(1);

    let reveal = won ? 1 : 0;
    if (active) {
      const progress = clamp((now - active.start) / active.duration);
      if (active.outcome === 'claim') reveal = animateClaim(progress);
      else animateAction(active.outcome, progress);
      if (progress >= 1) finishEffect();
    }
    crownGlow.opacity = .13 + reveal * (.58 + .22 * breath);
    sun.scale.setScalar(.73 + reveal * (.23 + .05 * breath));
    sunCore.rotation.y = time * .7;
    for (const [index, beacon] of crownBeacons.entries()) beacon.rotation.y = time * (.6 + index * .06);
    scene.background.copy(caveColor).lerp(revealColor, reveal);
    scene.fog.color.copy(scene.background);
    crown.visible = view !== 'overhead' || reveal > 0;

    const preset = views[view];
    nextPosition.set(...preset.eye).lerp(revealPosition, reveal);
    nextTarget.set(...preset.target).lerp(revealTarget, reveal);
    const aspectShift = Math.max(0, 1.21 - camera.aspect) * .6;
    nextPosition.addScaledVector(projected.subVectors(nextPosition, nextTarget), aspectShift);
    camera.position.lerp(nextPosition, .15);
    cameraTarget.lerp(nextTarget, .15);
    camera.lookAt(cameraTarget);
    camera.updateMatrixWorld();
    carriedSeed.visible = Boolean(handPoint && !active && (phase === 'planning' || phase === 'ready'));
    if (carriedSeed.visible) {
      camera.getWorldDirection(handNormal);
      handPlane.setFromNormalAndCoplanarPoint(handNormal, handCenter);
      picker.setFromCamera(pointer.set(handPoint.x * 2 - 1, 1 - handPoint.y * 2), camera);
      if (picker.ray.intersectPlane(handPlane, handPosition)) carriedSeed.position.copy(handPosition);
      carriedSeed.rotation.set(.32, time * .92, -.22);
    }
    renderer.render(scene, camera);
  }

  function dispose() {
    cancelAnimationFrame(frame);
    clearEffects();
    const geometries = new Set();
    const materials = new Set();
    scene.traverse((object) => {
      if (object.geometry) geometries.add(object.geometry);
      if (object.material) materials.add(object.material);
    });
    for (const geometry of geometries) geometry.dispose();
    for (const material of materials) material.dispose();
    key.shadow.dispose();
    renderer.dispose();
  }

  reset();
  resize();
  stage.updateMatrixWorld(true);
  frame = requestAnimationFrame(animate);
  return { setRoute, pick, positionFor, setView, setPhase, setIntakeState, setHandPoint, playWater, playClaim, reset, dispose };
}
