import React, { useRef, useState, useCallback } from 'react';

/**
 * 虚拟摇杆：拖动底座上的摇杆头控制飞船。
 * 输出归一化向量 {x, y}，范围 [-1, 1]：
 *   x > 0 向右（偏航右转），y > 0 向前（推进）。
 * 松手自动回中并回调 {0, 0}。
 */
export function Joystick({ onMove, radius = 64 }) {
  const baseRef = useRef(null);
  const [knob, setKnob] = useState({ x: 0, y: 0 });
  const draggingRef = useRef(false);
  const pointerIdRef = useRef(null);

  const emit = useCallback((nx, ny) => {
    if (onMove) onMove(nx, ny);
  }, [onMove]);

  const handlePointerDown = (e) => {
    draggingRef.current = true;
    pointerIdRef.current = e.pointerId;
    try {
      e.target.setPointerCapture(e.pointerId);
    } catch (_) { /* 合成事件或旧浏览器无活动指针，忽略 */ }
    moveFromEvent(e);
  };

  const moveFromEvent = (e) => {
    const base = baseRef.current;
    if (!base) return;
    const rect = base.getBoundingClientRect();
    const cx = rect.left + rect.width / 2;
    const cy = rect.top + rect.height / 2;
    let dx = e.clientX - cx;
    let dy = e.clientY - cy;
    const len = Math.hypot(dx, dy);
    const max = radius - 14; // 摇杆头活动半径
    if (len > max) {
      dx = (dx / len) * max;
      dy = (dy / len) * max;
    }
    setKnob({ x: dx, y: dy });
    // 归一化输出：y 向上为正（屏幕坐标 y 向下，取反）
    emit(dx / max, -dy / max);
  };

  const handlePointerMove = (e) => {
    if (!draggingRef.current || e.pointerId !== pointerIdRef.current) return;
    moveFromEvent(e);
  };

  const endDrag = (e) => {
    if (e.pointerId !== pointerIdRef.current) return;
    draggingRef.current = false;
    pointerIdRef.current = null;
    setKnob({ x: 0, y: 0 });
    emit(0, 0);
  };

  return (
    <div
      ref={baseRef}
      className="joystick-base"
      style={{ width: radius * 2, height: radius * 2 }}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={endDrag}
      onPointerCancel={endDrag}
    >
      <div className="joystick-ring" />
      <div className="joystick-cross-h" />
      <div className="joystick-cross-v" />
      <div
        className="joystick-knob"
        style={{ transform: `translate(${knob.x}px, ${knob.y}px)` }}
      />
    </div>
  );
}
