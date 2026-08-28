export type VoiceEvaluation = {
  passed: boolean;
  flags: string[];
  matchedFootballTerms: string[];
};

// The team's own contract, structurally compatible with `TeamConfig["voice"]`.
// Typed structurally rather than importing TeamConfig so this module stays a
// leaf that server and client code can both use.
export type VoiceContract = {
  preferredTerms?: readonly string[];
  bannedPhrases?: readonly string[];
};

export type VoiceEvaluationOptions = {
  // Merged with the platform baseline below. A team may add to the contract;
  // it cannot opt out of the baseline.
  contract?: VoiceContract;
  // Citation titles actually retrieved for this answer. When supplied, every
  // inline [tag] must match one of them. Omit to skip tag validation (useful
  // when evaluating a fragment with no retrieval behind it).
  validCitationTitles?: readonly string[];
  // A sourced factual lookup may be only a name, position, or time. Keep the
  // stronger vocabulary check for editorial prose while allowing that narrow
  // answer class to opt out.
  requireFootballLanguage?: boolean;
};

// Platform-wide floor. Teams extend these; they never shrink them.
const baselineBannedPhrases = [
  "as an ai",
  "it is important to note",
  "in conclusion",
  "delve",
  "official partner",
  "guaranteed lock",
  // The machinery, named to a fan. These shipped to production: the system
  // prompt asked the model to "say what the corpus is missing" and it
  // obligingly told readers about the corpus. The prompt is fixed, and these
  // are here so the gate catches it rather than trusting the prompt to hold.
  "the corpus",
  "corpus does not",
  "the excerpts",
  "source material",
  "retrieval",
  "knowledge base",
];

const baselineFootballTerms = [
  "early down",
  "early downs",
  "line of scrimmage",
  "explosive",
  "explosiveness",
  "field position",
  "front seven",
  "offensive line",
  "starting center",
  "depth chart",
  "starter",
  "pressure",
  "personnel",
  "success rate",
  "epa",
  "ppa",
  "finishing drive",
  "finishing drives",
  "run fit",
  "coverage",
];

const toxicRivalryTerms = ["trash fanbase", "poverty program", "classless"];

const citationTagPattern = /\[([^\]]+)\]/g;

export function evaluateVoiceSample(
  text: string,
  options: VoiceEvaluationOptions = {},
): VoiceEvaluation {
  const normalized = normalize(text);
  const flags: string[] = [];

  const footballTerms = mergeTerms(baselineFootballTerms, options.contract?.preferredTerms);
  const bannedPhrases = mergeTerms(baselineBannedPhrases, options.contract?.bannedPhrases);

  const matchedFootballTerms = footballTerms.filter((term) => normalized.includes(term));

  for (const phrase of bannedPhrases) {
    if (normalized.includes(phrase)) {
      flags.push(`banned phrase: ${phrase}`);
    }
  }

  for (const phrase of toxicRivalryTerms) {
    if (normalized.includes(phrase)) {
      flags.push(`toxic rivalry language: ${phrase}`);
    }
  }

  if (options.requireFootballLanguage !== false && matchedFootballTerms.length === 0) {
    flags.push("missing football-specific language");
  }

  const tags = extractCitationTags(text);

  if (tags.length === 0 && !hasFreshnessCue(text)) {
    flags.push("missing citation or freshness cue");
  }

  flags.push(...findUnknownCitations(tags, options.validCitationTitles));

  return {
    passed: flags.length === 0,
    flags,
    matchedFootballTerms,
  };
}

export function extractCitationTags(text: string): string[] {
  return [...text.matchAll(citationTagPattern)].map((match) => match[1].trim());
}

// The point of the citation contract is that a tag refers to something real.
// Checking only that *a* bracket exists lets a model invent
// "[Definitely Real Source]" and pass, which is precisely the failure this
// product cannot afford.
function findUnknownCitations(
  tags: readonly string[],
  validCitationTitles: readonly string[] | undefined,
): string[] {
  if (!validCitationTitles) {
    return [];
  }

  const known = new Set(validCitationTitles.map((title) => normalize(title)));

  return [...new Set(tags)]
    .filter((tag) => !known.has(normalize(tag)))
    .map((tag) => `unknown citation: ${tag}`);
}

function hasFreshnessCue(text: string) {
  return /source|freshness|last updated|according to/i.test(text);
}

function mergeTerms(baseline: readonly string[], extra: readonly string[] | undefined): string[] {
  return [...new Set([...baseline, ...(extra ?? [])].map((term) => normalize(term)))].filter(
    (term) => term.length > 0,
  );
}

// Lowercase and flatten the unicode dash family so "early-downs", "early–downs"
// and "early downs" all compare equal.
function normalize(value: string): string {
  return value
    .toLowerCase()
    .replaceAll(/[‐-―−-]/gu, " ")
    .replaceAll(/\s+/gu, " ")
    .trim();
}
