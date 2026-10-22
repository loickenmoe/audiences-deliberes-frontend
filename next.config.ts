import createNextIntlPlugin from "next-intl/plugin";
import type { NextConfig } from "next";

/**
 * Security headers covering the risks the frontend can handle on its own.
 *
 * A full Content Security Policy needs a per-request `nonce` (hence middleware) and would silently
 * break hydration if set blindly; only `frame-ancestors` is declared. The full CSP and
 * `Strict-Transport-Security` belong to the TLS production deployment.
 */
const ENTETES_SECURITE = [
  // Framing by a third-party page: the defence against clickjacking.
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Content-Security-Policy", value: "frame-ancestors 'none'" },
  // No MIME sniffing: a mistyped document cannot become a script.
  { key: "X-Content-Type-Options", value: "nosniff" },
  // A case file reference must not leak through the referrer to an external site.
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  // The application needs no camera, microphone or location.
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
];

const nextConfig: NextConfig = {
  reactStrictMode: true,
  /** Do not advertise the stack through `X-Powered-By`. */
  poweredByHeader: false,
  // DMS documents are served through pre-signed MinIO URLs; hosts declared for next/image.
  images: {
    remotePatterns: [
      { protocol: "http", hostname: "localhost", port: "9000" },
      { protocol: "http", hostname: "localhost", port: "8080" },
    ],
  },
  async headers() {
    return [{ source: "/:chemin*", headers: ENTETES_SECURITE }];
  },
};

export default createNextIntlPlugin("./i18n/request.ts")(nextConfig);
