/** Domain-specific continuous control. Shared thresholds/API: active/air-shared/wearable-input.js — do not replace wholesale. */
/**
 * Wearable input — ring selects note/scale; cane continuous breath / tongue stop.
 */
export class WearableInput {
  /**
   * @param {{
   *   onGesture: (gesture: string, detail?: object) => void,
   *   onBadge?: (kind: string, text: string, active: boolean) => void
   * }} opts
   */
  constructor(opts) {
    this.onGesture = opts.onGesture;
    this.onBadge = opts.onBadge ?? (() => {});
    this.ringActive = false;
    this.caneActive = false;
    this.ringFrame = 0;
    this.caneFrame = 0;
    this.ringPrevBeta = null;
    this.ringPrevGamma = null;
    this.caneLastAccel = { x: 0, y: 0, z: 0 };
    this.canePrevGamma = null;
    this.lastTapAt = 0;
    this.breathing = false;
    this.lastBreathAt = 0;
    this._idleCheck = null;
  }

  setupRing() {
    if (typeof DeviceOrientationEvent === 'undefined') return;
    this.onBadge('ring', '戒指 · 点击启用', false);

    const enable = async () => {
      try {
        if (typeof DeviceOrientationEvent.requestPermission === 'function') {
          const perm = await DeviceOrientationEvent.requestPermission();
          if (perm !== 'granted') return;
        }
        this.ringActive = true;
        this.onBadge('ring', '戒指 · 已连接', true);
        window.addEventListener('deviceorientation', (e) => this.handleRing(e));
      } catch {
        this.onBadge('ring', '戒指 · 不支持', false);
      }
    };

    document.getElementById('ring-badge')?.addEventListener('click', enable, { once: true });
    if (typeof DeviceOrientationEvent.requestPermission !== 'function') enable();
  }

  setupCane() {
    if (typeof DeviceMotionEvent === 'undefined') return;
    this.onBadge('cane', '手杖 · 点击启用', false);

    const enable = async () => {
      try {
        if (typeof DeviceMotionEvent.requestPermission === 'function') {
          const perm = await DeviceMotionEvent.requestPermission();
          if (perm !== 'granted') return;
        }
        this.caneActive = true;
        this.onBadge('cane', '手杖 · 已连接', true);
        window.addEventListener('devicemotion', (e) => this.handleCane(e));
        if (!this._idleCheck) {
          this._idleCheck = setInterval(() => this.checkBreathIdle(), 80);
        }
      } catch {
        this.onBadge('cane', '手杖 · 不支持', false);
      }
    };

    document.getElementById('cane-badge')?.addEventListener('click', enable, { once: true });
    if (typeof DeviceMotionEvent.requestPermission !== 'function') enable();
  }

  checkBreathIdle() {
    if (!this.breathing) return;
    if (Date.now() - this.lastBreathAt > 220) {
      this.breathing = false;
      this.onGesture('breath_off');
    }
  }

  handleRing(e) {
    if (!this.ringActive) return;
    this.ringFrame++;
    if (this.ringFrame % 8 !== 0) return;

    const beta = e.beta || 0;
    const gamma = e.gamma || 0;
    if (this.ringPrevBeta === null) {
      this.ringPrevBeta = beta;
      this.ringPrevGamma = gamma;
      return;
    }

    const dBeta = beta - this.ringPrevBeta;
    const dGamma = gamma - this.ringPrevGamma;
    const shake = Math.abs(dBeta) > 20 || Math.abs(dGamma) > 20;
    this.ringPrevBeta = beta;
    this.ringPrevGamma = gamma;

    if (shake) {
      this.onGesture('toggle_mute');
      return;
    }
    if (Math.abs(dGamma) > 5) {
      this.onGesture(dGamma > 0 ? 'next_note' : 'prev_note');
      return;
    }
    if (Math.abs(dBeta) > 5) {
      this.onGesture(dBeta > 0 ? 'next_scale' : 'prev_scale');
    }
  }

  handleCane(e) {
    if (!this.caneActive) return;
    this.caneFrame++;
    if (this.caneFrame % 3 !== 0) return;

    const a = e.accelerationIncludingGravity || e.acceleration || { x: 0, y: 0, z: 0 };
    const dax = Math.abs((a.x || 0) - this.caneLastAccel.x);
    const day = Math.abs((a.y || 0) - this.caneLastAccel.y);
    const daz = Math.abs((a.z || 0) - this.caneLastAccel.z);
    this.caneLastAccel = { x: a.x || 0, y: a.y || 0, z: a.z || 0 };

    if (dax > 8 || day > 8 || daz > 8) {
      const now = Date.now();
      if (now - this.lastTapAt < 120) return;
      this.lastTapAt = now;
      this.breathing = false;
      this.onGesture('stop');
      return;
    }

    const rot = e.rotationRate || { gamma: 0, beta: 0 };
    const gamma = rot.gamma || 0;
    const beta = rot.beta || 0;
    const rate = Math.max(Math.abs(gamma), Math.abs(beta));
    // Continuous breath from rotation rate — must keep moving to sustain
    if (rate > 2.2) {
      const breath = Math.min(1.25, 0.4 + rate / 18);
      this.breathing = true;
      this.lastBreathAt = Date.now();
      this.onGesture('breath', { breath });
    }
    this.canePrevGamma = gamma;
  }
}
