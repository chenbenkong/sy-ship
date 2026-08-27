import * as THREE from 'three';
import { planetData } from '../../data/planetData.js';
import { ORBITAL_MEAN_ELEMENTS } from '../../data/orbitalData.js';
import { createPlanetTexture, createNormalMap } from './planetTextures.js';
import { createMoon } from './moon.js';

// 统一加载行星漫反射贴图：
// - sRGB 色彩空间：否则颜色会发灰发白（three r152+ 必须显式指定）
// - 各向异性过滤：斜视角度下贴图更锐利
function loadPlanetTexture(loader, file, srgb = true) {
  const tex = loader.load(import.meta.env.BASE_URL + 'textures/' + file);
  if (srgb) tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 8;
  return tex;
}

export function createPlanets(solarSystem, manager) {
  const planetMeshes = [];

  planetData.forEach(planet => {
    const geometry = new THREE.SphereGeometry(planet.radius, 64, 64);
    
    let material;
    
    if (planet.name === '木星') {
      material = createJupiterMaterial(manager);
    } else if (planet.name === '土星') {
      material = createSaturnMaterial(manager);
    } else if (planet.name === '地球') {
      material = createEarthMaterial(manager);
    } else if (planet.name === '火星') {
      material = createMarsMaterial(manager);
    } else if (planet.name === '金星') {
      material = createVenusMaterial(manager);
    } else if (planet.name === '水星') {
      material = createMercuryMaterial(manager);
    } else if (planet.name === '天王星') {
      material = createUranusMaterial(manager);
    } else if (planet.name === '海王星') {
      material = createNeptuneMaterial(manager);
    } else if (planet.name === '冥王星') {
      material = createPlutoMaterial(manager);
    } else {
      material = new THREE.MeshStandardMaterial({
        color: planet.color,
        roughness: 0.9,
        metalness: 0.0
      });
    }
    
    const mesh = new THREE.Mesh(geometry, material);
    mesh.position.x = planet.distance;
    mesh.rotation.x = THREE.MathUtils.degToRad(planet.tilt);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    solarSystem.add(mesh);

    // 大气辉光：Fresnel 边缘光，让行星轮廓在黑暗中泛起柔光
    if (planet.atmoColor) {
      mesh.add(createAtmosphere(planet.radius, planet.atmoColor));
    }

    // 轨道环：真实偏心率椭圆轨道（黄道面 XZ，长轴沿近日点经度方向）
    const orbitEl = ORBITAL_MEAN_ELEMENTS[planet.name];
    const eOrb = (orbitEl && orbitEl.e !== undefined) ? orbitEl.e : 0;
    const periOrb = (orbitEl && orbitEl.e !== undefined) ? THREE.MathUtils.degToRad(orbitEl.varpi) : 0;
    const aOrb = planet.distance;
    const orbitPts = [];
    const ORB_N = 256;
    for (let i = 0; i <= ORB_N; i++) {
      const th = (i / ORB_N) * Math.PI * 2;
      const rr = eOrb < 0.999 ? (aOrb * (1 - eOrb * eOrb)) / (1 + eOrb * Math.cos(th)) : aOrb;
      const ang = th + periOrb;
      orbitPts.push(new THREE.Vector3(rr * Math.cos(ang), 0, rr * Math.sin(ang)));
    }
    const orbitGeo = new THREE.BufferGeometry().setFromPoints(orbitPts);
    const orbitMat = new THREE.LineBasicMaterial({
      color: 0x5588cc,
      transparent: true,
      opacity: 0.28
    });
    const orbit = new THREE.Line(orbitGeo, orbitMat);
    solarSystem.add(orbit);

    const planetObj = {
      mesh,
      orbit,
      ...planet
    };

    // 地球：挂载缓慢旋转的云层
    if (planet.name === '地球') {
      const clouds = createCloudLayer(planet.radius);
      mesh.add(clouds);
      planetObj.clouds = clouds;
    }

    if (planet.hasMoon) {
      const { moon, moonOrbit } = createMoon(planet.radius, manager);
      moon.castShadow = true;
      moon.receiveShadow = true;
      mesh.add(moon);
      mesh.add(moonOrbit);
      planetObj.moon = moon;
    }

    if (planet.hasRings) {
      const ring = createRings(planet);
      mesh.add(ring);
      planetObj.ring = ring;
    }

    planetMeshes.push(planetObj);
  });

  return planetMeshes;
}

