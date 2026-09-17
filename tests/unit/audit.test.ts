/**
 * @vitest-environment node
 *
 * Audit des actions historisées (backend Q-112) : ce qui part sur le fil, et la garde de rôle.
 *
 * Ce qui compte ici n'est pas le filtrage — le backend s'en charge — mais **ce qu'on lui demande**.
 * Un filtre absent ne doit pas partir en paramètre vide, et la portée doit toujours être explicite :
 * une requête sans portée laisserait le serveur choisir, ce qui n'est pas à lui d'en décider.
 */
import { HttpResponse, http, type JsonBodyType } from "msw";
import { setupServer } from "msw/node";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";

import { CAPACITES, peut } from "@/lib/rbac";
import { auditService } from "@/services/auditService";

const BASE = "http://localhost:8080/api/v1";

let derniere: { methode: string; url: URL } | null = null;

const PAGE = {
  content: [
    {
      id: 9,
      utilisateurId: 4,
      code: "CONFIGURATION_MODIFIEE",
      action: "Modification de la configuration",
      details: { cle: "SEUIL_PROROGATIONS", ancienneValeur: "10", nouvelleValeur: "11" },
      dateAction: "2026-09-17T14:02:00",
    },
  ],
  totalPages: 1,
  totalElements: 1,
  actionsDisponibles: [
    { code: "CONFIGURATION_MODIFIEE", libelle: "Modification de la configuration" },
    { code: "DOSSIER_CREE", libelle: "Création du dossier" },
  ],
};

const serveur = setupServer(
  http.get(`${BASE}/historique`, ({ request }) => {
    derniere = { methode: request.method, url: new URL(request.url) };
    return HttpResponse.json(PAGE as JsonBodyType);
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

const JURISTE = ["ROLE_JURISTE", "ROLE_SAISIE", "ROLE_CONSULTATION"];
const DJ = ["ROLE_DJ", "ROLE_JURISTE", "ROLE_SAISIE", "ROLE_CONSULTATION"];
const DJA = ["ROLE_DJA", "ROLE_JURISTE", "ROLE_SAISIE", "ROLE_CONSULTATION"];
const ASSISTANTE = ["ROLE_ASSISTANTE", "ROLE_SAISIE", "ROLE_CONSULTATION"];
const SH = ["ROLE_SH", "ROLE_SAISIE", "ROLE_CONSULTATION"];

describe("consultation de l'audit sur le fil", () => {
  it("envoie toujours une portée explicite, même sans filtre", async () => {
    await auditService.consulter();

    expect(derniere?.methode).toBe("GET");
    expect(derniere?.url.pathname).toBe("/api/v1/historique");
    // La portée n'est jamais laissée au serveur : c'est une décision de l'écran, pas un défaut.
    expect(derniere?.url.searchParams.get("perimetre")).toBe("TOUT");
    expect(derniere?.url.searchParams.get("utilisateurId")).toBeNull();
    expect(derniere?.url.searchParams.get("code")).toBeNull();
    expect(derniere?.url.searchParams.get("dossierId")).toBeNull();
  });

  it("transmet chaque critère posé", async () => {
    await auditService.consulter(
      {
        perimetre: "UN_DOSSIER",
        dossierId: 77,
        utilisateurId: 4,
        code: "DOCUMENT_CHARGE",
        dateDebut: "2026-09-01",
        dateFin: "2026-09-30",
      },
      2,
      25,
    );

    expect(derniere?.url.searchParams.get("perimetre")).toBe("UN_DOSSIER");
    expect(derniere?.url.searchParams.get("dossierId")).toBe("77");
    expect(derniere?.url.searchParams.get("utilisateurId")).toBe("4");
    expect(derniere?.url.searchParams.get("code")).toBe("DOCUMENT_CHARGE");
    expect(derniere?.url.searchParams.get("dateDebut")).toBe("2026-09-01");
    expect(derniere?.url.searchParams.get("page")).toBe("2");
    expect(derniere?.url.searchParams.get("size")).toBe("25");
  });

  it("rapporte les natures disponibles en code et libellé", async () => {
    const audit = await auditService.consulter();

    // Le code part au serveur, le libellé s'affiche. La liste vient de la donnée, jamais d'une
    // énumération recopiée côté écran : elle ne propose pas un choix qui ne renverrait rien.
    expect(audit.actionsDisponibles[0]).toEqual({
      code: "CONFIGURATION_MODIFIEE",
      libelle: "Modification de la configuration",
    });
    expect(audit.content[0]!.details).toMatchObject({ cle: "SEUIL_PROROGATIONS" });
  });
});

describe("garde de l'audit", () => {
  it("est ouvert au DJ et à la DJA, fermé aux autres profils internes", () => {
    expect(peut(DJ, "consulterAudit")).toBe(true);
    expect(peut(DJA, "consulterAudit")).toBe(true);
    for (const profil of [JURISTE, ASSISTANTE, SH]) {
      expect(peut(profil, "consulterAudit")).toBe(false);
    }
  });

  /**
   * L'historique d'un dossier reste ouvert à tout profil interne : on y regarde un dossier. L'audit
   * est agrégé et filtrable par auteur — même contenu, autre nature. Cette asymétrie est délibérée.
   */
  it("est plus fermé que l'historique d'un dossier, délibérément", () => {
    expect(CAPACITES.consulterDocuments).toContain("ROLE_CONSULTATION");
    expect(CAPACITES.consulterAudit).not.toContain("ROLE_CONSULTATION");
  });

  /**
   * Capacité **distincte** de l'administration des paramètres et de la supervision des alertes,
   * bien qu'elle porte les mêmes rôles : lire l'activité nommée d'un collègue n'est ni écrire un
   * seuil ni lire un taux global. Les confondre ferait qu'un assouplissement de l'une déplacerait
   * l'autre — et ici, ce serait un assouplissement sur des données personnelles.
   */
  it("ne se confond avec aucune autre capacité d'administration", () => {
    expect(CAPACITES.consulterAudit).not.toBe(CAPACITES.administrerConfigurations);
    expect(CAPACITES.consulterAudit).not.toBe(CAPACITES.superviserAlertes);
  });
});
