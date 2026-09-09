import { HttpResponse, http } from "msw";
import { setupServer } from "msw/node";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";

import { ErreurApi } from "@/lib/api/errors";
import { clientService } from "@/services/clientService";
import { intervenantService } from "@/services/intervenantService";
import { referentielService } from "@/services/referentielService";

/**
 * Vérification de la couche de services contre un backend simulé.
 *
 * Ce que ces tests couvrent et que `npm run smoke` ne couvre pas : la **forme des requêtes que nous
 * émettons** — verbe, chemin, paramètres — et la traduction des réponses d'erreur. Le smoke vérifie
 * l'inverse : que le vrai backend se comporte comme on le suppose.
 *
 * Les charges utiles reproduisent des réponses **réellement observées** sur l'instance locale.
 */
const BASE = "http://localhost:8080/api/v1";

/** Mémorise la dernière requête reçue, pour vérifier ce que le service a réellement demandé. */
let derniereUrl: URL | null = null;

const serveur = setupServer(
  http.get(`${BASE}/clients`, ({ request }) => {
    derniereUrl = new URL(request.url);
    return HttpResponse.json({
      content: [
        {
          id: 1,
          reference: "CLI-001",
          nom: "SARL Bâtir",
          email: null,
          telephone: null,
          createdAt: "2026-09-01T10:00:00",
          updatedAt: "2026-09-01T10:00:00",
        },
      ],
      totalPages: 1,
      totalElements: 1,
    });
  }),

  http.get(`${BASE}/clients/:id/dossiers`, ({ params }) =>
    HttpResponse.json({
      clientId: Number(params.id),
      clientNom: "SARL Bâtir",
      recouvrement: [],
      exploitationLitiges: [],
    }),
  ),

  http.post(`${BASE}/clients`, () =>
    HttpResponse.json(
      { code: "ERR-002", message: "Cette référence est déjà utilisée", details: null },
      { status: 409 },
    ),
  ),

  http.get(`${BASE}/intervenants`, ({ request }) => {
    derniereUrl = new URL(request.url);
    return HttpResponse.json([
      {
        id: 4,
        type: "AVOCAT",
        nom: "Me Ngo Bassong",
        email: "avocat@example.cm",
        telephone: null,
        compteKeycloak: "avocat.test",
        notification: null,
        createdAt: "2026-09-02T09:00:00",
      },
    ]);
  }),

  http.get(`${BASE}/referentiels/natures-dossier`, ({ request }) => {
    derniereUrl = new URL(request.url);
    return HttpResponse.json([
      {
        id: 1,
        code: "SAISIE_IMMOBILIERE",
        libelle: "Saisie immobilière",
        categorie: "RECOUVREMENT",
      },
    ]);
  }),

  http.get(`${BASE}/utilisateurs`, ({ request }) => {
    derniereUrl = new URL(request.url);
    return HttpResponse.json([]);
  }),
);

beforeAll(() => {
  process.env.NEXT_PUBLIC_API_URL = BASE;
  process.env.NEXT_PUBLIC_WS_URL = "http://localhost:8080/ws";
  serveur.listen({ onUnhandledRequest: "error" });
});
afterEach(() => {
  serveur.resetHandlers();
  derniereUrl = null;
});
afterAll(() => serveur.close());

describe("clientService", () => {
  it("transmet la recherche et rend la pagination du backend", async () => {
    const page = await clientService.rechercher({ nom: "Bâtir", page: 2 });

    expect(derniereUrl?.searchParams.get("nom")).toBe("Bâtir");
    expect(derniereUrl?.searchParams.get("page")).toBe("2");
    expect(page.totalElements).toBe(1);
    expect(page.content[0]?.reference).toBe("CLI-001");
  });

  /** Un filtre vide ne doit pas partir : `?nom=` restreindrait la recherche côté backend. */
  it("n'envoie pas les filtres non renseignés", async () => {
    await clientService.rechercher({ page: 0 });

    expect(derniereUrl?.searchParams.has("nom")).toBe(false);
    expect(derniereUrl?.searchParams.has("reference")).toBe(false);
  });

  it("rend la vue consolidée groupée par catégorie", async () => {
    const vue = await clientService.vueConsolidee(1);

    expect(vue.clientNom).toBe("SARL Bâtir");
    expect(vue.recouvrement).toEqual([]);
    expect(vue.exploitationLitiges).toEqual([]);
  });

  /** `ERR-002` doit remonter comme `ErreurApi` typée, pas comme une erreur axios brute. */
  it("normalise le refus de référence en doublon", async () => {
    await expect(clientService.creer({ reference: "CLI-001", nom: "Doublon" })).rejects.toSatisfy(
      (erreur: unknown) =>
        erreur instanceof ErreurApi &&
        erreur.code === "ERR-002" &&
        erreur.statut === 409 &&
        !erreur.demandeConfirmation,
    );
  });
});

describe("intervenantService", () => {
  it("filtre par type quand il est fourni", async () => {
    await intervenantService.lister("AVOCAT");
    expect(derniereUrl?.searchParams.get("type")).toBe("AVOCAT");
  });

  it("n'envoie aucun filtre sans type", async () => {
    const liste = await intervenantService.lister();

    expect(derniereUrl?.searchParams.has("type")).toBe(false);
    expect(liste[0]?.compteKeycloak).toBe("avocat.test");
  });
});

describe("referentielService", () => {
  it("filtre les natures de dossier par catégorie", async () => {
    await referentielService.naturesDossier("RECOUVREMENT");
    expect(derniereUrl?.searchParams.get("categorie")).toBe("RECOUVREMENT");
  });

  it("demande l'annuaire filtré par profil", async () => {
    await referentielService.utilisateurs({ profil: "JURISTE" });
    expect(derniereUrl?.searchParams.get("profil")).toBe("JURISTE");
  });
});
