import { HttpResponse, http } from "msw";
import { setupServer } from "msw/node";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";

import { ErreurApi } from "@/lib/api/errors";
import { dossierService } from "@/services/dossierService";

/**
 * Case file service layer against a mocked backend. What matters is the **request sent**:
 * `POST /dossiers` has three traps a display test would miss: the nature is sent by label, the
 * category must *not* be sent, and the sensitive client type is expected by code.
 */
const BASE = "http://localhost:8080/api/v1";

let derniereUrl: URL | null = null;
let dernierCorps: Record<string, unknown> | null = null;

const serveur = setupServer(
  http.get(`${BASE}/dossiers`, ({ request }) => {
    derniereUrl = new URL(request.url);
    return HttpResponse.json({ content: [], totalPages: 0, totalElements: 0 });
  }),

  http.post(`${BASE}/dossiers`, async ({ request }) => {
    dernierCorps = (await request.json()) as Record<string, unknown>;
    return HttpResponse.json({ id: 7, reference: "DOS-001" }, { status: 201 });
  }),
);

beforeAll(() => {
  // Configuration validation is strict and fails fast (`lib/env`), so tests must provide these
  // variables, as `services.test.ts` does.
  process.env.NEXT_PUBLIC_API_URL = BASE;
  process.env.NEXT_PUBLIC_WS_URL = "http://localhost:8080/ws";
  serveur.listen({ onUnhandledRequest: "error" });
});
afterEach(() => {
  serveur.resetHandlers();
  derniereUrl = null;
  dernierCorps = null;
});
afterAll(() => serveur.close());

describe("dossierService.lister", () => {
  it("transmet les filtres de recherche ajoutés en M16", async () => {
    await dossierService.lister({ reference: "DOS-2026", clientId: 4, mesDossiers: true, page: 2 });

    expect(derniereUrl?.searchParams.get("reference")).toBe("DOS-2026");
    expect(derniereUrl?.searchParams.get("clientId")).toBe("4");
    expect(derniereUrl?.searchParams.get("mesDossiers")).toBe("true");
    expect(derniereUrl?.searchParams.get("page")).toBe("2");
  });

  it("n'envoie pas `mesDossiers` quand il est faux", async () => {
    await dossierService.lister({ mesDossiers: false });

    // `false` is already the backend default: sending it would lengthen the shared URL for nothing.
    expect(derniereUrl?.searchParams.has("mesDossiers")).toBe(false);
  });

  it("omet les filtres vides plutôt que d'envoyer des chaînes vides", async () => {
    await dossierService.lister({ reference: "", juridiction: "" });

    expect(derniereUrl?.searchParams.has("reference")).toBe(false);
    expect(derniereUrl?.searchParams.has("juridiction")).toBe(false);
  });

  /*
   * Filtering by step and hearing period, and sorting. Only the request sent is tested here; the
   * filtering itself is checked against the database by `DossierFiltresIntegrationTest`.
   */
  it("transmet le type et le statut d'étape", async () => {
    await dossierService.lister({ typeEtape: "RECOURS_1", statutEtape: "EN_COURS" });

    expect(derniereUrl?.searchParams.get("typeEtape")).toBe("RECOURS_1");
    expect(derniereUrl?.searchParams.get("statutEtape")).toBe("EN_COURS");
  });

  it("transmet la période d'audience", async () => {
    await dossierService.lister({ dateDebut: "2026-03-01", dateFin: "2026-03-31" });

    expect(derniereUrl?.searchParams.get("dateDebut")).toBe("2026-03-01");
    expect(derniereUrl?.searchParams.get("dateFin")).toBe("2026-03-31");
  });

  it("n'envoie pas le tri par défaut", async () => {
    await dossierService.lister({ tri: "RECENT" });

    // `RECENT` is already the server default: sending it would lengthen the shared URL for nothing.
    expect(derniereUrl?.searchParams.has("tri")).toBe(false);
  });

  it("transmet un tri choisi", async () => {
    await dossierService.lister({ tri: "RISQUE" });

    expect(derniereUrl?.searchParams.get("tri")).toBe("RISQUE");
  });
});

describe("dossierService.creer", () => {
  const base = {
    reference: "DOS-001",
    nature: "Hypothèque judiciaire (inscription provisoire, définitive, réalisation)",
    juridictionSaisie: "TGI Douala",
    clientId: 1,
    risqueEncouru: 1_000_000,
    juristesAffectes: [3],
    avocatsAffectes: [5],
    parties: { demandeurs: ["AFRILAND FIRST BANK"], defendeurs: ["Débiteur", "Caution"] },
  };

  it("envoie la nature par son libellé, fût-il long", async () => {
    await dossierService.creer(base);

    // 71 characters, accepted by the backend since migration V7. The backend resolves the label,
    // not the code or the id.
    expect(dernierCorps?.nature).toBe(base.nature);
    expect(String(dernierCorps?.nature)).toHaveLength(71);
  });

  it("ne transmet jamais la catégorie", async () => {
    await dossierService.creer(base);

    // The backend derives it from the nature (RG-DOS-02) and rejects a different value: sending it
    // would only risk inconsistency.
    expect(dernierCorps).not.toHaveProperty("categorie");
  });

  it("transmet le type de client sensible tel quel, pour que le backend le valide", async () => {
    await dossierService.creer({
      ...base,
      estSensible: true,
      seuilMontant: 60_000_000,
      typeClientSensible: "VIP",
    });

    expect(dernierCorps?.typeClientSensible).toBe("VIP");
  });

  it("propage le doublon de référence comme une ErreurApi portant le champ visé", async () => {
    serveur.use(
      http.post(`${BASE}/dossiers`, () =>
        HttpResponse.json(
          {
            code: "ERR-002",
            message: "La référence 'DOS-001' est déjà utilisée",
            details: null,
            champ: "reference",
          },
          { status: 409 },
        ),
      ),
    );

    await expect(dossierService.creer(base)).rejects.toSatisfy((erreur: unknown) => {
      expect(erreur).toBeInstanceOf(ErreurApi);
      expect((erreur as ErreurApi).champ).toBe("reference");
      return true;
    });
  });
});
