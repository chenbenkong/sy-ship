import * as THREE from 'three';

// 快速 value-noise + fbm：生成丝状纤维星云纹理（参考哈勃深场影像的纤维结构）
function hash2(x, y) {
  const n = Math.sin(x * 127.1 + y * 311.7) * 43758.5453;
  return n - Math.floor(n);
}
function smoothstep(t) { return t * t * (3 - 2 * t); }
function vnoise(x, y) {
  const xi = Math.floor(x), yi = Math.floor(y);
  const xf = x - xi, yf = y - yi;
  const a = hash2(xi, yi), b = hash2(xi + 1, yi);
  const c = hash2(xi, yi + 1), d = hash2(xi + 1, yi + 1);
  const u = smoothstep(xf), v = smoothstep(yf);
  return a * (1 - u) * (1 - v) + b * u * (1 - v) + c * (1 - u) * v + d * u * v;
}
function fbm(x, y, octaves) {
  let val = 0, amp = 0.5, freq = 1, tot = 0;
  for (let i = 0; i < octaves; i++) {
    val += amp * vnoise(x * freq, y * freq);
    tot += amp; amp *= 0.5; freq *= 2.03;
  }
  return val / tot;
}

// 生成一帧纤维星云纹理，RGB 通道使用不同相位，产生彩色丝状结构 + 深空底色（有光泽）
function makeNebulaTexture() {
  const S = 512;
  const c = document.createElement('canvas');
  c.width = c.height = S;
  const ctx = c.getContext('2d');
  const img = ctx.createImageData(S, S);
  const d = img.data;

  for (let y = 0; y < S; y++) {
    for (let x = 0; x < S; x++) {
      const nx = x / S, ny = y / S;
      // 三通道使用不同的频率与相位，形成彩色纤维，pow 拉伸增强明暗对比
      const r = Math.pow(fbm(nx * 3.4 + 0.0, ny * 3.4 + 0.0, 5), 2.0);
      const g = Math.pow(fbm(nx * 3.4 + 1.7, ny * 3.4 + 5.1, 5), 2.0);
      const b = Math.pow(fbm(nx * 3.4 + 4.2, ny * 3.4 + 1.3, 5), 2.0);
      const base = 0.01 + 0.03 * fbm(nx * 1.5, ny * 1.5, 3);
      const o = (y * S + x) * 4;
      d[o]     = Math.min(255, (base * 80 + r * 210) | 0);
      d[o + 1] = Math.min(255, (base * 60 + g * 190) | 0);
      d[o + 2] = Math.min(255, (base * 120 + b * 235) | 0);
      d[o + 3] = Math.min(255, Math.pow((d[o] * 0.33 + d[o + 1] * 0.33 + d[o + 2] * 0.34) / 255, 1.55) * 340) | 0;
    }
  }
  ctx.putImageData(img, 0, 0);

  const tex = new THREE.CanvasTexture(c);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

// 生成一张柔光圆形贴图，用作纤维云之外的弥散光晕
function makeGlowTexture() {
  const c = document.createElement('canvas');
  c.width = c.height = 256;
  const ctx = c.getContext('2d');
  const g = ctx.createRadialGradient(128, 128, 0, 128, 128, 128);
  g.addColorStop(0, 'rgba(255,255,255,0.9)');
  g.addColorStop(0.4, 'rgba(255,255,255,0.35)');
  g.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 256, 256);
  const tex = new THREE.CanvasTexture(c);
  return tex;
}

// 深空星云：纤维状彩色云团（fbm 纹理）+ 少量弥散光晕
export function createNebulae() {
  const group = new THREE.Group();

  const fiberTex = makeNebulaTexture();
  const glowTex = makeGlowTexture();

  // 颜色方案：参考哈勃调色板 —— 青/蓝紫/品红/暖金，低透明度不抢戏
  const palettes = [
    { color: 0x4a6ee0, opacity: 0.5 },
    { color: 0x7a5dc8, opacity: 0.46 },
    { color: 0x3d9bb0, opacity: 0.42 },
    { color: 0xa04fb0, opacity: 0.40 },
    { color: 0x5a8be0, opacity: 0.46 },
  ];

  // 大块纤维状星云：沿银河带分布，数量适中，营造纵深
  for (let i = 0; i < 16; i++) {
    const p = palettes[i % palettes.length];
    const mat = new THREE.SpriteMaterial({
      map: fiberTex,
      color: p.color,
      transparent: true,
      opacity: p.opacity,
      blending: THREE.AdditiveBlending,
      depthWrite: false
    });
    const sprite = new THREE.Sprite(mat);
    const angle = Math.random() * Math.PI * 2;
    const radius = 2200 + Math.random() * 2000;
    const bandOffset = (Math.random() + Math.random() - 1) * 720;
    sprite.position.set(Math.cos(angle) * radius, bandOffset, Math.sin(angle) * radius);
    const s = 1600 + Math.random() * 2200;
    sprite.scale.set(s, s * (0.6 + Math.random() * 0.5), 1);
    group.add(sprite);
  }

  // 少量弥散光晕，柔化大云团边缘
  for (let i = 0; i < 12; i++) {
    const p = palettes[i % palettes.length];
    const mat = new THREE.SpriteMaterial({
      map: glowTex,
      color: p.color,
      transparent: true,
      opacity: p.opacity * 0.55,
      blending: THREE.AdditiveBlending,
      depthWrite: false
    });
    const sprite = new THREE.Sprite(mat);
    const angle = Math.random() * Math.PI * 2;
    const radius = 2000 + Math.random() * 2500;
    const bandOffset = (Math.random() + Math.random() - 1) * 1000;
    sprite.position.set(Math.cos(angle) * radius, bandOffset, Math.sin(angle) * radius);
    const s = 1200 + Math.random() * 1800;
    sprite.scale.set(s, s * (0.5 + Math.random() * 0.5), 1);
    group.add(sprite);
  }

  return group;
}