import teamNotes from "../../../data/fixtures/texas-football/team-notes.json";
import { createSourceDocumentId } from "./ids";
import type { SourceDocument } from "./types";

type TeamNotesFixture = typeof teamNotes;
type TeamNote = TeamNotesFixture["notes"][number];

const fixtures: Record<string, TeamNotesFixture> = {
  [teamNotes.teamSlug]: teamNotes,
};

// Independent desk notes shipped with the team package. A licensed notes
// provider can replace this adapter without touching the pipeline: the
// SourceDocument contract stays the same.
export function getTeamNoteDocuments(teamSlug: string): SourceDocument[] {
  const fixture = fixtures[teamSlug];

  if (!fixture) {
    return [];
  }

  return fixture.notes.map((note) => createNoteDocument(fixture, note));
}

function createNoteDocument(fixture: TeamNotesFixture, note: TeamNote): SourceDocument {
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
      disclaimer: fixture.disclaimer,
    },
    publishedAt: note.publishedAt,
    fetchedAt: fixture.capturedAt,
  };
}
