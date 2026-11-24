/**
 * Web Audio suona synthesizer — sustained double-reed nasal tone.
 */
export class AudioEngine {
  constructor() {
    this.ctx = null;
    this.master = null;
    this.muted = false;
    this.profile = null;
    this.blowing = false;
    this.voice = null;
    this.currentHz = 440;
  }

  async ensure() {
    if (this.ctx) {
      if (this.ctx.state === 'suspended') await this.ctx.resume();
      return;
    }
    const Ctx = window.AudioContext || window.webkitAudioContext;
    this.ctx = new Ctx();
    this.master = this.ctx.createGain();
    this.master.gain.value = 0.55;
    this.master.connect(this.ctx.destination);
  }

  setProfile(profile) {
    this.profile = profile;
    if (this.blowing && this.voice) {
      this._applyProfile(this.ctx.currentTime);
    }
  }

  setMuted(muted) {
    this.muted = muted;
    if (this.master) {
      this.master.gain.setTargetAtTime(muted ? 0 : 0.55, this.ctx.currentTime, 0.02);
    }
  }

  isBlowing() {
    return this.blowing;
  }

  /**
   * Start or re-attack a sustained tone.
   * @param {number} hz
   * @param {{ breath?: number }} opts breath 0.35–1.25
   */
  async blow(hz, opts = {}) {
    await this.ensure();
    if (this.muted) return;

    const breath = Math.min(1.25, Math.max(0.35, opts.breath ?? 0.85));
    this.currentHz = hz;

    if (this.blowing && this.voice) {
      this._retune(hz, breath);
      return;
    }

    this._startVoice(hz, breath);
  }

  /**
   * Change pitch while sustaining (finger hole change).
   */
  async setPitch(hz) {
    await this.ensure();
    this.currentHz = hz;
    if (!this.blowing || !this.voice) return;
    const now = this.ctx.currentTime;
    for (const osc of this.voice.oscs) {
      osc.frequency.cancelScheduledValues(now);
      osc.frequency.setTargetAtTime(hz * osc._ratio, now, 0.03);
    }
    if (this.voice.noiseFilter) {
      this.voice.noiseFilter.frequency.setTargetAtTime(hz * 2.2, now, 0.04);
    }
  }

  /**
   * Tongue / release — stop air.
   */
  stop() {
    if (!this.ctx || !this.blowing || !this.voice) {
      this.blowing = false;
      return;
    }
    const now = this.ctx.currentTime;
    const v = this.voice;
    try {
      v.gain.gain.cancelScheduledValues(now);
      v.gain.gain.setTargetAtTime(0.0001, now, 0.04);
      v.noiseGain.gain.setTargetAtTime(0.0001, now, 0.03);
      for (const osc of v.oscs) osc.stop(now + 0.2);
      if (v.lfo) v.lfo.stop(now + 0.2);
      if (v.noise) v.noise.stop(now + 0.2);
    } catch {
      /* already stopped */
    }
    this.voice = null;
    this.blowing = false;
  }

