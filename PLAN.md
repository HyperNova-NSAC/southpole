# Lunar Skyline — Execution Plan

This is the plan the three of us build from. `DESIGN.md` explains the product. This file says who does what, in which order, on which branch, and the exact shapes the code must share.

If this file and `DESIGN.md` disagree on a schema, a library, or a phase, this file wins.

**How to read a code.** The letter is the track. The number is the order inside that track. **M** is a merge onto `main`, not someone's task. The full list is in §2.

---

## 1. Are we good to go?

Yes. Start at Phase 0. Do not start the horizon rays, the React screens, or a catalog prefetch until Phase 0 has merged.

What is already decided:

- One web app. One first screen. A sentence, a skyline, two bars, one comparison.
- Horizons is the Sun and Earth. Moon Trek is the elevation. QuickMap is a link to the same place. The CSA portal is tour text.
- We compute the terrain skyline, the clearance of the Sun and Earth over it, the countdowns, the sentence, and the comparison.
- We do not build a second ephemeris.

What Phase 0 still has to lock, because it depends on live services:

- The Horizons query string that actually returns, and the column order inside the result text.
- The Moon Trek elevation file: layer name, projection, and a small GeoTIFF on disk.
- A QuickMap URL that opens on a chosen crater.
- Three CSA pages worth quoting, each with its URL.

Site coordinates in `DESIGN.md` are approximate. Phase 0 corrects the ones the demo will use by looking at QuickMap. The rest of the catalog can stay rough until Track Sky's prefetch phase.

---

## 2. The three tracks

Assign people before anyone branches. Write the names in the table below and leave them.

| Track | Owns | Does not touch |
|---|---|---|
| **Terrain** | `pipeline/dem_grid.py`, `pipeline/horizon.py`, `pipeline/tests/test_horizon.py`, `server/`, `web/public/data/masks/`, `web/public/data/dem/` | `web/src/ui/`, `web/src/core/` |
| **Sky** | `pipeline/fetch_horizons.py`, `pipeline/parse_horizons.py`, `pipeline/tests/test_parse_horizons.py`, `web/src/core/`, `web/public/data/horizons/`, `web/public/data/sites.json` | `web/src/ui/`, `pipeline/horizon.py` |
| **Screen** | `web/src/ui/`, `web/src/state/`, `content/`, `web/index.html`, CSS | `pipeline/`, `server/`, `web/src/core/` except to import it |

Shared, edited only in Phase 0 and at merge gates:

- `web/src/contract/` (the TypeScript types and the Zod schemas)
- `pipeline/models.py` (the same shapes in Pydantic)
- `web/public/data/links.json`
- `README.md`

### Phase codes

| Letter | Track | What that person builds |
|---|---|---|
| **A** | Terrain | Elevation grid, horizon masks, the API |
| **B** | Sky | Horizons files, the mission math, the sentence |
| **C** | Screen | The page |
| **M** | Everyone, together | A merge gate. `main` updates, then the three track branches are cut again |

Phase 0 has no letter. It is the joint setup, and it is the only work that happens before the tracks exist.

| Code | What it is | Lands on `main` at |
|---|---|---|
| Phase 0 | Lock Horizons columns, the elevation file, QuickMap and Moon Trek links, and the shared types | the first commit on `main` |
| **A1** | Load the elevation file. Write a flat horizon so the others have a file to read | M1 |
| **B1** | Parse Horizons and interpolate. Save Shackleton and Apollo 11 tables | M1 |
| **C1** | First screen with placeholder text | M1 |
| **C2** | Draw the skyline | M1 |
| **A2** | Real ridge skyline for the demo sites | M2 |
| **A3** | Server: Horizons proxy, and a horizon for a typed coordinate | M2 |
| **B2** | Walk a mission and write the sentence | M2 |
| **C3** | Connect the screen to real Horizons data and the sentence | M2 |
| **B3** | Comparison sentence, and the next dates that still work | M3 |
| **B4** | Rest of the site catalog, and prefetch their Horizons files | M3 |
| **C4** | Details drawer, comparison, suggested dates | M3 |
| **A4** | Neighborhood grid. Optional. Skip it if M3 is still rough | M4, only if it is fast |
| **C5** | Tour, About, shareable URL | M4 |
| **M1** | Data files exist. The screen still shows placeholder copy | — |
| **M2** | First demo. A real sentence, the date changes it, play moves the Sun | — |
| **M3** | Comparison, suggested dates, a typed coordinate | — |
| **M4** | Tour and the submission checklist. Last merge | — |

### Branches

`main` is always something a person can run. It updates only at a merge gate.

Each track has one long-lived branch, cut fresh from `main` after every gate: `terrain`, `sky`, `screen`.

A phase is a short branch off that track. It merges into the track with a pull request, not into `main`. Example: `terrain/2-raymarch` merges into `terrain`. The track branch holds A1, then A2, and so on, until the next gate.

At a gate, merge in this order. Screen imports Sky's core, and both read Terrain's files, so Screen has to land last.

1. `terrain` → `main`
2. `sky` → `main`
3. Rebase `screen` onto `main`, then `screen` → `main`
4. Delete the three track branches and cut new ones from that `main`

