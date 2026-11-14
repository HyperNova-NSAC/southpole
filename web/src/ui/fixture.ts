function handDrawnMask(): number[] {
  return Array.from({ length: 360 }, (_, azimuth) => {
    if (azimuth < 70 || azimuth > 110) return 0;
    const distance = Math.abs(azimuth - 90) / 20;
    return Math.round(5 * Math.cos((distance * Math.PI) / 2) * 10) / 10;
  });
}

function round1(value: number): number {
  return Math.round(value * 10) / 10;
}

const maskElDeg = handDrawnMask();

function sunTrack() {
  const points = [];
  for (let step = 0; step < 480; step += 1) {
    const azDeg = round1(30 + step * 0.25);
    const elDeg = 3;
    const ground = maskElDeg[Math.round(azDeg) % 360];
    points.push({ azDeg, elDeg, lit: elDeg > ground });
  }
  return points;
}

function earthTrack() {
  const points = [];
  for (let azDeg = 180; azDeg <= 250; azDeg += 2) {
    const visible = azDeg < 220 || azDeg > 232;
    points.push({ azDeg, elDeg: visible ? 4.2 : 0.4, visible });
  }
  return points;
}

export const fixture = {
  sentence:
    "This landing works. The Sun is up for 12 of the 14 days. Earth is in view when you land. The longest night is 18 hours.",
  sunset: "Sunset in 4 days",
  earthset: "Lose Earth in 9 days",
  powerFraction: 12 / 14,
  earthFraction: 0.64,
  comparison: "Nobile Rim 1 stays in contact 2 days longer.",
  landingDate: "2027-03-03",
  maskElDeg,
  sun: { azDeg: 30, elDeg: 3, angDiamDeg: 0.53, frac: 1 },
  earth: { azDeg: 210, elDeg: 4.2, angDiamDeg: 1.8, visible: true, illumFrac: 0.57 },
  sunTrack: sunTrack(),
  earthTrack: earthTrack(),
};
