import { drizzle as drizzlePg } from "drizzle-orm/postgres-js";
import { migrate as migratePg } from "drizzle-orm/postgres-js/migrator";
import postgres from "postgres";
import { mkdir } from "node:fs/promises";
import path from "node:path";
import { env } from "@/lib/env";
import * as schema from "./schema";

// One database handle per process. In dev without DATABASE_URL we use PGlite,
// an embedded Postgres, so there is nothing to install or run.

type Db = ReturnType<typeof drizzlePg<typeof schema>>;

const globalForDb = globalThis as unknown as { __jetjobDb?: Promise<Db> };

const migrationsFolder = path.join(process.cwd(), "drizzle");

async function create(): Promise<Db> {
  if (env.databaseUrl) {
    if (!/^postgres(ql)?:\/\//.test(env.databaseUrl)) {
      throw new Error(
        "DATABASE_URL must be a Postgres connection string (postgresql://user:password@host/db?sslmode=require). " +
          "For Neon, copy it from Dashboard > Connect, not the Data API (https://...) URL.",
      );
    }
    const client = postgres(env.databaseUrl, { max: 5, prepare: false, onnotice: () => {} });
    const db = drizzlePg(client, { schema });
    await migratePg(db, { migrationsFolder });
    return db;
  }
  const [{ PGlite }, { drizzle }, { migrate }] = await Promise.all([
    import("@electric-sql/pglite"),
    import("drizzle-orm/pglite"),
    import("drizzle-orm/pglite/migrator"),
  ]);
  const dataDir = path.join(process.cwd(), ".data", "pglite");
  await mkdir(dataDir, { recursive: true });
  const client = new PGlite(dataDir);
  const db = drizzle(client, { schema });
  await migrate(db, { migrationsFolder });
  // Both drivers expose the same query builder surface we use.
  return db as unknown as Db;
}

export function getDb(): Promise<Db> {
  globalForDb.__jetjobDb ??= create();
  return globalForDb.__jetjobDb;
}

export { schema };
