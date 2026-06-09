import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { generateScheduleWithClaude, type ScheduleInput } from "./schedule";
import { getDestinationData } from "./mock-data";

const { createMock } = vi.hoisted(() => ({ createMock: vi.fn() }));

vi.mock("@anthropic-ai/sdk", () => ({
  default: class {
    messages = { create: createMock };
  },
}));

const data = getDestinationData("Lisbon");

const input: ScheduleInput = {
  destination: "Lisbon",
  departDate: "2026-07-01",
  returnDate: "2026-07-04",
  hotels: [data.hotels[0]],
  activities: [data.activities[0], data.activities[1]],
  places: [data.places[0]],
};

const validDays = [
  {
    date: "2026-07-01",
    dayNum: 1,
    isArrival: true,
    isDeparture: false,
    events: [
      { kind: "arrival", startHour: 15.0, endHour: 15.0, label: "Arrive in Lisbon" },
      { kind: "activity", itemId: "a1", startHour: 16.0, endHour: 18.0 },
    ],
  },
  {
    date: "2026-07-04",
    dayNum: 4,
    isArrival: false,
    isDeparture: true,
    events: [
      { kind: "departure", startHour: 11.0, endHour: 11.0, label: "Check out & depart" },
    ],
  },
];

function mockClaudeText(text: string) {
  createMock.mockResolvedValue({ content: [{ type: "text", text }] });
}

describe("generateScheduleWithClaude", () => {
  beforeEach(() => {
    vi.stubEnv("ANTHROPIC_API_KEY", "test-key");
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("returns null without calling the API when ANTHROPIC_API_KEY is unset", async () => {
    vi.stubEnv("ANTHROPIC_API_KEY", "");
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    expect(await generateScheduleWithClaude(input)).toBeNull();
    expect(createMock).not.toHaveBeenCalled();
    warn.mockRestore();
  });

  it("parses a valid JSON array response into schedule days", async () => {
    mockClaudeText(JSON.stringify(validDays));
    const result = await generateScheduleWithClaude(input);
    expect(result).toEqual(validDays);
  });

  it("extracts the JSON array when wrapped in markdown code fences", async () => {
    mockClaudeText("```json\n" + JSON.stringify(validDays) + "\n```");
    const result = await generateScheduleWithClaude(input);
    expect(result).toEqual(validDays);
  });

  it("sends the trip details and selected items to Claude", async () => {
    mockClaudeText(JSON.stringify(validDays));
    await generateScheduleWithClaude(input);

    expect(createMock).toHaveBeenCalledTimes(1);
    const request = createMock.mock.calls[0][0];
    expect(request.system).toContain("travel planner");
    const prompt = request.messages[0].content as string;
    expect(prompt).toContain("Lisbon");
    expect(prompt).toContain("2026-07-01");
    expect(prompt).toContain("2026-07-04");
    expect(prompt).toContain(data.hotels[0].name);
    expect(prompt).toContain(`id: "${data.activities[0].id}"`);
    expect(prompt).toContain(`id: "${data.places[0].id}"`);
  });

  it("notes when no hotels, activities, or places were selected", async () => {
    mockClaudeText(JSON.stringify(validDays));
    await generateScheduleWithClaude({
      ...input,
      hotels: [],
      activities: [],
      places: [],
    });
    const prompt = createMock.mock.calls[0][0].messages[0].content as string;
    expect(prompt).toContain("(none selected)");
  });

  it("returns null when Claude returns an empty array", async () => {
    const error = vi.spyOn(console, "error").mockImplementation(() => {});
    mockClaudeText("[]");
    expect(await generateScheduleWithClaude(input)).toBeNull();
    error.mockRestore();
  });

  it("returns null when the response is not valid JSON", async () => {
    const error = vi.spyOn(console, "error").mockImplementation(() => {});
    mockClaudeText("Sorry, I cannot create an itinerary.");
    expect(await generateScheduleWithClaude(input)).toBeNull();
    error.mockRestore();
  });

  it("returns null when the API call fails", async () => {
    const error = vi.spyOn(console, "error").mockImplementation(() => {});
    createMock.mockRejectedValue(new Error("rate limited"));
    expect(await generateScheduleWithClaude(input)).toBeNull();
    error.mockRestore();
  });
});
