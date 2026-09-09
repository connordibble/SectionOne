// @vitest-environment node
import { mkdtemp, readFile, readdir, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { expect, it } from "vitest";
import { teamConfigs } from "@/config/team";
import { refreshTeamSchedule } from "./schedule-refresh";

it("keeps verified broadcasts after failed or incomplete acquisition and replaces only a complete snapshot", async () => {
  const root = await mkdtemp(path.join(tmpdir(), "schedule-refresh-"));
  const file = path.join(root, "schedule.json");
  const team = teamConfigs["utah-state-football"];
  const games = [
    { id: 1, season: 2026, week: 1, startDate: "2026-09-05T23:00:00Z", homeTeam: "Utah State", awayTeam: "Idaho State" },
    { id: 2, season: 2026, week: 2, startDate: "2026-09-12T19:30:00Z", homeTeam: "Washington", awayTeam: "Utah State" },
  ];
  let mode = "ok";
  const fetchImpl: typeof fetch = async (url) => {
    if (String(url).includes("games/media")) {
      if (mode === "offline") return new Response(null, { status: 503 });
      return Response.json([{ id: 1, mediaType: "tv", outlet: mode === "changed" ? "ESPN" : "CBS" }]);
    }
    if (mode === "malformed") return Response.json({ games });
    return Response.json(mode === "partial" ? games.slice(0, 1) : games);
  };
  const args = { team, apiKey: "test-only", file, fetchImpl, now: new Date("2026-09-08T12:00:00Z") };
  try {
    await refreshTeamSchedule(args);
    const original = await readFile(file, "utf8");
    expect(JSON.parse(original).games[0].tv).toBe("CBS");
    for (mode of ["offline", "malformed", "partial"]) {
      await expect(refreshTeamSchedule(args)).rejects.toThrow();
      expect(await readFile(file, "utf8")).toBe(original);
      expect(await readdir(root)).toEqual(["schedule.json"]);
    }
    mode = "changed";
    await refreshTeamSchedule(args);
    expect(JSON.parse(await readFile(file, "utf8")).games[0].tv).toBe("ESPN");
  } finally { await rm(root, { recursive: true, force: true }); }
});
