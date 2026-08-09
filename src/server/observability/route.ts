import { reportError } from "./report";

// Wraps a route handler so an unexpected throw becomes a reported incident and
// a clean JSON body, instead of the platform's default 500 page.
//
// This is only for the unexpected. Validation failures, unknown team slugs and
// the rumour guardrail are all normal outcomes the handlers return themselves —
// routing those through here would alert on users typing things.
export function withRouteErrors<T extends unknown[]>(
  scope: string,
  handler: (...args: T) => Promise<Response>,
): (...args: T) => Promise<Response> {
  return async (...args: T) => {
    try {
      return await handler(...args);
    } catch (error) {
      const request = args[0] instanceof Request ? args[0] : undefined;

      reportError(error, {
        scope,
        detail: {
          // Path only. A query string or body could carry anything a fan typed.
          path: request ? new URL(request.url).pathname : undefined,
          method: request?.method,
        },
      });

      return Response.json(
        { error: "Something went wrong on our end. Try again in a moment." },
        { status: 500 },
      );
    }
  };
}
