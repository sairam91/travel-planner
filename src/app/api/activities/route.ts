import { NextRequest, NextResponse } from "next/server";
import { getActivitiesForDestination } from "@/lib/activities";
import { getCassandraClient } from "@/lib/cassandra";

export async function GET(req: NextRequest) {
  const destination = req.nextUrl.searchParams.get("destination")?.trim();

  if (!destination) {
    return NextResponse.json(
      { error: "destination query parameter is required" },
      { status: 400 }
    );
  }

  // Check whether result came from cache for the response metadata
  const key = destination.toLowerCase().trim();
  let cached = false;

  try {
    const client = await getCassandraClient();
    const result = await client.execute(
      "SELECT fetched_at FROM travel.destination_activities_cache WHERE destination = ?",
      [key],
      { prepare: true }
    );

    if (result.rows.length > 0) {
      cached = true;
    }
  } catch {
    // Non-fatal — proceed without cache metadata
  }

  const activities = await getActivitiesForDestination(destination);

  return NextResponse.json({ destination, cached, activities });
}
