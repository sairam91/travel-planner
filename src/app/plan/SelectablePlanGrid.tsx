"use client";

import { useState, useCallback, useTransition } from "react";
import { useRouter } from "next/navigation";
import type { Hotel, Activity, Place, RentalCar, DestinationData } from "@/lib/mock-data";
import styles from "./SelectablePlanGrid.module.css";

const categoryColors: Record<string, string> = {
  Culture: "#6366f1",
  "Food & Drink": "#f59e0b",
  Outdoor: "#10b981",
};

const placeTypeIcons: Record<string, string> = {
  Landmark: "🗺️",
  Museum: "🏛️",
  Market: "🛍️",
  Nature: "🌿",
};

interface Props {
  destination: string;
  data: DestinationData;
  departDate?: string;
  returnDate?: string;
}

export default function SelectablePlanGrid({ destination, data, departDate, returnDate }: Props) {
  const router = useRouter();
  const [selectedHotels, setSelectedHotels] = useState<Set<string>>(new Set());
  const [selectedActivities, setSelectedActivities] = useState<Set<string>>(new Set());
  const [selectedPlaces, setSelectedPlaces] = useState<Set<string>>(new Set());
  const [selectedCars, setSelectedCars] = useState<Set<string>>(new Set());
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const toggle = useCallback(
    (set: Set<string>, setFn: React.Dispatch<React.SetStateAction<Set<string>>>, id: string) => {
      setFn((prev) => {
        const next = new Set(prev);
        next.has(id) ? next.delete(id) : next.add(id);
        return next;
      });
    },
    []
  );

  const totalSelected =
    selectedHotels.size + selectedActivities.size + selectedPlaces.size + selectedCars.size;

  const handleCreatePlan = () => {
    setError(null);
    startTransition(async () => {
      try {
        const res = await fetch("/api/plans", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            destination,
            hotelIds: [...selectedHotels],
            activityIds: [...selectedActivities],
            placeIds: [...selectedPlaces],
            departDate,
            returnDate,
          }),
        });

        if (!res.ok) throw new Error(await res.text());
        const { id } = await res.json();
        router.push(`/itinerary/${id}`);
      } catch (err) {
        setError((err as Error).message ?? "Something went wrong");
      }
    });
  };

  const selectionSummary = [
    selectedHotels.size && `${selectedHotels.size} hotel${selectedHotels.size > 1 ? "s" : ""}`,
    selectedActivities.size && `${selectedActivities.size} activit${selectedActivities.size > 1 ? "ies" : "y"}`,
    selectedPlaces.size && `${selectedPlaces.size} place${selectedPlaces.size > 1 ? "s" : ""}`,
    selectedCars.size && `${selectedCars.size} rental car${selectedCars.size > 1 ? "s" : ""}`,
  ]
    .filter(Boolean)
    .join(" · ");

  return (
    <>
      <main className={styles.main} style={{ paddingBottom: totalSelected > 0 ? "6rem" : "2rem" }}>
        {/* Hotels */}
        <section className={styles.section}>
          <div className={styles.sectionHeader}>
            <span className={styles.sectionIcon}>🏨</span>
            <h2 className={styles.sectionTitle}>Hotels</h2>
            <span className={styles.sectionCount}>{data.hotels.length} options</span>
          </div>
          <div className={styles.cardGrid}>
            {data.hotels.map((hotel) => (
              <HotelCard
                key={hotel.id}
                hotel={hotel}
                selected={selectedHotels.has(hotel.id)}
                onToggle={() => toggle(selectedHotels, setSelectedHotels, hotel.id)}
              />
            ))}
          </div>
        </section>

        {/* Things to Do */}
        <section className={styles.section}>
          <div className={styles.sectionHeader}>
            <span className={styles.sectionIcon}>🎯</span>
            <h2 className={styles.sectionTitle}>Things to Do</h2>
            <span className={styles.sectionCount}>{data.activities.length} activities</span>
          </div>
          <div className={styles.cardGrid}>
            {data.activities.map((activity) => (
              <ActivityCard
                key={activity.id}
                activity={activity}
                selected={selectedActivities.has(activity.id)}
                onToggle={() => toggle(selectedActivities, setSelectedActivities, activity.id)}
              />
            ))}
          </div>
        </section>

        {/* Places to See */}
        <section className={styles.section}>
          <div className={styles.sectionHeader}>
            <span className={styles.sectionIcon}>📍</span>
            <h2 className={styles.sectionTitle}>Places to See</h2>
            <span className={styles.sectionCount}>{data.places.length} spots</span>
          </div>
          <div className={styles.cardGrid}>
            {data.places.map((place) => (
              <PlaceCard
                key={place.id}
                place={place}
                selected={selectedPlaces.has(place.id)}
                onToggle={() => toggle(selectedPlaces, setSelectedPlaces, place.id)}
              />
            ))}
          </div>
        </section>

        {/* Rental Cars */}
        <section className={styles.section}>
          <div className={styles.sectionHeader}>
            <span className={styles.sectionIcon}>🚗</span>
            <h2 className={styles.sectionTitle}>Rental Cars</h2>
            <span className={styles.sectionCount}>{data.rentalCars.length} options</span>
          </div>
          <div className={styles.cardGrid}>
            {data.rentalCars.map((car) => (
              <RentalCarCard
                key={car.id}
                car={car}
                selected={selectedCars.has(car.id)}
                onToggle={() => toggle(selectedCars, setSelectedCars, car.id)}
              />
            ))}
          </div>
        </section>
      </main>

      {/* Sticky Create Plan bar */}
      <div className={`${styles.planBar} ${totalSelected > 0 ? styles.planBarVisible : ""}`}>
        <div>
          <p className={styles.planBarSummary}>{selectionSummary}</p>
          {error && <p className={styles.planBarError}>{error}</p>}
        </div>
        <button
          className={styles.createPlanBtn}
          onClick={handleCreatePlan}
          disabled={isPending}
        >
          {isPending ? (
            <>
              <span className={styles.spinner} aria-hidden="true" />
              Saving…
            </>
          ) : (
            <>
              Create Plan
              <svg
                xmlns="http://www.w3.org/2000/svg"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.5"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden="true"
              >
                <line x1="5" y1="12" x2="19" y2="12" />
                <polyline points="12 5 19 12 12 19" />
              </svg>
            </>
          )}
        </button>
      </div>
    </>
  );
}

