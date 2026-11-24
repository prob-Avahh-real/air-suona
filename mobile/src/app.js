import { SCALES, holeFreq } from './scales.js';
import { AudioEngine } from './audio-engine.js';
import { WearableInput } from './wearable-input.js';
import { BreathInput } from './breath-input.js';

const $ = (id) => document.getElementById(id);

const audio = new AudioEngine();
const state = {
  scaleIndex: 0,
  noteIndex: 0,
  muted: false,
  blowing: false,
  touchHold: false,
  micDriving: false,
  lastBreath: 0.85,
};

function currentScale() {
  return SCALES[state.scaleIndex];
}

function currentHole() {
  return holeFreq(currentScale(), state.noteIndex);
}

function wrap(i, n) {
  return ((i % n) + n) % n;
}

function showToast(msg) {
  const el = $('toast');
  if (!el) return;
  el.textContent = msg;
  el.classList.add('show');
  clearTimeout(showToast._t);
  showToast._t = setTimeout(() => el.classList.remove('show'), 1200);
}

function haptic(ms = 14) {
  try {
    if (navigator.vibrate) navigator.vibrate(ms);
  } catch {
    /* ignore */
  }
}

function applyScaleTheme() {
  const scale = currentScale();
  document.documentElement.style.setProperty('--kit', scale.color);
  audio.setProfile(scale.profile);
}

function render() {
  const scale = currentScale();
  const hole = currentHole();
  applyScaleTheme();

  $('scale-name').textContent = scale.label;
  $('note-name').textContent = hole.label;
  const mode = breath.enabled ? '真吹' : state.blowing ? '供气中' : '静息';
  $('note-hint').textContent = `${hole.name} · ${hole.index + 1} / ${scale.notes.length} · ${mode}`;

  const grid = $('note-grid');
  grid.innerHTML = scale.notes
    .map((_, i) => {
      const h = holeFreq(scale, i);
      return `
    <button type="button" class="note-btn ${i === state.noteIndex ? 'active' : ''}" data-i="${i}">
      <span class="note-short">${h.label}</span>
      <span class="note-label">${h.name}</span>
    </button>`;
    })
    .join('');

  const tabs = $('scale-tabs');
  tabs.innerHTML = SCALES.map(
    (s, i) => `
    <button type="button" class="scale-tab ${i === state.scaleIndex ? 'active' : ''}" data-i="${i}">
      ${s.label}
    </button>`
  ).join('');

  $('mute-btn').classList.toggle('on', state.muted);
  $('mute-btn').textContent = state.muted ? '已静音' : '静音';

  $('blow-btn').classList.toggle('on', state.blowing);
  $('blow-btn').textContent = state.blowing ? '吹奏中…' : '吹奏';

  const visual = $('suona-visual');
  visual.classList.toggle('blowing', state.blowing);
  visual.dataset.note = hole.label;
}

async function applyBreath(breathAmt) {
  if (state.muted) return;
  await audio.ensure();
  const hole = currentHole();
  state.lastBreath = breathAmt;
  await audio.blow(hole.hz, { breath: breathAmt });
  const was = state.blowing;
  state.blowing = audio.isBlowing();
  if (!was && state.blowing) {
    haptic(12);
    showToast(`唢呐 · ${hole.label}`);
  }
  render();
}

function stopBlow() {
  audio.stop();
  state.blowing = false;
  state.touchHold = false;
  state.micDriving = false;
  haptic(8);
  render();
}

function setMuted(muted) {
  state.muted = muted;
  audio.setMuted(muted);
  if (muted) {
    audio.stop();
    state.blowing = false;
  }
  render();
  showToast(muted ? '已静音' : '取消静音');
}

async function selectNote(i) {
  const scale = currentScale();
  state.noteIndex = wrap(i, scale.notes.length);
  const hole = currentHole();
  if (state.blowing) {
    await audio.setPitch(hole.hz);
  }
  render();
  haptic(8);
}

function selectScale(i) {
  state.scaleIndex = wrap(i, SCALES.length);
  state.noteIndex = wrap(state.noteIndex, currentScale().notes.length);
  applyScaleTheme();
  if (state.blowing) {
    audio.setPitch(currentHole().hz);
  }
  render();
  showToast(`调式 · ${currentScale().label}`);
}

