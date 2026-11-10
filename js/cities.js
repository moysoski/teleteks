// Cities shared by the browser and the GitHub Actions scripts.
export const CITIES = [
  {id: 'sk', name: 'СКОПЈЕ',   code: 'СК', lat: 42.00, lon: 21.43},
  {id: 'te', name: 'ТЕТОВО',   code: 'ТЕ', lat: 42.01, lon: 20.97},
  {id: 'ku', name: 'КУМАНОВО', code: 'КУ', lat: 42.13, lon: 21.71},
  {id: 'st', name: 'ШТИП',     code: 'ШТ', lat: 41.74, lon: 22.19},
  {id: 'sr', name: 'СТРУМИЦА', code: 'СР', lat: 41.44, lon: 22.64},
  {id: 'pp', name: 'ПРИЛЕП',   code: 'ПП', lat: 41.35, lon: 21.55},
  {id: 'bt', name: 'БИТОЛА',   code: 'БТ', lat: 41.03, lon: 21.33},
  {id: 'oh', name: 'ОХРИД',    code: 'ОХ', lat: 41.12, lon: 20.80}
];

export const TZ = 'Europe/Skopje';

export const cityById = id => CITIES.find(c => c.id === id);
