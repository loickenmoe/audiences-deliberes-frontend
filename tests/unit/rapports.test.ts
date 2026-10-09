/**
 * @vitest-environment node
 *
 * Reporting (#49, #50) : ce qui part sur le fil, le traitement du **204** — une période sans
 * activité est un état vide, pas une erreur — et le calcul des bornes proposées par l'écran 40.
 */
import { HttpResponse, http } from "msw";
import { setupServer } from "msw/node";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";

import {
  EXTENSION_RAPPORT,
  nomFichierRapport,
  periodeParDefaut,
  periodeValide,
} from "@/lib/rapports";
import { reportingService } from "@/services/reportingService";

const BASE = "http://localhost:8080/api/v1";

let derniere: { methode: string; url: URL } | null = null;

/** Le backend répond 204 dès que la période demandée commence en 2000 — de quoi couvrir les deux cas. */
const RAPPORT = {
  type: "MENSUEL",
  dateDebut: "2026-08-14",
  dateFin: "2026-09-14",
  nbNouveauxDossiers: 3,
  nbAudiencesTenues: 1,
  nbDemandesFraisDeposees: 2,
  nbDeliberesEnregistres: 0,
  // Le taux est encore renvoyé par l'API ; l'écran et les exports portent les trois décomptes
  // depuis le 2026-10-06 - « le métier veut les chiffres, pas les pourcentages ».
  tauxSuccesRecouvrement: 0.5,
  nbLitigesGagnes: 2,
  nbLitigesPerdus: 1,
  nbLitigesMixtes: 1,
  provisionsReprises: 1_250_000,
};

/**
 * Deux lignes suffisent à poser ce qui compte dans le rapport nominatif (N6) : un délai mesurable,
 * et un délai **absent** parce que la personne n'a saisi aucun compte rendu. Zéro se lirait comme
 * une saisie le jour même, c'est-à-dire comme la meilleure performance possible.
 */
const NOMINATIF = {
  dateDebut: "2026-09-01",
  dateFin: "2026-09-30",
  lignes: [
    {
      utilisateurId: 7,
      nom: "Awa Ndiaye",
      profil: "JURISTE",
      dossiersOuverts: 4,
      audiencesPlanifiees: 6,
      comptesRendusSaisis: 5,
      deliberesEnregistres: 2,
      lettresRedigees: 3,
      fraisTraites: 1,
      delaiMoyenSaisieCompteRendu: 2.5,
    },
    {
      utilisateurId: 9,
      nom: null,
      profil: null,
      dossiersOuverts: 1,
      audiencesPlanifiees: 0,
      comptesRendusSaisis: 0,
      deliberesEnregistres: 0,
      lettresRedigees: 0,
      fraisTraites: 0,
      delaiMoyenSaisieCompteRendu: null,
    },
  ],
};

