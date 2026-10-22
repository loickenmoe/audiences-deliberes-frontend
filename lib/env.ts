import { z } from "zod";

/**
 * Public configuration validation. Fails explicitly if a variable is missing or malformed, rather
 * than producing calls to `undefined/api/v1/...`. Authentication variables live in `env.server.ts`.
 */
const schema = z.object({
  /** Backend API base URL, prefix included, e.g. http://localhost:8080/api/v1 */
  NEXT_PUBLIC_API_URL: z.string().url("NEXT_PUBLIC_API_URL doit être une URL absolue valide"),
  /** SockJS endpoint of the real-time channel. */
  NEXT_PUBLIC_WS_URL: z.string().url("NEXT_PUBLIC_WS_URL doit être une URL absolue valide"),
});

export type Env = z.infer<typeof schema>;

/**
 * Next.js only exposes to the browser variables literally referenced as `process.env.NEXT_PUBLIC_*`
 * at build time: they must be spelled out, never read dynamically.
 */
function read(): Env {
  const parsed = schema.safeParse({
    NEXT_PUBLIC_API_URL: process.env.NEXT_PUBLIC_API_URL,
    NEXT_PUBLIC_WS_URL: process.env.NEXT_PUBLIC_WS_URL,
  });

  if (!parsed.success) {
    const details = parsed.error.issues
      .map((issue) => `  - ${issue.path.join(".")} : ${issue.message}`)
      .join("\n");
    throw new Error(
      `Configuration invalide. Renseignez les variables manquantes dans .env.local ` +
        `(voir env.template) :\n${details}`,
    );
  }

  return parsed.data;
}

let cache: Env | null = null;

/** Validated configuration. Throws an explicit error on first call if incomplete. */
export function getEnv(): Env {
  cache ??= read();
  return cache;
}

/** Resets the cache. Test-only. */
export function resetEnvCache(): void {
  cache = null;
}
