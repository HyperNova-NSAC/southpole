import { useEffect, useState } from "react";
import { linksSchema, profilesFileSchema, sitesFileSchema } from "../contract/schemas";
import type { HorizonMask, Instant, Links, MissionProfile, Site, Verdict, WindowMetrics } from "../contract/types";
import { compare } from "../core/compare";
import { EARTH_COMM_MARGIN_DEG, SUNLIT_THRESHOLD, evaluateMission } from "../core/evaluate";
import { betterSite, type SlipIndex } from "../core/slip";
import { buildVerdict } from "../core/verdict";
import { useAppStore } from "../state/store";
import tourFile from "../../../content/tour.json";
import { AboutDialog } from "./AboutDialog";
import { CompareRow } from "./CompareRow";
import { CountdownRow } from "./CountdownRow";
import { DetailsDrawer } from "./DetailsDrawer";
import { Header } from "./Header";
import { MissionBars } from "./MissionBars";
import { SiteDateBar } from "./SiteDateBar";
import { Skyline } from "./Skyline";
import { SourceFooter } from "./SourceFooter";
import { TourCaption } from "./TourCaption";
import { VerdictBanner } from "./VerdictBanner";
import { HORIZONS_FAILURE, loadMissionData } from "./loadMission";
import { cachedIndex, indexFromTables, rememberIndex, suggestDates } from "./missionIndex";
import { earthsetLine, instantAt, playheadCaption, sunsetLine } from "./present";
import { searchFromSelection } from "./query";

type MissionView = {
  samples: Instant[];
  metrics: WindowMetrics;
  verdict: Verdict;
  mask: HorizonMask;
  terrainNote: string | null;
  index: SlipIndex;
};

const EMPTY_SUN = { azDeg: 0, elDeg: 0, angDiamDeg: 0.5, frac: 0 };
const tourSteps = tourFile.steps;

