import * as THREE from 'three';

// 快速 value-noise + fbm（用于环境贴图里的银河带与星云亮度变化）
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

// 生成一张低分辨率 equirectangular 环境贴图（用于金属反射）。
// 只需足够多的亮度变化（银河带 + 星云光斑），金属面即可反射出高光层次；
// PMREM 会做卷积与降采样，因此无需高分辨率与精细细节。
function makeEquirectTexture() {
  const W = 512, H = 256;
  const c = document.createElement('canvas');
  c.width = W; c.height = H;
  const ctx = c.getContext('2d');
  ctx.fillStyle = '#04050a';
  ctx.fillRect(0, 0, W, H);

  const img = ctx.createImageData(W, H);
  const d = img.data;

  for (let y = 0; y < H; y++) {
    const lat = (y / H) - 0.5;
    const band = Math.exp(-Math.pow(lat / 0.16, 2));
    for (let x = 0; x < W; x++) {
      const nx = x / W, ny = y / H;
      const dust = fbm(nx * 6, ny * 3, 3);
      const bright = band * (0.2 + 0.7 * Math.pow(dust, 1.4));
      const neb = Math.pow(fbm(nx * 2.0 + 1.3, ny * 2.0 + 0.7, 4), 2.0);
      const o = (y * W + x) * 4;
      d[o] = Math.min(255, bright * 200 + neb * 150) | 0;
      d[o + 1] = Math.min(255, bright * 190 + neb * 100) | 0;
      d[o + 2] = Math.min(255, bright * 185 + neb * 180) | 0;
      d[o + 3] = 255;
    }
  }
  ctx.putImageData(img, 0, 0);

  // 少量亮星，让金属反射出现零星高光
  for (let i = 0; i < 400; i++) {
    const x = Math.random() * W;
    const y = Math.random() < 0.5
      ? (H / 2) + (Math.random() + Math.random() - 1) * H * 0.16
      : Math.random() * H;
    ctx.fillStyle = `rgba(255,255,255,${(0.6 + Math.random() * 0.4).toFixed(2)})`;
    ctx.beginPath();
    ctx.arc(x, y, 0.5 + Math.random() * 1.5, 0, Math.PI * 2);
    ctx.fill();
  }

  const tex = new THREE.CanvasTexture(c);
  tex.mapping = THREE.EquirectangularReflectionMapping;
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

// 生成并返回可赋值给 scene.environment 的 PMREM 环境贴图；
// 失败时返回 null（材质退化为无环境反射）。
export function createEnvironment(renderer) {
  try {
    const pmrem = new THREE.PMREMGenerator(renderer);
    pmrem.compileEquirectangularShader();
    const envMap = pmrem.fromEquirectangular(makeEquirectTexture()).texture;
    pmrem.dispose();
    return envMap;
  } catch (e) {
    console.warn('[createEnvironment] 环境贴图生成失败，退回无反射:', e);
    return null;
  }
}