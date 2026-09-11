/**
 * @vitest-environment node
 *
 * Frais d'avocats (#24 à #28, détail Q-82) : ce qui part sur le fil, et la file propre à chaque profil.
 */
import { HttpResponse, http } from "msw";
import { setupServer } from "msw/node";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";

import { aDonneSonAccord, etapeConjointeDe, vuesFrais } from "@/lib/frais";
import { fraisService } from "@/services/fraisService";
import type { DemandeFrais } from "@/types/domaine";

const BASE = "http://localhost:8080/api/v1";

let derniere: { methode: string; url: URL; corps: unknown } | null = null;

async function capturer(request: Request) {
  const texte = await request.text();
  derniere = { methode: request.method, url: new URL(request.url), corps: texte ? JSON.parse(texte) : null };
  return HttpResponse.json({ id: 7, statutCircuit: "VALIDEE" });
}

const serveur = setupServer(
  http.get(`${BASE}/frais/demandes`, ({ request }) => capturer(request)),
  http.get(`${BASE}/frais/demandes/:id`, ({ request }) => capturer(request)),
  http.put(`${BASE}/frais/demandes/:id/conformite`, ({ request }) => capturer(request)),
  http.put(`${BASE}/frais/demandes/:id/opportunite`, ({ request }) => capturer(request)),
  http.post(`${BASE}/frais/demandes/:id/validation-conjointe`, ({ request }) => capturer(request)),
  http.patch(`${BASE}/frais/demandes/:id/paiement`, ({ request }) => capturer(request)),
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

describe("file des demandes", () => {
  it("filtre par statut et pagine", async () => {
    await fraisService.lister("OPPORTUNITE", 2);

    expect(derniere?.url.searchParams.get("statut")).toBe("OPPORTUNITE");
    expect(derniere?.url.searchParams.get("page")).toBe("2");
    expect(derniere?.url.searchParams.get("size")).toBe("20");
  });

  it("n'envoie aucun statut pour toutes les demandes", async () => {
    await fraisService.lister(null);
    expect(derniere?.url.searchParams.has("statut")).toBe(false);
  });

  it("lit le détail d'une demande", async () => {
    await fraisService.consulter(7);
    expect(derniere?.url.pathname).toBe("/api/v1/frais/demandes/7");
  });
});

describe("décisions du circuit", () => {
  it("conformité : un accord n'envoie pas de motif", async () => {
    await fraisService.controlerConformite(7, { accord: true });

    expect(derniere?.methode).toBe("PUT");
    expect(derniere?.url.pathname).toBe("/api/v1/frais/demandes/7/conformite");
    expect(derniere?.corps).toEqual({ conforme: true });
  });

  it("conformité : un rejet transmet son motif", async () => {
    await fraisService.controlerConformite(7, { accord: false, motifRejet: "Pièces incomplètes" });
    expect(derniere?.corps).toEqual({ conforme: false, motifRejet: "Pièces incomplètes" });
  });

  it("opportunité", async () => {
    await fraisService.controlerOpportunite(7, { accord: false, motifRejet: "Dépense injustifiée" });

    expect(derniere?.methode).toBe("PUT");
    expect(derniere?.url.pathname).toBe("/api/v1/frais/demandes/7/opportunite");
    expect(derniere?.corps).toEqual({ accord: false, motifRejet: "Dépense injustifiée" });
  });

  it("validation conjointe", async () => {
    await fraisService.validerConjointement(7, { accord: true });

    expect(derniere?.methode).toBe("POST");
    expect(derniere?.url.pathname).toBe("/api/v1/frais/demandes/7/validation-conjointe");
    expect(derniere?.corps).toEqual({ accord: true });
  });

  it("paiement, sans corps", async () => {
    await fraisService.enregistrerPaiement(7);

    expect(derniere?.methode).toBe("PATCH");
    expect(derniere?.url.pathname).toBe("/api/v1/frais/demandes/7/paiement");
    expect(derniere?.corps).toBeNull();
  });
});

describe("file propre à chaque profil", () => {
  const cles = (roles: string[]) => vuesFrais(roles).map((v) => v.cle);

  it("l'Assistante contrôle la conformité, puis paie", () => {
    expect(cles(["ROLE_ASSISTANTE", "ROLE_SAISIE", "ROLE_CONSULTATION"])).toEqual(["aControler", "aPayer", "toutes"]);
  });

  it("la DJA contrôle l'opportunité, puis vote conjointement — même avec ROLE_JURISTE (Q-81)", () => {
    expect(cles(["ROLE_JURISTE", "ROLE_DJA"])).toEqual(["opportunite", "conjointe", "toutes"]);
  });

  it("le DJ ne vote que conjointement", () => {
    expect(cles(["ROLE_JURISTE", "ROLE_DJ"])).toEqual(["conjointe", "toutes"]);
  });

  it("l'avocat voit toutes ses demandes", () => {
    expect(cles(["ROLE_AVOCAT"])).toEqual(["toutes"]);
  });

  it("chacun son accord conjoint, et un seul", () => {
    const demande = { validations: [{ etape: "CONJOINTE_DJA" }] } as unknown as DemandeFrais;

    expect(etapeConjointeDe(["ROLE_DJ", "ROLE_JURISTE"])).toBe("CONJOINTE_DJ");
    expect(aDonneSonAccord(demande, ["ROLE_DJA"])).toBe(true);
    expect(aDonneSonAccord(demande, ["ROLE_DJ"])).toBe(false);
    expect(aDonneSonAccord(demande, ["ROLE_ASSISTANTE"])).toBe(false);
  });
});