  _startVoice(hz, breath) {
    const p = this.profile || {};
    const now = this.ctx.currentTime;
    const brightness = p.brightness ?? 1;
    const reedBuzz = p.reedBuzz ?? 0.5;
    const noiseAmt = p.noise ?? 0.12;
    const formant = (p.formant ?? 1400) * brightness;
    const vibHz = p.vibratoHz ?? 5.5;
    const vibDepth = (p.vibratoDepth ?? 7) * breath;

    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(0.0001, now);
    // Scoop attack — characteristic Chinese wind
    gain.gain.exponentialRampToValueAtTime(0.42 * breath, now + 0.045);
    gain.gain.setTargetAtTime(0.38 * breath, now + 0.12, 0.08);

    const formantFilter = this.ctx.createBiquadFilter();
    formantFilter.type = 'bandpass';
    formantFilter.frequency.value = formant;
    formantFilter.Q.value = 2.4;

    const bright = this.ctx.createBiquadFilter();
    bright.type = 'highshelf';
    bright.frequency.value = 2200;
    bright.gain.value = 4 * brightness;

    formantFilter.connect(bright);
    bright.connect(gain);
    gain.connect(this.master);

    // Fundamental (saw) + reed buzz (square) + odd partial
    const ratios = [1, 1, 2.01, 3.02];
    const types = ['sawtooth', 'square', 'sawtooth', 'sine'];
    const levels = [0.55, 0.28 * reedBuzz, 0.14, 0.08];
    const oscs = [];

    ratios.forEach((ratio, i) => {
      const osc = this.ctx.createOscillator();
      const og = this.ctx.createGain();
      osc.type = types[i];
      osc._ratio = ratio;
      // Slight pitch scoop into target
      osc.frequency.setValueAtTime(hz * ratio * 0.94, now);
      osc.frequency.exponentialRampToValueAtTime(hz * ratio, now + 0.05);
      og.gain.value = levels[i] * breath;
      osc.connect(og);
      og.connect(formantFilter);
      osc.start(now);
      oscs.push(osc);
    });

    // Vibrato LFO on fundamental path via detune of first two oscs
    const lfo = this.ctx.createOscillator();
    const lfoGain = this.ctx.createGain();
    lfo.type = 'sine';
    lfo.frequency.value = vibHz;
    lfoGain.gain.value = vibDepth;
    lfo.connect(lfoGain);
    for (const osc of oscs.slice(0, 2)) {
      lfoGain.connect(osc.frequency);
    }
    lfo.start(now + 0.1);

    // Breath / reed noise
    const noiseBuf = this._noiseBuffer(2);
    const noise = this.ctx.createBufferSource();
    noise.buffer = noiseBuf;
    noise.loop = true;
    const noiseFilter = this.ctx.createBiquadFilter();
    noiseFilter.type = 'bandpass';
    noiseFilter.frequency.value = hz * 2.2;
    noiseFilter.Q.value = 0.7;
    const noiseGain = this.ctx.createGain();
    noiseGain.gain.setValueAtTime(0.0001, now);
    noiseGain.gain.exponentialRampToValueAtTime(noiseAmt * breath, now + 0.06);
    noise.connect(noiseFilter);
    noiseFilter.connect(noiseGain);
    noiseGain.connect(this.master);
    noise.start(now);

    this.voice = { oscs, gain, lfo, noise, noiseGain, noiseFilter, formantFilter, bright };
    this.blowing = true;
  }

  _retune(hz, breath) {
    const now = this.ctx.currentTime;
    const v = this.voice;
    for (const osc of v.oscs) {
      osc.frequency.cancelScheduledValues(now);
      osc.frequency.setValueAtTime(osc.frequency.value, now);
      osc.frequency.exponentialRampToValueAtTime(Math.max(40, hz * osc._ratio), now + 0.04);
    }
    v.gain.gain.cancelScheduledValues(now);
    v.gain.gain.setTargetAtTime(0.4 * breath, now, 0.05);
    v.noiseGain.gain.setTargetAtTime((this.profile?.noise ?? 0.12) * breath, now, 0.05);
    if (v.noiseFilter) {
      v.noiseFilter.frequency.setTargetAtTime(hz * 2.2, now, 0.04);
    }
  }

  _applyProfile(now) {
    const p = this.profile || {};
    const v = this.voice;
    if (!v) return;
    if (v.formantFilter) {
      v.formantFilter.frequency.setTargetAtTime((p.formant ?? 1400) * (p.brightness ?? 1), now, 0.08);
    }
    if (v.bright) {
      v.bright.gain.setTargetAtTime(4 * (p.brightness ?? 1), now, 0.08);
    }
  }

  _noiseBuffer(duration) {
    const len = Math.max(1, Math.floor(this.ctx.sampleRate * duration));
    const buf = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1;
    return buf;
  }
}
