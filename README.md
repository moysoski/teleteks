# Телетекст

**https://moysoski.github.io/teleteks/**

> **МК:** Македонски телетекст во прелистувач, како стариот ТВ телетекст: 40×25 знаци, 8 бои,
> мозаична графика и далечински. Време, курсна листа, фудбал и лото. Внеси број на
> страница, исто како на телевизор. По полноќ: тест-слика, „Крај на програмата“.

A Macedonian teletext in the browser. It is a static site on GitHub Pages: no server and no database.
Scheduled GitHub Actions workflows are the "backend".

## Pages

| Page | Content | Source | Updated |
|------|---------|--------|---------|
| 100 | Index | | |
| 160 | Mosaic map, tomorrow's max temperatures, warnings | Open-Meteo | live |
| 161 | 5-day forecast, one subpage per city | Open-Meteo | live |
| 162 | PM10, 24 h average | Open-Meteo Air Quality (CAMS) | live |
| 163 | How often the forecast was right, as a league table | own scoring | daily |
| 164 | Quiz: guess tomorrow's minimum (press REVEAL) | Open-Meteo | live |
| 165 | Sunrise, sunset and day length per city, moon phase (mosaic moon) | computed locally (`js/astro.js`) | |
| 200 | Exchange rates, middle rate | NBRM | 3× daily |
| 300 | Football: last round and the next one | TheSportsDB | every 3 h |
| 301 | League table and form | computed from results | every 3 h |
| 302 | Fixtures, next 3 rounds | TheSportsDB | every 3 h |
| 310 | Foreign leagues, last round: England, Spain, Italy, Germany, France, Champions League; one rotating subpage per league | TheSportsDB | every 3 h |
| 311 | Foreign leagues, next round | TheSportsDB | every 3 h |
| 400 | Horoscope, 3 subpages, for fun: sentences picked by date | `js/pages/fun.js` | daily |
| 500 | Lotto 7, latest draw | State Lottery (loto.mk) | 3× daily |
| 888 | Subtitles (easter egg, not in the index) | | |

