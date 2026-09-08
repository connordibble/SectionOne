import { z } from "zod";

const text = z.string().trim().min(1);
const id = z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/);
const timestamp = z.iso.datetime({ offset: true });
// Date-only reporting stays date-only; never invent noon or an outlet timezone.
const publicationDate = z.union([z.iso.date(), timestamp]);
const externalUrl = z.url().refine((value) => {
  const url = new URL(value);
  return ["https:", "http:"].includes(url.protocol) && !url.username && !url.password;
}, "Expected an HTTP(S) URL without credentials");

export const editorialSchema = z.object({
  lead: z.object({ headline: text, body: text, noteId: id }),
  matchup: z.object({ thesis: text, question: text, answer: text, citationNoteIds: z.array(id).min(1) }),
  signals: z.array(z.object({
    id, title: text, summary: text, detail: text,
    state: z.enum(["watch", "ready", "thin"]), prompt: text, noteId: id,
  })).length(4),
});

export const newsItemSchema = z.object({
  id, headline: text, tldr: text, outlet: text,
  tier: z.enum(["local", "national", "official"]), url: externalUrl,
  publishedAt: publicationDate,
  grade: z.object({ impact: z.number().min(0).max(5), echo: z.number().min(0).max(5), freshness: z.number().min(0).max(5) }),
});

// Public interchange contract. Acquisition, evidence, prompts and review state
// stay in the private producer; none are needed to render an accepted package.
export const editionPackageSchema = z.object({
  schemaVersion: z.literal(1), teamSlug: id,
  weekOf: z.iso.date(), publishedAt: timestamp,
  issue: z.object({ season: z.number().int().min(2000).max(2200), week: z.number().int().min(0).max(60) }),
  summary: text, items: z.array(newsItemSchema).min(1).max(5),
  editorial: editorialSchema, nextGameNote: text, notesDisclaimer: text,
  notes: z.array(z.object({ id, title: text, topics: z.array(text).min(1), publishedAt: publicationDate, body: text })).min(1),
}).strict().superRefine((edition, ctx) => {
  const error = (message: string) => ctx.addIssue({ code: "custom", message });
  for (const [label, values] of [
    ["story", edition.items.map((item) => item.id)],
    ["source URL", edition.items.map((item) => item.url)],
    ["note", edition.notes.map((note) => note.id)],
    ["signal", edition.editorial.signals.map((signal) => signal.id)],
  ] as const) {
    if (new Set(values).size !== values.length) error(`Duplicate ${label}`);
  }
  const notes = new Set(edition.notes.map((note) => note.id));
  const references = [edition.editorial.lead.noteId, ...edition.editorial.matchup.citationNoteIds,
    ...edition.editorial.signals.map((signal) => signal.noteId)];
  if (references.some((reference) => !notes.has(reference))) error("Editorial reference has no matching note");
  const asOf = Date.parse(edition.publishedAt);
  if (Date.parse(edition.weekOf) > asOf) error("Week starts after publication");
  for (const item of [...edition.items, ...edition.notes]) {
    if (Date.parse(item.publishedAt) > asOf) error(`Future source date: ${item.id}`);
  }
});

export type NewsItem = z.infer<typeof newsItemSchema>;
export type EditionPackage = z.infer<typeof editionPackageSchema>;
export type EditionEditorial = z.infer<typeof editorialSchema>;

export function parseEditionRegistry(value: unknown): Record<string, EditionPackage> {
  const registry = z.record(id, editionPackageSchema).parse(value);
  for (const [slug, edition] of Object.entries(registry)) {
    if (slug !== edition.teamSlug) throw new Error("Edition registry key does not match package team");
  }
  return registry;
}
