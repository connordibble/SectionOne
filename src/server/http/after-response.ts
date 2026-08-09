import { after } from "next/server";

// Runs work after the response is sent, and — the part that matters — keeps
// the serverless invocation alive until it finishes.
//
// A bare `void somePromise()` looks equivalent and is not. On a serverless
// platform the instance is frozen as soon as the response is flushed, so an
// unawaited promise is simply discarded mid-flight. It works perfectly in
// development, where the process keeps running, and silently does nothing in
// production. The answer cache was written that way and never persisted a
// single row until this existed.
//
// Awaiting instead would work, but bills the fan for a write they are not
// waiting on. `after` is the primitive for this exact shape.
export function runAfterResponse(work: () => Promise<unknown>, scope: string): void {
  const guarded = () => {
    void work().catch((error: unknown) => {
      console.error(
        JSON.stringify({
          level: "error",
          scope,
          message: `deferred work failed: ${error instanceof Error ? error.message : String(error)}`,
          at: new Date().toISOString(),
        }),
      );
    });
  };

  try {
    after(guarded);
  } catch {
    // `after` throws outside a request or render — a script, or a test. Run it
    // inline rather than dropping it.
    guarded();
  }
}
