import { describe, it, expect, vi, beforeEach } from "vitest";
import { GET } from "./route";
import { getCassandraClient } from "@/lib/cassandra";

const { redisMock } = vi.hoisted(() => ({
  redisMock: {
    connect: vi.fn(),
    ping: vi.fn(),
    quit: vi.fn(),
  },
}));

vi.mock("@/lib/cassandra", () => ({ getCassandraClient: vi.fn() }));
vi.mock("redis", () => ({ createClient: vi.fn(() => redisMock) }));

const getClientMock = vi.mocked(getCassandraClient);

function mockHealthyCassandra() {
  getClientMock.mockResolvedValue({
    execute: vi.fn().mockResolvedValue({}),
  } as never);
}

function mockHealthyRedis() {
  redisMock.connect.mockResolvedValue(undefined);
  redisMock.ping.mockResolvedValue("PONG");
  redisMock.quit.mockResolvedValue(undefined);
}

describe("GET /api/health", () => {
  beforeEach(() => {
    mockHealthyCassandra();
    mockHealthyRedis();
  });

  it("returns 200 with all services ok", async () => {
    const res = await GET();

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ app: "ok", cassandra: "ok", redis: "ok" });
  });

  it("returns 503 with the error message when Cassandra is down", async () => {
    getClientMock.mockRejectedValue(new Error("no contact points"));

    const res = await GET();
    const body = await res.json();

    expect(res.status).toBe(503);
    expect(body.cassandra).toBe("error: no contact points");
    expect(body.redis).toBe("ok");
  });

  it("returns 503 when Redis is unreachable", async () => {
    redisMock.connect.mockRejectedValue(new Error("connection refused"));

    const res = await GET();
    const body = await res.json();

    expect(res.status).toBe(503);
    expect(body.cassandra).toBe("ok");
    expect(body.redis).toBe("error: connection refused");
  });

  it("always closes the Redis connection", async () => {
    redisMock.ping.mockRejectedValue(new Error("ping failed"));

    await GET();

    expect(redisMock.quit).toHaveBeenCalled();
  });
});
