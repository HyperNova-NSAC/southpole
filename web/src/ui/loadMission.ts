import { horizonMaskSchema, horizonsTableSchema } from "../contract/schemas";
import type { HorizonMask, HorizonsTable, Site } from "../contract/types";

export const HORIZONS_LOADING = "Asking JPL Horizons…";
export const TERRAIN_LOADING = "Reading the terrain…";
export const HORIZONS_FAILURE =
  "JPL Horizons did not answer. This place is not available right now.";
export const TERRAIN_FAILURE =
  "The terrain file does not cover this place. The horizon shown is flat.";

export type MissionFiles = {
  sun: HorizonsTable;
  earth: HorizonsTable;
  mask: HorizonMask;
  terrainNote: string | null;
};

export type LoadResult = { ok: true; files: MissionFiles } | { ok: false; message: string };

export function horizonsWindow(
  landingUtc: string,
  durationHours: number,
): { start: string; stop: string; startMs: number; stopMs: number } {
  const startMs = Date.parse(landingUtc);
  const stopMs = startMs + durationHours * 3_600_000;
  return { start: horizonsStamp(startMs), stop: horizonsStamp(stopMs), startMs, stopMs };
}

export async function loadMissionData(
  site: Site,
  landingUtc: string,
  durationHours: number,
  fetchImpl: typeof fetch = fetch,
  onStatus?: (message: string) => void,
): Promise<LoadResult> {
  onStatus?.(HORIZONS_LOADING);
  const window = horizonsWindow(landingUtc, durationHours);
  const sun = await loadTable(fetchImpl, site, "sun", window);
  const earth = await loadTable(fetchImpl, site, "earth", window);
  if (!sun || !earth) return { ok: false, message: HORIZONS_FAILURE };

  onStatus?.(TERRAIN_LOADING);
  const mask = await loadMask(fetchImpl, site);
  if (mask) return { ok: true, files: { sun, earth, mask, terrainNote: null } };
  return {
    ok: true,
    files: { sun, earth, mask: flatMask(site), terrainNote: TERRAIN_FAILURE },
  };
}

async function loadTable(
  fetchImpl: typeof fetch,
  site: Site,
  body: "sun" | "earth",
  window: { start: string; stop: string; startMs: number; stopMs: number },
): Promise<HorizonsTable | null> {
  const file = await readJson(fetchImpl, `/data/horizons/${site.id}-${body}.json`);
  const parsedFile = parseTable(file);
  if (parsedFile && tableCovers(parsedFile, window.startMs, window.stopMs)) return parsedFile;

  const params = new URLSearchParams({
    siteId: site.id,
    lat: String(site.latDeg),
    lon: String(site.lonDegEast),
    altKm: String(site.heightM / 1000),
    body,
    start: window.start,
    stop: window.stop,
  });
  const live = await readJson(fetchImpl, `/api/horizons?${params.toString()}`);
  return parseTable(live);
}

async function loadMask(fetchImpl: typeof fetch, site: Site): Promise<HorizonMask | null> {
  const file = await readJson(fetchImpl, `/data/masks/${site.id}.json`);
  const parsedFile = parseMask(file);
  if (parsedFile) return parsedFile;

  try {
    const response = await fetchImpl("/api/horizon", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        siteId: site.id,
        latDeg: site.latDeg,
        lonDegEast: site.lonDegEast,
        mastM: 2,
      }),
    });
    const type = response.headers.get("content-type") ?? "";
    if (!response.ok || !type.includes("json")) return null;
    return parseMask(await response.json());
  } catch {
    return null;
  }
}

function tableCovers(table: HorizonsTable, startMs: number, stopMs: number): boolean {
  const samples = table.samples;
  if (samples.length === 0) return false;
  const first = Date.parse(samples[0].t);
  const last = Date.parse(samples[samples.length - 1].t);
  return first <= startMs + 1000 && last + 1000 >= stopMs;
}

function parseTable(value: unknown): HorizonsTable | null {
  const parsed = horizonsTableSchema.safeParse(value);
  return parsed.success ? parsed.data : null;
}

function parseMask(value: unknown): HorizonMask | null {
  const parsed = horizonMaskSchema.safeParse(value);
  return parsed.success ? parsed.data : null;
}

async function readJson(fetchImpl: typeof fetch, url: string): Promise<unknown | null> {
  try {
    const response = await fetchImpl(url);
    const type = response.headers.get("content-type") ?? "";
    if (!response.ok || !type.includes("json")) return null;
    return await response.json();
  } catch {
    return null;
  }
}

function flatMask(site: Site): HorizonMask {
  return {
    siteId: site.id,
    latDeg: site.latDeg,
    lonDegEast: site.lonDegEast,
    mastM: 2,
    azStepDeg: 1,
    maskElDeg: Array.from({ length: 360 }, () => 0),
    heightM: site.heightM,
    demSource: "flat",
    terrainIncluded: false,
  };
}

function horizonsStamp(ms: number): string {
  const date = new Date(ms);
  const pad = (value: number) => String(value).padStart(2, "0");
  return (
    `${date.getUTCFullYear()}-${pad(date.getUTCMonth() + 1)}-${pad(date.getUTCDate())}` +
    ` T${pad(date.getUTCHours())}:${pad(date.getUTCMinutes())}`
  );
}