const serveur = setupServer(
  http.get(`${BASE}/tableau-de-bord`, ({ request }) => {
    derniere = { methode: request.method, url: new URL(request.url) };
    return HttpResponse.json({
      nbDossiersActifs: 12,
      nbAudiencesPlanifiees: 4,
      nbDemandesFraisEnAttente: 2,
      nbProrogationsAlerte: 1,
      tauxSuccesRecouvrement: 0.75,
      nbLitigesGagnes: 3,
      nbLitigesPerdus: 1,
      nbLitigesMixtes: 0,
      nbAffairesVidees: 5,
      provisionsReprises: 3_000_000,
    });
  }),
  http.get(`${BASE}/rapports/nominatif`, ({ request }) => {
    const url = new URL(request.url);
    derniere = { methode: request.method, url };
    if (url.searchParams.get("dateDebut")?.startsWith("2000")) {
      return new HttpResponse(null, { status: 204 });
    }
    return HttpResponse.json(NOMINATIF);
  }),
  http.get(`${BASE}/rapports`, ({ request }) => {
    const url = new URL(request.url);
    derniere = { methode: request.method, url };
    if (url.searchParams.get("dateDebut")?.startsWith("2000")) {
      return new HttpResponse(null, { status: 204 });
    }
    if (url.searchParams.get("format") !== "JSON") {
      return new HttpResponse("colonne;valeur", { status: 200, headers: { "Content-Type": "text/csv" } });
    }
    return HttpResponse.json(RAPPORT);
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

describe("tableau de bord", () => {
  it("se lit sans paramètre : les indicateurs portent sur tous les dossiers", async () => {
    const donnees = await reportingService.tableauDeBord();

    expect(derniere?.url.pathname).toBe("/api/v1/tableau-de-bord");
    expect(derniere?.url.search).toBe("");
    expect(donnees.nbDossiersActifs).toBe(12);
    /*
     * Le taux reste dans la réponse, mais ce ne sont plus lui que les écrans affichent : depuis le
     * 2026-10-06, le tableau de bord et le rapport portent les **nombres** qu'il résumait. Les
     * trois se lisent ensemble, et aucun ne se déduit des autres.
     */
    expect(donnees.nbLitigesGagnes).toBe(3);
    expect(donnees.nbLitigesPerdus).toBe(1);
    expect(donnees.nbLitigesMixtes).toBe(0);
    // Les affaires vidées complètent les dossiers actifs : 5 + 12 font les dossiers ouverts.
    expect(donnees.nbAffairesVidees).toBe(5);
  });
});

describe("rapport d'activité", () => {
  const periode = { type: "MENSUEL", dateDebut: "2026-08-14", dateFin: "2026-09-14" } as const;

  it("envoie le type, les bornes et le format JSON", async () => {
    await reportingService.genererRapport(periode);

    const params = derniere!.url.searchParams;
    expect(params.get("type")).toBe("MENSUEL");
    expect(params.get("dateDebut")).toBe("2026-08-14");
    expect(params.get("dateFin")).toBe("2026-09-14");
    expect(params.get("format")).toBe("JSON");
  });

  it("rend le rapport quand la période porte de l'activité", async () => {
    const rapport = await reportingService.genererRapport(periode);

    expect(rapport?.nbNouveauxDossiers).toBe(3);
  });

  /** RG-REP-02 : le 204 est un **état vide**, pas une erreur — il ne doit jamais remonter en exception. */
  it("rend null sur une période sans activité, sans lever d'erreur", async () => {
    const rapport = await reportingService.genererRapport({ ...periode, dateDebut: "2000-01-01", dateFin: "2000-01-02" });

    expect(rapport).toBeNull();
  });

  it("rend un contenu binaire pour les autres formats", async () => {
    const contenu = await reportingService.exporterRapport(periode, "CSV");

    expect(derniere?.url.searchParams.get("format")).toBe("CSV");
    expect(contenu).not.toBeNull();
    expect(await contenu!.text()).toContain("colonne");
  });

  /** Pas de fichier à télécharger pour une période vide : l'export doit le dire, pas produire un fichier creux. */
  it("rend null à l'export d'une période sans activité", async () => {
    const contenu = await reportingService.exporterRapport(
      { ...periode, dateDebut: "2000-01-01", dateFin: "2000-01-02" },
      "PDF",
    );

    expect(contenu).toBeNull();
  });
});

/**
 * L'activité par personne (observation 14, N6). Le service n'a qu'une responsabilité — poser les
 * deux bornes et traduire le 204 — mais c'est elle qui décide si l'écran affiche un état vide ou une
 * erreur, et une page de zéros laisserait croire que personne n'a rien fait.
 */
describe("rapport nominatif", () => {
  it("n'envoie que les deux bornes, sans étiquette de période", async () => {
    await reportingService.rapportNominatif("2026-09-01", "2026-09-30");

    expect(derniere?.url.pathname).toBe("/api/v1/rapports/nominatif");
    const params = derniere!.url.searchParams;
    expect(params.get("dateDebut")).toBe("2026-09-01");
    expect(params.get("dateFin")).toBe("2026-09-30");
    // Contrairement à `GET /rapports`, il n'y a ni `type` ni `format` : le rapport n'existe qu'à
    // l'écran, et son intervalle est libre.
    expect(params.get("type")).toBeNull();
    expect(params.get("format")).toBeNull();
  });

  it("rend les lignes telles quelles, dans l'ordre reçu du serveur", async () => {
    const rapport = await reportingService.rapportNominatif("2026-09-01", "2026-09-30");

    expect(rapport).not.toBeNull();
    const lignes = rapport!.lignes;
    expect(lignes).toHaveLength(2);
    expect(lignes[0]).toMatchObject({
      nom: "Awa Ndiaye",
      comptesRendusSaisis: 5,
      delaiMoyenSaisieCompteRendu: 2.5,
    });
    // Un compte retiré du référentiel laisse ses traces sans nom : l'écran les nomme « compte
    // retiré », il ne les masque pas.
    expect(lignes[1]).toMatchObject({ nom: null, delaiMoyenSaisieCompteRendu: null });
  });

  /** Même règle que le rapport périodique : le 204 est un **état vide**, jamais une exception. */
  it("rend null sur une période sans activité, sans lever d'erreur", async () => {
    const rapport = await reportingService.rapportNominatif("2000-01-01", "2000-01-02");

    expect(rapport).toBeNull();
  });
});

describe("bornes proposées par l'écran", () => {
  const fin = new Date(2026, 8, 14); // 14 septembre 2026, date locale

  it("propose des bornes cohérentes avec l'étiquette choisie", () => {
    expect(periodeParDefaut("JOURNALIER", fin)).toEqual({
      type: "JOURNALIER",
      dateDebut: "2026-09-14",
      dateFin: "2026-09-14",
    });
    // Sept jours au total, aujourd'hui compris.
    expect(periodeParDefaut("HEBDOMADAIRE", fin).dateDebut).toBe("2026-09-08");
    expect(periodeParDefaut("MENSUEL", fin).dateDebut).toBe("2026-08-14");
    expect(periodeParDefaut("TRIMESTRIEL", fin).dateDebut).toBe("2026-06-14");
    expect(periodeParDefaut("ANNUEL", fin).dateDebut).toBe("2025-09-14");
  });

  it("regarde toujours vers le passé : la période se termine aujourd'hui", () => {
    for (const type of ["JOURNALIER", "HEBDOMADAIRE", "MENSUEL", "TRIMESTRIEL", "ANNUEL"] as const) {
      expect(periodeParDefaut(type, fin).dateFin).toBe("2026-09-14");
    }
  });

  it("refuse une période inversée avant l'appel", () => {
    expect(periodeValide({ type: "MENSUEL", dateDebut: "2026-09-14", dateFin: "2026-08-14" })).toBe(false);
    expect(periodeValide({ type: "MENSUEL", dateDebut: "2026-08-14", dateFin: "2026-08-14" })).toBe(true);
    expect(periodeValide({ type: "MENSUEL", dateDebut: "", dateFin: "2026-08-14" })).toBe(false);
  });

  it("nomme le fichier par sa période, pas « rapport.pdf »", () => {
    expect(nomFichierRapport({ type: "MENSUEL", dateDebut: "2026-08-14", dateFin: "2026-09-14" }, "EXCEL")).toBe(
      "rapport-mensuel-2026-08-14_2026-09-14.xlsx",
    );
    expect(EXTENSION_RAPPORT).toEqual({ PDF: "pdf", EXCEL: "xlsx", CSV: "csv" });
  });
});
