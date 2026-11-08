import { Pool } from "pg";

/**
 * One pooled connection per lambda. Neon hands us a pgbouncer URL; plain `pg`
 * speaks to it happily, though we keep `max` low because serverless instances
 * are many and short-lived.
 */
let pool: Pool | null = null;

export function db() {
  if (pool) return pool;
  const connectionString =
    process.env.DATABASE_URL ??
    process.env.POSTGRES_URL ??
    process.env.POSTGRES_PRISMA_URL ??
    "";
  if (!connectionString) throw new Error("No database URL configured.");
  pool = new Pool({
    connectionString,
    max: 3,
    idleTimeoutMillis: 10_000,
    connectionTimeoutMillis: 8_000,
    ssl: connectionString.includes("sslmode=require") ? { rejectUnauthorized: false } : undefined,
  });
  return pool;
}

export function hasDb() {
  return Boolean(
    process.env.DATABASE_URL ?? process.env.POSTGRES_URL ?? process.env.POSTGRES_PRISMA_URL,
  );
}

export async function query<T = Record<string, unknown>>(
  text: string,
  values: unknown[] = [],
): Promise<T[]> {
  const result = await db().query(text, values as never[]);
  return result.rows as T[];
}
