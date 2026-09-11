/**
 * @vitest-environment node
 *
 * File des demandes de suppression (#63, #41) et rapport journalier (#42) : ce qui part sur le fil.
 */
import { HttpResponse, http } from "msw";
import { setupServer } from "msw/node";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";

import { gedService } from "@/services/gedService";

const BASE = "http://localhost:8080/api/v1";

let derniere: { url: URL; corps: unknown } | null = null;

const serveur = setupServer(
  http.get(`${BASE}/ged/demandes-suppression`, ({ request }) => {
    derniere = { url: new URL(request.url), corps: null };
    return HttpResponse.json([]);
  }),
  http.put(`${BASE}/ged/documents/:id/approbation-suppression`, async ({ request }) => {
    derniere = { url: new URL(request.url), corps: await request.json() };
    return HttpResponse.json({ id: 1, statut: "REJETEE" });
  }),
  http.get(`${BASE}/ged/rapport-journalier`, ({ request }) => {
    derniere = { url: new URL(request.url), corps: null };
    return HttpResponse.json({
      date: "2026-09-11",
      dossiersManipules: 0,
      piecesAjoutees: 0,
      affairesNouvelles: 0,
      planificationActes: [],
    });
  }),
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

describe("file des demandes de suppression", () => {
  it("filtre par statut quand on le demande", async () => {
    await gedService.listerDemandesSuppression("EN_ATTENTE");
    expect(derniere?.url.searchParams.get("statut")).toBe("EN_ATTENTE");
  });

  it("n'envoie aucun filtre pour l'historique complet", async () => {
    await gedService.listerDemandesSuppression(null);
    expect(derniere?.url.searchParams.has("statut")).toBe(false);
  });

  it("transmet le motif d'un rejet", async () => {
    await gedService.deciderSuppression(12, { decision: "REJETEE", motifRejet: "Pièce encore utile" });

    expect(derniere?.url.pathname).toBe("/api/v1/ged/documents/12/approbation-suppression");
    expect(derniere?.corps).toEqual({ decision: "REJETEE", motifRejet: "Pièce encore utile" });
  });
});

describe("rapport journalier", () => {
  it("demande la date choisie", async () => {
    const rapport = await gedService.rapportJournalier("2026-09-11");

    expect(derniere?.url.searchParams.get("date")).toBe("2026-09-11");
    expect(rapport.planificationActes).toEqual([]);
  });
});