```
Phase 0, everyone on one branch

  phase-0 ── PR ──► main
                     │
                     │  cut terrain, sky, and screen
                     │
    terrain               sky                  screen
    terrain/1-grid        sky/1-interpolate    screen/1-shell
    A1                    B1                   screen/2-skyline
                                               C1, C2
       │                    │                     │
       └──────── M1 ────────┴─────────────────────┘
                 order: terrain, then sky,
                 rebase screen, then screen
                 main shows the placeholder sentence
                 data files are real

                     │  cut the three branches again
                     │
    terrain               sky                  screen
    A2 ray march          B2 sentence          C3 bind the screen
    A3 API
       │                    │                     │
       └──────── M2 ────────┴─────────────────────┘
                 first demo

                     │  cut the three branches again
                     │
    terrain               sky                  screen
    (wait)                B3 comparison        C4 drawer
                          B4 catalog
       │                    │                     │
       └──────── M3 ────────┴─────────────────────┘
                 comparison and a typed coordinate

                     │  cut the three branches again
                     │
    terrain               sky                  screen
    A4 neighborhood       (nothing left)       C5 tour
    only if M3 is solid
       │                    │                     │
       └──────── M4 ────────┴─────────────────────┘
                 submission
```

Short branches never merge to `main` on their own. If a phase is not in the table above, it is not in the plan. M2 is the cut line: if the schedule slips, stop new phases and finish the M2 list in §12.

### Pull requests

Every phase PR uses this body:

```
## Track
Terrain | Sky | Screen

## Phase
<code and name, for example: A2 — The ray marcher>

## What a reviewer can run
<one command>

## Done when
<copied from this plan>
```

Reviewer is someone on a different track. A PR into a track branch needs one approval. A PR into `main` needs the other two.

---

## 3. Locked decisions

These stop the tracks from inventing incompatible versions.

| Topic | Decision |
|---|---|
| Language | TypeScript in the browser. Python 3.12 for Horizons, the elevation grid, and the API |
| JSON | camelCase on the wire and in every file under `web/public/data/` |
| Angles | Degrees in JSON and in the UI. Radians only inside `horizon.py` |
| Longitude | East-positive, −180 to 180 |
| Latitude | South-negative. The demo sites are negative |
| Time | ISO-8601 UTC with a `Z`. No local time zones in the data |
| Horizon | 360 samples, 1° step, index 0 is azimuth 0° (north). Value is the skyline elevation in degrees |
| Horizons step | 30 minutes |
| Display | Round degrees to 0.1 only in the details drawer. The sentence uses hours and days |
| Fallback horizon | A mask of 360 zeros and `terrainIncluded: false`, labelled "terrain not included" |
| Packages | npm and pip. No monorepo tool |
| Styling | One CSS file of tokens plus one module per component. No component library |
| Skyline drawing | Canvas 2D. Not D3, not SVG |
| Map | OpenLayers only inside the details drawer, and only at M3 |
| 3D | Not in this plan. It is the stretch past M4 |
| State | Zustand, one store |
| Server | FastAPI. The browser calls it only for a site that is not in the prefetched files |

---

## 4. Libraries

### Python (`requirements.txt`)

```
fastapi>=0.115
uvicorn>=0.32
httpx>=0.27
pydantic>=2.9
numpy>=2.1
numba>=0.60
rasterio>=1.4
pyproj>=3.7
pytest>=8.3
```

Numba is used for the ray loop only. If Numba fails to install on someone's machine, the same function runs as plain NumPy. The Phase A1 PR must include that fallback, because a broken install cannot block the track.

### Browser (`web/package.json`)

```
react, react-dom          19
typescript                 5.6
vite                       6
zustand                    5
zod                        3
ol                         10        (M3 only)
proj4                      2.12      (M3 only)
vitest                     2
```

No React Query, no router, no chart library. The app is one page.

---

## 5. Repository after Phase 0

```
southpole/
├── DESIGN.md
├── PLAN.md
├── README.md                      # how to run web, server, and tests
├── requirements.txt
├── pipeline/
│   ├── models.py                  # Pydantic, mirrors web/src/contract
│   ├── dem_grid.py
│   ├── horizon.py
│   ├── parse_horizons.py
│   ├── fetch_horizons.py
│   └── tests/
│       ├── test_horizon.py
│       └── test_parse_horizons.py
├── server/
│   ├── app.py
│   ├── horizons_proxy.py
│   └── cache/                     # gitignored
├── content/
│   └── tour.json
├── web/
│   ├── package.json
│   ├── vite.config.ts
│   ├── index.html
│   ├── public/data/
│   │   ├── sites.json
│   │   ├── links.json
│   │   ├── profiles.json
│   │   ├── horizons/.gitkeep
│   │   └── masks/.gitkeep
│   └── src/
│       ├── main.tsx
│       ├── contract/
│       │   ├── types.ts
│       │   └── schemas.ts
│       ├── core/
│       │   ├── interpolate.ts
│       │   ├── mask.ts
│       │   ├── evaluate.ts
│       │   ├── metrics.ts
│       │   ├── verdict.ts
│       │   ├── slip.ts
│       │   └── compare.ts
│       ├── state/
│       │   └── store.ts
│       └── ui/
│           ├── tokens.css
│           ├── App.tsx
│           ├── Header.tsx
│           ├── SiteDateBar.tsx
│           ├── VerdictBanner.tsx
│           ├── Skyline.tsx
│           ├── CountdownRow.tsx
│           ├── MissionBars.tsx
│           ├── CompareRow.tsx
│           ├── DetailsDrawer.tsx
│           ├── NumbersTable.tsx
│           ├── SourceFooter.tsx
│           ├── Tour.tsx
│           └── AboutDialog.tsx
```

Files appear in the phase that creates them. Phase 0 creates the folders, the contract, and empty components that render the first screen from a fixture.

---

## 6. The contract