Night mode: from 01:00 to 06:00 (the viewer's local time) the site opens on a test card, "Крај на програмата".
Tap the screen for the 1 kHz tone, press any remote button for teletext. A link to a page
(`#p300`) always opens teletext; `#kraj` opens the test card at any hour.

Newsflash: when tomorrow brings frost or heat (the same warning as on page 160), a red "ВОНРЕДНО"
box appears over the current page for 8 seconds, once per browser session, like teletext newsflashes
over the TV picture. Any button closes it. `#vonredno` shows it right away; without a warning it shows tomorrow's
coldest city instead.

Morning: on the first visit of the day between 06:00 and 09:00 a station clock ("Почеток на
програмата") counts down 10 seconds, then teletext starts. `#pocetok` opens it at any hour.

## Remote control

| Key | Button | Function |
|-----|--------|----------|
| `0`-`9` | digits | type a 3-digit page number |
| `←` `→` | ‹ › | previous / next page |
| `r` `g` `y` `c` | colour buttons | Fastext: links shown on row 24, they change per section |
| `h` | СТОП | HOLD: stop subpages from rotating |
| `z` | ЗУМ | SIZE: double the top half, then the bottom half (useful on phones) |
| `?` or `x` | ? | REVEAL hidden text |

Links to a page: `#p163`.

## How it works

- `js/teletext.js` keeps a 40×25 cell buffer and draws it on a `<canvas>`. Mosaic cells are 2×3 sextants
  stored as a 6-bit mask. The font is [Press Start 2P](https://fonts.google.com/specimen/Press+Start+2P),
  stretched vertically and hosted in `fonts/`.
- `js/pages/*.js` draw the pages, one file per section. A page is `{render(sub), subpages()}`.
- Live weather comes straight from [Open-Meteo](https://open-meteo.com/) in the browser. If that fails
  (outage, timeout, or a rate limit on an IP address shared by many mobile users), the page falls back to
  `data/weather-live.json`, a snapshot saved 3 times a day by `update-weather-live.mjs`.
- Everything else is fetched by scripts in `scripts/`, run by GitHub Actions, and saved in `data/*.json`.
  The browser only reads those files, so API keys never reach the page.

| Workflow | Script(s) | Schedule (UTC) |
|----------|-----------|----------------|
| `weather.yml` | `update-weather.mjs` | 19:30 |
| `daily.yml` | `update-rates.mjs`, `update-lotto.mjs`, `update-weather-live.mjs` | 06:00, 15:00, 21:00 |
| `football.yml` | `update-football.mjs`, `update-leagues.mjs` | every 3 h, 09-21 |
| `health.yml` | `check-sources.mjs` | 05:30 |

`health.yml` checks every morning that each source is reachable, still free (no key, payment or
rate limit), in the format the parsers expect, with plausible values, and that `data/` is fresh.
If anything fails it opens an issue labelled `sources` (GitHub e-mails it), adds a comment on
later failures, and closes it when everything works again.

The three update workflows call `update.yml`, which runs the scripts, commits `data/` only when something changed,
and deploys with `deploy.yml`. A failing script does not stop the others.

The weather job:
1. saves tomorrow's forecast for each city (the first saved forecast is final),
2. adds the observed values for finished days,
3. scores them into `data/weather-results.json`.

A **hit** means min and max are within 2 °C and the rain yes/no (≥ 1 mm) was right.

`sw.js` makes it an installable PWA that works offline with the last loaded data. `js/install.js`
shows an "install on phone" button: the browser's install prompt on Android and desktop Chrome,
short instructions on iPhone/iPad (Safari has no install API), hidden once installed.

All paths are relative, so the site works both at `user.github.io/repo/` and on a custom domain.
The only exception are the link-preview tags in `index.html` (`og:url`, `og:image`), which must be
absolute: update them when the site moves to its own domain. `og.png` (1200×630) is the preview image.

### Data sources and their limits

- **Observed weather:** Open-Meteo's analysis of past days. It is a model, not a weather station, so
  the scores are better than against real measurements. Planned: METAR from Skopje (LWSK) and
  Ohrid (LWOH) airports.
- **PM10:** CAMS model, ~10 km grid. It can strongly underestimate local winter peaks.
  Planned: measurements from the Ministry of Environment (air.moepp.gov.mk).
- **Backfill:** `--backfill N` uses Open-Meteo's Previous Runs API (forecasts issued one day
  earlier) to fill the past N days. Those days are marked `"source":"backfill"`.
- **Exchange rates:** official NBRM web service (JSON). No CORS, so it runs in Actions.
- **Fuel (removed for now):** ERC (erc.org.mk) is behind Cloudflare, which blocks requests from
  GitHub's servers. The page and its script are in the git history if fuel comes back.
- **Lotto:** no API. The script reads loto.mk/Results and fails loudly if the layout changes.
- **Football:** TheSportsDB with the free public key `123`. It returns full rounds but only 5 teams
  in the standings, so `301` is computed from results (points, goal difference, goals; the
  league's head-to-head rule is not applied). Rounds already finished are not fetched again.
  A premium key can be added as the `THESPORTSDB_KEY` repository secret.
  Foreign leagues (`update-leagues.mjs`) need three requests each: the latest finished match gives the
  season and round, then that round and the next one. Team names stay in Latin, shortened to 12 characters
  like on HRT teletext.

## Development

```bash
npm start                 # http://localhost:8123 (any static server works)
npm test                  # scoring tests
npm run update:weather    # same as the evening job, writes data/
npm run update:daily      # rates, lotto
npm run update:football   # first run fetches all rounds, takes a few minutes
npm run check             # health check of all sources
node scripts/update-weather.mjs --backfill 60
node scripts/make-icons.mjs
```

A server is needed, because ES modules and `fetch` do not work from `file://`.
During development the service worker serves cached files first. Reload twice, or tick
"Update on reload" in DevTools → Application.

## Setup on GitHub

1. Push to `main` in a **public** repository.
2. Settings → Pages → Source: **GitHub Actions**.
3. Actions → *Weather*, *Rates, lotto* and *Football* → *Run workflow* once each.
4. Optional: Settings → Secrets → Actions → `THESPORTSDB_KEY`.

Scheduled workflows in public repositories are disabled after 60 days without repository activity.
The daily data commit counts as activity. If it ever stops, re-enable the workflow in the Actions tab.

## Licence

Code: [MIT](LICENSE). Font: SIL Open Font License, see [fonts/OFL.txt](fonts/OFL.txt).
Weather data: [Open-Meteo](https://open-meteo.com/), CC BY 4.0. Football data:
[TheSportsDB](https://www.thesportsdb.com/). Rates and lotto: NBRM and the State Lottery.
The project name and logo are not covered by the MIT licence.

Inspiration: [weather.com/retro](https://weather.com/retro), HRT and NOS teletext,
[awesome-teletext](https://github.com/topics/teletext).
