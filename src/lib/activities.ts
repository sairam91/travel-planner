import Anthropic from "@anthropic-ai/sdk";
import { getCassandraClient } from "./cassandra";
import { getDestinationData, type Activity } from "./mock-data";

// Prompt rationale:
//   1. "Return ONLY a valid JSON array" — prevents markdown code fences that break JSON.parse
//   2. Exact schema with typed category enum — matches existing UI colour-coding
//      (Culture=indigo, Food & Drink=amber, Outdoor=green, etc.)
//   3. "Real, well-known" anchor — Claude gives named venues, not generic descriptions
//   4. Price / duration constraints — produces data the itinerary builder can consume
//   5. 3+ categories requirement — guarantees variety across the selection grid
//   6. Kebab-case IDs — URL-safe slugs compatible with Cassandra activity_ids list
const buildPrompt = (destination: string) => `\
You are an expert travel curator with deep knowledge of cities worldwide.
Generate a list of 10 authentic activities for visitors to ${destination}.

Return ONLY a valid JSON array — no markdown, no code blocks, no explanation before or after.

Each item must match this schema exactly:
[
  {
    "id": "kebab-case-slug",
    "name": "Activity Name",
    "category": "Culture" | "Food & Drink" | "Outdoor" | "Entertainment" | "Shopping" | "Wellness",
    "duration": "X hrs",
    "price": 25,
    "currency": "USD",
    "description": "2-3 sentences: what the visitor does, what makes it special, and a practical tip."
  }
]

Rules:
- Use real, well-known activities and venues specific to ${destination}
- Include at least 3 different categories
- Mix price points: some free (price: null), some $10-50, some $50+
- Duration must be between 1-8 hours, written as "X hrs" (e.g. "2 hrs", "3.5 hrs")
- Descriptions written for a first-time visitor — specific and engaging
- IDs must be unique, URL-safe kebab-case slugs (e.g. "louvre-museum-visit", "seine-river-cruise")`;

export async function getActivitiesForDestination(
  destination: string
): Promise<Activity[]> {
  const key = destination.toLowerCase().trim();

  // 1. Check Cassandra cache
  try {
    const client = await getCassandraClient();
    const result = await client.execute(
      "SELECT activities_json, fetched_at FROM travel.destination_activities_cache WHERE destination = ?",
      [key],
      { prepare: true }
    );

    if (result.rows.length > 0) {
      return JSON.parse(result.rows[0].activities_json as string) as Activity[];
    }
  } catch (err) {
    console.error("[activities] Cache read error:", err);
    // Fall through to Claude call
  }

  // 2. No valid cache — call Claude API
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    console.warn("[activities] ANTHROPIC_API_KEY not set — falling back to mock data");
    return getDestinationData(destination).activities;
  }

  try {
    const anthropic = new Anthropic({ apiKey });

    const message = await anthropic.messages.create({
      model: "claude-haiku-4-5",
      max_tokens: 2048,
      messages: [{ role: "user", content: buildPrompt(destination) }],
    });

    const text =
      message.content[0].type === "text" ? message.content[0].text : "";

    // Haiku sometimes wraps output in markdown code fences despite instructions —
    // extract the first [...] array from the raw text before parsing.
    const jsonMatch = text.match(/\[[\s\S]*\]/);
    const activities = JSON.parse(jsonMatch ? jsonMatch[0] : text) as Activity[];

    // 3. Persist to Cassandra cache
    try {
      const client = await getCassandraClient();
      await client.execute(
        "INSERT INTO travel.destination_activities_cache (destination, activities_json, fetched_at) VALUES (?, ?, ?)",
        [key, JSON.stringify(activities), new Date()],
        { prepare: true }
      );
    } catch (err) {
      // Cache write failure is non-fatal
      console.error("[activities] Cache write error:", err);
    }

    return activities;
  } catch (err) {
    console.error("[activities] Claude API error:", err);
    // Fallback to mock data so the page still renders
    return getDestinationData(destination).activities;
  }
}
