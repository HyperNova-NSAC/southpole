import { useEffect, useState } from "react";
import { linksSchema, profilesFileSchema, sitesFileSchema } from "../contract/schemas";
import type { HorizonMask, Instant, Links, MissionProfile, Site, Verdict, WindowMetrics } from "../contract/types";
import { EARTH_COMM_MARGIN_DEG, SUNLIT_THRESHOLD, evaluateMission } from "../core/evaluate";
import { buildVerdict } from "../core/verdict";
import { useAppStore } from "../state/store";
import { CountdownRow } from "./CountdownRow";
import { Header } from "./Header";
import { MissionBars } from "./MissionBars";
import { SiteDateBar } from "./SiteDateBar";
import { Skyline } from "./Skyline";
import { SourceFooter } from "./SourceFooter";
import { VerdictBanner } from "./VerdictBanner";
import { loadMissionData } from "./loadMission";
import { earthsetLine, instantAt, playheadCaption, sunsetLine } from "./present";

type MissionView = {
  samples: Instant[];
  metrics: WindowMetrics;
  verdict: Verdict;
  mask: HorizonMask;
  terrainNote: string | null;
};

const EMPTY_SUN = { azDeg: 0, elDeg: 0, angDiamDeg: 0.5, frac: 0 };

export function App() {
  const [sites, setSites] = useState<Site[]>([]);
  const [profiles, setProfiles] = useState<MissionProfile[]>([]);
  const [links, setLinks] = useState<Links | null>(null);
  const [mission, setMission] = useState<MissionView | null>(null);

  const siteId = useAppStore((state) => state.siteId);
  const landingUtc = useAppStore((state) => state.landingUtc);
  const profileId = useAppStore((state) => state.profileId);
  const playheadUtc = useAppStore((state) => state.playheadUtc);
  const playing = useAppStore((state) => state.playing);
  const status = useAppStore((state) => state.status);
  const errorMessage = useAppStore((state) => state.errorMessage);
  const setSiteId = useAppStore((state) => state.setSiteId);
  const setLandingDate = useAppStore((state) => state.setLandingDate);
  const setProfileId = useAppStore((state) => state.setProfileId);
  const setPlaying = useAppStore((state) => state.setPlaying);

  useEffect(() => {
    void Promise.all([
      fetch("/data/sites.json").then((response) => response.json()),
      fetch("/data/profiles.json").then((response) => response.json()),
      fetch("/data/links.json").then((response) => response.json()),
    ]).then(([sitesFile, profilesFile, linksFile]) => {
      setSites(sitesFileSchema.parse(sitesFile).sites);
      setProfiles(profilesFileSchema.parse(profilesFile).profiles);
      setLinks(linksSchema.parse(linksFile));
    });
  }, []);

  const site = sites.find((item) => item.id === siteId) ?? null;
  const profile = profiles.find((item) => item.id === profileId) ?? null;

  useEffect(() => {
    if (!site || !profile) return;
    let cancelled = false;
    setMission(null);
    void loadMissionData(site, landingUtc, profile.durationHours, fetch, (message) => {
      if (!cancelled) useAppStore.getState().setStatus("loading", message);
    }).then((result) => {
      if (cancelled) return;
      if (!result.ok) {
        useAppStore.getState().setStatus("error", result.message);
        return;
      }
      const evaluated = evaluateMission(
        result.files.sun,
        result.files.earth,
        result.files.mask,
        landingUtc,
        profile.durationHours,
        EARTH_COMM_MARGIN_DEG,
      );
      const verdict = buildVerdict({
        metrics: evaluated.metrics,
        profile,
        landing: evaluated.samples[0],
        commMarginDeg: EARTH_COMM_MARGIN_DEG,
      });
      setMission({
        samples: evaluated.samples,
        metrics: evaluated.metrics,
        verdict,
        mask: result.files.mask,
        terrainNote: result.files.terrainNote,
      });
      useAppStore.getState().setStatus("ready", null);
    });
    return () => {
      cancelled = true;
    };
  }, [site, profile, landingUtc]);

  useEffect(() => {
    if (!playing || !profile) return;
    const timer = window.setInterval(() => {
      useAppStore.getState().advancePlayhead(profile.durationHours);
    }, 100);
    return () => window.clearInterval(timer);
  }, [playing, profile]);

  const landingDate = landingUtc.slice(0, 10);
  const ready = status === "ready" && mission !== null;
  const sentence = ready ? mission.verdict.sentence : (errorMessage ?? "Asking JPL Horizons…");
  const sunset = ready ? sunsetLine(mission.metrics.sunsetInHours) : "";
  const earthset = ready ? earthsetLine(mission.metrics.earthsetInHours) : "";
  const playhead = ready ? instantAt(mission.samples, playheadUtc) : null;
  const sunTrack = mission
    ? mission.samples.map((sample) => ({
        azDeg: sample.sunAzDeg,
        elDeg: sample.sunElDeg,
        lit: sample.sunFrac >= SUNLIT_THRESHOLD,
      }))
    : [];
  const earthTrack = mission
    ? mission.samples.map((sample) => ({
        azDeg: sample.earthAzDeg,
        elDeg: sample.earthElDeg,
        visible: sample.earthVisible,
      }))
    : [];

  return (
    <main className="app">
      <Header
        profiles={profiles}
        profileId={profileId}
        onProfile={setProfileId}
      />
      {site ? (
        <SiteDateBar
          sites={sites}
          siteId={site.id}
          landingDate={landingDate}
          onSite={setSiteId}
          onDate={setLandingDate}
        />
      ) : (
        <p>Loading places…</p>
      )}
      <VerdictBanner
        sentence={sentence}
        tone={ready ? mission.verdict.light : undefined}
        note={ready ? mission.terrainNote : null}
      />
      <Skyline
        maskElDeg={mission?.mask.maskElDeg ?? []}
        sun={
          playhead
            ? {
                azDeg: playhead.sunAzDeg,
                elDeg: playhead.sunElDeg,
                angDiamDeg: playhead.sunAngDiamDeg,
                frac: playhead.sunFrac,
              }
            : EMPTY_SUN
        }
        earth={{
          azDeg: playhead?.earthAzDeg ?? 0,
          elDeg: playhead?.earthElDeg ?? 0,
          angDiamDeg: playhead?.earthAngDiamDeg ?? 1.8,
          visible: playhead?.earthVisible ?? false,
          illumFrac: playhead?.earthIllumFrac ?? null,
        }}
        sunTrack={sunTrack}
        earthTrack={earthTrack}
        summary={ready ? `${sunset} ${earthset}` : sentence}
      />
      <CountdownRow
        sunset={sunset}
        earthset={earthset}
        playing={playing}
        caption={ready ? playheadCaption(playheadUtc) : ""}
        onTogglePlay={() => setPlaying(!playing)}
        playDisabled={!ready}
      />
      <MissionBars
        powerFraction={ready ? mission.metrics.sunlitFraction : 0}
        earthFraction={ready ? mission.metrics.earthFraction : 0}
        durationHours={profile?.durationHours ?? 336}
      />
      {links && site ? <SourceFooter links={links} lat={site.latDeg} lon={site.lonDegEast} /> : null}
    </main>
  );
}
