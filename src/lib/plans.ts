import { types } from "cassandra-driver";
import { getCassandraClient } from "./cassandra";
import {
  getDestinationData,
  type Hotel,
  type Activity,
  type Place,
} from "./mock-data";

export interface Plan {
  id: string;
  destination: string;
  createdAt: Date;
  departDate: string | null;
  returnDate: string | null;
  hotels: Hotel[];
  activities: Activity[];
  places: Place[];
  scheduleJson: string | null;
}

export interface CreatePlanInput {
  destination: string;
  hotelIds: string[];
  activityIds: string[];
  placeIds: string[];
  departDate?: string;
  returnDate?: string;
  scheduleJson?: string | null;
}

export async function createPlan(input: CreatePlanInput): Promise<string> {
  const client = await getCassandraClient();
  const id = types.Uuid.random();
  const now = new Date();

  await client.batch(
    [
      {
        query: `INSERT INTO travel.plans
                  (id, destination, created_at, hotel_ids, activity_ids, place_ids,
                   depart_date, return_date, schedule_json)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        params: [
          id,
          input.destination,
          now,
          input.hotelIds,
          input.activityIds,
          input.placeIds,
          input.departDate ?? null,
          input.returnDate ?? null,
          input.scheduleJson ?? null,
        ],
      },
      {
        query: `INSERT INTO travel.plans_by_destination
                  (destination, created_at, id)
                VALUES (?, ?, ?)`,
        params: [input.destination, now, id],
      },
    ],
    { prepare: true }
  );

  return id.toString();
}

export async function getPlanById(id: string): Promise<Plan | null> {
  const client = await getCassandraClient();

  const result = await client.execute(
    "SELECT * FROM travel.plans WHERE id = ?",
    [types.Uuid.fromString(id)],
    { prepare: true }
  );

  const row = result.first();
  if (!row) return null;

  const destination: string = row["destination"];
  const data = getDestinationData(destination);

  const hotelIds: string[] = row["hotel_ids"] ?? [];
  const activityIds: string[] = row["activity_ids"] ?? [];
  const placeIds: string[] = row["place_ids"] ?? [];

  return {
    id: row["id"].toString(),
    destination,
    createdAt: row["created_at"],
    departDate: row["depart_date"] ?? null,
    returnDate: row["return_date"] ?? null,
    scheduleJson: row["schedule_json"] ?? null,
    hotels: hotelIds
      .map((hid) => data.hotels.find((h) => h.id === hid))
      .filter((h): h is Hotel => h !== undefined),
    activities: activityIds
      .map((aid) => data.activities.find((a) => a.id === aid))
      .filter((a): a is Activity => a !== undefined),
    places: placeIds
      .map((pid) => data.places.find((p) => p.id === pid))
      .filter((p): p is Place => p !== undefined),
  };
}
