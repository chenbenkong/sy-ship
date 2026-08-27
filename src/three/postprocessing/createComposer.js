import * as THREE from 'three';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/examples/jsm/postprocessing/OutputPass.js';

// 后期处理管线：场景渲染 -> 辉光 -> 输出（负责色彩空间与色调映射）
export function createComposer(renderer, scene, camera) {
  const size = new THREE.Vector2();
  renderer.getSize(size);

  const composer = new EffectComposer(renderer);
  composer.addPass(new RenderPass(scene, camera));

  // strength 辉光强度 / radius 扩散半径 / threshold 仅高亮区域发光
  const bloomPass = new UnrealBloomPass(
    new THREE.Vector2(size.x, size.y),
    0.42, // strength
    0.5,  // radius
    0.97  // threshold：仅太阳/超亮星点泛光，数据屏文字不泛光：仅太阳与高亮星点发光，行星漫反射不参与泛光
  );
  composer.addPass(bloomPass);

  // OutputPass 统一做 ACES 色调映射 + sRGB 转换，避免双重映射
  composer.addPass(new OutputPass());

  return { composer, bloomPass };
}
