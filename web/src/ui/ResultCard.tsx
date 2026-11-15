import type { ReactNode } from "react";
import type { MissionProfile, WindowMetrics } from "../contract/types";
import { RingGauge } from "./charts/RingGauge";
import { countdownValue, formatDuration, percent, type ResultSummary } from "./result";

type ResultCardProps =
  | { state: "loading"; message: string }
  | { state: "error"; message: string }
  | {
      state: "ready";
      summary: ResultSummary;
      metrics: WindowMetrics;
      profile: MissionProfile;
      nextLandings: string[];
      terrainNote: string | null;
      onLanding: (landingUtc: string) => void;
      onTrajectory?: () => void;
    };

const ICONS = { green: "✓", amber: "!", red: "✕" } as const;

const chipFormat = new Intl.DateTimeFormat("en-GB", {
  day: "numeric",
  month: "short",
  hour: "2-digit",
  minute: "2-digit",
  timeZone: "UTC",
});

/** The answer: a status headline, the pass/fail checklist, and the key numbers as tiles. */
export function ResultCard(props: ResultCardProps) {
  if (props.state !== "ready") {
    return (
      <section className={`card result ${props.state}`} aria-live="polite">
        {props.state === "loading" ? <span className="spinner" aria-hidden="true" /> : null}
        <p className="result-message">{props.message}</p>
      </section>
    );
  }

  const { summary, metrics, profile, nextLandings, terrainNote, onLanding, onTrajectory } = props;
  const limit = profile.maxLongestDarkHours;

  return (
    <section className={`card result tone-${summary.tone}`} aria-live="polite">
      <div className="status">
        <div className="status-icon" aria-hidden="true">
          {ICONS[summary.tone]}
        </div>
        <div>
          <h2 className="status-title">{summary.title}</h2>
          <p className="status-subtitle">{summary.subtitle}</p>
        </div>
      </div>
      {onTrajectory ? (
        <button type="button" className="button secondary" disabled={summary.tone !== "green"} onClick={onTrajectory}>
          Find rocket trajectory
        </button>
      ) : null}

      <ul className="checks">
        {summary.checks.map((check) => (
          <li key={check.id} className={check.ok ? "check ok" : check.required ? "check fail" : "check info"}>
            <span className="check-mark" aria-hidden="true">
              {check.ok ? "✓" : check.required ? "✕" : "–"}
            </span>
            <span className="check-label">{check.label}</span>
            <span className="check-detail">{check.detail}</span>
          </li>
        ))}
      </ul>

      <div className="tiles">
        <Tile label="Sunlight" value={percent(metrics.sunlitFraction)} caption="of the mission">
          <RingGauge fraction={metrics.sunlitFraction} tone="sun" />
        </Tile>
        <Tile label="Earth contact" value={percent(metrics.earthFraction)} caption="of the mission">
          <RingGauge fraction={metrics.earthFraction} tone="earth" />
        </Tile>
        <Tile
          label="Longest night"
          value={formatDuration(metrics.longestDarkHours)}
          caption={limit === null ? "no limit set" : `limit ${formatDuration(limit)}`}
          warn={limit !== null && metrics.longestDarkHours > limit}
        />
        <Tile label="Next sunset" value={countdownValue(metrics.sunsetInHours, "Stays up")} caption="from touchdown" />
        <Tile
          label="Lose Earth"
          value={countdownValue(metrics.earthsetInHours, "Stays in view")}
          caption="from touchdown"
        />
        <Tile
          label="Longest blackout"
          value={formatDuration(metrics.longestCommGapHours)}
          caption="without Earth"
        />
      </div>

      {nextLandings.length > 0 ? (
        <div className="next">
          <span className="next-label">{summary.tone === "green" ? "Other good times" : "Try instead"}</span>
          <div className="chips">
            {nextLandings.map((iso) => (
              <button key={iso} type="button" className="chip" onClick={() => onLanding(iso)}>
                {chipFormat.format(new Date(iso))} UTC
              </button>
            ))}
          </div>
        </div>
      ) : null}

      {terrainNote ? <p className="note">{terrainNote}</p> : null}
    </section>
  );
}

type TileProps = {
  label: string;
  value: string;
  caption: string;
  warn?: boolean;
  children?: ReactNode;
};

function Tile({ label, value, caption, warn = false, children }: TileProps) {
  return (
    <div className={warn ? "tile warn" : "tile"}>
      <div className="tile-text">
        <span className="tile-label">{label}</span>
        <span className="tile-value">{value}</span>
        <span className="tile-caption">{caption}</span>
      </div>
      {children}
    </div>
  );
}
