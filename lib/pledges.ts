import { promises as fs } from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import type { PledgeAggregate } from "./types";

export type Pledge = {
  id: string;
  listingId: string;
  name: string;
  email: string;
  amountCents: number;
  note: string | null;
  at: string;
};

const DATA_DIR = process.env.PLEDGE_DIR ?? path.join(process.cwd(), ".data");
const FILE = path.join(DATA_DIR, "pledges.json");

// The prototype persists to a JSON file on disk. Serverless filesystems are
// read-only, so writes fall back to process memory: pledges survive the request
// but not a cold start. Point PLEDGE_DIR at a mounted volume, or swap this file
// for a database, before inviting real money.
let memory: Pledge[] = [];
let diskOk = true;

async function readAll(): Promise<Pledge[]> {
  if (!diskOk) return memory;
  try {
    const raw = await fs.readFile(FILE, "utf8");
    return JSON.parse(raw) as Pledge[];
  } catch {
    return memory;
  }
}

async function writeAll(pledges: Pledge[]): Promise<void> {
  memory = pledges;
  if (!diskOk) return;
  try {
    await fs.mkdir(DATA_DIR, { recursive: true });
    await fs.writeFile(FILE, JSON.stringify(pledges, null, 1), "utf8");
  } catch {
    diskOk = false;
  }
}

export const PLEDGE_MIN_CENTS = 500;
export const PLEDGE_MAX_CENTS = 100_000_000;

export function validatePledge(input: unknown): { ok: true; value: Omit<Pledge, "id" | "at"> } | { ok: false; error: string } {
  const body = (input ?? {}) as Record<string, unknown>;
  const listingId = typeof body.listingId === "string" ? body.listingId.trim() : "";
  const name = typeof body.name === "string" ? body.name.trim() : "";
  const email = typeof body.email === "string" ? body.email.trim().toLowerCase() : "";
  const note = typeof body.note === "string" ? body.note.trim().slice(0, 500) : "";
  const amountCents = Number(body.amountCents);

  if (!listingId) return { ok: false, error: "Pick a building first." };
  if (name.length < 1 || name.length > 80) return { ok: false, error: "Add the name to put on the pledge." };
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]{2,}$/.test(email)) return { ok: false, error: "That email doesn't look right." };
  if (!Number.isFinite(amountCents) || amountCents < PLEDGE_MIN_CENTS || amountCents > PLEDGE_MAX_CENTS) {
    return { ok: false, error: `Pledges run from $${PLEDGE_MIN_CENTS / 100} to $${PLEDGE_MAX_CENTS / 100}.` };
  }
  return { ok: true, value: { listingId, name, email, amountCents: Math.round(amountCents), note: note || null } };
}

export async function addPledge(input: Omit<Pledge, "id" | "at">): Promise<Pledge> {
  const pledge: Pledge = {
    ...input,
    id: crypto.randomUUID(),
    at: new Date().toISOString(),
  };
  const all = await readAll();
  all.push(pledge);
  await writeAll(all);
  return pledge;
}

function aggregate(list: Pledge[], listingId: string): PledgeAggregate {
  const rows = list.filter((p) => p.listingId === listingId);
  return {
    listingId,
    count: rows.length,
    totalCents: rows.reduce((sum, p) => sum + p.amountCents, 0),
    recent: rows
      .slice(-8)
      .reverse()
      .map((p) => ({ name: firstInitial(p.name), amountCents: p.amountCents, at: p.at })),
  };
}

function firstInitial(name: string): string {
  const parts = name.split(/\s+/).filter(Boolean);
  return parts.length > 1 ? `${parts[0]} ${parts[parts.length - 1][0]}.` : parts[0] ?? "Someone";
}

export async function aggregateFor(listingId: string): Promise<PledgeAggregate> {
  return aggregate(await readAll(), listingId);
}

export async function aggregateAll(): Promise<Record<string, PledgeAggregate>> {
  const all = await readAll();
  const out: Record<string, PledgeAggregate> = {};
  for (const id of new Set(all.map((p) => p.listingId))) out[id] = aggregate(all, id);
  return out;
}
