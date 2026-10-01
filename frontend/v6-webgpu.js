/* ============================================================
   Aetheris v6 — WebGPU Renderer (N)
   Menggantikan WebGL renderer saat diaktifkan.
   Fitur: 8000 partikel, volumetric depth fog, emissive nodes.
   ============================================================ */

export async function isWebGPUAvailable() {
  if (!navigator.gpu) return false;
  try {
    const adapter = await navigator.gpu.requestAdapter();
    return !!adapter;
  } catch { return false; }
}

export async function createWebGPURenderer(container) {
  const THREE = await import('three');
  const { WebGPURenderer } = await import('three/webgpu');

  const renderer = new WebGPURenderer({
    antialias: true,
    alpha: false,
    forceWebGL: false,
  });
  await renderer.init();

  renderer.setSize(container.clientWidth, container.clientHeight);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.setClearColor(0x020617, 1);

  return { renderer, THREE };
}

export function buildWebGPUScene(THREE, scene, result) {
  // Node meshes pakai MeshBasicMaterial (glow via emissive intensity tinggi)
  const nodeGroup = new THREE.Group();
  nodeGroup.name = 'wgpu-nodes';
  scene.add(nodeGroup);

  const edgeGroup = new THREE.Group();
  edgeGroup.name = 'wgpu-edges';
  scene.add(edgeGroup);

  // Particle field (background ambient)
  const N = 8000;
  const positions = new Float32Array(N * 3);
  const colors = new Float32Array(N * 3);
  const speeds = new Float32Array(N);
  const rng = () => Math.random();
  for (let i = 0; i < N; i++) {
    const r = 6 + rng() * 14;
    const theta = rng() * Math.PI * 2;
    const phi = Math.acos(2 * rng() - 1);
    positions[i*3]   = r * Math.sin(phi) * Math.cos(theta);
    positions[i*3+1] = r * Math.cos(phi);
    positions[i*3+2] = r * Math.sin(phi) * Math.sin(theta);
    const t = rng();
    colors[i*3]   = 0.1 + 0.3 * t;
    colors[i*3+1] = 0.5 + 0.4 * (1 - t);
    colors[i*3+2] = 0.9;
    speeds[i] = 0.1 + rng() * 0.4;
  }
  const pGeo = new THREE.BufferGeometry();
  pGeo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  pGeo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  const pMat = new THREE.PointsMaterial({
    size: 0.06, vertexColors: true,
    transparent: true, opacity: 0.8,
    blending: THREE.AdditiveBlending, depthWrite: false,
  });
  const particles = new THREE.Points(pGeo, pMat);
  particles.name = 'wgpu-particles';
  particles.userData.speeds = speeds;
  scene.add(particles);

  // Volumetric fog layer (backdrop plane)
  const fogGeo = new THREE.PlaneGeometry(60, 60);
  const fogMat = new THREE.MeshBasicMaterial({
    color: 0x0a1628, transparent: true, opacity: 0.35,
    depthWrite: false, side: THREE.DoubleSide,
  });
  const fog = new THREE.Mesh(fogGeo, fogMat);
  fog.position.z = -18;
  fog.name = 'wgpu-fog';
  scene.add(fog);

  // Initial render of nodes
  rebuildNodes(THREE, nodeGroup, edgeGroup, result);

  return { nodeGroup, edgeGroup, particles, fog };
}

export function rebuildNodes(THREE, nodeGroup, edgeGroup, result) {
  while (nodeGroup.children.length) nodeGroup.remove(nodeGroup.children[0]);
  while (edgeGroup.children.length) edgeGroup.remove(edgeGroup.children[0]);

  const geo = new THREE.SphereGeometry(0.32, 20, 20);
  const meshes = [];
  result.positions.forEach(([x, y, z]) => {
    const mat = new THREE.MeshBasicMaterial({ color: 0x22d3ee });
    const m = new THREE.Mesh(geo, mat);
    m.position.set(x, y, z);
    nodeGroup.add(m);
    meshes.push(m);
  });

  const edgeMat = new THREE.LineBasicMaterial({
    color: 0x38bdf8, transparent: true, opacity: 0.4,
  });
  result.edges.forEach(([i, j]) => {
    const g = new THREE.BufferGeometry().setFromPoints([
      new THREE.Vector3(...result.positions[i]),
      new THREE.Vector3(...result.positions[j]),
    ]);
    edgeGroup.add(new THREE.Line(g, edgeMat));
  });

  return meshes;
}

export function updateWebGPUScene(THREE, nodeGroup, result) {
  const meshes = nodeGroup.children;
  if (meshes.length !== result.positions.length) return;
  const last = result.c_agents[result.c_agents.length - 1];
  const maxC = Math.max(0.5, ...last);
  last.forEach((c, i) => {
    const t = Math.min(1, c / maxC);
    const col = new THREE.Color().setHSL(0.55 - 0.55 * t, 0.9, 0.55);
    const m = meshes[i];
    if (m?.material) m.material.color.copy(col);
    m?.scale.setScalar(0.7 + 1.4 * t);
  });
}

export function animateParticles(particles, dt) {
  if (!particles) return;
  const pos = particles.geometry.attributes.position.array;
  const speeds = particles.userData.speeds;
  const N = pos.length / 3;
  for (let i = 0; i < N; i++) {
    const s = speeds[i] * dt;
    pos[i*3+1] += s;
    if (pos[i*3+1] > 12) pos[i*3+1] = -12;
  }
  particles.geometry.attributes.position.needsUpdate = true;
}