Both languages store the same JSON. Zod parses it at the edge of the UI. Pydantic parses it at the edge of the server. Core functions trust the types and do not re-parse.

### 6.1 `Site`

```ts
type Site = {
  id: string                 // "shackleton-rim"
  name: string               // "Shackleton rim"
  latDeg: number
  lonDegEast: number
  heightM: number            // 0 until Terrain measures it
  category: "apollo" | "international" | "clps" | "artemis" | "polar" | "csa"
  agency: string
  notes: string
  sourceUrl: string
}
```

`sites.json` is `{ "sites": Site[] }`.

Demo set, ids fixed so filenames stay stable:

| id | Role in the demo |
|---|---|
| `shackleton-rim` | The opening site |
| `nobile-rim-1` | The comparison site |
| `shackleton-floor` | A dark counter-example, details drawer only |
| `apollo-11` | Equatorial contrast, details drawer only |

Phase 0 fills these four with coordinates confirmed in QuickMap. Other catalog sites wait until phase B4.

### 6.2 `HorizonsTable`

```ts
type HorizonsSample = {
  t: string                  // "2027-03-03T00:00:00Z"
  azDeg: number              // Horizons azimuth, degrees, 0 = north, clockwise
  elDeg: number
  angDiamDeg: number
  illumFrac: number | null   // Earth only. Sun is null
}

type HorizonsTable = {
  body: "sun" | "earth"
  siteId: string
  latDeg: number
  lonDegEast: number
  altKm: number
  stepMin: 30
  queriedAt: string
  queryUrl: string           // the exact URL, so the footer can show it
  source: "JPL Horizons"
  samples: HorizonsSample[]  // sorted by t, uniform step
}
```

Files: `web/public/data/horizons/<siteId>-sun.json` and `<siteId>-earth.json`.

### 6.3 `HorizonMask`

```ts
type HorizonMask = {
  siteId: string
  latDeg: number
  lonDegEast: number
  mastM: number
  azStepDeg: 1
  maskElDeg: number[]        // length 360. maskElDeg[i] is the skyline at azimuth i degrees
  heightM: number            // terrain under the site
  demSource: string          // "Moon Trek LOLA <product>, downloaded <date>" or "flat"
  terrainIncluded: boolean
}
```

Files: `web/public/data/masks/<siteId>.json` for the prefetched mast height of 2 m. A custom mast height comes from `POST /api/horizon` and is not written to the repo during a session.

### 6.4 `MissionProfile`

```ts
type MissionProfile = {
  id: string
  label: string              // "Small lander, 14 days"
  durationHours: number
  earthRequiredAtLanding: boolean
  maxLongestDarkHours: number | null
  illustrative: boolean      // true on every preset. The UI says "illustrative limits"
}
```

`profiles.json`:

| id | label | durationHours | earthRequiredAtLanding | maxLongestDarkHours |
|---|---|---|---|---|
| `small-lander` | Small lander, 14 days | 336 | true | 50 |
| `long-stay` | Long stay, 100 days | 2400 | false | 100 |
| `custom` | Custom | set by the user | set by the user | set by the user |

The CSA preset is added in phase C5 only if the portal gives a real duration. Until then it is absent, not invented.

### 6.5 Results the core returns

```ts
type Instant = {
  t: string
  sunAzDeg: number
  sunElDeg: number
  sunAngDiamDeg: number
  sunClearanceDeg: number
  sunFrac: number            // 0 to 1, share of the disc above the skyline
  earthAzDeg: number
  earthElDeg: number
  earthAngDiamDeg: number
  earthIllumFrac: number | null
  earthClearanceDeg: number
  earthVisible: boolean      // clearance >= commMarginDeg
  powerWm2: number           // illustrative
}

type WindowMetrics = {
  sunlitFraction: number
  earthFraction: number
  bothFraction: number
  longestDarkHours: number
  longestCommGapHours: number
  sunsetInHours: number | null
  earthsetInHours: number | null
  litAtLanding: boolean
  earthAtLanding: boolean
  transitionCount: number
}

type Verdict = {
  light: "green" | "amber" | "red"
  sentence: string
  reasons: string[]          // plain sentences, shown in the drawer
}

type Comparison = {
  otherSiteId: string
  sentence: string
}
```

### 6.6 Links

`web/public/data/links.json`:

```ts
type Links = {
  quickmap: string           // template with {lat} {lon} {zoom}
  moontrek: string
  credit: string             // one paragraph for the About dialog
}
```

Screen builds a Horizons link from `HorizonsTable.queryUrl`. It does not assemble Horizons parameters itself.

### 6.7 HTTP

```
GET  /api/health
     → { "ok": true }

GET  /api/horizons?siteId&lat&lon&altKm&body=sun|earth&start&stop
     → HorizonsTable
     Cache key: those query fields, rounded lat/lon to 4 decimals, altKm to 3.
     One upstream call at a time. On failure: 502 { "error": "horizons", "message": "..." }

POST /api/horizon
     { "siteId": "custom", "latDeg": -89.5, "lonDegEast": 0, "mastM": 2 }
     → HorizonMask
     On failure: 503 { "error": "terrain", "message": "..." }
```

There is no neighborhood endpoint until phase A4. There is no general `/api/links`. The file `links.json` is static.

---

## 7. Algorithms

Implement these as specified. Do not "improve" them during the hackathon.

### 7.1 Parse a Horizons response

`GET https://ssd.jpl.nasa.gov/api/horizons.api` with `format=json` returns a JSON object whose `result` field is a text block. The table sits between the lines `$$SOE` and `$$EOE`.

