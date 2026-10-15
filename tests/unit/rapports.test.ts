/**
 * @vitest-environment node
 *
 * Reporting (#49, #50) : ce qui part sur le fil, le traitement du **204** — une période sans
 * activité est un état vide, pas une erreur — et le calcul des bornes proposées par l'écran 40.
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

/** Une fiche d'activité : deux natures accomplies, et un délai mesurable. */
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

/**
 * Le détail d'un bloc du tableau de bord (Q-137). Ce que le service doit garantir : qu'il demande le
 * bon indicateur, et qu'il rende le **total du serveur** - jamais une somme des lignes montrées, qui
 * contredirait le bloc d'où l'on vient dès la deuxième page.
 */
/**
 * Le périmètre de catégories (Q-138). Ce que le service doit garantir : qu'« absent » signifie
 * vraiment les deux catégories - c'est-à-dire qu'il n'envoie **rien**, et laisse le serveur décider -
 * et que le détail reçoive le même périmètre que le bloc d'où l'on vient.
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
 * Le nom du fichier porte le périmètre, et seulement quand il en est un : un rapport de
 * recouvrement et un rapport toutes catégories portent des chiffres différents sur la même période,
 * et deux fichiers nommés pareil se confondraient dans un dossier.
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
    // 47 éléments sur 3 pages : c'est le total qui doit s'afficher, pas les 2 lignes reçues.
    expect(page.totalElements).toBe(47);
    expect(page.totalPages).toBe(3);
  });

  it("rend une ligne hors dossier telle quelle, sans l'écarter", async () => {
    const page = await reportingService.detailTableauDeBord("PROROGATIONS_ALERTE", 0);

    /*
     * Une alerte sans dossier reste dans la liste : l'écarter ferait que le nombre de lignes ne
     * tombe plus sur le nombre affiché par le bloc, et c'est cette concordance qui fait la
     * crédibilité des deux chiffres.
     */
    expect(page.content[1]).toMatchObject({ dossierId: null, referenceDossier: null });
  });
});

/**
 * Le tableau des avocats (Q-136). Ce qu'il doit garantir : qu'il existe **à part** du tableau
 * interne, et qu'une inscription retirée n'efface pas les dépôts.
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
     * Une inscription retirée du répertoire laisse ses dépôts : `avocatId` est nul, et l'écran
     * ouvre alors la fiche par le compte. Les masquer ferait disparaître de l'activité réelle.
     */
    expect(rapport?.lignes[1]).toMatchObject({ avocatId: null, comptesRendusDeposes: 2 });
  });

  it("rend null sur une période sans dépôt", async () => {
    expect(await reportingService.rapportAvocats("2000-01-01", "2000-01-02")).toBeNull();
  });
});

/**
 * La fiche d'activité (Q-133). Ce que le service doit garantir : que « moi » ne transporte aucun
 * identifiant, que le 204 reste un état vide, et que le nom du fichier téléchargé soit celui que le
 * serveur a construit de son côté.
 */
describe("fiche d'activité", () => {
  it("n'envoie aucun identifiant pour sa propre activité", async () => {
    await reportingService.rapportActivite("2026-09-01", "2026-09-30");

    expect(derniere?.url.pathname).toBe("/api/v1/rapports/activite");
    // C'est le serveur qui sait qui je suis : transporter mon identifiant depuis l'écran
    // ouvrirait la question de savoir ce qui se passe si j'en envoie un autre.
    expect(derniere!.url.searchParams.has("utilisateurId")).toBe(false);
  });

  it("transmet l'identifiant quand la direction regarde un collègue", async () => {
    await reportingService.rapportActivite("2026-09-01", "2026-09-30", { utilisateurId: 9 });

    expect(derniere!.url.searchParams.get("utilisateurId")).toBe("9");
  });

  /**
   * Un avocat se désigne par son **inscription au répertoire**, non par un compte : la direction le
   * connaît par là, et l'identifiant d'utilisateur n'y figure pas (Q-135).
   */
  it("désigne un avocat par son inscription, et non par un compte", async () => {
    await reportingService.rapportActivite("2026-09-01", "2026-09-30", { avocatId: 5 });

    const params = derniere!.url.searchParams;
    expect(params.get("avocatId")).toBe("5");
    // Jamais les deux : le serveur les refuse ensemble, et l'écran ne doit pas les proposer.
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
    // Une action hors dossier reste dans la liste : la masquer ferait disparaître de l'activité
    // réelle, et le décompte ne tomberait plus sur le nombre de lignes.
    expect(page.content[1]?.dossierId).toBeNull();
  });
});

/**
 * Le nom du fichier est construit **deux fois** : par le serveur dans `Content-Disposition`, que
 * CORS n'expose pas, et par l'écran pour nommer le téléchargement. Ces assertions sont le seul
 * endroit où les deux règles se confrontent.
 */
describe("nom de la fiche d'activité téléchargée", () => {
  it("porte la personne, la période et l'extension du format", () => {
    expect(
      nomFichierActivite({ nom: "Awa Ndiaye", utilisateurId: 7 }, "2026-09-01", "2026-09-30", "EXCEL"),
    ).toBe("activite-awa-ndiaye-2026-09-01_2026-09-30.xlsx");
  });

  /** Sans la passe de décomposition, « Hervé » donnait « herv- » : l'accent ne tombe pas dans [a-z0-9]. */
  it("retire les accents avant de passer en minuscules", () => {
    expect(
      nomFichierActivite({ nom: "Hervé Épée", utilisateurId: 3 }, "2026-01-01", "2026-01-31", "PDF"),
    ).toBe("activite-herve-epee-2026-01-01_2026-01-31.pdf");
  });

  /** Un compte retiré du référentiel n'a plus de nom : le fichier porte alors son identifiant. */
  it("se rabat sur l'identifiant quand le nom manque", () => {
    expect(nomFichierActivite({ nom: null, utilisateurId: 9 }, "2026-01-01", "2026-01-31", "CSV")).toBe(
      "activite-9-2026-01-01_2026-01-31.csv",
    );
  });
});

/**
 * Le clic d'une action mene a la fiche du dossier, **sur l'onglet correspondant**. Encore faut-il
 * que l'onglet existe.
 *
 * **Ce que ce test a attrape.** La premiere version de la carte envoyait les cinq natures de frais
 * sur un onglet `frais` qui n'existe pas : la fiche dossier n'en a pas, les demandes de frais vivant
 * sur leur propre ecran. Rien ne cassait - un onglet inconnu retombe silencieusement sur la synthese
 * - et le parcours e2e passait, parce qu'il verifiait seulement qu'on arrivait sur une fiche. La
 * promesse faite a l'utilisateur, elle, etait fausse.
 *
 * Les deux listes sont lues **dans le code qui les declare**, et non recopiees ici : une copie
 * vieillirait sans bruit, ce qui est exactement le defaut que ce test ferme.
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
    // Si la declaration changeait de forme, l'extraction rendrait un ensemble vide et ce test
    // passerait sans rien garder. La borne basse le dit tout haut.
    expect(reels.size, "les onglets de la fiche dossier ne se lisent plus").toBeGreaterThan(5);

    /*
     * **Les deux cartes**, et non la seule première. Une seconde est arrivée avec Q-137, pour le
     * détail des blocs du tableau de bord : un garde-fou qui ne regarde qu'un fichier ne protège
     * que lui, et c'est précisément le défaut qu'il est né pour fermer.
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
