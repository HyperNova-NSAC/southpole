import type { Links } from "../contract/types";

type SourceFooterProps = {
  links: Links;
  lat: number;
  lon: number;
};

const MOON_RADIUS_M = 1_737_400;
const HALF_EXTENT_M = 45_000;

function southPolarStereo(latDeg: number, lonDeg: number): { x: number; y: number } {
  const lat = (latDeg * Math.PI) / 180;
  const lon = (lonDeg * Math.PI) / 180;
  const rho = 2 * MOON_RADIUS_M * Math.tan(Math.PI / 4 + lat / 2);
  return { x: rho * Math.sin(lon), y: rho * Math.cos(lon) };
}

function meters(value: number): string {
  return value.toFixed(4);
}

function fill(template: string, lat: number, lon: number, zoom: number): string {
  const { x, y } = southPolarStereo(lat, lon);
  const westDeg = lon - zoom;
  const eastDeg = lon + zoom;
  const southDeg = Math.max(-90, lat - zoom);
  const northDeg = Math.min(90, lat + zoom);
  return template
    .replaceAll("{lat}", String(lat))
    .replaceAll("{lon}", String(lon))
    .replaceAll("{zoom}", String(zoom))
    .replaceAll("{west}", meters(x - HALF_EXTENT_M))
    .replaceAll("{south}", meters(y - HALF_EXTENT_M))
    .replaceAll("{east}", meters(x + HALF_EXTENT_M))
    .replaceAll("{north}", meters(y + HALF_EXTENT_M))
    .replaceAll("{westDeg}", String(westDeg))
    .replaceAll("{southDeg}", String(southDeg))
    .replaceAll("{eastDeg}", String(eastDeg))
    .replaceAll("{northDeg}", String(northDeg));
}

export function SourceFooter({ links, lat, lon }: SourceFooterProps) {
  const zoom = 1;
  return (
    <footer className="footer">
      <p>{links.credit}</p>
      <a href={fill(links.quickmap, lat, lon, zoom)}>See this place in QuickMap</a>
      <a href={fill(links.moontrek, lat, lon, zoom)}>See this place in Moon Trek</a>
    </footer>
  );
}
