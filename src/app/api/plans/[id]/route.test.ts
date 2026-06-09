import { describe, it, expect, vi } from "vitest";
import { GET } from "./route";
import { getPlanById } from "@/lib/plans";
import type { Plan } from "@/lib/plans";

vi.mock("@/lib/plans", () => ({ getPlanById: vi.fn() }));

const getPlanByIdMock = vi.mocked(getPlanById);

const request = new Request("http://localhost/api/plans/abc");
const params = (id: string) => ({ params: Promise.resolve({ id }) });

describe("GET /api/plans/[id]", () => {
  it("returns the plan as JSON when found", async () => {
    const plan: Plan = {
      id: "plan-1",
      destination: "Lisbon",
      createdAt: new Date("2026-06-01T10:00:00Z"),
      departDate: "2026-07-01",
      returnDate: "2026-07-04",
      hotels: [],
      activities: [],
      places: [],
      scheduleJson: null,
    };
    getPlanByIdMock.mockResolvedValue(plan);

    const res = await GET(request, params("plan-1"));

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({
      ...plan,
      createdAt: "2026-06-01T10:00:00.000Z",
    });
    expect(getPlanByIdMock).toHaveBeenCalledWith("plan-1");
  });

  it("returns 404 when the plan does not exist", async () => {
    getPlanByIdMock.mockResolvedValue(null);

    const res = await GET(request, params("missing"));

    expect(res.status).toBe(404);
    expect(await res.json()).toEqual({ error: "Plan not found" });
  });

  it("returns 500 when the lookup fails", async () => {
    const error = vi.spyOn(console, "error").mockImplementation(() => {});
    getPlanByIdMock.mockRejectedValue(new Error("bad uuid"));

    const res = await GET(request, params("not-a-uuid"));

    expect(res.status).toBe(500);
    expect(await res.json()).toEqual({ error: "Failed to fetch plan" });
    error.mockRestore();
  });
});
