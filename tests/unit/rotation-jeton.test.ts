import { describe, expect, it } from "vitest";

import { MARGE_MS, doitRafraichir, prochainRafraichissement } from "@/lib/rotation-jeton";

const MINUTE = 60 * 1000;

/** Durées **mesurées** sur le realm du projet le 2026-09-08 (RF-02). */
const ACCES_MS = 3600 * 1000; // 60 min
const REFRESH_MS = 1800 * 1000; // 30 min

describe("prochainRafraichissement", () => {
  /**
   * Le cœur de RF-02 : sur ce realm, c'est le refresh token qui contraint, pas l'access token.
   * Se caler sur l'access token — le patron NextAuth le plus répandu — déconnecterait tout le monde
   * au bout de 30 minutes.
   */
  it("se cale sur le refresh token quand il expire le premier", () => {
    const t0 = Date.now();
    const echeance = prochainRafraichissement(t0 + ACCES_MS, t0 + REFRESH_MS);

    expect(echeance).toBe(t0 + REFRESH_MS - MARGE_MS);
    // 30 min − 5 min de marge = 25 min, et non 55 min.
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
    // À 25 minutes, l'access token est encore valable 35 minutes — on rafraîchit quand même.
    expect(doitRafraichir(t0 + 25 * MINUTE, t0 + ACCES_MS, t0 + REFRESH_MS)).toBe(true);
  });

  it("rafraîchit quand les échéances sont inconnues", () => {
    const t0 = Date.now();
    expect(doitRafraichir(t0, undefined, undefined)).toBe(true);
    expect(doitRafraichir(t0, t0 + ACCES_MS, undefined)).toBe(true);
  });

  /** Garde-fou : la stratégie naïve échouerait ici. Ce test l'atteste. */
  it("aurait laissé expirer le refresh token avec la stratégie naïve", () => {
    const t0 = Date.now();
    const naive = t0 + ACCES_MS - MARGE_MS; // 55 min : le patron répandu
    const refreshMort = t0 + REFRESH_MS; // 30 min

    expect(naive).toBeGreaterThan(refreshMort);
    // Notre politique, elle, déclenche avant.
    expect(prochainRafraichissement(t0 + ACCES_MS, refreshMort)).toBeLessThan(refreshMort);
  });
});
