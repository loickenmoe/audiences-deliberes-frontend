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
  tauxSuccesRecouvrement: 0.5,
  provisionsReprises: 1_250_000,
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
      provisionsReprises: 3_000_000,
    });
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
    // Ratio de 0 à 1, pas un pourcentage : `Pourcentage` le met en forme.
    expect(donnees.tauxSuccesRecouvrement).toBe(0.75);
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
