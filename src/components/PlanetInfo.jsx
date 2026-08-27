import React from 'react';

// 两列紧凑网格布局：一屏内完整展示全部科研数据
const FIELD_LABELS = [
  ['realDiameter', '直径'],
  ['realDistance', '日距'],
  ['orbitPeriod', '公转周期'],
  ['rotationPeriod', '自转周期'],
  ['temperature', '表面温度'],
  ['moons', '卫星数量'],
  ['mass', '质量'],
  ['gravity', '表面重力'],
  ['density', '平均密度'],
  ['escapeVelocity', '逃逸速度'],
  ['atmosphere', '大气成分'],
];

export function PlanetInfo({ celestial, onClose, onCancelTracking }) {
  if (!celestial) return null;

  return (
    <div className="planet-info visible">
      <div
        className="planet-info-header"
        style={{ background: `linear-gradient(135deg, ${celestial.color || '#444'} 0%, rgba(20,22,40,0.9) 75%)` }}
      >
        <div className="planet-info-title">
          <span className="planet-info-name">{celestial.name}</span>
          {celestial.type && <span className="planet-info-type">{celestial.type}</span>}
        </div>
      </div>

      {celestial.fact && (
        <p className="planet-info-fact">
          <span className="fact-label">趣闻</span>
          {celestial.fact}
        </p>
      )}

      <div className="info-grid">
        {FIELD_LABELS.map(([key, label]) => (
          <div className="info-row" key={key}>
            <span className="info-label">{label}</span>
            <span className="info-value">{celestial[key] || '-'}</span>
          </div>
        ))}
      </div>

      <div className="button-container">
        <button className="close-info-btn" onClick={onClose}>关闭信息</button>
        <button className="cancel-tracking-btn" onClick={onCancelTracking}>取消追踪</button>
      </div>
    </div>
  );
}
