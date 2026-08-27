import React, { useState } from 'react';

// 星球速览导航：右侧玻璃拟态面板，可自由收起/展开，点击任意天体直接飞行聚焦
export function PlanetNav({ onSelect, currentName }) {
  const [collapsed, setCollapsed] = useState(false);

  const bodies = [
    { name: '太阳', color: '#ffb347' },
    { name: '水星', color: '#b8b0a8' },
    { name: '金星', color: '#e6a85c' },
    { name: '地球', color: '#3a86ff' },
    { name: '月球', color: '#cfcfcf' },
    { name: '火星', color: '#e2562f' },
    { name: '木星', color: '#e0a878' },
    { name: '土星', color: '#e8c969' },
    { name: '天王星', color: '#9fd8ff' },
    { name: '海王星', color: '#3f6bff' },
    { name: '冥王星', color: '#b07d68' }
  ];

  return (
    <nav className={'planet-nav' + (collapsed ? ' collapsed' : '')}>
      <button
        className="nav-toggle"
        onClick={() => setCollapsed(prev => !prev)}
        title={collapsed ? '展开速览' : '收起速览'}
      >
        {collapsed ? '◀ 速览' : '速览 ▶'}
      </button>
      {!collapsed && (
        <div className="nav-list">
          {bodies.map(b => (
            <button
              key={b.name}
              className={'nav-item' + (currentName === b.name ? ' active' : '')}
              onClick={() => onSelect(b.name)}
            >
              <span className="nav-dot" style={{ background: b.color, boxShadow: `0 0 8px ${b.color}` }} />
              <span className="nav-name">{b.name}</span>
            </button>
          ))}
        </div>
      )}
    </nav>
  );
}
