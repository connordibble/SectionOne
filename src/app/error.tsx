"use client";

import { useEffect } from "react";
import Link from "next/link";

// Route-level boundary. Next renders this in place of the failed segment, so
// the masthead and navigation survive and a fan can get somewhere useful.
//
// The reporting seam is server-side, so this posts to a route rather than
// importing it — a client bundle must never carry an API key or a transport.
export default function RouteError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // The digest is the only safe identifier here: Next strips the real
    // message in production precisely so it cannot leak to the browser.
    void fetch("/api/client-errors", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ digest: error.digest, scope: "app/render" }),
      keepalive: true,
    }).catch(() => {
      // A failed report must not replace one error with another.
    });
  }, [error.digest]);

  return (
    <main style={{ padding: "4rem 1.5rem", maxWidth: "38rem", margin: "0 auto" }}>
      <h1>This page did not load</h1>
      <p>
        Something went wrong on our end, not yours. It has been logged and we are looking at it.
      </p>
      <p>
        <button onClick={reset} type="button">
          Try again
        </button>
      </p>
      <p>
        <Link href="/">Back to the home page</Link>
      </p>
    </main>
  );
}
