import { create } from "zustand";
import type { Site } from "../contract/types";
import { selectionFromSearch } from "../ui/query";

export type AppStatus = "ready" | "loading" | "error";

type AppState = {
  siteId: string;
  landingUtc: string;
  profileId: string;
  compareSiteId: string | null;
  customSite: Site | null;
  playheadUtc: string;
  playing: boolean;
  detailsOpen: boolean;
  tourStep: number | null;
  aboutOpen: boolean;
  status: AppStatus;
  errorMessage: string | null;
  setSiteId: (siteId: string) => void;
  setLandingDate: (date: string) => void;
  setLandingUtc: (landingUtc: string) => void;
  setProfileId: (profileId: string) => void;
  setCompareSiteId: (compareSiteId: string) => void;
  setCustomSite: (site: Site) => void;
  setPlaying: (playing: boolean) => void;
  advancePlayhead: (durationHours: number) => void;
  setDetailsOpen: (detailsOpen: boolean) => void;
  setTourStep: (tourStep: number | null) => void;
  setAboutOpen: (aboutOpen: boolean) => void;
  setStatus: (status: AppStatus, errorMessage: string | null) => void;
};

const STEP_MS = 30 * 60 * 1000;

function landingFromDate(date: string): string {
  return `${date}T00:00:00Z`;
}

function initialSelection() {
  if (typeof window === "undefined") return selectionFromSearch("");
  return selectionFromSearch(window.location.search);
}

const initial = initialSelection();

export const useAppStore = create<AppState>((set) => ({
  siteId: initial.siteId,
  landingUtc: initial.landingUtc,
  profileId: initial.profileId,
  compareSiteId: initial.compareSiteId,
  customSite: null,
  playheadUtc: initial.landingUtc,
  playing: false,
  detailsOpen: false,
  tourStep: null,
  aboutOpen: false,
  status: "loading",
  errorMessage: null,
  setSiteId: (siteId) =>
    set((state) => ({
      siteId,
      playheadUtc: state.landingUtc,
      playing: false,
      compareSiteId:
        state.compareSiteId === siteId
          ? siteId === "nobile-rim-1"
            ? "shackleton-rim"
            : "nobile-rim-1"
          : state.compareSiteId,
    })),
  setLandingDate: (date) => {
    const landingUtc = landingFromDate(date);
    set({ landingUtc, playheadUtc: landingUtc, playing: false });
  },
  setLandingUtc: (landingUtc) => set({ landingUtc, playheadUtc: landingUtc, playing: false }),
  setProfileId: (profileId) => set({ profileId, playing: false }),
  setCompareSiteId: (compareSiteId) => set({ compareSiteId }),
  setCustomSite: (site) => set({ customSite: site, siteId: site.id, playing: false }),
  setPlaying: (playing) => set({ playing }),
  setDetailsOpen: (detailsOpen) => set({ detailsOpen }),
  setTourStep: (tourStep) => set({ tourStep }),
  setAboutOpen: (aboutOpen) => set({ aboutOpen }),
  advancePlayhead: (durationHours) =>
    set((state) => {
      const next = Date.parse(state.playheadUtc) + STEP_MS;
      const end = Date.parse(state.landingUtc) + durationHours * 3_600_000;
      if (next > end) {
        return { playing: false, playheadUtc: new Date(end).toISOString() };
      }
      return { playheadUtc: new Date(next).toISOString() };
    }),
  setStatus: (status, errorMessage) => set({ status, errorMessage }),
}));
