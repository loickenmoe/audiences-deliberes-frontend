/**
 * @vitest-environment node
 *
 * Reporting (#49, #50): what goes over the wire, handling of **204** (a period without activity is
 * an empty state, not an error), and the date bounds offered by screen 40.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";

import { HttpResponse, http } from "msw";
import { setupServer } from "msw/node";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";

import {
  EXTENSION_RAPPORT,
  nomFichierActivite,
  nomFichierRapport,
  periodeParDefaut,
  periodeValide,
} from "@/lib/rapports";
import { reportingService } from "@/services/reportingService";

const BASE = "http://localhost:8080/api/v1";

let derniere: { methode: string; url: URL } | null = null;

/** The mock backend answers 204 when the requested period starts in 2000, to cover both cases. */
const RAPPORT = {
  type: "MENSUEL",
  dateDebut: "2026-08-14",
  dateFin: "2026-09-14",
  nbNouveauxDossiers: 3,
  nbAudiencesTenues: 1,
  nbDemandesFraisDeposees: 2,
  nbDeliberesEnregistres: 0,
  // The API still returns the rate, but the screen and exports show the three counts instead.
  tauxSuccesRecouvrement: 0.5,
  nbLitigesGagnes: 2,
  nbLitigesPerdus: 1,
  nbLitigesMixtes: 1,
  provisionsReprises: 1_250_000,
};

