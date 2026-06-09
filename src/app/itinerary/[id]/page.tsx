import Link from "next/link";
import { notFound } from "next/navigation";
import { getPlanById } from "@/lib/plans";
import type { Activity, Place, Hotel } from "@/lib/mock-data";
import type { ClaudeScheduleDay, ClaudeScheduleEvent } from "@/lib/schedule";
import styles from "./page.module.css";

interface Props {
  params: Promise<{ id: string }>;
}

/* ── Schedule types ──────────────────────────────────────────────── */

type CalEvent =
  | { kind: "arrival" }
  | { kind: "departure" }
  | { kind: "activity"; item: Activity; start: number; end: number }
  | { kind: "place"; item: Place; start: number; end: number };

interface DayPlan {
  date: Date;
  dayNum: number;
  isArrival: boolean;
  isDeparture: boolean;
  events: CalEvent[];
}

/* ── Schedule builder ────────────────────────────────────────────── */

function buildSchedule(
  activities: Activity[],
  places: Place[],
  departDate: string,
  returnDate: string
): DayPlan[] {
  const items: Array<
    | { kind: "activity"; item: Activity }
    | { kind: "place"; item: Place }
  > = [
    ...activities.map((a) => ({ kind: "activity" as const, item: a })),
    ...places.map((p) => ({ kind: "place" as const, item: p })),
  ];

  // Build day list in UTC to avoid DST shifts
  const days: Date[] = [];
  const start = new Date(departDate + "T12:00:00Z");
  const end = new Date(returnDate + "T12:00:00Z");
  for (const d = new Date(start); d <= end; d.setUTCDate(d.getUTCDate() + 1)) {
    days.push(new Date(d));
  }

  let idx = 0;
  return days.map((date, i) => {
    const isArrival = i === 0;
    const isDeparture = i === days.length - 1;
    const events: CalEvent[] = [];

    if (isArrival) events.push({ kind: "arrival" });

    // Arrival day starts at 3:30pm (after 3pm check-in)
    // Departure day ends at noon
    let cur = isArrival ? 15.5 : 9.0;
    const cutoff = isDeparture ? 12.0 : 21.0;

    while (idx < items.length && cur + 2 <= cutoff) {
      const { kind, item } = items[idx];
      if (kind === "activity") {
        events.push({ kind: "activity", item: item as Activity, start: cur, end: cur + 2 });
      } else {
        events.push({ kind: "place", item: item as Place, start: cur, end: cur + 2 });
      }
      cur += 2.5; // 2h activity + 30 min buffer
      idx++;
    }

    if (isDeparture) events.push({ kind: "departure" });

    return { date, dayNum: i + 1, isArrival, isDeparture, events };
  });
}

/* ── Claude schedule → DayPlan converter ────────────────────────── */

function claudeScheduleToDayPlans(
  claudeDays: ClaudeScheduleDay[],
  activities: Activity[],
  places: Place[]
): DayPlan[] {
  return claudeDays.map((cd) => ({
    date: new Date(cd.date + "T12:00:00Z"),
    dayNum: cd.dayNum,
    isArrival: cd.isArrival,
    isDeparture: cd.isDeparture,
    events: (cd.events as ClaudeScheduleEvent[])
      .map((ev): CalEvent | null => {
        if (ev.kind === "arrival")   return { kind: "arrival" };
        if (ev.kind === "departure") return { kind: "departure" };
        if (ev.kind === "activity") {
          const item = activities.find((a) => a.id === ev.itemId);
          return item
            ? { kind: "activity", item, start: ev.startHour, end: ev.endHour }
            : null;
        }
        if (ev.kind === "place") {
          const item = places.find((p) => p.id === ev.itemId);
          return item
            ? { kind: "place", item, start: ev.startHour, end: ev.endHour }
            : null;
        }
        // meal / travel — not mapped to a CalEvent; filtered out below
        return null;
      })
      .filter((e): e is CalEvent => e !== null),
  }));
}

/* ── Helpers ─────────────────────────────────────────────────────── */

function fmtHour(h: number): string {
  const hour = Math.floor(h);
  const min = Math.round((h - hour) * 60);
  const ampm = hour >= 12 ? "PM" : "AM";
  const h12 = hour > 12 ? hour - 12 : hour === 0 ? 12 : hour;
  return `${h12}:${min.toString().padStart(2, "0")} ${ampm}`;
}

function fmtDate(d: Date): string {
  return d.toLocaleDateString("en-US", {
    weekday: "short", month: "short", day: "numeric", timeZone: "UTC",
  });
}

function nightsBetween(a: string, b: string): number {
  return Math.round(
    (new Date(b + "T12:00:00Z").getTime() - new Date(a + "T12:00:00Z").getTime()) /
      (1000 * 60 * 60 * 24)
  );
}

