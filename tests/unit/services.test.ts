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
/** Corps et verbe de la dernière écriture, pour les endpoints où la forme du corps est la règle. */
let derniereEcriture: { methode: string; corps: unknown } | null = null;

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

  http.put(`${BASE}/clients/:id`, async ({ request, params }) => {
    derniereUrl = new URL(request.url);
    derniereEcriture = { methode: request.method, corps: await request.json() };
    return HttpResponse.json({
      id: Number(params.id),
      reference: "CLI-001",
      nom: "SARL Bâtir et Fils",
      email: null,
      telephone: "+237 600 000 000",
      createdAt: "2026-09-01T10:00:00",
      updatedAt: "2026-09-22T08:00:00",
    });
  }),

  http.put(`${BASE}/intervenants/:id`, async ({ request, params }) => {
    derniereUrl = new URL(request.url);
    derniereEcriture = { methode: request.method, corps: await request.json() };
    return HttpResponse.json({
      id: Number(params.id),
      type: "AVOCAT",
      nom: "Me Fotso",
      email: null,
      telephone: null,
      compteKeycloak: "avocat.fotso",
      notification: null,
      createdAt: "2026-09-01T10:00:00",
    });
  }),

  http.get(`${BASE}/intervenants`, ({ request }) => {
    derniereUrl = new URL(request.url);
    // Paginé depuis Q-100 : le référentiel était renvoyé en entier.
    return HttpResponse.json({
      content: [
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
      ],
      totalPages: 1,
      totalElements: 1,
    });
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

describe("clientService.modifier", () => {
  /**
   * La référence est figée (décision du 2026-09-22) : elle ne doit pas partir dans le corps, et un
   * champ vidé part en `null` pour que le backend l’enregistre comme absent.
   */
  it("envoie un PUT sans référence, les champs vidés en null", async () => {
    const client = await clientService.modifier(1, {
      nom: "SARL Bâtir et Fils",
      email: null,
      telephone: "+237 600 000 000",
    });

    expect(derniereEcriture?.methode).toBe("PUT");
    expect(derniereUrl?.pathname).toBe("/api/v1/clients/1");
    expect(derniereEcriture?.corps).toEqual({ nom: "SARL Bâtir et Fils", email: null, telephone: "+237 600 000 000" });
    expect(derniereEcriture?.corps).not.toHaveProperty("reference");
    expect(client.nom).toBe("SARL Bâtir et Fils");
  });
});

describe("intervenantService.modifier", () => {
  /** Le type et l'identifiant de connexion sont figés (Q-117) : ils ne partent pas dans le corps. */
  it("envoie un PUT sans type ni identifiant de connexion", async () => {
    const intervenant = await intervenantService.modifier(7, {
      nom: "Me Fotso",
      email: "fotso@cab.cm",
      telephone: null,
      notification: null,
    });

    expect(derniereEcriture?.methode).toBe("PUT");
    expect(derniereUrl?.pathname).toBe("/api/v1/intervenants/7");
    expect(derniereEcriture?.corps).not.toHaveProperty("type");
    expect(derniereEcriture?.corps).not.toHaveProperty("compteKeycloak");
    expect(derniereEcriture?.corps).toMatchObject({ email: "fotso@cab.cm", notification: null });
    expect(intervenant.type).toBe("AVOCAT");
  });
});

describe("intervenantService", () => {
  it("filtre par type quand il est fourni", async () => {
    await intervenantService.lister({ type: "AVOCAT" });
    expect(derniereUrl?.searchParams.get("type")).toBe("AVOCAT");
  });

  it("n'envoie aucun filtre sans type", async () => {
    const page = await intervenantService.lister();

    expect(derniereUrl?.searchParams.has("type")).toBe(false);
    expect(page.content[0]?.compteKeycloak).toBe("avocat.test");
  });

  /**
   * Q-105 — la recherche au fil de la frappe. Ce qui compte n'est pas que le paramètre parte, mais
   * qu'il **ne parte pas** quand il est vide : un `nom=` vide ferait chercher la chaîne vide et
   * renverrait tout, en donnant l'illusion d'un filtre appliqué.
   */
  it("transmet la recherche par nom, et l'omet quand elle est vide", async () => {
    await intervenantService.lister({ nom: "Fotso" });
    expect(derniereUrl?.searchParams.get("nom")).toBe("Fotso");

    await intervenantService.lister({ nom: "" });
    expect(derniereUrl?.searchParams.has("nom")).toBe(false);
  });

  /** Q-100 — la taille de page est toujours transmise : sans elle, le backend impose la sienne. */
  it("transmet toujours une taille de page", async () => {
    await intervenantService.lister();
    expect(derniereUrl?.searchParams.get("size")).toBe("10");

    await intervenantService.lister({ size: 50 });
    expect(derniereUrl?.searchParams.get("size")).toBe("50");
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
