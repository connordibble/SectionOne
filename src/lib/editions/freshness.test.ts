import { expect, it } from "vitest";
import { editionNeedsReview } from "./freshness";

it("marks an edition for review at 48 hours, including invalid and future publication dates", () => {
  const published = "2026-09-08T14:00:00Z";
  const expires = Date.parse(published) + 48 * 3_600_000;
  expect(editionNeedsReview(published, expires - 1)).toBe(false);
  expect(editionNeedsReview(published, expires)).toBe(true);
  expect(editionNeedsReview("invalid", expires)).toBe(true);
  expect(editionNeedsReview("2099-01-01T00:00:00Z", expires)).toBe(true);
});
