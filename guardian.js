import * as THREE from 'three';

const faceForward = new THREE.Vector3(0, 0, 1);

export function createGuardian() {
  const group = new THREE.Group();
  group.name = '麦皮';
  const rig = new THREE.Group();
  group.add(rig);

  const surface = (color, roughness = .8) => new THREE.MeshStandardMaterial({ color, roughness });
  const fur = surface('#d99037');
  const crown = surface('#eba644');
  const ivory = surface('#ffe1a6');
  const ear = surface('#c57858');
  const coffee = surface('#503122');
  const eye = surface('#231b18', .28);
  const gleam = surface('#fff4d6', .42);
  const canvas = surface('#426760');
  const seam = surface('#9d6842');
  const seed = surface('#f0bc58');
  const sphere = new THREE.SphereGeometry(1, 16, 12);

  function oval(parent, material, position, size, shadow = false) {
    const object = new THREE.Mesh(sphere, material);
    object.position.set(...position);
    object.scale.set(...size);
    object.castShadow = shadow;
    parent.add(object);
    return object;
  }

  function curve(parent, points, radius, material, segments = 18) {
    const path = new THREE.CatmullRomCurve3(points.map((point) => new THREE.Vector3(...point)));
    const mesh = new THREE.Mesh(new THREE.TubeGeometry(path, segments, radius, 6, false), material);
    parent.add(mesh);
  }

  function markings(parent, center, radii, placements) {
    const geometry = new THREE.RingGeometry(.54, 1, 7);
    const patterns = new THREE.InstancedMesh(geometry, coffee, placements.length);
    const pose = new THREE.Object3D();
    for (const [index, [x, y, z, size, roll]] of placements.entries()) {
      const direction = new THREE.Vector3(x, y, z).normalize();
      const normal = direction.clone().divide(radii).normalize();
      pose.position.copy(direction).multiply(radii).add(center).addScaledVector(normal, .005);
      pose.quaternion.setFromUnitVectors(faceForward, normal);
      pose.rotateZ(roll);
      pose.scale.set(size, size * .8, 1);
      pose.updateMatrix();
      patterns.setMatrixAt(index, pose.matrix);
    }
    patterns.instanceMatrix.needsUpdate = true;
    parent.add(patterns);
  }

  const bodyCenter = new THREE.Vector3(0, .313, -.067);
  const bodySize = new THREE.Vector3(.222, .235, .291);
  const body = oval(rig, fur, bodyCenter.toArray(), bodySize.toArray(), true);
  oval(rig, ivory, [0, .348, .164], [.147, .166, .071]);
  markings(rig, bodyCenter, bodySize, [
    [-.95, .28, -.16, .039, .3], [-.89, .46, .32, .041, .9], [-.91, .16, .53, .028, -.6],
    [-.62, .73, -.38, .04, .8], [.85, .48, -.39, .036, 1], [.94, .31, .07, .033, .2],
    [.73, .66, .28, .032, -.9], [.94, -.16, -.54, .034, .4],
  ]);

  const paws = [];
  for (const side of [-1, 1]) {
    const heel = oval(rig, fur, [side * .151, .129, -.216], [.126, .129, .174]);
    heel.rotation.y = side * .14;
    const foot = new THREE.Group();
    foot.position.set(side * .122, .083, .174);
    oval(foot, crown, [0, 0, 0], [.094, .076, .131], true);
    oval(foot, ivory, [0, -.012, .085], [.074, .048, .053]);
    rig.add(foot);
    paws.push(foot);
  }

  const tail = new THREE.Group();
  tail.position.set(.115, .168, -.273);
  curve(tail, [[0, 0, 0], [.15, -.022, -.19], [.32, .008, -.23], [.417, .085, -.17], [.421, .169, -.085]], .045, fur);
  const tailTip = oval(tail, coffee, [.421, .162, -.086], [.049, .056, .063]);
  tailTip.rotation.x = .66;
  rig.add(tail);

  const head = new THREE.Group();
  head.position.set(0, .692, .094);
  rig.add(head);
  const headSize = new THREE.Vector3(.271, .232, .225);
  oval(head, crown, [0, 0, 0], headSize.toArray(), true);
  for (const side of [-1, 1]) {
    const ears = new THREE.Group();
    ears.position.set(side * .204, .168, -.02);
    ears.rotation.z = -side * .25;
    oval(ears, coffee, [0, 0, 0], [.092, .097, .050]);
    oval(ears, crown, [0, -.012, .027], [.079, .078, .035]);
    oval(ears, ear, [0, -.009, .055], [.049, .051, .016]);
    head.add(ears);
  }
  markings(head, new THREE.Vector3(), headSize, [
    [-.75, .57, .46, .030, -.9], [-.40, .79, .58, .032, .6], [-.11, .90, .51, .023, .1],
    [.21, .86, .56, .026, 1.2], [.54, .75, .54, .029, .5], [.85, .33, .48, .031, -.3],
    [-.96, -.19, .35, .027, .6], [.96, -.16, .31, .027, 1.3],
  ]);

  const eyes = new THREE.Group();
  eyes.position.y = .041;
  head.add(eyes);
  for (const side of [-1, 1]) {
    oval(eyes, seam, [side * .114, 0, .184], [.065, .076, .041]);
    oval(eyes, eye, [side * .114, 0, .215], [.047, .062, .032]);
    oval(eyes, gleam, [side * .114 - .016, .021, .241], [.015, .018, .009]);
    const brow = oval(head, coffee, [side * .12, .126, .162], [.040, .011, .014]);
    brow.rotation.z = side * .16;
  }

  for (const side of [-1, 1]) {
    oval(head, ivory, [side * .069, -.080, .195], [.105, .072, .083]);
    for (let i = 0; i < 3; i += 1) {
      oval(head, seam, [side * (.092 + .021 * i), -.083 + (i % 2) * .024, .272 - .007 * i], [.007, .006, .005]);
    }
  }
  oval(head, ivory, [0, -.138, .171], [.088, .043, .074]);
  const noseShape = new THREE.Shape();
  noseShape.moveTo(-.043, .012);
  noseShape.quadraticCurveTo(-.037, .026, 0, .023);
  noseShape.quadraticCurveTo(.037, .026, .043, .012);
  noseShape.quadraticCurveTo(.047, 0, .012, -.018);
  noseShape.quadraticCurveTo(0, -.028, -.012, -.018);
  noseShape.quadraticCurveTo(-.047, 0, -.043, .012);
  const nose = new THREE.Mesh(new THREE.ShapeGeometry(noseShape), eye);
  nose.position.set(0, -.052, .279);
  head.add(nose);
  curve(head, [[-.044, -.107, .272], [-.024, -.111, .275], [0, -.103, .277], [.024, -.111, .275], [.044, -.107, .272]], .0037, coffee, 12);

  curve(rig, [[-.15, .506, .087], [-.10, .467, .193], [-.015, .41, .242], [.109, .343, .249], [.199, .302, .185], [.243, .278, .093]], .019, seam);
  const satchel = new THREE.Group();
  satchel.position.set(.225, .276, .097);
  satchel.rotation.z = .16;
  rig.add(satchel);
  oval(satchel, canvas, [0, 0, 0], [.107, .111, .075]);
  oval(satchel, seam, [0, .043, .046], [.091, .048, .035]);
  const seedBadge = oval(satchel, seed, [0, .022, .079], [.024, .038, .009]);
  seedBadge.rotation.z = -.45;

  let wasWon = false;
  let victoryAt = 0;
  function animate(seconds, won) {
    if (won && !wasWon) victoryAt = seconds;
    wasWon = won;
    const reaction = won ? Math.min(1, Math.max(0, (seconds - victoryAt) / 1.25)) : 1;
    const cheer = reaction === 1 ? 0 : Math.sin(reaction * Math.PI);
    const breath = Math.sin(seconds * 2.6);
    const blinkDistance = Math.abs((seconds + 1.2) % 4.8 - 4.52);
    eyes.scale.y = 1 - .95 * Math.max(0, 1 - blinkDistance / .12);
    body.scale.y = bodySize.y + breath * .009;
    rig.position.y = cheer * .13;
    head.position.y = .692 + breath * .009 + cheer * .042;
    head.rotation.x = breath * .027 - cheer * .09;
    head.rotation.y = Math.sin(seconds * 1.15) * .10;
    head.rotation.z = Math.sin(seconds * 1.4) * .037 + cheer * .14;
    paws[1].position.y = .083 + cheer * .14;
    paws[1].rotation.x = -.47 * cheer;
    tail.rotation.y = Math.sin(seconds * 2.35) * .15 + Math.sin(reaction * 15) * cheer * .23;
  }

  return { group, animate };
}
