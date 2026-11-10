#!/usr/bin/env node
// Maximum retail fuel prices from the Energy Regulatory Commission (ERC), "АКТУЕЛНИ ЦЕНИ" box on erc.org.mk.
// ERC has no API; when prices change, the previous set is kept to show the difference.
import {getText, readData, writeData, stripTags, today, run, isMain} from './lib.mjs';

// [pattern on the ERC label, short name on the page]
const NAMES = [
  [/ЕУРОСУПЕР.*95/, 'ЕУРОСУПЕР 95'],
  [/ЕУРОСУПЕР.*98/, 'ЕУРОСУПЕР 98'],
  [/ЕУРОДИЗЕЛ/, 'ЕУРОДИЗЕЛ'],
  [/ЕКСТРА ЛЕСНО|ЕЛ-1/, 'ЕКСТРА ЛЕСНО'],
  [/МАЗУТ/, 'МАЗУТ М-1']
];

export function parse(html) {
  const box = html.match(/id="CeniLista"[\s\S]*?<\/table>/);
  if (!box) throw new Error('ERC price box not found, the page layout has changed');
  const items = [];
  for (const row of box[0].matchAll(/<tr>([\s\S]*?)<\/tr>/g)) {
    const cells = [...row[1].matchAll(/<td[^>]*>([\s\S]*?)<\/td>/g)].map(m => stripTags(m[1]));
    if (cells.length < 2) continue;
    const label = cells[0].toUpperCase(), m = cells[1].match(/([\d.,]+)\s*(.*)/);
    const known = NAMES.find(([re]) => re.test(label));
    if (!known || !m) continue;  // electricity and heating tariffs are skipped
    items.push({name: known[1], price: parseFloat(m[1].replace(',', '.')), unit: m[2].trim()});
  }
  if (!items.length) throw new Error('no fuel prices parsed');
  return items;
}

if (isMain(import.meta.url)) run(async () => {
  const items = parse(await getText('https://erc.org.mk/'));
  const old = await readData('fuel.json', null);
  const key = list => JSON.stringify(list.map(i => [i.name, i.price]));

  let data;
  if (old && key(old.items) === key(items)) data = old;
  else data = {since: today(), items, previous: old ? {since: old.since, items: old.items} : null};

  const changed = await writeData('fuel.json', data);
  console.log('fuel', items.map(i => i.name + ' ' + i.price).join(', '), changed ? 'updated' : 'unchanged');
});
