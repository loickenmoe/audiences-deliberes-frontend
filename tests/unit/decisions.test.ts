/**
 * @vitest-environment node
 *
 * Décisions définitives (#51-#53, lecture Q-88) et jurisprudence (#54, #55) : ce qui part sur le
 * fil. Sous Node : MSW ne relit un corps `FormData` que dans cet environnement.
 */
import { HttpResponse, http, type JsonBodyType } from "msw";
import { setupServer } from "msw/node";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";

import { decisionService, decouperMotsCles } from "@/services/decisionService";

const BASE = "http://localhost:8080/api/v1";

let derniere: { methode: string; url: URL; corps: unknown; formulaire?: FormData } | null = null;

async function capturer(request: Request, reponse: JsonBodyType = { id: 7 }) {
  const type = request.headers.get("content-type") ?? "";
  if (type.startsWith("multipart/form-data")) {
    derniere = { methode: request.method, url: new URL(request.url), corps: null, formulaire: await request.formData() };
  } else {
    const texte = await request.text();
    derniere = { methode: request.method, url: new URL(request.url), corps: texte ? JSON.parse(texte) : null };
  }
  return HttpResponse.json(reponse);
}

const serveur = setupServer(
  http.get(`${BASE}/dossiers/:id/decisions`, ({ request }) => capturer(request, { adjudications: [], condamnations: [] })),
  http.post(`${BASE}/dossiers/:id/adjudications`, ({ request }) => capturer(request)),
  http.post(`${BASE}/dossiers/:id/condamnations`, ({ request }) => capturer(request)),
  http.patch(`${BASE}/condamnations/:id/statut`, ({ request }) => capturer(request)),
  http.get(`${BASE}/jurisprudences`, ({ request }) => capturer(request, { content: [], totalPages: 0, totalElements: 0 })),
  http.post(`${BASE}/jurisprudences`, ({ request }) => capturer(request)),
);

beforeAll(() => {
  process.env.NEXT_PUBLIC_API_URL = BASE;
  process.env.NEXT_PUBLIC_WS_URL = "http://localhost:8080/ws";
  serveur.listen({ onUnhandledRequest: "error" });
});
afterEach(() => {
  serveur.resetHandlers();
  derniere = null;
});
afterAll(() => serveur.close());

describe("décisions d'un dossier", () => {
  it("se relisent par le dossier", async () => {
    const decisions = await decisionService.lister(4);

    expect(derniere?.url.pathname).toBe("/api/v1/dossiers/4/decisions");
    expect(decisions.condamnations).toEqual([]);
  });

  it("une adjudication porte son suivi financier complet", async () => {
    await decisionService.creerAdjudication(4, {
      etapeId: 9,
      beneficiaire: "Afriland First Bank",
      statutComptabilisation: "Comptabilisée",
      repriseProvision: true,
      restitutionSoulte: false,
      mutation: true,
      reliquat: 0,
      dateDecision: "2026-09-01",
    });

    expect(derniere?.url.pathname).toBe("/api/v1/dossiers/4/adjudications");
    expect(derniere?.corps).toMatchObject({ etapeId: 9, repriseProvision: true, mutation: true, reliquat: 0 });
  });

  it("une condamnation sans étape n'en envoie pas", async () => {
    await decisionService.creerCondamnation(4, { sens: "BANQUE_REDEVABLE", naturePaiement: "Frais de procédure", dateDecision: "2026-09-01" });
    expect(derniere?.corps).toEqual({ sens: "BANQUE_REDEVABLE", naturePaiement: "Frais de procédure", dateDecision: "2026-09-01" });
  });

  it("le statut de paiement se met à jour", async () => {
    await decisionService.modifierStatutCondamnation(12, "RECOUVREMENT_FORCE");

    expect(derniere?.methode).toBe("PATCH");
    expect(derniere?.url.pathname).toBe("/api/v1/condamnations/12/statut");
    expect(derniere?.corps).toEqual({ statutPaiement: "RECOUVREMENT_FORCE" });
  });
});

describe("jurisprudence", () => {
  it("cherche par filtres et par dossier, sans envoyer les filtres vides", async () => {
    await decisionService.rechercherJurisprudences({ motCle: "saisie", natureDecision: "", dossierId: 4, page: 1 });

    expect(derniere?.url.searchParams.get("motCle")).toBe("saisie");
    expect(derniere?.url.searchParams.has("natureDecision")).toBe(false);
    expect(derniere?.url.searchParams.get("dossierId")).toBe("4");
    expect(derniere?.url.searchParams.get("page")).toBe("1");
  });

  it("archive en multipart : le fichier, un champ par mot-clé, l'indexation", async () => {
    const fichier = new File([new Uint8Array([37, 80, 68, 70])], "arret.pdf", { type: "application/pdf" });
    await decisionService.archiverJurisprudence(
      {
        dossierId: 4,
        typeArchive: "GROSSE",
        motsCles: ["saisie immobilière", "hypothèque"],
        natureDecision: "Arrêt",
        juridiction: "Cour d’appel du Littoral",
        dateDecision: "2026-06-30",
      },
      fichier,
    );

    const formulaire = derniere?.formulaire;
    expect(formulaire?.getAll("motsCles")).toEqual(["saisie immobilière", "hypothèque"]);
    expect(formulaire?.get("dossierId")).toBe("4");
    expect(formulaire?.get("typeArchive")).toBe("GROSSE");
    expect((formulaire?.get("file") as File | null)?.name).toBe("arret.pdf");
  });

  it("découpe les mots-clés saisis, sans vides ni doublons", () => {
    expect(decouperMotsCles(" saisie immobilière, ,Hypothèque, saisie IMMOBILIÈRE ")).toEqual(["saisie immobilière", "Hypothèque"]);
    expect(decouperMotsCles("  ")).toEqual([]);
  });
});
