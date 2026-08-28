import type { SourceDocument } from "@/server/sources/types";
import { retrieveSourceChunks, type RetrievalHit } from "./retrieve";
import { retrieveVectorHits, type VectorSearchDeps } from "./vector";

// Reciprocal Rank Fusion constant. Dampens the contribution of lower-ranked
// results; 60 is the value from the original Cormack et al. RRF paper and the
// common default. It lets us combine lexical (integer overlap scores) and
// vector (0..1 cosine) rankings without normalizing their incompatible scales.
const rrfK = 60;

export type HybridRetrievalDeps = VectorSearchDeps;

// Retrieval used by the chat orchestrator. Always runs lexical scoring (works
// offline with zero setup); when a seeded database is reachable it also runs
// pgvector cosine search and fuses the two rankings. With no database or no
// seeded embeddings, vector search returns [] and this degrades to pure
// lexical retrieval — same behavior the app had before embeddings existed.
export async function retrieveHybrid(
  query: string,
  documents: SourceDocument[],
  teamSlug: string,
  limit = 4,
  deps: HybridRetrievalDeps = {},
): Promise<RetrievalHit[]> {
  const lexical = retrieveSourceChunks(query, documents, limit * 2);
  const vector = await retrieveVectorHits(query, teamSlug, limit * 2, deps);

  // Vector search reads the seeded database; `documents` is what the product
  // actually publishes right now. Those two drift apart the moment a weekly
  // package is replaced, because seeding upserts by document id and never
  // deletes what a new package dropped. Without this filter the drift reaches
  // the reader: after the August 27 refresh, chat was still citing "The line
  // took shape on day one" from the superseded August 9 package, a story no
  // longer in the briefing at all.
  //
  // Retrieval is an index over the corpus, not a second corpus. Anything the
  // current package does not contain cannot be a source for an answer about
  // it, however close its embedding sits.
  const published = new Set(documents.map((document) => document.id));
  const groundedVector = vector.filter((hit) => published.has(hit.chunk.document.id));

  if (groundedVector.length === 0) {
    return lexical.slice(0, limit);
  }

  return fuseByRrf([lexical, groundedVector], limit);
}

// Exported for unit testing; combine multiple ranked hit lists into one.
export function fuseByRrf(rankings: RetrievalHit[][], limit: number): RetrievalHit[] {
  const fused = new Map<string, { chunk: RetrievalHit["chunk"]; score: number }>();

  for (const ranking of rankings) {
    ranking.forEach((hit, index) => {
      const key = hit.chunk.id;
      const contribution = 1 / (rrfK + index + 1);
      const existing = fused.get(key);

      if (existing) {
        existing.score += contribution;
      } else {
        fused.set(key, { chunk: hit.chunk, score: contribution });
      }
    });
  }

  return [...fused.values()]
    .sort((left, right) => right.score - left.score)
    .slice(0, limit)
    .map((entry) => ({ chunk: entry.chunk, score: entry.score }));
}
