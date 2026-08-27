import * as THREE from 'three';

/**
 * 「曙光号」舰桥控制室内舱（第一视角专用）——全面优化版。
 * 视点锚定在本地坐标 (0, 3.35, -1.2)，面朝舰首 -Z。
 * 设计基调：星际迷航式淡蓝白联邦舰桥——
 *   - 环形舱壁 + 大面积环绕舷窗（全景通透，直看太空）
 *   - 弧形全息主控制台（低矮不挡视线）
 *   - 左右侧工作站 + 舰长席
 *   - 中央全息星图台
 *   - 环形灯带 + 走道光带照明
 */

// 仪表屏 Canvas 贴图（雷达 / 波形 / 数据条 / 姿态 四种样式）
function makeScreenTexture(kind) {
  const cvs = document.createElement('canvas');
  cvs.width = 256;
  cvs.height = 140;
  const ctx = cvs.getContext('2d');

  const bg = kind === 'amber' ? '#1c1204' : '#041018';
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, 256, 140);
  const line = kind === 'amber' ? '#ffb840' : '#35c8ff';
  const dim = kind === 'amber' ? 'rgba(255,184,64,0.22)' : 'rgba(53,200,255,0.18)';

  // 网格
  ctx.strokeStyle = dim;
  ctx.lineWidth = 1;
  for (let x = 0; x <= 256; x += 32) {
    ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, 140); ctx.stroke();
  }
  for (let y = 0; y <= 140; y += 28) {
    ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(256, y); ctx.stroke();
  }

  if (kind === 'radar') {
    ctx.strokeStyle = line;
    ctx.lineWidth = 2;
    ctx.beginPath(); ctx.arc(128, 70, 52, 0, Math.PI * 2); ctx.stroke();
    ctx.lineWidth = 1;
    ctx.beginPath(); ctx.arc(128, 70, 34, 0, Math.PI * 2); ctx.stroke();
    ctx.beginPath(); ctx.arc(128, 70, 16, 0, Math.PI * 2); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(128, 70); ctx.lineTo(176, 36); ctx.stroke();
    ctx.fillStyle = line;
    [[142, 52], [108, 88], [150, 84]].forEach(([px, py]) => {
      ctx.beginPath(); ctx.arc(px, py, 3, 0, Math.PI * 2); ctx.fill();
    });
  } else if (kind === 'wave') {
    ctx.strokeStyle = line;
    ctx.lineWidth = 2;
    ctx.beginPath();
    for (let x = 0; x < 256; x += 4) {
      const y = 70 + Math.sin(x * 0.09) * 26 + Math.sin(x * 0.023) * 14;
      x === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
    }
    ctx.stroke();
  } else if (kind === 'attitude') {
    // 姿态仪：双圆 + 十字准线
    ctx.strokeStyle = line;
    ctx.lineWidth = 2;
    ctx.beginPath(); ctx.arc(128, 70, 46, 0, Math.PI * 2); ctx.stroke();
    ctx.lineWidth = 1;
    ctx.beginPath(); ctx.arc(128, 70, 30, 0, Math.PI * 2); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(128 - 60, 70); ctx.lineTo(128 + 60, 70); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(128, 10); ctx.lineTo(128, 130); ctx.stroke();
    ctx.fillStyle = line;
    ctx.beginPath(); ctx.arc(128, 70, 4, 0, Math.PI * 2); ctx.fill();
  } else {
    ctx.fillStyle = line;
    [86, 54, 108, 40, 72, 96, 60].forEach((h, i) => {
      ctx.fillRect(22 + i * 32, 118 - h, 18, h);
    });
  }

  // 屏角标识
  ctx.fillStyle = dim;
  ctx.fillRect(8, 8, 40, 3);
  ctx.fillRect(8, 15, 24, 3);

  const tex = new THREE.CanvasTexture(cvs);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

// 动态数据屏：由场景每帧绘制航行数据（目的地 / 坐标 / 距离 / 时速）
function makeDataScreenTexture() {
  const cvs = document.createElement('canvas');
  cvs.width = 960;
  cvs.height = 400;
  const ctx = cvs.getContext('2d');
  const tex = new THREE.CanvasTexture(cvs);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 8;
  tex.minFilter = THREE.LinearFilter;
  tex.magFilter = THREE.LinearFilter;
  return { canvas: cvs, ctx, texture: tex };
}

