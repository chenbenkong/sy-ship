import * as THREE from 'three';
import { createProminences } from './createProminences.js';

export function createSun(manager) {
  const sunRadius = 35; // 真实比例：太阳相对行星轨道很小，缩小以适配水星轨道(46)

  // ===== 太阳表面贴图（8K 等距柱状投影）=====
  const textureLoader = new THREE.TextureLoader(manager);
  const sunTexture = textureLoader.load(import.meta.env.BASE_URL + 'textures/sun.jpg');
  sunTexture.anisotropy = 8;

  // ===== 太阳表面：临边昏暗 shader，营造"实心炽热球体"的体积感 =====
  // 关键：真实太阳中心亮、边缘暗（临边昏暗），而非均匀亮球，否则会像玻璃弹珠
  const sunGeometry = new THREE.SphereGeometry(sunRadius, 128, 128);
  const sunMaterial = new THREE.ShaderMaterial({
    uniforms: {
      sunTexture: { value: sunTexture },
      time: { value: 0 }
    },
    vertexShader: `
      varying vec2 vUv;
      varying vec3 vNormal;
      varying vec3 vViewDir;
      void main() {
        vUv = uv;
        vNormal = normalize(normalMatrix * normal);
        vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
        vViewDir = normalize(-mvPosition.xyz);
        gl_Position = projectionMatrix * mvPosition;
      }
    `,
    fragmentShader: `
      uniform sampler2D sunTexture;
      uniform float time;
      varying vec2 vUv;
      varying vec3 vNormal;
      varying vec3 vViewDir;

      void main() {
        vec3 normal = normalize(vNormal);
        vec3 viewDir = normalize(vViewDir);
        float cosTheta = max(dot(normal, viewDir), 0.0);

        // 临边昏暗：中心亮、边缘暗（实心球体的体积感来源）
        float limb = 1.0 - 0.62 * (1.0 - cosTheta);
        limb = clamp(limb, 0.30, 1.0);

        vec3 texColor = texture2D(sunTexture, vUv).rgb;

        // 表面微弱的等离子体流动感（极轻微的 UV 扰动）
        float flow = sin(vUv.y * 6.0 + time * 0.4) * 0.006;
        vec2 flowUv = vec2(vUv.x + flow, vUv.y);
        vec3 flowColor = texture2D(sunTexture, flowUv).rgb;
        texColor = mix(texColor, flowColor, 0.4);

        // 提升亮度让表面炽热，中心亮部超过 bloom 阈值以产生真实辉光
        vec3 color = texColor * limb * 1.12;

        gl_FragColor = vec4(color, 1.0);
      }
    `,
  });

  const sun = new THREE.Mesh(sunGeometry, sunMaterial);
  sun.position.set(0, 0, 0);
  sun.rotation.z = 0.126;

  // ===== 日冕：单个柔和的 Fresnel 边缘光，向外自然衰减（替代原来的多层透明球壳）=====
  const coronaGeometry = new THREE.SphereGeometry(sunRadius * 1.28, 96, 96);
  const coronaMaterial = new THREE.ShaderMaterial({
    uniforms: {
      time: { value: 0 },
      viewVector: { value: new THREE.Vector3() }
    },
    vertexShader: `
      varying vec3 vNormal;
      varying vec3 vViewDir;
      void main() {
        vNormal = normalize(normalMatrix * normal);
        vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
        vViewDir = normalize(-mvPosition.xyz);
        gl_Position = projectionMatrix * mvPosition;
      }
    `,
    fragmentShader: `
      uniform float time;
      varying vec3 vNormal;
      varying vec3 vViewDir;

      void main() {
        vec3 normal = normalize(vNormal);
        vec3 viewDir = normalize(vViewDir);

        // Fresnel：仅在太阳边缘向外晕开，中心完全透明，不会形成"外壳"
        float fresnel = pow(1.0 - abs(dot(normal, viewDir)), 3.0);

        // 金黄日冕，向外逐渐变淡
        vec3 color = mix(vec3(1.0, 0.85, 0.5), vec3(1.0, 0.62, 0.28), fresnel);
        float alpha = fresnel * 0.5;
        gl_FragColor = vec4(color, alpha);
      }
    `,
    side: THREE.BackSide,
    blending: THREE.AdditiveBlending,
    transparent: true,
    depthWrite: false
  });

  const corona = new THREE.Mesh(coronaGeometry, coronaMaterial);
  sun.add(corona);

  // 日珥：太阳边缘的等离子体喷发弧
  const prominences = createProminences(sunRadius);
  sun.add(prominences);

  sun.userData = {
    radius: sunRadius,
    material: sunMaterial,
    corona: corona,
    prominences: prominences
  };

  return sun;
}