Phase 0 saves one real response as `pipeline/tests/fixtures/horizons_sample.txt` and writes down the header row. `parse_horizons.py` splits on those markers and reads the columns Phase 0 recorded. Column positions live in one dict at the top of the file:

```python
COLUMNS = {
    "time": 0,
    "azDeg": 1,       # replaced with the real indexes after the spike
    "elDeg": 2,
    "angDiamDeg": 3,
    "illumFrac": 4,   # absent for the Sun query
}
```

Dates from Horizons are converted to ISO UTC. Azimuth values above 360 or below 0 are wrapped into `[0, 360)`.

### 7.2 Interpolate

```ts
function sampleAt(table: HorizonsTable, tMs: number): HorizonsSample
```

Find the two samples around `tMs`. Fraction `u` is linear in time.

- `elDeg`, `angDiamDeg`, `illumFrac`: linear.
- `azDeg`: linear along the short way around the circle.

```
da = ((az2 - az1 + 540) % 360) - 180
az = (az1 + u * da + 360) % 360
```

Before the first sample or after the last, clamp to the end sample. Callers keep the playhead inside the table.

### 7.3 Skyline lookup

```ts
function skylineEl(mask: HorizonMask, azDeg: number): number {
  const i = Math.round(azDeg / mask.azStepDeg) % mask.maskElDeg.length
  return mask.maskElDeg[i]
}
```

Nearest sample. No interpolation in azimuth for version 1.

### 7.4 Disc fraction

Five samples across the vertical extent of the disc at the body's azimuth. Ignore the disc's width. That is accurate enough for a sentence about days, and it is the wrong place to spend time.

```
radius = angDiamDeg / 2
samples = [-1, -0.5, 0, 0.5, 1].map(k => elDeg + k * radius)
above = samples.filter(e => e > skylineEl(mask, azDeg)).length
frac = above / 5
```

`sunFrac >= 0.5` counts as sunlit. `earthClearanceDeg >= commMarginDeg` (default 1) counts as Earth visible. Both thresholds are constants in `web/src/core/evaluate.ts`.

### 7.5 Illustrative power

Watts per square metre at the site, before any real panel efficiency. The UI always prints "illustrative".

```
elev = max(sunElDeg, 0) in radians
flat     = 1361 * sunFrac * sin(elev)
tracking = 1361 * sunFrac * cos(elev)     // a vertical panel that turns to face the Sun
```

The first screen does not show watts. The details drawer shows `tracking` for the current instant. `flat` is shown next to it so a polar site reads as almost nothing on a horizontal panel.

### 7.6 Walk a mission

```ts
function evaluateMission(
  sun: HorizonsTable,
  earth: HorizonsTable,
  mask: HorizonMask,
  landingUtc: string,
  durationHours: number,
  commMarginDeg: number
): { samples: Instant[]; metrics: WindowMetrics }
```

Step from `landingUtc` by 30 minutes for `durationHours`. At each step, interpolate both tables, look up the skyline, fill an `Instant`.

Then, in one pass over `samples`:

- Fractions: count of steps where `sunFrac >= 0.5`, where `earthVisible`, where both, divided by the number of steps.
- Longest dark hours: longest run of `sunFrac < 0.5`, times 0.5 hour.
- Longest comm gap: the same for `earthVisible === false`.
- `sunsetInHours`: hours until the first sample with `sunFrac < 0.5`. `null` if the Sun never drops below half in the window.
- `earthsetInHours`: the same for Earth.
- Landing flags: the first sample.
- `transitionCount`: number of times `sunFrac >= 0.5` flips.

### 7.7 The sentence

`verdict.ts` is the only place that builds the sentence. The UI does not assemble it.

```
darkOver = maxLongestDarkHours != null
           && metrics.longestDarkHours > maxLongestDarkHours
earthMiss = profile.earthRequiredAtLanding && !metrics.earthAtLanding

daysUp = round(metrics.sunlitFraction * durationHours / 24)
nightH = round(metrics.longestDarkHours)

if darkOver and earthMiss:
  light = red
  sentence = "This landing does not work. Earth is below the horizon when you land, and the longest night is {nightH} hours."
if darkOver:
  light = red
  sentence = "This landing does not work. The longest night is {nightH} hours, past the {limit}-hour limit."
if earthMiss:
  light = red
  sentence = "This landing does not work. Earth is below the horizon when you land."
if within 10% of the night limit, or Earth clears the margin by under 0.3°:
  light = amber
  sentence = "This landing is marginal. The Sun is up for {daysUp} of the {days} days. The longest night is {nightH} hours."
else:
  light = green
  sentence = "This landing works. The Sun is up for {daysUp} of the {days} days. Earth is in view when you land. The longest night is {nightH} hours."
```

`reasons` repeats the failed limit in a second sentence, for the drawer. Example: "Limit: longest night under 50 hours. This window: 60 hours."

Amber's "within 0.3°" uses the landing sample's `earthClearanceDeg`. Skip that clause if it is awkward to explain. The night-limit clause is the one that matters.

### 7.8 Comparison sentence

```ts
function compare(a: WindowMetrics, b: WindowMetrics, bName: string): string
```

Pick the larger of these two differences and say only that:

- Earth-visible fraction, expressed as days
- Longest night, expressed as hours

```
"Nobile Rim 1 stays in contact 2 days longer."
"Nobile Rim 1's longest night is 41 hours shorter."
```

If both differences are under half a day and under 6 hours:

```
"Nobile Rim 1 is about the same for this landing."
```

