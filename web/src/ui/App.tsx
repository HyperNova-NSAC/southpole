import { useEffect, useMemo, useState } from "react";
import { linksSchema, profilesFileSchema, sitesFileSchema } from "../contract/schemas";
import type { HorizonMask, Instant, Links, MissionProfile, Site, Verdict, WindowMetrics } from "../contract/types";
import { EARTH_COMM_MARGIN_DEG, evaluateMission } from "../core/evaluate";
import type { SlipIndex } from "../core/slip";
import { buildVerdict } from "../core/verdict";
import { useAppStore } from "../state/store";
import { AboutDialog } from "./AboutDialog";
import { MissionTimeline } from "./charts/MissionTimeline";
import { nearestIndex } from "./charts/geometry";
import { HORIZONS_LOADING, loadMissionData } from "./loadMission";
import { LocationCard } from "./LocationCard";
import { customSiteFromCoords, matchCatalogSite } from "./matchSite";
import { indexFromTables, rememberIndex, suggestDates } from "./missionIndex";
import { CUSTOM_SITE_ID, searchFromSelection } from "./query";
import { ResultCard } from "./ResultCard";
import { summarize } from "./result";
import { SkyCard } from "./SkyCard";
import { SourceFooter } from "./SourceFooter";

/** Everything derived from one evaluated landing. */
type MissionView = {
  siteId: string;
  samples: Instant[];
  metrics: WindowMetrics;
  verdict: Verdict;
  mask: HorizonMask;
  terrainNote: string | null;
  index: SlipIndex;
};

const PLAYBACK_INTERVAL_MS = 70;

