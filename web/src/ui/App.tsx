import { useEffect, useState } from "react";
import { linksSchema, sitesFileSchema } from "../contract/schemas";
import type { Links, Site } from "../contract/types";
import { CompareRow } from "./CompareRow";
import { CountdownRow } from "./CountdownRow";
import { fixture } from "./fixture";
import { Header } from "./Header";
import { MissionBars } from "./MissionBars";
import { SiteDateBar } from "./SiteDateBar";
import { SourceFooter } from "./SourceFooter";
import { VerdictBanner } from "./VerdictBanner";

export function App() {
  const [sites, setSites] = useState<Site[]>([]);
  const [links, setLinks] = useState<Links | null>(null);

  useEffect(() => {
    void Promise.all([
      fetch("/data/sites.json").then((response) => response.json()),
      fetch("/data/links.json").then((response) => response.json()),
    ]).then(([sitesFile, linksFile]) => {
      setSites(sitesFileSchema.parse(sitesFile).sites);
      setLinks(linksSchema.parse(linksFile));
    });
  }, []);

  const site = sites.find((item) => item.id === "shackleton-rim") ?? sites[0];

  return (
    <main className="app">
      <Header profileLabel="Small lander, 14 days" />
      {site ? (
        <SiteDateBar sites={sites} siteId={site.id} landingDate={fixture.landingDate} />
      ) : (
        <p>Loading places…</p>
      )}
      <VerdictBanner sentence={fixture.sentence} />
      <CountdownRow sunset={fixture.sunset} earthset={fixture.earthset} />
      <MissionBars powerFraction={fixture.powerFraction} earthFraction={fixture.earthFraction} />
      <CompareRow sentence={fixture.comparison} />
      {links && site ? <SourceFooter links={links} lat={site.latDeg} lon={site.lonDegEast} /> : null}
    </main>
  );
}
