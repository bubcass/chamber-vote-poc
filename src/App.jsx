import React, { useEffect, useMemo, useRef, useState } from "react";
import ChamberVoteExplorer from "./components/ChamberVoteExplorer.jsx";
import { chamberConfigs, defaultChamberKey } from "./chambers/config.js";
import "./styles.css";

const OPEN_DATA_INSIGHTS_URL = "https://bubcass.github.io/open-data-insights/";
const THEME_STORAGE_KEY = "vote-explorer-theme";
const OIREACHTAS_FOOTER_LINKS = [
  ["Accessibility", "https://www.oireachtas.ie/en/accessibility-statement/"],
  ["Cookies", "https://www.oireachtas.ie/en/cookies/"],
  ["Transparency", "https://www.oireachtas.ie/en/transparency/"],
  ["Contact us", "https://www.oireachtas.ie/en/contact-us/"],
  ["Copyright and reuse", "https://www.oireachtas.ie/en/copyright-and-reuse/"],
];

const ShareIcon = () => (
  <svg viewBox="0 0 24 24" aria-hidden="true">
    <path d="M14.5 5.5 19 10l-4.5 4.5" />
    <path d="M18.5 10H10a5 5 0 0 0-5 5v2" />
  </svg>
);

const ThemeIcon = ({dark}) => dark ? (
  <svg viewBox="0 0 24 24" aria-hidden="true">
    <circle cx="12" cy="12" r="3.5" />
    <path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" />
  </svg>
) : (
  <svg viewBox="0 0 24 24" aria-hidden="true">
    <path d="M20 15.2A8.2 8.2 0 0 1 8.8 4a8.3 8.3 0 1 0 11.2 11.2Z" />
  </svg>
);

const OireachtasFooter = () => (
  <footer className="oireachtas-footer">
    <nav className="oireachtas-footer__nav" aria-label="Oireachtas information">
      <ul className="oireachtas-footer__links">
        {OIREACHTAS_FOOTER_LINKS.map(([label, href]) => (
          <li key={href}><a href={href}>{label}</a></li>
        ))}
      </ul>
    </nav>
  </footer>
);

function getInitialChamberKey() {
  if (typeof window === "undefined") return defaultChamberKey;
  const chamber = new URLSearchParams(window.location.search).get("chamber");
  return chamberConfigs.some((item) => item.key === chamber)
    ? chamber
    : defaultChamberKey;
}