function handleGesture(gesture, detail) {
  switch (gesture) {
    case 'prev_note':
      selectNote(state.noteIndex - 1);
      break;
    case 'next_note':
      selectNote(state.noteIndex + 1);
      break;
    case 'prev_scale':
      selectScale(state.scaleIndex - 1);
      break;
    case 'next_scale':
      selectScale(state.scaleIndex + 1);
      break;
    case 'breath':
      // Continuous cane air — no latch
      if (state.touchHold || state.micDriving) break;
      applyBreath(detail?.breath ?? 0.85);
      break;
    case 'breath_off':
      if (!state.touchHold && !state.micDriving) stopBlow();
      break;
    case 'blow':
      // Legacy one-shot — treat as continuous breath pulse
      if (!state.touchHold && !state.micDriving) applyBreath(detail?.breath ?? 0.85);
      break;
    case 'stop':
      stopBlow();
      break;
    case 'toggle_mute':
      setMuted(!state.muted);
      break;
    default:
      break;
  }
}

const wearable = new WearableInput({
  onGesture: handleGesture,
  onBadge: (kind, text, active) => {
    const el = $(`${kind}-badge`);
    if (!el) return;
    el.textContent = text;
    el.classList.toggle('active', active);
  },
});

const breath = new BreathInput({
  onBreath: ({ intensity }) => {
    if (state.muted || state.touchHold) return;
    state.micDriving = true;
    applyBreath(intensity);
  },
  onBreathOff: () => {
    if (state.touchHold) return;
    state.micDriving = false;
    stopBlow();
  },
  onStatus: (text, active) => {
    const el = $('mic-badge');
    if (!el) return;
    el.textContent = text;
    el.classList.toggle('active', active);
  },
});

function bindUi() {
  $('note-grid').addEventListener('click', (e) => {
    const btn = e.target.closest('.note-btn');
    if (!btn) return;
    selectNote(Number(btn.dataset.i));
  });

  $('scale-tabs').addEventListener('click', (e) => {
    const btn = e.target.closest('.scale-tab');
    if (!btn) return;
    selectScale(Number(btn.dataset.i));
  });

  const blowBtn = $('blow-btn');
  const startFromPointer = (e) => {
    e.preventDefault();
    state.touchHold = true;
    applyBreath(0.95);
  };
  const stopFromPointer = (e) => {
    e.preventDefault();
    if (state.touchHold) stopBlow();
  };
  blowBtn.addEventListener('pointerdown', startFromPointer);
  blowBtn.addEventListener('pointerup', stopFromPointer);
  blowBtn.addEventListener('pointerleave', stopFromPointer);
  blowBtn.addEventListener('pointercancel', stopFromPointer);

  $('stop-btn').addEventListener('click', () => stopBlow());
  $('mute-btn').addEventListener('click', () => setMuted(!state.muted));

  $('mic-badge')?.addEventListener('click', async () => {
    if (breath.enabled) {
      breath.stop();
      showToast('已关闭真吹');
      return;
    }
    const ok = await breath.start();
    showToast(ok ? '真吹已开：气流持续供气，停吹即静音' : '无法开启麦克风');
  });

  window.addEventListener('keydown', (e) => {
    if (e.key === ' ' && !e.repeat) {
      e.preventDefault();
      state.touchHold = true;
      applyBreath(0.9);
    } else if (e.key === 'ArrowLeft') selectNote(state.noteIndex - 1);
    else if (e.key === 'ArrowRight') selectNote(state.noteIndex + 1);
    else if (e.key === 'ArrowUp') selectScale(state.scaleIndex - 1);
    else if (e.key === 'ArrowDown') selectScale(state.scaleIndex + 1);
    else if (e.key === 's' || e.key === 'S') stopBlow();
    else if (e.key === 'm' || e.key === 'M') setMuted(!state.muted);
    else if (e.key >= '1' && e.key <= '6') selectNote(Number(e.key) - 1);
  });

  window.addEventListener('keyup', (e) => {
    if (e.key === ' ') {
      e.preventDefault();
      stopBlow();
    }
  });
}

render();
bindUi();
wearable.setupRing();
wearable.setupCane();

document.body.addEventListener(
  'pointerdown',
  () => {
    audio.ensure();
  },
  { once: true }
);
