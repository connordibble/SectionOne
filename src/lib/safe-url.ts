// Every outbound link in this product points at somebody else's reporting, and
// the link is the whole basis on which a fan is asked to believe a summary. So
// a source URL is both the most important thing on the page and the one value
// most likely to arrive from outside it.
//
// Today weekly packages are committed fixtures we author. The moment they come
// from a live feed — an outlet's API, a scraper, a submitted tip — the URL is
// attacker-influenced, and React does not protect this sink: `javascript:` in
// an `href` logs a warning and renders anyway. That is stored XSS with a click.
//
// This is the one place that decides what may become an `href`. Parsing with
// the platform URL constructor rather than matching on strings is deliberate:
// it applies the same normalisation a browser does, so the usual evasions —
// `JavaScript:`, a leading space, a tab spliced into the scheme — are resolved
// before the protocol is checked rather than sneaking past a regex.
const allowedProtocols = new Set(["http:", "https:"]);

/**
 * Returns `value` when it is an absolute http(s) URL, and `undefined` for
 * anything else — other schemes, relative paths, and unparseable input.
 *
 * Callers render a link when this returns a string and plain text when it does
 * not, so an unsafe URL costs a link and never becomes a script.
 */
export function safeExternalHref(value: string | undefined | null): string | undefined {
  if (!value) {
    return undefined;
  }

  let parsed: URL;

  try {
    // Relative URLs throw here, which is the intended answer: these are links
    // out to other people's sites, so anything without a scheme is malformed
    // rather than something to resolve against our own origin.
    parsed = new URL(value);
  } catch {
    return undefined;
  }

  return allowedProtocols.has(parsed.protocol) ? value : undefined;
}

export function isSafeExternalHref(value: string | undefined | null): boolean {
  return safeExternalHref(value) !== undefined;
}
