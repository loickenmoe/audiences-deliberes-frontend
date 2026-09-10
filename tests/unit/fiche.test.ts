import { HttpResponse, http } from "msw";
import { setupServer } from "msw/node";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";

import { ErreurApi } from "@/lib/api/errors";
import { dossierService } from "@/services/dossierService";
import { gedService } from "@/services/gedService";

/**
 * Appels de la fiche dossier (F7), contre un backend simulé.
 *
 * Comme pour la création, l'enjeu est la **requête émise** : verbe, chemin, corps, et surtout le
 * paramètre `forcer`, qui ne doit partir que sur confirmation explicite de l'utilisateur.
 */
const BASE = "http://localhost:8080/api/v1";

let derniereRequete: { methode: string; url: URL; corps: unknown } | null = null;

async function memoriser(request: Request) {
  const texte = await request.text();
  derniereRequete = {
    methode: request.method,
    url: new URL(request.url),
    corps: texte ? JSON.parse(texte) : null,
  };
}

const serveur = setupServer(
  http.put(`${BASE}/dossiers/:id/affectation`, async ({ request }) => {
    await memoriser(request);
    return HttpResponse.json({ id: 7 });
  }),
  http.patch(`${BASE}/dossiers/:id/etapes/:etapeId/statut`, async ({ request }) => {
    await memoriser(request);
    return HttpResponse.json({ id: 11, dossierId: 7, type: "INSTANCE", statutCycleVie: "EN_COURS" });
  }),
  http.post(`${BASE}/dossiers/:id/etapes`, async ({ request }) => {
    await memoriser(request);
    return HttpResponse.json({ id: 12, dossierId: 7, type: "RECOURS_2", statutCycleVie: "OUVERTURE" }, { status: 201 });
  }),
  http.post(`${BASE}/dossiers/:id/seuil-derogation`, async ({ request }) => {
    await memoriser(request);
    return HttpResponse.json({ id: 3, statut: "EN_ATTENTE" }, { status: 201 });
  }),
  http.post(`${BASE}/dossiers/:id/sensibilite/validation`, async ({ request }) => {
    await memoriser(request);
    return HttpResponse.json({ id: 7 });
  }),
  http.get(`${BASE}/dossiers/:id/seuil-derogation`, async ({ request }) => {
    await memoriser(request);
    return HttpResponse.json([]);
  }),
  http.put(`${BASE}/dossiers/:id/seuil-derogation/:auditId`, async ({ request }) => {
    await memoriser(request);
    return HttpResponse.json({ id: 3, statut: "VALIDEE" });
  }),
  http.get(`${BASE}/dossiers/:id/documents`, async ({ request }) => {
    await memoriser(request);
    return HttpResponse.json([]);
  }),
);

beforeAll(() => {
  process.env.NEXT_PUBLIC_API_URL = BASE;
  process.env.NEXT_PUBLIC_WS_URL = "http://localhost:8080/ws";
  serveur.listen({ onUnhandledRequest: "error" });
});
afterEach(() => {
  serveur.resetHandlers();
  derniereRequete = null;
});
afterAll(() => serveur.close());

describe("affectation (#4)", () => {
  const affectation = { juristesAffectes: [3], avocatsAffectes: [5] };

  it("n'envoie pas `forcer` sans confirmation", async () => {
    await dossierService.modifierAffectation(7, affectation);

    expect(derniereRequete?.methode).toBe("PUT");
    // Forcer d'emblée court-circuiterait la confirmation exigée par RG-DOS-07 — et l'alerte au DJ
    // partirait sans que l'utilisateur ait rien confirmé.
    expect(derniereRequete?.url.searchParams.has("forcer")).toBe(false);
    expect(derniereRequete?.corps).toEqual(affectation);
  });

  it("envoie `forcer=true` une fois la confirmation donnée", async () => {
    await dossierService.modifierAffectation(7, affectation, true);

    expect(derniereRequete?.url.searchParams.get("forcer")).toBe("true");
  });

  it("présente ERR-003 comme une demande de confirmation, non comme un échec", async () => {
    serveur.use(
      http.put(`${BASE}/dossiers/:id/affectation`, () =>
        HttpResponse.json(
          { code: "ERR-003", message: "Au moins un juriste ou avocat est déjà affecté", details: null },
          { status: 409 },
        ),
      ),
    );

    await expect(dossierService.modifierAffectation(7, affectation)).rejects.toSatisfy(
      (erreur: unknown) => erreur instanceof ErreurApi && erreur.demandeConfirmation,
    );
  });
});

describe("étapes (#5 et positionnement direct)", () => {
  it("transmet le nouveau statut sous la clé attendue par le backend", async () => {
    await dossierService.modifierStatutEtape(7, 11, "EN_COURS");

    expect(derniereRequete?.methode).toBe("PATCH");
    expect(derniereRequete?.url.pathname).toBe("/api/v1/dossiers/7/etapes/11/statut");
    expect(derniereRequete?.corps).toEqual({ nouveauStatut: "EN_COURS" });
  });

  it("crée une étape par son type", async () => {
    await dossierService.creerEtape(7, "RECOURS_2");

    expect(derniereRequete?.url.pathname).toBe("/api/v1/dossiers/7/etapes");
    expect(derniereRequete?.corps).toEqual({ type: "RECOURS_2" });
  });
});

describe("dérogation et sensibilité (#6, #8)", () => {
  it("demande une dérogation avec seuil et motif", async () => {
    await dossierService.demanderDerogation(7, { nouveauSeuil: 80_000_000, motif: "Client stratégique" });

    expect(derniereRequete?.corps).toEqual({ nouveauSeuil: 80_000_000, motif: "Client stratégique" });
  });

  it("valide la sensibilité sans champ d'ajustement quand la proposition est conservée", async () => {
    await dossierService.validerSensibilite(7, { statut: "VALIDEE" });

    // Un `seuilMontantAjuste: 0` écraserait le seuil proposé : les champs absents ne partent pas.
    expect(derniereRequete?.corps).toEqual({ statut: "VALIDEE" });
  });
});

describe("arbitrage des dérogations (Q-74, #7)", () => {
  it("lit la file d'arbitrage filtrée sur les demandes en attente", async () => {
    await dossierService.listerDerogations(7, "EN_ATTENTE");

    expect(derniereRequete?.url.pathname).toBe("/api/v1/dossiers/7/seuil-derogation");
    expect(derniereRequete?.url.searchParams.get("statut")).toBe("EN_ATTENTE");
  });

  it("arbitre une demande par son identifiant, désormais connu", async () => {
    await dossierService.validerDerogation(7, 3, { statut: "REJETEE", motif: "Hors politique" });

    expect(derniereRequete?.methode).toBe("PUT");
    expect(derniereRequete?.url.pathname).toBe("/api/v1/dossiers/7/seuil-derogation/3");
    expect(derniereRequete?.corps).toEqual({ statut: "REJETEE", motif: "Hors politique" });
  });
});

describe("documents (#43)", () => {
  it("lit la liste dédiée plutôt que le champ `documents` du dossier", async () => {
    await gedService.listerDocumentsDossier(7);

    expect(derniereRequete?.methode).toBe("GET");
    expect(derniereRequete?.url.pathname).toBe("/api/v1/dossiers/7/documents");
  });
});
