import { lazy, Suspense, useCallback, useState } from "react";

// three.js is large; load it after the text so the hero paints immediately.
const MoonScene = lazy(() => import("./MoonScene"));

const APP_URL = "/app/";

const FEATURES = [
  {
    title: "Real terrain",
    body: "A 360° skyline ray-marched from NASA's LOLA south-pole elevation model, so ridges and crater walls block the Sun the way they really do.",
  },
  {
    title: "Real sky",
    body: "Sun and Earth positions from NASA JPL Horizons every 30 minutes, for the exact place and time you choose.",
  },
  {
    title: "A clear answer",
    body: "Viable, marginal or not viable, with the longest night, Earth contact, and the next landing times that work.",
  },
];

/** Landing page: a full-screen Moon hero, a short explanation, and a way into the tool. */
export function Home() {
  const [moonReady, setMoonReady] = useState(false);
  const onReady = useCallback(() => setMoonReady(true), []);

  return (
    <div className="home">
      <header className="home-nav">
        <a className="home-brand" href="/">
          <img src="/favicon.svg" alt="" width={26} height={26} />
          Lunar Skyline
        </a>
        <a className="home-nav-link" href={APP_URL}>
          Open the app
        </a>
      </header>

      <section className="hero">
        <div className={moonReady ? "hero-stage ready" : "hero-stage"} aria-hidden="true">
          <div className="hero-glow" />
          <Suspense fallback={null}>
            <MoonScene onReady={onReady} />
          </Suspense>
        </div>
        <div className="hero-shade" aria-hidden="true" />

        <div className="hero-copy">
          <p className="eyebrow">NASA Space Apps 2026 · Lunar Landing Site Navigator</p>
          <h1>Lunar Skyline</h1>
          <p className="lede">
            At the lunar south pole the Sun never climbs high and Earth slips behind the ridges. Lunar Skyline
            shows when, and where, a lander keeps both in view.
          </p>
          <div className="hero-actions">
            <a className="cta" href={APP_URL}>
              Check a landing site
              <span aria-hidden="true">→</span>
            </a>
            <a className="cta-secondary" href="#how">
              How it works
            </a>
          </div>
        </div>

        <p className="hero-hint">Drag to turn the Moon</p>
      </section>

      <section id="how" className="how">
        <h2>Pick a point and a time. Get an answer.</h2>
        <div className="features">
          {FEATURES.map((feature) => (
            <article key={feature.title} className="feature">
              <h3>{feature.title}</h3>
              <p>{feature.body}</p>
            </article>
          ))}
        </div>
        <a className="cta" href={APP_URL}>
          Open Lunar Skyline
          <span aria-hidden="true">→</span>
        </a>
      </section>

      <footer className="home-footer">
        <p>
          Moon imagery: NASA Scientific Visualization Studio{" "}
          <a href="https://svs.gsfc.nasa.gov/4720">CGI Moon Kit</a> (LRO WAC colour and LOLA elevation). Ephemerides:
          NASA JPL Horizons.
        </p>
      </footer>
    </div>
  );
}
