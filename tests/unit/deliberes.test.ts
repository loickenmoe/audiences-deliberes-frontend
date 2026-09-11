/**
 * @vitest-environment node
 *
 * Sous Node, comme `audiences.test.ts` : on vérifie ici ce qui part sur le fil — chemins, verbes et
 * corps — pour chaque étape du cycle d'un délibéré (Q-78).
 */
import { HttpResponse, http } from "msw";
import { setupServer } from "msw/node";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";

import { delibereService } from "@/services/delibereService";

const BASE = "http://localhost:8080/api/v1";

let derniere: { methode: string; url: URL; corps: unknown } | null = null;

async function capturer(request: Request) {
  const texte = await request.text();
  derniere = { methode: request.method, url: new URL(request.url), corps: texte ? JSON.parse(texte) : null };
}

const serveur = setupServer(
  http.post(`${BASE}/dossiers/:id/deliberes`, async ({ request }) => {
    await capturer(request);
    return HttpResponse.json({ id: 5, etat: "EN_ATTENTE" }, { status: 201 });
  }),
  http.put(`${BASE}/deliberes/:id/resultat`, async ({ request }) => {
    await capturer(request);
    return HttpResponse.json({ id: 5, etat: "VIDE" });
  }),
  http.post(`${BASE}/deliberes/:id/prorogations`, async ({ request }) => {
    await capturer(request);
    return HttpResponse.json({ id: 9, compteur: 11, alerte: true }, { status: 201 });
  }),
  http.get(`${BASE}/deliberes/:id/prorogations`, async ({ request }) => {
    await capturer(request);
    return HttpResponse.json([]);
  }),
  http.post(`${BASE}/deliberes/:id/rabattement`, async ({ request }) => {
    await capturer(request);
    return HttpResponse.json({ id: 10, statutCycleVie: "EN_COURS" }, { status: 201 });
  }),
  http.put(`${BASE}/deliberes/:id/expedition`, async ({ request }) => {
    await capturer(request);
    return HttpResponse.json({ id: 5, statutExpedition: "LEVEE" });
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

describe("cycle d'un délibéré (Q-78)", () => {
  it("met en délibéré sans envoyer de résultat ni d'échéance", async () => {
    await delibereService.enregistrer(7, { etapeId: 3, dateDeliberee: "2026-10-01" });

    expect(derniere?.url.pathname).toBe("/api/v1/dossiers/7/deliberes");
    expect(derniere?.corps).toEqual({ etapeId: 3, dateDeliberee: "2026-10-01" });
  });

  it("vide le délibéré par un PUT sur son résultat", async () => {
    const delibere = await delibereService.vider(5, { resultat: "DEFAVORABLE", dateEcheanceRecours: "2026-11-01T09:00" });

    expect(derniere?.methode).toBe("PUT");
    expect(derniere?.url.pathname).toBe("/api/v1/deliberes/5/resultat");
    expect(derniere?.corps).toEqual({ resultat: "DEFAVORABLE", dateEcheanceRecours: "2026-11-01T09:00" });
    expect(delibere.etat).toBe("VIDE");
  });

  it("transmet l'alerte de seuil d'une prorogation, qui n'est pas une erreur", async () => {
    const prorogation = await delibereService.proroger(5, { date: "2026-10-15" });

    expect(derniere?.corps).toEqual({ date: "2026-10-15" });
    expect(prorogation.alerte).toBe(true);
  });

  it("lit l'historique des prorogations", async () => {
    await delibereService.listerProrogations(5);
    expect(derniere?.url.pathname).toBe("/api/v1/deliberes/5/prorogations");
  });

  it("rabat avec sa date et son motif", async () => {
    await delibereService.rabattre(5, { date: "2026-09-11", motif: "Réouverture des débats" });

    expect(derniere?.url.pathname).toBe("/api/v1/deliberes/5/rabattement");
    expect(derniere?.corps).toEqual({ date: "2026-09-11", motif: "Réouverture des débats" });
  });

  it("modifie l'expédition", async () => {
    await delibereService.modifierExpedition(5, "LEVEE");
    expect(derniere?.corps).toEqual({ statutExpedition: "LEVEE" });
  });
});
