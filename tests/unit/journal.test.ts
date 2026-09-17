/**
 * @vitest-environment node
 *
 * Journal des actions hors dossier (backend Q-110) : ce qui part sur le fil, et la garde de rôle.
 *
 * Le calcul n'est pas testé ici — il n'y en a pas. Ce qui compte est le **périmètre** : ce journal
 * ne doit jamais devenir une vue sur l'activité des juristes, et les filtres absents ne doivent pas
 * partir en paramètres vides, qui rendraient les URL illisibles et le cache inutile.
 */
import { HttpResponse, http, type JsonBodyType } from "msw";
import { setupServer } from "msw/node";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";

import { CAPACITES, peut } from "@/lib/rbac";
import { journalService } from "@/services/journalService";

const BASE = "http://localhost:8080/api/v1";

let derniere: { methode: string; url: URL } | null = null;

const JOURNAL = {
  content: [
    {
      id: 9,
      utilisateurId: 4,
      action: "Modification de la configuration SEUIL_PROROGATIONS",
      details: { ancienneValeur: "10", nouvelleValeur: "11" },
      dateAction: "2026-09-16T14:02:00",
    },
  ],
  totalPages: 1,
  totalElements: 1,
  actionsDisponibles: [
    "Indexation d'une jurisprudence",
    "Modification de la configuration SEUIL_MONTANT_DEFAUT",
    "Modification de la configuration SEUIL_PROROGATIONS",
  ],
};

const serveur = setupServer(
  http.get(`${BASE}/historique/systeme`, ({ request }) => {
    derniere = { methode: request.method, url: new URL(request.url) };
    return HttpResponse.json(JOURNAL as JsonBodyType);
  }),
);

beforeAll(() => {
  process.env.NEXT_PUBLIC_API_URL = BASE;
  // Le client valide toute la configuration au premier appel, canal temps réel compris.
  process.env.NEXT_PUBLIC_WS_URL = "http://localhost:8080/ws";
  serveur.listen({ onUnhandledRequest: "error" });
});
afterEach(() => {
  serveur.resetHandlers();
  derniere = null;
});
afterAll(() => serveur.close());

const JURISTE = ["ROLE_JURISTE", "ROLE_SAISIE", "ROLE_CONSULTATION"];
const DJ = ["ROLE_DJ", "ROLE_JURISTE", "ROLE_SAISIE", "ROLE_CONSULTATION"];
const DJA = ["ROLE_DJA", "ROLE_JURISTE", "ROLE_SAISIE", "ROLE_CONSULTATION"];
const ASSISTANTE = ["ROLE_ASSISTANTE", "ROLE_SAISIE", "ROLE_CONSULTATION"];
const SH = ["ROLE_SH", "ROLE_SAISIE", "ROLE_CONSULTATION"];

describe("journal des actions système sur le fil", () => {
  it("n'envoie que la pagination quand aucun filtre n'est posé", async () => {
    await journalService.systeme();

    expect(derniere?.methode).toBe("GET");
    expect(derniere?.url.pathname).toBe("/api/v1/historique/systeme");
    // Un filtre absent ne part pas en paramètre vide : le backend le lirait comme une valeur.
    expect(derniere?.url.searchParams.get("utilisateurId")).toBeNull();
    expect(derniere?.url.searchParams.get("action")).toBeNull();
    expect(derniere?.url.searchParams.get("dateDebut")).toBeNull();
    expect(derniere?.url.searchParams.get("page")).toBe("0");
  });

  it("transmet chaque filtre posé, période comprise", async () => {
    await journalService.systeme(
      { utilisateurId: 4, action: "Indexation d'une jurisprudence", dateDebut: "2026-09-01", dateFin: "2026-09-30" },
      2,
      25,
    );

    expect(derniere?.url.searchParams.get("utilisateurId")).toBe("4");
    expect(derniere?.url.searchParams.get("action")).toBe("Indexation d'une jurisprudence");
    expect(derniere?.url.searchParams.get("dateDebut")).toBe("2026-09-01");
    expect(derniere?.url.searchParams.get("dateFin")).toBe("2026-09-30");
    expect(derniere?.url.searchParams.get("page")).toBe("2");
    expect(derniere?.url.searchParams.get("size")).toBe("25");
  });

  it("rapporte les libellés disponibles, qui alimentent une liste fermée", async () => {
    const journal = await journalService.systeme();

    // La liste vient de la donnée, pas d'une énumération recopiée côté écran (QF-24).
    expect(journal.actionsDisponibles).toHaveLength(3);
    expect(journal.content[0]!.details).toEqual({ ancienneValeur: "10", nouvelleValeur: "11" });
  });
});

describe("garde du journal", () => {
  it("est ouvert au DJ et à la DJA, fermé aux autres profils internes", () => {
    expect(peut(DJ, "consulterJournalSysteme")).toBe(true);
    expect(peut(DJA, "consulterJournalSysteme")).toBe(true);
    for (const profil of [JURISTE, ASSISTANTE, SH]) {
      expect(peut(profil, "consulterJournalSysteme")).toBe(false);
    }
  });

  /**
   * L'historique d'un dossier reste ouvert à tout profil interne : on y regarde un dossier. Le
   * journal est agrégé et filtrable par auteur — même contenu, autre nature. Cette asymétrie est
   * délibérée et doit le rester tant que NF-CONF-01 (RGPD) n'est pas tranché.
   */
  it("est plus fermé que l'historique d'un dossier, délibérément", () => {
    expect(CAPACITES.consulterDocuments).toContain("ROLE_CONSULTATION");
    expect(CAPACITES.consulterJournalSysteme).not.toContain("ROLE_CONSULTATION");
  });
});
