import { describe, expect, it } from "vitest";
import { POST } from "./route";

function ingestRequest(body: unknown) {
  return new Request("http://localhost/api/ingest", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

describe("POST /api/ingest", () => {
  it("rejects an unknown team slug with 404 instead of throwing", async () => {
    const response = await POST(ingestRequest({ teamSlug: "nope-football" }));

    expect(response.status).toBe(404);
    expect(await response.json()).toEqual({
      error: "Unknown team slug: nope-football",
    });
  });

  it("returns the normalized corpus for the default team", async () => {
    const response = await POST(ingestRequest({}));

    expect(response.status).toBe(200);
    const body = (await response.json()) as {
      teamSlug: string;
      documentCount: number;
      counts: Record<string, number>;
    };
    expect(body.teamSlug).toBe("texas-football");
    expect(body.documentCount).toBe(26);
    // The weekly package and the poll are retrievable, so chat can answer
    // "what happened this week" from the same content the page shows and cite
    // the outlet rather than us.
    expect(body.counts.press).toBe(6);
  });
});
