/**
 * Shared mic breath detector — RMS over AnalyserNode.
 * User-gesture required to start (getUserMedia).
 *
 * Emits:
 *   onBreath({ intensity, active })  — intensity 0.2–1.25 while above gate
 *   onBreathOff()                    — fell below gate
 *   onStatus(text, active)
 */
export class BreathInput {
  /**
   * @param {{
   *   onBreath?: (detail: { intensity: number, active: boolean }) => void,
   *   onBreathOff?: () => void,
   *   onStatus?: (text: string, active: boolean) => void,
   *   gate?: number,
   *   ceiling?: number,
   * }} opts
   */
  constructor(opts = {}) {
    this.onBreath = opts.onBreath ?? (() => {});
    this.onBreathOff = opts.onBreathOff ?? (() => {});
    this.onStatus = opts.onStatus ?? (() => {});
    this.gate = opts.gate ?? 0.035;
    this.ceiling = opts.ceiling ?? 0.28;
    this.stream = null;
    this.ctx = null;
    this.analyser = null;
    this.source = null;
    this.raf = 0;
    this.active = false;
    this.wasBlowing = false;
    this.data = null;
    this.smooth = 0;
  }

  get enabled() {
    return !!this.stream;
  }

  /**
   * Must be called from a user gesture.
   */
  async start() {
    if (this.stream) return true;
    if (!navigator.mediaDevices?.getUserMedia) {
      this.onStatus('麦克风 · 不支持', false);
      return false;
    }
    try {
      this.stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: false,
          noiseSuppression: false,
          autoGainControl: false,
        },
        video: false,
      });
      const Ctx = window.AudioContext || window.webkitAudioContext;
      this.ctx = new Ctx();
      if (this.ctx.state === 'suspended') await this.ctx.resume();
      this.source = this.ctx.createMediaStreamSource(this.stream);
      this.analyser = this.ctx.createAnalyser();
      this.analyser.fftSize = 1024;
      this.analyser.smoothingTimeConstant = 0.55;
      this.source.connect(this.analyser);
      this.data = new Uint8Array(this.analyser.fftSize);
      this.active = true;
      this.onStatus('麦克风 · 真吹', true);
      this._loop();
      return true;
    } catch {
      this.stream = null;
      this.onStatus('麦克风 · 已拒绝', false);
      return false;
    }
  }

  stop() {
    this.active = false;
    if (this.raf) cancelAnimationFrame(this.raf);
    this.raf = 0;
    try {
      this.source?.disconnect();
    } catch {
      /* ignore */
    }
    this.stream?.getTracks()?.forEach((t) => t.stop());
    this.stream = null;
    this.source = null;
    this.analyser = null;
    if (this.ctx) {
      try {
        this.ctx.close();
      } catch {
        /* ignore */
      }
      this.ctx = null;
    }
    if (this.wasBlowing) {
      this.wasBlowing = false;
      this.onBreathOff();
    }
    this.onStatus('麦克风 · 点击启用', false);
  }

  _rms() {
    this.analyser.getByteTimeDomainData(this.data);
    let sum = 0;
    for (let i = 0; i < this.data.length; i++) {
      const v = (this.data[i] - 128) / 128;
      sum += v * v;
    }
    return Math.sqrt(sum / this.data.length);
  }

  _loop() {
    if (!this.active || !this.analyser) return;
    const rms = this._rms();
    this.smooth = this.smooth * 0.65 + rms * 0.35;
    const above = this.smooth > this.gate;
    if (above) {
      const t = (this.smooth - this.gate) / Math.max(0.001, this.ceiling - this.gate);
      const intensity = Math.min(1.25, 0.35 + t * 0.9);
      this.wasBlowing = true;
      this.onBreath({ intensity, active: true });
    } else if (this.wasBlowing) {
      this.wasBlowing = false;
      this.onBreathOff();
    }
    this.raf = requestAnimationFrame(() => this._loop());
  }
}
