/**
 * 企业号星舰音效系统（纯 Web Audio 合成，零外部资源）。
 *
 * - 引擎低鸣：持续低频正弦+噪声，随推力/速度平滑起伏
 * - 曲速加速：高频振荡叠层，随曲速状态提亮
 * - 进出探索模式：上升/下降音调提示音
 *
 * 所有音频在浏览器允许后由用户手势触发创建（点击"探索"按钮即手势）。
 */
export class ShipSound {
  constructor() {
    this.ctx = null;
    this.master = null;
    this.engineGain = null;
    this.engineOsc = null;
    this.engineNoise = null;
    this.warpGain = null;
    this.warpOsc = null;
    this.running = false;
    this._raf = null;
    this._state = { thrusting: false, speedRatio: 0, warp: false };
  }

  /** 启动：必须在用户手势内调用 */
  start() {
    if (this.running) return;
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    this.ctx = new AC();
    const ctx = this.ctx;

    this.master = ctx.createGain();
    this.master.gain.value = 0.0;
    this.master.connect(ctx.destination);

    // ---- 引擎低鸣：低频正弦 + 低通滤波噪声 ----
    this.engineOsc = ctx.createOscillator();
    this.engineOsc.type = 'sine';
    this.engineOsc.frequency.value = 52;

    const oscGain = ctx.createGain();
    oscGain.gain.value = 0.5;
    this.engineOsc.connect(oscGain);

    // 白噪声缓冲（2 秒循环）
    const buf = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
    this.engineNoise = ctx.createBufferSource();
    this.engineNoise.buffer = buf;
    this.engineNoise.loop = true;
    const noiseFilter = ctx.createBiquadFilter();
    noiseFilter.type = 'lowpass';
    noiseFilter.frequency.value = 220;
    const noiseGain = ctx.createGain();
    noiseGain.gain.value = 0.25;
    this.engineNoise.connect(noiseFilter).connect(noiseGain);

    this.engineGain = ctx.createGain();
    this.engineGain.gain.value = 0.0;
    oscGain.connect(this.engineGain);
    noiseGain.connect(this.engineGain);
    this.engineGain.connect(this.master);

    // ---- 曲速层：高频振荡 ----
    this.warpOsc = ctx.createOscillator();
    this.warpOsc.type = 'sawtooth';
    this.warpOsc.frequency.value = 180;
    this.warpGain = ctx.createGain();
    this.warpGain.gain.value = 0.0;
    const warpFilter = ctx.createBiquadFilter();
    warpFilter.type = 'bandpass';
    warpFilter.frequency.value = 400;
    warpFilter.Q.value = 2;
    this.warpOsc.connect(warpFilter).connect(this.warpGain);
    this.warpGain.connect(this.master);

    this.engineOsc.start();
    this.engineNoise.start();
    this.warpOsc.start();

    // 淡入总音量
    this.master.gain.linearRampToValueAtTime(0.55, ctx.currentTime + 0.8);
    this.running = true;

    // 播放启动提示音
    this._blip(320, 520, 0.25);
    this._loop();
  }

  stop() {
    if (!this.running) return;
    this._blip(520, 260, 0.3);
    this.running = false;
    if (this._raf) cancelAnimationFrame(this._raf);
    const ctx = this.ctx;
    this.master.gain.linearRampToValueAtTime(0.0, ctx.currentTime + 0.6);
    setTimeout(() => {
      try { ctx.close(); } catch (_) {}
    }, 700);
  }

  /** 每帧由 App 传入飞船状态 */
  setState(state) {
    this._state = state;
  }

  _loop() {
    if (!this.running) return;
    const ctx = this.ctx;
    if (ctx && ctx.state === 'running') {
      const { thrusting, speedRatio, warp } = this._state;
      const now = ctx.currentTime;

      // 引擎音量：巡航 0.12，推力中升到 0.5，随速度加成
      let target = thrusting ? 0.28 + speedRatio * 0.3 : 0.1;
      if (warp) target += 0.12;
      this.engineGain.gain.setTargetAtTime(target, now, 0.25);
      // 引擎音高随速度微升
      this.engineOsc.frequency.setTargetAtTime(52 + speedRatio * 38 + (warp ? 26 : 0), now, 0.3);

      // 曲速层
      const warpTarget = warp ? 0.10 + speedRatio * 0.08 : 0.0;
      this.warpGain.gain.setTargetAtTime(warpTarget, now, 0.35);
      this.warpOsc.frequency.setTargetAtTime(180 + speedRatio * 240, now, 0.3);
    }
    this._raf = requestAnimationFrame(() => this._loop());
  }

  /** 短促滑音提示 */
  _blip(f0, f1, dur) {
    if (!this.ctx) return;
    const ctx = this.ctx;
    const osc = ctx.createOscillator();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(f0, ctx.currentTime);
    osc.frequency.linearRampToValueAtTime(f1, ctx.currentTime + dur);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.25, ctx.currentTime);
    g.gain.linearRampToValueAtTime(0.0, ctx.currentTime + dur);
    osc.connect(g).connect(this.master);
    osc.start();
    osc.stop(ctx.currentTime + dur + 0.05);
  }
}
