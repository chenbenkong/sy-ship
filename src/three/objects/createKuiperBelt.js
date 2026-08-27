import * as THREE from 'three';

// 柯伊伯带（海王星轨道之外的冰质小天体带）
// 真实范围约 30~55 AU（本仿真中海王星=800、冥王星=900，
// 故取 920~1400 单位，覆盖冥王星轨道外侧的经典带主体）。
// 天体以冰岩混合物为主（水冰、甲烷冰、氮冰），反照率略高于小行星带岩石，
// 视觉呈冷蓝灰色调。尺寸同样服从幂律分布——绝大多数为碎砾级，
// 仅极少数接近阋神星/冥卫一级。

// 远视角下碎砾粒子为亚像素级，补充一层由 Canvas 生成的弥散光环盘，
// 让柯伊伯带在缩小视野中呈现为一圈隐约可见的冷色背景带
// （参照 NASA 可视化图中将柯伊伯带渲染为弥散环的惯例）。
function createKuiperDisk(innerRadius, outerRadius) {
  const size = 1024;
  const cvs = document.createElement('canvas');
  cvs.width = size;
  cvs.height = size;
  const ctx = cvs.getContext('2d');
  ctx.clearRect(0, 0, size, size);

  const cx = size / 2, cy = size / 2;
  const rInner = (innerRadius / outerRadius) * (size / 2 - 8);
  const rOuter = size / 2 - 8;

  // 数千个弥散斑点，颜色在冷蓝灰与暖灰（索林红）之间变化
  for (let i = 0; i < 5200; i++) {
    const t = Math.pow(Math.random(), 0.8);
    const r = rInner + t * (rOuter - rInner);
    const a = Math.random() * Math.PI * 2;
    const x = cx + r * Math.cos(a);
    const y = cy + r * Math.sin(a);
    const s = 0.6 + Math.random() * 2.2;
    const cold = Math.random() < 0.75;
    const alpha = 0.05 + Math.random() * 0.13;
    ctx.fillStyle = cold
      ? `rgba(150, 175, 210, ${alpha})`
      : `rgba(190, 160, 140, ${alpha})`;
    ctx.beginPath();
    ctx.arc(x, y, s, 0, Math.PI * 2);
    ctx.fill();
  }

  const tex = new THREE.CanvasTexture(cvs);
  tex.colorSpace = THREE.SRGBColorSpace;

  const disk = new THREE.Mesh(
    new THREE.PlaneGeometry(outerRadius * 2, outerRadius * 2),
    new THREE.MeshBasicMaterial({
      map: tex,
      transparent: true,
      opacity: 0.5,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      side: THREE.DoubleSide
    })
  );
  disk.rotation.x = -Math.PI / 2;
  return disk;
}

export function createKuiperBelt(innerRadius = 3600, outerRadius = 6000, count = 6500) {
  const group = new THREE.Group();

  const geometry = new THREE.IcosahedronGeometry(1, 0);
  const material = new THREE.MeshStandardMaterial({
    color: 0xffffff, // 基色白，逐实例着冷蓝灰/冰色
    roughness: 0.9,
    metalness: 0.0,
    flatShading: true
  });

  const mesh = new THREE.InstancedMesh(geometry, material, count);
  const dummy = new THREE.Object3D();
  const color = new THREE.Color();

  for (let i = 0; i < count; i++) {
    // 径向密度向内侧略高（经典带 + 共振天体聚集）
    const t = Math.pow(Math.random(), 0.8);
    const r = innerRadius + t * (outerRadius - innerRadius);
    const theta = Math.random() * Math.PI * 2;

    // 轨道倾角弥散比小行星带略大（真实柯伊伯带倾角弥散 ~10°+），
    // 仍有部分高倾角散射盘天体
    const highIncl = Math.random() < 0.18;
    const y = (Math.random() + Math.random() + Math.random() - 1.5) * (highIncl ? 90 : 32);

    dummy.position.set(r * Math.cos(theta), y, r * Math.sin(theta));
    dummy.rotation.set(
      Math.random() * Math.PI,
      Math.random() * Math.PI,
      Math.random() * Math.PI
    );

    // 幂律尺寸：0.05 ~ 1.4，向小端集中；个别达到矮行星级
    const s = 0.08 + Math.pow(Math.random(), 5.5) * 1.5;
    dummy.scale.set(s, s * (0.6 + Math.random() * 0.8), s);
    dummy.updateMatrix();
    mesh.setMatrixAt(i, dummy.matrix);

    // 冰岩混合色：冷蓝灰为主，少量偏红（富索林表面，如创神星类）
    if (Math.random() < 0.25) {
      color.setHSL(0.05 + Math.random() * 0.03, 0.25 + Math.random() * 0.15, 0.42 + Math.random() * 0.22);
    } else {
      color.setHSL(0.55 + Math.random() * 0.08, 0.12 + Math.random() * 0.20, 0.55 + Math.random() * 0.32);
    }
    mesh.setColorAt(i, color);
  }

  mesh.instanceMatrix.needsUpdate = true;
  if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
  mesh.castShadow = false;
  mesh.receiveShadow = false;
  group.add(mesh);

  group.add(createKuiperDisk(innerRadius, outerRadius));

  return group;
}
