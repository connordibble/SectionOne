import { describe, expect, it } from "vitest";
import { teamRequestRateLimit } from "./rate-limit";

describe("team request rate limit", () => {
  it("matches the documented edge policy", () => {
    expect(teamRequestRateLimit).toEqual({
      name: "team-requests",
      windowMs: 60_000,
      max: 10,
    });
  });
});
