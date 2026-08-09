import { z } from "zod";
import { getSharedDb, type Db } from "@/server/db/client";
import { teamRequests } from "@/server/db/schema";

export const maxTeamNameLength = 80;
export const maxNoteLength = 400;

// Kept deliberately loose. A fan typing "App State" should not be told their
// team is invalid, and the only thing the server needs is enough text to group
// on later. Email stays optional because a request is useful demand data even
// when nobody wants to be contacted about it.
export const teamRequestSchema = z.object({
  teamName: z
    .string()
    .trim()
    .min(2, "Tell us which team you follow.")
    .max(maxTeamNameLength, `Keep the team name under ${maxTeamNameLength} characters.`),
  email: z
    .union([z.string().trim().email("That email address does not look right."), z.literal("")])
    .optional()
    .transform((value) => (value ? value : undefined)),
  note: z
    .string()
    .trim()
    .max(maxNoteLength, `Keep the note under ${maxNoteLength} characters.`)
    .optional()
    .transform((value) => (value ? value : undefined)),
});

export type TeamRequestInput = z.infer<typeof teamRequestSchema>;

export type RecordedTeamRequest = {
  // True when the request reached durable storage. False means it was accepted
  // and logged but only exists in the server log — the caller decides whether
  // that is worth telling the fan about.
  stored: boolean;
};

// Folds case, strips accents and punctuation, and drops filler words, so
// "App State", "app-state", and "APP STATE!" group together without rewriting
// what the fan typed.
//
// It does not expand abbreviations or do fuzzy matching: "Appalachian St."
// normalizes to "appalachian st" and will not group with "app state". Counting
// demand across those spellings is a read-time problem, and guessing at it here
// would silently merge programs that only look similar.
export function normalizeTeamName(teamName: string): string {
  return teamName
    .toLowerCase()
    .normalize("NFKD")
    .replaceAll(/[\u0300-\u036f]/gu, "")
    .replaceAll(/[^a-z0-9\s]/g, " ")
    .replaceAll(/\b(university|college|the|of|at)\b/g, " ")
    .replaceAll(/\s+/g, " ")
    .trim();
}

export async function recordTeamRequest(
  input: TeamRequestInput,
  dbOverride?: Db,
): Promise<RecordedTeamRequest> {
  const db = dbOverride ?? getSharedDb();
  const normalized = normalizeTeamName(input.teamName);

  // Always emit a structured line. The database is optional in this app, and
  // silently dropping demand data on a deploy without one would make the
  // request form theatre. A log line is recoverable; nothing is not.
  console.info(
    `[team-request] ${JSON.stringify({
      teamName: input.teamName,
      normalized,
      hasEmail: Boolean(input.email),
      hasNote: Boolean(input.note),
    })}`,
  );

  if (!db) {
    return { stored: false };
  }

  try {
    await db.insert(teamRequests).values({
      teamName: input.teamName,
      teamNameNormalized: normalized,
      email: input.email,
      note: input.note,
    });

    return { stored: true };
  } catch (error) {
    console.warn(
      `[team-request] storage failed: ${error instanceof Error ? error.message : error}`,
    );

    return { stored: false };
  }
}
