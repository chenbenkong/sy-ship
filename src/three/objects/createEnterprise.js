import * as THREE from 'three';
import { createBridgeInterior } from './createBridgeInterior.js';

// ============================================================
// 舰体磨砂贴图：高饱和正红 + 喷砂颗粒 + 深红板缝
// ============================================================
function makeHullTexture() {
  const S = 1024;
  const c = document.createElement('canvas');
  c.width = c.height = S;
  const ctx = c.getContext('2d');

  ctx.fillStyle = '#dbe7f3';
  ctx.fillRect(0, 0, S, S);

  const imgData = ctx.getImageData(0, 0, S, S);
  const d = imgData.data;
  for (let i = 0; i < S * S; i++) {
    const n = (Math.random() - 0.5) * 20;
    const o = i * 4;
    d[o] += n; d[o + 1] += n * 0.7; d[o + 2] += n * 0.6;
  }
  ctx.putImageData(imgData, 0, 0);

  for (let i = 0; i < 240; i++) {
    const x = Math.random() * S, y = Math.random() * S;
    const w = 26 + Math.random() * 150, h = 20 + Math.random() * 110;
    const v = 55 + (Math.random() * 55) | 0;
    ctx.strokeStyle = `rgba(75,100,135,0.6)`;
    ctx.lineWidth = 1.6;
    ctx.strokeRect(x, y, w, h);
    ctx.fillStyle = `rgba(150,185,225,${0.05 + Math.random() * 0.14})`;
    ctx.fillRect(x + 1, y + 1, w - 1, h - 1);
  }

  const tex = new THREE.CanvasTexture(c);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  tex.repeat.set(6, 2.5);
  return tex;
}

// ============================================================
// 舰体：沿 3D 脊线放样"扁平椭圆截面"，实现月牙凹腹 + 分段上升舰背
// 关键：截面中心点沿参考侧视轮廓走，截面是扁平椭圆（宽>高），
//       中下段截面整体上抬 → 形成舰腹月牙凹弧
// ============================================================
function makeCatmullPts(raw) {
  return new THREE.CatmullRomCurve3(raw.map(p => new THREE.Vector3(...p)));
}

