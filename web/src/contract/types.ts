export type SiteCategory =
  | "apollo"
  | "international"
  | "clps"
  | "artemis"
  | "polar";

export type Site = {
  id: string;
  name: string;
  latDeg: number;
  lonDegEast: number;
  heightM: number;
  category: SiteCategory;
  agency: string;
  notes: string;
  sourceUrl: string;
};

export type HorizonsSample = {
  t: string;
  azDeg: number;
  elDeg: number;
  angDiamDeg: number;
  illumFrac: number | null;
};

export type HorizonsTable = {
  body: "sun" | "earth";
  siteId: string;
  latDeg: number;
  lonDegEast: number;
  altKm: number;
  stepMin: 30;
  queriedAt: string;
  queryUrl: string;
  source: "JPL Horizons";
  samples: HorizonsSample[];
};

export type HorizonMask = {
  siteId: string;
  latDeg: number;
  lonDegEast: number;
  mastM: number;
  azStepDeg: 1;
  maskElDeg: number[];
  heightM: number;
  demSource: string;
  terrainIncluded: boolean;
};

export type MissionProfile = {
  id: string;
  label: string;
  durationHours: number;
  earthRequiredAtLanding: boolean;
  maxLongestDarkHours: number | null;
  illustrative: boolean;
};

export type Instant = {
  t: string;
  sunAzDeg: number;
  sunElDeg: number;
  sunAngDiamDeg: number;
  sunClearanceDeg: number;
  sunFrac: number;
  earthAzDeg: number;
  earthElDeg: number;
  earthAngDiamDeg: number;
  earthIllumFrac: number | null;
  earthClearanceDeg: number;
  earthVisible: boolean;
  powerWm2: number;
};

export type WindowMetrics = {
  sunlitFraction: number;
  earthFraction: number;
  bothFraction: number;
  longestDarkHours: number;
  longestCommGapHours: number;
  sunsetInHours: number | null;
  earthsetInHours: number | null;
  litAtLanding: boolean;
  earthAtLanding: boolean;
  transitionCount: number;
};

export type Verdict = {
  light: "green" | "amber" | "red";
  sentence: string;
  reasons: string[];
};

export type Comparison = {
  otherSiteId: string;
  sentence: string;
};

export type Links = {
  quickmap: string;
  moontrek: string;
  credit: string;
};
