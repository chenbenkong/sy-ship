import React, { useEffect, useRef, useState, useCallback, Component } from 'react';
import { SolarSystemScene } from './three/SolarSystemScene';
import { ControlPanel } from './components/ControlPanel';
import { PlanetInfo } from './components/PlanetInfo';
import { StatusDisplay } from './components/StatusDisplay';
import { PlanetLabels } from './components/PlanetLabels';
import { Header } from './components/Header';
import { LoadingScreen } from './components/LoadingScreen';
import { PlanetNav } from './components/PlanetNav';
import { Joystick } from './components/Joystick';
import { ShipSound } from './audio/shipSound';
import { sunInfo, moonInfo } from './data/planetData';
import './styles/index.css';

// 错误边界：捕获子组件渲染期异常，避免整页空白（黑屏）且无提示
class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { error: null };
  }
  static getDerivedStateFromError(error) {
    return { error };
  }
  componentDidCatch(error, info) {
    console.error('[solar] 组件渲染异常：', error, info);
  }
  render() {
    if (this.state.error) {
      return (
        <div className="fatal-error">
          <h2>页面出错了</h2>
          <pre>{String(this.state.error && this.state.error.stack || this.state.error)}</pre>
          <p>请把上面这段报错发给我，我来修。</p>
        </div>
      );
    }
    return this.props.children;
  }
}

