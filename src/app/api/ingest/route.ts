import { getTeamConfig } from "@/config/team";
import { collectSourceDocuments } from "@/server/ingest/pipeline";

import { withRouteErrors } from "@/server/observability/route";

export const runtime = "nodejs";

export const POST = withRouteErrors("api/ingest", async (request: Request) => {
  const body = (await request.json().catch(() => ({}))) as { teamSlug?: string };

  if (body.teamSlug && !getTeamConfig(body.teamSlug)) {
    return Response.json({ error: `Unknown team slug: ${body.teamSlug}` }, { status: 404 });
  }

  const result = await collectSourceDocuments(body.teamSlug);

  return Response.json({
    teamSlug: result.teamSlug,
    counts: result.counts,
    warnings: result.warnings,
    documentCount: result.documents.length,
    documents: result.documents.map((document) => ({
      id: document.id,
      provider: document.provider,
      sourceType: document.sourceType,
      title: document.title,
      sourceUrl: document.sourceUrl,
      fetchedAt: document.fetchedAt,
    })),
  });
});