### 7.9 Slip index

Built once per site after the year tables and the mask exist.

```ts
type SlipIndex = {
  siteId: string
  t0: string
  stepMin: 30
  sunlit: number[]           // 0 or 1, one per step
  earth: number[]            // 0 or 1
  sunPrefix: number[]        // sunPrefix[i] = sum of sunlit[0..i)
  earthPrefix: number[]
  darkRuns: { start: number; length: number }[]
  commRuns: { start: number; length: number }[]
}
```

For a landing index `i0` and a length in steps `n`:

- Sunlit fraction = `(sunPrefix[i0 + n] - sunPrefix[i0]) / n`
- Longest dark run overlapping `[i0, i0 + n)` after clipping the run to that range

`slip.ts` returns, for one site, the next three landing indexes where `verdict.light !== "red"`, and for the current landing the best other demo site that is not red. The drawer shows those as sentences, not as a raw grid. A grid is drawn only if the sentences work.

### 7.10 Horizon rays

Constants in `pipeline/horizon.py`:

```python
MOON_RADIUS_M = 1_737_400.0
AZ_STEP_DEG = 1.0
MAX_RANGE_M = 150_000.0
RANGE_GROWTH = 1.02          # geometric steps from 20 m
```

```python
def mask_for(grid: DemGrid, lat_deg: float, lon_deg: float, mast_m: float) -> HorizonMask:
    ...
```

Local frame at the site:

```
phi, lam = radians(lat), radians(lon)
u = (cos phi cos lam, cos phi sin lam, sin phi)          # up
e = (-sin lam, cos lam, 0)                               # east
n = cross(u, e)                                          # north
r_site = (MOON_RADIUS_M + height_m + mast_m) * u
```

For each azimuth `az` from 0 to 359:

```
dir_h = sin(az) * e + cos(az) * n                        # az 0 looks north
max_el = -90
d = 20
while d <= MAX_RANGE_M:
    p_hat = normalize(r_site + d * dir_h)                # step in the tangent direction, then project to the sphere
    # better: destination on the sphere
    p_hat = normalize(cos(d / R) * u_unit_of_site + sin(d / R) * dir_h)
    h = grid.sample(p_hat)                               # bilinear, metres
    p = (R + h) * p_hat
    el = degrees(asin(dot(p - r_site, u) / norm(p - r_site)))
    max_el = max(max_el, el)
    d *= RANGE_GROWTH
mask[az] = max_el
```

`grid.sample` converts `p_hat` to polar stereographic metres and bilinear-samples the array. Points outside the grid are skipped. If more than half the rays never hit the grid, set `terrainIncluded` false and return a zero mask rather than a misleading skyline.

Polar stereographic used to build the grid, confirmed in Phase 0 and stored in `dem/provenance.json`:

```
+proj=stere +lat_0=-90 +lon_0=0 +k=1 +x_0=0 +y_0=0 +R=1737400 +units=m
```

If the GeoTIFF's own CRS differs, `dem_grid.py` reprojects into this one with rasterio and pyproj. The ray marcher only ever sees this CRS.

`DemGrid`:

```python
@dataclass
class DemGrid:
    heights_m: np.ndarray     # float32, shape (rows, cols), north-up
    origin_x_m: float         # x of the centre of pixel [0, 0]  (column 0)
    origin_y_m: float         # y of the centre of pixel [0, 0]  (row 0)
    pixel_m: float
    source: str
```

Row 0 is the northern edge of the subset, so `y` decreases as the row index increases. Document that in the dataclass and test it.

Numba wraps the inner loop over azimuth and distance. `grid.sample` stays outside Numba if bilinear plus a Python call is fast enough on a downsampled grid. Phase A2 downsamples the subset to about 200 m per pixel before the march. A 150 km radius at 200 m is a few hundred samples per ray. 360 rays is a fraction of a second in Numba and acceptable in plain NumPy.

### 7.11 Synthetic test for the marcher

`test_horizon.py` builds a `DemGrid` that is flat except for one ridge: a row of pixels 2,000 m high, 20 km due east of the site. The mask must peak near azimuth 90° and stay near 0° near azimuth 270°. The test checks the peak azimuth within 5° and that the east elevation is greater than the west elevation. It does not check an exact angle.

---

## 8. Phase 0 — joint, one PR into `main`

Branch: `phase-0`. Everyone in one branch, one PR. Half a day.

| Person | Task |
|---|---|
| Sky | Run one Sun query and one Earth query for latitude −89.5, longitude 0, from 2027-03-01 to 2027-03-04, step 30 minutes. Save the raw `result` text. Record the working query parameters and the column indexes in `parse_horizons.py`. Commit the fixture. |
| Terrain | Download a Moon Trek elevation subset covering 80°S to the pole, or the smallest product that includes Shackleton. Write `dem/provenance.json` with the URL, the CRS, the pixel size, and the date. If the download is impossible in two hours, stop and switch to the PDS backup named in `DESIGN.md`. Do not write the ray marcher yet. |
| Screen | Confirm a QuickMap URL for Shackleton and a Moon Trek URL for the same point. Put the templates in `links.json`. Draft `credit` from the wording on those sites. Create the Vite app, the folders, and a first screen that renders the fixture sentence in §7.7's green example. |

Phase 0 also adds:

