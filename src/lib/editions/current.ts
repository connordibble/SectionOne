import current from "../../../data/editions/current.json";
import { parseEditionRegistry } from "./contract";

const editions = parseEditionRegistry(current);

export function getPublishedEdition(teamSlug: string) {
  return editions[teamSlug];
}
