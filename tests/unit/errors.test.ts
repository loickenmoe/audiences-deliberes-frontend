import { describe, expect, it } from "vitest";

import { appliquerErreurApi } from "@/lib/api/erreurs-formulaire";
import { CodeErreur, ErreurApi, messageErreur, normaliserErreur } from "@/lib/api/errors";

/**
 * Les corps d'erreur utilisés ici sont ceux **réellement renvoyés par le backend**, relevés le
 * 2026-09-08 sur l'instance locale — pas des exemples inventés.
 */
describe("normaliserErreur", () => {
  it("lit le corps { code, message, details } du backend", () => {
    const erreur = normaliserErreur({
      response: {
        status: 401,
        data: { code: "ERR-UNAUTHENTICATED", message: "Authentification requise", details: null },
      },
    });

    expect(erreur).toBeInstanceOf(ErreurApi);
    expect(erreur.code).toBe(CodeErreur.NON_AUTHENTIFIE);
    expect(erreur.message).toBe("Authentification requise");
    expect(erreur.details).toBeNull();
    expect(erreur.statut).toBe(401);
  });

  it("préfère le message du backend au message par défaut", () => {
    const erreur = normaliserErreur({
      response: {
        status: 403,
        data: {
          code: "ERR-FORBIDDEN",
          message: "Aucun avocat associé à cet utilisateur",
          details: null,
        },
      },
    });

    // Message métier précis du backend, pas le générique « Vous n'avez pas les droits… ».
    expect(erreur.message).toBe("Aucun avocat associé à cet utilisateur");
  });

  it("retombe sur le code HTTP quand le corps est inexploitable", () => {
    const erreur = normaliserErreur({ response: { status: 404, data: "<html>Not Found</html>" } });

    expect(erreur.code).toBe(CodeErreur.RESSOURCE_INTROUVABLE);
    expect(erreur.message).toBe("Cet élément est introuvable.");
  });

  it("distingue une coupure réseau d'une erreur serveur", () => {
    const erreur = normaliserErreur({ request: {}, message: "Network Error" });

    expect(erreur.code).toBe("ERR-NETWORK");
    expect(erreur.statut).toBeUndefined();
  });

  it("absorbe une exception quelconque sans perdre son message", () => {
    const erreur = normaliserErreur(new Error("boom"));

    expect(erreur.code).toBe(CodeErreur.ERREUR_INTERNE);
    expect(erreur.message).toBe("boom");
  });
});

describe("demandeConfirmation", () => {
  /**
   * ERR-003 et ERR-005 ne sont pas des échecs : le backend attend une confirmation, rejouée avec
   * `?forcer=true`. Les présenter comme des erreurs bloquerait deux parcours métier légitimes.
   */
  it.each([
    ["ERR-003", "doublon d'affectation"],
    ["ERR-005", "doublon d'audience"],
  ])("%s (%s) demande une confirmation", (code) => {
    const erreur = normaliserErreur({ response: { status: 409, data: { code, message: "…" } } });
    expect(erreur.demandeConfirmation).toBe(true);
  });

  it.each(["ERR-002", "ERR-006", "ERR-CONFLICT"])("%s reste une erreur franche", (code) => {
    const erreur = normaliserErreur({ response: { status: 409, data: { code, message: "…" } } });
    expect(erreur.demandeConfirmation).toBe(false);
  });
});

describe("messageErreur", () => {
  it("renvoie le message d'une ErreurApi", () => {
    expect(messageErreur(new ErreurApi({ code: "ERR-X", message: "Échec précis" }))).toBe(
      "Échec précis",
    );
  });

  it("normalise puis extrait le message d'une erreur brute", () => {
    expect(
      messageErreur({ response: { status: 403, data: { code: "ERR-FORBIDDEN", message: "Nope" } } }),
    ).toBe("Nope");
  });
});

/**
 * Corps relevés le 2026-09-09 sur l'instance locale, en provoquant les doublons pour de vrai :
 * une seconde création de client renvoie `409 ERR-CONFLICT`, **pas** `ERR-002` — ce dernier est
 * réservé aux références de dossier (`DossierService`). La distinction n'est pas cosmétique : c'est
 * elle qui décide si le message atterrit sur un champ ou dans un bandeau.
 */
describe("appliquerErreurApi", () => {
  function espion() {
    const appels: { champ: string; message?: string }[] = [];
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const setError = ((champ: string, options: { message?: string }) => {
      appels.push({ champ, message: options.message });
    }) as any;
    return { appels, setError };
  }

  it("résout les codes numérotés du contrat sans aide de l'appelant", () => {
    const { appels, setError } = espion();
    const place = appliquerErreurApi(
      new ErreurApi({ code: "ERR-002", message: "Référence déjà utilisée" }),
      setError,
      ["reference", "nom"],
    );

    expect(place).toBe(true);
    expect(appels).toEqual([{ champ: "reference", message: "Référence déjà utilisée" }]);
  });

  it("suit le champ nommé par le backend, sans que le formulaire ait rien à déclarer", () => {
    const { appels, setError } = espion();
    const place = appliquerErreurApi(
      new ErreurApi({
        code: "ERR-CONFLICT",
        message: "La référence client est déjà utilisée",
        champ: "reference",
      }),
      setError,
      ["reference", "nom"],
    );

    expect(place).toBe(true);
    expect(appels).toEqual([{ champ: "reference", message: "La référence client est déjà utilisée" }]);
  });

  it("laisse `ERR-CONFLICT` au formulaire tant que personne n'a dit quel champ il vise", () => {
    const { appels, setError } = espion();
    const place = appliquerErreurApi(
      new ErreurApi({ code: "ERR-CONFLICT", message: "La référence client est déjà utilisée" }),
      setError,
      ["reference", "nom"],
    );

    // Le code couvre dix conflits différents : le deviner surlignerait le mauvais champ ailleurs.
    expect(place).toBe(false);
    expect(appels).toEqual([]);
  });

  it("place `ERR-CONFLICT` sur le champ que le formulaire déclare, si le backend se tait", () => {
    const { appels, setError } = espion();
    const place = appliquerErreurApi(
      new ErreurApi({ code: "ERR-CONFLICT", message: "Compte déjà rattaché" }),
      setError,
      ["nom", "compteKeycloak"],
      { "ERR-CONFLICT": "compteKeycloak" },
    );

    expect(place).toBe(true);
    expect(appels).toEqual([{ champ: "compteKeycloak", message: "Compte déjà rattaché" }]);
  });

  it("refuse un champ absent du formulaire plutôt que d'échouer en silence", () => {
    const { appels, setError } = espion();
    const place = appliquerErreurApi(
      new ErreurApi({ code: "ERR-006", message: "Facture en double" }),
      setError,
      ["reference"],
    );

    expect(place).toBe(false);
    expect(appels).toEqual([]);
  });

  it("préfère le champ du backend à la déclaration du formulaire", () => {
    const { appels, setError } = espion();
    appliquerErreurApi(
      new ErreurApi({ code: "ERR-CONFLICT", message: "Compte déjà rattaché", champ: "compteKeycloak" }),
      setError,
      ["reference", "compteKeycloak"],
      // Déclaration périmée : le backend, lui, sait de quel champ il parle.
      { "ERR-CONFLICT": "reference" },
    );

    expect(appels).toEqual([{ champ: "compteKeycloak", message: "Compte déjà rattaché" }]);
  });

  it("ignore ce qui n'est pas une erreur d'API", () => {
    const { setError } = espion();
    expect(appliquerErreurApi(new Error("réseau"), setError, ["reference"])).toBe(false);
  });
});
