import { HttpResponse, http } from "msw";
import { setupServer } from "msw/node";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";

import { ErreurApi } from "@/lib/api/errors";
import { dossierService } from "@/services/dossierService";

/**
 * Couche de services des dossiers, contre un backend simulé.
 *
 * L'enjeu de ces tests n'est pas la donnée renvoyée mais la **requête émise** : le contrat de
 * `POST /dossiers` comporte trois pièges qu'un test d'affichage ne verrait pas — la nature envoyée
 * par libellé, la catégorie qu'il ne faut *pas* transmettre, et le type de client sensible attendu
 * par code.
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
  // La validation de configuration est volontairement stricte et échoue vite (`lib/env`) : les
  // tests doivent donc fournir ces variables, comme le fait `services.test.ts`.
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

    // `false` est déjà le défaut du backend : le transmettre alourdirait l'URL partagée sans rien
    // changer au résultat.
    expect(derniereUrl?.searchParams.has("mesDossiers")).toBe(false);
  });

  it("omet les filtres vides plutôt que d'envoyer des chaînes vides", async () => {
    await dossierService.lister({ reference: "", juridiction: "" });

    expect(derniereUrl?.searchParams.has("reference")).toBe(false);
    expect(derniereUrl?.searchParams.has("juridiction")).toBe(false);
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
  };

  it("envoie la nature par son libellé, fût-il long", async () => {
    await dossierService.creer(base);

    // 71 caractères : le backend les accepte depuis la migration V7. Le libellé est ce qu'il
    // résout — ni le code, ni l'identifiant.
    expect(dernierCorps?.nature).toBe(base.nature);
    expect(String(dernierCorps?.nature)).toHaveLength(71);
  });

  it("ne transmet jamais la catégorie", async () => {
    await dossierService.creer(base);

    // Le backend la déduit de la nature (RG-DOS-02) et rejette une valeur divergente : l'envoyer
    // n'apporterait qu'un risque d'incohérence.
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
