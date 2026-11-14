import { create } from "zustand";
import type { Site } from "../contract/types";
import { customSiteFromCoords } from "../ui/matchSite";
import { selectionFromSearch } from "../ui/query";

export type AppStatus = "ready" | "loading" | "error";

type AppState = {
  siteId: string;
  landingUtc: string;
  profileId: string;
  /** A typed location that is not in the catalog. */
  customSite: Site | null;
  playheadUtc: string;
  playing: boolean;
  aboutOpen: boolean;
  status: AppStatus;
  errorMessage: string | null;
  setSiteId: (siteId: string) => void;
  setLandingUtc: (landingUtc: string) => void;
  setProfileId: (profileId: string) => void;
  setCustomSite: (site: Site) => void;
  setPlayheadUtc: (playheadUtc: string) => void;
  setPlaying: (playing: boolean) => void;
  advancePlayhead: (durationHours: number) => void;
  setAboutOpen: (aboutOpen: boolean) => void;
  setStatus: (status: AppStatus, errorMessage: string | null) => void;
};

/** Horizons samples are 30 minutes apart, so the playhead never moves less than that. */
const STEP_MS = 30 * 60 * 1000;
/** Playback covers any mission length in roughly this many frames. */
const PLAYBACK_FRAMES = 400;

function initialSelection() {
  if (typeof window === "undefined") return selectionFromSearch("");
  return selectionFromSearch(window.location.search);
}

const initial = initialSelection();
const initialCustom =
  initial.latDeg !== undefined && initial.lonDegEast !== undefined
    ? customSiteFromCoords(initial.latDeg, initial.lonDegEast)
    : null;

export const useAppStore = create<AppState>((set) => ({
  siteId: initial.siteId,
  landingUtc: initial.landingUtc,
  profileId: initial.profileId,
  customSite: initialCustom,
  playheadUtc: initial.landingUtc,
  playing: false,
  aboutOpen: false,
  status: "loading",
  errorMessage: null,
  setSiteId: (siteId) => set((state) => ({ siteId, playheadUtc: state.landingUtc, playing: false })),
  setLandingUtc: (landingUtc) => set({ landingUtc, playheadUtc: landingUtc, playing: false }),
  setProfileId: (profileId) => set({ profileId, playing: false }),
  setCustomSite: (site) =>
    set((state) => ({ customSite: site, siteId: site.id, playheadUtc: state.landingUtc, playing: false })),
  setPlayheadUtc: (playheadUtc) => set({ playheadUtc }),
  setPlaying: (playing) => set({ playing }),
  setAboutOpen: (aboutOpen) => set({ aboutOpen }),
  advancePlayhead: (durationHours) =>
    set((state) => {
      const durationMs = durationHours * 3_600_000;
      const step = Math.max(STEP_MS, Math.round(durationMs / PLAYBACK_FRAMES / STEP_MS) * STEP_MS);
      const next = Date.parse(state.playheadUtc) + step;
      const end = Date.parse(state.landingUtc) + durationMs;
      if (next > end) {
        return { playing: false, playheadUtc: new Date(end).toISOString() };
      }
      return { playheadUtc: new Date(next).toISOString() };
    }),
  setStatus: (status, errorMessage) => set({ status, errorMessage }),
}));
