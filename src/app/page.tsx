"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import styles from "./page.module.css";

export default function Home() {
  const router = useRouter();
  const [destination, setDestination] = useState("");
  const [origin, setOrigin] = useState("");
  const [departDate, setDepartDate] = useState("");
  const [returnDate, setReturnDate] = useState("");

  const [destinationConfirmed, setDestinationConfirmed] = useState(false);
  const [originConfirmed, setOriginConfirmed] = useState(false);

  // Two-layer cross-fade: bgBottom is always visible; bgTop fades in, then becomes the new bottom
  const SVG_BG = '/destinations/landing_page.svg';
  const [bgBottom, setBgBottom] = useState(SVG_BG);
  const [bgTop, setBgTop] = useState<string | null>(null);
  const [bgTopVisible, setBgTopVisible] = useState(false);
  const currentBgRef = useRef(SVG_BG);

  const originRef = useRef<HTMLInputElement>(null);
  const departRef = useRef<HTMLInputElement>(null);

  const showOrigin = destinationConfirmed && destination.trim().length > 0;
  const showDates = showOrigin && originConfirmed && origin.trim().length > 0;
  const showSearch = showDates && departDate !== "" && returnDate !== "";

  // Auto-focus the next field as it appears
  useEffect(() => {
    if (showOrigin) originRef.current?.focus();
  }, [showOrigin]);

  useEffect(() => {
    if (showDates) departRef.current?.focus();
  }, [showDates]);

  // Debounced background image fetch from Unsplash — smooth cross-fade on change
  useEffect(() => {
    // Cross-fade to a new URL; no-ops if the URL hasn't changed
    const changeBg = (newUrl: string) => {
      if (newUrl === currentBgRef.current) return;
      setBgTop(newUrl);
      // Double-RAF: first frame commits the new element to the DOM at opacity 0,
      // second frame triggers the CSS transition to opacity 1
      requestAnimationFrame(() => {
        requestAnimationFrame(() => setBgTopVisible(true));
      });
    };

    const trimmed = destination.trim();
    if (!trimmed) {
      changeBg(SVG_BG);
      return;
    }

    const controller = new AbortController();
    const timer = setTimeout(async () => {
      try {
        const res = await fetch(
          `/api/destination-image?q=${encodeURIComponent(trimmed)}`,
          { signal: controller.signal }
        );
        const data = await res.json();
        changeBg(data.url ?? SVG_BG);
      } catch {
        // Aborted or failed — leave bg unchanged
      }
    }, 500);

    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [destination]);

  const today = new Date().toISOString().split("T")[0];
  const minReturn = departDate || today;

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (!showSearch) return;
    const params = new URLSearchParams({
      destination: destination.trim(),
      from: origin.trim(),
      depart: departDate,
      return: returnDate,
    });
    router.push(`/plan?${params.toString()}`);
  };

  return (
    <main className={styles.main}>
      {/* Bottom layer — always visible, shows the "current" background */}
      <div
        className={`${styles.bg} ${styles.bgVisible}`}
        style={{ backgroundImage: `url(${bgBottom})`, zIndex: 0 }}
      />
      {/* Top layer — fades in over the bottom; on transition end becomes the new bottom */}
      {bgTop && (
        <div
          className={`${styles.bg} ${bgTopVisible ? styles.bgVisible : ""}`}
          style={{ backgroundImage: `url(${bgTop})`, zIndex: 1 }}
          onTransitionEnd={() => {
            currentBgRef.current = bgTop;
            setBgBottom(bgTop);
            setBgTop(null);
            setBgTopVisible(false);
          }}
        />
      )}
      {/* Single dark overlay above both bg layers */}
      <div className={styles.bgOverlay} />
      <div className={styles.hero}>
        <h1 className={`${styles.title} ${styles.titleLight}`}>Where to next?</h1>
        <p className={`${styles.subtitle} ${styles.subtitleLight}`}>Plan your perfect trip in minutes.</p>

        <form className={styles.card} onSubmit={handleSearch}>

          {/* Destination */}
          <div className={styles.field}>
            <label className={styles.label} htmlFor="destination">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <circle cx="12" cy="10" r="3" />
                <path d="M12 2a8 8 0 0 1 8 8c0 5.25-8 13-8 13S4 15.25 4 10a8 8 0 0 1 8-8z" />
              </svg>
              Travelling to
            </label>
            <input
              id="destination"
              className={styles.input}
              type="text"
              placeholder="Tokyo, Lisbon, Patagonia…"
              value={destination}
              onChange={(e) => { setDestination(e.target.value); setDestinationConfirmed(false); }}
              onBlur={() => { if (destination.trim().length > 0) setDestinationConfirmed(true); }}
              onKeyDown={(e) => { if (e.key === "Enter" || e.key === "Tab") { if (destination.trim().length > 0) setDestinationConfirmed(true); } }}
              autoFocus
              autoComplete="off"
              spellCheck={false}
            />
          </div>

          {/* Origin */}
          <div className={`${styles.field} ${styles.revealField} ${showOrigin ? styles.revealed : ""}`}>
            <div className={styles.divider} />
            <label className={styles.label} htmlFor="origin">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
                <polyline points="9 22 9 12 15 12 15 22" />
              </svg>
              Travelling from
            </label>
            <input
              id="origin"
              ref={originRef}
              className={styles.input}
              type="text"
              placeholder="New York, London, Sydney…"
              value={origin}
              onChange={(e) => { setOrigin(e.target.value); setOriginConfirmed(false); }}
              onBlur={() => { if (origin.trim().length > 0) setOriginConfirmed(true); }}
              onKeyDown={(e) => { if (e.key === "Enter" || e.key === "Tab") { if (origin.trim().length > 0) setOriginConfirmed(true); } }}
              autoComplete="off"
              spellCheck={false}
              tabIndex={showOrigin ? 0 : -1}
            />
          </div>

          {/* Dates */}
          <div className={`${styles.field} ${styles.revealField} ${showDates ? styles.revealed : ""}`}>
            <div className={styles.divider} />
            <label className={styles.label}>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
                <line x1="16" y1="2" x2="16" y2="6" />
                <line x1="8" y1="2" x2="8" y2="6" />
                <line x1="3" y1="10" x2="21" y2="10" />
              </svg>
              When?
            </label>
            <div className={styles.dateRow}>
              <div className={styles.dateField}>
                <span className={styles.dateLabel}>Departure</span>
                <input
                  ref={departRef}
                  className={styles.dateInput}
                  type="date"
                  value={departDate}
                  min={today}
                  onChange={(e) => {
                    setDepartDate(e.target.value);
                    if (returnDate && e.target.value > returnDate) setReturnDate("");
                  }}
                  tabIndex={showDates ? 0 : -1}
                />
              </div>
              <div className={styles.dateSeparator}>→</div>
              <div className={styles.dateField}>
                <span className={styles.dateLabel}>Return</span>
                <input
                  className={styles.dateInput}
                  type="date"
                  value={returnDate}
                  min={minReturn}
                  onChange={(e) => setReturnDate(e.target.value)}
                  tabIndex={showDates ? 0 : -1}
                />
              </div>
            </div>
          </div>

          {/* Search button */}
          <div className={`${styles.revealField} ${showSearch ? styles.revealed : ""}`}>
            <button className={styles.button} type="submit" tabIndex={showSearch ? 0 : -1}>
              Search Trips
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <line x1="5" y1="12" x2="19" y2="12" />
                <polyline points="12 5 19 12 12 19" />
              </svg>
            </button>
          </div>

        </form>
      </div>
    </main>
  );
}
