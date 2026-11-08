// Applies db/schema.sql to whatever database DATABASE_URL points at.
// Run: node --env-file=.env.local scripts/db-migrate.mjs
import { readFile } from "node:fs/promises";
import { Client } from "pg";

const url = process.env.DATABASE_URL ?? process.env.POSTGRES_URL;
if (!url) {
  console.error("No DATABASE_URL. Run with --env-file=.env.local (vercel env pull .env.local).");
  process.exit(1);
}

const sql = await readFile(new URL("../db/schema.sql", import.meta.url), "utf8");
const client = new Client({
  connectionString: url,
  ssl: url.includes("sslmode=require") ? { rejectUnauthorized: false } : undefined,
});

await client.connect();
try {
  await client.query(sql);
  const { rows } = await client.query(
    `select table_name from information_schema.tables
      where table_schema = 'public' order by table_name`,
  );
  const summary = await client.query("select * from demand_summary");
  console.log("tables:", rows.map((r) => r.table_name).join(", "));
  console.log("demand:", JSON.stringify(summary.rows[0]));
} finally {
  await client.end();
}
