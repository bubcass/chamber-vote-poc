import React, { useEffect, useMemo, useState } from "react";
import ChamberVoteExplorer from "./components/ChamberVoteExplorer.jsx";
import { chamberConfigs, defaultChamberKey } from "./chambers/config.js";
import "./styles.css";

function getInitialChamberKey() {
  if (typeof window === "undefined") return defaultChamberKey;

  const params = new URLSearchParams(window.location.search);
  const chamber = params.get("chamber");

  return chamberConfigs.some((item) => item.key === chamber)
    ? chamber
    : defaultChamberKey;
}

export default function App() {
  const [activeChamberKey, setActiveChamberKey] = useState(getInitialChamberKey);

  useEffect(() => {
    if (typeof window === "undefined") return;

    const url = new URL(window.location.href);
    url.searchParams.set("chamber", activeChamberKey);
    window.history.replaceState({}, "", url);
  }, [activeChamberKey]);

  const activeChamber = useMemo(
    () =>
      chamberConfigs.find((chamber) => chamber.key === activeChamberKey) ||
      chamberConfigs[0],
    [activeChamberKey],
  );

  return (
    <div className="app">
      <header>
        <section className="hero">
          <div className="hero__media">
            <img
              className="hero__video"
              src={`${import.meta.env.BASE_URL}media/hero-divisions.png`}
              alt=""
            />
          </div>

          <div className="hero__overlay">
            <div className="hero__content">
              <p className="hero__eyebrow">Open data insights</p>
              <h1 className="hero__title">{activeChamber.title}</h1>
              <p className="hero__subtitle">{activeChamber.subtitle}</p>
            </div>
          </div>
        </section>

        <div className="section-nav-shell">
          <nav className="section-nav" aria-label="Chamber selection">
            <div className="section-nav__list">
              {chamberConfigs.map((chamber) => (
                <button
                  key={chamber.key}
                  type="button"
                  className="section-nav__link"
                  aria-current={
                    chamber.key === activeChamberKey ? "page" : undefined
                  }
                  onClick={() => setActiveChamberKey(chamber.key)}
                >
                  {chamber.label}
                </button>
              ))}
            </div>
          </nav>
        </div>
      </header>

      <ChamberVoteExplorer chamber={activeChamber} />
    </div>
  );
}
