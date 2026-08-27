import * as THREE from 'three';

// 彗星：随机轨迹掠过太阳系的小天体，拖着渐隐的粒子尾迹
// 周期性重置轨迹，让星空"活"起来，又不干扰主场景
export function createComet() {
  const group = new THREE.Group();

  // 彗核：微小发光球
  const headGeo = new THREE.SphereGeometry(1.2, 16, 16);
  const headMat = new THREE.MeshBasicMaterial({ color: 0xdff2ff });
  const head = new THREE.Mesh(headGeo, headMat);
  group.add(head);

  // 尾迹：一串渐隐的粒子点，沿运动反方向排列
  // 粒子使用径向渐变圆形贴图——若无贴图，gl.POINTS 默认渲染为方块，
  // 会在行星前显示成"方形光标"
  const glowCvs = document.createElement('canvas');
  glowCvs.width = 64; glowCvs.height = 64;
  const gctx = glowCvs.getContext('2d');
  const grd = gctx.createRadialGradient(32, 32, 0, 32, 32, 32);
  grd.addColorStop(0, 'rgba(255,255,255,1)');
  grd.addColorStop(0.35, 'rgba(255,255,255,0.55)');
  grd.addColorStop(1, 'rgba(255,255,255,0)');
  gctx.fillStyle = grd;
  gctx.fillRect(0, 0, 64, 64);
  const glowTex = new THREE.CanvasTexture(glowCvs);

  const tailCount = 60;
  const positions = new Float32Array(tailCount * 3);
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  const tailMat = new THREE.PointsMaterial({
    color: 0xbfe8ff,
    size: 1.6,
    map: glowTex,
    alphaTest: 0.01,
    transparent: true,
    opacity: 0.55,
    blending: THREE.AdditiveBlending,
    depthWrite: false
  });
  const tail = new THREE.Points(geo, tailMat);
  group.add(tail);

  // 轨迹参数
  const state = {
    dir: new THREE.Vector3(),
    pos: new THREE.Vector3(),
    speed: 3.2,
    length: 0,        // 已飞行距离
    active: false,
    nextLaunch: 200 + Math.random() * 400  // 多少帧后发射
  };

  function launch() {
    // 随机起点（远处球面一点）与大致横穿的方向
    const theta = Math.random() * Math.PI * 2;
    const y = (Math.random() - 0.5) * 500;
    const r = 1500;
    state.pos.set(Math.cos(theta) * r, y, Math.sin(theta) * r);
    // 朝原点附近偏一点的随机目标，形成掠过效果
    state.dir.set(
      (Math.random() - 0.5) * 0.6,
      (Math.random() - 0.5) * 0.15,
      (Math.random() - 0.5) * 0.6
    ).normalize();
    state.speed = 2.6 + Math.random() * 2.2;
    state.length = 0;
    state.active = true;
    group.visible = true;
  }

  function update() {
    if (!state.active) {
      state.nextLaunch--;
      if (state.nextLaunch <= 0) launch();
      return;
    }

    state.pos.addScaledVector(state.dir, state.speed);
    state.length += state.speed;
    head.position.copy(state.pos);

    // 尾迹粒子沿反方向排布并逐渐散开
    const attr = geo.attributes.position;
    for (let i = 0; i < tailCount; i++) {
      const t = i / tailCount;
      const spread = t * 6;
      attr.setXYZ(
        i,
        state.pos.x - state.dir.x * t * 90 + (Math.random() - 0.5) * spread,
        state.pos.y - state.dir.y * t * 90 + (Math.random() - 0.5) * spread,
        state.pos.z - state.dir.z * t * 90 + (Math.random() - 0.5) * spread
      );
    }
    attr.needsUpdate = true;

    // 飞远后重置，等待下一次发射
    if (state.length > 3200 || state.pos.length() > 2600) {
      state.active = false;
      group.visible = false;
      state.nextLaunch = 300 + Math.random() * 600;
    }
  }

  group.userData.update = update;
  group.visible = false;
  return group;
}