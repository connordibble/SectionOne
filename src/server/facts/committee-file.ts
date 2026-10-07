import { randomUUID } from "node:crypto";
import { mkdir, open, readFile, rename, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { committeeSnapshotSchema, compareCommitteeRankings, type CommitteeRanking } from "@/lib/postseason/committee";

// Writes the bundled snapshot. A new season starts empty; within a season a
// verified ranking replaces an older one and never the reverse.
export async function publishCommitteeFile(file: string, season: number, ranking: CommitteeRanking | null) {
  const next = committeeSnapshotSchema.parse({ season, ranking });
  await mkdir(path.dirname(file), { recursive: true });
  const lockPath = `${file}.lock`;
  const lock = await open(lockPath, "wx");
  const temporary = `${file}.${randomUUID()}.tmp`;
  try {
    let previous;
    try { previous = committeeSnapshotSchema.parse(JSON.parse(await readFile(file, "utf8"))); }
    catch (error) { if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error; }
    if (previous && previous.season > season) throw new Error("Committee snapshot regressed to an earlier season");
    if (previous?.season === season && previous.ranking) {
      if (!next.ranking) return previous;
      if (compareCommitteeRankings(next.ranking, previous.ranking) < 0) throw new Error("Committee ranking regressed; retained the current snapshot");
    }
    await writeFile(temporary, `${JSON.stringify(next, null, 2)}\n`, { flag: "wx" });
    await rename(temporary, file);
    return next;
  } finally {
    await rm(temporary, { force: true });
    await lock.close();
    await rm(lockPath, { force: true });
  }
}