export function App() {
  const [sites, setSites] = useState<Site[]>([]);
  const [profiles, setProfiles] = useState<MissionProfile[]>([]);
  const [links, setLinks] = useState<Links | null>(null);
  const [mission, setMission] = useState<MissionView | null>(null);

  const siteId = useAppStore((state) => state.siteId);
  const landingUtc = useAppStore((state) => state.landingUtc);
  const durationHours = useAppStore((state) => state.durationHours);
  const customSite = useAppStore((state) => state.customSite);
  const playheadUtc = useAppStore((state) => state.playheadUtc);
  const playing = useAppStore((state) => state.playing);
  const aboutOpen = useAppStore((state) => state.aboutOpen);
  const status = useAppStore((state) => state.status);
  const errorMessage = useAppStore((state) => state.errorMessage);
  const {
    setSiteId,
    setLandingUtc,
    setDurationHours,
    setCustomSite,
    setPlayheadUtc,
    setPlaying,
    setAboutOpen,
  } = useAppStore.getState();

  // Static catalog, mission profiles and outbound links.
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

  const site = useMemo(
    () => (siteId === CUSTOM_SITE_ID ? customSite : sites.find((item) => item.id === siteId) ?? null),
    [siteId, customSite, sites],
  );
  // Night and Earth checks stay on the small-lander limits. Only the window length is chosen.
  const profile = useMemo(() => {
    const rules = profiles.find((item) => item.id === "small-lander") ?? profiles[0];
    return rules ? { ...rules, durationHours } : null;
  }, [profiles, durationHours]);

  /** Typed coordinates snap to a catalog site within 2 km, otherwise become a custom site. */
  function applyCoords(latDeg: number, lonDegEast: number) {
    const known = matchCatalogSite(sites, latDeg, lonDegEast);
    if (known) {
      if (known.id !== siteId) setSiteId(known.id);
      return;
    }
    const custom = customSiteFromCoords(latDeg, lonDegEast);
    if (site && custom.latDeg === site.latDeg && custom.lonDegEast === site.lonDegEast) return;
    setCustomSite(custom);
  }

  // Fall back to the default site when the URL names one we do not have.
  useEffect(() => {
    if (sites.length === 0) return;
    if (siteId === CUSTOM_SITE_ID) {
      if (!customSite) setSiteId("shackleton-rim");
      return;
    }
    if (!sites.some((item) => item.id === siteId)) setSiteId("shackleton-rim");
  }, [sites, siteId, customSite, setSiteId]);

  // Mirror the selection into the URL so any result can be shared.
  useEffect(() => {
    const custom = siteId === CUSTOM_SITE_ID ? customSite : null;
    const next = searchFromSelection({
      siteId,
      landingUtc,
      durationHours,
      latDeg: custom?.latDeg,
      lonDegEast: custom?.lonDegEast,
    });
    if (window.location.search !== next) window.history.replaceState(null, "", next);
  }, [siteId, landingUtc, durationHours, customSite]);

  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      if (event.key !== "Escape") return;
      const state = useAppStore.getState();
      if (state.aboutOpen) state.setAboutOpen(false);
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  // Load ephemerides and terrain, then evaluate the landing.
  useEffect(() => {
    if (!site || !profile) return;
    let cancelled = false;
    useAppStore.getState().setStatus("loading", HORIZONS_LOADING);
    void loadMissionData(site, landingUtc, profile.durationHours, fetch, (message) => {
      if (!cancelled) useAppStore.getState().setStatus("loading", message);
    }).then((result) => {
      if (cancelled) return;
      if (!result.ok) {
        useAppStore.getState().setStatus("error", result.message);
        return;
      }
      const { sun, earth, mask, terrainNote } = result.files;
      const evaluated = evaluateMission(sun, earth, mask, landingUtc, profile.durationHours, EARTH_COMM_MARGIN_DEG);
      const verdict = buildVerdict({
        metrics: evaluated.metrics,
        profile,
        landing: evaluated.samples[0],
        commMarginDeg: EARTH_COMM_MARGIN_DEG,
      });
      const index = indexFromTables(site.id, sun, earth, mask);
      rememberIndex(index);
      setMission({ siteId: site.id, ...evaluated, verdict, mask, terrainNote, index });
      useAppStore.getState().setStatus("ready", null);
    });
    return () => {
      cancelled = true;
    };
  }, [site, profile, landingUtc]);

  useEffect(() => {
    if (!playing || !profile) return;
    const timer = window.setInterval(
      () => useAppStore.getState().advancePlayhead(profile.durationHours),
      PLAYBACK_INTERVAL_MS,
    );
    return () => window.clearInterval(timer);
  }, [playing, profile]);

  const ready = status === "ready" && mission !== null && profile !== null;
  const samples = mission?.samples ?? [];
  const times = useMemo(() => samples.map((sample) => Date.parse(sample.t)), [samples]);
  const playheadIndex = nearestIndex(times, Date.parse(playheadUtc));
  const playhead = samples[playheadIndex] ?? null;

  const summary = ready ? summarize(mission.verdict, mission.metrics, profile, mission.samples[0]) : null;
  const nextLandings = ready ? suggestDates(mission.index, profile).filter((iso) => iso !== landingUtc) : [];

  return (
    <div className="app">
      <main className="content">
        <div className="top-grid">
          <LocationCard
            sites={sites}
            site={site}
            landingUtc={landingUtc}
            durationHours={durationHours}
            onDuration={setDurationHours}
            onCoords={applyCoords}
            onPreset={setSiteId}
            onLanding={setLandingUtc}
          />
          {ready && summary ? (
            <ResultCard
              state="ready"
              summary={summary}
              metrics={mission.metrics}
              profile={profile}
              nextLandings={nextLandings}
              terrainNote={mission.terrainNote}
              onLanding={setLandingUtc}
            />
          ) : (
            <ResultCard
              state={status === "error" ? "error" : "loading"}
              message={errorMessage ?? HORIZONS_LOADING}
            />
          )}
        </div>

        {mission ? (
          <div className={ready ? "charts" : "charts stale"}>
            <SkyCard
              mask={mission.mask}
              samples={mission.samples}
              playhead={playhead}
              playheadIndex={playheadIndex}
              playing={playing}
              onPlay={setPlaying}
              onSeek={setPlayheadUtc}
            />
            <section className="card">
              <div className="card-header">
                <div>
                  <h2>Mission timeline</h2>
                  <p className="card-subtitle">
                    Height of the Sun and Earth above the skyline. Shaded columns are nights. Click or drag to
                    scrub.
                  </p>
                </div>
              </div>
              <MissionTimeline
                samples={mission.samples}
                playheadUtc={playheadUtc}
                onSeek={(iso) => {
                  setPlaying(false);
                  setPlayheadUtc(iso);
                }}
              />
            </section>
          </div>
        ) : null}

        {links && site ? (
          <SourceFooter
            links={links}
            lat={site.latDeg}
            lon={site.lonDegEast}
            onAbout={() => setAboutOpen(true)}
          />
        ) : null}
      </main>

      {aboutOpen && links ? <AboutDialog credit={links.credit} onClose={() => setAboutOpen(false)} /> : null}
    </div>
  );
}
