import { readFile } from "node:fs/promises";
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

const migrationPath = join(
  process.cwd(),
  "supabase",
  "migrations",
  "20260706170000_init_calculo_uerj.sql",
);

const sql = postgres(databaseUrl, { max: 1, prepare: false });

async function main() {
  const migration = await readFile(migrationPath, "utf8");

  try {
    await sql.unsafe(migration);
    console.log("Migration aplicada com sucesso.");
  } finally {
    await sql.end();
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
