import type { NextConfig } from "next";

// Everything this site renders is first-party. There are no third-party
// scripts, no embeds, no remote images and no analytics, so the policy can be
// strict rather than permissive-with-exceptions — and the moment that stops
// being true, the browser will say so instead of silently allowing it.
//
// 'unsafe-inline' on styles is required by Next's own inlined critical CSS and
// by the per-team palette written to a style attribute. Scripts do not need it:
// Next emits its bootstrap with a nonce-free but hash-stable strategy, and any
// inline script added later should be given a nonce rather than loosening this.
const contentSecurityPolicy = [
  "default-src 'self'",
  "base-uri 'self'",
  "form-action 'self'",
  "frame-ancestors 'none'",
  "object-src 'none'",
  "img-src 'self' data:",
  "font-src 'self' data:",
  "style-src 'self' 'unsafe-inline'",
  // Next hydration needs eval in development only; production runs without it.
  process.env.NODE_ENV === "development"
    ? "script-src 'self' 'unsafe-inline' 'unsafe-eval'"
    : "script-src 'self' 'unsafe-inline'",
  // The chat endpoint is same-origin. No provider is ever called from the
  // browser — keys live on the server, and this makes that structural.
  //
  // Development adds the websocket schemes for Next's hot reload. Browsers do
  // not consistently treat ws: as covered by 'self', so without this HMR fails
  // silently and every edit needs a manual refresh.
  process.env.NODE_ENV === "development" ? "connect-src 'self' ws: wss:" : "connect-src 'self'",
  "upgrade-insecure-requests",
].join("; ");

const securityHeaders = [
  { key: "Content-Security-Policy", value: contentSecurityPolicy },
  // Two years, subdomains included. Only ever sent over HTTPS, so local
  // development is unaffected.
  { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains; preload" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "X-Frame-Options", value: "DENY" },
  // Nothing here needs a camera, a microphone, or a location.
  {
    key: "Permissions-Policy",
    value: "accelerometer=(), camera=(), geolocation=(), gyroscope=(), microphone=(), payment=()",
  },
  { key: "Cross-Origin-Opener-Policy", value: "same-origin" },
];

const nextConfig: NextConfig = {
  allowedDevOrigins: ["127.0.0.1"],
  poweredByHeader: false,

  async headers() {
    return [
      {
        source: "/:path*",
        headers: securityHeaders,
      },
      {
        // The chat endpoint streams and must never be cached by a CDN — a
        // cached answer would be served to the wrong question.
        source: "/api/:path*",
        headers: [{ key: "Cache-Control", value: "no-store" }],
      },
    ];
  },
};

export default nextConfig;
