import React from 'react';

// 加载页：迷你太阳系轨道动画——中心太阳 + 各行星按真实相对周期比公转
// 周期按真实公转周期比例缩放（地球 365 天 → 6 秒/圈），保持科研气质
const LOADING_PLANETS = [
  { name: '水星', color: '#b8b0a8', size: 4, orbit: 26, period: 1.45 },
  { name: '金星', color: '#e6a85c', size: 6, orbit: 38, period: 3.69 },
  { name: '地球', color: '#3a86ff', size: 6.5, orbit: 52, period: 6 },
  { name: '火星', color: '#e2562f', size: 5, orbit: 66, period: 11.3 },
  { name: '木星', color: '#d8a56a', size: 11, orbit: 84, period: 71 },
  { name: '土星', color: '#e8c969', size: 9, orbit: 104, period: 176, ring: true },
  { name: '天王星', color: '#9fd8e8', size: 7.5, orbit: 121, period: 504 },
  { name: '海王星', color: '#4d6fe8', size: 7.5, orbit: 136, period: 989 },
];

export function LoadingScreen({ visible, progress = 0 }) {
  if (!visible) return null;

  return (
    <div className="loading-screen">
      <div className="loading-solar">
        {/* 中心太阳 */}
        <span className="loading-sun" />
        {/* 各行星：轨道 + 按周期旋转 */}
        {LOADING_PLANETS.map(p => (
          <div
            key={p.name}
            className="loading-orbit-ring"
            style={{ width: p.orbit * 2, height: p.orbit * 2 }}
          >
            <div
              className="loading-orbit-spin"
              style={{ animationDuration: `${p.period}s` }}
            >
              <span
                className={p.ring ? 'loading-planet has-ring' : 'loading-planet'}
                style={{
                  width: p.size,
                  height: p.size,
                  background: p.color,
                  left: `calc(50% + ${p.orbit}px)`
                }}
              />
            </div>
          </div>
        ))}
      </div>
      <div className="loading-title">太阳系 3D 模拟</div>
      <div className="loading-sub">正在点亮星辰…</div>
      <div className="loading-bar">
        <div className="loading-bar-fill" style={{ width: `${Math.min(progress, 100)}%` }} />
      </div>
    </div>
  );
}
