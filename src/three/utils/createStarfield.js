import * as THREE from 'three';

// 快速 value-noise + fbm（用于银河带的尘埃/明暗条带）
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
    tot += amp; amp *= 0.5; freq *= 2.0;
  }
  return val / tot;
}

// 生成"银河带"贴图：横向密集星点 + 明暗尘埃条带（横向 = 沿赤道）
function makeMilkyWayTexture() {
  const W = 1024, H = 256;
  const c = document.createElement('canvas');
  c.width = W; c.height = H;
  const ctx = c.getContext('2d');
  ctx.fillStyle = '#000'; ctx.fillRect(0, 0, W, H);

  // 底层：fbm 明暗尘埃条带
  const img = ctx.createImageData(W, H);
  const d = img.data;
  for (let y = 0; y < H; y++) {
    // 沿高度方向用高斯衰减模拟银河带厚度
    const band = Math.exp(-Math.pow((y - H / 2) / (H * 0.28), 2));
    for (let x = 0; x < W; x++) {
      const n = fbm(x / W * 6, y / H * 3, 5);
      const bright = band * (0.15 + 0.6 * n * n);
      const o = (y * W + x) * 4;
      d[o] = bright * 200;
      d[o + 1] = bright * 190;
      d[o + 2] = bright * 215;
      d[o + 3] = 255;
    }
  }
  ctx.putImageData(img, 0, 0);

  // 上层：密集星点（银河带内），暖白/冷白交错
  for (let i = 0; i < 2600; i++) {
    const x = Math.random() * W;
    const y = H / 2 + (Math.random() + Math.random() + Math.random() - 1.5) * H * 0.22;
    const r = 0.4 + Math.random() * 1.4;
    const warm = Math.random() < 0.4;
    ctx.fillStyle = warm
      ? `rgba(255,${235 + (Math.random() * 20) | 0},${210 + (Math.random() * 40) | 0},${0.5 + Math.random() * 0.5})`
      : `rgba(${220 + (Math.random() * 35) | 0},${225 + (Math.random() * 30) | 0},255,${0.5 + Math.random() * 0.5})`;
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fill();
  }

  const tex = new THREE.CanvasTexture(c);
  tex.wrapS = THREE.RepeatWrapping;
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

// 程序化星空：随机散布的恒星 + 沿"银河带"加密的彩色星簇 + 银河带亮带
export function createStarfield() {
  const starCount = 30000;
  const positions = new Float32Array(starCount * 3);
  const colors = new Float32Array(starCount * 3);
  const sizes = new Float32Array(starCount);

  const color = new THREE.Color();

  for (let i = 0; i < starCount; i++) {
    const i3 = i * 3;
    const radius = 4000 + Math.random() * 3500;

    let theta, phi;
    if (Math.random() < 0.42) {
      // 银河带：星点沿赤道带密集分布
      theta = Math.random() * Math.PI * 2;
      const band = (Math.random() + Math.random() + Math.random() - 1.5) * 0.28;
      phi = Math.acos(THREE.MathUtils.clamp(band, -1, 1));
    } else {
      theta = Math.random() * Math.PI * 2;
      phi = Math.acos(2 * Math.random() - 1);
    }

    positions[i3] = radius * Math.sin(phi) * Math.cos(theta);
    positions[i3 + 1] = radius * Math.sin(phi) * Math.sin(theta);
    positions[i3 + 2] = radius * Math.cos(phi);

    // 恒星颜色谱 + 视亮度：参考真实恒星的色-光关系，蓝白星亮、红矮星暗
    const starType = Math.random();
    let brightness;
    if (starType < 0.10) {
      // 蓝白亮星（O/B/A 型）
      const t = Math.random();
      color.setRGB(0.70 + t * 0.30, 0.78 + t * 0.22, 1.0);
      brightness = 3.0 + Math.random() * 4.0;
    } else if (starType < 0.32) {
      // 白星（F 型）
      color.setRGB(0.96, 0.96, 0.99);
      brightness = 1.8 + Math.random() * 2.4;
    } else if (starType < 0.48) {
      // 黄星（G 型，类太阳）
      color.setRGB(1.0, 0.90, 0.66);
      brightness = 1.2 + Math.random() * 1.6;
    } else {
      // 橙红矮星（K/M 型）：数量最多、最暗弱
      const t = Math.random();
      color.setRGB(1.0, 0.55 + t * 0.25, 0.32 + t * 0.20);
      brightness = 0.45 + Math.random() * 1.1;
    }

    colors[i3] = color.r;
    colors[i3 + 1] = color.g;
    colors[i3 + 2] = color.b;
    // 银河带星点更密集，亮度略放大，但保持自然层次
    const onBand = Math.abs(Math.cos(phi)) < 0.30;
    sizes[i] = brightness * (onBand ? 1.5 : 1.0);
  }

  const starGeometry = new THREE.BufferGeometry();
  starGeometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  starGeometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  starGeometry.setAttribute('size', new THREE.BufferAttribute(sizes, 1));

  const starMaterial = new THREE.ShaderMaterial({
    uniforms: { time: { value: 0 } },
    vertexShader: `
      attribute float size;
      attribute vec3 color;
      varying vec3 vColor;
      uniform float time;
      void main() {
        vColor = color;
        vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
        float twinkle = 0.75 + 0.25 * sin(time * 1.5 + position.x * 0.01 + position.y * 0.013);
        gl_PointSize = size * twinkle * (780.0 / -mvPosition.z);
        gl_Position = projectionMatrix * mvPosition;
      }
    `,
    fragmentShader: `
      varying vec3 vColor;
      void main() {
        float dist = length(gl_PointCoord - vec2(0.5));
        if (dist > 0.5) discard;
        float alpha = 1.0 - smoothstep(0.0, 0.5, dist);
        alpha = pow(alpha, 1.5);
        vec3 finalColor = vColor * (1.0 + alpha * 0.6);
        gl_FragColor = vec4(finalColor, alpha);
      }
    `,
    transparent: true,
    blending: THREE.AdditiveBlending,
    depthWrite: false
  });

  const stars = new THREE.Points(starGeometry, starMaterial);
  stars.userData.material = starMaterial;

  // ===== 亮星精灵层：大而柔和的彩色亮星（带光晕） =====
  const glowCvs = document.createElement('canvas');
  glowCvs.width = 64; glowCvs.height = 64;
  const gctx = glowCvs.getContext('2d');
  const grd = gctx.createRadialGradient(32, 32, 0, 32, 32, 32);
  grd.addColorStop(0, 'rgba(255,255,255,1)');
  grd.addColorStop(0.25, 'rgba(255,255,255,0.8)');
  grd.addColorStop(0.6, 'rgba(255,255,255,0.25)');
  grd.addColorStop(1, 'rgba(255,255,255,0)');
  gctx.fillStyle = grd;
  gctx.fillRect(0, 0, 64, 64);
  const glowTex = new THREE.CanvasTexture(glowCvs);

  const brightGroup = new THREE.Group();
  const brightColors = [0xffffff, 0xfff2d9, 0xcfe2ff, 0xffd9c2, 0xd9e8ff];
  for (let i = 0; i < 160; i++) {
    const c = new THREE.Color(brightColors[i % brightColors.length]);
    const sp = new THREE.Sprite(new THREE.SpriteMaterial({
      map: glowTex, color: c, transparent: true,
      opacity: 0.55 + Math.random() * 0.4,
      blending: THREE.AdditiveBlending, depthWrite: false
    }));
    const radius = 4200 + Math.random() * 2800;
    const th = Math.random() * Math.PI * 2;
    const ph = Math.random() < 0.6
      ? Math.acos(THREE.MathUtils.clamp((Math.random() + Math.random() + Math.random() - 1.5) * 0.3, -1, 1))
      : Math.acos(2 * Math.random() - 1);
    sp.position.set(
      radius * Math.sin(ph) * Math.cos(th),
      radius * Math.sin(ph) * Math.sin(th),
      radius * Math.cos(ph)
    );
    const s = 8 + Math.random() * 22;
    sp.scale.set(s, s, 1);
    brightGroup.add(sp);
  }

  const root = new THREE.Group();
  root.add(stars);
  root.add(brightGroup);
  root.userData.material = starMaterial;
  return root;
}