import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { NextRequest } from "next/server";
import { GET } from "./route";

const fetchMock = vi.fn();

function requestFor(query: string): NextRequest {
  return new NextRequest(`http://localhost/api/destination-image${query}`);
}

describe("GET /api/destination-image", () => {
  beforeEach(() => {
    vi.stubGlobal("fetch", fetchMock);
    vi.stubEnv("UNSPLASH_ACCESS_KEY", "test-access-key");
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.unstubAllEnvs();
  });

  it("returns a null url when the query is missing", async () => {
    const res = await GET(requestFor(""));
    expect(await res.json()).toEqual({ url: null });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("returns a null url when no access key is configured", async () => {
    vi.stubEnv("UNSPLASH_ACCESS_KEY", "");
    const res = await GET(requestFor("?q=Lisbon"));
    expect(await res.json()).toEqual({ url: null });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("treats the .env.example placeholder key as unconfigured", async () => {
    vi.stubEnv("UNSPLASH_ACCESS_KEY", "your_unsplash_access_key_here");
    const res = await GET(requestFor("?q=Lisbon"));
    expect(await res.json()).toEqual({ url: null });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("returns the first Unsplash result url", async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      json: async () => ({
        results: [{ urls: { regular: "https://images.unsplash.com/lisbon.jpg" } }],
      }),
    });

    const res = await GET(requestFor("?q=Lisbon%20Portugal"));

    expect(await res.json()).toEqual({
      url: "https://images.unsplash.com/lisbon.jpg",
    });
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toContain("query=Lisbon%20Portugal");
    expect(init.headers.Authorization).toBe("Client-ID test-access-key");
  });

  it("returns a null url when Unsplash responds with an error status", async () => {
    fetchMock.mockResolvedValue({ ok: false });
    const res = await GET(requestFor("?q=Lisbon"));
    expect(await res.json()).toEqual({ url: null });
  });

  it("returns a null url when there are no results", async () => {
    fetchMock.mockResolvedValue({ ok: true, json: async () => ({ results: [] }) });
    const res = await GET(requestFor("?q=NowhereLand"));
    expect(await res.json()).toEqual({ url: null });
  });

  it("returns a null url when the fetch throws", async () => {
    fetchMock.mockRejectedValue(new Error("network down"));
    const res = await GET(requestFor("?q=Lisbon"));
    expect(await res.json()).toEqual({ url: null });
  });
});
