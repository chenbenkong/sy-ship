import React from 'react';

export function ControlPanel({
  isPaused,
  timeSpeed,
  showOrbits,
  showStars,
  showNames,
  showBloom,
  globalScale,
  isMusicPlaying,
  onTogglePause,
  onSpeedChange,
  onZoomChange,
  onToggleOrbits,
  onToggleStars,
  onToggleNames,
  onToggleBloom,
  onResetView,
  onToggleMusic,
  exploreMode,
  shipView,
  onToggleExplore,
  onToggleShipView,
  showDash,
  onToggleDash
}) {
  return (
    <div className={`controls${shipView === 'first' ? ' first-person' : ''}`}>
      <div className="control-group">
        <div className="slider-row">
          <label htmlFor="speedControl">速度</label>
          <input
            type="range"
            id="speedControl"
            min="0"
            max="10"
            step="0.1"
            value={timeSpeed}
            onChange={(e) => onSpeedChange(parseFloat(e.target.value))}
          />
          <span className="slider-value">{timeSpeed.toFixed(1)}×</span>
        </div>
        <div className="slider-row">
          <label htmlFor="zoomControl">缩放</label>
          <input
            type="range"
            id="zoomControl"
            min="0.5"
            max="3.0"
            step="0.1"
            value={globalScale}
            onChange={(e) => onZoomChange(parseFloat(e.target.value))}
          />
          <span className="slider-value">{globalScale.toFixed(1)}×</span>
        </div>
      </div>

      <div className="control-group control-buttons">
        <button className={isPaused ? 'ctrl-btn active' : 'ctrl-btn'} onClick={onTogglePause}>
          {isPaused ? '▶ 播放' : '⏸ 暂停'}
        </button>
        <button className="ctrl-btn" onClick={onResetView}>⟲ 重置</button>
        <button
          className={exploreMode ? 'ctrl-btn explore-active' : 'ctrl-btn'}
          onClick={onToggleExplore}
          title="驾驶企业号星舰遨游太空"
        >
          {exploreMode ? '🚀 退出探索' : '🚀 探索'}
        </button>
      </div>

      <div className="control-group control-toggles">
        {exploreMode && (
          <button className="toggle-btn active" onClick={onToggleShipView}>
            {shipView === 'third' ? '◎ 第三视角' : '👁 第一视角'}
          </button>
        )}
        {exploreMode && shipView === 'first' && (
          <button
            className={showDash ? 'toggle-btn active' : 'toggle-btn'}
            onClick={onToggleDash}
            title="按 G 键也可切换"
          >
            {showDash ? '🖥 控制台·开' : '🖥 控制台·关'}
          </button>
        )}
        <button className={showOrbits ? 'toggle-btn active' : 'toggle-btn'} onClick={onToggleOrbits}>
          轨道
        </button>
        <button className={showStars ? 'toggle-btn active' : 'toggle-btn'} onClick={onToggleStars}>
          星空
        </button>
        <button className={showNames ? 'toggle-btn active' : 'toggle-btn'} onClick={onToggleNames}>
          名称
        </button>
        <button className={showBloom ? 'toggle-btn active' : 'toggle-btn'} onClick={onToggleBloom}>
          辉光
        </button>
        <button className={isMusicPlaying ? 'toggle-btn active' : 'toggle-btn'} onClick={onToggleMusic}>
          {isMusicPlaying ? '♪ 静音' : '♪ 音乐'}
        </button>
      </div>
    </div>
  );
}
