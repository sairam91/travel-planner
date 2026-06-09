// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, within, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import SelectablePlanGrid from "./SelectablePlanGrid";
import { getDestinationData } from "@/lib/mock-data";

const { pushMock } = vi.hoisted(() => ({ pushMock: vi.fn() }));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: pushMock }),
}));

const fetchMock = vi.fn();
const data = getDestinationData("Lisbon");

function renderGrid(props?: Partial<Parameters<typeof SelectablePlanGrid>[0]>) {
  return render(
    <SelectablePlanGrid destination="Lisbon" data={data} {...props} />
  );
}

describe("SelectablePlanGrid", () => {
  beforeEach(() => {
    vi.stubGlobal("fetch", fetchMock);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("renders all four sections with item counts", () => {
    renderGrid();

    expect(screen.getByRole("heading", { name: "Hotels" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Things to Do" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Places to See" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Rental Cars" })).toBeInTheDocument();

    const section = (name: string) =>
      within(screen.getByRole("heading", { name }).closest("section")!);
    expect(section("Hotels").getByText(`${data.hotels.length} options`)).toBeInTheDocument();
    expect(section("Things to Do").getByText(`${data.activities.length} activities`)).toBeInTheDocument();
    expect(section("Places to See").getByText(`${data.places.length} spots`)).toBeInTheDocument();
    expect(section("Rental Cars").getByText(`${data.rentalCars.length} options`)).toBeInTheDocument();

    const cards = screen.getAllByRole("checkbox");
    expect(cards).toHaveLength(
      data.hotels.length + data.activities.length + data.places.length + data.rentalCars.length
    );
    expect(cards.every((c) => c.getAttribute("aria-checked") === "false")).toBe(true);
  });

  it("marks free activities and shows prices for paid ones", () => {
    renderGrid();
    const free = data.activities.filter((a) => a.price === null);
    expect(screen.getAllByText("Free")).toHaveLength(free.length);
  });

  it("toggles a card's selection on click", async () => {
    const user = userEvent.setup();
    renderGrid();

    const hotelCard = screen
      .getByRole("heading", { name: data.hotels[0].name })
      .closest("article")!;

    await user.click(hotelCard);
    expect(hotelCard).toHaveAttribute("aria-checked", "true");
    expect(screen.getByText("1 hotel")).toBeInTheDocument();

    await user.click(hotelCard);
    expect(hotelCard).toHaveAttribute("aria-checked", "false");
  });

  it("toggles a card with the keyboard", async () => {
    const user = userEvent.setup();
    renderGrid();

    const card = screen
      .getByRole("heading", { name: data.activities[0].name })
      .closest("article")!;

    card.focus();
    await user.keyboard("{Enter}");
    expect(card).toHaveAttribute("aria-checked", "true");

    await user.keyboard(" ");
    expect(card).toHaveAttribute("aria-checked", "false");
  });

  it("pluralizes the selection summary across categories", async () => {
    const user = userEvent.setup();
    renderGrid();

    for (const hotel of data.hotels.slice(0, 2)) {
      await user.click(
        screen.getByRole("heading", { name: hotel.name }).closest("article")!
      );
    }
    await user.click(
      screen.getByRole("heading", { name: data.activities[0].name }).closest("article")!
    );
    await user.click(
      screen.getByRole("heading", { name: data.places[0].name }).closest("article")!
    );

    expect(
      screen.getByText("2 hotels · 1 activity · 1 place")
    ).toBeInTheDocument();
  });

  it("creates a plan with the selected ids and navigates to the itinerary", async () => {
    const user = userEvent.setup();
    fetchMock.mockResolvedValue({
      ok: true,
      json: async () => ({ id: "plan-123" }),
    });

    renderGrid({ departDate: "2026-07-01", returnDate: "2026-07-04" });

    await user.click(
      screen.getByRole("heading", { name: data.hotels[0].name }).closest("article")!
    );
    await user.click(
      screen.getByRole("heading", { name: data.activities[1].name }).closest("article")!
    );
    await user.click(screen.getByRole("button", { name: /create plan/i }));

    await waitFor(() => expect(pushMock).toHaveBeenCalledWith("/itinerary/plan-123"));

    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe("/api/plans");
    expect(init.method).toBe("POST");
    expect(JSON.parse(init.body)).toEqual({
      destination: "Lisbon",
      hotelIds: [data.hotels[0].id],
      activityIds: [data.activities[1].id],
      placeIds: [],
      departDate: "2026-07-01",
      returnDate: "2026-07-04",
    });
  });

  it("shows an error message when plan creation fails", async () => {
    const user = userEvent.setup();
    fetchMock.mockResolvedValue({
      ok: false,
      text: async () => "Failed to create plan",
    });

    renderGrid();

    await user.click(
      screen.getByRole("heading", { name: data.hotels[0].name }).closest("article")!
    );
    await user.click(screen.getByRole("button", { name: /create plan/i }));

    expect(await screen.findByText("Failed to create plan")).toBeInTheDocument();
    expect(pushMock).not.toHaveBeenCalled();
  });
});
