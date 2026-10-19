// @vitest-environment node
import { describe, expect, it, vi } from "vitest";
import { fetchVerifiedPoll, parseVerifiedPoll, rankingFeedUrl } from "./poll-provider";
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
  it("requires complete rank agreement and preserves a date without inventing a release time", () => {
    const { feed, html } = sources(); const poll = parseVerifiedPoll(feed, html, 2026, now);
    expect(poll.polls[0].releasedAt).toBe("2026-09-08");
    expect(poll.polls[0].ranks).toHaveLength(25);
    expect(poll.provenance?.verifiedUrl).toContain("ncaa.com");
  });
  it("publishes all agreed ranks when an undisplayed vote total differs", () => {
    const { feed, html } = sources(); const report = vi.fn();
    const baseline = parseVerifiedPoll(feed, html, 2026, now);
    const changed = html.replace('<td>990</td>', '<td>991</td>');
    expect(parseVerifiedPoll(feed, changed, 2026, now, report)).toEqual(baseline);
    expect(report).toHaveBeenCalledExactlyOnceWith("poll-points-disagree");
  });
  it("still rejects conflicting ranks or a partial table despite vote differences", () => {
    const { feed, html } = sources(); const report = vi.fn();
    const changed = html.replace('<td>1000</td>', '<td>1001</td>');
    expect(() => parseVerifiedPoll(feed, changed.replace('<td>3</td><td>School 3', '<td>4</td><td>School 3'), 2026, now, report)).toThrow("Ranking sources disagree");
    expect(() => parseVerifiedPoll(feed, changed.replace('School 25', 'Wrong School'), 2026, now, report)).toThrow("Ranking sources disagree");
    expect(() => parseVerifiedPoll(feed, changed.replace('<tr><td>25</td><td>School 25</td><td>976</td></tr>', ''), 2026, now, report)).toThrow();
    expect(report).not.toHaveBeenCalled();
  });
  it.each(["", "unavailable", "-1", "1.5", "1,00"])("rejects malformed verification points: %s", (points) => {
    const { feed, html } = sources();
    expect(() => parseVerifiedPoll(feed, html.replace('<td>990</td>', `<td>${points}</td>`), 2026, now)).toThrow("Invalid verification points");
  });
  it("rejects invalid feed points and keeps reporting failures out of the decision", () => {
    const { feed, html } = sources();
    expect(parseVerifiedPoll(feed, html.replace('<td>990</td>', '<td>991</td>'), 2026, now,
      () => { throw new Error("logger failed"); }).polls[0].ranks).toHaveLength(25);
    feed.rankings[0].ranks[0].points = -1;
    expect(() => parseVerifiedPoll(feed, html, 2026, now)).toThrow();
  });
  it("logs a degradation during refresh without blocking verified ranks", async () => {
    const { feed, html } = sources();
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    try {
      const fetchImpl: typeof fetch = async (input) => new Response(String(input) === rankingFeedUrl
        ? JSON.stringify(feed) : html.replace('<td>990</td>', '<td>991</td>'));
      const poll = await fetchVerifiedPoll(2026, now, fetchImpl);
      expect(poll.polls[0].ranks).toHaveLength(25);
      expect(warn).toHaveBeenCalledOnce();
      expect(JSON.parse(warn.mock.calls[0][0])).toMatchObject({ severity: "degraded", scope: "facts/poll", message: "poll-points-disagree" });
    } finally { warn.mockRestore(); }
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
