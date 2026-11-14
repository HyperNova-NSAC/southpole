import { create } from "zustand";

export type AppStatus = "ready" | "loading" | "error";

type AppState = {
  siteId: string;
  landingUtc: string;
  profileId: string;
  compareSiteId: string | null;
  playheadUtc: string;
  playing: boolean;
  detailsOpen: boolean;
  tourStep: number | null;
  status: AppStatus;
  errorMessage: string | null;
  setSiteId: (siteId: string) => void;
  setLandingDate: (date: string) => void;
  setProfileId: (profileId: string) => void;
  setPlaying: (playing: boolean) => void;
  advancePlayhead: (durationHours: number) => void;
  setStatus: (status: AppStatus, errorMessage: string | null) => void;
};

const STEP_MS = 30 * 60 * 1000;

function landingFromDate(date: string): string {
  return `${date}T00:00:00Z`;
}

export const useAppStore = create<AppState>((set) => ({
  siteId: "shackleton-rim",
  landingUtc: "2027-03-03T00:00:00Z",
  profileId: "small-lander",
  compareSiteId: "nobile-rim-1",
  playheadUtc: "2027-03-03T00:00:00Z",
  playing: false,
  detailsOpen: false,
  tourStep: null,
  status: "loading",
  errorMessage: null,
  setSiteId: (siteId) =>
    set((state) => ({
      siteId,
      playheadUtc: state.landingUtc,
      playing: false,
    })),
  setLandingDate: (date) => {
    const landingUtc = landingFromDate(date);
    set({ landingUtc, playheadUtc: landingUtc, playing: false });
  },
  setProfileId: (profileId) => set({ profileId, playing: false }),
  setPlaying: (playing) => set({ playing }),
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
