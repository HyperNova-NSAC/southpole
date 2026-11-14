import type { Instant } from "../../contract/types";
import { SUNLIT_THRESHOLD } from "../../core/evaluate";
import type { TrackPoint } from "./geometry";

/** Sun positions over the mission; `on` means at least half the disc clears the skyline. */
export function sunTrack(samples: Instant[]): TrackPoint[] {
  return samples.map((s) => ({ azDeg: s.sunAzDeg, elDeg: s.sunElDeg, on: s.sunFrac >= SUNLIT_THRESHOLD }));
}

/** Earth positions over the mission; `on` means Earth is in radio view. */
export function earthTrack(samples: Instant[]): TrackPoint[] {
  return samples.map((s) => ({ azDeg: s.earthAzDeg, elDeg: s.earthElDeg, on: s.earthVisible }));
}
