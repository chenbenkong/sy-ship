import * as THREE from 'three';

// 小行星带（火星—木星之间）：科研级尺寸分布
// 真实比例参照：谷神星（带内最大天体）半径约为地球半径的 0.074 倍，
// 绝大多数小行星是百米级以下的碎石。因此尺寸采用幂律分布——
// >99% 是 0.03~0.2 单位的碎砾，仅极少数接近谷神星级（~0.8 单位）。
export function createAsteroidBelt(innerRadius = 264, outerRadius = 384, count = 9000) {
  const group = new THREE.Group();

  const geometry = new THREE.IcosahedronGeometry(1, 0);
  const material = new THREE.MeshStandardMaterial({
    color: 0xffffff, // 基色白，由逐实例颜色调出 C/S 型小行星的棕灰差异
    roughness: 0.95,
    metalness: 0.0,
    flatShading: true
  });

  const mesh = new THREE.InstancedMesh(geometry, material, count);
  const dummy = new THREE.Object3D();
  const color = new THREE.Color();

  for (let i = 0; i < count; i++) {
    const r = innerRadius + Math.random() * (outerRadius - innerRadius);
    const theta = Math.random() * Math.PI * 2;
    // 轨道倾角弥散：高斯近似，绝大多数贴近黄道面
    const y = (Math.random() + Math.random() + Math.random() - 1.5) * 9;

    dummy.position.set(r * Math.cos(theta), y, r * Math.sin(theta));
    dummy.rotation.set(
      Math.random() * Math.PI,
      Math.random() * Math.PI,
      Math.random() * Math.PI
    );

    // 幂律尺寸：0.03 ~ 0.8，且向小端极度集中
    const s = 0.03 + Math.pow(Math.random(), 5) * 0.77;
    dummy.scale.set(s, s * (0.6 + Math.random() * 0.8), s);
    dummy.updateMatrix();
    mesh.setMatrixAt(i, dummy.matrix);

    // 棕灰色系变化（碳质/硅质小行星光谱差异）
    color.setHSL(0.07 + Math.random() * 0.05, 0.12 + Math.random() * 0.2, 0.3 + Math.random() * 0.32);
    mesh.setColorAt(i, color);
  }

  mesh.instanceMatrix.needsUpdate = true;
  if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
  mesh.castShadow = false;
  mesh.receiveShadow = false;
  group.add(mesh);

  return group;
}