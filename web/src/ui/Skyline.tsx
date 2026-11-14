import { useEffect, useRef, useState } from "react";
import { indexOnTrack, sunHoverLine } from "./skylineHover";

export type SkylineProps = {
  maskElDeg: number[];
  sun: { azDeg: number; elDeg: number; angDiamDeg: number; frac: number };
  earth: {
    azDeg: number;
    elDeg: number;
    angDiamDeg: number;
    visible: boolean;
    illumFrac?: number | null;
  };
  sunTrack: { azDeg: number; elDeg: number; lit: boolean }[];
  earthTrack: { azDeg: number; elDeg: number; visible: boolean }[];
  summary: string;
};

const EL_MIN = -2;
const EL_MAX = 8;
const TERRAIN = "#24302a";
const RIDGE = "#c8c2b4";
const SUN = "#e0a23a";
const EARTH = "#3c7ebf";
const SHADOW = "rgba(8, 12, 10, 0.88)";

export function Skyline(props: SkylineProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [hovering, setHovering] = useState(false);
  const hoverLine = sunHoverLine(
    props.sunTrack,
    indexOnTrack(props.sunTrack, props.sun.azDeg, props.sun.elDeg),
  );

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const draw = () => {
      const width = canvas.clientWidth;
      const height = canvas.clientHeight;
      if (width === 0 || height === 0) return;
      const dpr = window.devicePixelRatio || 1;
      const bitmapWidth = Math.max(1, Math.round(width * dpr));
      const bitmapHeight = Math.max(1, Math.round(height * dpr));
      if (canvas.width !== bitmapWidth || canvas.height !== bitmapHeight) {
        canvas.width = bitmapWidth;
        canvas.height = bitmapHeight;
      }
      const ctx = canvas.getContext("2d");
      if (!ctx) return;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      paint(ctx, width, height, props);
    };

    draw();
    const observer = new ResizeObserver(draw);
    observer.observe(canvas);
    return () => observer.disconnect();
  }, [props.maskElDeg, props.sun, props.earth, props.sunTrack, props.earthTrack]);

  return (
    <figure
      className="skyline"
      onMouseEnter={() => setHovering(true)}
      onMouseLeave={() => setHovering(false)}
    >
      <canvas ref={canvasRef} aria-hidden="true" />
      <div className="skyline-caption">
        <p className="skyline-axis">exaggerated</p>
        <p className="skyline-hover">{hovering ? hoverLine : ""}</p>
      </div>
      <SkylineSummary sentence={props.summary} />
    </figure>
  );
}

export function SkylineSummary({ sentence }: { sentence: string }) {
  return <p className="skyline-summary">{sentence}</p>;
}

function paint(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  props: SkylineProps,
) {
  ctx.clearRect(0, 0, width, height);
  drawTerrain(ctx, props.maskElDeg, width, height);
  strokeTrack(
    ctx,
    props.sunTrack.map((point) => ({ ...point, on: point.lit })),
    width,
    height,
    SUN,
  );
  strokeTrack(
    ctx,
    props.earthTrack.map((point) => ({ ...point, on: point.visible })),
    width,
    height,
    EARTH,
  );
  drawSun(ctx, props.sun, width, height);
  drawEarth(ctx, props.earth, width, height);
}

function drawTerrain(
  ctx: CanvasRenderingContext2D,
  mask: number[],
  width: number,
  height: number,
) {
  if (mask.length !== 360) return;
  ctx.beginPath();
  for (let azimuth = 0; azimuth <= 360; azimuth += 1) {
    const x = xOf(azimuth, width);
    const y = yOf(mask[azimuth % 360], height);
    if (azimuth === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  }
  ctx.lineTo(width, height);
  ctx.lineTo(0, height);
  ctx.closePath();
  ctx.fillStyle = TERRAIN;
  ctx.fill();

  ctx.beginPath();
  for (let azimuth = 0; azimuth <= 360; azimuth += 1) {
    const x = xOf(azimuth, width);
    const y = yOf(mask[azimuth % 360], height);
    if (azimuth === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  }
  ctx.strokeStyle = RIDGE;
  ctx.lineWidth = 1.5;
  ctx.stroke();
}

function strokeTrack(
  ctx: CanvasRenderingContext2D,
  points: { azDeg: number; elDeg: number; on: boolean }[],
  width: number,
  height: number,
  color: string,
) {
  ctx.strokeStyle = color;
  ctx.lineWidth = 2;
  ctx.lineJoin = "round";
  ctx.lineCap = "butt";
  let run: { x: number; y: number }[] = [];

  const flush = () => {
    if (run.length >= 2) {
      ctx.beginPath();
      run.forEach((point, index) => {
        if (index === 0) ctx.moveTo(point.x, point.y);
        else ctx.lineTo(point.x, point.y);
      });
      ctx.stroke();
    }
    run = [];
  };

  points.forEach((point, index) => {
    if (!point.on) {
      flush();
      return;
    }
    const previous = points[index - 1];
    if (previous && run.length > 0) {
      const turn = Math.abs(point.azDeg - previous.azDeg);
      if (Math.min(turn, 360 - turn) > 30) flush();
    }
    run.push({ x: xOf(point.azDeg, width), y: yOf(point.elDeg, height) });
  });
  flush();
}

function drawSun(
  ctx: CanvasRenderingContext2D,
  sun: SkylineProps["sun"],
  width: number,
  height: number,
) {
  const x = xOf(sun.azDeg, width);
  const y = yOf(sun.elDeg, height);
  const radius = radiusOf(sun.angDiamDeg, height);
  const visible = Math.min(1, Math.max(0, sun.frac));
  ctx.save();
  ctx.beginPath();
  ctx.rect(x - radius - 1, y - radius - 1, radius * 2 + 2, radius * 2 * visible + 1);
  ctx.clip();
  ctx.beginPath();
  ctx.arc(x, y, radius, 0, Math.PI * 2);
  ctx.fillStyle = SUN;
  ctx.fill();
  ctx.restore();
}

function drawEarth(
  ctx: CanvasRenderingContext2D,
  earth: SkylineProps["earth"],
  width: number,
  height: number,
) {
  const x = xOf(earth.azDeg, width);
  const y = yOf(earth.elDeg, height);
  const radius = radiusOf(earth.angDiamDeg, height);
  ctx.save();
  ctx.globalAlpha = earth.visible ? 1 : 0.4;
  ctx.beginPath();
  ctx.arc(x, y, radius, 0, Math.PI * 2);
  ctx.fillStyle = EARTH;
  ctx.fill();
  const illum = earth.illumFrac;
  if (illum !== null && illum !== undefined && illum < 1) {
    const fraction = Math.min(1, Math.max(0, illum));
    ctx.beginPath();
    ctx.arc(x, y, radius, 0, Math.PI * 2);
    ctx.clip();
    const shadow = (1 - fraction) * radius * 2;
    ctx.fillStyle = SHADOW;
    ctx.fillRect(x + radius - shadow, y - radius - 1, shadow + 1, radius * 2 + 2);
  }
  ctx.restore();
}

function xOf(azimuth: number, width: number): number {
  if (azimuth === 360) return width;
  const wrapped = ((azimuth % 360) + 360) % 360;
  return (wrapped / 360) * width;
}

function yOf(elevation: number, height: number): number {
  const scaled = (elevation - EL_MIN) / (EL_MAX - EL_MIN);
  return height - scaled * height;
}

function radiusOf(diameterDeg: number, height: number): number {
  return (diameterDeg / 2) * (height / (EL_MAX - EL_MIN));
}