function makeHullGeometry() {
  // 脊线（舰首 -Z → 舰尾 +Z），Y 沿参考侧视：舰首低、中段隆起、舰尾最高
  const spine = makeCatmullPts([
    [0, -0.5, -16.5],   // 舰首尖端（低）
    [0, -0.3, -13.0],
    [0, 0.0, -9.5],
    [0, 0.4, -6.0],     // 座舱罩区域开始隆起
    [0, 0.7, -2.5],
    [0, 0.9, 1.5],      // 中段最高点
    [0, 1.2, 5.5],
    [0, 1.7, 9.5],      // 向舰尾继续升高
    [0, 2.2, 13.0],     // 舰尾最高处
    [0, 2.0, 16.0],     // 尾端略收
  ]);

  // 截面半宽（舰首细 → 中段宽 → 尾段最宽）
  const wPts = [
    [0.0, 0.06], [0.08, 0.8], [0.2, 1.9], [0.35, 2.7],
    [0.5, 3.0], [0.65, 3.1], [0.8, 3.3], [0.92, 3.0], [1.0, 1.6]
  ];
  // 截面半高（扁平椭圆：高约为宽的 45~55%，形成扁平机身而非圆管）
  const hPts = [
    [0.0, 0.03], [0.08, 0.28], [0.2, 0.55], [0.35, 0.72],
    [0.5, 0.78], [0.65, 0.82], [0.8, 0.86], [0.92, 0.72], [1.0, 0.42]
  ];
  // 截面底部上抬量（实现舰腹月牙凹弧：中段底部大幅上收）
  const liftPts = [
    [0.0, 0.0], [0.25, 0.05], [0.45, 0.9], [0.6, 1.5],
    [0.75, 1.2], [0.88, 0.5], [1.0, 0.15]
  ];

  const interp = (pts) => (t) => {
    if (t <= pts[0][0]) return pts[0][1];
    if (t >= pts[pts.length - 1][0]) return pts[pts.length - 1][1];
    for (let i = 0; i < pts.length - 1; i++) {
      const [t0, v0] = pts[i], [t1, v1] = pts[i + 1];
      if (t >= t0 && t <= t1) {
        let u = (t - t0) / (t1 - t0);
        u = u * u * (3 - 2 * u);
        return v0 + (v1 - v0) * u;
      }
    }
    return pts[pts.length - 1][1];
  };
  const wAt = interp(wPts), hAt = interp(hPts), liftAt = interp(liftPts);

  const slices = 60, radial = 40;
  const positions = [];
  const uvs = [];
  const indices = [];

  for (let i = 0; i <= slices; i++) {
    const t = i / slices;
    const center = spine.getPointAt(t);
    // 切线方向（用于构建截面局部坐标系）
    const tan = spine.getTangentAt(t).normalize();
    // 取一个稳定的 up（世界 Y），与切线正交得到侧向
    const up = new THREE.Vector3(0, 1, 0);
    const side = new THREE.Vector3().crossVectors(up, tan).normalize();
    const realUp = new THREE.Vector3().crossVectors(tan, side).normalize();

    const w = wAt(t), h = hAt(t), lift = liftAt(t);
    for (let j = 0; j < radial; j++) {
      const th = (j / radial) * Math.PI * 2;
      // 椭圆截面：x 用半宽，y 用半高；底部上抬 lift（负半高区域向上收）
      const lx = Math.cos(th) * w;
      const sy = Math.sin(th);
      const ly = sy * h + (sy < 0 ? lift * (1 + sy) : 0); // 底部按深度比例上收
      const p = center.clone()
        .addScaledVector(side, lx)
        .addScaledVector(realUp, ly);
      positions.push(p.x, p.y, p.z);
      uvs.push(j / radial, t);
    }
  }

  for (let i = 0; i < slices; i++) {
    for (let j = 0; j < radial; j++) {
      const a = i * radial + j;
      const b = i * radial + (j + 1) % radial;
      const c = (i + 1) * radial + (j + 1) % radial;
      const d = (i + 1) * radial + j;
      indices.push(a, b, c, a, c, d);
    }
  }

  // 尾端封口
  const tailCenterIdx = positions.length / 3;
  const tailP = spine.getPointAt(1);
  positions.push(tailP.x, tailP.y + 0.1, tailP.z + 0.4);
  uvs.push(0.5, 1);
  for (let j = 0; j < radial; j++) {
    const a = slices * radial + j;
    const b = slices * radial + (j + 1) % radial;
    indices.push(a, b, tailCenterIdx);
  }

  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geo.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  geo.setIndex(indices);
  geo.computeVertexNormals();
  return geo;
}

/**
 * 「赤隼 MK-III」仿生星际穿梭艇（参考 FESLUG 概念，还原度拉满）。
 * 鲨鱼形态：月牙凹腹 + 分段上升舰背 + 座舱鼓包 + 上翘舰尾。
 * 以 +Z 为舰尾、-Z 为舰首。保留探索模式 userData 契约。
 */
