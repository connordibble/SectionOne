import { getPublishedEdition } from "@/lib/editions/current";
import type { EditionPackage } from "@/lib/editions/contract";
import { createSourceDocumentId } from "./ids";
import type { SourceDocument } from "./types";

// Independent desk notes shipped with the team package. A licensed notes
// provider can replace this adapter without touching the pipeline: the
// SourceDocument contract stays the same.
export function getTeamNoteDocuments(teamSlug: string): SourceDocument[] {
  const fixture = getPublishedEdition(teamSlug);

  if (!fixture) {
    return [];
  }

  return fixture.notes.map((note) => createNoteDocument(fixture, note));
}

function createNoteDocument(fixture: EditionPackage, note: EditionPackage["notes"][number]): SourceDocument {
  return {
    id: createSourceDocumentId([fixture.teamSlug, "note", note.id]),
    teamSlug: fixture.teamSlug,
    provider: "fixture",
    sourceType: "team-note",
    title: note.title,
    body: note.body,
    metadata: {
      noteId: note.id,
      topics: note.topics,
      editorial: true,
      disclaimer: fixture.notesDisclaimer,
    },
    publishedAt: note.publishedAt,
    fetchedAt: fixture.publishedAt,
  };
}
