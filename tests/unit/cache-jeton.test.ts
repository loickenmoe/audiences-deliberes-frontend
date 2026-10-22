import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  attendreLecturesEnCours,
  definirLectureDeSession,
  jetonCourant,
  reinitialiserCacheJeton,
  verrouillerJeton,
} from "@/lib/cache-jeton";

/**
 * Access token cache. What is checked is **the number of session reads**: each read sets the
 * session cookie again on the server side, which decides whether a logout actually holds.
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

    // Eight concurrent requests: the load of a home screen.
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
   * Without a published expiry, keeping the token forever would serve a dead token, and reading it
   * on every call would defeat the cache. A short fallback covers both.
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
   * A read started **before** the lock returns **after** it. Its result must be discarded, otherwise
   * the token (and its cookie) comes back to life.
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
   * Logout waits for the in-flight read to settle, otherwise that response would set again the
   * cookie it has just cleared.
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
