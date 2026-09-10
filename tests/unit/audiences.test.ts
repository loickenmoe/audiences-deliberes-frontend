/**
 * @vitest-environment node
 *
 * Sous Node : l'export du calendrier est une réponse **binaire**, et c'est son traitement que ce
 * fichier vérifie — jsdom et MSW s'accordent mal sur les corps binaires (cf. `ged.test.ts`).
 */
import { HttpResponse, http } from "msw";
import { setupServer } from "msw/node";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";

import { ErreurApi } from "@/lib/api/errors";
import { audienceService } from "@/services/audienceService";

const BASE = "http://localhost:8080/api/v1";

let derniere: { url: URL; corps: unknown } | null = null;

const serveur = setupServer(
  http.post(`${BASE}/dossiers/:id/audiences`, async ({ request }) => {
    derniere = { url: new URL(request.url), corps: await request.json() };
    return HttpResponse.json({ id: 1, statut: "PLANIFIEE" }, { status: 201 });
  }),
  http.put(`${BASE}/alarmes/:id/reprogrammer`, async ({ request }) => {
    derniere = { url: new URL(request.url), corps: await request.json() };
    return HttpResponse.json({ id: 2, alarmePrecedenteId: 1, statut: "ACTIVE" });
  }),
  http.patch(`${BASE}/audiences/:id/annulation`, async ({ request }) => {
    derniere = { url: new URL(request.url), corps: await request.json() };
    return HttpResponse.json({ id: 5, statut: "ANNULEE", motifAnnulation: "Renvoi" });
  }),
  http.patch(`${BASE}/alarmes/:id/traiter`, ({ request }) => {
    derniere = { url: new URL(request.url), corps: null };
    return HttpResponse.json({ id: 3, statut: "TRAITEE" });
  }),
  http.get(`${BASE}/audiences/calendrier`, ({ request }) => {
    const url = new URL(request.url);
    derniere = { url, corps: null };
    if (url.searchParams.get("format") === "PDF") {
      return new HttpResponse("%PDF-1.4", { headers: { "Content-Type": "application/pdf" } });
    }
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
  derniere = null;
});
afterAll(() => serveur.close());

describe("planification (#13)", () => {
  it("n'envoie pas `forcer` sans confirmation", async () => {
    await audienceService.planifier(7, { etapeId: 3, datePlanifiee: "2026-10-01" });

    expect(derniere?.url.searchParams.has("forcer")).toBe(false);
    expect(derniere?.corps).toEqual({ etapeId: 3, datePlanifiee: "2026-10-01" });
  });

  it("rejoue avec `forcer=true` une fois le doublon confirmé", async () => {
    await audienceService.planifier(7, { etapeId: 3, datePlanifiee: "2026-10-01" }, true);
    expect(derniere?.url.searchParams.get("forcer")).toBe("true");
  });

  it("présente ERR-005 comme une demande de confirmation", async () => {
    serveur.use(
      http.post(`${BASE}/dossiers/:id/audiences`, () =>
        HttpResponse.json({ code: "ERR-005", message: "Une audience existe déjà", details: null }, { status: 409 }),
      ),
    );

    await expect(audienceService.planifier(7, { etapeId: 3, datePlanifiee: "2026-10-01" })).rejects.toSatisfy(
      (erreur: unknown) => erreur instanceof ErreurApi && erreur.demandeConfirmation,
    );
  });
});

describe("reprogrammation (#17)", () => {
  it("n'envoie pas d'objet vide : le backend reprend alors l'objet précédent", async () => {
    await audienceService.reprogrammerAlarme(1, { dateEcheance: "2026-10-01T09:00" });
    expect(derniere?.corps).toEqual({ dateEcheance: "2026-10-01T09:00" });
  });
});

describe("annulation d'audience (QF-30) et traitement d'alarme (QF-29)", () => {
  it("annule une audience en transmettant son motif", async () => {
    const audience = await audienceService.annuler(5, "Renvoi prononcé par le tribunal");

    expect(derniere?.url.pathname).toBe("/api/v1/audiences/5/annulation");
    expect(derniere?.corps).toEqual({ motif: "Renvoi prononcé par le tribunal" });
    expect(audience.statut).toBe("ANNULEE");
  });

  it("marque une alarme traitée", async () => {
    const alarme = await audienceService.traiterAlarme(3);

    expect(derniere?.url.pathname).toBe("/api/v1/alarmes/3/traiter");
    expect(alarme.statut).toBe("TRAITEE");
  });
});

describe("calendrier (#15)", () => {
  it("demande explicitement le format JSON pour l'écran", async () => {
    await audienceService.calendrier("MENSUELLE", "2026-09-01");

    expect(derniere?.url.searchParams.get("periode")).toBe("MENSUELLE");
    expect(derniere?.url.searchParams.get("dateDebut")).toBe("2026-09-01");
    expect(derniere?.url.searchParams.get("format")).toBe("JSON");
  });

  it("récupère l'export PDF comme un document binaire", async () => {
    const contenu = await audienceService.exporterCalendrier("HEBDOMADAIRE", "2026-09-07", "PDF");
    expect(await contenu.text()).toBe("%PDF-1.4");
  });

  it("relit le message d'erreur du backend, arrivé lui aussi en binaire", async () => {
    serveur.use(
      http.get(`${BASE}/audiences/calendrier`, () =>
        HttpResponse.json({ code: "ERR-FORBIDDEN", message: "Droits insuffisants", details: null }, { status: 403 }),
      ),
    );

    // Sans relecture du Blob, seul un message générique atteindrait l'utilisateur.
    await expect(audienceService.exporterCalendrier("HEBDOMADAIRE", "2026-09-07", "PDF")).rejects.toMatchObject({
      code: "ERR-FORBIDDEN",
      message: "Droits insuffisants",
    });
  });
});
