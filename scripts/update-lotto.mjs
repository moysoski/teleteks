#!/usr/bin/env node
// Latest Lotto 7 draw from the State Lottery (loto.mk/Results). No API, so the results page is parsed.
import {getText, writeData, stripTags, run, isMain} from './lib.mjs';

export function parse(html) {
  const start = html.indexOf('Извлечени броеви за');
  if (start < 0) throw new Error('Lotto results not found, the page layout has changed');
  const block = html.slice(start, start + 8000);

  const head = stripTags(block).match(/Извлечени броеви за (\d+)\. коло - (\d{2})\.(\d{2})\.(\d{4})/);
  if (!head) throw new Error('Lotto round header not parsed');

  // the loto numbers come first, the Joker digits after the joker image
  const jokerAt = block.indexOf('joker');
  const nums = part => [...part.matchAll(/Rez_Brojevi_Txt">\s*(\d+)\s*</g)].map(m => +m[1]);
  const numbers = nums(block.slice(0, jokerAt));
  const joker = nums(block.slice(jokerAt)).slice(0, 6).join('');
  if (numbers.length !== 7) throw new Error('expected 7 Lotto numbers, got ' + numbers.length);

  const fund = stripTags(html).match(/седум погодоци во следното коло за ЛОТО 7:\s*([\d.]+)\s*МКД/);
  return {
    round: +head[1],
    date: head[4] + '-' + head[3] + '-' + head[2],
    numbers,
    joker,
    jackpot: fund ? +fund[1].replace(/\./g, '') : null
  };
}

if (isMain(import.meta.url)) run(async () => {
  const draw = parse(await getText('https://www.loto.mk/Results'));
  const changed = await writeData('lotto.json', draw);
  console.log('lotto', draw.round, draw.date, draw.numbers.join(' '), 'joker', draw.joker, changed ? 'updated' : 'unchanged');
});
