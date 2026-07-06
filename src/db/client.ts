import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";

import * as schema from "@/db/schema";

let sqlClient: ReturnType<typeof postgres> | null = null;
let dbClient: ReturnType<typeof drizzle> | null = null;

export function getDb() {
  if (!process.env.DATABASE_URL) {
    throw new Error("DATABASE_URL is required to use the Postgres repository.");
  }

  if (!sqlClient) {
    sqlClient = postgres(process.env.DATABASE_URL, { prepare: false });
  }

  if (!dbClient) {
    dbClient = drizzle(sqlClient, { schema });
  }

  return dbClient;
}
