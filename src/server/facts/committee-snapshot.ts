import current from "../../../data/facts/cfp-rankings.json";
import { committeeSnapshotSchema, type CommitteeRanking } from "@/lib/postseason/committee";

const bundled = committeeSnapshotSchema.parse(current);

export function getBundledCommitteeRanking(season: number): CommitteeRanking | undefined {
  return bundled.season === season ? bundled.ranking ?? undefined : undefined;
}