const categoryColors: Record<string, string> = {
  Culture: "#6366f1",
  "Food & Drink": "#f59e0b",
  Outdoor: "#10b981",
};
const placeTypeIcons: Record<string, string> = {
  Landmark: "🗺️", Museum: "🏛️", Market: "🛍️", Nature: "🌿",
};

/* ── Page ────────────────────────────────────────────────────────── */

export default async function ItineraryPage({ params }: Props) {
  const { id } = await params;
  const plan = await getPlanById(id);
  if (!plan) notFound();

  const hasDates = plan.departDate && plan.returnDate;
  let schedule: DayPlan[] | null = null;
  if (hasDates) {
    if (plan.scheduleJson) {
      try {
        const claudeDays = JSON.parse(plan.scheduleJson) as ClaudeScheduleDay[];
        schedule = claudeScheduleToDayPlans(claudeDays, plan.activities, plan.places);
      } catch {
        // Corrupt JSON — fall through to mechanical schedule
        console.error("[itinerary] Failed to parse schedule_json, using fallback");
      }
    }
    // Fall back to mechanical schedule for old plans or when Claude failed
    if (!schedule) {
      schedule = buildSchedule(plan.activities, plan.places, plan.departDate!, plan.returnDate!);
    }
  }

  const nights = hasDates ? nightsBetween(plan.departDate!, plan.returnDate!) : null;

  const dateLabel = hasDates
    ? new Date(plan.departDate! + "T12:00:00Z").toLocaleDateString("en-US", {
        month: "short", day: "numeric", timeZone: "UTC",
      }) +
      " → " +
      new Date(plan.returnDate! + "T12:00:00Z").toLocaleDateString("en-US", {
        month: "short", day: "numeric", year: "numeric", timeZone: "UTC",
      })
    : null;

  return (
    <div className={styles.page}>
      {/* Header */}
      <header className={styles.header}>
        <Link
          href={`/plan?destination=${encodeURIComponent(plan.destination)}${plan.departDate ? `&depart=${plan.departDate}` : ""}${plan.returnDate ? `&return=${plan.returnDate}` : ""}`}
          className={styles.back}
        >
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none"
            stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <line x1="19" y1="12" x2="5" y2="12" /><polyline points="12 19 5 12 12 5" />
          </svg>
          Back
        </Link>
        <div className={styles.headerText}>
          <p className={styles.headerLabel}>
            {dateLabel ? `${dateLabel} · ${nights} night${nights === 1 ? "" : "s"}` : "Your plan"}
          </p>
          <h1 className={styles.destination}>Trip to {plan.destination}</h1>
        </div>
      </header>

      <main className={styles.main}>
        {/* Summary chips */}
        <div className={styles.summaryStrip}>
          <SummaryChip icon="🏨" count={plan.hotels.length} label="hotel" />
          <SummaryChip icon="🎯" count={plan.activities.length} label="activity" plural="activities" />
          <SummaryChip icon="📍" count={plan.places.length} label="place" />
        </div>

        {/* ── Calendar ── */}
        {schedule && (
          <section className={styles.calSection}>
            <h2 className={styles.calTitle}>Day-by-day itinerary</h2>
            <div className={styles.calDays}>
              {schedule.map((day) => {
                const isFree =
                  !day.isArrival &&
                  !day.isDeparture &&
                  day.events.length === 0;

                return (
                  <div
                    key={day.dayNum}
                    className={`${styles.dayCard} ${day.isArrival ? styles.arrivalDay : ""} ${day.isDeparture ? styles.departureDay : ""} ${isFree ? styles.freeDay : ""}`}
                  >
                    {/* Day header */}
                    <div className={styles.dayHeader}>
                      <span className={styles.dayNum}>Day {day.dayNum}</span>
                      <span className={styles.dayDate}>{fmtDate(day.date)}</span>
                      {day.isArrival && <span className={`${styles.dayBadge} ${styles.badgeArrival}`}>Arrival</span>}
                      {day.isDeparture && <span className={`${styles.dayBadge} ${styles.badgeDeparture}`}>Departure</span>}
                      {isFree && <span className={`${styles.dayBadge} ${styles.badgeFree}`}>Free day</span>}
                    </div>

                    {/* Free day — no timeline */}
                    {isFree && (
                      <p className={styles.freeDayText}>🌴 Explore freely — nothing scheduled</p>
                    )}

                    {/* Timeline */}
                    {!isFree && (
                      <div className={styles.timeline}>
                        {day.events.map((ev, ei) => {
                          if (ev.kind === "arrival") {
                            return (
                              <div key={ei} className={styles.milestone}>
                                <span className={styles.milestoneTime}>3:00 PM</span>
                                <span className={styles.milestoneDot}>✈</span>
                                <span className={styles.milestoneLabel}>Arrive in {plan.destination}</span>
                              </div>
                            );
                          }
                          if (ev.kind === "departure") {
                            return (
                              <div key={ei} className={styles.milestone}>
                                <span className={styles.milestoneTime}>12:00 PM</span>
                                <span className={styles.milestoneDot}>🏠</span>
                                <span className={styles.milestoneLabel}>Check out &amp; depart</span>
                              </div>
                            );
                          }
                          if (ev.kind === "activity") {
                            const color = categoryColors[ev.item.category] ?? "#6b7280";
                            return (
                              <div key={ei} className={styles.timelineEvent}>
                                <div className={styles.timePair}>
                                  <span className={styles.timeStart}>{fmtHour(ev.start)}</span>
                                  <span className={styles.timeEnd}>{fmtHour(ev.end)}</span>
                                </div>
                                <div className={styles.track}>
                                  <div className={styles.trackDot} style={{ background: color }} />
                                  <div className={styles.trackLine} />
                                  <div className={styles.trackDot} style={{ background: color, opacity: 0.35 }} />
                                </div>
                                <div className={styles.eventCard}>
                                  <div className={styles.eventTop}>
                                    <span className={styles.eventIcon}>🎯</span>
                                    <h3 className={styles.eventName}>{ev.item.name}</h3>
                                    <span className={styles.eventBadge} style={{ background: color + "1a", color }}>{ev.item.category}</span>
                                  </div>
                                  <p className={styles.eventMeta}>
                                    2 hrs
                                    {ev.item.price !== null && <> · <strong>${ev.item.price}</strong>/person</>}
                                    {ev.item.price === null && <> · <span className={styles.free}>Free</span></>}
                                  </p>
                                </div>
                              </div>
                            );
                          }
                          if (ev.kind === "place") {
                            const icon = placeTypeIcons[ev.item.type] ?? "📌";
                            return (
                              <div key={ei} className={styles.timelineEvent}>
                                <div className={styles.timePair}>
                                  <span className={styles.timeStart}>{fmtHour(ev.start)}</span>
                                  <span className={styles.timeEnd}>{fmtHour(ev.end)}</span>
                                </div>
                                <div className={styles.track}>
                                  <div className={styles.trackDot} style={{ background: "#f59e0b" }} />
                                  <div className={styles.trackLine} />
                                  <div className={styles.trackDot} style={{ background: "#f59e0b", opacity: 0.35 }} />
                                </div>
                                <div className={styles.eventCard}>
                                  <div className={styles.eventTop}>
                                    <span className={styles.eventIcon}>{icon}</span>
                                    <h3 className={styles.eventName}>{ev.item.name}</h3>
                                    {ev.item.mustSee && <span className={styles.mustSee}>Must-see</span>}
                                  </div>
                                  <p className={styles.eventMeta}>
                                    2 hrs · {ev.item.type}
                                  </p>
                                </div>
                              </div>
                            );
                          }
                        })}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </section>
        )}

        {/* Hotels detail */}
        {plan.hotels.length > 0 && (
          <section className={styles.section}>
            <div className={styles.sectionHeader}>
              <span>🏨</span>
              <h2 className={styles.sectionTitle}>Hotels</h2>
            </div>
            <div className={styles.cardGrid}>
              {plan.hotels.map((h) => <HotelCard key={h.id} hotel={h} />)}
            </div>
          </section>
        )}

        <p className={styles.planId}>Plan ID: {plan.id}</p>
      </main>
    </div>
  );
}

/* ── Sub-components ──────────────────────────────────────────────── */

function SummaryChip({ icon, count, label, plural }: { icon: string; count: number; label: string; plural?: string }) {
  if (count === 0) return null;
  const text = count === 1 ? `1 ${label}` : `${count} ${plural ?? label + "s"}`;
  return (
    <div className={styles.chip}><span>{icon}</span><span>{text}</span></div>
  );
}

function StarRating({ stars }: { stars: number }) {
  return (
    <span className={styles.stars} aria-label={`${stars} stars`}>
      {Array.from({ length: 5 }, (_, i) => (
        <span key={i} className={i < stars ? styles.starFilled : styles.starEmpty}>★</span>
      ))}
    </span>
  );
}

function HotelCard({ hotel }: { hotel: Hotel }) {
  return (
    <article className={styles.card}>
      <div className={styles.cardTop}>
        <div>
          <h3 className={styles.cardTitle}>{hotel.name}</h3>
          <p className={styles.cardSub}>{hotel.neighborhood}</p>
        </div>
        <div className={styles.price}>
          <span className={styles.priceAmount}>${hotel.pricePerNight}</span>
          <span className={styles.priceLabel}>/night</span>
        </div>
      </div>
      <StarRating stars={hotel.stars} />
      <div className={styles.ratingRow}>
        <span className={styles.ratingBadge}>{hotel.rating}</span>
        <span className={styles.reviewCount}>{hotel.reviewCount.toLocaleString()} reviews</span>
      </div>
      <div className={styles.tagList}>
        {hotel.amenities.map((a) => <span key={a} className={styles.tag}>{a}</span>)}
      </div>
    </article>
  );
}
