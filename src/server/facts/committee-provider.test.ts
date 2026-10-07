// @vitest-environment node
import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { fetchVerifiedCommitteeRanking, parseVerifiedCommitteeRanking } from "./committee-provider";

// The verification page is the real NCAA.com committee table through
// December 6, 2025, trimmed to the cutoff line and the table. The feed is
// built from it with ESPN's own spellings ("Miami", "USC"), so the two
// sources disagree on names exactly the way they do in production.
const html = readFileSync(path.join(process.cwd(), "src/test/fixtures/committee/ncaa-2025-final.html"), "utf8");
const espnNames: Record<string, string> = { "Miami (FL)": "Miami", "Southern Cal": "USC" };
const rows = [...html.matchAll(/<tr\b[^>]*>([\s\S]*?)<\/tr>/gi)]
  .map((match) => [...match[1].matchAll(/<td\b[^>]*>([\s\S]*?)<\/td>/gi)].map((cell) => cell[1].trim()))
  .filter((row) => row.length);
function feed(overrides: Record<string, unknown> = {}) {
  return { rankings: [
    { type: "ap", name: "AP Top 25", date: "2025-12-07T08:00Z", season: { year: 2025 }, occurrence: { number: 16, displayValue: "Final" }, ranks: [] },
    { type: "cfp", name: "Playoff Committee Rankings", date: "2025-12-07T08:00Z", season: { year: 2025 },
      occurrence: { number: 16, displayValue: "Week 16" },
      ranks: rows.map(([rank, school, record]) => ({ current: Number(rank), recordSummary: record, team: { location: espnNames[school] ?? school } })),
      ...overrides },
  ] };
}
const now = new Date("2025-12-08T02:00:00Z");

describe("verified committee ranking", () => {
  it("admits a ranking only when both sources agree on rank, school and record", () => {
    const ranking = parseVerifiedCommitteeRanking(feed(), html, 2025, now);
    expect(ranking?.ranks).toHaveLength(25);
    expect(ranking?.ranks[0]).toEqual({ rank: 1, team: "Indiana", record: "13-0" });
    expect(ranking?.ranks[9]).toEqual({ rank: 10, team: "Miami", record: "10-2" });
    expect(ranking).toMatchObject({ releasedAt: "2025-12-07", provenance: { throughDate: "2025-12-06" } });
  });

  it("treats an unpublished or other-season ranking as not released, not as a failure", () => {
    expect(parseVerifiedCommitteeRanking({ rankings: [feed().rankings[0]] }, undefined, 2025, now)).toBeNull();
    expect(parseVerifiedCommitteeRanking(feed(), html, 2026, now)).toBeNull();
  });

  it("rejects disagreement, missing verification, mismatched dates and future releases", () => {
    expect(() => parseVerifiedCommitteeRanking(feed(), html.replace("<td>Indiana</td>", "<td>Ohio</td>"), 2025, now)).toThrow("disagree");
    expect(() => parseVerifiedCommitteeRanking(feed(), html.replace("<td>13-0</td>", "<td>12-1</td>"), 2025, now)).toThrow("disagree");
    expect(() => parseVerifiedCommitteeRanking(feed(), undefined, 2025, now)).toThrow("verification");
    expect(() => parseVerifiedCommitteeRanking(feed(), html.replace("DEC. 6, 2025", "NOV. 1, 2025"), 2025, now)).toThrow("dates disagree");
    expect(() => parseVerifiedCommitteeRanking(feed(), html, 2025, new Date("2025-12-06T00:00:00Z"))).toThrow("Future");
    const partial = html.replace(/<tr>\s*<td>25<\/td>[\s\S]*?<\/tr>/, "");
    expect(() => parseVerifiedCommitteeRanking(feed(), partial, 2025, now)).toThrow("mismatched");
  });

  it("does not fetch the verification page when nothing is published", async () => {
    const requested: string[] = [];
    const fetchImpl = (async (url: string) => {
      requested.push(url);
      return new Response(JSON.stringify({ rankings: [feed().rankings[0]] }));
    }) as unknown as typeof fetch;
    expect(await fetchVerifiedCommitteeRanking(2025, now, fetchImpl)).toBeNull();
    expect(requested).toHaveLength(1);
  });
});