/* ── Selectable card wrapper ──────────────────────────────────────── */

function SelectableCard({
  selected,
  onToggle,
  children,
}: {
  selected: boolean;
  onToggle: () => void;
  children: React.ReactNode;
}) {
  return (
    <article
      className={`${styles.card} ${selected ? styles.cardSelected : ""}`}
      onClick={onToggle}
      role="checkbox"
      aria-checked={selected}
      tabIndex={0}
      onKeyDown={(e) => (e.key === " " || e.key === "Enter") && onToggle()}
    >
      <div className={styles.checkmark} aria-hidden="true">
        {selected ? (
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="20 6 9 17 4 12" />
          </svg>
        ) : null}
      </div>
      {children}
    </article>
  );
}

/* ── Card variants ────────────────────────────────────────────────── */

function StarRating({ stars }: { stars: number }) {
  return (
    <span className={styles.stars} aria-label={`${stars} stars`}>
      {Array.from({ length: 5 }, (_, i) => (
        <span key={i} className={i < stars ? styles.starFilled : styles.starEmpty}>★</span>
      ))}
    </span>
  );
}

function HotelCard({ hotel, selected, onToggle }: { hotel: Hotel; selected: boolean; onToggle: () => void }) {
  return (
    <SelectableCard selected={selected} onToggle={onToggle}>
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
    </SelectableCard>
  );
}

function ActivityCard({ activity, selected, onToggle }: { activity: Activity; selected: boolean; onToggle: () => void }) {
  const color = categoryColors[activity.category] ?? "#6b7280";
  return (
    <SelectableCard selected={selected} onToggle={onToggle}>
      <div className={styles.cardTop}>
        <div>
          <h3 className={styles.cardTitle}>{activity.name}</h3>
          <p className={styles.cardSub}>{activity.duration}</p>
        </div>
        <span className={styles.categoryBadge} style={{ background: color + "1a", color }}>
          {activity.category}
        </span>
      </div>
      <p className={styles.description}>{activity.description}</p>
      <p className={styles.activityPrice}>
        {activity.price === null ? (
          <span className={styles.free}>Free</span>
        ) : (
          <><span className={styles.priceAmount}>${activity.price}</span><span className={styles.priceLabel}> per person</span></>
        )}
      </p>
    </SelectableCard>
  );
}

function PlaceCard({ place, selected, onToggle }: { place: Place; selected: boolean; onToggle: () => void }) {
  const icon = placeTypeIcons[place.type] ?? "📌";
  return (
    <SelectableCard selected={selected} onToggle={onToggle}>
      <div className={styles.cardTop}>
        <div>
          <h3 className={styles.cardTitle}>{place.name}</h3>
          <p className={styles.cardSub}>{icon} {place.type}</p>
        </div>
        {place.mustSee && <span className={styles.mustSeeBadge}>Must-see</span>}
      </div>
      <p className={styles.description}>{place.description}</p>
    </SelectableCard>
  );
}

function RentalCarCard({ car, selected, onToggle }: { car: RentalCar; selected: boolean; onToggle: () => void }) {
  return (
    <SelectableCard selected={selected} onToggle={onToggle}>
      <div className={styles.cardTop}>
        <div>
          <h3 className={styles.cardTitle}>{car.company}</h3>
          <p className={styles.cardSub}>{car.carType}</p>
        </div>
        <div className={styles.price}>
          <span className={styles.priceAmount}>${car.pricePerDay}</span>
          <span className={styles.priceLabel}>/day</span>
        </div>
      </div>
      <p className={styles.description}>{car.carModel}</p>
      <div className={styles.ratingRow}>
        <span className={styles.ratingBadge}>{car.rating}</span>
        <span className={styles.reviewCount}>{car.reviewCount.toLocaleString()} reviews</span>
      </div>
      <div className={styles.tagList}>
        {car.features.map((f) => <span key={f} className={styles.tag}>{f}</span>)}
      </div>
    </SelectableCard>
  );
}
