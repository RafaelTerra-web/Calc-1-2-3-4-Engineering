import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";

import * as schema from "@/db/schema";

let sqlClient: ReturnType<typeof postgres> | null = null;
let dbClient: ReturnType<typeof drizzle> | null = null;

function getDatabaseUrl() {
  return (
    process.env.DATABASE_URL ??
    process.env.POSTGRES_URL_NON_POOLING ??
    process.env.POSTGRES_PRISMA_URL ??
    process.env.POSTGRES_URL
  );
}

export function getDb() {
  const databaseUrl = getDatabaseUrl();

  if (!databaseUrl) {
    throw new Error(
      "DATABASE_URL or POSTGRES_URL_NON_POOLING is required to use the Postgres repository.",
    );
  }

  if (!sqlClient) {
    sqlClient = postgres(databaseUrl, { prepare: false });
  }

  if (!dbClient) {
    dbClient = drizzle(sqlClient, { schema });
  }

  return dbClient;
}
