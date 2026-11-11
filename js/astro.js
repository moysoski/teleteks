// Sunrise, sunset and moon phase, computed locally (no data source needed).
// Sun: the standard sunrise equation (accurate to about a minute at these latitudes).
// Moon: mean synodic month from a known new moon (accurate to a few hours, enough for a phase name).

const RAD = Math.PI / 180;
const J2000 = 2451545.0;
const toJulian = ms => ms / 86400000 + 2440587.5;
const fromJulian = j => new Date((j - 2440587.5) * 86400000);

// isoDate: 'YYYY-MM-DD' (local calendar day); returns {rise, set} as Dates, or null in polar day/night
export function sunTimes(isoDate, lat, lon) {
  const n = Math.round(toJulian(Date.parse(isoDate + 'T12:00:00Z')) - J2000 + 0.0008);
  const jStar = n - lon / 360;
  const m = (357.5291 + 0.98560028 * jStar) % 360;
  const c = 1.9148 * Math.sin(m * RAD) + 0.02 * Math.sin(2 * m * RAD) + 0.0003 * Math.sin(3 * m * RAD);
  const lambda = (m + c + 180 + 102.9372) % 360;
  const transit = J2000 + jStar + 0.0053 * Math.sin(m * RAD) - 0.0069 * Math.sin(2 * lambda * RAD);
  const sinDecl = Math.sin(lambda * RAD) * Math.sin(23.4397 * RAD);
  const cosDecl = Math.cos(Math.asin(sinDecl));
  const cosW = (Math.sin(-0.833 * RAD) - Math.sin(lat * RAD) * sinDecl) / (Math.cos(lat * RAD) * cosDecl);
  if (cosW < -1 || cosW > 1) return null;
  const w = Math.acos(cosW) / RAD;
  return {rise: fromJulian(transit - w / 360), set: fromJulian(transit + w / 360)};
}

const SYNODIC = 29.530588853;
const KNOWN_NEW_MOON = 2451550.1;  // 6 January 2000, 18:14 UTC

const PHASES = [
  'МЛАДА МЕСЕЧИНА', 'РАСТЕЧКИ СРП', 'ПРВА ЧЕТВРТИНА', 'РАСТЕЧКА МЕСЕЧИНА',
  'ПОЛНА МЕСЕЧИНА', 'ОПАЃАЧКА МЕСЕЧИНА', 'ПОСЛЕДНА ЧЕТВРТИНА', 'ОПАЃАЧКИ СРП'
];

// age: days since new moon; fraction: 0..1 through the cycle; lit: illuminated share 0..1
export function moonPhase(date = new Date()) {
  const age = ((toJulian(date.getTime()) - KNOWN_NEW_MOON) % SYNODIC + SYNODIC) % SYNODIC;
  const fraction = age / SYNODIC;
  const lit = (1 - Math.cos(2 * Math.PI * fraction)) / 2;
  const name = PHASES[Math.round(fraction * 8) % 8];
  const daysTo = target => ((target * SYNODIC - age) % SYNODIC + SYNODIC) % SYNODIC;
  const nextFull = new Date(date.getTime() + daysTo(0.5) * 86400000);
  const nextNew = new Date(date.getTime() + (daysTo(0) || SYNODIC) * 86400000);
  return {age, fraction, lit, name, nextFull, nextNew};
}
