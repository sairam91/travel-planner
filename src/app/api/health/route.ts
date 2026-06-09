import { NextResponse } from "next/server";
import { getCassandraClient } from "@/lib/cassandra";
import { createClient } from "redis";

export async function GET() {
  const status: Record<string, string> = {
    app: "ok",
    cassandra: "unknown",
    redis: "unknown",
  };

  // Check Cassandra
  try {
    const client = await getCassandraClient();
    await client.execute("SELECT now() FROM system.local");
    status.cassandra = "ok";
  } catch (err) {
    status.cassandra = `error: ${(err as Error).message}`;
  }

  // Check Redis
  const redisClient = createClient({ url: process.env.REDIS_URL });
  try {
    await redisClient.connect();
    await redisClient.ping();
    status.redis = "ok";
  } catch (err) {
    status.redis = `error: ${(err as Error).message}`;
  } finally {
    await redisClient.quit();
  }

  const allOk = Object.values(status).every((v) => v === "ok");
  return NextResponse.json(status, { status: allOk ? 200 : 503 });
}
