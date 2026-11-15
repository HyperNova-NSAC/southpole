import { useEffect, useMemo, useState } from "react";
import { linksSchema, profilesFileSchema, sitesFileSchema } from "../contract/schemas";
import type { Links, MissionProfile, Site } from "../contract/types";
import { EARTH_COMM_MARGIN_DEG } from "../core/evaluate";
import { buildVerdict } from "../core/verdict";
import { useAppStore } from "../state/store";
import { AboutDialog } from "./AboutDialog";
import { MissionTimeline } from "./charts/MissionTimeline";
import { nearestIndex } from "./charts/geometry";
import { CompareDialog } from "./CompareDialog";
import { HORIZONS_LOADING } from "./loadMission";
import { LocationCard } from "./LocationCard";
import { customSiteFromCoords, matchCatalogSite } from "./matchSite";
import { suggestDates } from "./missionIndex";
import { CUSTOM_SITE_ID, searchFromSelection } from "./query";
import type { Scenario } from "./scenarios";
import { useScenarioLoad } from "./useScenarioLoad";
import { ResultCard } from "./ResultCard";
import { summarize } from "./result";
import { SkyCard } from "./SkyCard";
import { SourceFooter } from "./SourceFooter";

const PLAYBACK_INTERVAL_MS = 70;

export function App() {
  const [sites, setSites] = useState<Site[]>([]);
  const [profiles, setProfiles] = useState<MissionProfile[]>([]);
  const [links, setLinks] = useState<Links | null>(null);
  const [compareOpen, setCompareOpen] = useState(false);

  const siteId = useAppStore((state) => state.siteId);
  const landingUtc = useAppStore((state) => state.landingUtc);
  const durationHours = useAppStore((state) => state.durationHours);
  const maxNightHours = useAppStore((state) => state.maxNightHours);
  const customSite = useAppStore((state) => state.customSite);
  const playheadUtc = useAppStore((state) => state.playheadUtc);
  const playing = useAppStore((state) => state.playing);
  const aboutOpen = useAppStore((state) => state.aboutOpen);
  const {
    setSiteId,
    setLandingUtc,
    setDurationHours,
    setMaxNightHours,
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
  // Earth must be in view at touchdown. The night limit is chosen on the page.
  const profile = useMemo(() => {
    const rules = profiles.find((item) => item.id === "small-lander") ?? profiles[0];
    return rules ? { ...rules, durationHours, maxLongestDarkHours: maxNightHours } : null;
  }, [profiles, durationHours, maxNightHours]);

  const currentScenario = useMemo<Scenario>(() => {
    const scenario: Scenario = {
      id: "current",
      siteId,
      landingUtc,
      durationHours,
      maxNightHours,
    };
    if (siteId === CUSTOM_SITE_ID && customSite) {
      scenario.latDeg = customSite.latDeg;
      scenario.lonDegEast = customSite.lonDegEast;
    }
    return scenario;
  }, [siteId, landingUtc, durationHours, maxNightHours, customSite]);
  const activeLoad = useScenarioLoad(currentScenario, sites, profiles);

  /** Show one compared landing as the page, including its sky and timeline. */
  function useScenario(scenario: Scenario) {
    setDurationHours(scenario.durationHours);
    setMaxNightHours(scenario.maxNightHours);
    if (scenario.siteId === CUSTOM_SITE_ID && scenario.latDeg !== undefined && scenario.lonDegEast !== undefined) {
      setCustomSite(customSiteFromCoords(scenario.latDeg, scenario.lonDegEast));
    } else if (scenario.siteId !== siteId) {
      setSiteId(scenario.siteId);
    }
    if (scenario.landingUtc !== landingUtc) setLandingUtc(scenario.landingUtc);
    setCompareOpen(false);
  }

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
      maxNightHours,
      latDeg: custom?.latDeg,
      lonDegEast: custom?.lonDegEast,
    });
    if (window.location.search !== next) window.history.replaceState(null, "", next);
  }, [siteId, landingUtc, durationHours, maxNightHours, customSite]);

  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      if (event.key !== "Escape") return;
      const state = useAppStore.getState();
      if (state.aboutOpen) state.setAboutOpen(false);
      setCompareOpen(false);
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  useEffect(() => {
    if (!playing) return;
    const timer = window.setInterval(
      () => useAppStore.getState().advancePlayhead(useAppStore.getState().durationHours),
      PLAYBACK_INTERVAL_MS,
    );
    return () => window.clearInterval(timer);
  }, [playing, durationHours]);

  const mission = activeLoad.mission;
  const ready = activeLoad.status === "ready" && mission !== null && profile !== null;
  const samples = mission?.samples ?? [];
  const times = useMemo(() => samples.map((sample) => Date.parse(sample.t)), [samples]);
  const playheadIndex = nearestIndex(times, Date.parse(playheadUtc));
  const playhead = samples[playheadIndex] ?? null;

  const summary = useMemo(() => {
    if (!mission || !profile || mission.samples.length === 0) return null;
    const verdict = buildVerdict({
      metrics: mission.metrics,
      profile,
      landing: mission.samples[0],
      commMarginDeg: EARTH_COMM_MARGIN_DEG,
    });
    return summarize(verdict, mission.metrics, profile, mission.samples[0]);
  }, [mission, profile]);
  const nextLandings = ready && mission ? suggestDates(mission.index, profile).filter((iso) => iso !== landingUtc) : [];

  return (
    <div className="app">
      <header className="app-nav">
        <a className="app-brand" href="/">
          <img src="/favicon.svg" alt="" width={26} height={26} />
          Lunar Skyline
        </a>
        <a className="app-nav-link" href="/">
          Home
        </a>
      </header>
      <main className="content">
        <div className="top-grid">
          <LocationCard
            sites={sites}
            site={site}
            landingUtc={landingUtc}
            durationHours={durationHours}
            maxNightHours={maxNightHours}
            onDuration={setDurationHours}
            onNightLimit={setMaxNightHours}
            onCoords={applyCoords}
            onPreset={setSiteId}
            onLanding={setLandingUtc}
            onCompare={() => setCompareOpen(true)}
          />
          {ready && summary && mission ? (
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
              state={activeLoad.status === "error" ? "error" : "loading"}
              message={activeLoad.message ?? HORIZONS_LOADING}
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
      {compareOpen ? (
        <CompareDialog
          sites={sites}
          profiles={profiles}
          current={currentScenario}
          onClose={() => setCompareOpen(false)}
          onUse={useScenario}
        />
      ) : null}
    </div>
  );
}
