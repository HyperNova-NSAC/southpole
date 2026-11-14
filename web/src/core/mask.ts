import type { HorizonMask } from "../contract/types";

// Skyline elevation for an azimuth: the mask holds 360 entries, index = azimuth in degrees.
export function skylineEl(mask: HorizonMask, azDeg: number): number {
  const i = Math.round(azDeg / mask.azStepDeg) % mask.maskElDeg.length;
  return mask.maskElDeg[i];
}

// Clearance is the body elevation minus the skyline elevation in that direction.
export function clearance(elDeg: number, skyline: number): number {
  return elDeg - skyline;
}

// Fraction of the disc above the skyline: five vertical slices, disc half-angle scaled by radius.
export function discFraction(elDeg: number, angDiamDeg: number, skyline: number): number {
  const radius = angDiamDeg / 2;
  const samples = [-1, -0.5, 0, 0.5, 1].map((k) => elDeg + k * radius);
  const above = samples.filter((e) => e > skyline).length;
  return above / 5;
}
