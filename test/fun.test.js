import {test} from 'node:test';
import assert from 'node:assert/strict';
import {DAY, ADVICE} from '../js/pages/fun.js';

test('every horoscope sentence fits one teletext line', () => {
  for (const s of [...DAY, ...ADVICE]) assert.ok([...s].length <= 38, `${[...s].length}: ${s}`);
});

test('no two signs share a sentence on the same day', async () => {
  const {pickFor} = await import('../js/pages/fun.js');
  for (const date of ['2026-11-11', '2026-12-31', '2027-03-01']) {
    const day = new Set(), advice = new Set();
    for (let s = 0; s < 12; s++) {
      day.add(pickFor('day', date, s));
      advice.add(pickFor('advice', date, s));
    }
    assert.equal(day.size, 12);
    assert.equal(advice.size, 12);
  }
});
