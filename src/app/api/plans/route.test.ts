import { describe, it, expect, vi } from "vitest";
import { POST } from "./route";
import { createPlan } from "@/lib/plans";
import { generateScheduleWithClaude } from "@/lib/schedule";
import { getDestinationData } from "@/lib/mock-data";

vi.mock("@/lib/plans", () => ({ createPlan: vi.fn() }));
vi.mock("@/lib/schedule", () => ({ generateScheduleWithClaude: vi.fn() }));

const createPlanMock = vi.mocked(createPlan);
const generateScheduleMock = vi.mocked(generateScheduleWithClaude);

function postRequest(body: unknown): Request {
  return new Request("http://localhost/api/plans", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

describe("POST /api/plans", () => {
  it("rejects a missing destination with 400", async () => {
    const res = await POST(postRequest({ hotelIds: [], activityIds: [], placeIds: [] }));
    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ error: "destination is required" });
    expect(createPlanMock).not.toHaveBeenCalled();
  });

  it("rejects a whitespace-only destination with 400", async () => {
    const res = await POST(postRequest({ destination: "   " }));
    expect(res.status).toBe(400);
  });

  it("creates a plan without a schedule when dates are missing", async () => {
    createPlanMock.mockResolvedValue("new-plan-id");

    const res = await POST(
      postRequest({
        destination: "  Lisbon  ",
        hotelIds: ["h1"],
        activityIds: ["a1"],
        placeIds: ["p1"],
      })
    );

    expect(res.status).toBe(201);
    expect(await res.json()).toEqual({ id: "new-plan-id" });
    expect(generateScheduleMock).not.toHaveBeenCalled();
    expect(createPlanMock).toHaveBeenCalledWith({
      destination: "Lisbon",
      hotelIds: ["h1"],
      activityIds: ["a1"],
      placeIds: ["p1"],
      departDate: undefined,
      returnDate: undefined,
      scheduleJson: null,
    });
  });

  it("defaults omitted id lists to empty arrays", async () => {
    createPlanMock.mockResolvedValue("new-plan-id");

    const res = await POST(postRequest({ destination: "Lisbon" }));

    expect(res.status).toBe(201);
    expect(createPlanMock).toHaveBeenCalledWith(
      expect.objectContaining({ hotelIds: [], activityIds: [], placeIds: [] })
    );
  });

  it("generates a Claude schedule when both dates are provided", async () => {
    const data = getDestinationData("Lisbon");
    const schedule = [
      { date: "2026-07-01", dayNum: 1, isArrival: true, isDeparture: false, events: [] },
    ];
    generateScheduleMock.mockResolvedValue(schedule);
    createPlanMock.mockResolvedValue("new-plan-id");

    const res = await POST(
      postRequest({
        destination: "Lisbon",
        hotelIds: ["h1", "unknown-hotel"],
        activityIds: ["a1"],
        placeIds: ["p1"],
        departDate: "2026-07-01",
        returnDate: "2026-07-04",
      })
    );

    expect(res.status).toBe(201);
    // Unknown ids are dropped; known ids resolve to full objects
    expect(generateScheduleMock).toHaveBeenCalledWith({
      destination: "Lisbon",
      departDate: "2026-07-01",
      returnDate: "2026-07-04",
      hotels: [data.hotels.find((h) => h.id === "h1")],
      activities: [data.activities.find((a) => a.id === "a1")],
      places: [data.places.find((p) => p.id === "p1")],
    });
    expect(createPlanMock).toHaveBeenCalledWith(
      expect.objectContaining({ scheduleJson: JSON.stringify(schedule) })
    );
  });

  it("stores a null schedule when Claude generation fails", async () => {
    generateScheduleMock.mockResolvedValue(null);
    createPlanMock.mockResolvedValue("new-plan-id");

    const res = await POST(
      postRequest({
        destination: "Lisbon",
        hotelIds: [],
        activityIds: [],
        placeIds: [],
        departDate: "2026-07-01",
        returnDate: "2026-07-04",
      })
    );

    expect(res.status).toBe(201);
    expect(createPlanMock).toHaveBeenCalledWith(
      expect.objectContaining({ scheduleJson: null })
    );
  });

  it("skips schedule generation when only one date is provided", async () => {
    createPlanMock.mockResolvedValue("new-plan-id");

    await POST(postRequest({ destination: "Lisbon", departDate: "2026-07-01" }));

    expect(generateScheduleMock).not.toHaveBeenCalled();
  });

  it("returns 500 when plan creation fails", async () => {
    const error = vi.spyOn(console, "error").mockImplementation(() => {});
    createPlanMock.mockRejectedValue(new Error("cassandra down"));

    const res = await POST(postRequest({ destination: "Lisbon" }));

    expect(res.status).toBe(500);
    expect(await res.json()).toEqual({ error: "Failed to create plan" });
    error.mockRestore();
  });

  it("returns 500 on a malformed request body", async () => {
    const error = vi.spyOn(console, "error").mockImplementation(() => {});
    const res = await POST(
      new Request("http://localhost/api/plans", { method: "POST", body: "not json" })
    );
    expect(res.status).toBe(500);
    error.mockRestore();
  });
});
