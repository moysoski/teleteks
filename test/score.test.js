import {test} from 'node:test';
import assert from 'node:assert/strict';
import {isHit, score} from '../js/score.js';

const cities = [{id: 'a'}, {id: 'b'}];
const day = (f, a) => ({forecast: f, actual: a});

test('hit needs both temperatures within 2 °C and correct rain', () => {
  const a = {min: 2, max: 12, rain: 0};
  assert.ok(isHit({min: 4, max: 10, rain: 0.5}, a));
  assert.ok(!isHit({min: 4.1, max: 12, rain: 0}, a));
  assert.ok(!isHit({min: 2, max: 12, rain: 1}, a));
});

test('streaks, extremes and the last day', () => {
  const ok = {min: 0, max: 10, rain: 0}, warm = {min: 5, max: 20, rain: 0};
  const history = {days: {
    '2026-11-01': day({a: ok, b: ok}, {a: ok, b: warm}),
    '2026-11-02': day({a: ok, b: ok}, {a: ok, b: ok}),
    '2026-11-03': day({a: ok}, {a: warm}),
    '2026-11-04': day({a: ok, b: ok}, null)  // not observed yet, ignored
  }};
  const r = score(history, cities);
  const [a, b] = r.cities;
  assert.equal(r.days, 3);
  assert.deepEqual([a.played, a.hits, a.streak, a.best], [3, 2, 0, 2]);
  assert.deepEqual([b.played, b.hits, b.streak, b.best], [2, 1, 1, 1]);
  assert.deepEqual([r.hits, r.total], [3, 5]);
  assert.equal(b.hottest, 1);
  assert.equal(r.hotRecord.temp, 20);
  assert.equal(r.last.date, '2026-11-03');
});
