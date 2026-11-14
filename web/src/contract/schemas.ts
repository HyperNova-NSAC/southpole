import { z } from "zod";

export const siteSchema = z.object({
  id: z.string(),
  name: z.string(),
  latDeg: z.number(),
  lonDegEast: z.number(),
  heightM: z.number(),
  category: z.enum(["apollo", "international", "clps", "artemis", "polar", "csa"]),
  agency: z.string(),
  notes: z.string(),
  sourceUrl: z.string(),
});

export const sitesFileSchema = z.object({
  sites: z.array(siteSchema),
});

export const horizonsSampleSchema = z.object({
  t: z.string(),
  azDeg: z.number(),
  elDeg: z.number(),
  angDiamDeg: z.number(),
  illumFrac: z.number().nullable(),
});

export const horizonsTableSchema = z.object({
  body: z.enum(["sun", "earth"]),
  siteId: z.string(),
  latDeg: z.number(),
  lonDegEast: z.number(),
  altKm: z.number(),
  stepMin: z.literal(30),
  queriedAt: z.string(),
  queryUrl: z.string(),
  source: z.literal("JPL Horizons"),
  samples: z.array(horizonsSampleSchema),
});

export const horizonMaskSchema = z.object({
  siteId: z.string(),
  latDeg: z.number(),
  lonDegEast: z.number(),
  mastM: z.number(),
  azStepDeg: z.literal(1),
  maskElDeg: z.array(z.number()),
  heightM: z.number(),
  demSource: z.string(),
  terrainIncluded: z.boolean(),
});

export const missionProfileSchema = z.object({
  id: z.string(),
  label: z.string(),
  durationHours: z.number(),
  earthRequiredAtLanding: z.boolean(),
  maxLongestDarkHours: z.number().nullable(),
  illustrative: z.boolean(),
});

export const profilesFileSchema = z.object({
  profiles: z.array(missionProfileSchema),
});

export const linksSchema = z.object({
  quickmap: z.string(),
  moontrek: z.string(),
  credit: z.string(),
});
