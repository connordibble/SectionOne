// @vitest-environment node
import { describe, expect, it, vi } from "vitest";
import type { Db } from "@/server/db/client";
import { recordLlmUsage } from "./usage";

type InsertedRow = {
  teamSlug: string;
  provider: string;
  model: string;
  inputTokens: number;
  outputTokens: number;
  costUsd: string | null;
  accepted: boolean;
};

// Minimal stand-in for the drizzle insert chain. Both persistence.ts and
// vector.ts already take a db override for exactly this reason, so no live
// database is needed to prove the ledger writes what it claims to.
function stubDb() {
  const rows: InsertedRow[] = [];
  const db = {
    insert: () => ({
      values: async (row: InsertedRow) => {
        rows.push(row);
      },
    }),
  } as unknown as Db;

  return { db, rows };
}

const usage = { inputTokens: 3_000, outputTokens: 300, model: "claude-haiku-4-5-20251001" };

describe("recordLlmUsage", () => {
  it("records a priced call with its cost", async () => {
    const { db, rows } = stubDb();

    await recordLlmUsage(
      { teamSlug: "texas-football", provider: "anthropic", usage, accepted: true },
      db,
    );

    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      teamSlug: "texas-football",
      provider: "anthropic",
      model: "claude-haiku-4-5-20251001",
      inputTokens: 3_000,
      outputTokens: 300,
      accepted: true,
    });
    expect(rows[0].costUsd).toBe("0.004500");
  });

  // A retry is two billed calls. Ledgering only the accepted one would
  // under-report by exactly the failure path, which is the expensive one.
  it("records rejected generations alongside the accepted one", async () => {
    const { db, rows } = stubDb();

    await recordLlmUsage(
      { teamSlug: "texas-football", provider: "anthropic", usage, accepted: false },
      db,
    );
    await recordLlmUsage(
      { teamSlug: "texas-football", provider: "anthropic", usage, accepted: true },
      db,
    );

    expect(rows).toHaveLength(2);
    expect(rows.map((row) => row.accepted)).toEqual([false, true]);
  });

  it("keeps the tokens when the model has no pricing entry", async () => {
    const { db, rows } = stubDb();
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});

    await recordLlmUsage(
      {
        teamSlug: "texas-football",
        provider: "openai",
        usage: { ...usage, model: "not-a-real-model-v0" },
        accepted: true,
      },
      db,
    );

    expect(rows).toHaveLength(1);
    expect(rows[0].costUsd).toBeNull();
    expect(rows[0].inputTokens).toBe(3_000);
    warn.mockRestore();
  });

  it("never throws when the insert fails", async () => {
    const failing = {
      insert: () => ({
        values: async () => {
          throw new Error("connection refused");
        },
      }),
    } as unknown as Db;
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});

    // Attribution is best-effort; enforcement lives on the Anthropic workspace.
    // A ledger failure must never take an answer down.
    await expect(
      recordLlmUsage(
        { teamSlug: "texas-football", provider: "anthropic", usage, accepted: true },
        failing,
      ),
    ).resolves.toBeUndefined();

    expect(warn).toHaveBeenCalled();
    warn.mockRestore();
  });

  it("is a no-op without a database", async () => {
    await expect(
      recordLlmUsage({
        teamSlug: "texas-football",
        provider: "anthropic",
        usage,
        accepted: true,
      }),
    ).resolves.toBeUndefined();
  });
});
