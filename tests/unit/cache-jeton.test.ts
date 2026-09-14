import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  attendreLecturesEnCours,
  definirLectureDeSession,
  jetonCourant,
  reinitialiserCacheJeton,
  verrouillerJeton,
} from "@/lib/cache-jeton";

/**
 * QF-42 — le cache du jeton d'accès.
 *
 * Ce qui est vérifié ici n'est pas « le cache mémorise », c'est **le nombre de lectures de session**.
 * Chaque lecture repose le cookie de session côté serveur : c'est ce compte, et lui seul, qui
 * décidait qu'une déconnexion tienne ou non.
 */
describe("cache du jeton d'accès", () => {
  const MAINTENANT = 1_700_000_000_000;

  beforeEach(() => {
    reinitialiserCacheJeton();
  });

  it("ne lit la session qu'une fois pour une rafale de requêtes", async () => {
    const lire = vi.fn().mockResolvedValue({
      accessToken: "jeton-A",
      rafraichirApres: MAINTENANT + 60_000,
    });
    definirLectureDeSession(lire);

    // Huit requêtes simultanées : c'est la charge d'un écran d'accueil.
    const jetons = await Promise.all(
      Array.from({ length: 8 }, () => jetonCourant(MAINTENANT)),
    );

    expect(jetons).toEqual(Array(8).fill("jeton-A"));
    expect(lire, "une rafale ne doit produire qu'une lecture de session").toHaveBeenCalledTimes(1);
  });

  it("ne relit pas la session tant que la fenêtre de rotation n'est pas atteinte", async () => {
    const lire = vi.fn().mockResolvedValue({
      accessToken: "jeton-A",
      rafraichirApres: MAINTENANT + 60_000,
    });
    definirLectureDeSession(lire);

    await jetonCourant(MAINTENANT);
    await jetonCourant(MAINTENANT + 59_000);

    expect(lire).toHaveBeenCalledTimes(1);
  });

  it("relit la session une fois la fenêtre atteinte, et sert le jeton renouvelé", async () => {
    const lire = vi
      .fn()
      .mockResolvedValueOnce({ accessToken: "jeton-A", rafraichirApres: MAINTENANT + 60_000 })
      .mockResolvedValueOnce({ accessToken: "jeton-B", rafraichirApres: MAINTENANT + 120_000 });
    definirLectureDeSession(lire);

    expect(await jetonCourant(MAINTENANT)).toBe("jeton-A");
    expect(await jetonCourant(MAINTENANT + 60_000)).toBe("jeton-B");
    expect(lire).toHaveBeenCalledTimes(2);
  });

  /**
   * Sans fenêtre publiée, garder le jeton indéfiniment servirait un jeton mort ; le relire à chaque
   * appel rouvrirait QF-42. Le repli court tient les deux bouts.
   */
  it("applique un repli court quand la session ne publie pas de fenêtre", async () => {
    const lire = vi.fn().mockResolvedValue({ accessToken: "jeton-A" });
    definirLectureDeSession(lire);

    await jetonCourant(MAINTENANT);
    await jetonCourant(MAINTENANT + 29_000);
    expect(lire).toHaveBeenCalledTimes(1);

    await jetonCourant(MAINTENANT + 30_000);
    expect(lire).toHaveBeenCalledTimes(2);
  });

  it("ne lit plus la session une fois la déconnexion engagée", async () => {
    const lire = vi.fn().mockResolvedValue({
      accessToken: "jeton-A",
      rafraichirApres: MAINTENANT + 60_000,
    });
    definirLectureDeSession(lire);
    await jetonCourant(MAINTENANT);

    verrouillerJeton();

    expect(await jetonCourant(MAINTENANT + 1)).toBeNull();
    expect(lire, "aucune lecture après le verrou").toHaveBeenCalledTimes(1);
  });

  /**
   * Le cas qui fait le défaut : une lecture partie **avant** le verrou revient **après**. Son
   * résultat doit être jeté, sans quoi le jeton — et le cookie qu'il accompagne — ressuscite.
   */
  it("jette le résultat d'une lecture revenue après le verrou", async () => {
    let resoudre: (v: { accessToken: string; rafraichirApres: number }) => void = () => {};
    definirLectureDeSession(
      () => new Promise((r) => {
        resoudre = r;
      }),
    );

    const enVol = jetonCourant(MAINTENANT);
    verrouillerJeton();
    resoudre({ accessToken: "jeton-A", rafraichirApres: MAINTENANT + 60_000 });

    expect(await enVol).toBeNull();
    expect(await jetonCourant(MAINTENANT + 1)).toBeNull();
  });

  /**
   * Le geste qui rend la déconnexion déterministe : elle attend que la lecture en vol soit retombée
   * avant de partir, sans quoi cette réponse reposerait le cookie qu'elle vient d'effacer.
   */
  it("attend la lecture en vol avant de rendre la main", async () => {
    let resoudre: (v: { accessToken: string; rafraichirApres: number }) => void = () => {};
    let retombee = false;
    definirLectureDeSession(
      () => new Promise((r) => {
        resoudre = (v) => {
          retombee = true;
          r(v);
        };
      }),
    );

    void jetonCourant(MAINTENANT);
    verrouillerJeton();
    const attente = attendreLecturesEnCours();

    expect(retombee, "la lecture est encore en vol").toBe(false);
    resoudre({ accessToken: "jeton-A", rafraichirApres: MAINTENANT + 60_000 });
    await attente;
    expect(retombee).toBe(true);
  });

  it("rend la main tout de suite quand aucune lecture n'est en vol", async () => {
    definirLectureDeSession(async () => null);
    await expect(attendreLecturesEnCours()).resolves.toBeUndefined();
  });

  it("rend null quand il n'y a pas de session", async () => {
    definirLectureDeSession(async () => null);
    expect(await jetonCourant(MAINTENANT)).toBeNull();
  });
});
