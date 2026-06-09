import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { getActivitiesForDestination } from "./activities";
import { getDestinationData, type Activity } from "./mock-data";

const { createMock, executeMock } = vi.hoisted(() => ({
  createMock: vi.fn(),
  executeMock: vi.fn(),
}));

vi.mock("@anthropic-ai/sdk", () => ({
  default: class {
    messages = { create: createMock };
  },
}));

vi.mock("./cassandra", () => ({
  getCassandraClient: vi.fn(async () => ({ execute: executeMock })),
}));

const claudeActivities: Activity[] = [
  {
    id: "fado-night-alfama",
    name: "Fado Night in Alfama",
    category: "Entertainment",
    duration: "3 hrs",
    price: 45,
    currency: "USD",
    description: "An evening of traditional Portuguese music.",
  },
  {
    id: "tram-28-ride",
    name: "Tram 28 Ride",
    category: "Culture",
    duration: "1 hrs",
    price: 3,
    currency: "USD",
    description: "Ride the iconic yellow tram through the old town.",
  },
];

function mockCacheMiss() {
  executeMock.mockImplementation(async (query: string) =>
    query.startsWith("SELECT") ? { rows: [] } : {}
  );
}

function mockClaudeText(text: string) {
  createMock.mockResolvedValue({ content: [{ type: "text", text }] });
}

describe("getActivitiesForDestination", () => {
  beforeEach(() => {
    vi.stubEnv("ANTHROPIC_API_KEY", "test-key");
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("returns cached activities without calling Claude", async () => {
    executeMock.mockResolvedValue({
      rows: [{ activities_json: JSON.stringify(claudeActivities), fetched_at: new Date() }],
    });

    const result = await getActivitiesForDestination("Lisbon");

    expect(result).toEqual(claudeActivities);
    expect(createMock).not.toHaveBeenCalled();
  });

  it("normalizes the destination to a lowercase trimmed cache key", async () => {
    executeMock.mockResolvedValue({
      rows: [{ activities_json: JSON.stringify(claudeActivities), fetched_at: new Date() }],
    });

    await getActivitiesForDestination("  LiSboN  ");

    expect(executeMock).toHaveBeenCalledWith(
      expect.stringContaining("SELECT"),
      ["lisbon"],
      { prepare: true }
    );
  });

  it("calls Claude on cache miss and persists the result", async () => {
    mockCacheMiss();
    mockClaudeText(JSON.stringify(claudeActivities));

    const result = await getActivitiesForDestination("Lisbon");

    expect(result).toEqual(claudeActivities);
    expect(createMock).toHaveBeenCalledTimes(1);
    const prompt = createMock.mock.calls[0][0].messages[0].content as string;
    expect(prompt).toContain("Lisbon");

    const insertCall = executeMock.mock.calls.find(([q]) =>
      (q as string).startsWith("INSERT")
    );
    expect(insertCall).toBeDefined();
    expect(insertCall![1][0]).toBe("lisbon");
    expect(JSON.parse(insertCall![1][1] as string)).toEqual(claudeActivities);
  });

  it("extracts the JSON array when Claude wraps it in code fences", async () => {
    mockCacheMiss();
    mockClaudeText("```json\n" + JSON.stringify(claudeActivities) + "\n```");

    const result = await getActivitiesForDestination("Lisbon");
    expect(result).toEqual(claudeActivities);
  });

  it("falls back to mock data when ANTHROPIC_API_KEY is unset", async () => {
    vi.stubEnv("ANTHROPIC_API_KEY", "");
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    mockCacheMiss();

    const result = await getActivitiesForDestination("Lisbon");

    expect(result).toEqual(getDestinationData("Lisbon").activities);
    expect(createMock).not.toHaveBeenCalled();
    warn.mockRestore();
  });

  it("falls back to mock data when the Claude call fails", async () => {
    const error = vi.spyOn(console, "error").mockImplementation(() => {});
    mockCacheMiss();
    createMock.mockRejectedValue(new Error("overloaded"));

    const result = await getActivitiesForDestination("Lisbon");

    expect(result).toEqual(getDestinationData("Lisbon").activities);
    error.mockRestore();
  });

  it("falls through to Claude when the cache read fails", async () => {
    const error = vi.spyOn(console, "error").mockImplementation(() => {});
    executeMock.mockRejectedValueOnce(new Error("cassandra down"));
    executeMock.mockResolvedValue({});
    mockClaudeText(JSON.stringify(claudeActivities));

    const result = await getActivitiesForDestination("Lisbon");

    expect(result).toEqual(claudeActivities);
    error.mockRestore();
  });

  it("still returns activities when the cache write fails", async () => {
    const error = vi.spyOn(console, "error").mockImplementation(() => {});
    executeMock.mockImplementation(async (query: string) => {
      if (query.startsWith("SELECT")) return { rows: [] };
      throw new Error("write timeout");
    });
    mockClaudeText(JSON.stringify(claudeActivities));

    const result = await getActivitiesForDestination("Lisbon");

    expect(result).toEqual(claudeActivities);
    error.mockRestore();
  });
});