export function createBridgeInterior() {
  const group = new THREE.Group();
  group.name = 'BridgeInterior';

  // 视点参考（与 createEnterprise 的 cockpit 锚点一致）
  const eye = new THREE.Vector3(0, 3.35, -1.2);

  // ---- 材质（淡蓝白联邦风）----
  const wallMat = new THREE.MeshStandardMaterial({
    color: 0xcfd8e4, roughness: 0.6, metalness: 0.35, side: THREE.DoubleSide
  });
  const darkMat = new THREE.MeshStandardMaterial({
    color: 0x232a33, roughness: 0.55, metalness: 0.5, side: THREE.DoubleSide
  });
  const trimMat = new THREE.MeshStandardMaterial({
    color: 0x9fb2c8, roughness: 0.45, metalness: 0.55
  });
  const consoleMat = new THREE.MeshStandardMaterial({
    color: 0x5a6672, roughness: 0.5, metalness: 0.45
  });
  const stripMat = new THREE.MeshStandardMaterial({
    color: 0x0e2436, emissive: 0x35c8ff, emissiveIntensity: 1.6
  });
  const stripWarm = new THREE.MeshStandardMaterial({
    color: 0x241804, emissive: 0xffb240, emissiveIntensity: 1.3
  });
  const glassMat = new THREE.MeshPhysicalMaterial({
    color: 0xffffff, metalness: 0, roughness: 0.02,
    transparent: true, opacity: 0.02, side: THREE.DoubleSide,
    depthWrite: false
  });
  const frameMat = new THREE.MeshStandardMaterial({
    color: 0x8fa0b4, roughness: 0.45, metalness: 0.6
  });

  // ---- 舱室尺寸 ----
  const roomR = 4.2;          // 舱室半径（圆形舱）
  const floorY = eye.y - 1.7; // 1.65 降低地板，减小下方结构在视野中的占比
  const ceilY = eye.y + 1.5;  // 4.85
  const roomH = ceilY - floorY;
  const centerZ = eye.z + 0.6;

  // ===== 环形舱壁（圆形舱体，前向大舷窗开口） =====
  // 舷窗弧段覆盖前方约 200°（theta ∈ [PI-1.75, PI+1.75]），开阔太空一览无遗；
  // 舱壁仅覆盖后方约 160°（放驾驶椅与侧工作站）。
  const WIN_HALF = 1.75; // 舷窗半弧（弧度）
  const wallGeo = new THREE.CylinderGeometry(roomR, roomR, roomH, 48, 1, true, Math.PI + WIN_HALF, Math.PI * 2 - WIN_HALF * 2);
  const wall = new THREE.Mesh(wallGeo, wallMat);
  wall.position.set(0, (floorY + ceilY) / 2, centerZ);
  group.add(wall);

  // 舱壁内侧竖向装饰肋
  for (let i = 0; i < 12; i++) {
    const a = (i / 12) * Math.PI * 2;
    // 前向（舷窗方向）留空
    if (Math.abs(a - Math.PI * 1.5) < WIN_HALF) continue;
    const rib = new THREE.Mesh(new THREE.BoxGeometry(0.1, roomH * 0.85, 0.1), trimMat);
    rib.position.set(Math.cos(a) * (roomR - 0.1), (floorY + ceilY) / 2, centerZ + Math.sin(a) * (roomR - 0.1));
    group.add(rib);
  }

  // ===== 地板 + 走道光带 =====
  const floor = new THREE.Mesh(new THREE.CircleGeometry(roomR * 0.7, 48), darkMat);
  floor.rotation.x = -Math.PI / 2;
  floor.position.set(0, floorY, centerZ);
  group.add(floor);
  const floorStrip = new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.02, roomR * 1.2), stripMat);
  floorStrip.position.set(0, floorY + 0.02, centerZ - 0.4);
  group.add(floorStrip);
  // 环形地脚灯
  const floorRing = new THREE.Mesh(new THREE.TorusGeometry(roomR * 0.7 - 0.22, 0.03, 8, 64), stripMat);
  floorRing.rotation.x = Math.PI / 2;
  floorRing.position.set(0, floorY + 0.03, centerZ);
  group.add(floorRing);

  // ===== 天花板 + 环形灯带 =====
  const ceil = new THREE.Mesh(new THREE.CircleGeometry(roomR, 48), wallMat);
  ceil.rotation.x = Math.PI / 2;
  ceil.position.set(0, ceilY, centerZ);
  group.add(ceil);
  const ceilRing = new THREE.Mesh(new THREE.TorusGeometry(roomR * 0.62, 0.05, 8, 64), stripWarm);
  ceilRing.rotation.x = Math.PI / 2;
  ceilRing.position.set(0, ceilY - 0.03, centerZ);
  group.add(ceilRing);
  const ceilDisc = new THREE.Mesh(new THREE.CircleGeometry(roomR * 0.3, 32), stripMat);
  ceilDisc.rotation.x = Math.PI / 2;
  ceilDisc.position.set(0, ceilY - 0.04, centerZ);
  group.add(ceilDisc);

  // ===== 前向全景舷窗（弧形大玻璃，无窗棂，直看太空） =====
  const winHalfW = 3.4;
  const winTopY = ceilY - 0.35;
  const winBotY = floorY + 0.26;
  const frontZ = eye.z - 3.2; // -4.4
  const glass = new THREE.Mesh(
    new THREE.CylinderGeometry(roomR - 0.05, roomR - 0.05, winTopY - winBotY, 32, 1, true, Math.PI - WIN_HALF, WIN_HALF * 2),
    glassMat
  );
  glass.position.set(0, (winTopY + winBotY) / 2, centerZ);
  group.add(glass);

  // 舷窗上下金属包边
  const topFrame = new THREE.Mesh(
    new THREE.CylinderGeometry(roomR - 0.05, roomR - 0.05, ceilY - winTopY, 32, 1, true, Math.PI - WIN_HALF, WIN_HALF * 2),
    wallMat
  );
  topFrame.position.set(0, (ceilY + winTopY) / 2, centerZ);
  group.add(topFrame);
  const botFrame = new THREE.Mesh(
    new THREE.CylinderGeometry(roomR - 0.05, roomR - 0.05, winBotY - floorY, 32, 1, true, Math.PI - WIN_HALF, WIN_HALF * 2),
    wallMat
  );
  botFrame.position.set(0, (winBotY + floorY) / 2, centerZ);
  group.add(botFrame);
  // 窗沿细发光条（上沿冰蓝，与舷窗同弧段）
  const topGlow = new THREE.Mesh(
    new THREE.CylinderGeometry(roomR - 0.04, roomR - 0.04, 0.05, 32, 1, true, Math.PI - WIN_HALF, WIN_HALF * 2),
    stripMat
  );
  topGlow.position.set(0, winTopY, centerZ);
  group.add(topGlow);

  // ===== 弧形全息主控制台（低矮、贴舷窗，不挡视野） =====
  const consoleZ = eye.z - 1.5;
  // 小半圆弧形台面：内半径 1.5 / 外半径 2.4，半张角 1.2（约138°），贴合地板弧度，朝舰首 -Z 展开
  const makeAnnulusSector = (r1, r2, half, height) => {
    const shape = new THREE.Shape();
    const a0 = Math.PI / 2 - half, a1 = Math.PI / 2 + half;
    shape.moveTo(r1 * Math.cos(a0), r1 * Math.sin(a0));
    shape.lineTo(r2 * Math.cos(a0), r2 * Math.sin(a0));
    shape.absarc(0, 0, r2, a0, a1, false);
    shape.lineTo(r1 * Math.cos(a1), r1 * Math.sin(a1));
    shape.absarc(0, 0, r1, a1, a0, true);
    const geo = new THREE.ExtrudeGeometry(shape, { depth: height, bevelEnabled: false });
    geo.rotateX(-Math.PI / 2); // 形状 +Y → 世界 -Z（舰首方向）
    return geo;
  };
  const desk = new THREE.Mesh(makeAnnulusSector(1.2, 1.85, 1.0, 0.14), consoleMat);
  desk.position.set(0, eye.y - 1.0, eye.z - 0.4);
  group.add(desk);
  // 台面前缘冰蓝发光条（小半圆弧形，贴合地板弧度）
  const deskEdge = new THREE.Mesh(makeAnnulusSector(1.78, 1.88, 1.0, 0.03), stripMat);
  deskEdge.position.set(0, eye.y - 1.0, eye.z - 0.4);
  group.add(deskEdge);
  // 仪表屏：中央大屏为动态航行数据屏，两侧为静态雷达/数据屏
  const dataScreen = makeDataScreenTexture();
  // 初始填充待机画面，避免首帧空白
  renderDataScreen(dataScreen, { dest: '待机', coord: { x: 0, y: 0, z: 0 }, dist: null, speed: 0 });
  // 小圆半弧形状：底边直线 + 顶部平缓弧（贴合台面弧度）
  const makeSemiArcShape = (width, height) => {
    const shape = new THREE.Shape();
    const r = width / 2;
    shape.moveTo(-r, 0);
    shape.quadraticCurveTo(0, height * 2.2, r, 0);
    shape.lineTo(-r, 0);
    return shape;
  };
  // ===== 3D 悬浮全息控制台（史诗级全息投影） =====
  const holoEdgeMat = new THREE.MeshBasicMaterial({
    color: 0x1f6f9e, transparent: true, opacity: 0.18,
    side: THREE.DoubleSide, blending: THREE.AdditiveBlending, depthWrite: false
  });
  const holoGroup = new THREE.Group();
  holoGroup.position.set(0, eye.y - 0.46, eye.z - 2.3); // 贴画面底部，拉近放大保证文字清晰
  holoGroup.scale.setScalar(1.3);
  group.add(holoGroup);

  // 中央数据全息屏（紧凑数据纹理，半透明自发光）
  const holoScreen = new THREE.Mesh(
    new THREE.PlaneGeometry(0.98, 0.41), // 960x400 canvas 同比例
    new THREE.MeshBasicMaterial({
      map: dataScreen.texture, transparent: true, opacity: 0.72, side: THREE.DoubleSide,
      depthWrite: false
    })
  );
  holoScreen.position.set(0, -0.1, 0.55);
  holoGroup.add(holoScreen);

  // 扫描底座环（缩小、下移、弱化，作为数据屏底部扫描底盘，不遮挡星球）
  // 扫描环：隐藏3D发光环，扫描动效改由数据屏内嵌雷达承担（清除浅蓝辉光层）
  const ringH = new THREE.Mesh(new THREE.TorusGeometry(0.5, 0.008, 8, 72), holoEdgeMat);
  ringH.rotation.x = Math.PI / 2;
  ringH.position.y = -0.5;
  ringH.visible = false;
  holoGroup.add(ringH);
  const ringTilt = new THREE.Mesh(new THREE.TorusGeometry(0.42, 0.007, 8, 64), holoEdgeMat);
  ringTilt.rotation.x = Math.PI / 2 + 0.35;
  ringTilt.position.y = -0.4;
  ringTilt.visible = false;
  holoGroup.add(ringTilt);
  const ringV = new THREE.Mesh(new THREE.TorusGeometry(0.34, 0.006, 6, 56), holoEdgeMat);
  ringV.rotation.y = Math.PI / 2;
  ringV.position.y = -0.28;
  ringV.visible = false;
  holoGroup.add(ringV);

  // 环绕粒子场
  const pCount = 30;
  const pGeo = new THREE.BufferGeometry();
  const pPos = new Float32Array(pCount * 3);
  for (let i = 0; i < pCount; i++) {
    const a = Math.random() * Math.PI * 2;
    const rr = 0.42 + Math.random() * 0.42;
    const y = -0.65 + Math.random() * 0.55;
    pPos[i * 3] = Math.cos(a) * rr;
    pPos[i * 3 + 1] = y;
    pPos[i * 3 + 2] = Math.sin(a) * rr;
  }
  pGeo.setAttribute('position', new THREE.BufferAttribute(pPos, 3));
  const pMat = new THREE.PointsMaterial({
    color: 0x3a9cc8, size: 0.016, transparent: true, opacity: 0.15,
    blending: THREE.AdditiveBlending, depthWrite: false
  });
  const holoParticles = new THREE.Points(pGeo, pMat);
  holoParticles.visible = false;
  holoGroup.add(holoParticles);

  group.userData.holoConsole = holoGroup;
  group.userData.holoAnim = { holoScreen, ringH, ringTilt, ringV, holoParticles };


  // 左右两块静态屏（向外收，尽量不遮挡正前方视野）
  const sidePanels = [];
  for (const s of [-1, 1]) {
    const panel = new THREE.Mesh(new THREE.BoxGeometry(0.78, 0.5, 0.05), darkMat);
    panel.position.set(s * 1.4, eye.y - 0.68, consoleZ - 0.18);
    panel.rotation.set(-0.26, -s * 0.44, 0);
    group.add(panel);
    const scr = new THREE.Mesh(
      new THREE.PlaneGeometry(0.68, 0.4),
      new THREE.MeshBasicMaterial({ map: makeScreenTexture(s < 0 ? 'radar' : 'amber') })
    );
    scr.position.set(s * 1.4, eye.y - 0.68, consoleZ - 0.205);
    scr.rotation.set(-0.26, -s * 0.44, 0);
    scr.translateZ(0.028);
    group.add(scr);
    sidePanels.push(panel, scr);
  }

  // ===== 舰长全息星图台（驾驶位前独立矮台，悬浮行星全息） =====
  // 全息星图台置于驾驶位右前侧（不遮挡正前方舷窗主视野，第一视角余光可见）
  const holoX = 1.9;
  const holoZ = eye.z - 0.6;
  const holoPedestal = new THREE.Mesh(new THREE.CylinderGeometry(0.38, 0.48, 0.9, 24), darkMat);
  holoPedestal.position.set(holoX, floorY + 0.45, holoZ);
  group.add(holoPedestal);
  const holoBase = new THREE.Mesh(new THREE.CylinderGeometry(0.4, 0.4, 0.04, 24), stripMat);
  holoBase.position.set(holoX, floorY + 0.92, holoZ);
  group.add(holoBase);
  // 悬浮行星全息（半透明冰蓝球体）
  const holoPlanet = new THREE.Mesh(
    new THREE.SphereGeometry(0.28, 24, 16),
    new THREE.MeshStandardMaterial({
      color: 0x123248, emissive: 0x35c8ff, emissiveIntensity: 1.4,
      transparent: true, opacity: 0.5, roughness: 0.6
    })
  );
  holoPlanet.position.set(holoX, floorY + 1.32, holoZ);
  group.add(holoPlanet);
  // 行星环带全息（两条细环）
  const holoRing1 = new THREE.Mesh(new THREE.TorusGeometry(0.4, 0.012, 6, 40), stripMat);
  holoRing1.position.copy(holoPlanet.position);
  holoRing1.rotation.x = Math.PI / 2 - 0.35;
  group.add(holoRing1);
  const holoRing2 = new THREE.Mesh(new THREE.TorusGeometry(0.52, 0.01, 6, 40), stripWarm);
  holoRing2.position.copy(holoPlanet.position);
  holoRing2.rotation.x = Math.PI / 2 + 0.5;
  holoRing2.rotation.y = 0.4;
  group.add(holoRing2);

  // ===== 左右侧工作站 =====
  for (const s of [-1, 1]) {
    const sideDesk = new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.09, 1.6), consoleMat);
    sideDesk.position.set(s * (roomR - 1.0), eye.y - 0.88, centerZ + 1.2);
    sideDesk.rotation.y = -s * 0.28;
    group.add(sideDesk);
    const sideScreen = new THREE.Mesh(
      new THREE.PlaneGeometry(0.72, 0.36),
      new THREE.MeshBasicMaterial({ map: makeScreenTexture(s < 0 ? 'wave' : 'bars') })
    );
    sideScreen.position.set(s * (roomR - 1.05), eye.y - 0.58, centerZ + 1.2);
    sideScreen.rotation.set(-0.24, -s * 0.5, 0);
    group.add(sideScreen);
    // 侧台背光条
    const sideStrip = new THREE.Mesh(new THREE.BoxGeometry(0.86, 0.03, 0.04), stripMat);
    sideStrip.position.set(s * (roomR - 1.02), eye.y - 0.82, centerZ + 0.42);
    sideStrip.rotation.y = -s * 0.28;
    group.add(sideStrip);
  }

  // ===== 舰长席（视点后方，贴合人体工学轮廓） =====
  const chairBase = new THREE.Mesh(new THREE.CylinderGeometry(0.28, 0.34, 0.5, 16), darkMat);
  chairBase.position.set(0, floorY + 0.3, eye.z + 1.7);
  group.add(chairBase);
  const chairSeat = new THREE.Mesh(new THREE.BoxGeometry(0.95, 0.2, 0.9), darkMat);
  chairSeat.position.set(0, floorY + 0.62, eye.z + 1.7);
  group.add(chairSeat);
  const chairBack = new THREE.Mesh(new THREE.BoxGeometry(0.95, 1.15, 0.18), darkMat);
  chairBack.position.set(0, floorY + 1.25, eye.z + 2.05);
  chairBack.rotation.x = -0.1;
  group.add(chairBack);
  const headrest = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.28, 0.14), trimMat);
  headrest.position.set(0, floorY + 1.85, eye.z + 2.12);
  headrest.rotation.x = -0.1;
  group.add(headrest);
  // 扶手
  for (const s of [-1, 1]) {
    const arm = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.08, 0.7), trimMat);
    arm.position.set(s * 0.55, floorY + 0.85, eye.z + 1.65);
    group.add(arm);
  }

  // ===== 舱内照明 =====
  const cabinLight = new THREE.PointLight(0xe8f0ff, 0.95, 15, 1.6);
  cabinLight.position.set(0, ceilY - 0.35, eye.z + 0.4);
  cabinLight.castShadow = false;
  group.add(cabinLight);
  const consoleGlow = new THREE.PointLight(0x35c8ff, 0.5, 6, 1.8);
  consoleGlow.position.set(0, eye.y - 0.72, consoleZ);
  consoleGlow.castShadow = false;
  group.add(consoleGlow);
  const warmAccent = new THREE.PointLight(0xffc07a, 0.35, 8, 2);
  warmAccent.position.set(0, eye.y + 0.8, eye.z + 2.2);
  warmAccent.castShadow = false;
  group.add(warmAccent);

  // 暴露动画与动态仪表屏（场景每帧更新航行数据 + 驱动全息旋转）
  group.userData.anim = { holoPlanet, holoRing1, holoRing2 };
  group.userData.dataScreen = dataScreen;
  // 舱室顶部结构（第一视角时隐藏，让舷窗视野更开阔）
  group.userData.topParts = [ceil, ceilRing, ceilDisc, topFrame, topGlow];
  // 前部控制台整块（台面 + 数据屏 + 两侧面板）：可按 G 键或按钮整体隐藏，观赏星球时全视野
  group.userData.dashParts = [holoGroup]; // 只保留 3D 悬浮全息控制台

  return group;
}

