/**
 * @vitest-environment node
 *
 * Audit of recorded actions: what goes over the wire, and the role guard. The backend filters; what
 * matters is **what we ask**. A missing filter must not be sent as an empty parameter, and the scope
 * must always be explicit rather than left to the server.
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
        // The fingerprint travels with the file: the recipient compares it without querying the app.
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
    // The scope is never left to the server: it is the screen's decision, not a default.
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

    // The code is sent, the label is displayed. The list comes from the data, never from an enum
    // copied on the screen side, so it never offers a choice that would return nothing.
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
   * A case file's history is open to every internal profile; the audit is aggregated and filterable
   * by author. This asymmetry is deliberate.
   */
  it("est plus fermé que l'historique d'un dossier, délibérément", () => {
    expect(CAPACITES.consulterDocuments).toContain("ROLE_CONSULTATION");
    expect(CAPACITES.consulterAudit).not.toContain("ROLE_CONSULTATION");
  });

  /**
   * A capability **distinct** from settings administration and alert monitoring, though held by the
   * same roles: reading a colleague's named activity involves personal data, so relaxing one must not
   * relax the other.
   */
  it("ne se confond avec aucune autre capacité d'administration", () => {
    expect(CAPACITES.consulterAudit).not.toBe(CAPACITES.administrerConfigurations);
    expect(CAPACITES.consulterAudit).not.toBe(CAPACITES.superviserAlertes);
  });
});

/**
 * Translation of action labels and detail keys. These tests protect **coverage**: a code added to
 * the backend without a translation would be displayed raw.
 */
describe("libelles d'historique (QF-24)", () => {
  /** Minimal shape of the message files, limited to what these tests query. */
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
   * The values of `TypeActionHistorique`. This test checks **parity** between both languages rather
   * than a fixed count, which would not detect codes added in French but missing in English.
   */
  it("traduit les memes natures d'action dans les deux langues", () => {
    expect(Object.keys(actionsFr).sort()).toEqual(Object.keys(actionsEn).sort());
    expect(Object.keys(actionsFr).length).toBeGreaterThanOrEqual(49);
  });

  it("traduit les memes cles de details dans les deux langues", () => {
    expect(Object.keys(detailsFr).sort()).toEqual(Object.keys(detailsEn).sort());
    expect(Object.keys(detailsFr).length).toBeGreaterThanOrEqual(65);
  });

  /** Audit export and archive download actions. */
  it("couvre l'extraction scellee de l'audit", () => {
    for (const messages of [actionsFr, actionsEn]) {
      expect(messages).toHaveProperty("AUDIT_EXPORTE");
      expect(messages).toHaveProperty("ARCHIVE_TELECHARGEE");
    }
    for (const messages of [detailsFr, detailsEn]) {
      expect(messages).toHaveProperty("exportId");
      expect(messages).toHaveProperty("empreinte");
    }
  });

  /** An empty translation is worse than a missing one: it would show a blank, with no fallback. */
  it("n'a aucun libelle vide", () => {
    for (const table of [actionsFr, actionsEn, detailsFr, detailsEn]) {
      for (const [cle, valeur] of Object.entries(table)) {
        expect(valeur.trim(), `libellé de ${cle}`).not.toBe("");
      }
    }
  });

  /**
   * French and English must mostly differ: identical tables would reveal a forgotten translation
   * copied from French.
   */
  it("distingue reellement les deux langues", () => {
    const identiques = Object.keys(actionsFr).filter((cle) => actionsFr[cle] === actionsEn[cle]);
    expect(identiques).toHaveLength(0);
  });

  /** The obsolete warning key about untranslated labels must not exist. */
  it("ne conserve plus l'avertissement de langue", () => {
    expect(fr.fiche).not.toHaveProperty("historiqueLangue");
    expect(en.fiche).not.toHaveProperty("historiqueLangue");
  });
});

/**
 * Audit export. The backend formats the file; what matters is **what we ask** and **what we
 * return**: the period is always sent, and the fingerprint reaches the screen.
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
    // What is exported is what is viewed: the screen filters go with the export.
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
    // Without the fingerprint reaching the screen, the archive would be just another copy.
    expect(empreinte).toHaveLength(64);
  });

  it("récupère une archive par l'endpoint tracé, jamais par sa clé de stockage", async () => {
    const url = await auditService.urlArchive(7);

    expect(url).toBe("https://minio/archive");
    // The path goes through the application, the only place where the download is logged.
    expect(derniere?.url.pathname).toBe("/api/v1/historique/exports/7/telechargement");
  });
});
