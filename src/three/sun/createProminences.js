import * as THREE from 'three';

// 太阳日珥：色球层边缘偶发的等离子体喷发弧，真实存在的太阳活动现象。
// 实现：若干贴着太阳边缘的小股发光粒子簇，缓慢脉动、随机重生。
export function createProminences(sunRadius) {
  const group = new THREE.Group();
  const count = 9;
  const clusters = [];

  const puffCanvas = document.createElement('canvas');
  puffCanvas.width = 64;
  puffCanvas.height = 64;
  const pctx = puffCanvas.getContext('2d');
  const g = pctx.createRadialGradient(32, 32, 0, 32, 32, 32);
  g.addColorStop(0, 'rgba(255,220,150,0.9)');
  g.addColorStop(0.5, 'rgba(255,160,80,0.35)');
  g.addColorStop(1, 'rgba(255,120,40,0)');
  pctx.fillStyle = g;
  pctx.fillRect(0, 0, 64, 64);
  const puffTex = new THREE.CanvasTexture(puffCanvas);

  function newCluster() {
    // 随机边缘位置（球面均匀采样）
    const theta = Math.random() * Math.PI * 2;
    const phi = Math.acos(Math.random() * 2 - 1);
    const dir = new THREE.Vector3(
      Math.sin(phi) * Math.cos(theta),
      Math.sin(phi) * Math.sin(theta),
      Math.cos(phi)
    );
    return {
      dir,
      baseAngle: Math.random() * Math.PI * 2,
      phase: Math.random() * Math.PI * 2,
      speed: 0.4 + Math.random() * 0.8,
      maxScale: 4 + Math.random() * 7,
      life: 0,
      lifespan: 6 + Math.random() * 8,
      sprites: []
    };
  }

  for (let i = 0; i < count; i++) {
    const c = newCluster();
    // 每簇 5 个粒子排成一道小弧
    for (let j = 0; j < 5; j++) {
      const mat = new THREE.SpriteMaterial({
        map: puffTex,
        transparent: true,
        opacity: 0,
        blending: THREE.AdditiveBlending,
        depthWrite: false
      });
      const sprite = new THREE.Sprite(mat);
      group.add(sprite);
      c.sprites.push(sprite);
    }
    clusters.push(c);
  }

  function update(time) {
    for (const c of clusters) {
      c.life += 1 / 60;
      if (c.life > c.lifespan) {
        // 重生：换位置换参数
        const fresh = newCluster();
        Object.assign(c, fresh, { sprites: c.sprites, life: 0 });
        continue;
      }
      // 生命周期包络：淡入-持续-淡出
      const t = c.life / c.lifespan;
      const envelope = Math.sin(t * Math.PI);

      // 弧状排布：沿太阳边缘切向展开的 5 个点
      const tangent = new THREE.Vector3(0, 1, 0).cross(c.dir);
      if (tangent.lengthSq() < 0.01) tangent.set(1, 0, 0).cross(c.dir);
      tangent.normalize();

      for (let j = 0; j < c.sprites.length; j++) {
        const s = c.sprites[j];
        const arcT = (j / (c.sprites.length - 1)) - 0.5; // -0.5..0.5
        const arcAngle = arcT * 1.2;
        // 从边缘向外的小股喷射高度
        const rise = (1 - Math.abs(arcT) * 1.4) * c.maxScale * envelope;
        const arcOffset = tangent.clone().multiplyScalar(Math.sin(arcAngle) * 4);
        const radial = c.dir.clone().multiplyScalar(sunRadius + 1 + rise);
        s.position.copy(radial).add(arcOffset);
        const sc = (2 + rise * 0.5) * envelope;
        s.scale.set(sc, sc, 1);
        s.material.opacity = 0.5 * envelope;
      }
    }
  }

  group.userData.update = update;
  return group;
}