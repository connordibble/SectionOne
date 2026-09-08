// @vitest-environment node
import { mkdtemp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import fixtures from "@/test/fixtures/editions.json";
import { editionPackageSchema, parseEditionRegistry } from "./contract";
import { editionRevision, publishEdition, readEditionRegistry } from "./publish";
import { describeSourceMix } from "@/server/sources/story-selection";

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
  it("validates the real published registry independently of frozen behavior fixtures", async () => {
    const registry = await readEditionRegistry(process.cwd());
    expect(Object.keys(registry)).toEqual(Object.keys(fixtures));
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
  });
});
