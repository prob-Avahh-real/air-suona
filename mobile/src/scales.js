/**
 * Suona scale banks — pentatonic finger holes + timbre profiles.
 * Frequencies are equal-tempered approximations of Chinese folk pitch centers.
 */

const NOTE_HZ = {
  A3: 220.0,
  B3: 246.94,
  C4: 261.63,
  D4: 293.66,
  E4: 329.63,
  'F#4': 369.99,
  G4: 392.0,
  A4: 440.0,
  B4: 493.88,
  C5: 523.25,
  D5: 587.33,
};

/** Finger-hole labels (宫商角徵羽 + 高音) */
export const HOLE_LABELS = ['宫', '商', '角', '徵', '羽', '高'];

export const SCALES = [
  {
    id: 'festive',
    label: '喜庆',
    color: '#e8a54b',
    notes: ['D4', 'E4', 'F#4', 'A4', 'B4', 'D5'],
    profile: {
      brightness: 1.25,
      reedBuzz: 0.55,
      noise: 0.14,
      vibratoHz: 5.8,
      vibratoDepth: 7,
      formant: 1450,
    },
  },
  {
    id: 'solemn',
    label: '悲壮',
    color: '#c45c4a',
    notes: ['A3', 'C4', 'D4', 'E4', 'G4', 'A4'],
    profile: {
      brightness: 0.85,
      reedBuzz: 0.4,
      noise: 0.1,
      vibratoHz: 4.6,
      vibratoDepth: 9,
      formant: 1100,
    },
  },
  {
    id: 'folk',
    label: '民歌',
    color: '#6b9e6e',
    notes: ['G3', 'A3', 'C4', 'D4', 'E4', 'G4'],
    profile: {
      brightness: 1.0,
      reedBuzz: 0.45,
      noise: 0.12,
      vibratoHz: 5.2,
      vibratoDepth: 6,
      formant: 1280,
    },
  },
  {
    id: 'opera',
    label: '戏曲',
    color: '#d45c8c',
    notes: ['C4', 'D4', 'E4', 'G4', 'A4', 'C5'],
    profile: {
      brightness: 1.35,
      reedBuzz: 0.62,
      noise: 0.16,
      vibratoHz: 6.4,
      vibratoDepth: 8,
      formant: 1680,
    },
  },
];

export function noteHz(name) {
  if (NOTE_HZ[name] != null) return NOTE_HZ[name];
  // G3 fallback for folk scale
  if (name === 'G3') return 196.0;
  return 440;
}

export function scaleByIndex(i) {
  const n = SCALES.length;
  return SCALES[((i % n) + n) % n];
}

export function holeFreq(scale, holeIndex) {
  const notes = scale.notes;
  const n = notes.length;
  const i = ((holeIndex % n) + n) % n;
  return {
    index: i,
    name: notes[i],
    label: HOLE_LABELS[i] || notes[i],
    hz: noteHz(notes[i]),
  };
}