- `requirements.txt`, `web/package.json`, `README.md` with three commands: `npm install && npm run dev`, `pip install -r requirements.txt && pytest`, `uvicorn server.app:app --reload`
- `contract/types.ts`, `contract/schemas.ts`, `pipeline/models.py`, filled with §6
- `sites.json` with the four demo sites, coordinates corrected in QuickMap
- `profiles.json` with `small-lander` and `long-stay`
- A Vite proxy: `/api` → `http://127.0.0.1:8000`

**Done when:** `npm run dev` shows the green example sentence. `pytest` parses the saved Horizons fixture into a `HorizonsTable` with more than one sample. `provenance.json` exists. `links.json` opens QuickMap on Shackleton.

Merge to `main`. Cut `terrain`, `sky`, and `screen` from that commit.

---

## 9. Track Terrain

### A1 — Grid and a flat mask

Branch: `terrain/1-grid`

- `dem_grid.py`: load the GeoTIFF from Phase 0, print width, height, min, max, CRS.
- `horizon.py`: `flat_mask(site, mast_m) -> HorizonMask` with 360 zeros and `terrainIncluded: false`.
- Write `web/public/data/masks/shackleton-rim.json` and `nobile-rim-1.json` using the flat mask, so Screen and Sky have files to read. Replace them in A2.
- Test: loading the GeoTIFF does not throw, and the flat mask has length 360.

**Done when:** `pytest pipeline/tests/test_horizon.py` passes and the two JSON files validate against the Zod schema (a tiny node script, or a pytest that checks the keys).

### A2 — The ray marcher

Branch: `terrain/2-raymarch`

- Implement §7.10 and §7.11.
- Downsample to ~200 m.
- Produce real masks for `shackleton-rim`, `nobile-rim-1`, `shackleton-floor`, and `apollo-11`. Apollo 11 will mostly miss a south-pole grid. Its mask stays flat with `terrainIncluded: false`. That is correct and useful: the equatorial story uses Horizons alone.
- Record `heightM` back into `sites.json` for the polar sites. This is the one edit Terrain makes to `sites.json`. Tell Sky in the PR.

**Done when:** the synthetic ridge test passes, the Shackleton mask is not flat (max minus min is more than 0.3°), and the four JSON files are in the PR.

### A3 — The API

Branch: `terrain/3-api`

- `server/app.py` with the three routes in §6.7.
- `server/horizons_proxy.py` calls `parse_horizons.fetch` (Sky owns the parser; Terrain calls it). If Sky's parser is not on `main` yet, depend on the Phase 0 version, which already parses the fixture.
- Disk cache under `server/cache/`, gitignored. Key is a hash of the query.
- A lock so only one Horizons request is in flight.
- `POST /api/horizon` uses the grid in memory, loaded once at startup.
- CORS open for `http://localhost:5173`.

**Done when:** with the server running, a `curl` for Shackleton's Sun across 3–4 March 2027 returns a `HorizonsTable`, and a `curl -X POST` for a point inside the grid returns a mask with `terrainIncluded: true`. The second identical Horizons call is served from the cache (log line "cache hit").

### A4 — Neighborhood, only after M3

Branch: `terrain/4-neighborhood`

Skip this if M3's first screen is still rough. The cut line in `DESIGN.md` drops the neighborhood before it drops the sentence.

