import Link from "next/link";
import { getDestinationData } from "@/lib/mock-data";
import { getActivitiesForDestination } from "@/lib/activities";
import SelectablePlanGrid from "./SelectablePlanGrid";
import styles from "./page.module.css";

interface PlanPageProps {
  searchParams: Promise<{ destination?: string; depart?: string; return?: string }>;
}

export default async function PlanPage({ searchParams }: PlanPageProps) {
  const { destination, depart, return: returnDate } = await searchParams;
  const dest = destination?.trim() || "your destination";

  const [mockData, activities] = await Promise.all([
    Promise.resolve(getDestinationData(dest)),
    getActivitiesForDestination(dest),
  ]);
  const data = { ...mockData, activities };

  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <Link href="/" className={styles.back}>
          <svg
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            <line x1="19" y1="12" x2="5" y2="12" />
            <polyline points="12 19 5 12 12 5" />
          </svg>
          Back
        </Link>
        <div className={styles.headerText}>
          <p className={styles.headerLabel}>Exploring</p>
          <h1 className={styles.destination}>{dest}</h1>
        </div>
      </header>

      <SelectablePlanGrid destination={dest} data={data} departDate={depart} returnDate={returnDate} />
    </div>
  );
}
