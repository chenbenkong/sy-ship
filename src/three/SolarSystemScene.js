import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { createSun } from './sun/createSun.js';
import { createPlanets } from './planets/createPlanets.js';
import { createStarfield } from './utils/createStarfield.js';
import { createComposer } from './postprocessing/createComposer.js';
import { createAsteroidBelt } from './objects/createAsteroidBelt.js';
import { createKuiperBelt } from './objects/createKuiperBelt.js';
import { createEnterprise } from './objects/createEnterprise.js';
import { renderDataScreen } from './objects/createBridgeInterior.js';
import { createEnvironment } from './utils/createEnvironment.js';
import { createComet } from './objects/createComet.js';
import { ORBITAL_MEAN_ELEMENTS } from '../data/orbitalData.js';

export class SolarSystemScene {
  constructor(container) {
    this.container = container;
    this.scene = null;
    this.camera = null;
    this.renderer = null;
    this.controls = null;
    this.sun = null;
    this.solarSystem = null;
    this.starField = null;
    this.planetMeshes = [];
    this.sunLight = null;
    
    this.isPaused = false;
    this.timeSpeed = 1;
    this.showOrbits = true;
    this.showStars = true;
    this.showNames = false;
    this.globalScale = 1.0;
    
    this.currentTargetPlanet = null;
    this.targetDistance = 300;
    this.cameraMoveSpeed = 0.05;
    
    this.animationId = null;
    this.onPlanetClick = null;
    this.onSunClick = null;
    this.onMoonClick = null;
    this.onCharonClick = null;
    
    this.raycaster = null;
    this.mouse = null;
    this.hoverName = null;
    this.isDragging = false;
    this.onHover = null;

    this.composer = null;
    this.bloomPass = null;
    this.composerBroken = false;
    this.asteroidBelt = null;
    this.kuiperBelt = null;
    this.nebulae = null;
    this.comet = null;
    this.loadingManager = null;
    this.onLoaded = null;
    this.onProgress = null;
    this.introPlaying = false;
    this.cameraAnimating = false;
    // 科研级仿真时钟：以 J2000 历元为基准的连续仿真时间（天）
    this.simDays = null;
    this.lastFrameTime = null;
    this.simDate = null;
    this.DAYS_PER_SEC_AT_SPEED_1 = 5;

    // ---- 探索模式（企业号星舰）----
    this.enterprise = null;          // 飞船 Group
    this.exploreMode = false;        // 是否处于探索模式
    this.exploreView = 'third';      // 'third' 第三视角 / 'first' 第一视角
    this.exploreKeys = new Set();    // 按下的按键
    this.showDataScreen = true;       // 第一视角仪表盘显隐
    this.exploreVelocity = new THREE.Vector3();
    this.exploreRollVel = 0;
    this.joyInput = { x: 0, y: 0 };
    // 姿态角速度（俯仰/偏航也走平滑，避免"一点就翻"的突兀感）
    this.explorePitchVel = 0;
    this.exploreYawVel = 0;
    this.shipYaw = 0; // 汽车式姿态：唯一姿态自由度（偏航角）
    // 自动驾驶：null=关闭，'free'=自由巡航，或目标天体名称
    this.autopilot = null;
    this.autopilotArrived = false;
    this._apViewOffset = null;
    this.onAutopilotChange = null;
    this.exploreSpeedMul = 1;        // 当前推进速度倍率（受 Shift 加速）
    this.savedCameraState = null;    // 进入探索前的相机状态，退出时还原
    this.onExploreModeChange = null; // UI 回调
    this._exploreKeydown = null;
    this._exploreKeyup = null;
  }

  init() {
    this.scene = new THREE.Scene();
    this.scene.background = this.createSpaceBackground();
    
    this.camera = new THREE.PerspectiveCamera(
      60,
      window.innerWidth / window.innerHeight,
      0.1,
      20000
    );
    this.camera.position.set(0, 300, 800);
    
    this.renderer = new THREE.WebGLRenderer({
      antialias: true,
      alpha: true,
      powerPreference: 'high-performance'
    });
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.35;
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.container.appendChild(this.renderer.domElement);
    
    this.controls = new OrbitControls(this.camera, this.renderer.domElement);
    this.controls.enableDamping = true;
    this.controls.dampingFactor = 0.05;
    this.controls.enablePan = true;
    this.controls.enableRotate = true;
    this.controls.enableZoom = true;
    this.controls.minDistance = 18;
    this.controls.maxDistance = 7000; // 适配真实比例太阳系（冥王星轨道 ~4738）
    
    // 监听鼠标/触摸事件来区分操作类型
    let isZooming = false;
    
    this.renderer.domElement.addEventListener('wheel', () => {
      isZooming = true;
      setTimeout(() => { isZooming = false; }, 100);
    }, { passive: true });
    
    this.controls.addEventListener('start', () => {
      this.isDragging = true;
      // 只有在非缩放操作时取消追踪
      if (this.currentTargetPlanet && !isZooming) {
        this.currentTargetPlanet = null;
      }
    });
    this.controls.addEventListener('end', () => {
      this.isDragging = false;
    });
    
    this.setupLighting();
    
    this.starField = createStarfield();
    this.scene.add(this.starField);
    
    this.solarSystem = new THREE.Group();
    this.scene.add(this.solarSystem);
    
    // 加载管理器：所有贴图加载完成后通知 UI 关闭加载页
    this.loadingManager = new THREE.LoadingManager();
    this.loadingManager.onLoad = () => {
      if (this.onLoaded) this.onLoaded();
      this.playIntro();
    };
    this.loadingManager.onProgress = (url, loaded, total) => {
      if (this.onProgress) this.onProgress(loaded / total);
    };
    
    this.sun = createSun(this.loadingManager);
    this.sun.castShadow = false;
    this.solarSystem.add(this.sun);
    
    this.planetMeshes = createPlanets(this.solarSystem, this.loadingManager);
    
    // 火星—木星之间的小行星带
    this.asteroidBelt = createAsteroidBelt();
    this.solarSystem.add(this.asteroidBelt);

    // 海王星轨道外的柯伊伯带（冰质小天体）
    this.kuiperBelt = createKuiperBelt();
    this.solarSystem.add(this.kuiperBelt);

    // 深空星云（挂在场景根节点，不随缩放变化，保持背景感）

    // 偶尔掠过的彗星
    this.comet = createComet();
    this.scene.add(this.comet);

    // 企业号星舰（默认隐藏，进入探索模式时启用）
    this.enterprise = createEnterprise();
    this.enterprise.position.set(0, 60, 950);
    this.enterprise.visible = false;
    this.scene.add(this.enterprise);
    
    this.raycaster = new THREE.Raycaster();
    this.mouse = new THREE.Vector2();
    
    this.setupResize();
    this.setupClick();
    this.setupHover();

    // 仿真时钟：自 2026 年 1 月 1 日启动（用户指定起始时间），
    // 行星初始位置即对应该日真实天象
    const J2000 = Date.UTC(2000, 0, 1, 12);
    const SIM_START = Date.UTC(2026, 0, 1, 12);
    this.simDays = (SIM_START - J2000) / 86400000;
    this.lastFrameTime = performance.now();
    
    // 后期处理：辉光管线（构造失败则退回普通渲染，保证场景始终可见）
    try {
      const { composer, bloomPass } = createComposer(this.renderer, this.scene, this.camera);
      this.composer = composer;
      this.bloomPass = bloomPass;
    } catch (e) {
      console.error('[solar] 后期辉光管线初始化失败，退回普通渲染：', e);
      this.composer = null;
      this.bloomPass = null;
    }
    
    this.animate();
  }

