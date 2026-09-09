import current from "../../../data/teams/current.json";
import { teamRegistrySchema, type TeamManifest } from "./contract";

export const teamManifests = teamRegistrySchema.parse(current) as Record<keyof typeof current, TeamManifest>;
