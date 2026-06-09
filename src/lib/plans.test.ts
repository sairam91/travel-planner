import { describe, it, expect, vi } from "vitest";
import { types } from "cassandra-driver";
import { createPlan, getPlanById } from "./plans";
import { getDestinationData } from "./mock-data";

const { batchMock, executeMock } = vi.hoisted(() => ({
  batchMock: vi.fn(),
  executeMock: vi.fn(),
}));

vi.mock("./cassandra", () => ({
  getCassandraClient: vi.fn(async () => ({
    batch: batchMock,
    execute: executeMock,
  })),
}));

describe("createPlan", () => {
  it("inserts into both tables in a single batch and returns the new id", async () => {
    batchMock.mockResolvedValue(undefined);

    const id = await createPlan({
      destination: "Lisbon",
      hotelIds: ["h1"],
      activityIds: ["a1", "a2"],
      placeIds: ["p1"],
      departDate: "2026-07-01",
      returnDate: "2026-07-04",
      scheduleJson: '[{"dayNum":1}]',
    });

    // Returned id is a valid UUID
    expect(() => types.Uuid.fromString(id)).not.toThrow();

    expect(batchMock).toHaveBeenCalledTimes(1);
    const [statements, options] = batchMock.mock.calls[0];
    expect(options).toEqual({ prepare: true });
    expect(statements).toHaveLength(2);

    const [plansInsert, byDestInsert] = statements;
    expect(plansInsert.query).toContain("INSERT INTO travel.plans");
    expect(plansInsert.params[0].toString()).toBe(id);
    expect(plansInsert.params[1]).toBe("Lisbon");
    expect(plansInsert.params[2]).toBeInstanceOf(Date);
    expect(plansInsert.params[3]).toEqual(["h1"]);
    expect(plansInsert.params[4]).toEqual(["a1", "a2"]);
    expect(plansInsert.params[5]).toEqual(["p1"]);
    expect(plansInsert.params[6]).toBe("2026-07-01");
    expect(plansInsert.params[7]).toBe("2026-07-04");
    expect(plansInsert.params[8]).toBe('[{"dayNum":1}]');

    expect(byDestInsert.query).toContain("INSERT INTO travel.plans_by_destination");
    expect(byDestInsert.params[0]).toBe("Lisbon");
    expect(byDestInsert.params[2].toString()).toBe(id);
  });

  it("defaults dates and schedule to null when omitted", async () => {
    batchMock.mockResolvedValue(undefined);

    await createPlan({
      destination: "Lisbon",
      hotelIds: [],
      activityIds: [],
      placeIds: [],
    });

    const [statements] = batchMock.mock.calls[0];
    expect(statements[0].params[6]).toBeNull();
    expect(statements[0].params[7]).toBeNull();
    expect(statements[0].params[8]).toBeNull();
  });
});

describe("getPlanById", () => {
  const planId = "c7b9b9a0-0000-4000-8000-000000000001";
  const data = getDestinationData("Lisbon");

  function mockRow(row: Record<string, unknown> | null) {
    executeMock.mockResolvedValue({ first: () => row });
  }

  it("returns null when no plan exists", async () => {
    mockRow(null);
    expect(await getPlanById(planId)).toBeNull();
  });

  it("queries by parsed uuid", async () => {
    mockRow(null);
    await getPlanById(planId);

    const [query, params] = executeMock.mock.calls[0];
    expect(query).toContain("FROM travel.plans WHERE id = ?");
    expect(params[0]).toBeInstanceOf(types.Uuid);
    expect(params[0].toString()).toBe(planId);
  });

  it("resolves stored ids into full hotel, activity, and place objects", async () => {
    const createdAt = new Date("2026-06-01T10:00:00Z");
    mockRow({
      id: types.Uuid.fromString(planId),
      destination: "Lisbon",
      created_at: createdAt,
      hotel_ids: ["h1", "h2"],
      activity_ids: ["a1"],
      place_ids: ["p1", "p3"],
      depart_date: "2026-07-01",
      return_date: "2026-07-04",
      schedule_json: "[]",
    });

    const plan = await getPlanById(planId);

    expect(plan).not.toBeNull();
    expect(plan!.id).toBe(planId);
    expect(plan!.destination).toBe("Lisbon");
    expect(plan!.createdAt).toBe(createdAt);
    expect(plan!.departDate).toBe("2026-07-01");
    expect(plan!.returnDate).toBe("2026-07-04");
    expect(plan!.scheduleJson).toBe("[]");
    expect(plan!.hotels).toEqual([
      data.hotels.find((h) => h.id === "h1"),
      data.hotels.find((h) => h.id === "h2"),
    ]);
    expect(plan!.activities).toEqual([data.activities.find((a) => a.id === "a1")]);
    expect(plan!.places).toEqual([
      data.places.find((p) => p.id === "p1"),
      data.places.find((p) => p.id === "p3"),
    ]);
  });

  it("silently drops ids that no longer resolve to known items", async () => {
    mockRow({
      id: types.Uuid.fromString(planId),
      destination: "Lisbon",
      created_at: new Date(),
      hotel_ids: ["h1", "ghost-hotel"],
      activity_ids: ["ghost-activity"],
      place_ids: null,
      depart_date: null,
      return_date: null,
      schedule_json: null,
    });

    const plan = await getPlanById(planId);

    expect(plan!.hotels.map((h) => h.id)).toEqual(["h1"]);
    expect(plan!.activities).toEqual([]);
    expect(plan!.places).toEqual([]);
    expect(plan!.departDate).toBeNull();
    expect(plan!.returnDate).toBeNull();
    expect(plan!.scheduleJson).toBeNull();
  });
});
