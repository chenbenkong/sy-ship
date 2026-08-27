import React from 'react';

export function Header({ zoomLevel, speedLevel, isPaused, simDate }) {
  const simDateText = simDate
    ? `模拟时间 ${simDate.getFullYear()}年${simDate.getMonth() + 1}月${simDate.getDate()}日`
    : '模拟时间 —';
  return (
    <header className="app-header">
      <div className="app-title">
        <span className="app-title-main">太阳系</span>
        <span className="app-title-sub">3D · SOLAR SYSTEM</span>
      </div>
      <div className="app-stats">
        <div className="stat-chip">
          <span className="stat-dot" />
          {isPaused ? '已暂停' : '运行中'}
        </div>
        <div className="stat-chip sim-date-chip">{simDateText}</div>
        <div className="stat-chip">速度 {typeof speedLevel === 'number' ? speedLevel.toFixed(1) : '1.0'}×</div>
        <div className="stat-chip">缩放 {typeof zoomLevel === 'number' ? zoomLevel.toFixed(2) : '1.00'}×</div>
      </div>
    </header>
  );
}