- `POST /api/neighborhood` with `{ latDeg, lonDegEast, landingUtc, durationHours, profileId }`.
- 11 by 11 points, 500 m apart. Reuse the parent Horizons tables (Sky's files). Compute a mask per point at 2° steps and 80 km, not the full march.
- Return `{ cells: [{ latDeg, lonDegEast, sunlitFraction, light }] }`.

**Done when:** one request returns 121 cells in under 30 seconds and the cell on a ridge is not identical to the cell in a crater.

---

## 10. Track Sky

### B1 — Parser and interpolation

Branch: `sky/1-interpolate`

- Finish `parse_horizons.py` against the Phase 0 fixture. Add a test that the first sample's elevation is finite and the timestamps are 30 minutes apart.
- `fetch_horizons.py --site shackleton-rim --start 2027-03-01 --stop 2027-04-15` writes the two JSON files. Run it for `shackleton-rim` and `apollo-11`. Commit those files. They are the demo cache.
- `web/src/core/interpolate.ts` implementing §7.2.
- Vitest: azimuth 350° → 10° at the midpoint is 0°, not 180°. Elevation 0 → 1 at the midpoint is 0.5.

**Done when:** both tests pass and `web/public/data/horizons/shackleton-rim-sun.json` loads in the browser console.

### B2 — Mission, sentence, verdict

Branch: `sky/2-verdict`

- `mask.ts`, `evaluate.ts`, `metrics.ts`, `verdict.ts` as in §7.3–§7.7.
- `evaluate.ts` reads a mask. Until A2 lands, use the flat mask from A1. The sentence still has to read correctly for Apollo 11: about half a month of daylight across a long window. For a 14-day window starting at local morning, the Sun stays up. Pick the Apollo landing time by reading the Horizons file, and lock that ISO string in the test.
- Vitest cases:
  - Flat mask, Sun elevation always +20: `sunlitFraction === 1`, sentence starts "This landing works".
  - Flat mask, Sun elevation always −5: sentence starts "This landing does not work" and mentions the night.
  - A mask of 10° everywhere and a Sun at +2°: `sunFrac === 0`.
  - Azimuth wrap test from B1 still passes.

**Done when:** `npx vitest run` passes. A small `web/src/core/demo.ts` (dev only) prints the Shackleton sentence for 2027-03-03 and the 14-day profile to the console.

### B3 — Compare and the slip index

Branch: `sky/3-slip`

Depends on A2 masks and B1 year-long files. Fetch 2027-01-01 through 2027-06-30 for the four demo sites if the shorter files are all that exist.

- `compare.ts` as in §7.8.
- `slip.ts` as in §7.9.
- Function `nextDates(index, profile, count: 3): string[]` returning ISO landing times.
- Function `betterSite(indexes, currentId, landing, profile): { siteId, sentence } | null`.

**Done when:** a vitest builds an index from a 48-step fixture (not the whole year) and finds a planted 10-step dark run. `nextDates` skips a landing that falls inside it.

### B4 — Catalog prefetch

Branch: `sky/4-catalog`

- Add the remaining sites from `DESIGN.md` §4 to `sites.json`, after a QuickMap check of each pin the demo might open. Sites nobody will click can wait.
- `fetch_horizons.py --all` loops the sites, sleeps 2 seconds between calls, and skips a file that already exists.
- Commit the JSON for every site the Screen site picker will list.

**Done when:** the picker can list the demo four plus at least the Artemis region points that were confirmed, and each listed polar site has a sun file, an earth file, and a mask file (masks come from Terrain; request them in the PR description).

---

## 11. Track Screen

The first screen is the product. Build it in the order a visitor reads it: sentence, skyline, bars, comparison. The drawer comes after M2.

### Visual rules

- Background `#101410`. Text `#f3f0e8`. Sentence 28px, weight 560, max width 38rem.
- Sun `#e0a23a`. Earth `#3c7ebf`. Green `#2f7d4a`. Amber `#b8860b`. Red `#a33b3b`. These are fills behind text, never the only signal.
- The sentence is an `h1`. Everything else is smaller.
- Buttons are words: "Show the numbers", "Hide the numbers", "Why is the south pole hard?", "See this place in QuickMap".
- Loading copy, used as written: `Asking JPL Horizons…` and `Reading the terrain…`
- Failure copy: `JPL Horizons did not answer. This place is not available right now.` and `The terrain file does not cover this place. The horizon shown is flat.`

### C1 — Shell from a fixture

Branch: `screen/1-shell`

No core imports yet. A fixture object in `ui/fixture.ts` holds the green sentence, two countdown strings, and two bar fractions.

Components, in order, all visible without scrolling on a 1280×800 laptop:

- `Header` — "Lunar Skyline", the profile select (disabled options are fine), a "Why" button that does nothing yet
- `SiteDateBar` — a `<select>` of the four sites, a date input
- `VerdictBanner` — the sentence, with a coloured rule on its left
- `CountdownRow` — "Sunset in 4 days", "Lose Earth in 9 days"
- `MissionBars` — two labelled meters, "Power" and "Talk to Earth"
- `CompareRow` — "Nobile Rim 1 stays in contact 2 days longer."
- `SourceFooter` — the credit line and two links from `links.json`, with Shackleton's coordinates filled in

**Done when:** a person who has not seen the design can read the decision without asking what any control means. Keyboard: tab reaches the select, the date, the links, and "Why".

### C2 — Skyline canvas

Branch: `screen/2-skyline`

`Skyline.tsx` draws into a canvas that is the full content width and 220px tall.

Input, from props, so it can render before the core exists:

```ts
type SkylineProps = {
  maskElDeg: number[]        // 360, or [] while loading
  sun: { azDeg: number; elDeg: number; angDiamDeg: number; frac: number }
  earth: { azDeg: number; elDeg: number; angDiamDeg: number; visible: boolean }
  sunTrack: { azDeg: number; elDeg: number; lit: boolean }[]
  earthTrack: { azDeg: number; elDeg: number; visible: boolean }[]
}
```

Drawing:

- Map azimuth 0..360 to x. Map elevation −2°..+8° to y, so a polar skyline fills the canvas. Label the axis "exaggerated" in 12px type under the canvas. This replaces a ×1/×5/×20 control, which asks the user to understand a scale.
- Fill the terrain as one polygon from the mask.
- Sun track: amber line, 2px, broken where `lit` is false. Earth track: blue, the same.
- Sun disc and Earth disc at the current sample. The Earth disc is a circle plus a shadow fraction from `illumFrac` when that value exists. If it is null, draw a solid disc.
- Hover: a single line under the canvas, "The Sun sets behind this ridge in 4 days." Compute it from the track, not from azimuth numbers. If the Sun never sets, "The Sun stays up for this landing."

**Done when:** the fixture mask (a hand-drawn bump at azimuth 90) shows a hill, and the Sun disc sits on the track. Resizing the window redraws. A screen reader gets a paragraph `SkylineSummary` that repeats the countdown sentence. The canvas is `aria-hidden`.

### C3 — Bind the core

Branch: `screen/3-bind`. Start this only after M1, so `web/src/core` and the data files are on `main`.

- `state/store.ts`:

```ts
type AppState = {
  siteId: string
  landingUtc: string
  profileId: string
  compareSiteId: string | null
  playheadUtc: string
  playing: boolean
  detailsOpen: boolean
  tourStep: number | null
  status: "ready" | "loading" | "error"
  errorMessage: string | null
}
```

- On site or date change, load `/data/horizons/<id>-sun.json`, the earth file, and `/data/masks/<id>.json`. If a file 404s, `GET /api/horizons` and `POST /api/horizon`, and set `status` to `loading` with the copy from the visual rules.
- Call `evaluateMission` and `verdict`. Put the sentence in `VerdictBanner`. Drive `Skyline`, the countdowns, and the bars from the result.
- Play: advance `playheadUtc` by 30 minutes every 100 ms of real time. Stop at the end of the mission. The Sun disc moves. The sentence does not change while playing. The sentence is about the whole mission. A small caption "3 March, 14:00 UTC" shows the playhead.
- Profile select calls `verdict` again.

**Done when:** changing the date on Shackleton changes the sentence, using real Horizons files. Apollo 11 with a flat mask produces a sentence about sunlight that a person can believe (the Sun is up for many days, or it is night, depending on the date chosen). The loading sentence appears if the dev server is started with the JSON files renamed aside and the API down. Failure copy appears. Restoring the files and refreshing recovers.

### C4 — Drawer, compare, slip

Branch: `screen/4-drawer`. After M2.

`DetailsDrawer.tsx`, closed by default. Contains, in this order:

1. `NumbersTable` for the playhead instant: Sun elevation, Sun clearance, Earth elevation, Earth clearance, illustrative watts. One decimal. Each row has a plain label: "Sun height above a flat horizon", "Sun height above the ridge".
2. The `reasons` list from the verdict.
3. "What if the launch slips?" — three sentences from `nextDates`. Clicking one sets `landingUtc`.
4. "A different place" — the `betterSite` sentence, as a button that sets `compareSiteId`.
5. Custom place: two number inputs, latitude and longitude, and "Look up this place". That calls the API and stores the result in memory, not in `sites.json`.
6. `SourceFooter` moved here as well as kept, in shorter form, under the sentence.

`CompareRow` on the first screen uses `compare()`. The select lists the other prefetched sites.

**Done when:** the first screen still fits on a laptop with the drawer closed. Opening the drawer does not change the sentence. Clicking a suggested date updates the sentence. A typed coordinate shows either a result or the failure copy.

### C5 — Tour, About, URL

Branch: `screen/5-tour`

`content/tour.json`, six steps, each `{ "title", "body", "siteId", "landingUtc" }`:

1. The Moon is barely tilted, so the Sun stays low at the pole.
2. Play the skyline. The Sun circles instead of rising high.
3. A 1 m rock throws a shadow about 38 m long when the Sun is 1.5° up. One sentence, no slider required.
4. Ridges stay bright. Crater floors stay dark. Switch the site to `shackleton-floor`.
5. Earth moves above and below the horizon. That is when the mission can talk to Earth.
6. Try a date. Read the sentence.

Copy the CSA sentences from the pages saved in Phase 0 into steps 5's body, with the URL in the sentence. If the page does not support the sentence, leave the CSA material in the About dialog only.

`AboutDialog`: the `credit` string, plus the three limitation sentences from `DESIGN.md` §6.

URL: `?site=&date=&compare=&profile=`. Read it on load, write it with `history.replaceState` when the selection changes. Do not add a router.

**Done when:** "Why is the south pole hard?" walks the six steps and the last step leaves the user on a live sentence. Pasting the URL in a second window opens the same site and date.

---

## 12. Merge gates

### M1 — files exist, screen still on fixtures

Merge A1 and B1, then C1 and C2.

Run:

```
pytest
cd web && npx vitest run && npm run dev
```

Look at the screen. It still shows the fixture sentence. The console can load a real Horizons JSON file. Masks may still be flat.

### M2 — the demo

Merge A2, A3, B2, then C3.

A person who did not write the code can:

1. Open the app. Read a sentence for Shackleton rim on 3 March 2027.
2. Change the date. Watch the sentence change.
3. Press play. Watch the Sun move along the ridge.
4. Switch to Apollo 11. Read a sentence that is obviously about a different kind of place.
5. Open QuickMap from the link and see the same crater the menu named.

This is the first time we call it a demo. If the gate is late, stop new phases and fix this list.

### M3 — the decision

Merge B3 and B4, then C4. A2 masks must already be on `main`.

Add to the M2 script:

6. Set the comparison to Nobile Rim 1. Read one sentence about the difference.
7. Open the drawer. Click a suggested date. The sentence updates.
8. Type a latitude and longitude on the polar grid. See either a skyline or the terrain failure sentence.

### M4 — submission

Merge A4 only if it is done and fast. Merge C5.

Add:

9. Walk "Why is the south pole hard?" to the end.
10. Copy the URL into another browser. The same sentence appears.
11. Open About. The credit names JPL, QuickMap, Moon Trek, and the CSA.

Then record the two-minute video from this list, deploy the web app, and deploy the API if custom sites are part of the video. The video uses the prefetched sites, so a judge can watch it with the API down.

---

## 13. Day-of checklist

Run these in order on the morning of submission. Any failure is a fix on `main`, not a new phase.

- [ ] `pytest` and `vitest` pass
- [ ] The four demo sites load with the API stopped
- [ ] Shackleton's mask has `terrainIncluded: true`
- [ ] Apollo 11's mask has `terrainIncluded: false` and the sentence still reads
- [ ] QuickMap link for Shackleton opens the crater
- [ ] The date change, the comparison, and the tour each work once
- [ ] About text matches the services actually used
- [ ] `README.md` has the run commands and the credit paragraph

---

## 14. What we will not build

- A SPICE kernel, a local ephemeris, or a "verify against Horizons" delta. The numbers are Horizons.
- A ×1 / ×5 / ×20 exaggeration toggle.
- A separate Planner mode and Explore mode.
- D3 charts, a design system, accounts, or a database.
- A 3D crater, a relay satellite, or a thermal model.
- Neighborhood cells, unless M3 is done and A4 is fast.
- More than four sites in the first screen's menu until B4.

Anyone who wants one of those writes it after M4, on a new branch, and only if the day-of checklist is already green.
