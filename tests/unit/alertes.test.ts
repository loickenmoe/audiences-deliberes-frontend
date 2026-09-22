/**
 * @vitest-environment node
 *
 * Alertes (#44, #45, #46) et paramètres système (#47, #48) : ce qui part sur le fil, la règle de
 * saisie reprise du contrat, et la cadence du repli HTTP quand le canal temps réel est coupé.
 */
import { HttpResponse, http, type JsonBodyType } from "msw";
import { setupServer } from "msw/node";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";

import {
  CADENCE_CANAL_OUVERT,
  CADENCE_REPLI,
  cadenceRafraichissement,
} from "@/hooks/useAlertes";
import {
  basculerElement,
  nettoyerDeclencheur,
  verifierValeurConfiguration,
  VUES_NOTIFICATIONS,
} from "@/lib/alertes";
import { lireAlerte, DESTINATION_ALERTES } from "@/lib/temps-reel";
import { alerteService } from "@/services/alerteService";
import { configurationService } from "@/services/configurationService";
import type { ConfigurationSysteme } from "@/types/domaine";

const BASE = "http://localhost:8080/api/v1";

let derniere: { methode: string; url: URL; corps: unknown } | null = null;

async function capturer(request: Request, reponse: JsonBodyType = {}) {
  const texte = await request.text();
  derniere = {
    methode: request.method,
    url: new URL(request.url),
    corps: texte ? JSON.parse(texte) : null,
  };
  return HttpResponse.json(reponse);
}

const PAGE_VIDE = { content: [], totalPages: 0, totalElements: 0 };

