import { createHash, randomUUID } from "node:crypto";
import { mkdir, open, readFile, rename, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { isDeepStrictEqual } from "node:util";
import { z } from "zod";
import { editionPackageSchema, parseEditionRegistry, type EditionPackage } from "./contract";
import { preserveKeyOrder } from "./serialization";

export const editionDraftSchema = z.object({
  baseRevision: z.string().regex(/^[a-f0-9]{64}$/),
  edition: editionPackageSchema,
}).strict();

export function editionRevision(edition: EditionPackage): string {
  return createHash("sha256").update(JSON.stringify(editionPackageSchema.parse(edition))).digest("hex");
}

export async function readEditionRegistry(root: string) {
  return parseEditionRegistry(JSON.parse(await readFile(path.join(root, "data/editions/current.json"), "utf8")));
}

// A daily refresh may change only This week's stories, summary and story
// cutoff. The current edition remains the authority for every other field.
export function assertStoryRefresh(previous: EditionPackage, edition: EditionPackage) {
  if (edition.items.length !== 5) throw new Error("Story refresh requires five stories");
  const fixedFields = (value: EditionPackage) => Object.fromEntries(
    Object.entries(value).filter(([key]) => !["items", "summary", "storiesUpdatedAt"].includes(key)),
  );
  if (!isDeepStrictEqual(fixedFields(previous), fixedFields(edition))) {
    throw new Error("Story refresh cannot change fields outside items, summary and storiesUpdatedAt");
  }
}

export async function validateStoryRefresh(root: string, input: unknown) {
  const draft = editionDraftSchema.parse(input);
  const previous = (await readEditionRegistry(root))[draft.edition.teamSlug];
  if (!previous) throw new Error("Onboard the team before publishing an update");
  if (draft.baseRevision !== editionRevision(previous)) throw new Error("Stale draft: export the latest edition and reconcile changes");
  assertStoryRefresh(previous, draft.edition);
  return draft;
}

// Consumer-side import, with no knowledge of the producer's models or sources.
// A lock serializes writers; the revision check prevents stale drafts. Readers
// see the complete old or new registry through a same-directory atomic rename.
export async function publishEdition(root: string, input: unknown, now = new Date(), scope: "edition" | "stories" = "edition") {
  const { baseRevision, edition } = editionDraftSchema.parse(input);
  if (Date.parse(edition.storiesUpdatedAt ?? edition.publishedAt) > now.getTime()) throw new Error("Cannot publish a future edition");
  const directory = path.join(root, "data/editions");
  const lockPath = path.join(directory, ".publish.lock");
  const lock = await open(lockPath, "wx");
  const temporary = path.join(directory, `.current-${randomUUID()}.tmp`);
  try {
    const raw: unknown = JSON.parse(await readFile(path.join(directory, "current.json"), "utf8"));
    const registry = parseEditionRegistry(raw);
    const previous = registry[edition.teamSlug];
    if (!previous) throw new Error("Onboard the team before publishing an update");
    if (scope === "stories") {
      assertStoryRefresh(previous, edition);
      // A new check time alone must not claim a refreshed selection or create
      // a commit. Identical retries remain safe after successful publication.
      if (isDeepStrictEqual(previous.items, edition.items) && previous.summary === edition.summary) {
        return { status: "unchanged", revision: editionRevision(previous) };
      }
    }
    const revision = editionRevision(edition);
    if (revision === editionRevision(previous)) return { status: "unchanged", revision };
    if (baseRevision !== editionRevision(previous)) throw new Error("Stale draft: export the latest edition and reconcile changes");
    if (Date.parse(edition.publishedAt) < Date.parse(previous.publishedAt) || edition.weekOf < previous.weekOf) {
      throw new Error("Cannot replace a newer edition with an older package");
    }
    if (scope === "stories" && Date.parse(edition.storiesUpdatedAt ?? edition.publishedAt) < Date.parse(previous.storiesUpdatedAt ?? previous.publishedAt)) {
      throw new Error("Cannot replace a newer edition with an older package");
    }
    const archive = path.join(directory, "archive", edition.teamSlug);
    await mkdir(archive, { recursive: true });
    const archiveFile = path.join(archive, `${previous.weekOf}-${editionRevision(previous)}.json`);
    // Content-addressed archive names make repeated imports idempotent.
    await writeFile(archiveFile, `${JSON.stringify(previous, null, 2)}\n`);
    registry[edition.teamSlug] = edition;
    await writeFile(temporary, `${JSON.stringify(preserveKeyOrder(registry, raw), null, 2)}\n`, { flag: "wx" });
    await rename(temporary, path.join(directory, "current.json"));
    return { status: "published", revision };
  } finally {
    await rm(temporary, { force: true });
    await lock.close();
    await rm(lockPath, { force: true });
  }
}
