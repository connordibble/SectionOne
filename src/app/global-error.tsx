"use client";

// The last resort: this replaces the root layout, so it renders its own html
// and body and cannot rely on any of the app's fonts, tokens, or styles. Keep
// it inline and dependency-free — whatever broke may be one of those things.
export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <html lang="en">
      <body
        style={{
          fontFamily: "system-ui, sans-serif",
          padding: "4rem 1.5rem",
          maxWidth: "38rem",
          margin: "0 auto",
          lineHeight: 1.6,
        }}
      >
        <h1>Section One is having a problem</h1>
        <p>The site failed to load. This is on our end. Try again in a moment.</p>
        <p style={{ color: "#666", fontSize: "0.875rem" }}>
          Reference: {error.digest ?? "unavailable"}
        </p>
        <button onClick={reset} type="button">
          Reload
        </button>
      </body>
    </html>
  );
}
