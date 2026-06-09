import { Client, auth, types } from "cassandra-driver";

const KEYSPACE = "travel";

// Singleton — reuse across hot-reloads in dev
declare global {
  // eslint-disable-next-line no-var
  var _cassandraClient: Client | undefined;
}

async function initSchema(client: Client): Promise<void> {
  // Keyspace
  await client.execute(`
    CREATE KEYSPACE IF NOT EXISTS ${KEYSPACE}
    WITH replication = {'class': 'SimpleStrategy', 'replication_factor': 1}
  `);

  // Primary plans table — look up a plan by its ID
  await client.execute(`
    CREATE TABLE IF NOT EXISTS ${KEYSPACE}.plans (
      id           uuid PRIMARY KEY,
      destination  text,
      created_at   timestamp,
      hotel_ids    list<text>,
      activity_ids list<text>,
      place_ids    list<text>,
      depart_date  text,
      return_date  text
    )
  `);

  // Add date columns to existing tables that pre-date this migration
  for (const col of ["depart_date text", "return_date text", "schedule_json text"]) {
    try {
      await client.execute(`ALTER TABLE ${KEYSPACE}.plans ADD ${col}`);
    } catch {
      // Column already exists — safe to ignore
    }
  }

  // Secondary lookup table — list all plans for a destination
  await client.execute(`
    CREATE TABLE IF NOT EXISTS ${KEYSPACE}.plans_by_destination (
      destination text,
      created_at  timestamp,
      id          uuid,
      PRIMARY KEY (destination, created_at, id)
    ) WITH CLUSTERING ORDER BY (created_at DESC, id ASC)
  `);

  // AI-generated activities cache — keyed by normalized destination name
  await client.execute(`
    CREATE TABLE IF NOT EXISTS ${KEYSPACE}.destination_activities_cache (
      destination     text PRIMARY KEY,
      activities_json text,
      fetched_at      timestamp
    )
  `);
}

export async function getCassandraClient(): Promise<Client> {
  if (global._cassandraClient) return global._cassandraClient;

  const user = process.env.CASSANDRA_USER;
  const password = process.env.CASSANDRA_PASSWORD;

  const client = new Client({
    contactPoints: [process.env.CASSANDRA_HOST ?? "localhost"],
    localDataCenter: process.env.CASSANDRA_DC ?? "datacenter1",
    // Auth is only sent when credentials are provided, so local auth-less
    // dev keeps working while Railway connects to an authenticated cluster.
    ...(user && password
      ? { authProvider: new auth.PlainTextAuthProvider(user, password) }
      : {}),
  });

  await client.connect();
  await initSchema(client);

  global._cassandraClient = client;
  return client;
}

export { types };
