import Anthropic from "@anthropic-ai/sdk";
import type { Activity, Place, Hotel } from "./mock-data";

/* ── Public types ─────────────────────────────────────────────────── */

export type ClaudeEventKind =
  | "arrival"
  | "departure"
  | "activity"
  | "place"
  | "meal"
  | "travel";

export interface ClaudeScheduleEvent {
  kind: ClaudeEventKind;
  itemId?: string;   // for "activity"/"place" — must match a provided ID
  startHour: number; // decimal, e.g. 9.0 = 9:00 AM, 13.5 = 1:30 PM
  endHour: number;
  label?: string;    // for "meal"/"travel"/"arrival"/"departure" display text
}

export interface ClaudeScheduleDay {
  date: string;       // "YYYY-MM-DD"
  dayNum: number;
  isArrival: boolean;
  isDeparture: boolean;
  events: ClaudeScheduleEvent[];
}

/* ── Input ────────────────────────────────────────────────────────── */

export interface ScheduleInput {
  destination: string;
  departDate: string;
  returnDate: string;
  hotels: Hotel[];
  activities: Activity[];
  places: Place[];
}

/* ── Prompt builders ──────────────────────────────────────────────── */

function buildSystemPrompt(): string {
  return `\
You are an expert travel planner who creates detailed, realistic day-by-day itineraries.
You produce only valid JSON — no markdown, no code fences, no explanation outside the JSON.
You respect opening hours, travel times between locations, and human energy levels.
Meal breaks are mandatory: breakfast ~8:00-9:00, lunch ~12:00-13:00, dinner ~19:00-20:30.
Arrival day: start activities no earlier than 15:30 (after 3pm hotel check-in).
Departure day: end all activities by 11:00 (checkout by noon).`;
}

function buildUserPrompt(input: ScheduleInput): string {
  const hotelList = input.hotels.length
    ? input.hotels
        .map((h) => `  - name: "${h.name}", neighborhood: ${h.neighborhood}`)
        .join("\n")
    : "  (none selected)";

  const activityList = input.activities.length
    ? input.activities
        .map(
          (a) =>
            `  - id: "${a.id}", name: "${a.name}", category: ${a.category}, duration: ${a.duration}, description: ${a.description}`
        )
        .join("\n")
    : "  (none selected)";

  const placeList = input.places.length
    ? input.places
        .map(
          (p) =>
            `  - id: "${p.id}", name: "${p.name}", type: ${p.type}, mustSee: ${p.mustSee}, description: ${p.description}`
        )
        .join("\n")
    : "  (none selected)";

  return `\
Create a day-by-day itinerary for a trip to ${input.destination}.
Travel dates: ${input.departDate} (arrival) to ${input.returnDate} (departure).

BOOKED HOTELS:
${hotelList}

BOOKED ACTIVITIES — schedule ALL of these, spread across non-arrival/departure days when possible:
${activityList}

PLACES TO VISIT — schedule ALL of these, prioritising mustSee:
${placeList}

Return ONLY a JSON array matching this exact schema (one object per day):
[
  {
    "date": "YYYY-MM-DD",
    "dayNum": 1,
    "isArrival": true,
    "isDeparture": false,
    "events": [
      { "kind": "arrival",   "startHour": 15.0, "endHour": 15.0,  "label": "Arrive in ${input.destination}" },
      { "kind": "meal",      "startHour": 19.0, "endHour": 20.5,  "label": "Welcome dinner" },
      { "kind": "activity",  "itemId": "a1",    "startHour": 16.0, "endHour": 18.0 },
      { "kind": "place",     "itemId": "p1",    "startHour": 10.0, "endHour": 12.0 },
      { "kind": "travel",    "startHour": 9.5,  "endHour": 10.0,  "label": "Taxi to Old Quarter" },
      { "kind": "departure", "startHour": 11.0, "endHour": 11.0,  "label": "Check out & depart" }
    ]
  }
]

Rules:
- Every event must have startHour and endHour as decimal numbers (9.0, 13.5, etc.).
- kind "activity" events MUST use an itemId exactly matching one of the BOOKED ACTIVITIES ids above.
- kind "place" events MUST use an itemId exactly matching one of the PLACES TO VISIT ids above.
- kind "meal" and "travel" events use a human-readable label; no itemId.
- kind "arrival" appears once on the isArrival day; kind "departure" appears once on the isDeparture day.
- Do NOT invent activities or places not listed above.
- Spread activities across full days; do not pile everything onto one day.
- Include realistic travel time (kind: "travel") when venues are far apart.
- Return exactly one day object per calendar day from ${input.departDate} through ${input.returnDate} inclusive.`;
}

/* ── Main export ──────────────────────────────────────────────────── */

export async function generateScheduleWithClaude(
  input: ScheduleInput
): Promise<ClaudeScheduleDay[] | null> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    console.warn(
      "[schedule] ANTHROPIC_API_KEY not set — skipping Claude schedule generation"
    );
    return null;
  }

  try {
    const anthropic = new Anthropic({ apiKey });

    const message = await anthropic.messages.create({
      model: "claude-haiku-4-5",
      max_tokens: 4096,
      system: buildSystemPrompt(),
      messages: [{ role: "user", content: buildUserPrompt(input) }],
    });

    const text =
      message.content[0].type === "text" ? message.content[0].text : "";

    // Extract JSON array — guards against accidental markdown code fences
    const jsonMatch = text.match(/\[[\s\S]*\]/);
    const parsed = JSON.parse(
      jsonMatch ? jsonMatch[0] : text
    ) as ClaudeScheduleDay[];

    if (!Array.isArray(parsed) || parsed.length === 0) {
      console.error("[schedule] Claude returned empty or non-array response");
      return null;
    }

    return parsed;
  } catch (err) {
    console.error("[schedule] Claude API error:", err);
    return null;
  }
}