export function App() {
  const [sites, setSites] = useState<Site[]>([]);
  const [profiles, setProfiles] = useState<MissionProfile[]>([]);
  const [links, setLinks] = useState<Links | null>(null);
  const [mission, setMission] = useState<MissionView | null>(null);
  const [comparison, setComparison] = useState("");
  const [suggestion, setSuggestion] = useState<{ siteId: string; sentence: string } | null>(null);
  const [suggestionStatus, setSuggestionStatus] = useState<"idle" | "loading" | "ready">("idle");

  const siteId = useAppStore((state) => state.siteId);
  const landingUtc = useAppStore((state) => state.landingUtc);
  const profileId = useAppStore((state) => state.profileId);
  const compareSiteId = useAppStore((state) => state.compareSiteId);
  const customSite = useAppStore((state) => state.customSite);
  const playheadUtc = useAppStore((state) => state.playheadUtc);
  const playing = useAppStore((state) => state.playing);
  const detailsOpen = useAppStore((state) => state.detailsOpen);
  const tourStep = useAppStore((state) => state.tourStep);
  const aboutOpen = useAppStore((state) => state.aboutOpen);
  const status = useAppStore((state) => state.status);
  const errorMessage = useAppStore((state) => state.errorMessage);
  const setSiteId = useAppStore((state) => state.setSiteId);
  const setLandingDate = useAppStore((state) => state.setLandingDate);
  const setLandingUtc = useAppStore((state) => state.setLandingUtc);
  const setProfileId = useAppStore((state) => state.setProfileId);
  const setCompareSiteId = useAppStore((state) => state.setCompareSiteId);
  const setCustomSite = useAppStore((state) => state.setCustomSite);
  const setPlaying = useAppStore((state) => state.setPlaying);
  const setDetailsOpen = useAppStore((state) => state.setDetailsOpen);
  const setTourStep = useAppStore((state) => state.setTourStep);
  const setAboutOpen = useAppStore((state) => state.setAboutOpen);

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

  const listed = customSite ? [...sites.filter((item) => item.id !== customSite.id), customSite] : sites;
  const site = listed.find((item) => item.id === siteId) ?? null;
  const profile = profiles.find((item) => item.id === profileId) ?? null;
  const compareOptions = listed.filter((item) => item.id !== site?.id);
  const compareSite = compareOptions.find((item) => item.id === compareSiteId) ?? compareOptions[0] ?? null;

  useEffect(() => {
    if (sites.length === 0) return;
    const known = sites.some((item) => item.id === siteId) || siteId === customSite?.id;
    if (!known) setSiteId("shackleton-rim");
  }, [sites, siteId, customSite, setSiteId]);

  useEffect(() => {
    if (profiles.length === 0) return;
    if (!profiles.some((item) => item.id === profileId)) setProfileId(profiles[0].id);
  }, [profiles, profileId, setProfileId]);

  useEffect(() => {
    if (!compareSite || compareSite.id === compareSiteId) return;
    setCompareSiteId(compareSite.id);
  }, [compareSite, compareSiteId, setCompareSiteId]);

  useEffect(() => {
    const next = searchFromSelection({
      siteId,
      landingUtc,
      profileId,
      compareSiteId: compareSiteId ?? "nobile-rim-1",
    });
    if (window.location.search !== next) {
      window.history.replaceState(null, "", next);
    }
  }, [siteId, landingUtc, profileId, compareSiteId]);

  useEffect(() => {
    if (tourStep === null) return;
    const step = tourSteps[tourStep];
    if (!step) return;
    const state = useAppStore.getState();
    if (state.siteId !== step.siteId) state.setSiteId(step.siteId);
    state.setLandingUtc(step.landingUtc);
    state.setPlaying(tourStep === 1);
  }, [tourStep]);

  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      if (event.key !== "Escape") return;
      const state = useAppStore.getState();
      if (state.aboutOpen) state.setAboutOpen(false);
      else if (state.tourStep !== null) state.setTourStep(null);
      else if (state.detailsOpen) state.setDetailsOpen(false);
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  useEffect(() => {
    if (!site || !profile) return;
    let cancelled = false;
    setMission(null);
    setComparison("");
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
      const index = indexFromTables(site.id, result.files.sun, result.files.earth, result.files.mask);
      rememberIndex(index);
      setMission({
        samples: evaluated.samples,
        metrics: evaluated.metrics,
        verdict,
        mask: result.files.mask,
        terrainNote: result.files.terrainNote,
        index,
      });
      useAppStore.getState().setStatus("ready", null);
    });
    return () => {
      cancelled = true;
    };
  }, [site, profile, landingUtc]);

  useEffect(() => {
    if (!compareSite || !profile || !mission || !site || mission.mask.siteId !== site.id) return;
    let cancelled = false;
    const currentMetrics = mission.metrics;
    setComparison("Comparing this landing…");
    void loadMissionData(compareSite, landingUtc, profile.durationHours).then((result) => {
      if (cancelled) return;
      if (!result.ok) {
        setComparison(HORIZONS_FAILURE);
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
      setComparison(compare(currentMetrics, evaluated.metrics, compareSite.name, profile.durationHours));
    });
    return () => {
      cancelled = true;
    };
  }, [compareSite, profile, landingUtc, mission, site]);

  useEffect(() => {
    if (!detailsOpen || !profile || sites.length === 0) return;
    let cancelled = false;
    setSuggestionStatus("loading");
    void (async () => {
      const indexes: Record<string, SlipIndex> = {};
      await Promise.all(
        sites.map(async (item) => {
          const index = await cachedIndex(item);
          if (index) indexes[item.id] = index;
        }),
      );
      if (cancelled) return;
      const names = Object.fromEntries(sites.map((item) => [item.id, item.name]));
      setSuggestion(betterSite(indexes, siteId, landingUtc, profile, names));
      setSuggestionStatus("ready");
    })();
    return () => {
      cancelled = true;
    };
  }, [detailsOpen, sites, siteId, landingUtc, profile]);

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
  const tour = tourStep === null ? null : tourSteps[tourStep];
  const dates = ready && profile ? suggestDates(mission.index, profile) : [];

  return (
    <main className="app">
      <Header
        profiles={profiles}
        profileId={profileId}
        onProfile={(id) => {
          setTourStep(null);
          setProfileId(id);
        }}
        onWhy={() => setTourStep(0)}
        onAbout={() => setAboutOpen(true)}
      />
      {tour ? (
        <TourCaption
          step={tourStep ?? 0}
          total={tourSteps.length}
          title={tour.title}
          body={tour.body}
          onBack={() => setTourStep(Math.max(0, (tourStep ?? 0) - 1))}
          onNext={() => {
            if (tourStep === null) return;
            if (tourStep >= tourSteps.length - 1) setTourStep(null);
            else setTourStep(tourStep + 1);
          }}
          onClose={() => setTourStep(null)}
        />
      ) : null}
      {site ? (
        <SiteDateBar
          sites={listed}
          siteId={site.id}
          landingDate={landingDate}
          onSite={(id) => {
            setTourStep(null);
            setSiteId(id);
          }}
          onDate={(date) => {
            if (!date) return;
            setTourStep(null);
            setLandingDate(date);
          }}
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
      {compareSite ? (
        <CompareRow
          sites={compareOptions}
          compareSiteId={compareSite.id}
          sentence={comparison}
          onCompare={(id) => {
            setTourStep(null);
            setCompareSiteId(id);
          }}
        />
      ) : null}
      <button
        type="button"
        className="numbers-toggle"
        aria-expanded={detailsOpen}
        onClick={() => setDetailsOpen(!detailsOpen)}
      >
        {detailsOpen ? "Hide the numbers" : "Show the numbers"}
      </button>
      {links && site ? <SourceFooter links={links} lat={site.latDeg} lon={site.lonDegEast} compact /> : null}
      {detailsOpen && links && site ? (
        <DetailsDrawer
          ready={ready}
          playhead={playhead}
          reasons={ready ? mission.verdict.reasons : []}
          dates={dates}
          suggestion={suggestion}
          suggestionStatus={suggestionStatus}
          links={links}
          lat={site.latDeg}
          lon={site.lonDegEast}
          onLanding={(iso) => {
            setTourStep(null);
            setLandingUtc(iso);
          }}
          onCompare={setCompareSiteId}
          onLookup={(lat, lon) => {
            setCustomSite({
              id: "custom",
              name: `Custom ${lat.toFixed(2)}°, ${lon.toFixed(2)}° E`,
              latDeg: lat,
              lonDegEast: lon,
              heightM: 0,
              category: lat <= -60 ? "polar" : "apollo",
              agency: "Typed",
              notes: "Typed for this session. It is not saved in the catalog.",
              sourceUrl: "",
            });
          }}
        />
      ) : null}
      {aboutOpen && links ? <AboutDialog credit={links.credit} onClose={() => setAboutOpen(false)} /> : null}
    </main>
  );
}
