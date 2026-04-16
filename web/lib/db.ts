import { Pool } from "pg";

type GlobalWithPool = typeof globalThis & { __fs_pool?: Pool };

function createPool(): Pool {
  const connectionString =
    process.env.DATABASE_URL?.trim() || process.env.SUPABASE_DB_URL?.trim();
  if (!connectionString) {
    throw new Error(
      "Set DATABASE_URL or SUPABASE_DB_URL (Postgres pooler URI, e.g. from Supabase Connect)",
    );
  }
  return new Pool({
    connectionString,
    max: 8,
    idleTimeoutMillis: 30_000,
    connectionTimeoutMillis: 15_000,
    ssl: { rejectUnauthorized: false },
  });
}

export function getPool(): Pool {
  const g = globalThis as GlobalWithPool;
  if (!g.__fs_pool) {
    g.__fs_pool = createPool();
  }
  return g.__fs_pool;
}
