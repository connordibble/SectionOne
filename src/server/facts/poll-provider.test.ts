// @vitest-environment node
import { describe, expect, it } from "vitest";
import { parseVerifiedPoll } from "./poll-provider";
import { pollWeekSchema } from "@/lib/facts/poll";
function sources() {
  const ranks = Array.from({ length: 25 }, (_, i) => ({ current: i + 1, points: 1000 - i, team: { location: `School ${i + 1}` } }));
  return {
    feed: { rankings: [{ type: "ap", name: "AP Top 25", date: "2026-09-08T07:00Z", season: { year: 2026 }, occurrence: { number: 2, displayValue: "Week 2" }, ranks }] },
    html: `Through Games SEP. 7, 2026<table><th>RANK</th><th>SCHOOL</th>${ranks.map((r) => `<tr><td>${r.current}</td><td>${r.team.location}</td><td>${r.points}</td></tr>`).join("")}</table>`,
  };
}
const now = new Date("2026-09-08T22:00:00Z");
describe("verified AP poll", () => {
  it("requires complete agreement and preserves a date without inventing a release time", () => {
    const { feed, html } = sources(); const poll = parseVerifiedPoll(feed, html, 2026, now);
    expect(poll.polls[0].releasedAt).toBe("2026-09-08");
    expect(poll.polls[0].ranks).toHaveLength(25);
    expect(poll.provenance?.verifiedUrl).toContain("ncaa.com");
  });
  it("rejects disagreement, partial tables, stale verification and future/wrong-season polls", () => {
    const { feed, html } = sources();
    expect(() => parseVerifiedPoll(feed, html.replace('School 3', 'Wrong School'), 2026, now)).toThrow();
    expect(() => parseVerifiedPoll(feed, html.replace('<tr><td>25</td><td>School 25</td><td>976</td></tr>', ''), 2026, now)).toThrow();
    expect(() => parseVerifiedPoll(feed, html.replace('SEP. 7', 'AUG. 7'), 2026, now)).toThrow();
    expect(() => parseVerifiedPoll(feed, html, 2027, now)).toThrow();
    expect(() => parseVerifiedPoll(feed, html, 2026, new Date('2026-09-07'))).toThrow();
  });
  it("rejects duplicated teams and accepts legitimate tied rankings", () => {
    const { feed, html } = sources(); const poll = parseVerifiedPoll(feed, html, 2026, now);
    poll.polls[0].ranks[14].rank = 14;
    expect(pollWeekSchema.safeParse(poll).success).toBe(true);
    poll.polls[0].ranks[14].team = poll.polls[0].ranks[13].team;
    expect(pollWeekSchema.safeParse(poll).success).toBe(false);
  });
});
