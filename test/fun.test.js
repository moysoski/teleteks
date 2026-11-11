import {test} from 'node:test';
import assert from 'node:assert/strict';
import {DAY, ADVICE} from '../js/pages/fun.js';

test('every horoscope sentence fits one teletext line', () => {
  for (const s of [...DAY, ...ADVICE]) assert.ok([...s].length <= 38, `${[...s].length}: ${s}`);
});
