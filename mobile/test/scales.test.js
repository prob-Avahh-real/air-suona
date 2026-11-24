const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const path = require('path');
const fs = require('fs');

const SCALES = [
  { id: 'festive', label: '喜庆', notes: ['D4', 'E4', 'F#4', 'A4', 'B4', 'D5'] },
  { id: 'solemn', label: '悲壮', notes: ['A3', 'C4', 'D4', 'E4', 'G4', 'A4'] },
  { id: 'folk', label: '民歌', notes: ['G3', 'A3', 'C4', 'D4', 'E4', 'G4'] },
  { id: 'opera', label: '戏曲', notes: ['C4', 'D4', 'E4', 'G4', 'A4', 'C5'] },
];

function wrap(i, n) {
  return ((i % n) + n) % n;
}

describe('air-suona scales', () => {
  it('has four scale banks', () => {
    assert.deepEqual(
      SCALES.map((s) => s.id),
      ['festive', 'solemn', 'folk', 'opera']
    );
  });

  it('each scale has six finger holes', () => {
    for (const s of SCALES) {
      assert.equal(s.notes.length, 6, s.id);
    }
  });

  it('wrap cycles note index', () => {
    assert.equal(wrap(-1, 6), 5);
    assert.equal(wrap(6, 6), 0);
  });
});

describe('project scaffold', () => {
  it('protocol file exists with ring and cane gestures', () => {
    const p = path.join(__dirname, '..', '..', 'protocol', 'air-suona.json');
    assert.ok(fs.existsSync(p));
    const data = JSON.parse(fs.readFileSync(p, 'utf8'));
    assert.ok(data.gestures.ring);
    assert.ok(data.gestures.cane);
    assert.equal(data.gestures.cane.swing.action, 'blow');
    assert.equal(data.gestures.cane.tap.action, 'stop');
    assert.equal(data.scales.length, 4);
  });
});
