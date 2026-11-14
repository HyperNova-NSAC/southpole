/** Horizons tables are sampled every 30 minutes. The skyline track uses that step. */
export const TRACK_STEP_MIN = 30;

export function indexOnTrack(
  track: { azDeg: number; elDeg: number }[],
  azDeg: number,
  elDeg: number,
): number {
  let best = 0;
  let bestDistance = Infinity;
  track.forEach((point, index) => {
    const turn = Math.abs(point.azDeg - azDeg);
    const azimuth = Math.min(turn, 360 - turn);
    const distance = azimuth * azimuth + (point.elDeg - elDeg) ** 2;
    if (distance < bestDistance) {
      bestDistance = distance;
      best = index;
    }
  });
  return best;
}

export function sunHoverLine(track: { lit: boolean }[], fromIndex: number): string {
  const setAt = track.slice(fromIndex).findIndex((point) => !point.lit);
  if (setAt < 0) return "The Sun stays up for this landing.";
  if (setAt === 0) return "The Sun is down.";
  const days = Math.round((setAt * TRACK_STEP_MIN) / (60 * 24));
  const count = Math.max(1, days);
  const unit = count === 1 ? "day" : "days";
  return `The Sun sets behind this ridge in ${count} ${unit}.`;
}
