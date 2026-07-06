import { readdir, readFile } from "node:fs/promises";
import { join } from "node:path";
import postgres from "postgres";

const databaseUrl =
  process.env.DATABASE_URL ??
  process.env.POSTGRES_URL_NON_POOLING ??
  process.env.POSTGRES_PRISMA_URL ??
  process.env.POSTGRES_URL;

if (!databaseUrl) {
  throw new Error(
    "DATABASE_URL or POSTGRES_URL_NON_POOLING is required to apply migrations.",
  );
}

const migrationsDir = join(process.cwd(), "supabase", "migrations");

const sql = postgres(databaseUrl, { max: 1, prepare: false });

async function main() {
  try {
    const migrationFiles = (await readdir(migrationsDir))
      .filter((file) => file.endsWith(".sql"))
      .sort();

    for (const migrationFile of migrationFiles) {
      const migration = await readFile(join(migrationsDir, migrationFile), "utf8");
      await sql.unsafe(migration);
      console.log(`Migration aplicada: ${migrationFile}`);
    }
  } finally {
    await sql.end();
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
