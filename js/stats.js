// Visit counting with GoatCounter (no cookies, no IP addresses stored; loaded in index.html with an SRI hash).
// Each teletext page counts as its own path (/p160), only when the viewer opens it, not on subpage rotation.
// GoatCounter itself skips localhost, so local testing is not counted.
const queue = [];

export function countPage(path, title) {
  const gc = window.goatcounter;
  if (gc?.count) gc.count({path, title});
  else queue.push({path, title});  // the script loads async; sent once it is there
}

document.querySelector('script[data-goatcounter]')?.addEventListener('load', () => {
  while (queue.length) window.goatcounter?.count?.(queue.shift());
});