export function createEnterprise() {
  const group = new THREE.Group();
  group.name = 'Enterprise';

  // ---- 材质 ----
  const hullTex = makeHullTexture();
  const hullMat = new THREE.MeshStandardMaterial({
    color: 0xf4f9fd, roughness: 0.5, metalness: 0.35,
    map: hullTex, bumpMap: hullTex, bumpScale: 0.4,
    emissive: 0x9db8d4, emissiveIntensity: 0.18,
    side: THREE.DoubleSide
  });
  const darkMat = new THREE.MeshStandardMaterial({
    color: 0x9fb3c9, roughness: 0.45, metalness: 0.5
  });
  const accentMat = new THREE.MeshStandardMaterial({
    color: 0xd2e2f2, roughness: 0.4, metalness: 0.55
  });
  const canopyMat = new THREE.MeshPhysicalMaterial({
    color: 0x9fd0f5, roughness: 0.06, metalness: 0.6,
    transparent: true, opacity: 0.4,
    clearcoat: 1.0, clearcoatRoughness: 0.1,
    side: THREE.DoubleSide
  });
  const warpGlowMat = new THREE.MeshStandardMaterial({
    color: 0x14324a, emissive: 0x35c8ff, emissiveIntensity: 2.6,
    roughness: 0.3, metalness: 0.2
  });
  const bussardMat = new THREE.MeshStandardMaterial({
    color: 0x0c2033, emissive: 0x35c8ff, emissiveIntensity: 2.4,
    roughness: 0.4, metalness: 0.1
  });

  // ===== 1. 有机主舰体 =====
  const hull = new THREE.Mesh(makeHullGeometry(), hullMat);
  group.add(hull);

  // ===== 2. 座舱罩（舰背 45%~75% 区间的饱满鼓包） =====
  const canopy = new THREE.Mesh(new THREE.SphereGeometry(3.0, 40, 24), canopyMat);
  canopy.scale.set(0.72, 0.52, 1.55);
  canopy.position.set(0, 1.75, -3.2);
  group.add(canopy);
  const canopyFrame = new THREE.Mesh(new THREE.TorusGeometry(2.75, 0.1, 12, 48, Math.PI), darkMat);
  canopyFrame.scale.set(0.75, 0.6, 1.35);
  canopyFrame.position.set(0, 1.7, -5.1);
  canopyFrame.rotation.x = -0.12;
  group.add(canopyFrame);

  // ===== 3. 舰首散热口（下部深灰进气格栅，参考图舰首功能件） =====
  const intake = new THREE.Mesh(new THREE.BoxGeometry(1.7, 0.45, 3.2), darkMat);
  intake.position.set(0, -1.6, -10.5);
  intake.rotation.x = 0.14;
  group.add(intake);
  for (let k = 0; k < 4; k++) {
    const fin = new THREE.Mesh(new THREE.BoxGeometry(1.35, 0.05, 0.18), accentMat);
    fin.position.set(0, -1.36, -10.2 - k * 0.72);
    fin.rotation.x = 0.14;
    group.add(fin);
  }

  // ===== 4. 尾鳍 + 尾端结构（上翘舰尾的延伸件） =====
  // 尾部背鳍（鲨鱼尾鳍感，随舰背上翘）
  const tailFinShape = new THREE.Shape();
  tailFinShape.moveTo(0, 0);
  tailFinShape.lineTo(1.8, 2.6);
  tailFinShape.quadraticCurveTo(2.2, 2.8, 3.8, 2.5);
  tailFinShape.lineTo(5.4, 0);
  tailFinShape.closePath();
  const tailFinGeo = new THREE.ExtrudeGeometry(tailFinShape, { depth: 0.2, bevelEnabled: true, bevelThickness: 0.05, bevelSize: 0.05, bevelSegments: 2 });
  for (const s of [0.1, -0.1]) {
    const fin = new THREE.Mesh(tailFinGeo, hullMat);
    fin.rotation.y = Math.PI / 2;
    fin.position.set(s, 1.4, 11.2);
    if (s < 0) fin.scale.z = -1;
    group.add(fin);
  }
  // 背鳍前缘发光条
  const finEdge = new THREE.Mesh(new THREE.BoxGeometry(0.09, 2.5, 0.09), warpGlowMat);
  finEdge.position.set(0, 2.6, 11.2 + 1.8);
  finEdge.rotation.x = -0.85;
  group.add(finEdge);

  // 尾部三根平行翼片天线（扁平，非圆柱）
  for (const s of [-0.45, 0, 0.45]) {
    const tailAnt = new THREE.Mesh(new THREE.BoxGeometry(0.06, 1.5, 0.3), darkMat);
    tailAnt.position.set(s * 0.9, 1.6, 15.2);
    tailAnt.rotation.x = 0.15;
    group.add(tailAnt);
  }

  // ===== 5. 舰首天线（向上斜伸的扁平翼片） =====
  const noseAntenna = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.34, 3.8), darkMat);
  noseAntenna.position.set(0, 1.0, -13.8);
  noseAntenna.rotation.x = 0.85;
  group.add(noseAntenna);
  const antennaTip = new THREE.Mesh(new THREE.SphereGeometry(0.13, 10, 8), bussardMat);
  antennaTip.position.set(0, 2.4, -15.4);
  group.add(antennaTip);

  // ===== 6. 主引擎 + 两侧辅助引擎（尾部） =====
  // 尾部主喷口：扁平楔形（非圆柱），冰蓝发光尾口
  const nozzleBody = new THREE.Mesh(new THREE.BoxGeometry(3.0, 1.2, 1.8), accentMat);
  nozzleBody.position.set(0, 1.9, 15.0);
  group.add(nozzleBody);
  // 上下收敛斜面
  for (const dir of [-1, 1]) {
    const ramp = new THREE.Mesh(new THREE.BoxGeometry(2.7, 0.12, 1.4), darkMat);
    ramp.position.set(0, 1.9 + dir * 0.62, 15.05);
    ramp.rotation.x = dir * -0.55;
    group.add(ramp);
  }
  // 冰蓝发光尾口（扁平椭圆）
  const warpCore = new THREE.Mesh(new THREE.PlaneGeometry(2.6, 0.9), warpGlowMat);
  warpCore.position.set(0, 1.9, 15.95);
  group.add(warpCore);
  const bussardRing = new THREE.Mesh(new THREE.TorusGeometry(1.2, 0.12, 10, 4), bussardMat);
  bussardRing.scale.set(1.1, 0.4, 1);
  bussardRing.rotation.y = Math.PI / 2;
  bussardRing.position.set(0, 1.9, 15.85);
  group.add(bussardRing);
  const engineLight = new THREE.PointLight(0x35c8ff, 2.2, 60, 1.8);
  engineLight.position.set(0, 1.9, 17.2);
  group.add(engineLight);

  for (const s of [-1, 1]) {
    // 扁平翼式短舱：扁盒 + 前端收尖（非圆柱）
    const nacBody = new THREE.Mesh(new THREE.BoxGeometry(1.7, 0.36, 3.0), darkMat);
    nacBody.position.set(s * 2.0, 0.1, 12.0);
    group.add(nacBody);
    const nacTip = new THREE.Mesh(new THREE.ConeGeometry(0.6, 1.5, 4), darkMat);
    nacTip.position.set(s * 2.0, 0.1, 9.7);
    nacTip.rotation.x = Math.PI / 2;   // 锥尖朝舰首 -Z
    nacTip.scale.set(1.15, 1, 0.28);   // 更扁的翼尖锥
    group.add(nacTip);
    const nacGlow = new THREE.Mesh(new THREE.PlaneGeometry(0.55, 0.26), warpGlowMat);
    nacGlow.position.set(s * 2.0, 0.1, 13.75);
    nacGlow.rotation.y = Math.PI / 2;
    group.add(nacGlow);
  }

  // ===== 7. 舰身两侧能量条（随速度增亮，贴体面轮廓） =====
  const sideStripCurveL = new THREE.CatmullRomCurve3([
    new THREE.Vector3(-2.95, 0.6, -8.0),
    new THREE.Vector3(-3.1, 0.7, -2.0),
    new THREE.Vector3(-3.15, 0.9, 4.0),
    new THREE.Vector3(-3.2, 1.4, 10.5),
  ]);
  const sideStripCurveR = new THREE.CatmullRomCurve3([
    new THREE.Vector3(2.95, 0.6, -8.0),
    new THREE.Vector3(3.1, 0.7, -2.0),
    new THREE.Vector3(3.15, 0.9, 4.0),
    new THREE.Vector3(3.2, 1.4, 10.5),
  ]);
  group.add(new THREE.Mesh(new THREE.TubeGeometry(sideStripCurveL, 40, 0.09, 8), warpGlowMat));
  group.add(new THREE.Mesh(new THREE.TubeGeometry(sideStripCurveR, 40, 0.09, 8), warpGlowMat));

  // ===== 8. 侧面圆形矢量喷口（内嵌式，带发光盘） =====
  const thrusterTexCvs = document.createElement('canvas');
  thrusterTexCvs.width = thrusterTexCvs.height = 128;
  const tctx = thrusterTexCvs.getContext('2d');
  const tg = tctx.createRadialGradient(64, 64, 0, 64, 64, 64);
  tg.addColorStop(0, 'rgba(120,200,255,0.9)');
  tg.addColorStop(0.35, 'rgba(40,120,220,0.4)');
  tg.addColorStop(1, 'rgba(0,0,0,0)');
  tctx.fillStyle = tg;
  tctx.fillRect(0, 0, 128, 128);
  const thrusterTex = new THREE.CanvasTexture(thrusterTexCvs);
  for (const s of [-1, 1]) {
    for (const py of [-1.0, 1.1]) {
      const thr = new THREE.Mesh(new THREE.BoxGeometry(0.4, 1.0, 1.0), accentMat);
      thr.position.set(s * 3.15, py, -4.5);
      group.add(thr);
      const glowDisc = new THREE.Sprite(new THREE.SpriteMaterial({
        map: thrusterTex, transparent: true, opacity: 0.7,
        blending: THREE.AdditiveBlending, depthWrite: false
      }));
      glowDisc.position.set(s * 3.35, py, -4.5);
      glowDisc.scale.setScalar(1.0);
      group.add(glowDisc);
    }
  }

  // ===== 9. 航行灯 =====
  const navLightGeo = new THREE.SphereGeometry(0.2, 12, 10);
  const navRed = new THREE.Mesh(navLightGeo, new THREE.MeshBasicMaterial({ color: 0xff3322 }));
  navRed.position.set(-3.3, 0.4, -6.0);
  const navGreen = new THREE.Mesh(navLightGeo, new THREE.MeshBasicMaterial({ color: 0x33ff55 }));
  navGreen.position.set(3.3, 0.4, -6.0);
  const navWhite = new THREE.Mesh(navLightGeo, new THREE.MeshBasicMaterial({ color: 0xffffff }));
  navWhite.position.set(0, 3.6, 12.0);
  navWhite.scale.setScalar(1.3);
  group.add(navRed, navGreen, navWhite);

  // ===== 10. 引擎尾焰（3 处） =====
  const exhaustTexCvs = document.createElement('canvas');
  exhaustTexCvs.width = exhaustTexCvs.height = 64;
  const ectx = exhaustTexCvs.getContext('2d');
  const egrd = ectx.createRadialGradient(32, 32, 0, 32, 32, 32);
  egrd.addColorStop(0, 'rgba(190,235,255,1)');
  egrd.addColorStop(0.4, 'rgba(80,180,255,0.7)');
  egrd.addColorStop(1, 'rgba(50,140,255,0)');
  ectx.fillStyle = egrd;
  ectx.fillRect(0, 0, 64, 64);
  const exhaustTex = new THREE.CanvasTexture(exhaustTexCvs);

  const makeExhaust = (x, y, z, scale) => {
    const sp = new THREE.Sprite(new THREE.SpriteMaterial({
      map: exhaustTex, transparent: true,
      opacity: 0.85, blending: THREE.AdditiveBlending, depthWrite: false
    }));
    sp.position.set(x, y, z);
    sp.scale.setScalar(scale);
    return sp;
  };
  const exhaustMain = makeExhaust(0, 1.9, 17.8, 3.4);
  const exhaustL = makeExhaust(-2.0, 0.1, 14.8, 2.0);
  const exhaustR = makeExhaust(2.0, 0.1, 14.8, 2.0);
  group.add(exhaustMain, exhaustL, exhaustR);

  // 随舰补光灯
  const shipFill = new THREE.PointLight(0xe8f4ff, 0.95, 130, 0.6);
  shipFill.position.set(0, 9, 8);
  shipFill.castShadow = false;
  group.add(shipFill);

  // 舰桥控制室内舱（第一视角专用，默认隐藏）
  const bridgeInterior = createBridgeInterior();
  bridgeInterior.visible = false;
  group.add(bridgeInterior);

  // ===== userData 契约 =====
  group.userData = {
    cockpit: new THREE.Vector3(0, 3.35, -1.2),
    chaseOffset: new THREE.Vector3(0, 7.5, 32),
    warpGlowMat,
    bussardMat,
    navLights: { red: navRed, green: navGreen, white: navWhite },
    exhausts: [exhaustMain, exhaustL, exhaustR],
    bridgeInterior
  };

  group.traverse(o => {
    if (o.isMesh) {
      o.castShadow = true;
      o.receiveShadow = true;
    }
  });
  group.userData.hullParts = group.children.filter(c => c !== bridgeInterior);

  return group;
}