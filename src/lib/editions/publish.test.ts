// @vitest-environment node
import { mkdtemp, mkdir, readFile, readdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import fixtures from "@/test/fixtures/editions.json";
import { editionPackageSchema, parseEditionRegistry } from "./contract";
import { editionRevision, publishEdition, readEditionRegistry, validateStoryRefresh } from "./publish";
import { describeSourceMix } from "@/server/sources/story-selection";
import { teamManifests } from "@/lib/teams/current";

const roots: string[] = [];
const original = editionPackageSchema.parse(fixtures["texas-football"]);
async function workspace() {
  const root = await mkdtemp(path.join(tmpdir(), "sectionone-publish-"));
  roots.push(root);
  await mkdir(path.join(root, "data/editions"), { recursive: true });
  await writeFile(path.join(root, "data/editions/current.json"), JSON.stringify(fixtures));
  return root;
}
afterEach(async () => { await Promise.all(roots.splice(0).map((root) => rm(root, { recursive: true, force: true }))); });

describe("edition publication", () => {
  it("publishes a story refresh without changing the rest of the edition or other teams", async () => {
    const root = await workspace();
    const edition = structuredClone(original);
    edition.items[0].tldr = "A supported new development.";
    edition.storiesUpdatedAt = "2026-09-09T12:00:00Z";
    edition.items[0].publishedAt = "2026-09-09";
    const draft = { baseRevision: editionRevision(original), edition };
    await validateStoryRefresh(root, draft);
    const now = new Date("2026-09-10T00:00:00Z");
    expect((await publishEdition(root, draft, now, "stories")).status).toBe("published");
    const registry = await readEditionRegistry(root);
    expect(registry[edition.teamSlug]).toEqual(edition);
    expect(registry["utah-state-football"]).toEqual(parseEditionRegistry(fixtures)["utah-state-football"]);
    expect(registry[edition.teamSlug].publishedAt).toBe(original.publishedAt);
    expect((await publishEdition(root, draft, now, "stories")).status).toBe("unchanged");
    await expect(publishEdition(root, { ...draft, edition: { ...edition, summary: "A concurrent stale edit." } }, now, "stories")).rejects.toThrow("Stale draft");
    await expect(publishEdition(root, { baseRevision: editionRevision(edition), edition: { ...edition, summary: "Regressed story date", storiesUpdatedAt: "2026-09-08T14:00:00Z", items: original.items } }, now, "stories")).rejects.toThrow("older package");
  });
  it("rejects every out-of-scope story refresh before writing", async () => {
    const root = await workspace();
    const file = path.join(root, "data/editions/current.json");
    const before = await readFile(file, "utf8");
    for (const field of ["issue", "weekOf", "editorial", "nextGameNote", "notesDisclaimer", "notes", "publishedAt"] as const) {
      const edition = structuredClone(original);
      if (field === "issue") edition.issue.week += 1;
      else if (field === "weekOf") edition.weekOf = "2026-08-23";
      else if (field === "editorial") edition.editorial.lead.headline = "An unrelated lead edit";
      else if (field === "publishedAt") edition.publishedAt = "2026-09-08T13:46:00Z";
      else if (field === "notes") edition.notes[0].body = "An unrelated note edit";
      else edition[field] = "An unrelated edit";
      const draft = { baseRevision: editionRevision(original), edition };
      await expect(validateStoryRefresh(root, draft)).rejects.toThrow("outside items");
      await expect(publishEdition(root, draft, new Date(), "stories")).rejects.toThrow("outside items");
    }
    await expect(publishEdition(root, { baseRevision: editionRevision(original), edition: { ...original, items: original.items.slice(0, 4) } }, new Date(), "stories")).rejects.toThrow("five stories");
    expect(await readFile(file, "utf8")).toBe(before);
  });
  it("does not bump freshness or create an archive for a timestamp-only story refresh", async () => {
    const root = await workspace();
    const file = path.join(root, "data/editions/current.json");
    const before = await readFile(file, "utf8");
    const draft = { baseRevision: editionRevision(original), edition: { ...original, storiesUpdatedAt: "2026-09-09T12:00:00Z" } };
    expect((await publishEdition(root, draft, new Date("2026-09-10T00:00:00Z"), "stories")).status).toBe("unchanged");
    expect(await readFile(file, "utf8")).toBe(before);
    await expect(readdir(path.join(root, "data/editions/archive"))).rejects.toMatchObject({ code: "ENOENT" });
  });
  it("validates the real published registry independently of frozen behavior fixtures", async () => {
    const registry = await readEditionRegistry(process.cwd());
    expect(Object.keys(registry).sort()).toEqual(Object.keys(teamManifests).sort());
    for (const edition of Object.values(registry)) {
      expect(edition.items).toHaveLength(5);
      const mix = describeSourceMix(edition.items);
      expect(mix.distinctOutlets).toBeGreaterThanOrEqual(3);
      expect(mix.maxFromOneOutlet).toBeLessThanOrEqual(2);
      expect(mix.byTier.local).toBeGreaterThan(0);
      expect(mix.byTier.national).toBeLessThanOrEqual(mix.byTier.local);
    }
  });
  it("archives the previous edition, imports all presentation fields, and preserves other teams", async () => {
    const root = await workspace();
    const edition = structuredClone(original);
    edition.summary = "A reviewed correction.";
    edition.editorial.lead.headline = "Updated lead";
    const draft = { baseRevision: editionRevision(original), edition };
    expect((await publishEdition(root, draft)).status).toBe("published");
    const actual = await readEditionRegistry(root);
    expect(actual[edition.teamSlug]).toEqual(edition);
    expect(actual["utah-state-football"]).toEqual(parseEditionRegistry(fixtures)["utah-state-football"]);
    const archived = JSON.parse(await readFile(path.join(root, "data/editions/archive", edition.teamSlug, `${original.weekOf}-${draft.baseRevision}.json`), "utf8"));
    expect(archived).toEqual(original);
    expect((await publishEdition(root, draft)).status).toBe("unchanged");
  });
  it("rejects stale concurrent drafts without changing the current edition", async () => {
    const root = await workspace();
    const edition = { ...original, summary: "First correction." };
    const baseRevision = editionRevision(original);
    await publishEdition(root, { baseRevision, edition });
    await expect(publishEdition(root, { baseRevision, edition: { ...edition, summary: "Stale correction." } })).rejects.toThrow("Stale draft");
    expect((await readEditionRegistry(root))[edition.teamSlug].summary).toBe("First correction.");
  });
  it("changes only the corrected value when the existing registry uses a different key order", async () => {
    const root = await workspace();
    const reversed = (value: unknown): unknown => Array.isArray(value) ? value.map(reversed)
      : value && typeof value === "object" ? Object.fromEntries(Object.entries(value).reverse().map(([key, item]) => [key, reversed(item)])) : value;
    const before = `${JSON.stringify(reversed(fixtures), null, 2)}\n`;
    const file = path.join(root, "data/editions/current.json");
    await writeFile(file, before);
    const summary = "A narrowly reviewed correction.";
    await publishEdition(root, { baseRevision: editionRevision(original), edition: { ...original, summary } });
    expect(await readFile(file, "utf8")).toBe(before.replace(JSON.stringify(original.summary), JSON.stringify(summary)));
  });
  it("rejects future packages, missing note references and duplicate stories before mutation", async () => {
    const root = await workspace();
    const before = await readFile(path.join(root, "data/editions/current.json"), "utf8");
    for (const edition of [
      { ...original, publishedAt: "2099-01-01T00:00:00Z" },
      { ...original, notes: [] },
      { ...original, items: [original.items[0], original.items[0]] },
    ]) await expect(publishEdition(root, { baseRevision: editionRevision(original), edition })).rejects.toThrow();
    expect(await readFile(path.join(root, "data/editions/current.json"), "utf8")).toBe(before);
  });
  it("accepts date-only sources but rejects impossible dates, future notes and unsafe links", () => {
    expect(editionPackageSchema.safeParse(original).success).toBe(true);
    for (const patch of [{ publishedAt: "2026-02-30" }, { url: "javascript:alert(1)" }, { url: "https://user:secret@example.com" }]) {
      expect(editionPackageSchema.safeParse({ ...original, items: [{ ...original.items[0], ...patch }] }).success).toBe(false);
    }
    expect(editionPackageSchema.safeParse({ ...original, notes: original.notes.map((note) => ({ ...note, publishedAt: "2099-01-01" })) }).success).toBe(false);
    expect(editionPackageSchema.safeParse({ ...original, storiesUpdatedAt: "2026-09-09T12:00:00Z", items: original.items.map((item) => ({ ...item, publishedAt: "2026-09-09" })) }).success).toBe(true);
    expect(editionPackageSchema.safeParse({ ...original, storiesUpdatedAt: "2026-09-07T12:00:00Z" }).success).toBe(false);
    expect(editionPackageSchema.safeParse({ ...original, storiesUpdatedAt: "2026-09-10T12:00:00Z", notes: original.notes.map((note) => ({ ...note, publishedAt: "2026-09-09" })) }).success).toBe(false);
  });
});
