import axios, { type AxiosInstance, type InternalAxiosRequestConfig } from "axios";

import { getEnv } from "@/lib/env";
import { normaliserErreur } from "@/lib/api/errors";

/**
 * Single HTTP client of the application.
 *
 * The Keycloak token is injected through {@link definirFournisseurDeJeton}: the server side uses
 * `auth()` and the browser uses the session, hence a provider function rather than a direct read.
 */

type FournisseurDeJeton = () => Promise<string | null>;

let fournisseurDeJeton: FournisseurDeJeton = async () => null;

/** Also lets tests inject a deterministic token. */
export function definirFournisseurDeJeton(fournisseur: FournisseurDeJeton): void {
  fournisseurDeJeton = fournisseur;
}

/**
 * Current token, for transports that do not go through axios: the STOMP real-time channel carries
 * its `Authorization` on the `CONNECT` frame, not on an HTTP request.
 */
export async function obtenirJeton(): Promise<string | null> {
  return fournisseurDeJeton();
}

export const apiClient: AxiosInstance = axios.create({
  headers: {
    "Content-Type": "application/json",
    Accept: "application/json",
  },
});

/**
 * `baseURL` is resolved per request, not at module creation: environment validation must fail on
 * the first real call rather than at import, so unit tests do not need a full configuration.
 */
apiClient.interceptors.request.use(async (config: InternalAxiosRequestConfig) => {
  config.baseURL ??= getEnv().NEXT_PUBLIC_API_URL;

  const jeton = await fournisseurDeJeton();
  if (jeton) {
    config.headers.set("Authorization", `Bearer ${jeton}`);
  }

  return config;
});

/**
 * Every failure surfaces as an {@link ErreurApi}. No redirect here: redirecting from the
 * interceptor makes errors untestable and bypasses screen state; route guards decide redirects.
 */
apiClient.interceptors.response.use(
  (reponse) => reponse,
  async (erreur) => Promise.reject(normaliserErreur(await relireCorpsBinaire(erreur))),
);

/**
 * A binary request (`responseType: "blob"`, for PDF or Excel exports) also receives its errors as
 * binary (a `Blob` in the browser, a buffer or string under Node). `normaliserErreur` is synchronous
 * and cannot read it, so the body is parsed here to keep the backend message.
 */
async function relireCorpsBinaire(erreur: unknown): Promise<unknown> {
  const reponse = (erreur as { response?: { data?: unknown } } | null)?.response;
  if (!reponse) return erreur;
  const donnees = reponse.data;
  let texte: string | null = null;
  if (typeof Blob !== "undefined" && donnees instanceof Blob) texte = await donnees.text();
  else if (donnees instanceof ArrayBuffer) texte = new TextDecoder().decode(donnees);
  else if (ArrayBuffer.isView(donnees)) texte = new TextDecoder().decode(donnees);
  else if (typeof donnees === "string") texte = donnees;
  if (texte !== null) {
    try {
      reponse.data = JSON.parse(texte);
    } catch {
      // Not JSON (e.g. a proxy error page): the status is enough to qualify the error.
    }
  }
  return erreur;
}

/** Backend pagination envelope: `{content, totalPages, totalElements}`, without the page number. */
export interface PageReponse<T> {
  content: T[];
  totalPages: number;
  totalElements: number;
}