const serveur = setupServer(
  http.get(`${BASE}/alertes/mes-notifications`, ({ request }) => capturer(request, PAGE_VIDE)),
  http.patch(`${BASE}/alertes/:id/traiter`, ({ request }) => capturer(request, { id: 9 })),
  http.put(`${BASE}/alertes/seuils`, ({ request }) => capturer(request, { cle: "CHARGE_MAX_AVOCAT" })),
  http.get(`${BASE}/alertes/statistiques-diffusion`, ({ request }) =>
    capturer(request, {
      dateDebut: "2026-09-01",
      dateFin: "2026-09-30",
      observees: 1000,
      diffusees: 700,
      differees: 295,
      echecs: 5,
      nonTraitees: 42,
      tauxDelivrance: 99.5,
      tauxDiffusionTempsReel: 70,
      seuilRespecte: true,
    }),
  ),
  http.get(`${BASE}/configurations`, ({ request }) => capturer(request, [])),
  http.put(`${BASE}/configurations/:cle`, ({ request }) => capturer(request, { cle: "FORMATS_GED", valeur: "PDF,XLSX" })),
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

/** Fabrique une configuration telle que le backend la publie (règle de saisie comprise). */
function config(partiel: Partial<ConfigurationSysteme>): ConfigurationSysteme {
  return {
    cle: "SEUIL_PROROGATIONS",
    valeur: "10",
    description: null,
    modifiablePar: "ROLE_DJ",
    dateModification: null,
    dernierAuteurId: null,
    typeValeur: "ENTIER",
    valeurMinimale: 1,
    valeurMaximale: 1000,
    valeursPossibles: [],
    listeVideAutorisee: false,
    ...partiel,
  };
}

describe("mes notifications", () => {
  it("omet le statut quand les deux sont demandés", async () => {
    await alerteService.mesNotifications(null, 2, 50);

    expect(derniere?.url.searchParams.get("statut")).toBeNull();
    expect(derniere?.url.searchParams.get("page")).toBe("2");
    expect(derniere?.url.searchParams.get("size")).toBe("50");
  });

  it("filtre sur les non lues quand le statut est donné", async () => {
    await alerteService.mesNotifications("DECLENCHEE");

    expect(derniere?.url.searchParams.get("statut")).toBe("DECLENCHEE");
  });

  it("marque une notification traitée sans corps", async () => {
    await alerteService.traiter(9);

    expect(derniere?.methode).toBe("PATCH");
    expect(derniere?.url.pathname).toBe("/api/v1/alertes/9/traiter");
  });

  it("envoie le type et le seuil sur la modification de seuil", async () => {
    await alerteService.modifierSeuil("CHARGE_MAX_AVOCAT", 25);

    expect(derniere?.methode).toBe("PUT");
    expect(derniere?.corps).toEqual({ type: "CHARGE_MAX_AVOCAT", seuil: 25 });
  });

  it("associe chaque vue au statut que le backend attend", () => {
    expect(VUES_NOTIFICATIONS).toEqual({ aTraiter: "DECLENCHEE", traitees: "TRAITEE", toutes: null });
  });
});

describe("affichage d'un déclencheur", () => {
  it("retire le marqueur anti-doublon du backend", () => {
    expect(nettoyerDeclencheur("[delibereId:12] Seuil de prorogations dépassé (11).")).toBe(
      "Seuil de prorogations dépassé (11).",
    );
    expect(nettoyerDeclencheur("[audienceId:5;J-7] Audience dans 7 jours.")).toBe(
      "Audience dans 7 jours.",
    );
  });

  it("laisse intact un texte sans marqueur", () => {
    expect(nettoyerDeclencheur("Nouvelle demande de frais.")).toBe("Nouvelle demande de frais.");
  });
});

describe("canal temps réel", () => {
  it("écoute la destination personnelle résolue par le courtier", () => {
    expect(DESTINATION_ALERTES).toBe("/user/queue/alertes");
  });

  it("lit une alerte poussée", () => {
    const alerte = lireAlerte(JSON.stringify({ id: 4, statut: "DECLENCHEE", declencheur: "x" }));

    expect(alerte?.id).toBe(4);
  });

  it("ignore une charge illisible plutôt que de rompre l'abonnement", () => {
    expect(lireAlerte("ce n'est pas du JSON")).toBeNull();
    expect(lireAlerte("null")).toBeNull();
    expect(lireAlerte(JSON.stringify({ sansIdentifiant: true }))).toBeNull();
  });

  it("resserre le repli HTTP quand le canal est coupé", () => {
    expect(cadenceRafraichissement(true)).toBe(CADENCE_CANAL_OUVERT);
    expect(cadenceRafraichissement(false)).toBe(CADENCE_REPLI);
    expect(CADENCE_REPLI).toBeLessThan(CADENCE_CANAL_OUVERT);
  });
});

describe("saisie d'un paramètre système", () => {
  it("accepte un entier dans les bornes publiées", () => {
    expect(verifierValeurConfiguration(config({}), "12")).toBeNull();
  });

  it("refuse ce que le backend refuserait", () => {
    expect(verifierValeurConfiguration(config({}), "")).toBe("obligatoire");
    expect(verifierValeurConfiguration(config({}), "50 000")).toBe("entier");
    expect(verifierValeurConfiguration(config({}), "1,5")).toBe("entier");
    expect(verifierValeurConfiguration(config({}), "0")).toBe("bornes");
    expect(verifierValeurConfiguration(config({}), "5000")).toBe("bornes");
  });

  const liste = config({
    cle: "FORMATS_GED",
    valeur: "PDF,PNG",
    typeValeur: "LISTE",
    valeurMinimale: null,
    valeurMaximale: null,
    valeursPossibles: ["PDF", "PNG", "JPG", "TXT", "XLSX"],
  });

  it("accepte une liste de valeurs connues, insensible à la casse et aux espaces", () => {
    expect(verifierValeurConfiguration(liste, " pdf , xlsx ")).toBeNull();
  });

  it("refuse une valeur hors de l'ensemble publié et un élément vide", () => {
    expect(verifierValeurConfiguration(liste, "PDF,DOCX")).toBe("inconnue");
    expect(verifierValeurConfiguration(liste, "PDF,,PNG")).toBe("vide");
  });

  it("n'invente aucune règle pour une clé qui n'en publie pas", () => {
    const sansRegle = config({ typeValeur: null, valeurMinimale: null, valeurMaximale: null });

    expect(verifierValeurConfiguration(sansRegle, "n'importe quoi")).toBeNull();
    expect(verifierValeurConfiguration(sansRegle, "  ")).toBe("obligatoire");
  });

  it("accepte une liste vide seulement quand le contrat l'autorise (Q-118)", () => {
    expect(verifierValeurConfiguration(liste, "")).toBe("obligatoire");
    expect(verifierValeurConfiguration({ ...liste, cle: "GRILLE_NOTIFICATION_SMS", listeVideAutorisee: true }, "  ")).toBeNull();
  });

  it("bascule un élément en conservant l'ordre des valeurs acceptées", () => {
    expect(basculerElement("PDF,PNG", "XLSX", liste.valeursPossibles)).toBe("PDF,PNG,XLSX");
    expect(basculerElement("PDF,PNG", "PDF", liste.valeursPossibles)).toBe("PNG");
    expect(basculerElement("xlsx , pdf", "PNG", liste.valeursPossibles)).toBe("PDF,PNG,XLSX");
  });
});

describe("paramètres système sur le fil", () => {
  it("se lisent sans pagination", async () => {
    await configurationService.lister();

    expect(derniere?.methode).toBe("GET");
    expect(derniere?.url.pathname).toBe("/api/v1/configurations");
    expect(derniere?.url.search).toBe("");
  });

  it("se modifient clé par clé", async () => {
    const mise = await configurationService.modifier("FORMATS_GED", "PDF,XLSX");

    expect(derniere?.methode).toBe("PUT");
    expect(derniere?.url.pathname).toBe("/api/v1/configurations/FORMATS_GED");
    expect(derniere?.corps).toEqual({ valeur: "PDF,XLSX" });
    // La réponse du backend fait foi : c'est elle qui porte la valeur normalisée.
    expect(mise.valeur).toBe("PDF,XLSX");
  });
});

/**
 * Supervision du canal applicatif (backend Q-109, NF-ALR-02).
 *
 * Ce qui est vérifié ici n'est pas le calcul — il appartient au backend, qui le teste — mais **ce
 * qui part sur le fil** et la lecture des deux taux. Les confondre serait l'erreur la plus facile à
 * commettre, et la plus coûteuse : l'un est opposable, l'autre non.
 */
describe("supervision des alertes", () => {
  it("envoie la fenêtre demandée, bornes comprises", async () => {
    await alerteService.statistiquesDiffusion("2026-09-01", "2026-09-30");

    expect(derniere?.methode).toBe("GET");
    expect(derniere?.url.pathname).toBe("/api/v1/alertes/statistiques-diffusion");
    expect(derniere?.url.searchParams.get("dateDebut")).toBe("2026-09-01");
    expect(derniere?.url.searchParams.get("dateFin")).toBe("2026-09-30");
  });

  it("distingue le taux opposable du taux d'usage", async () => {
    const stats = await alerteService.statistiquesDiffusion("2026-09-01", "2026-09-30");

    // 995 alertes sur 1000 remises : les différées comptent comme délivrées, seuls les 5 échecs
    // pèsent. C'est ce taux que NF-ALR-02 borne à 99 %.
    expect(stats.tauxDelivrance).toBe(99.5);
    expect(stats.seuilRespecte).toBe(true);
    // Tout autre chose : 700 destinataires sur 1000 étaient connectés. Aucun seuil ne s'y oppose,
    // et un chiffre bas ici ne dit rien d'une panne.
    expect(stats.tauxDiffusionTempsReel).toBe(70);
    expect(stats.tauxDiffusionTempsReel).not.toBe(stats.tauxDelivrance);
  });

  it("rapporte les non traitées sans les mêler aux taux", async () => {
    const stats = await alerteService.statistiquesDiffusion("2026-09-01", "2026-09-30");

    // Une alerte délivrée que personne n'a ouverte relève d'un autre problème que la délivrance :
    // le compte existe, il n'entre dans aucun quotient.
    expect(stats.nonTraitees).toBe(42);
    expect(stats.diffusees + stats.differees + stats.echecs).toBe(stats.observees);
  });
});
