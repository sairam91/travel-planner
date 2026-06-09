import { describe, it, expect } from "vitest";
import { getDestinationData } from "./mock-data";

describe("getDestinationData", () => {
  it("returns the default dataset for any destination", () => {
    const tokyo = getDestinationData("Tokyo");
    const paris = getDestinationData("Paris");
    expect(tokyo).toBe(paris);
  });

  it("contains hotels, activities, places, and rental cars", () => {
    const data = getDestinationData("anywhere");
    expect(data.hotels.length).toBeGreaterThan(0);
    expect(data.activities.length).toBeGreaterThan(0);
    expect(data.places.length).toBeGreaterThan(0);
    expect(data.rentalCars.length).toBeGreaterThan(0);
  });

  it("has unique ids within each collection", () => {
    const data = getDestinationData("anywhere");
    for (const list of [data.hotels, data.activities, data.places, data.rentalCars]) {
      const ids = list.map((item) => item.id);
      expect(new Set(ids).size).toBe(ids.length);
    }
  });

  it("provides hotels with valid star ratings and prices", () => {
    const data = getDestinationData("anywhere");
    for (const hotel of data.hotels) {
      expect(hotel.stars).toBeGreaterThanOrEqual(1);
      expect(hotel.stars).toBeLessThanOrEqual(5);
      expect(hotel.pricePerNight).toBeGreaterThan(0);
      expect(hotel.amenities.length).toBeGreaterThan(0);
    }
  });

  it("supports free activities via a null price", () => {
    const data = getDestinationData("anywhere");
    const free = data.activities.filter((a) => a.price === null);
    const paid = data.activities.filter((a) => a.price !== null);
    expect(free.length).toBeGreaterThan(0);
    expect(paid.length).toBeGreaterThan(0);
  });

  it("flags at least one must-see place", () => {
    const data = getDestinationData("anywhere");
    expect(data.places.some((p) => p.mustSee)).toBe(true);
  });
});
