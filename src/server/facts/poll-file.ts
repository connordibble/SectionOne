import { randomUUID } from "node:crypto";
import { mkdir, open, readFile, rename, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { comparePollSnapshots, pollWeekSchema, validatePollCutoff } from "@/lib/facts/poll";

export async function publishPollFile(file: string, input: unknown, now = new Date()) {
  const poll = pollWeekSchema.parse(input);
  validatePollCutoff(poll, now);
  await mkdir(path.dirname(file), { recursive: true });
  const lockPath = `${file}.lock`;
  const lock = await open(lockPath, "wx");
  const temporary = `${file}.${randomUUID()}.tmp`;
  try {
    let previous;
    try { previous = pollWeekSchema.parse(JSON.parse(await readFile(file, "utf8"))); }
    catch (error) { if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error; }
    if (previous && comparePollSnapshots(poll, previous) < 0) throw new Error("Poll regressed; retained the current snapshot");
    await writeFile(temporary, `${JSON.stringify(poll, null, 2)}\n`, { flag: "wx" });
    await rename(temporary, file);
    return poll;
  } finally {
    await rm(temporary, { force: true });
    await lock.close();
    await rm(lockPath, { force: true });
  }
}
