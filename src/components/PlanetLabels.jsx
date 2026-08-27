import React from 'react';

export function PlanetLabels({ positions }) {
  if (!positions) return null;

  return (
    <>
      {Object.entries(positions).map(([name, pos]) => (
        pos.visible && (
          <div
            key={name}
            className="planet-label"
            style={{
              left: `${pos.x}px`,
              top: `${pos.y - 20}px`,
              display: 'block'
            }}
          >
            <span className="label-dot" style={{ background: pos.color, boxShadow: `0 0 6px ${pos.color}` }} />
            {name}
          </div>
        )
      ))}
    </>
  );
}
