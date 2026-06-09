import { describe, it, expect, vi } from "vitest";
import { NextRequest } from "next/server";
import { GET } from "./route";
import { getActivitiesForDestination } from "@/lib/activities";
import { getCassandraClient } from "@/lib/cassandra";
import type { Activity } from "@/lib/mock-data";

vi.mock("@/lib/activities", () => ({ getActivitiesForDestination: vi.fn() }));
vi.mock("@/lib/cassandra", () => ({ getCassandraClient: vi.fn() }));

const getActivitiesMock = vi.mocked(getActivitiesForDestination);
const getClientMock = vi.mocked(getCassandraClient);

const activities: Activity[] = [
  {
    id: "tram-28-ride",
    name: "Tram 28 Ride",
    category: "Culture",
    duration: "1 hrs",
    price: 3,
    currency: "USD",
    description: "Ride the iconic yellow tram.",
  },
];

function requestFor(query: string): NextRequest {
  return new NextRequest(`http://localhost/api/activities${query}`);
}

function mockCacheRows(rows: unknown[]) {
  const executeMock = vi.fn().mockResolvedValue({ rows });
  getClientMock.mockResolvedValue({ execute: executeMock } as never);
  return executeMock;
}

describe("GET /api/activities", () => {
  it("requires a destination query parameter", async () => {
    const res = await GET(requestFor(""));
    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({
      error: "destination query parameter is required",
    });
  });

  it("treats a whitespace-only destination as missing", async () => {
    const res = await GET(requestFor("?destination=%20%20"));
    expect(res.status).toBe(400);
  });

  it("returns activities with cached=false on a cache miss", async () => {
    mockCacheRows([]);
    getActivitiesMock.mockResolvedValue(activities);

    const res = await GET(requestFor("?destination=Lisbon"));

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({
      destination: "Lisbon",
      cached: false,
      activities,
    });
    expect(getActivitiesMock).toHaveBeenCalledWith("Lisbon");
  });

  it("returns cached=true when the cache holds the destination", async () => {
    const executeMock = mockCacheRows([{ fetched_at: new Date() }]);
    getActivitiesMock.mockResolvedValue(activities);

    const res = await GET(requestFor("?destination=%20LiSboN%20"));
    const body = await res.json();

    expect(body.cached).toBe(true);
    // Cache lookup uses the normalized lowercase key
    expect(executeMock).toHaveBeenCalledWith(
      expect.stringContaining("destination_activities_cache"),
      ["lisbon"],
      { prepare: true }
    );
  });

  it("still returns activities when the cache check fails", async () => {
    getClientMock.mockRejectedValue(new Error("cassandra down"));
    getActivitiesMock.mockResolvedValue(activities);

    const res = await GET(requestFor("?destination=Lisbon"));
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.cached).toBe(false);
    expect(body.activities).toEqual(activities);
  });
});
