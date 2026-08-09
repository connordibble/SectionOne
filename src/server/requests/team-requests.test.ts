// @vitest-environment node
import { describe, expect, it, vi } from "vitest";
import type { Db } from "@/server/db/client";
import {
  normalizeTeamName,
  recordTeamRequest,
  teamRequestSchema,
} from "./team-requests";

type InsertedRow = {
  teamName: string;
  teamNameNormalized: string;
  email?: string;
  note?: string;
};

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

describe("teamRequestSchema", () => {
  it("accepts a team name on its own", () => {
    const parsed = teamRequestSchema.parse({ teamName: "  Toledo  " });

    expect(parsed.teamName).toBe("Toledo");
    expect(parsed.email).toBeUndefined();
  });

  // A blank email field is the common case, not an error — the request still
  // counts as demand.
  it("treats an empty email as absent rather than invalid", () => {
    expect(teamRequestSchema.parse({ teamName: "Toledo", email: "" }).email).toBeUndefined();
  });

  it("rejects a malformed email with fan-readable text", () => {
    const result = teamRequestSchema.safeParse({ teamName: "Toledo", email: "nope" });

    expect(result.success).toBe(false);
    expect(result.error?.issues[0]?.message).toBe("That email address does not look right.");
  });

  it("rejects a team name that is too short to group on", () => {
    const result = teamRequestSchema.safeParse({ teamName: "A" });

    expect(result.success).toBe(false);
    expect(result.error?.issues[0]?.message).toBe("Tell us which team you follow.");
  });
});

describe("normalizeTeamName", () => {
  it("groups case, punctuation, and filler-word variants", () => {
    const expected = "app state";

    expect(normalizeTeamName("App State")).toBe(expected);
    expect(normalizeTeamName("app-state")).toBe(expected);
    expect(normalizeTeamName("  APP   STATE!  ")).toBe(expected);
    expect(normalizeTeamName("the University of App State")).toBe(expected);
  });

  it("folds accents", () => {
    expect(normalizeTeamName("Nôtre Dâme")).toBe("notre dame");
  });

  // Documents the deliberate limit: abbreviations are not expanded, so these
  // stay separate rather than being merged by a guess.
  it("does not expand abbreviations into their long form", () => {
    expect(normalizeTeamName("Appalachian St.")).toBe("appalachian st");
    expect(normalizeTeamName("Appalachian St.")).not.toBe(normalizeTeamName("App State"));
  });
});

describe("recordTeamRequest", () => {
  it("stores the raw entry alongside the normalized form", async () => {
    const { db, rows } = stubDb();
    const info = vi.spyOn(console, "info").mockImplementation(() => {});

    const result = await recordTeamRequest(
      { teamName: "App State", email: "fan@example.com", note: undefined },
      db,
    );

    expect(result.stored).toBe(true);
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      teamName: "App State",
      teamNameNormalized: "app state",
      email: "fan@example.com",
    });
    info.mockRestore();
  });

  // The database is optional in this app. Demand data that only exists in a
  // dropped request is demand data that never existed, so the log line is the
  // floor rather than a nicety.
  it("still logs the request when there is no database", async () => {
    const info = vi.spyOn(console, "info").mockImplementation(() => {});

    const result = await recordTeamRequest({
      teamName: "Toledo",
      email: undefined,
      note: undefined,
    });

    expect(result.stored).toBe(false);
    expect(info).toHaveBeenCalledWith(expect.stringContaining("Toledo"));
    info.mockRestore();
  });

  it("reports not-stored rather than throwing when the insert fails", async () => {
    const failing = {
      insert: () => ({
        values: async () => {
          throw new Error("connection refused");
        },
      }),
    } as unknown as Db;
    const info = vi.spyOn(console, "info").mockImplementation(() => {});
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});

    const result = await recordTeamRequest(
      { teamName: "Toledo", email: undefined, note: undefined },
      failing,
    );

    expect(result.stored).toBe(false);
    expect(warn).toHaveBeenCalled();
    info.mockRestore();
    warn.mockRestore();
  });
});