export default function App() {
  const containerRef = useRef(null);
  const sceneRef = useRef(null);
  const audioRef = useRef(null);
  const shipSoundRef = useRef(null);
  const hudTimerRef = useRef(null);

  const [isPaused, setIsPaused] = useState(false);
  const [timeSpeed, setTimeSpeed] = useState(1);
  const [showOrbits, setShowOrbits] = useState(true);
  const [showStars, setShowStars] = useState(true);
  const [showNames, setShowNames] = useState(true);
  const [globalScale, setGlobalScale] = useState(1.0);
  const [selectedCelestial, setSelectedCelestial] = useState(null);
  const [planetPositions, setPlanetPositions] = useState(null);
  const [isMusicPlaying, setIsMusicPlaying] = useState(false);
  const [bloom, setBloom] = useState(true);
  const [loaded, setLoaded] = useState(false);
  const [simDate, setSimDate] = useState(null);
  const [loadProgress, setLoadProgress] = useState(0);
  const [uiHidden, setUiHidden] = useState(false);
  const [fatalError, setFatalError] = useState(null);
  const [exploreMode, setExploreMode] = useState(false);
  const [shipView, setShipView] = useState('third');
  const [hudVisible, setHudVisible] = useState(true);
  const [autopilotTarget, setAutopilotTarget] = useState('off');
  const [showDash, setShowDash] = useState(true);

  // 全局捕获未被 React 边界兜住的运行时错误，直接显示在页面上
  useEffect(() => {
    const onError = (e) => setFatalError((prev) => prev || (e.error ? (e.error.stack || e.error.message) : e.message));
    const onReject = (e) => setFatalError((prev) => prev || (e.reason ? (e.reason.stack || e.reason.message || String(e.reason)) : '未知异步错误'));
    window.addEventListener('error', onError);
    window.addEventListener('unhandledrejection', onReject);
    return () => {
      window.removeEventListener('error', onError);
      window.removeEventListener('unhandledrejection', onReject);
    };
  }, []);

  useEffect(() => {
    if (!containerRef.current) return;

    const scene = new SolarSystemScene(containerRef.current);
    scene.init();
    sceneRef.current = scene;
    scene.onLoaded = () => setLoaded(true);
    scene.onProgress = (p) => setLoadProgress(Math.round(p * 100));
    scene.onAutopilotChange = (target) => {
      setAutopilotTarget(target === null ? 'off' : (target || 'off'));
    };
    scene.onDataScreenChange = (v) => setShowDash(v);
    scene.onExploreModeChange = (on, view) => {
      setExploreMode(on);
      setShipView(view);
      // 探索期间收起行星信息卡，避免遮挡视野
      if (on) setSelectedCelestial(null);
    };

    scene.onPlanetClick = (planet) => {
      // 直接透传完整数据对象（含 mass/gravity/density/escapeVelocity 等科研字段），
      // 颜色字段名映射为信息卡头部使用的 color
      setSelectedCelestial({ ...planet, color: planet.colorHex });
    };

    scene.onSunClick = () => {
      setSelectedCelestial(sunInfo);
    };

    scene.onMoonClick = () => {
      setSelectedCelestial(moonInfo);
    };

    return () => {
      if (sceneRef.current) {
        sceneRef.current.dispose();
      }
      if (shipSoundRef.current) {
        try { shipSoundRef.current.stop(); } catch (_) {}
      }
    };
  }, []);

  useEffect(() => {
    if (!sceneRef.current) return;

    const intervalId = setInterval(() => {
      if (sceneRef.current) {
        const positions = sceneRef.current.getPlanetScreenPositions();
        setPlanetPositions(positions);
        if (sceneRef.current.simDate) {
          setSimDate(sceneRef.current.simDate);
        }
        // 将飞船状态同步给音效系统
        if (shipSoundRef.current && sceneRef.current.shipState) {
          shipSoundRef.current.setState(sceneRef.current.shipState);
        }
      }
    }, 100);

    return () => clearInterval(intervalId);
  }, []);

  // 兜底：即便个别贴图加载异常，也在 6 秒后强制关闭加载页
  useEffect(() => {
    const t = setTimeout(() => setLoaded(true), 6000);
    return () => clearTimeout(t);
  }, []);

  const handleTogglePause = useCallback(() => {
    setIsPaused(prev => {
      const newValue = !prev;
      if (sceneRef.current) {
        sceneRef.current.setPaused(newValue);
      }
      return newValue;
    });
  }, []);

  const handleSpeedChange = useCallback((speed) => {
    setTimeSpeed(speed);
    if (sceneRef.current) {
      sceneRef.current.setTimeSpeed(speed);
    }
  }, []);

  const handleZoomChange = useCallback((scale) => {
    setGlobalScale(scale);
    if (sceneRef.current) {
      sceneRef.current.setGlobalScale(scale);
    }
  }, []);

  const handleToggleOrbits = useCallback(() => {
    setShowOrbits(prev => {
      const newValue = !prev;
      if (sceneRef.current) {
        sceneRef.current.setShowOrbits(newValue);
      }
      return newValue;
    });
  }, []);

  const handleToggleStars = useCallback(() => {
    setShowStars(prev => {
      const newValue = !prev;
      if (sceneRef.current) {
        sceneRef.current.setShowStars(newValue);
      }
      return newValue;
    });
  }, []);

  const handleToggleNames = useCallback(() => {
    setShowNames(prev => {
      const newValue = !prev;
      if (sceneRef.current) {
        sceneRef.current.setShowNames(newValue);
      }
      return newValue;
    });
  }, []);

  const handleToggleBloom = useCallback(() => {
    setBloom(prev => {
      const newValue = !prev;
      if (sceneRef.current) {
        sceneRef.current.setBloom(newValue);
      }
      return newValue;
    });
  }, []);

  const handleResetView = useCallback(() => {
    if (sceneRef.current) {
      sceneRef.current.resetView();
    }
    setSelectedCelestial(null);
  }, []);

  const handleCloseInfo = useCallback(() => {
    setSelectedCelestial(null);
  }, []);

  const handleCancelTracking = useCallback(() => {
    setSelectedCelestial(null);
    if (sceneRef.current) {
      sceneRef.current.cancelTracking();
    }
  }, []);

  const handleNavSelect = useCallback((name) => {
    if (sceneRef.current) {
      sceneRef.current.focusByName(name);
    }
  }, []);

  const handleToggleExplore = useCallback(() => {
    if (!sceneRef.current) return;
    const turningOn = !sceneRef.current.exploreMode;
    sceneRef.current.setExploreMode(turningOn);
    // 音效
    if (turningOn) {
      if (!shipSoundRef.current) shipSoundRef.current = new ShipSound();
      shipSoundRef.current.start();
    } else if (shipSoundRef.current) {
      shipSoundRef.current.stop();
    }
  }, []);

  // HUD 短暂显示 4 秒后自动淡出
  useEffect(() => {
    if (exploreMode) {
      setHudVisible(true);
      if (hudTimerRef.current) clearTimeout(hudTimerRef.current);
      hudTimerRef.current = setTimeout(() => setHudVisible(false), 4000);
    } else {
      setHudVisible(false);
    }
    return () => {
      if (hudTimerRef.current) clearTimeout(hudTimerRef.current);
    };
  }, [exploreMode]);

  const handleAutopilotChange = useCallback((e) => {
    const v = e.target.value;
    setAutopilotTarget(v);
    if (sceneRef.current) {
      sceneRef.current.setAutopilot(v === 'off' ? null : v);
    }
  }, []);

  const handleToggleDash = useCallback(() => {
    if (sceneRef.current) sceneRef.current.toggleDataScreen();
  }, []);

  const handleToggleShipView = useCallback(() => {
    if (sceneRef.current) {
      sceneRef.current.toggleShipView();
    }
  }, []);

  const handleToggleMusic = useCallback(() => {
    if (!audioRef.current) {
      audioRef.current = new Audio('https://www.soundhelix.com/examples/mp3/SoundHelix-Song-1.mp3');
      audioRef.current.loop = true;
    }

    if (isMusicPlaying) {
      audioRef.current.pause();
      setIsMusicPlaying(false);
    } else {
      audioRef.current.play().catch(console.error);
      setIsMusicPlaying(true);
    }
  }, [isMusicPlaying]);

  useEffect(() => {
    const handleKeyDown = (event) => {
      if (event.code === 'KeyH') {
        event.preventDefault();
        setUiHidden(prev => !prev);
        return;
      }
      // 探索模式下这些按键由飞船占用
      if (sceneRef.current && sceneRef.current.exploreMode &&
          ['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(event.code)) {
        return;
      }
      if (event.code === 'Space') {
        event.preventDefault();
        handleTogglePause();
      } else if (event.code === 'ArrowUp') {
        event.preventDefault();
        const newSpeed = Math.min(timeSpeed + 0.5, 10);
        handleSpeedChange(newSpeed);
      } else if (event.code === 'ArrowDown') {
        event.preventDefault();
        const newSpeed = Math.max(timeSpeed - 0.5, 0.1);
        handleSpeedChange(newSpeed);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleTogglePause, handleSpeedChange, timeSpeed]);

  return (
    <ErrorBoundary>
      {fatalError && (
        <div className="fatal-error">
          <h2>页面运行时出错</h2>
          <pre>{String(fatalError)}</pre>
          <p>请把上面这段报错发给我，我来定位修复。</p>
        </div>
      )}
      <div className="app">
      <LoadingScreen visible={!loaded} progress={loadProgress} />
      <div ref={containerRef} className="canvas-container" />

      {/* 观赏模式环形开关：隐藏所有设置，按钮保留并变淡；再点恢复 */}
      <button
        className={`obs-btn${uiHidden ? ' dim' : ''}`}
        title={uiHidden ? '恢复所有设置' : '隐藏所有设置，纯净观赏星空'}
        onClick={() => setUiHidden(prev => !prev)}
      >
        <svg className="obs-icon" viewBox="0 0 28 28" width="22" height="22" aria-hidden="true">
          <circle cx="14" cy="14" r="12" fill="none" stroke="currentColor" strokeWidth="1" opacity="0.9"/>
          <circle cx="14" cy="14" r="8.5" fill="none" stroke="currentColor" strokeWidth="1" opacity="0.8"/>
          <circle cx="14" cy="14" r="5" fill="none" stroke="currentColor" strokeWidth="1" opacity="0.7"/>
          <circle cx="14" cy="14" r="1.4" fill="currentColor"/>
          <circle cx="14" cy="2.6" r="0.9" fill="currentColor" opacity="0.85"/>
          <circle cx="22.4" cy="14" r="0.9" fill="currentColor" opacity="0.85"/>
        </svg>
      </button>

      <div className={uiHidden ? "ui-layer hidden" : "ui-layer"}>
      <Header zoomLevel={globalScale} speedLevel={timeSpeed} isPaused={isPaused} simDate={simDate} />

      <StatusDisplay
        zoomLevel={globalScale}
        speedLevel={timeSpeed}
      />

      <PlanetLabels positions={planetPositions} />

      <PlanetNav
        onSelect={handleNavSelect}
        currentName={selectedCelestial ? selectedCelestial.name : null}
      />

      <PlanetInfo
        celestial={selectedCelestial}
        onClose={handleCloseInfo}
        onCancelTracking={handleCancelTracking}
      />

      <ControlPanel
        isPaused={isPaused}
        timeSpeed={timeSpeed}
        showOrbits={showOrbits}
        showStars={showStars}
        showNames={showNames}
        showBloom={bloom}
        globalScale={globalScale}
        isMusicPlaying={isMusicPlaying}
        onTogglePause={handleTogglePause}
        onSpeedChange={handleSpeedChange}
        onZoomChange={handleZoomChange}
        onToggleOrbits={handleToggleOrbits}
        onToggleStars={handleToggleStars}
        onToggleNames={handleToggleNames}
        onToggleBloom={handleToggleBloom}
        onResetView={handleResetView}
        onToggleMusic={handleToggleMusic}
        exploreMode={exploreMode}
        shipView={shipView}
        onToggleExplore={handleToggleExplore}
        onToggleShipView={handleToggleShipView}
        showDash={showDash}
        onToggleDash={handleToggleDash}
      />

      {exploreMode && (
        <>
          <div className={`explore-hud${hudVisible ? '' : ' fade'}`}>
            <div className="explore-hud-title">企业号 · 探索模式</div>
            <div className="explore-hud-keys">
              <span>W/S 油门/倒车</span><span>A/D 或 ←→ 转向</span><span>↑↓/Space/F 升降</span>
              <span>Q/E 平移</span><span>Shift 曲速</span>
              <span>R 制动</span><span>V 视角</span><span>G 仪表盘</span>
            </div>
          </div>
          <Joystick
            onMove={(x, y) => {
              if (sceneRef.current) sceneRef.current.setJoystickInput(x, y);
            }}
          />
          {shipView === 'first' && (
            <button
              className={`dash-toggle-fab${showDash ? '' : ' off'}`}
              onClick={handleToggleDash}
              title="隐藏/显示前部控制台（快捷键 G）"
            >
              {showDash ? '收起控制台' : '展开控制台'}
            </button>
          )}
          <div className="autopilot-panel">
            <div className="autopilot-title">自动驾驶</div>
            <select className="autopilot-select" value={autopilotTarget} onChange={handleAutopilotChange}>
              <option value="off">关闭（手动驾驶）</option>
              <option value="free">自由巡航</option>
              <option value="太阳">飞往太阳</option>
              <option value="水星">飞往水星</option>
              <option value="金星">飞往金星</option>
              <option value="地球">飞往地球</option>
              <option value="月球">飞往月球</option>
              <option value="火星">飞往火星</option>
              <option value="木星">飞往木星</option>
              <option value="土星">飞往土星</option>
              <option value="天王星">飞往天王星</option>
              <option value="海王星">飞往海王星</option>
              <option value="冥王星">飞往冥王星</option>
            </select>
            <div className="autopilot-hint">
              {autopilotTarget === 'off' ? '手动驾驶中' :
                autopilotTarget === 'free' ? '巡航中 · 按任意驾驶键接管' :
                '航行中 · 按任意驾驶键接管'}
            </div>
          </div>
        </>
      )}

      <div className="hide-hint">{uiHidden ? '按 H 键显示界面' : '按 H 键隐藏界面'}</div>
      </div>
      </div>
    </ErrorBoundary>
  );
}