/**
 * Two rows cover what matters in the per-person report (N6): a measurable delay, and an **absent**
 * delay because the person entered no report. Zero would read as same-day entry, the best possible score.
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

/** An activity sheet: two completed action types and a measurable delay. */
const ACTIVITE = {
  utilisateurId: 7,
  nom: "Awa Ndiaye",
  profil: "JURISTE",
  dateDebut: "2026-09-01",
  dateFin: "2026-09-30",
  lignes: [
    { code: "AUDIENCE_PLANIFIEE", total: 9 },
    { code: "DOSSIER_CREE", total: 4 },
  ],
  delaiMoyenSaisieCompteRendu: 2.5,
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
  http.get(`${BASE}/rapports/activite/details`, ({ request }) => {
    derniere = { methode: request.method, url: new URL(request.url) };
    return HttpResponse.json({
      content: [
        {
          id: 11,
          code: "AUDIENCE_PLANIFIEE",
          action: "Planification d’une audience",
          dateAction: "2026-09-12T09:30:00",
          dossierId: 42,
          referenceDossier: "DOS-2026-0042",
        },
        {
          id: 12,
          code: "AUDIENCE_PLANIFIEE",
          action: "Planification d’une audience",
          dateAction: "2026-09-10T09:30:00",
          dossierId: null,
          referenceDossier: null,
        },
      ],
      totalPages: 1,
      totalElements: 2,
    });
  }),
  http.get(`${BASE}/rapports/activite/export`, ({ request }) => {
    derniere = { methode: request.method, url: new URL(request.url) };
    return new HttpResponse("Nature;Nombre", { status: 200, headers: { "Content-Type": "text/csv" } });
  }),
  http.get(`${BASE}/rapports/activite`, ({ request }) => {
    const url = new URL(request.url);
    derniere = { methode: request.method, url };
    if (url.searchParams.get("dateDebut")?.startsWith("2000")) {
      return new HttpResponse(null, { status: 204 });
    }
    return HttpResponse.json(ACTIVITE);
  }),
  http.get(`${BASE}/tableau-de-bord/details`, ({ request }) => {
    const url = new URL(request.url);
    derniere = { methode: request.method, url };
    return HttpResponse.json({
      content: [
        {
          id: 42,
          dossierId: 42,
          referenceDossier: "DOS-2026-0042",
          intitule: "SARL Mbarga",
          precision: "Recouvrement de créance",
          date: null,
          montant: 12_000_000,
        },
        {
          id: 43,
          dossierId: null,
          referenceDossier: null,
          intitule: "Seuil de charge dépassé",
          precision: null,
          date: null,
          montant: null,
        },
      ],
      totalPages: 3,
      totalElements: 47,
    });
  }),
  http.get(`${BASE}/rapports/nominatif/avocats`, ({ request }) => {
    const url = new URL(request.url);
    derniere = { methode: request.method, url };
    if (url.searchParams.get("dateDebut")?.startsWith("2000")) {
      return new HttpResponse(null, { status: 204 });
    }
    return HttpResponse.json({
      dateDebut: "2026-09-01",
      dateFin: "2026-09-30",
      lignes: [
        {
          utilisateurId: 21,
          avocatId: 5,
          nom: "Cabinet Fotso",
          comptesRendusDeposes: 6,
          demandesFraisDeposees: 3,
          autresPublicationsDeposees: 0,
          explicationsFournies: 1,
        },
        {
          utilisateurId: 30,
          avocatId: null,
          nom: "Me Ancien",
          comptesRendusDeposes: 2,
          demandesFraisDeposees: 0,
          autresPublicationsDeposees: 0,
          explicationsFournies: 0,
        },
      ],
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
     * The rate stays in the response, but the dashboard and report show the **counts** it summarized.
     * The three are read together, and none is derived from the others.
     */
    expect(donnees.nbLitigesGagnes).toBe(3);
    expect(donnees.nbLitigesPerdus).toBe(1);
    expect(donnees.nbLitigesMixtes).toBe(0);
    // Disposed cases complement active case files: 5 + 12 make the open case files.
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

  /** RG-REP-02: 204 is an **empty state**, not an error, and must never surface as an exception. */
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

  /** No file for an empty period: the export must say so, not produce an empty file. */
  it("rend null à l'export d'une période sans activité", async () => {
    const contenu = await reportingService.exporterRapport(
      { ...periode, dateDebut: "2000-01-01", dateFin: "2000-01-02" },
      "PDF",
    );

    expect(contenu).toBeNull();
  });
});

/**
 * Activity per person (N6). The service sets both bounds and translates 204, which decides whether
 * the screen shows an empty state or an error; a page of zeros would suggest nobody did anything.
 */
describe("rapport nominatif", () => {
  it("n'envoie que les deux bornes, sans étiquette de période", async () => {
    await reportingService.rapportNominatif("2026-09-01", "2026-09-30");

    expect(derniere?.url.pathname).toBe("/api/v1/rapports/nominatif");
    const params = derniere!.url.searchParams;
    expect(params.get("dateDebut")).toBe("2026-09-01");
    expect(params.get("dateFin")).toBe("2026-09-30");
    // Unlike `GET /rapports`, there is no `type` or `format`: the report exists only on screen, and
    // its range is free.
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
    // An account removed from the directory leaves unnamed records: the screen labels them as
    // removed accounts rather than hiding them.
    expect(lignes[1]).toMatchObject({ nom: null, delaiMoyenSaisieCompteRendu: null });
  });

  /** Same rule as the periodic report: 204 is an **empty state**, never an exception. */
  it("rend null sur une période sans activité, sans lever d'erreur", async () => {
    const rapport = await reportingService.rapportNominatif("2000-01-01", "2000-01-02");

    expect(rapport).toBeNull();
  });
});

/**
 * Dashboard block detail. The service must request the right indicator and return the **server
 * total**, never a sum of the rows shown, which would contradict the source block from page two on.
 */
/**
 * Category scope. "Absent" really means both categories, so **nothing** is sent and the server
 * decides; the detail receives the same scope as its source block.
 */
describe("périmètre de catégories", () => {
  it("n'envoie aucune catégorie pour « toutes catégories »", async () => {
    await reportingService.tableauDeBord();

    expect(derniere?.url.pathname).toBe("/api/v1/tableau-de-bord");
    expect(derniere!.url.searchParams.has("categorie")).toBe(false);
  });

  it("transmet la catégorie choisie au tableau de bord", async () => {
    await reportingService.tableauDeBord("EXPLOITATION_LITIGES");

    expect(derniere!.url.searchParams.get("categorie")).toBe("EXPLOITATION_LITIGES");
  });

  it("transmet le même périmètre au détail d'un bloc", async () => {
    await reportingService.detailTableauDeBord("LITIGES_GAGNES", 0, "RECOUVREMENT");

    const params = derniere!.url.searchParams;
    expect(params.get("indicateur")).toBe("LITIGES_GAGNES");
    expect(params.get("categorie")).toBe("RECOUVREMENT");
  });

  it("transmet le périmètre au rapport périodique et à ses exports", async () => {
    const periode = {
      type: "MENSUEL",
      dateDebut: "2026-08-14",
      dateFin: "2026-09-14",
      categorie: "RECOUVREMENT",
    } as const;

    await reportingService.genererRapport(periode);
    expect(derniere!.url.searchParams.get("categorie")).toBe("RECOUVREMENT");

    await reportingService.exporterRapport(periode, "CSV");
    expect(derniere!.url.searchParams.get("categorie")).toBe("RECOUVREMENT");
  });
});

/**
 * The file name carries the scope, only when there is one: a debt recovery report and an
 * all-categories report have different figures for the same period and must not share a name.
 */
describe("nom du rapport exporté selon le périmètre", () => {
  it("ne nomme pas le périmètre quand il n'y en a pas", () => {
    expect(
      nomFichierRapport({ type: "MENSUEL", dateDebut: "2026-08-14", dateFin: "2026-09-14" }, "PDF"),
    ).toBe("rapport-mensuel-2026-08-14_2026-09-14.pdf");
  });

  it("nomme le périmètre quand une catégorie est choisie", () => {
    expect(
      nomFichierRapport(
        {
          type: "MENSUEL",
          dateDebut: "2026-08-14",
          dateFin: "2026-09-14",
          categorie: "EXPLOITATION_LITIGES",
        },
        "EXCEL",
      ),
    ).toBe("rapport-mensuel-exploitation_litiges-2026-08-14_2026-09-14.xlsx");
  });
});

describe("détail d'un bloc du tableau de bord", () => {
  it("envoie l'indicateur demandé et la page", async () => {
    await reportingService.detailTableauDeBord("DOSSIERS_ACTIFS", 2);

    expect(derniere?.url.pathname).toBe("/api/v1/tableau-de-bord/details");
    const params = derniere!.url.searchParams;
    expect(params.get("indicateur")).toBe("DOSSIERS_ACTIFS");
    expect(params.get("page")).toBe("2");
    expect(params.get("size")).toBe("20");
  });

  it("rend le total du serveur, et non le nombre de lignes de la page", async () => {
    const page = await reportingService.detailTableauDeBord("DOSSIERS_ACTIFS", 0);

    expect(page.content).toHaveLength(2);
    // 47 items over 3 pages: the total must be displayed, not the 2 rows received.
    expect(page.totalElements).toBe(47);
    expect(page.totalPages).toBe(3);
  });

  it("rend une ligne hors dossier telle quelle, sans l'écarter", async () => {
    const page = await reportingService.detailTableauDeBord("PROROGATIONS_ALERTE", 0);

    /*
     * An alert without a case file stays in the list: dropping it would make the row count differ
     * from the number shown by the block.
     */
    expect(page.content[1]).toMatchObject({ dossierId: null, referenceDossier: null });
  });
});

/**
 * Lawyers table: it exists **separately** from the internal table, and a removed directory entry
 * does not erase its submissions.
 */
describe("activité des avocats", () => {
  it("se lit sur son propre chemin, distinct du tableau interne", async () => {
    await reportingService.rapportAvocats("2026-09-01", "2026-09-30");

    expect(derniere?.url.pathname).toBe("/api/v1/rapports/nominatif/avocats");
  });

  it("rend les dépôts de chaque avocat", async () => {
    const rapport = await reportingService.rapportAvocats("2026-09-01", "2026-09-30");

    expect(rapport?.lignes).toHaveLength(2);
    expect(rapport?.lignes[0]).toMatchObject({
      nom: "Cabinet Fotso",
      avocatId: 5,
      comptesRendusDeposes: 6,
      explicationsFournies: 1,
    });
    /*
     * A removed directory entry keeps its submissions: `avocatId` is null and the screen opens the
     * sheet through the account. Hiding them would drop real activity.
     */
    expect(rapport?.lignes[1]).toMatchObject({ avocatId: null, comptesRendusDeposes: 2 });
  });

  it("rend null sur une période sans dépôt", async () => {
    expect(await reportingService.rapportAvocats("2000-01-01", "2000-01-02")).toBeNull();
  });
});

/**
 * Activity sheet. "Me" carries no identifier, 204 stays an empty state, and the downloaded file name
 * matches the one the server builds.
 */
describe("fiche d'activité", () => {
  it("n'envoie aucun identifiant pour sa propre activité", async () => {
    await reportingService.rapportActivite("2026-09-01", "2026-09-30");

    expect(derniere?.url.pathname).toBe("/api/v1/rapports/activite");
    // The server knows who the user is: sending an id from the screen would invite sending someone
    // else's.
    expect(derniere!.url.searchParams.has("utilisateurId")).toBe(false);
  });

  it("transmet l'identifiant quand la direction regarde un collègue", async () => {
    await reportingService.rapportActivite("2026-09-01", "2026-09-30", { utilisateurId: 9 });

    expect(derniere!.url.searchParams.get("utilisateurId")).toBe("9");
  });

  /**
   * A lawyer is identified by their **directory entry**, not by an account: the user id is not part
   * of it.
   */
  it("désigne un avocat par son inscription, et non par un compte", async () => {
    await reportingService.rapportActivite("2026-09-01", "2026-09-30", { avocatId: 5 });

    const params = derniere!.url.searchParams;
    expect(params.get("avocatId")).toBe("5");
    // Never both: the server rejects them together, and the screen must not offer them.
    expect(params.has("utilisateurId")).toBe(false);
  });

  it("transmet l'inscription à l'export et au détail, comme à la fiche", async () => {
    await reportingService.exporterActivite("2026-09-01", "2026-09-30", "PDF", { avocatId: 5 });
    expect(derniere!.url.searchParams.get("avocatId")).toBe("5");

    await reportingService.detailsActivite("PUBLICATION_CR_DEPOSE", "2026-09-01", "2026-09-30", 0, {
      avocatId: 5,
    });
    expect(derniere!.url.searchParams.get("avocatId")).toBe("5");
  });

  it("rend les natures accomplies, et elles seules", async () => {
    const fiche = await reportingService.rapportActivite("2026-09-01", "2026-09-30");

    expect(fiche?.lignes).toHaveLength(2);
    expect(fiche?.lignes[0]).toEqual({ code: "AUDIENCE_PLANIFIEE", total: 9 });
    expect(fiche?.delaiMoyenSaisieCompteRendu).toBe(2.5);
  });

  it("rend null sur une période sans activité", async () => {
    expect(await reportingService.rapportActivite("2000-01-01", "2000-01-02")).toBeNull();
  });

  it("exporte dans le format demandé", async () => {
    const contenu = await reportingService.exporterActivite("2026-09-01", "2026-09-30", "CSV");

    expect(derniere?.url.searchParams.get("format")).toBe("CSV");
    expect(await contenu!.text()).toContain("Nature");
  });

  it("détaille un décompte, page par page", async () => {
    const page = await reportingService.detailsActivite(
      "AUDIENCE_PLANIFIEE",
      "2026-09-01",
      "2026-09-30",
      0,
    );

    const params = derniere!.url.searchParams;
    expect(params.get("code")).toBe("AUDIENCE_PLANIFIEE");
    expect(params.get("page")).toBe("0");
    expect(params.get("size")).toBe("20");
    expect(page.content).toHaveLength(2);
    expect(page.content[0]?.referenceDossier).toBe("DOS-2026-0042");
    // An action outside any case file stays in the list: hiding it would drop real activity and
    // break the match between count and rows.
    expect(page.content[1]?.dossierId).toBeNull();
  });
});

/**
 * The file name is built **twice**: by the server in `Content-Disposition` (not exposed by CORS),
 * and by the screen to name the download. These assertions are where both rules are compared.
 */
describe("nom de la fiche d'activité téléchargée", () => {
  it("porte la personne, la période et l'extension du format", () => {
    expect(
      nomFichierActivite({ nom: "Awa Ndiaye", utilisateurId: 7 }, "2026-09-01", "2026-09-30", "EXCEL"),
    ).toBe("activite-awa-ndiaye-2026-09-01_2026-09-30.xlsx");
  });

  /** Without Unicode decomposition, "Hervé" would become "herv-": the accent is not in [a-z0-9]. */
  it("retire les accents avant de passer en minuscules", () => {
    expect(
      nomFichierActivite({ nom: "Hervé Épée", utilisateurId: 3 }, "2026-01-01", "2026-01-31", "PDF"),
    ).toBe("activite-herve-epee-2026-01-01_2026-01-31.pdf");
  });

  /** An account removed from the directory has no name: the file then carries its id. */
  it("se rabat sur l'identifiant quand le nom manque", () => {
    expect(nomFichierActivite({ nom: null, utilisateurId: 9 }, "2026-01-01", "2026-01-31", "CSV")).toBe(
      "activite-9-2026-01-01_2026-01-31.csv",
    );
  });
});

/**
 * Clicking an action opens the case file **on the matching tab**, which must exist: an unknown tab
 * silently falls back to the summary. Both lists are read **from the code that declares them**, not
 * copied here, so they cannot drift.
 */
describe("onglets vises par la fiche d'activité", () => {
  function sourceDe(chemin: string): string {
    return readFileSync(join(process.cwd(), chemin), "utf8");
  }

  it("ne nomme que des onglets réellement déclarés par la fiche dossier", () => {
    const declaration = sourceDe("components/modules/dossiers/fiche-dossier.tsx");
    const bloc = declaration.slice(
      declaration.indexOf("const ONGLETS = ["),
      declaration.indexOf("] as const;"),
    );
    const reels = new Set([...bloc.matchAll(/"([a-z]+)"/g)].map((trouve) => trouve[1]));
    // If the declaration changed shape, extraction would return an empty set and this test would
    // pass vacuously. The lower bound guards against that.
    expect(reels.size, "les onglets de la fiche dossier ne se lisent plus").toBeGreaterThan(5);

    /*
     * **Both maps**: the second one serves dashboard block details.
     */
    const cartes = [
      "components/modules/reporting/fiche-activite.tsx",
      "components/modules/reporting/detail-indicateur.tsx",
    ].map(sourceDe);
    const vises = cartes.flatMap((carte) =>
      [...carte.matchAll(/^ {2}[A-Z_]+: "([a-z]+)",$/gm)].map((trouve) => trouve[1]),
    );
    expect(vises.length, "les cartes des onglets ne se lisent plus").toBeGreaterThan(25);

    const inconnus = [...new Set(vises)].filter((onglet) => !reels.has(onglet));
    expect(inconnus, "onglets visés qui n'existent pas sur la fiche dossier").toEqual([]);
  });
});

describe("bornes proposées par l'écran", () => {
  const fin = new Date(2026, 8, 14); // 14 September 2026, local date

  it("propose des bornes cohérentes avec l'étiquette choisie", () => {
    expect(periodeParDefaut("JOURNALIER", fin)).toEqual({
      type: "JOURNALIER",
      dateDebut: "2026-09-14",
      dateFin: "2026-09-14",
    });
    // Seven days in total, today included.
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