  // 深空背景：细微的蓝紫径向渐变，避免纯黑的死板
  createSpaceBackground() {
    const c = document.createElement('canvas');
    c.width = 64;
    c.height = 64;
    const ctx = c.getContext('2d');
    const g = ctx.createRadialGradient(32, 32, 0, 32, 32, 46);
    g.addColorStop(0, '#05060b');
    g.addColorStop(0.55, '#020309');
    g.addColorStop(1, '#010104');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, 64, 64);
    const tex = new THREE.CanvasTexture(c);
    tex.colorSpace = THREE.SRGBColorSpace;
    return tex;
  }

  setupLighting() {
    // 科研级光照（参照 NASA Eyes / Celestia 的渲染思路）：
    //  - 太阳点光源为唯一主光源，产生真实的昼夜晨昏线
    //  - 极弱的冷色半球光模拟"星光 + 黄道光"的环境底光，
    //    让夜侧保有可辨识的细节而不产生"光膜"
    //  - 不再使用 fill/rim/back 等方向补光抹平昼夜对比
    // 程序化星空环境贴图：让金属船体反射出银河/星云的高光层次，摆脱塑料哑光感
    const envMap = createEnvironment(this.renderer);
    if (envMap) {
      this.scene.environment = envMap;
    }

    const skyLight = new THREE.HemisphereLight(0x2c3a52, 0x11151f, 0.75);
    this.scene.add(skyLight);

    this.sunLight = new THREE.PointLight(0xfff2e0, 1.6, 0, 0.12);
    this.sunLight.position.set(0, 0, 0);
    this.sunLight.castShadow = true;
    this.sunLight.shadow.mapSize.width = 2048;
    this.sunLight.shadow.mapSize.height = 2048;
    this.sunLight.shadow.camera.near = 1;
    this.sunLight.shadow.camera.far = 2000;
    this.sunLight.shadow.bias = -0.0001;
    this.scene.add(this.sunLight);
  }

  setupClick() {
    this.renderer.domElement.addEventListener('click', (event) => {
      this.mouse.x = (event.clientX / window.innerWidth) * 2 - 1;
      this.mouse.y = -(event.clientY / window.innerHeight) * 2 + 1;
      
      this.raycaster.setFromCamera(this.mouse, this.camera);
      
      // 首先检测月球（因为它是子对象，需要优先检测）
      const moonMeshes = [];
      this.planetMeshes.forEach(planet => {
        if (planet.moon) moonMeshes.push(planet.moon);
      });
      const moonIntersects = this.raycaster.intersectObjects(moonMeshes);
      if (moonIntersects.length > 0 && this.onMoonClick) {
        const planet = this.planetMeshes.find(p => p.moon === moonIntersects[0].object);
        if (planet) {
          const moonTarget = {
            name: '月球',
            mesh: planet.moon,
            radius: planet.moon.geometry.parameters.radius,
            isMoon: true,
            parentPlanet: planet
          };
          this.currentTargetPlanet = moonTarget;
          this.moveCameraToPlanet(moonTarget);
          this.onMoonClick();
        }
        return;
      }
      
      // 然后检测行星
      const planetIntersects = this.raycaster.intersectObjects(
        this.planetMeshes.map(p => p.mesh)
      );
      
      if (planetIntersects.length > 0) {
        const planet = this.planetMeshes.find(
          p => p.mesh === planetIntersects[0].object
        );
        if (planet && this.onPlanetClick) {
          this.currentTargetPlanet = planet;
          this.moveCameraToPlanet(planet);
          this.onPlanetClick(planet);
        }
        return;
      }
      
      // 最后检测太阳
      const sunIntersects = this.raycaster.intersectObject(this.sun);
      if (sunIntersects.length > 0 && this.onSunClick) {
        const sunTarget = {
          name: '太阳',
          mesh: this.sun,
          radius: 35
        };
        this.currentTargetPlanet = sunTarget;
        this.moveCameraToPlanet(sunTarget);
        this.onSunClick();
        return;
      }
    });
  }

  // 悬停检测：鼠标划过天体时变为可点击指针，并回调天体名称供 UI 提示
  setupHover() {
    this.hoverName = null;
    this.renderer.domElement.addEventListener('pointermove', (event) => {
      if (this.isDragging) return;
      this.mouse.x = (event.clientX / window.innerWidth) * 2 - 1;
      this.mouse.y = -(event.clientY / window.innerHeight) * 2 + 1;
      this.raycaster.setFromCamera(this.mouse, this.camera);

      const targets = [...this.planetMeshes.map(p => p.mesh)];
      if (this.sun) targets.push(this.sun);

      const hits = this.raycaster.intersectObjects(targets, false);
      let name = null;
      if (hits.length > 0) {
        const obj = hits[0].object;
        if (obj === this.sun) {
          name = '太阳';
        } else {
          const p = this.planetMeshes.find(pl => pl.mesh === obj);
          if (p) name = p.name;
        }
      }
      // 月球也检测
      if (!name) {
        const moons = this.planetMeshes.filter(p => p.moon).map(p => p.moon);
        if (moons.length && this.raycaster.intersectObjects(moons, false).length > 0) name = '月球';
      }

      this.renderer.domElement.style.cursor = name ? 'pointer' : '';
      if (name !== this.hoverName) {
        this.hoverName = name;
        if (this.onHover) this.onHover(name, event.clientX, event.clientY);
      }
    });
  }

  moveCameraToPlanet(planet) {
    const worldPosition = new THREE.Vector3();
    planet.mesh.getWorldPosition(worldPosition);
    
    // 计算特写距离 - 根据星球大小调整
    let closeUpDistance;
    if (planet.name === '太阳') {
      closeUpDistance = 120; // 太阳特写距离
    } else if (planet.name === '月球') {
      closeUpDistance = 15; // 月球特写距离
    } else if (planet.name === '土星') {
      closeUpDistance = planet.radius * 4; // 土星要考虑环
    } else if (planet.name === '木星') {
      closeUpDistance = planet.radius * 2.5;
    } else {
      closeUpDistance = planet.radius * 3; // 其他行星
    }
    
    // 设置相机目标位置（星球前方）
    const targetCameraPos = new THREE.Vector3(
      worldPosition.x + closeUpDistance,
      worldPosition.y + closeUpDistance * 0.3,
      worldPosition.z + closeUpDistance
    );
    
    // 平滑移动相机
    this.animateCameraToPosition(targetCameraPos, worldPosition);
  }
  
  animateCameraToPosition(targetPos, lookAtPos) {
    const startPos = this.camera.position.clone();
    const startTarget = this.controls.target.clone();
    const duration = 1000; // 1秒动画
    const startTime = Date.now();
    
    // 飞行期间挂起相机追踪，避免追踪逻辑与飞行动画互相拉扯
    this.cameraAnimating = true;
    
    const animate = () => {
      const elapsed = Date.now() - startTime;
      const progress = Math.min(elapsed / duration, 1);
      
      // 使用缓动函数 (ease-out cubic)
      const easeProgress = 1 - Math.pow(1 - progress, 3);
      
      // 插值相机位置
      this.camera.position.lerpVectors(startPos, targetPos, easeProgress);
      
      // 插值目标点
      this.controls.target.lerpVectors(startTarget, lookAtPos, easeProgress);
      
      // 更新控制器
      this.controls.update();
      
      if (progress < 1) {
        requestAnimationFrame(animate);
      } else {
        this.cameraAnimating = false;
      }
    };
    
    animate();
  }

  setupResize() {
    window.addEventListener('resize', () => {
      this.camera.aspect = window.innerWidth / window.innerHeight;
      this.camera.updateProjectionMatrix();
      this.renderer.setSize(window.innerWidth, window.innerHeight);
      if (this.composer) this.composer.setSize(window.innerWidth, window.innerHeight);
    });
  }

  animate() {
    this.animationId = requestAnimationFrame(() => this.animate());
    
    const time = Date.now() * 0.001;
    
    // 推进仿真时钟（增量累积，不受 Date.now 跳变和速度改变影响）
    const now = performance.now();
    let dt = Math.min((now - this.lastFrameTime) / 1000, 0.1);
    this.lastFrameTime = now;
    if (!this.isPaused && this.timeSpeed > 0) {
      this.simDays += dt * this.timeSpeed * this.DAYS_PER_SEC_AT_SPEED_1;
    }
    if (this.simDays !== null) {
      const J2000_MS = Date.UTC(2000, 0, 1, 12);
      this.simDate = new Date(J2000_MS + this.simDays * 86400000);
    }
    
    if (!this.isPaused) {
      this.updatePlanets();
      this.updateSun();
    }
    
    if (this.starField && this.starField.userData.material) {
      this.starField.userData.material.uniforms.time.value = time;
    }

    // 彗星飞行更新
    if (this.comet && this.comet.userData.update) {
      this.comet.userData.update();
    }
    
    if (!this.cameraAnimating) {
      if (this.currentTargetPlanet) {
        this.updateCameraTracking();
      } else {
        this.controls.update();
      }
    }
    
    // 探索模式：企业号飞行控制
    if (this.exploreMode && this.enterprise) {
      this.updateShip(dt);
    }

    // 防止相机进入星球内部
    if (!this.exploreMode) {
      this.preventCameraInsidePlanets();
    }

    // 渲染：优先走辉光后期管线；一旦抛错则永久退回普通渲染，避免整屏黑屏
    if (this.composerBroken || !this.composer) {
      this.renderer.render(this.scene, this.camera);
      return;
    }
    try {
      this.composer.render();
    } catch (e) {
      console.error('[solar] composer.render 失败，退回普通渲染：', e);
      this.composerBroken = true;
      try {
        this.renderer.render(this.scene, this.camera);
      } catch (_) { /* 忽略，下一帧继续 */ }
    }
  }

  // ===== 开普勒位置计算（J2000 日心黄道坐标 → 场景坐标） =====
  // el：轨道根数（a AU / e / i 度 / OM 升交点黄经度 / varpi 近日点黄经度 / L0 平黄经度 / periodDays 天）
  // simDays：自 J2000 起的仿真天数。返回场景坐标（黄道面=XZ，黄道北极=+Y，SCALE=120 单位/AU）
  keplerPosition(el, simDays) {
    const SCALE = 120; // 场景单位 / AU
    const a = el.a, e = el.e;
    const d2r = THREE.MathUtils.degToRad;
    const OM = d2r(el.OM), varpi = d2r(el.varpi), L0 = d2r(el.L0);
    const i = d2r(el.i);
    const omega = varpi - OM; // 近日点幅角
    // 平近点角 M = M0 + n·t，M0 = L0 − ϖ
    let M = (L0 - varpi) + (2 * Math.PI * simDays) / el.periodDays;
    M = M % (Math.PI * 2);
    if (M < 0) M += Math.PI * 2;
    // 牛顿迭代解 开普勒方程 E − e·sinE = M
    let E = M;
    for (let k = 0; k < 20; k++) {
      const dE = (E - e * Math.sin(E) - M) / (1 - e * Math.cos(E));
      E -= dE;
      if (Math.abs(dE) < 1e-9) break;
    }
    // 真近点角 ν 与 日心距 r
    const nu = 2 * Math.atan2(Math.sqrt(1 + e) * Math.sin(E / 2), Math.sqrt(1 - e) * Math.cos(E / 2));
    const r = a * (1 - e * Math.cos(E));
    const u = nu + omega; // 纬度辐角
    const ci = Math.cos(i), si = Math.sin(i);
    const cO = Math.cos(OM), sO = Math.sin(OM);
    // 日心黄道直角坐标（AU）：x 春分点 / y 黄道面 / z 黄道北极
    const Xa = r * (cO * Math.cos(u) - sO * Math.sin(u) * ci);
    const Ya = r * (sO * Math.cos(u) + cO * Math.sin(u) * ci);
    const Za = r * (Math.sin(u) * si);
    // 映射场景：黄道面 → XZ，黄道北极 → +Y
    return new THREE.Vector3(Xa * SCALE, Za * SCALE, Ya * SCALE);
  }

  updatePlanets() {
    const time = Date.now();
    
    // 地球夜光：将太阳位置变换到相机视空间，供注入的着色器 uniform 使用
    const earth = this.planetMeshes.find(p => p.name === '地球');
    if (earth && earth.mesh.material.userData && earth.mesh.material.userData.shader) {
      const sunView = this.sun.position.clone().applyMatrix4(this.camera.matrixWorldInverse);
      earth.mesh.material.userData.shader.uniforms.sunPosView.value.copy(sunView);
    }
    
    this.planetMeshes.forEach(planet => {
      planet.mesh.rotation.y += planet.rotationSpeed * this.timeSpeed;
      
      // 公转位置：完整开普勒六根数（J2000 日心黄道坐标）；无根数时回退旧圆轨道近似
      const el = ORBITAL_MEAN_ELEMENTS[planet.name];
      if (el && el.e !== undefined) {
        planet.mesh.position.copy(this.keplerPosition(el, this.simDays));
      } else {
        const angle = el
          ? THREE.MathUtils.degToRad(el.L0) + (2 * Math.PI * this.simDays) / el.periodDays
          : time * 0.0001 * planet.orbitSpeed * this.timeSpeed;
        planet.mesh.position.set(Math.cos(angle) * planet.distance, 0, Math.sin(angle) * planet.distance);
      }
      
      if (planet.clouds) {
        planet.clouds.rotation.y += planet.rotationSpeed * this.timeSpeed * 1.35;
      }
      if (planet.moon) {
        // 恒星月 27.32 天，相位固定偏移避免与地球贴图同相位
        const moonAngle = 1.2 + (2 * Math.PI * this.simDays) / 27.32;
        const moonRadius = planet.radius * 2;
        planet.moon.position.x = moonRadius * Math.cos(moonAngle);
        planet.moon.position.z = moonRadius * Math.sin(moonAngle);
        planet.moon.rotation.y += 0.0003 * this.timeSpeed;
      }
    });
    
    // 小行星带整体缓慢公转
    if (this.asteroidBelt) {
      this.asteroidBelt.rotation.y += 0.0003 * this.timeSpeed;
    }
    if (this.kuiperBelt) {
      this.kuiperBelt.rotation.y += 0.00004 * this.timeSpeed;
    }
  }

  updateSun() {
    if (this.sun) {
      this.sun.rotation.y += 0.005 * this.timeSpeed;
      
      const pulseFactor = Math.sin(Date.now() * 0.001) * 0.02 + 1;
      this.sun.scale.set(pulseFactor, pulseFactor, pulseFactor);
      
      if (this.sunLight) {
        this.sunLight.intensity = 1.6 + Math.sin(Date.now() * 0.002) * 0.08;
      }
      
      const time = Date.now() * 0.001;
      
      if (this.sun.userData) {
        if (this.sun.userData.material && this.sun.userData.material.uniforms) {
          this.sun.userData.material.uniforms.time.value = time;
        }
        
        if (this.sun.userData.corona && this.sun.userData.corona.material.uniforms) {
          this.sun.userData.corona.material.uniforms.viewVector.value = 
            new THREE.Vector3().subVectors(this.camera.position, this.sun.position);
          this.sun.userData.corona.material.uniforms.time.value = time;
        }

        if (this.sun.userData.prominences && this.sun.userData.prominences.userData.update) {
          this.sun.userData.prominences.userData.update(time);
        }
      }
    }
  }

  updateCameraTracking() {
    const worldPosition = new THREE.Vector3();
    this.currentTargetPlanet.mesh.getWorldPosition(worldPosition);
    
    // 根据时间速度动态调整相机跟随速度
    // 基础速度0.08，时间速度越快，跟随速度也越快
    const adaptiveSpeed = Math.min(0.08 * Math.max(this.timeSpeed, 1), 0.3);
    
    // 计算相机相对于目标的位置偏移
    const offset = new THREE.Vector3().subVectors(this.camera.position, this.controls.target);
    
    // 更新目标点到行星位置（使用自适应速度）
    this.controls.target.lerp(worldPosition, adaptiveSpeed);
    
    // 保持相机相对位置跟随目标
    const newCameraPosition = new THREE.Vector3().addVectors(worldPosition, offset);
    this.camera.position.lerp(newCameraPosition, adaptiveSpeed);
    
    this.controls.update();
  }

  setPaused(paused) {
    this.isPaused = paused;
  }

  setBloom(enabled) {
    if (this.bloomPass) this.bloomPass.enabled = enabled;
  }

  setTimeSpeed(speed) {
    this.timeSpeed = speed;
  }

  preventCameraInsidePlanets() {
    const cameraPos = this.camera.position.clone();
    
    // 检查太阳
    const sunDistance = cameraPos.distanceTo(this.sun.position);
    const sunMinDistance = 55; // 太阳半径50 + 缓冲5
    if (sunDistance < sunMinDistance) {
      const direction = cameraPos.clone().sub(this.sun.position).normalize();
      this.camera.position.copy(this.sun.position.clone().add(direction.multiplyScalar(sunMinDistance)));
    }
    
    // 检查所有行星
    this.planetMeshes.forEach(planet => {
      const worldPosition = new THREE.Vector3();
      planet.mesh.getWorldPosition(worldPosition);
      const distance = cameraPos.distanceTo(worldPosition);
      const minDistance = planet.radius * 1.2; // 行星半径 + 20%缓冲
      
      if (distance < minDistance) {
        const direction = cameraPos.clone().sub(worldPosition).normalize();
        this.camera.position.copy(worldPosition.clone().add(direction.multiplyScalar(minDistance)));
      }
      
      // 检查月球
      if (planet.moon) {
        const moonWorldPosition = new THREE.Vector3();
        planet.moon.getWorldPosition(moonWorldPosition);
        const moonDistance = cameraPos.distanceTo(moonWorldPosition);
        const moonMinDistance = planet.radius * 0.27 * 1.2; // 月球半径 + 缓冲
        
        if (moonDistance < moonMinDistance) {
          const direction = cameraPos.clone().sub(moonWorldPosition).normalize();
          this.camera.position.copy(moonWorldPosition.clone().add(direction.multiplyScalar(moonMinDistance)));
        }
      }
    });
  }

  setShowOrbits(show) {
    this.showOrbits = show;
    this.planetMeshes.forEach(planet => {
      if (planet.orbit) {
        planet.orbit.visible = show;
      }
    });
  }

  setShowStars(show) {
    this.showStars = show;
    if (this.starField) {
      this.starField.visible = show;
    }
    if (this.comet) {
      this.comet.visible = show && this.comet.userData && this.comet.userData.active !== false;
    }
  }

  setShowNames(show) {
    this.showNames = show;
  }

  setGlobalScale(scale) {
    this.globalScale = scale;
    if (this.solarSystem) {
      this.solarSystem.scale.set(scale, scale, scale);
    }
  }

  // 开场动画：加载完成后相机从远处缓缓推近，增强仪式感
  playIntro() {
    if (this.introPlaying) return;
    this.introPlaying = true;

    const startPos = new THREE.Vector3(0, 900, 2600);
    const endPos = new THREE.Vector3(0, 300, 800);
    const startTime = Date.now();
    const duration = 2600;

    this.camera.position.copy(startPos);

    const step = () => {
      const p = Math.min((Date.now() - startTime) / duration, 1);
      const ease = 1 - Math.pow(1 - p, 3);
      this.camera.position.lerpVectors(startPos, endPos, ease);
      this.controls.target.set(0, 0, 0);
      if (p < 1) {
        requestAnimationFrame(step);
      } else {
        this.introPlaying = false;
        this.cameraAnimating = false;
      }
    };
    step();
  }

  resetView() {
    this.camera.position.set(0, 300, 800);
    this.controls.reset();
    this.currentTargetPlanet = null;
  }

  cancelTracking() {
    this.currentTargetPlanet = null;
  }

  // 按名称飞行聚焦天体（供导航面板调用），返回对应的信息对象
  focusByName(name) {
    if (name === '月球') {
      const earth = this.planetMeshes.find(p => p.hasMoon);
      if (earth && earth.moon && this.onMoonClick) {
        const moonTarget = {
          name: '月球',
          mesh: earth.moon,
          radius: earth.moon.geometry.parameters.radius,
          isMoon: true,
          parentPlanet: earth
        };
        this.currentTargetPlanet = moonTarget;
        this.moveCameraToPlanet(moonTarget);
        this.onMoonClick();
      }
      return;
    }
    if (name === '太阳') {
      const sunTarget = { name: '太阳', mesh: this.sun, radius: 35 };
      this.currentTargetPlanet = sunTarget;
      this.moveCameraToPlanet(sunTarget);
      if (this.onSunClick) this.onSunClick();
      return;
    }
    const planet = this.planetMeshes.find(p => p.name === name);
    if (planet) {
      this.currentTargetPlanet = planet;
      this.moveCameraToPlanet(planet);
      if (this.onPlanetClick) this.onPlanetClick(planet);
    }
  }

  getPlanetScreenPositions() {
    const positions = {};
    
    this.planetMeshes.forEach(planet => {
      const vector = new THREE.Vector3();
      vector.setFromMatrixPosition(planet.mesh.matrixWorld);
      vector.project(this.camera);
      
      const x = (vector.x * 0.5 + 0.5) * window.innerWidth;
      const y = (-vector.y * 0.5 + 0.5) * window.innerHeight;
      
      positions[planet.name] = { x, y, visible: this.showNames, color: planet.colorHex || '#ffffff' };
    });
    
    if (this.sun) {
      const vector = new THREE.Vector3();
      vector.setFromMatrixPosition(this.sun.matrixWorld);
      vector.project(this.camera);
      
      const x = (vector.x * 0.5 + 0.5) * window.innerWidth;
      const y = (-vector.y * 0.5 + 0.5) * window.innerHeight;
      
      positions['太阳'] = { x, y, visible: this.showNames, color: '#ffb347' };
    }
    
    return positions;
  }

  // ==================== 探索模式（企业号） ====================
  setExploreMode(on) {
    if (on === this.exploreMode) return;
    this.exploreMode = on;
    if (on) this.enterExplore(); else this.exitExplore();
  }

  enterExplore() {
    if (!this.enterprise) return;
    // 保存当前相机状态以便退出时还原
    this.savedCameraState = {
      pos: this.camera.position.clone(),
      target: this.controls.target.clone()
    };
    // 暂停轨道追踪，避免与飞船视角冲突
    this.currentTargetPlanet = null;

    // 飞船出现在当前相机前方一段距离，朝向相机看的方向；
    // 若落点距太阳过近则沿视线再外推，避免贴脸太阳导致全黑
    const dir = new THREE.Vector3();
    this.camera.getWorldDirection(dir);
    let spawn = this.camera.position.clone().addScaledVector(dir, 150);
    if (spawn.length() < 250) spawn.addScaledVector(dir, 300);
    this.enterprise.position.copy(spawn);
    this.enterprise.lookAt(spawn.clone().add(dir));
    this.enterprise.visible = true;
    this.applyViewVisibility();
    // 从初始朝向提取偏航角（俯仰/横滚丢弃，进入"四平八稳"模式）
    const initEuler = new THREE.Euler().setFromQuaternion(this.enterprise.quaternion, 'YXZ');
    this.shipYaw = initEuler.y;
    this.exploreVelocity.set(0, 0, 0);
    this.exploreRollVel = 0;
    this.joyInput = { x: 0, y: 0 };
    // 姿态角速度（俯仰/偏航也走平滑，避免"一点就翻"的突兀感）
    this.explorePitchVel = 0;
    this.exploreYawVel = 0;
    this.shipYaw = 0; // 汽车式姿态：唯一姿态自由度（偏航角）
    // 自动驾驶：null=关闭，'free'=自由巡航，或目标天体名称
    this.autopilot = null;
    this.autopilotArrived = false;
    this._apViewOffset = null;
    this.onAutopilotChange = null;
    this.exploreSpeedMul = 1;

    // 键盘监听
    const down = (e) => {
      const SHIP_KEYS = ['Space', 'KeyW', 'KeyS', 'KeyA', 'KeyD', 'KeyQ', 'KeyE', 'KeyR', 'KeyF', 'KeyV', 'KeyG',
        'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'ShiftLeft', 'ShiftRight'];
      if (SHIP_KEYS.includes(e.code)) {
        this.exploreKeys.add(e.code);
        if (['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.code)) e.preventDefault();
        if (e.code === 'KeyV') this.toggleShipView();
        if (e.code === 'KeyG') this.toggleDataScreen();
      }
    };
    const up = (e) => {
      this.exploreKeys.delete(e.code);
      if (e.code === 'KeyR') {
        this.exploreVelocity.set(0, 0, 0);
        this.exploreRollVel = 0;
    this.joyInput = { x: 0, y: 0 };
    // 姿态角速度（俯仰/偏航也走平滑，避免"一点就翻"的突兀感）
    this.explorePitchVel = 0;
    this.exploreYawVel = 0;
    this.shipYaw = 0; // 汽车式姿态：唯一姿态自由度（偏航角）
    // 自动驾驶：null=关闭，'free'=自由巡航，或目标天体名称
    this.autopilot = null;
    this.autopilotArrived = false;
    this._apViewOffset = null;
    this.onAutopilotChange = null;
      }
    };
    window.addEventListener('keydown', down);
    window.addEventListener('keyup', up);
    this._exploreKeydown = down;
    this._exploreKeyup = up;

    if (this.onExploreModeChange) this.onExploreModeChange(true, this.exploreView);
  }

  exitExplore() {
    window.removeEventListener('keydown', this._exploreKeydown);
    window.removeEventListener('keyup', this._exploreKeyup);
    this._exploreKeydown = this._exploreKeyup = null;
    this.exploreKeys.clear();
    if (this.enterprise) {
      this.enterprise.visible = false;
      this.enterprise.userData.bridgeInterior.visible = false;
      if (this.enterprise.userData.hullParts) {
        this.enterprise.userData.hullParts.forEach(m => { m.visible = true; });
      }
    }
    // 还原相机
    if (this.savedCameraState) {
      this.camera.position.copy(this.savedCameraState.pos);
      this.controls.target.copy(this.savedCameraState.target);
    }
    this.controls.enabled = true;
    if (this.onExploreModeChange) this.onExploreModeChange(false, this.exploreView);
  }

  // 虚拟摇杆输入：x 左右（偏航），y 上下（前进/后退）
  setJoystickInput(x, y) {
    this.joyInput.x = x;
    this.joyInput.y = y;
  }

  toggleDataScreen() {
    this.showDataScreen = !this.showDataScreen;
    if (this.onDataScreenChange) this.onDataScreenChange(this.showDataScreen);
  }
  setShowDataScreen(v) {
    this.showDataScreen = !!v;
    if (this.onDataScreenChange) this.onDataScreenChange(this.showDataScreen);
  }

  toggleShipView() {
    this.exploreView = this.exploreView === 'third' ? 'first' : 'third';
    this.applyViewVisibility();
    if (this.onExploreModeChange) this.onExploreModeChange(this.exploreMode, this.exploreView);
  }

  // 第一视角：隐藏外壳，只显示舰桥内舱；第三视角反之
  applyViewVisibility() {
    const ship = this.enterprise;
    if (!ship || !ship.userData.bridgeInterior) return;
    const first = this.exploreView === 'first';
    if (ship.userData.hullParts) {
      ship.userData.hullParts.forEach(m => { m.visible = !first; });
    }
    const bi = ship.userData.bridgeInterior;
    bi.visible = first;
    if (!first) return;
    // 第一视角：只保留半圆控制台数据屏，其余舱内结构（地板/舱壁柱子/玻璃/全息台/座椅/侧屏/顶部）全隐藏
    const keep = new Set(bi.userData.dashParts || []);
    bi.children.forEach(ch => { ch.visible = keep.has(ch); });
  }

  // ==================== 自动驾驶 ====================
  // target: null=关闭 | 'free'=自由巡航 | 天体名称
  setAutopilot(target) {
    this.autopilot = target;
    this.autopilotArrived = false;
    this._apViewOffset = null;
    if (target && target !== 'free') {
      // 设定目标后先解除已抵达状态
      const p = this.planetMeshes.find(pl => pl.name === target);
      if (!p && target !== '太阳' && target !== '月球') {
        console.warn('[solar] 未知自动驾驶目标:', target);
        this.autopilot = null;
      }
    }
  }

  // 获取自动驾驶目标的世界坐标与安全距离
  getAutopilotTarget() {
    if (!this.autopilot || this.autopilot === 'free') return null;
    if (this.autopilot === '太阳') {
      const pos = this.sun.position.clone ? this.sun.position.clone() : new THREE.Vector3();
      return { pos, name: '太阳', radius: 35, safe: 180 };
    }
    if (this.autopilot === '月球') {
      const earth = this.planetMeshes.find(p => p.hasMoon);
      if (earth && earth.moon) {
        const wp = new THREE.Vector3();
        earth.moon.getWorldPosition(wp);
        return { pos: wp, name: '月球', radius: earth.radius * 0.27, safe: 40 };
      }
      return null;
    }
    const p = this.planetMeshes.find(pl => pl.name === this.autopilot);
    if (!p) return null;
    const wp = new THREE.Vector3();
    p.mesh.getWorldPosition(wp);
    const radius = p.radius || 8;
    return { pos: wp, name: p.name, radius, safe: Math.max(radius * 5, 30) };
  }

  updateAutopilot(dt) {
    const ship = this.enterprise;
    const tgt = this.getAutopilotTarget();
    if (!tgt) {
      // 自由巡航：无目标，仅维持当前航向匀速前进（推进 60%）
      const fwd = new THREE.Vector3(0, 0, -1).applyQuaternion(ship.quaternion);
      const cruise = 55;
      this.exploreVelocity.lerp(fwd.clone().multiplyScalar(cruise), Math.min(dt * 0.8, 1));
      return { thrusting: true, speedRatio: 0.5, warp: false };
    }

    const toTgt = tgt.pos.clone().sub(ship.position);
    const dist = toTgt.length();
    const dir = dist > 1e-6 ? toTgt.normalize() : new THREE.Vector3(0, 0, -1).applyQuaternion(ship.quaternion);

    // 朝向：仅取目标的水平方位角（汽车式驾驶不俯仰），舰体全程保持水平
    const dirFlat = dir.clone(); dirFlat.y = 0;
    let apYawIn = 0;
    if (dirFlat.lengthSq() > 1e-8) {
      dirFlat.normalize();
      const targetYaw = Math.atan2(-dirFlat.x, -dirFlat.z);
      let dyaw = targetYaw - this.shipYaw;
      while (dyaw > Math.PI) dyaw -= Math.PI * 2;
      while (dyaw < -Math.PI) dyaw += Math.PI * 2;
      apYawIn = THREE.MathUtils.clamp(dyaw * 1.6, -1, 1);
    }

    // ===== 最佳观赏点悬停 + 跟随星球 =====
    // 到达观赏距离后，锁定一个相对星球的观赏偏移，此后每帧追随
    // 「星球实时位置 + 固定偏移」，星球快速移动时飞船自动同步调整，
    // 始终保持在星球外围最佳观赏点，绝不穿过星球（观赏距离远超星球半径）。
    if (dist <= tgt.safe) {
      this.autopilotArrived = true;
      if (!this._apViewOffset) {
        // 首次到达：以当前水平方向 + 略抬升俯角，锁定稳定观赏偏移
        const o = dirFlat.clone();
        if (o.lengthSq() < 1e-6) o.set(0, 0, -1);
        o.normalize();
        this._apViewOffset = o.multiplyScalar(-tgt.safe);
      }
      // 目标观赏位置 = 星球实时位置 + 偏移（星球移动 → 观赏位同步移动）
      const desiredPos = tgt.pos.clone().add(this._apViewOffset);
      const toDesired = desiredPos.clone().sub(ship.position);
      // 追随速度足够快，确保快速移动的星球不会甩开飞船；位移由 updateShip 每帧应用
      this.exploreVelocity.copy(toDesired).multiplyScalar(5.0);
      if (this.exploreVelocity.length() > 160) this.exploreVelocity.setLength(160);
      return { thrusting: false, speedRatio: 0.04, warp: false, arrived: true, apYawIn };
    }
    this.autopilotArrived = false;
    this._apViewOffset = null; // 尚未到达，清除偏移，重新计算
    const far = 900;
    const desiredSpeed = THREE.MathUtils.clamp((dist - tgt.safe) / far, 0.12, 1) * 320;
    const desiredVel = dirFlat.clone().multiplyScalar(desiredSpeed);
    // 高度差：垂直速度分量平滑趋近（舰体不抬头，像电梯一样升降）
    const dy = tgt.pos.y - ship.position.y;
    desiredVel.y = THREE.MathUtils.clamp(dy * 0.6, -80, 80);
    this.exploreVelocity.lerp(desiredVel, Math.min(dt * 1.5, 1));
    return { thrusting: true, speedRatio: desiredSpeed / 320, warp: desiredSpeed > 250, apYawIn };
  }

  updateShip(dt) {
    const ship = this.enterprise;
    const k = this.exploreKeys;

    // ---- 自动驾驶接管：设定目标后接管航向与推进，手动输入（W/S 等）自动解除 ----
    let apState = null;
    if (this.autopilot) {
      const manualOverride = k.has('KeyW') || k.has('KeyS') || k.has('KeyA') || k.has('KeyD') ||
        k.has('Space') || k.has('KeyF') || k.has('ArrowUp') || k.has('ArrowDown') ||
        k.has('ArrowLeft') || k.has('ArrowRight') || k.has('KeyQ') || k.has('KeyE') ||
        Math.abs(this.joyInput.x) > 0.3 || Math.abs(this.joyInput.y) > 0.3;
      if (manualOverride) {
        this.autopilot = null; // 人工接管，退出自动驾驶
        if (this.onAutopilotChange) this.onAutopilotChange(null, false);
      } else {
        apState = this.updateAutopilot(dt);
      }
    }
    // 基础速度：每帧位移基准，乘 dt 平滑
    const baseSpeed = 60; // 单位/秒（常规巡航）
    const accel = 140;

    // 飞船本地坐标轴
    const fwd = new THREE.Vector3(0, 0, -1).applyQuaternion(ship.quaternion);
    const right = new THREE.Vector3(1, 0, 0).applyQuaternion(ship.quaternion);
    const up = new THREE.Vector3(0, 1, 0).applyQuaternion(ship.quaternion);

    // 加速（Shift）：曲速状态（自动驾驶时由 apState.warp 决定）
    const boosting = apState ? apState.warp : (k.has('ShiftLeft') || k.has('ShiftRight'));
    this.exploreSpeedMul = THREE.MathUtils.lerp(this.exploreSpeedMul, boosting ? 6 : 1, Math.min(dt * 4, 1));

    // 推力（汽车式布局：W/S 油门刹车，Q/E 平移，Space/F 与方向键上下为升降；
    // A/D 与左右方向键专职转向，见下方姿态段）
    const thrust = new THREE.Vector3();
    if (k.has('KeyW')) thrust.add(fwd);
    if (k.has('KeyS')) thrust.sub(fwd);
    if (k.has('KeyQ')) thrust.sub(right);
    if (k.has('KeyE')) thrust.add(right);
    if (k.has('Space') || k.has('ArrowUp')) thrust.add(up);
    if (k.has('KeyF') || k.has('ArrowDown')) thrust.sub(up);

    // 虚拟摇杆纵向分量：y>0 前进、y<0 后退（带 0.15 死区）
    const joyFwd = Math.abs(this.joyInput.y) > 0.15 ? this.joyInput.y : 0;
    if (joyFwd !== 0) thrust.addScaledVector(fwd, joyFwd);

    const maxV = baseSpeed * 8 * this.exploreSpeedMul;
    if (apState) {
      // 自动驾驶管理速度；引擎辉光用其速度比例
      ship.position.addScaledVector(this.exploreVelocity, dt);
    } else {
      if (thrust.lengthSq() > 0) {
        thrust.normalize().multiplyScalar(accel * this.exploreSpeedMul);
        this.exploreVelocity.addScaledVector(thrust, dt);
      }
      // 惯性阻尼（模拟姿态稳定器）
      this.exploreVelocity.multiplyScalar(Math.pow(0.9, dt * 60 * 0.16));

      // 限速
      if (this.exploreVelocity.length() > maxV) this.exploreVelocity.setLength(maxV);

      ship.position.addScaledVector(this.exploreVelocity, dt);
    }

    // ---- 汽车式水平姿态（四平八稳）----
    // 姿态只由偏航角 shipYaw 驱动：舰体永远保持水平（俯仰恒为 0），
    // 转向时带轻微协调横滚（≤10°），任何输入都无法让飞船上下翻转。
    // A/D 与左右方向键 = 方向盘；摇杆横向同理。
    let yawIn;
    if (apState && apState.apYawIn !== undefined) {
      yawIn = apState.apYawIn; // 自动驾驶输出的转向量
    } else {
      yawIn = ((k.has('ArrowLeft') || k.has('KeyA')) ? 1 : 0)
            - ((k.has('ArrowRight') || k.has('KeyD')) ? 1 : 0);
      // 摇杆右推（x>0）= 右转（yawIn 负方向）
      const joyYaw = Math.abs(this.joyInput.x) > 0.15 ? this.joyInput.x : 0;
      yawIn -= joyYaw;
    }
    yawIn = THREE.MathUtils.clamp(yawIn, -1, 1);

    const ROT_SENS = 0.9, SMOOTH = 5;
    this.exploreYawVel = THREE.MathUtils.lerp(this.exploreYawVel, yawIn * ROT_SENS, Math.min(dt * SMOOTH, 1));
    this.shipYaw += this.exploreYawVel * dt;

    // 协调横滚：转向时向内轻微压坡，松手自动归零
    const coordRoll = THREE.MathUtils.clamp(-this.exploreYawVel * 0.22, -0.18, 0.18);
    const levelQuat = new THREE.Quaternion().setFromEuler(new THREE.Euler(0, this.shipYaw, coordRoll, 'YXZ'));
    ship.quaternion.slerp(levelQuat, Math.min(dt * 6, 1));

    // 引擎发光随速度增强
    const glow = Math.min(this.exploreVelocity.length() / maxV, 1);
    if (ship.userData.warpGlowMat) ship.userData.warpGlowMat.emissiveIntensity = 2.4 + glow * 5;
    if (ship.userData.bussardMat) ship.userData.bussardMat.emissiveIntensity = 2.2 + glow * 3;

    // ---- 相机跟随 ----
    if (this.exploreView === 'third') {
      // 第三视角：舰尾后上方，随飞船姿态旋转
      const offset = ship.userData.chaseOffset.clone().applyQuaternion(ship.quaternion);
      const targetPos = ship.position.clone().add(offset);
      this.camera.position.lerp(targetPos, Math.min(dt * 5, 1));
      this.controls.target.copy(ship.position);
      this.controls.enabled = false;
      this.camera.lookAt(ship.position);
    } else {
      // 第一视角：舰桥内部朝舰首
      const cockpitLocal = ship.userData.cockpit;
      const camPos = cockpitLocal.clone().applyQuaternion(ship.quaternion).add(ship.position);
      this.camera.position.copy(camPos);
      const lookAt = ship.position.clone().add(fwd.clone().multiplyScalar(120));
      this.camera.lookAt(lookAt);
      this.controls.enabled = false;
    }

    // 航行灯闪烁：左红右绿慢闪，碟顶白色频闪（1.2s 周期双脉冲）
    const ud = ship.userData;
    if (ud.navLights) {
      const t = (performance.now() / 1000) % 1.2;
      const slow = (t < 0.6) ? 1 : 0.25;
      ud.navLights.red.visible = slow > 0.5;
      ud.navLights.green.visible = slow > 0.5;
      const strobe = (t < 0.07 || (t > 0.14 && t < 0.21)) ? true : false;
      ud.navLights.white.visible = strobe;
    }
    // 引擎尾焰：随速度伸缩与增亮（怠速微光，曲速拉长）
    if (ud.exhausts) {
      const spd = this.exploreVelocity.length();
      const ratio = THREE.MathUtils.clamp(spd / 420, 0, 1);
      ud.exhausts.forEach((sp, i) => {
        const base = [3.2, 2.2, 2.2][i];
        sp.scale.set(base * (0.5 + ratio * 1.4), base * (0.5 + ratio * 1.4), 1);
        sp.material.opacity = 0.35 + ratio * 0.6;
      });
    }

    // 舰桥内全息星图：行星自转 + 环带缓转（仅第一视角可见时驱动）
    const bi = ud.bridgeInterior;
    if (bi && bi.visible && bi.userData.anim) {
      const a = bi.userData.anim;
      const tt = performance.now() / 1000;
      a.holoPlanet.rotation.y = tt * 0.6;
      a.holoRing1.rotation.z = tt * 0.4;
      a.holoRing2.rotation.z = -tt * 0.25;
      // 全息球轻微浮动，模拟投影悬浮感（以初始高度为基准，不累积）
      if (a.baseY === undefined) a.baseY = a.holoPlanet.position.y;
      a.holoPlanet.position.y = a.baseY + Math.sin(tt * 1.5) * 0.03;
      a.holoRing1.position.y = a.holoPlanet.position.y;
      a.holoRing2.position.y = a.holoPlanet.position.y;
    }

    // 暴露飞行状态（供音效系统读取）；自动驾驶时用其状态
    // 仪表盘显隐：第一视角按 G 键/面板按钮隐藏（观赏星球时避免遮挡）
    if (bi && bi.visible && bi.userData.dashParts) {
      bi.userData.dashParts.forEach(m => { m.visible = this.showDataScreen; });
    }
    // 舰桥中央航行数据屏：每帧刷新 目的地 / 坐标 / 距离 / 时速
    if (bi && bi.visible && bi.userData.dataScreen && this.showDataScreen) {
      const tgt = this.getAutopilotTarget();
      const dist = tgt ? ship.position.distanceTo(tgt.pos) : null;
      renderDataScreen(bi.userData.dataScreen, {
        dest: (this.autopilot && this.autopilot !== 'free') ? this.autopilot : '自由巡航',
        coord: ship.position,
        dist,
        speed: this.exploreVelocity.length(),
      });
    }

    // 3D 悬浮全息控制台动画（扫描仪随飞船运行转动：速度越快转得越快）
    if (bi && bi.visible && bi.userData.holoAnim) {
      const h = bi.userData.holoAnim;
      const tt = performance.now() / 1000;
      const scanBoost = 1 + Math.min(this.exploreVelocity.length() / 160, 1) * 4;
      h.ringH.rotation.z += dt * 0.45 * scanBoost;
      h.ringTilt.rotation.z -= dt * 0.3 * scanBoost;
      h.ringV.rotation.y += dt * 0.5 * scanBoost;
      h.ringV.rotation.x = 0.15 + Math.sin(tt * 0.5) * 0.1;
      h.holoParticles.rotation.y += dt * 0.12 * scanBoost;
    }

    this.shipState = apState ? {
      thrusting: apState.thrusting,
      speedRatio: apState.speedRatio,
      warp: apState.warp
    } : {
      thrusting: thrust.lengthSq() > 0 || joyFwd !== 0,
      speedRatio: glow,
      warp: boosting
    };
  }

  dispose() {
    if (this.animationId) {
      cancelAnimationFrame(this.animationId);
    }
    
    if (this.renderer) {
      this.renderer.dispose();
      this.container.removeChild(this.renderer.domElement);
    }
    
    this.scene.traverse((object) => {
      if (object.geometry) {
        object.geometry.dispose();
      }
      if (object.material) {
        if (Array.isArray(object.material)) {
          object.material.forEach(material => material.dispose());
        } else {
          object.material.dispose();
        }
      }
    });
  }
}
