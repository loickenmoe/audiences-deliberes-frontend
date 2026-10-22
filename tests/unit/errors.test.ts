import { describe, expect, it } from "vitest";

import { appliquerErreurApi } from "@/lib/api/erreurs-formulaire";
import { CodeErreur, ErreurApi, messageErreur, normaliserErreur, estCompteAvocatNonRattache } from "@/lib/api/errors";

/**
 * The error bodies used here are the ones **actually returned by the backend**, not made-up examples.
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

    // The backend's precise business message, not the generic permission message.
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
   * ERR-003 and ERR-005 are not failures: the backend expects a confirmation, replayed with
   * `?forcer=true`. Showing them as errors would block two legitimate business flows.
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

describe("estCompteAvocatNonRattache", () => {
  /**
   * The account belongs to a lawyer, but no directory record is linked to it. This is not a
   * permission denial: the UI explains it instead of showing a failure.
   */
  it("reconnaît le code dédié", () => {
    const erreur = normaliserErreur({
      response: { status: 403, data: { code: "ERR-AVOCAT-NON-RATTACHE", message: "…" } },
    });
    expect(estCompteAvocatNonRattache(erreur)).toBe(true);
  });

  /**
   * A **real** permission denial must not be confused with it, otherwise a lawyer forcing a forbidden
   * URL would read a wrong "account not linked" message.
   */
  it("ne confond pas un refus de droits ordinaire", () => {
    const erreur = normaliserErreur({
      response: { status: 403, data: { code: "ERR-FORBIDDEN", message: "Droits insuffisants" } },
    });
    expect(estCompteAvocatNonRattache(erreur)).toBe(false);
  });

  it("ignore ce qui n'est pas une erreur d'API", () => {
    expect(estCompteAvocatNonRattache(new Error("réseau"))).toBe(false);
    expect(estCompteAvocatNonRattache(null)).toBe(false);
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
 * Bodies captured by triggering real duplicates: a second client creation returns
 * `409 ERR-CONFLICT`, **not** `ERR-002`, which is reserved for case file references
 * (`DossierService`). This decides whether the message lands on a field or in a banner.
 */
describe("appliquerErreurApi", () => {
  function espion() {
    const appels: { champ: string; message?: string }[] = [];
    /*
     * `appliquerErreurApi` expects react-hook-form's `setError`, whose full type depends on the form
     * shape. Only its two-argument signature is needed, declared here instead of using `any`.
     */
    const setError = (champ: string, options: { message?: string }) => {
      appels.push({ champ, message: options.message });
    };
    return { appels, setError: setError as unknown as Parameters<typeof appliquerErreurApi>[1] };
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

    // The code covers ten different conflicts: guessing would highlight the wrong field elsewhere.
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
      // Stale mapping: the backend knows which field it means.
      { "ERR-CONFLICT": "reference" },
    );

    expect(appels).toEqual([{ champ: "compteKeycloak", message: "Compte déjà rattaché" }]);
  });

  it("ignore ce qui n'est pas une erreur d'API", () => {
    const { setError } = espion();
    expect(appliquerErreurApi(new Error("réseau"), setError, ["reference"])).toBe(false);
  });
});
