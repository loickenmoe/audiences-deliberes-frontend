import { describe, expect, it } from "vitest";

import {
  ERREUR_AUTH_INDISPONIBLE,
  ERREUR_RAFRAICHISSEMENT,
  MARGE_MS, doitRafraichir, prochainRafraichissement,
  sessionInutilisable,
} from "@/lib/rotation-jeton";

const MINUTE = 60 * 1000;

/** Lifetimes **measured** on the project realm (RF-02). */
const ACCES_MS = 3600 * 1000; // 60 min
const REFRESH_MS = 1800 * 1000; // 30 min

describe("prochainRafraichissement", () => {
  /**
   * RF-02: on this realm the refresh token is the binding constraint, not the access token. Relying
   * on the access token (the common NextAuth pattern) would log everyone out after 30 minutes.
   */
  it("se cale sur le refresh token quand il expire le premier", () => {
    const t0 = Date.now();
    const echeance = prochainRafraichissement(t0 + ACCES_MS, t0 + REFRESH_MS);

    expect(echeance).toBe(t0 + REFRESH_MS - MARGE_MS);
    // 30 min − 5 min margin = 25 min, not 55 min.
    expect(Math.round((echeance - t0) / MINUTE)).toBe(25);
  });

  it("se cale sur l'access token si c'est lui qui expire le premier", () => {
    const t0 = Date.now();
    const echeance = prochainRafraichissement(t0 + 10 * MINUTE, t0 + 60 * MINUTE);

    expect(echeance).toBe(t0 + 10 * MINUTE - MARGE_MS);
  });
});

describe("doitRafraichir", () => {
  it("ne rafraîchit pas dans la fenêtre de validité", () => {
    const t0 = Date.now();
    expect(doitRafraichir(t0 + 20 * MINUTE, t0 + ACCES_MS, t0 + REFRESH_MS)).toBe(false);
  });

  it("rafraîchit dès la marge atteinte, bien avant l'expiration de l'access token", () => {
    const t0 = Date.now();
    // At 25 minutes the access token is still valid for 35 minutes, but we refresh anyway.
    expect(doitRafraichir(t0 + 25 * MINUTE, t0 + ACCES_MS, t0 + REFRESH_MS)).toBe(true);
  });

  it("rafraîchit quand les échéances sont inconnues", () => {
    const t0 = Date.now();
    expect(doitRafraichir(t0, undefined, undefined)).toBe(true);
    expect(doitRafraichir(t0, t0 + ACCES_MS, undefined)).toBe(true);
  });

  /** Safeguard: the naive strategy would fail here. */
  it("aurait laissé expirer le refresh token avec la stratégie naïve", () => {
    const t0 = Date.now();
    const naive = t0 + ACCES_MS - MARGE_MS; // 55 min: the common pattern
    const refreshMort = t0 + REFRESH_MS; // 30 min

    expect(naive).toBeGreaterThan(refreshMort);
    // Our policy triggers before that.
    expect(prochainRafraichissement(t0 + ACCES_MS, refreshMort)).toBeLessThan(refreshMort);
  });
});

describe("sessionInutilisable", () => {
  /**
   * Both markers make the session unusable, so the route guard redirects in both cases. They differ
   * in what the user is **told**: sign in again in one case, wait in the other.
   */
  it("reconnaît les deux causes d'échec", () => {
    expect(sessionInutilisable(ERREUR_RAFRAICHISSEMENT)).toBe(true);
    expect(sessionInutilisable(ERREUR_AUTH_INDISPONIBLE)).toBe(true);
  });

  it("laisse passer une session saine", () => {
    expect(sessionInutilisable(undefined)).toBe(false);
    expect(sessionInutilisable("autre-chose")).toBe(false);
  });

  /**
   * The two markers must stay **distinct**: otherwise a Keycloak outage would show "your session has
   * expired" with an instruction (sign in again) that cannot be followed while the service is down.
   */
  it("les deux marqueurs ne sont pas interchangeables", () => {
    expect(ERREUR_AUTH_INDISPONIBLE).not.toBe(ERREUR_RAFRAICHISSEMENT);
  });
});
