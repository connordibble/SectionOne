import { AsyncLocalStorage } from "node:async_hooks";
import current from "../../../data/facts/ap-poll.json";
import { pollWeekSchema, type PollWeek } from "@/lib/facts/poll";

const bundled = pollWeekSchema.parse(current);
const scope = new AsyncLocalStorage<{ poll: PollWeek | undefined }>();
export function getBundledPoll(season: number): PollWeek | undefined {
  return bundled.season === season ? bundled : undefined;
}
export function getPollSnapshot(season: number): PollWeek | undefined {
  const current = scope.getStore();
  if (current) return current.poll?.season === season ? current.poll : undefined;
  return getBundledPoll(season);
}
export function withPollSnapshot<T>(poll: PollWeek | undefined, work: () => T): T {
  return scope.run({ poll }, work);
}
