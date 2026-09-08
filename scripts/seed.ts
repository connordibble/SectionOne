import { collectSourceDocuments } from "../src/server/ingest/pipeline";
import { defaultTeamSlug, getTeamConfig } from "../src/config/team";
import { getTeamSchedule } from "../src/server/schedule/schedule";
import { createDbClient } from "../src/server/db/client";
import {
  games,
  seasons,
  sourceChunks,
  sourceDocuments,
  teams,
} from "../src/server/db/schema";
import { chunkSourceDocuments } from "../src/server/rag/chunk";
import { resolveEmbeddingProvider } from "../src/server/embeddings/registry";

async function main() {
  const teamSlug = process.argv[2] ?? defaultTeamSlug;
  const team = getTeamConfig(teamSlug);
  const scheduleFixture = getTeamSchedule(teamSlug);
  if (!team || !scheduleFixture) throw new Error("Expected a configured team with a schedule");
  const { db, client } = createDbClient();
  const result = await collectSourceDocuments(teamSlug);

  await db
    .insert(teams)
    .values({
      slug: team.slug,
      displayName: team.displayName,
      sport: team.sport,
      conference: team.conference,
      aliases: team.aliases,
    })
    .onConflictDoUpdate({
      target: teams.slug,
      set: {
        displayName: team.displayName,
        sport: team.sport,
        conference: team.conference,
        aliases: team.aliases,
      },
    });

  await db
    .insert(seasons)
    .values({
      teamSlug: team.slug,
      year: scheduleFixture.seasonYear,
      label: `${scheduleFixture.seasonYear} ${team.displayName}`,
    })
    .onConflictDoUpdate({
      target: [seasons.teamSlug, seasons.year],
      set: {
        label: `${scheduleFixture.seasonYear} ${team.displayName}`,
      },
    });

  for (const game of scheduleFixture.games) {
    await db
      .insert(games)
      .values({
        id: game.id,
        teamSlug: team.slug,
        seasonYear: scheduleFixture.seasonYear,
        opponent: game.opponent,
        site: game.site,
        startsAt: game.startsAt ? new Date(game.startsAt) : null,
        venue: game.venue,
        tv: game.tv,
        sourceUrl: scheduleFixture.sourceUrl,
        metadata: {
          dateLabel: game.dateLabel,
          kickoff: game.kickoff,
        },
      })
      .onConflictDoUpdate({
        target: games.id,
        set: {
          opponent: game.opponent,
          site: game.site,
          startsAt: game.startsAt ? new Date(game.startsAt) : null,
          venue: game.venue,
          tv: game.tv,
          sourceUrl: scheduleFixture.sourceUrl,
          metadata: {
            dateLabel: game.dateLabel,
            kickoff: game.kickoff,
          },
        },
      });
  }

  for (const document of result.documents) {
    await db
      .insert(sourceDocuments)
      .values({
        id: document.id,
        teamSlug: document.teamSlug,
        provider: document.provider,
        sourceType: document.sourceType,
        sourceUrl: document.sourceUrl,
        title: document.title,
        body: document.body,
        metadata: document.metadata,
        publishedAt: document.publishedAt ? new Date(document.publishedAt) : null,
        fetchedAt: new Date(document.fetchedAt),
      })
      .onConflictDoUpdate({
        target: sourceDocuments.id,
        set: {
          sourceUrl: document.sourceUrl,
          title: document.title,
          body: document.body,
          metadata: document.metadata,
          publishedAt: document.publishedAt ? new Date(document.publishedAt) : null,
          fetchedAt: new Date(document.fetchedAt),
        },
      });
  }

  // Chunk the corpus and persist embeddings so chat can use pgvector search.
  // Uses the configured embedding provider (deterministic mock by default, a
  // real model when OPENAI_API_KEY / EMBEDDINGS_PROVIDER is set).
  const { provider: embeddings, warning: embeddingWarning } = resolveEmbeddingProvider();
  const chunks = chunkSourceDocuments(result.documents);
  const vectors = await embeddings.embed(chunks.map((chunk) => chunk.content));

  for (const [index, chunk] of chunks.entries()) {
    const embedding = vectors[index];

    await db
      .insert(sourceChunks)
      .values({
        id: chunk.id,
        sourceDocumentId: chunk.sourceDocumentId,
        chunkIndex: chunk.chunkIndex,
        content: chunk.content,
        tokenEstimate: chunk.tokenEstimate,
        embedding,
        metadata: {},
      })
      .onConflictDoUpdate({
        target: sourceChunks.id,
        set: {
          content: chunk.content,
          tokenEstimate: chunk.tokenEstimate,
          embedding,
        },
      });
  }

  await client.end();

  console.log(
    JSON.stringify(
      {
        teamSlug: result.teamSlug,
        counts: result.counts,
        warnings: embeddingWarning ? [...result.warnings, embeddingWarning] : result.warnings,
        embeddings: { provider: embeddings.name, model: embeddings.model },
        persisted: {
          games: scheduleFixture.games.length,
          sourceDocuments: result.documents.length,
          sourceChunks: chunks.length,
        },
      },
      null,
      2,
    ),
  );
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