// ==================== 航行数据屏动态绘制 ====================
// 每帧由场景调用，将目的 / 当前坐标 / 距离 / 时速 绘制到中央数据屏。
// ==================== 航行数据屏动态绘制（小圆半弧） ====================
// 每帧由场景调用，将目的 / 当前坐标 / 距离 / 时速 绘制到半圆弧形中央数据屏。
// ==================== 航行数据屏动态绘制（小圆半弧 · 无卡片直排） ====================
// ==================== 全息星舰导航数据屏（HUD） ====================
// 深空自发光冰蓝 HUD：斜切边框 + 网格 + 模块化数据 + 刻度/波形装饰
// ==================== 全息控制台数据纹理（紧凑，不溢出） ====================
// ==================== 全息数据屏（紧凑布局，不溢出） ====================
// ==================== 全息控制台数据纹理（紧凑布局，不溢出） ====================
// ==================== 全息控制台数据纹理（圆角矩形，紧凑不溢出） ====================
// ==================== 全息控制台数据纹理（紧凑 · 目标星球 · 扫描） ====================
// ==================== 全息控制台数据纹理（深色玻璃 · 大号清晰文字 · 无浅蓝层） ====================
// ==================== 全息控制台数据纹理（深色透明玻璃 · 大字号清晰） ====================
// ==================== 全息控制台数据纹理（大字号清晰版） ====================
export function renderDataScreen(dataScreen, info) {
  const { canvas, ctx, texture } = dataScreen;
  const W = canvas.width, H = canvas.height; // 960 x 400
  ctx.clearRect(0, 0, W, H);

  const cyan = '#0d4d7d';
  const white = '#0a2440';
  const dim = 'rgba(15,60,95,0.85)';

  // 淡白高透明玻璃面板（半透出星空）
  ctx.fillStyle = 'rgba(224,240,250,0.55)';
  ctx.fillRect(0, 0, W, H);
  ctx.strokeStyle = 'rgba(30,80,120,0.30)';
  ctx.lineWidth = 1;
  ctx.strokeRect(4, 4, W - 8, H - 8);

  ctx.textBaseline = 'middle';
  const left = 30, right = W - 30;

  // 标题（大）
  ctx.fillStyle = cyan;
  ctx.font = 'bold 30px "Microsoft YaHei", Arial, sans-serif';
  ctx.textAlign = 'left';
  ctx.fillText('曙光号 · 航行数据', left, 40);
  // 右侧雷达扫描（扫描仪转动，内嵌于数据屏，无外发光）
  const ra = right - 34, ry = 38, rr = 18;
  const rt = (Date.now() % 2000) / 2000 * Math.PI * 2;
  ctx.strokeStyle = 'rgba(15,70,110,0.45)';
  ctx.lineWidth = 1.4;
  ctx.beginPath(); ctx.arc(ra, ry, rr, 0, Math.PI * 2); ctx.stroke();
  ctx.beginPath(); ctx.arc(ra, ry, rr * 0.6, 0, Math.PI * 2); ctx.stroke();
  ctx.strokeStyle = 'rgba(10,45,80,0.7)';
  ctx.beginPath();
  ctx.moveTo(ra, ry);
  ctx.lineTo(ra + Math.cos(rt) * rr, ry + Math.sin(rt) * rr);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(ra, ry);
  ctx.lineTo(ra + Math.cos(rt + 2.4) * rr * 0.6, ry + Math.sin(rt + 2.4) * rr * 0.6);
  ctx.stroke();

  ctx.strokeStyle = 'rgba(25,75,115,0.30)';
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(left, 76);
  ctx.lineTo(right, 76);
  ctx.stroke();

  const dest = info.dest || '自由巡航';
  const dist = (info.dist == null || !isFinite(info.dist)) ? null : info.dist;
  const spd = isFinite(info.speed) ? info.speed : 0;
  const c = info.coord || { x: 0, y: 0, z: 0 };
  const KM_PER_UNIT = 1246649;

  function fmtKmParts(km) {
    const abs = Math.abs(km);
    const sign = km < 0 ? '-' : '';
    if (abs >= 1e8) return [sign + (abs / 1e8).toFixed(1), '亿km'];
    if (abs >= 1e4) return [sign + Math.round(abs / 1e4), '万km'];
    return [sign + Math.round(abs).toLocaleString('en-US'), 'km'];
  }
  function fmtVal(km) {
    const abs = Math.abs(km);
    const sign = km < 0 ? '-' : '';
    if (abs >= 1e8) return sign + (abs / 1e8).toFixed(1) + '亿';
    if (abs >= 1e4) return sign + Math.round(abs / 1e4) + '万';
    return sign + Math.round(abs).toLocaleString('en-US');
  }

  // 三栏（数字大字号、单位小字跟随，紧凑不溢出）
  const colW = (right - left) / 3;
  const distParts = dist == null ? null : fmtKmParts(dist * KM_PER_UNIT);
  const cols = [
    { x: left, label: '目标星球', value: dest, unit: null },
    { x: left + colW, label: '目标距离', value: dist == null ? '— —' : distParts[0], unit: distParts ? distParts[1] : null },
    { x: left + colW * 2, label: '时速', value: Math.round(spd * 1000).toLocaleString('en-US'), unit: 'km/s' },
  ];
  cols.forEach((col, i) => {
    ctx.fillStyle = dim;
    ctx.font = 'bold 35px "Microsoft YaHei", sans-serif';
    const labelW = ctx.measureText(col.label).width;
    ctx.fillText(col.label, col.x, 138);
    // 单位跟随标签行（与数字彻底分离，无重叠）
    if (col.unit) {
      ctx.font = 'bold 24px "Consolas", monospace';
      ctx.fillText(col.unit, col.x + labelW + 12, 138);
    }
    // 值：纯数字大字号
    ctx.fillStyle = i === 0 ? cyan : white;
    ctx.font = 'bold 50px "Consolas", sans-serif';
    ctx.fillText(col.value, col.x, 212);
    // 栏底细刻度
    ctx.strokeStyle = 'rgba(25,75,115,0.28)';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(col.x, 246);
    ctx.lineTo(col.x + colW - 18, 246);
    ctx.stroke();
  });

  // 坐标行（大字号）
  ctx.fillStyle = dim;
  ctx.font = 'bold 37px "Microsoft YaHei", sans-serif';
  ctx.fillText('当前坐标', left, 306);
  ctx.fillStyle = white;
  ctx.font = 'bold 42px "Consolas", monospace';
  ctx.fillText('X ' + fmtVal(c.x * KM_PER_UNIT), left, 366);
  ctx.fillText('Y ' + fmtVal(c.y * KM_PER_UNIT), left + colW, 366);
  ctx.fillText('Z ' + fmtVal(c.z * KM_PER_UNIT), left + colW * 2, 366);

  texture.needsUpdate = true;
}