// 地球云层：横向无缝衔接的程序云（每朵云在 x、x±W 三处同绘，消除接缝），
// 覆盖全部纬度、低透明度多层叠加，避免"两张图拼接"的生硬分层感
function createCloudLayer(radius) {
  const W = 1024, H = 512;
  const cvs = document.createElement('canvas');
  cvs.width = W;
  cvs.height = H;
  const ctx = cvs.getContext('2d');
  ctx.clearRect(0, 0, W, H);

  // 横向环绕绘制：每朵云同时在 x、x-W、x+W 绘制，保证贴图左右边缘无缝
  const puff = (x, y, rx, ry, alpha) => {
    for (const ox of [-W, 0, W]) {
      ctx.save();
      ctx.translate(x + ox, y);
      ctx.scale(1, ry / rx);
      const g = ctx.createRadialGradient(0, 0, 0, 0, 0, rx);
      g.addColorStop(0, `rgba(255,255,255,${alpha})`);
      g.addColorStop(0.5, `rgba(255,255,255,${alpha * 0.4})`);
      g.addColorStop(1, 'rgba(255,255,255,0)');
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.arc(0, 0, rx, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }
  };

  // 底层大范围薄云：让云层整体连续，不是一块块孤立云团
  for (let i = 0; i < 60; i++) {
    puff(Math.random() * W, Math.random() * H, 90 + Math.random() * 160, 40 + Math.random() * 60, 0.05 + Math.random() * 0.06);
  }
  // 中层云带
  for (let i = 0; i < 140; i++) {
    puff(Math.random() * W, Math.random() * H, 45 + Math.random() * 90, 18 + Math.random() * 30, 0.08 + Math.random() * 0.10);
  }
  // 细节云块
  for (let i = 0; i < 240; i++) {
    puff(Math.random() * W, Math.random() * H, 12 + Math.random() * 40, 6 + Math.random() * 14, 0.08 + Math.random() * 0.12);
  }

  const cloudTex = new THREE.CanvasTexture(cvs);
  cloudTex.wrapS = THREE.RepeatWrapping;

  const mat = new THREE.MeshLambertMaterial({
    map: cloudTex,
    transparent: true,
    opacity: 0.6,
    depthWrite: false
  });
  const mesh = new THREE.Mesh(new THREE.SphereGeometry(radius * 1.018, 64, 64), mat);
  mesh.name = 'cloudLayer';
  return mesh;
}

// 基于 Fresnel 的边缘辉光：背面渲染 + 叠加混合，中心透明、边缘发亮
function createAtmosphere(radius, color) {
  const geometry = new THREE.SphereGeometry(radius * 1.025, 64, 64);
  const material = new THREE.ShaderMaterial({
    uniforms: {
      glowColor: { value: new THREE.Color(color) },
      coeff: { value: 0.45 },
      power: { value: 4.2 }
    },
    vertexShader: `
      varying vec3 vNormal;
      void main() {
        vNormal = normalize(normalMatrix * normal);
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: `
      uniform vec3 glowColor;
      uniform float coeff;
      uniform float power;
      varying vec3 vNormal;
      void main() {
        // 相机空间法线 z 分量：边缘处接近 0，正面接近 1
        float intensity = pow(clamp(coeff - dot(vNormal, vec3(0.0, 0.0, 1.0)), 0.0, 1.0), power);
        gl_FragColor = vec4(glowColor, intensity);
      }
    `,
    side: THREE.BackSide,
    blending: THREE.AdditiveBlending,
    transparent: true,
    depthWrite: false
  });
  return new THREE.Mesh(geometry, material);
}

// ============================================================
// 科研级 PBR 材质（MeshStandardMaterial）
// 原则：
//  - 零自发光（emissive=0）：行星只反射阳光，不产生"光膜"
//  - 零 Phong 高光（specular）：无大气岩石天体不应有"湿亮"反光
//  - roughness 依据天体表面物理特性设定
// ============================================================
function pbrMaterial(texture, roughness) {
  return new THREE.MeshStandardMaterial({
    map: texture,
    roughness: roughness,
    metalness: 0.0
  });
}

function createJupiterMaterial(manager) {
  const loader = new THREE.TextureLoader(manager);
  const jupiterTexture = loadPlanetTexture(loader, 'jupiter.jpg');
  return pbrMaterial(jupiterTexture, 0.92); // 气态巨行星：接近朗伯漫反射
}

function createSaturnMaterial(manager) {
  const loader = new THREE.TextureLoader(manager);
  const saturnTexture = loadPlanetTexture(loader, 'saturn.jpg');
  return pbrMaterial(saturnTexture, 0.92);
}

function createEarthMaterial(manager) {
  const loader = new THREE.TextureLoader(manager);
  const earthTexture = loadPlanetTexture(loader, 'earth.jpg');
  const normalTexture = loadPlanetTexture(loader, 'earth_normal.jpg', false);
  const nightTexture = loadPlanetTexture(loader, 'earth_night.jpg');

  // roughness=1 为基底，由粗糙度图调制：海洋光滑反光、陆地粗糙
  const material = new THREE.MeshStandardMaterial({
    map: earthTexture,
    normalMap: normalTexture,
    normalScale: new THREE.Vector2(0.7, 0.7),
    roughness: 1.0,
    metalness: 0.0
  });

  // 夜面城市灯光（"黑色大理石"效果）：
  // 向 PBR 着色器注入逻辑——按片元相对太阳的日照角，
  // 在夜半球逐渐显现夜光贴图（emissive 通道不受光照，只会在暗侧亮）
  material.onBeforeCompile = (shader) => {
    shader.uniforms.nightMap = { value: nightTexture };
    shader.uniforms.sunPosView = { value: new THREE.Vector3() };
    material.userData.shader = shader;
    shader.fragmentShader = shader.fragmentShader
      .replace(
        '#include <common>',
        '#include <common>\nuniform sampler2D nightMap;\nuniform vec3 sunPosView;'
      )
      .replace(
        '#include <emissivemap_fragment>',
        `#include <emissivemap_fragment>
        {
          vec3 fragPosView = -vViewPosition;
          vec3 sunDirV = normalize(sunPosView - fragPosView);
          float dayAmount = clamp(dot(normalize(vNormal), sunDirV) * 5.0 + 0.6, 0.0, 1.0);
          float nightAmount = 1.0 - dayAmount;
          vec3 cityLights = texture2D(nightMap, vMapUv).rgb;
          totalEmissiveRadiance += cityLights * nightAmount * 2.2;
        }`
      );
  };

  // 将 specular 贴图反相为 roughness 贴图（原图海洋=亮 -> 反转后=暗=光滑）
  new THREE.TextureLoader(manager).load(
    import.meta.env.BASE_URL + 'textures/earth_specular.jpg',
    (specTex) => {
      const img = specTex.image;
      const cvs = document.createElement('canvas');
      cvs.width = img.width;
      cvs.height = img.height;
      const ctx = cvs.getContext('2d');
      ctx.drawImage(img, 0, 0);
      const data = ctx.getImageData(0, 0, cvs.width, cvs.height);
      const px = data.data;
      for (let i = 0; i < px.length; i += 4) {
        const v = 255 - px[i];
        px[i] = v; px[i + 1] = v; px[i + 2] = v;
      }
      ctx.putImageData(data, 0, 0);
      material.roughnessMap = new THREE.CanvasTexture(cvs);
      material.needsUpdate = true;
    }
  );

  return material;
}

function createMarsMaterial(manager) {
  const loader = new THREE.TextureLoader(manager);
  const marsTexture = loadPlanetTexture(loader, 'mars.jpg');
  return pbrMaterial(marsTexture, 0.96); // 干燥岩石/沙尘：极高粗糙度
}

function createVenusMaterial(manager) {
  const loader = new THREE.TextureLoader(manager);
  const venusTexture = loadPlanetTexture(loader, 'venus.jpg');
  return pbrMaterial(venusTexture, 0.85); // 硫酸云顶部相对均匀
}

function createMercuryMaterial(manager) {
  const loader = new THREE.TextureLoader(manager);
  const mercuryTexture = loadPlanetTexture(loader, 'mercury.jpg');
  return pbrMaterial(mercuryTexture, 0.97); // 无大气风化岩：完全漫反射
}

function createUranusMaterial(manager) {
  const loader = new THREE.TextureLoader(manager);
  const uranusTexture = loadPlanetTexture(loader, 'uranus.jpg');
  return pbrMaterial(uranusTexture, 0.88); // 冰巨星：甲烷雾霭
}

function createNeptuneMaterial(manager) {
  const loader = new THREE.TextureLoader(manager);
  const neptuneTexture = loadPlanetTexture(loader, 'neptune.jpg');
  return pbrMaterial(neptuneTexture, 0.88);
}

function createPlutoMaterial(manager) {
  const loader = new THREE.TextureLoader(manager);
  const plutoTexture = loadPlanetTexture(loader, 'pluto.jpg');
  return pbrMaterial(plutoTexture, 0.95); // 氮冰/甲烷冰混合表面
}

function createRings(planet) {
  // 土星使用多个环来模拟真实结构
  if (planet.name === '土星') {
    return createSaturnRingSystem(planet);
  }
  
  // 其他行星简单环
  const innerRadius = planet.radius * 1.4;
  const outerRadius = planet.radius * 2.2;
  const segments = 64;
  const opacity = planet.ringOpacity || 0.5;

  const ringGeometry = new THREE.RingGeometry(innerRadius, outerRadius, segments);
  const ringMaterial = new THREE.MeshStandardMaterial({
    color: 0x9aa7b5,
    side: THREE.DoubleSide,
    transparent: true,
    opacity: opacity,
    roughness: 0.9,
    metalness: 0.0
  });

  const ring = new THREE.Mesh(ringGeometry, ringMaterial);
  ring.rotation.x = Math.PI / 2;
  return ring;
}

function createSaturnRingSystem(planet) {
  const ringGroup = new THREE.Group();
  const radius = planet.radius;
  
  // 土星真实环结构 (从内到外): D, C, B, 卡西尼缝, A, F, G, E
  // 使用比例来模拟真实距离
  const rings = [
    // D环 - 最内侧，非常暗淡
    { inner: 1.11, outer: 1.19, opacity: 0.15, color: 0xb8a888, name: 'D' },
    // C环 - 暗淡
    { inner: 1.19, outer: 1.53, opacity: 0.25, color: 0xc8b898, name: 'C' },
    // B环 - 最亮最宽
    { inner: 1.53, outer: 1.95, opacity: 0.85, color: 0xe8dcc8, name: 'B' },
    // 卡西尼缝 - 间隙 (不绘制)
    // A环 - 次亮
    { inner: 2.03, outer: 2.27, opacity: 0.65, color: 0xd8ccb8, name: 'A' },
    // F环 - 窄而亮
    { inner: 2.30, outer: 2.33, opacity: 0.75, color: 0xf0e8d8, name: 'F' },
    // G环 - 非常暗淡
    { inner: 2.45, outer: 2.55, opacity: 0.2, color: 0xc0b0a0, name: 'G' },
    // E环 - 非常弥散暗淡
    { inner: 2.8, outer: 4.0, opacity: 0.08, color: 0xd0c8b8, name: 'E' }
  ];
  
  rings.forEach(ringData => {
    const innerR = radius * ringData.inner;
    const outerR = radius * ringData.outer;
    
    const geometry = new THREE.RingGeometry(innerR, outerR, 256);
    
    // 为B环和A环创建纹理
    let material;
    if (ringData.name === 'B' || ringData.name === 'A') {
      const texture = createDetailedRingTexture(ringData.name);
      material = new THREE.MeshStandardMaterial({
        map: texture,
        side: THREE.DoubleSide,
        transparent: true,
        opacity: ringData.opacity,
        roughness: 0.85,
        metalness: 0.0
      });
    } else {
      material = new THREE.MeshStandardMaterial({
        color: ringData.color,
        side: THREE.DoubleSide,
        transparent: true,
        opacity: ringData.opacity,
        roughness: 0.85,
        metalness: 0.0
      });
    }
    
    const ring = new THREE.Mesh(geometry, material);
    ring.rotation.x = Math.PI / 2;
    // 注意：环挂在行星 mesh 下，行星已通过 rotation.x 施加 26.7° 自转轴倾角，
    // 环自身不得再叠加倾角，否则产生双重倾斜。
    // 阴影：较亮的环投射阴影到土星表面，所有环均接收土星投下的阴影。
    ring.castShadow = ['B', 'A', 'C', 'F'].includes(ringData.name);
    ring.receiveShadow = true;
    if (material.map) {
      // 让阴影深度通道识别环贴图的透明结构，避免把整片圆面投成实心黑影；
      // 材质本身亦以 alphaTest 渲染，保证透明区域不写入深度。
      material.alphaTest = 0.03;
    }
    ringGroup.add(ring);
  });
  
  return ringGroup;
}

function createDetailedRingTexture(ringName) {
  const cvs = document.createElement('canvas');
  const size = 2048;
  cvs.width = size;
  cvs.height = size;
  const ctx = cvs.getContext('2d');
  
  const centerX = size / 2;
  const centerY = size / 2;
  const maxRadius = size * 0.48;
  const minRadius = size * 0.25;
  
  // 透明背景
  ctx.clearRect(0, 0, size, size);
  
  if (ringName === 'B') {
    // B环 - 最复杂，有很多小环缝
    const ringCount = 80;
    for (let i = 0; i < ringCount; i++) {
      const t = i / ringCount;
      const r = minRadius + (maxRadius - minRadius) * t;
      const width = 2 + Math.random() * 4;
      
      // 创建环缝效果 - 随机一些间隙
      const isGap = Math.random() > 0.92;
      const opacity = isGap ? 0.1 : 0.7 + Math.random() * 0.25;
      
      const gradient = ctx.createRadialGradient(centerX, centerY, r, centerX, centerY, r + width);
      gradient.addColorStop(0, `rgba(220, 210, 190, ${opacity})`);
      gradient.addColorStop(0.5, `rgba(240, 230, 210, ${opacity * 1.1})`);
      gradient.addColorStop(1, `rgba(200, 190, 170, ${opacity * 0.9})`);
      
      ctx.beginPath();
      ctx.arc(centerX, centerY, r + width, 0, Math.PI * 2);
      ctx.arc(centerX, centerY, r, 0, Math.PI * 2, true);
      ctx.fillStyle = gradient;
      ctx.fill();
    }
  } else if (ringName === 'A') {
    // A环 - 包含恩克缝
    const ringCount = 60;
    for (let i = 0; i < ringCount; i++) {
      const t = i / ringCount;
      const r = minRadius + (maxRadius - minRadius) * t;
      const width = 2 + Math.random() * 3;
      
      // 恩克缝 - 在约0.35位置
      const isEnckeGap = t > 0.32 && t < 0.38;
      const opacity = isEnckeGap ? 0.15 : 0.55 + Math.random() * 0.2;
      
      const gradient = ctx.createRadialGradient(centerX, centerY, r, centerX, centerY, r + width);
      gradient.addColorStop(0, `rgba(200, 190, 175, ${opacity})`);
      gradient.addColorStop(0.5, `rgba(220, 210, 195, ${opacity * 1.1})`);
      gradient.addColorStop(1, `rgba(190, 180, 165, ${opacity * 0.9})`);
      
      ctx.beginPath();
      ctx.arc(centerX, centerY, r + width, 0, Math.PI * 2);
      ctx.arc(centerX, centerY, r, 0, Math.PI * 2, true);
      ctx.fillStyle = gradient;
      ctx.fill();
    }
  }
  
  // 添加颗粒感
  for (let i = 0; i < 500; i++) {
    const r = minRadius + Math.random() * (maxRadius - minRadius);
    const angle = Math.random() * Math.PI * 2;
    const x = centerX + r * Math.cos(angle);
    const y = centerY + r * Math.sin(angle);
    const size = 0.5 + Math.random() * 2;
    
    ctx.fillStyle = `rgba(${200 + Math.random() * 40}, ${190 + Math.random() * 40}, ${170 + Math.random() * 30}, ${0.2 + Math.random() * 0.3})`;
    ctx.beginPath();
    ctx.arc(x, y, size, 0, Math.PI * 2);
    ctx.fill();
  }
  
  return new THREE.CanvasTexture(cvs);
}

function createSaturnRingsTexture() {
  // 这个函数现在只用于简单的环纹理
  const cvs = document.createElement('canvas');
  const size = 1024;
  cvs.width = size;
  cvs.height = size;
  const ctx = cvs.getContext('2d');

  ctx.fillStyle = 'rgba(0, 0, 0, 0)';
  ctx.fillRect(0, 0, size, size);

  const centerX = size / 2;
  const centerY = size / 2;
  const outerRadius = size * 0.48;
  const innerRadius = size * 0.28;

  const ringColors = [
    { start: 0.0, end: 0.15, color: 'rgba(210, 180, 140, 0.3)' },
    { start: 0.15, end: 0.25, color: 'rgba(180, 150, 110, 0.6)' },
    { start: 0.25, end: 0.35, color: 'rgba(160, 130, 90, 0.2)' },
    { start: 0.35, end: 0.5, color: 'rgba(200, 170, 130, 0.7)' },
    { start: 0.5, end: 0.6, color: 'rgba(140, 110, 80, 0.3)' },
    { start: 0.6, end: 0.75, color: 'rgba(190, 160, 120, 0.8)' },
    { start: 0.75, end: 0.85, color: 'rgba(170, 140, 100, 0.5)' },
    { start: 0.85, end: 1.0, color: 'rgba(150, 120, 90, 0.4)' }
  ];

  ringColors.forEach(ring => {
    const startR = innerRadius + (outerRadius - innerRadius) * ring.start;
    const endR = innerRadius + (outerRadius - innerRadius) * ring.end;
    
    const gradient = ctx.createRadialGradient(centerX, centerY, startR, centerX, centerY, endR);
    gradient.addColorStop(0, ring.color);
    gradient.addColorStop(1, ring.color);
    
    ctx.beginPath();
    ctx.arc(centerX, centerY, endR, 0, Math.PI * 2);
    ctx.arc(centerX, centerY, startR, 0, Math.PI * 2, true);
    ctx.fillStyle = gradient;
    ctx.fill();
  });

  for (let i = 0; i < 100; i++) {
    const r = innerRadius + Math.random() * (outerRadius - innerRadius);
    const angle = Math.random() * Math.PI * 2;
    const x = centerX + r * Math.cos(angle);
    const y = centerY + r * Math.sin(angle);
    const size = 1 + Math.random() * 3;
    
    ctx.fillStyle = `rgba(${100 + Math.random() * 100}, ${80 + Math.random() * 80}, ${50 + Math.random() * 50}, ${0.3 + Math.random() * 0.4})`;
    ctx.beginPath();
    ctx.arc(x, y, size, 0, Math.PI * 2);
    ctx.fill();
  }

  return new THREE.CanvasTexture(cvs);
}