function getInitialTheme() {
  if (typeof window === "undefined") return "light";
  try {
    const saved = window.localStorage.getItem(THEME_STORAGE_KEY);
    if (saved === "dark" || saved === "light") return saved;
  } catch {}
  return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

async function sharePage(title, text) {
  const data = {title, text, url: window.location.href};
  if (navigator.share) return navigator.share(data);
  if (navigator.clipboard?.writeText) return navigator.clipboard.writeText(data.url);

  const input = document.createElement("textarea");
  input.value = data.url;
  input.setAttribute("readonly", "");
  input.style.position = "fixed";
  input.style.opacity = "0";
  document.body.appendChild(input);
  input.select();
  document.execCommand("copy");
  input.remove();
}

function ChamberMenu({activeKey, onSelect, className = ""}) {
  return (
    <div className={`section-nav__list ${className}`.trim()}>
      {chamberConfigs.map((chamber) => (
        <button
          key={chamber.key}
          type="button"
          className="section-nav__link"
          aria-current={chamber.key === activeKey ? "page" : undefined}
          onClick={() => onSelect(chamber.key)}
        >
          {chamber.label}
        </button>
      ))}
    </div>
  );
}

export default function App() {
  const [activeChamberKey, setActiveChamberKey] = useState(getInitialChamberKey);
  const [theme, setTheme] = useState(getInitialTheme);
  const [navDocked, setNavDocked] = useState(false);
  const [navOpen, setNavOpen] = useState(false);
  const [moreOpen, setMoreOpen] = useState(false);
  const [showBackToTop, setShowBackToTop] = useState(false);
  const [shareStatus, setShareStatus] = useState("");
  const navShellRef = useRef(null);
  const mobileToolsRef = useRef(null);

  const activeChamber = useMemo(
    () => chamberConfigs.find((chamber) => chamber.key === activeChamberKey) || chamberConfigs[0],
    [activeChamberKey],
  );

  useEffect(() => {
    const url = new URL(window.location.href);
    url.searchParams.set("chamber", activeChamberKey);
    window.history.replaceState({}, "", url);
    setNavOpen(false);
  }, [activeChamberKey]);

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    try { window.localStorage.setItem(THEME_STORAGE_KEY, theme); } catch {}
  }, [theme]);

  useEffect(() => {
    let frame = null;
    const update = () => {
      frame = null;
      const mobile = window.matchMedia("(max-width: 720px)").matches;
      const mastheadHeight = document.querySelector(".oireachtas-masthead")?.offsetHeight || 0;
      const dockingLine = mobile ? 12 : mastheadHeight;
      setNavDocked((navShellRef.current?.getBoundingClientRect().top ?? 1) <= dockingLine);
      setShowBackToTop(window.scrollY > 640);
    };
    const schedule = () => {
      if (frame !== null) return;
      frame = window.requestAnimationFrame(update);
    };
    window.addEventListener("scroll", schedule, {passive: true});
    window.addEventListener("resize", schedule, {passive: true});
    update();
    return () => {
      window.removeEventListener("scroll", schedule);
      window.removeEventListener("resize", schedule);
      if (frame !== null) window.cancelAnimationFrame(frame);
    };
  }, []);

  useEffect(() => {
    const closeMenus = (event) => {
      const inMobileTools = mobileToolsRef.current?.contains(event.target);
      const inInitialNav = navShellRef.current?.contains(event.target);
      if (!inMobileTools && !inInitialNav) {
        setNavOpen(false);
        setMoreOpen(false);
      }
    };
    const closeOnEscape = (event) => {
      if (event.key === "Escape") {
        setNavOpen(false);
        setMoreOpen(false);
      }
    };
    document.addEventListener("pointerdown", closeMenus);
    document.addEventListener("keydown", closeOnEscape);
    return () => {
      document.removeEventListener("pointerdown", closeMenus);
      document.removeEventListener("keydown", closeOnEscape);
    };
  }, []);

  const handleShare = async () => {
    try {
      await sharePage(activeChamber.title, activeChamber.subtitle);
      if (!navigator.share) {
        setShareStatus("Link copied");
        window.setTimeout(() => setShareStatus(""), 2000);
      }
    } catch (error) {
      if (error?.name !== "AbortError") setShareStatus("Unable to share");
    }
  };

  const toggleTheme = () => setTheme((current) => current === "dark" ? "light" : "dark");
  const themeLabel = theme === "dark" ? "Use light mode" : "Use dark mode";

  return (
    <>
      <header className={`oireachtas-masthead ${navDocked ? "oireachtas-masthead--docked" : ""}`}>
        <div className="oireachtas-masthead__inner">
          <a className="oireachtas-masthead__home" href="https://www.oireachtas.ie/" aria-label="Return to oireachtas.ie" title="Return to oireachtas.ie">
            <img className="oireachtas-masthead__logo" src={`${import.meta.env.BASE_URL}oireachtas-logo.svg`} alt="" width="163" height="69" />
          </a>
          <a className="oireachtas-masthead__resource" href={OPEN_DATA_INSIGHTS_URL}>Open Data Insights</a>
          <div className="oireachtas-masthead__actions">
            <button type="button" className="oireachtas-masthead__action" onClick={handleShare} aria-label="Share this page" title="Share this page"><ShareIcon /></button>
            <button type="button" className="oireachtas-masthead__action" onClick={toggleTheme} aria-label={themeLabel} aria-pressed={theme === "dark"} title={themeLabel}><ThemeIcon dark={theme === "dark"} /></button>
            <span className="visually-hidden" aria-live="polite">{shareStatus}</span>
          </div>
        </div>
      </header>

      <main className="app">
        <div className="app__intro">
          <div className="section-nav-shell" ref={navShellRef}>
            <nav className={`section-nav ${navDocked ? "section-nav--docked" : ""} ${navOpen ? "is-open" : ""}`} aria-label="Chamber selection">
              <button type="button" className="section-nav__toggle" onClick={() => setNavOpen((open) => !open)} aria-expanded={navOpen} aria-label={`Current chamber: ${activeChamber.label}. Open chamber navigation`}>
                <span>{activeChamber.label}</span><i aria-hidden="true" />
              </button>
              <ChamberMenu activeKey={activeChamberKey} onSelect={setActiveChamberKey} />
            </nav>
          </div>

          <section className="hero">
            <div className="hero__media">
              <img className="hero__video" src={`${import.meta.env.BASE_URL}media/hero-divisions.png`} alt="" />
            </div>
            <div className="hero__overlay">
              <div className="hero__content">
                <p className="hero__eyebrow">Open data insights</p>
                <h1 className="hero__title">{activeChamber.title}</h1>
                <p className="hero__subtitle">{activeChamber.subtitle}</p>
              </div>
            </div>
          </section>
        </div>

        <ChamberVoteExplorer chamber={activeChamber} />

        {navDocked && (
          <div className="mobile-reading-tools" ref={mobileToolsRef}>
          <button type="button" className="mobile-reading-tools__back" aria-label="Go back" title="Go back" onClick={() => window.history.length > 1 ? window.history.back() : window.location.assign(OPEN_DATA_INSIGHTS_URL)}>
            <svg viewBox="0 0 24 24" aria-hidden="true"><path d="m14.5 5-7 7 7 7" /></svg>
          </button>
          <nav className={`mobile-section-nav ${navOpen ? "is-open" : ""}`} aria-label="Mobile chamber selection">
            <button type="button" className="section-nav__toggle" onClick={() => { setNavOpen((open) => !open); setMoreOpen(false); }} aria-expanded={navOpen}>
              <span>{activeChamber.label}</span><i aria-hidden="true" />
            </button>
            {navOpen && <ChamberMenu activeKey={activeChamberKey} onSelect={setActiveChamberKey} className="section-nav__list--mobile" />}
          </nav>
          <div className="mobile-reading-tools__more-wrap">
            <button type="button" className="mobile-reading-tools__more" aria-label="More options" aria-expanded={moreOpen} title="More options" onClick={() => { setMoreOpen((open) => !open); setNavOpen(false); }}>
              <svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="5" cy="12" r="1.5" /><circle cx="12" cy="12" r="1.5" /><circle cx="19" cy="12" r="1.5" /></svg>
            </button>
            {moreOpen && (
              <div className="mobile-reading-tools__menu">
                <button type="button" className="mobile-reading-tools__menu-action" onClick={handleShare}><ShareIcon /><span>Share</span></button>
                <button type="button" className="mobile-reading-tools__menu-action" onClick={toggleTheme}><ThemeIcon dark={theme === "dark"} /><span>{theme === "dark" ? "Light mode" : "Dark mode"}</span></button>
                <span className="visually-hidden" aria-live="polite">{shareStatus}</span>
              </div>
            )}
          </div>
          </div>
        )}

        {showBackToTop && (
          <button type="button" className="page-back-to-top" aria-label="Back to top" title="Back to top" onClick={() => window.scrollTo({top: 0, behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth"})}>
            <svg viewBox="0 0 24 24" aria-hidden="true"><path d="m6.5 14.5 5.5-5.5 5.5 5.5" /></svg>
          </button>
        )}
      </main>

      <OireachtasFooter />
    </>
  );
}
