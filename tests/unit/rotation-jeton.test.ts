import { describe, expect, it } from "vitest";

import {
  ERREUR_AUTH_INDISPONIBLE,
  ERREUR_RAFRAICHISSEMENT,
  MARGE_MS, doitRafraichir, prochainRafraichissement,
  sessionInutilisable,
} from "@/lib/rotation-jeton";

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

describe("sessionInutilisable", () => {
  /**
   * Les deux marqueurs rendent la session inexploitable — le garde de route doit donc rediriger dans
   * les deux cas. Ce qui les sépare n'est pas la conduite à tenir, c'est ce qu'on **dit** à
   * l'utilisateur : se reconnecter d'un côté, patienter de l'autre.
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
   * Les deux marqueurs doivent rester **distincts** : c'est toute la correction. Les confondre
   * ramènerait le message « votre session a expiré » sur une panne de Keycloak, avec une consigne —
   * se reconnecter — que le service à terre rend impossible à suivre.
   */
  it("les deux marqueurs ne sont pas interchangeables", () => {
    expect(ERREUR_AUTH_INDISPONIBLE).not.toBe(ERREUR_RAFRAICHISSEMENT);
  });
});
