import { NextResponse } from "next/server";
import { createPlan } from "@/lib/plans";
import { generateScheduleWithClaude } from "@/lib/schedule";
import { getDestinationData } from "@/lib/mock-data";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { destination, hotelIds, activityIds, placeIds, departDate, returnDate } = body as {
      destination: string;
      hotelIds: string[];
      activityIds: string[];
      placeIds: string[];
      departDate?: string;
      returnDate?: string;
    };

    if (!destination?.trim()) {
      return NextResponse.json(
        { error: "destination is required" },
        { status: 400 }
      );
    }

    // Generate a Claude schedule when dates are provided
    let scheduleJson: string | null = null;
    if (departDate && returnDate) {
      // Resolve full objects from IDs so Claude gets rich context
      const data = getDestinationData(destination.trim());

      const hotels = (hotelIds ?? [])
        .map((hid) => data.hotels.find((h) => h.id === hid))
        .filter(Boolean) as typeof data.hotels;

      const activities = (activityIds ?? [])
        .map((aid) => data.activities.find((a) => a.id === aid))
        .filter(Boolean) as typeof data.activities;

      const places = (placeIds ?? [])
        .map((pid) => data.places.find((p) => p.id === pid))
        .filter(Boolean) as typeof data.places;

      const schedule = await generateScheduleWithClaude({
        destination: destination.trim(),
        departDate,
        returnDate,
        hotels,
        activities,
        places,
      });

      if (schedule) {
        scheduleJson = JSON.stringify(schedule);
      }
    }

    const id = await createPlan({
      destination: destination.trim(),
      hotelIds: hotelIds ?? [],
      activityIds: activityIds ?? [],
      placeIds: placeIds ?? [],
      departDate,
      returnDate,
      scheduleJson,
    });

    return NextResponse.json({ id }, { status: 201 });
  } catch (err) {
    console.error("[POST /api/plans]", err);
    return NextResponse.json(
      { error: "Failed to create plan" },
      { status: 500 }
    );
  }
}
