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
import { readFileSync } from "node:fs";

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
  http.get(`${BASE}/historique/export`, ({ request }) => {
    derniere = { methode: request.method, url: new URL(request.url) };
    return new HttpResponse(new Blob(["fichier"]), {
      headers: {
        "Content-Type": "application/pdf",
        // L'empreinte voyage avec le fichier : le destinataire la compare sans interroger l'app.
        "X-Empreinte-SHA256": "ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad",
      },
    });
  }),
  http.get(`${BASE}/historique/exports/:id/telechargement`, ({ request }) => {
    derniere = { methode: request.method, url: new URL(request.url) };
    return HttpResponse.json({ url: "https://minio/archive" });
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

/**
 * QF-24 — la traduction des libelles d'action et des cles de details.
 *
 * Ce que ces tests protegent : la **couverture**. Un code ajoute au backend sans traduction ici
 * s'afficherait en brut, et personne ne le verrait avant la recette anglaise.
 */
describe("libelles d'historique (QF-24)", () => {
  /** Forme minimale des fichiers de messages, limitee a ce que ces tests interrogent. */
  interface Messages {
    fiche: Record<string, unknown>;
    historique: { actions: Record<string, string>; details: Record<string, string> };
  }

  const fr = JSON.parse(readFileSync("messages/fr.json", "utf8")) as Messages;
  const en = JSON.parse(readFileSync("messages/en.json", "utf8")) as Messages;

  const actionsFr = fr.historique.actions;
  const actionsEn = en.historique.actions;
  const detailsFr = fr.historique.details;
  const detailsEn = en.historique.details;

  /**
   * Les valeurs de `TypeActionHistorique` (backend Q-111, plus AUDIT_CONSULTE en Q-112 et
   * LETTRE_CONSTITUTION_REDIGEE en Q-115 B2, CLIENT_MODIFIE avec PUT /clients). Un ecart avec l'enumeration se verrait ici avant de
   * se voir a l'ecran — et c'est ce garde-fou qui a rappele d'ajouter la traduction du code.
   */
  it("traduit les 46 natures d'action dans les deux langues", () => {
    expect(Object.keys(actionsFr)).toHaveLength(46);
    expect(Object.keys(actionsEn)).toEqual(Object.keys(actionsFr));
  });

  it("traduit les 58 cles de details dans les deux langues", () => {
    // PUT /clients : ancien/nouveau nom, e-mail et telephone.
    expect(Object.keys(detailsFr)).toHaveLength(58);
    expect(Object.keys(detailsEn)).toEqual(Object.keys(detailsFr));
  });

  /** Une traduction vide serait pire qu'une absente : elle afficherait un blanc, sans repli. */
  it("n'a aucun libelle vide", () => {
    for (const table of [actionsFr, actionsEn, detailsFr, detailsEn]) {
      for (const [cle, valeur] of Object.entries(table)) {
        expect(valeur.trim(), `libellé de ${cle}`).not.toBe("");
      }
    }
  });

  /**
   * Le francais et l'anglais doivent differer sur l'essentiel : deux tables identiques signaleraient
   * une traduction oubliee, recopiee depuis le francais.
   */
  it("distingue reellement les deux langues", () => {
    const identiques = Object.keys(actionsFr).filter((cle) => actionsFr[cle] === actionsEn[cle]);
    expect(identiques).toHaveLength(0);
  });

  /** La cle d'avertissement de QF-24 n'a plus de raison d'etre : elle s'excusait du defaut corrige. */
  it("ne conserve plus l'avertissement de langue", () => {
    expect(fr.fiche).not.toHaveProperty("historiqueLangue");
    expect(en.fiche).not.toHaveProperty("historiqueLangue");
  });
});

/**
 * Extraction de l'audit (backend Q-113).
 *
 * Ce qui compte ici n'est pas la mise en forme du fichier — le backend s'en charge et la teste —
 * mais **ce qu'on demande** et **ce qu'on rapporte** : la période part toujours, et l'empreinte
 * revient jusqu'a l'ecran, sans quoi elle ne servirait a rien.
 */
describe("extraction de l'audit", () => {
  it("transmet la période et le format, et reprend les filtres en cours", async () => {
    await auditService.exporter(
      {
        perimetre: "HORS_DOSSIER",
        utilisateurId: 4,
        code: "CONFIGURATION_MODIFIEE",
        dateDebut: "2026-09-01",
        dateFin: "2026-09-30",
      },
      "EXCEL",
    );

    expect(derniere?.url.pathname).toBe("/api/v1/historique/export");
    expect(derniere?.url.searchParams.get("format")).toBe("EXCEL");
    expect(derniere?.url.searchParams.get("dateDebut")).toBe("2026-09-01");
    expect(derniere?.url.searchParams.get("dateFin")).toBe("2026-09-30");
    // Ce qu'on exporte est ce qu'on regarde : les filtres de l'écran suivent l'extraction.
    expect(derniere?.url.searchParams.get("perimetre")).toBe("HORS_DOSSIER");
    expect(derniere?.url.searchParams.get("utilisateurId")).toBe("4");
    expect(derniere?.url.searchParams.get("code")).toBe("CONFIGURATION_MODIFIEE");
  });

  it("rapporte l'empreinte et un nom de fichier qui porte la période", async () => {
    const { nomFichier, empreinte } = await auditService.exporter(
      { dateDebut: "2026-09-01", dateFin: "2026-09-30" },
      "PDF",
    );

    expect(nomFichier).toBe("audit-2026-09-01-2026-09-30.pdf");
    // Sans l'empreinte remontée jusqu'à l'écran, l'archive ne serait qu'une copie de plus.
    expect(empreinte).toHaveLength(64);
  });

  it("récupère une archive par l'endpoint tracé, jamais par sa clé de stockage", async () => {
    const url = await auditService.urlArchive(7);

    expect(url).toBe("https://minio/archive");
    // Le chemin passe par l'application : c'est le seul endroit où la récupération est tracée.
    expect(derniere?.url.pathname).toBe("/api/v1/historique/exports/7/telechargement");
  });
});
