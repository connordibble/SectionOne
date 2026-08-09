import texasNotes from "../../../data/fixtures/texas-football/team-notes.json";
import utahStateNotes from "../../../data/fixtures/utah-state-football/team-notes.json";
import { createSourceDocumentId } from "./ids";
import type { SourceDocument } from "./types";

// Declared rather than inferred from one fixture: with more than one edition,
// `typeof` would narrow to whichever file happened to be imported first and
// reject the next one over an incidental difference.
type TeamNote = {
  id: string;
  title: string;
  topics: string[];
  publishedAt: string;
  body: string;
};

type TeamNotesFixture = {
  teamSlug: string;
  capturedAt: string;
  disclaimer: string;
  notes: TeamNote[];
};

const fixtures: Record<string, TeamNotesFixture> = Object.fromEntries(
  [texasNotes, utahStateNotes].map((fixture) => [fixture.teamSlug, fixture]),
);

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
