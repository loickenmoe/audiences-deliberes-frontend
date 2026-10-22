import { HttpResponse, http } from "msw";
import { setupServer } from "msw/node";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";

import { ErreurApi } from "@/lib/api/errors";
import { clientService } from "@/services/clientService";
import { intervenantService } from "@/services/intervenantService";
import { referentielService } from "@/services/referentielService";

/**
 * Service layer checks against a mocked backend: the **shape of the requests we send** (verb, path,
 * parameters) and the translation of error responses. Payloads reproduce responses **actually
 * observed** locally; the Playwright journeys check the real backend.
 */
const BASE = "http://localhost:8080/api/v1";

/** Last request received, to check what the service actually asked for. */
let derniereUrl: URL | null = null;
/** Body and verb of the last write, for endpoints where the body shape is the rule. */
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

  http.get(`${BASE}/referentiels/agences`, ({ request }) => {
    derniereUrl = new URL(request.url);
    return HttpResponse.json({
      content: [
        {
          id: 3,
          code: "00002",
          nom: "BONANJO",
          ville: "Douala",
          adresse: "Quartier administratif Bonanjo",
          telephone: "233 42 68 00",
          actif: true,
        },
      ],
      totalPages: 1,
      totalElements: 1,
    });
  }),

  http.post(`${BASE}/referentiels/agences`, async ({ request }) => {
    derniereUrl = new URL(request.url);
    derniereEcriture = { methode: request.method, corps: await request.json() };
    return HttpResponse.json(
      {
        id: 83,
        code: "00117",
        nom: "NOUVELLE",
        ville: "Douala",
        adresse: null,
        telephone: null,
        actif: true,
      },
      { status: 201 },
    );
  }),

  http.patch(`${BASE}/referentiels/agences/:id/reactivation`, ({ request, params }) => {
    derniereUrl = new URL(request.url);
    derniereEcriture = { methode: request.method, corps: null };
    return HttpResponse.json({
      id: Number(params.id),
      code: "00002",
      nom: "BONANJO",
      ville: "Douala",
      adresse: null,
      telephone: null,
      actif: true,
    });
  }),

  http.delete(`${BASE}/referentiels/agences/:id`, ({ request, params }) => {
    derniereUrl = new URL(request.url);
    derniereEcriture = { methode: request.method, corps: null };
    return HttpResponse.json({
      id: Number(params.id),
      code: "00002",
      nom: "BONANJO",
      ville: "Douala",
      adresse: null,
      telephone: null,
      actif: false,
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

  /** An empty filter must not be sent: `?nom=` would restrict the backend search. */
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

  /**
   * `ERR-002` must surface as a typed `ErreurApi`, not a raw axios error. The server assigns the
   * reference, but this conflict remains possible if the counter gets out of sync (V36).
   */
  it("normalise le refus de référence en doublon", async () => {
    await expect(clientService.creer({ nom: "Doublon" })).rejects.toSatisfy(
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
   * The reference is immutable: it must not be sent in the body, and a cleared field is sent as
   * `null` so the backend stores it as absent.
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
  /** Type and login id are immutable: they are not sent in the body. */
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
   * Search as you type: the parameter must **not be sent** when empty, otherwise an empty `nom=`
   * would return everything while looking like an applied filter.
   */
  it("transmet la recherche par nom, et l'omet quand elle est vide", async () => {
    await intervenantService.lister({ nom: "Fotso" });
    expect(derniereUrl?.searchParams.get("nom")).toBe("Fotso");

    await intervenantService.lister({ nom: "" });
    expect(derniereUrl?.searchParams.has("nom")).toBe(false);
  });

  /** The page size is always sent: otherwise the backend imposes its own. */
  it("transmet toujours une taille de page", async () => {
    await intervenantService.lister();
    expect(derniereUrl?.searchParams.get("size")).toBe("10");

    await intervenantService.lister({ size: 50 });
    expect(derniereUrl?.searchParams.get("size")).toBe("50");
  });
});

describe("referentielService.agences", () => {
  /**
   * Search as you type: a page size is **always sent**, otherwise the backend imposes its own and
   * the dropdown would silently truncate the directory.
   */
  it("transmet la recherche et une taille de page", async () => {
    const page = await referentielService.agences({ recherche: "bona" });

    expect(derniereUrl?.pathname).toBe("/api/v1/referentiels/agences");
    expect(derniereUrl?.searchParams.get("recherche")).toBe("bona");
    expect(derniereUrl?.searchParams.get("size")).toBe("20");
    expect(page.content[0]?.code).toBe("00002");
    expect(page.content[0]?.ville).toBe("Douala");
  });

  /** Input must offer only open branches: the flag is sent explicitly. */
  it("demande les agences ouvertes seules quand on le lui dit", async () => {
    await referentielService.agences({ actifSeulement: true });
    expect(derniereUrl?.searchParams.get("actifSeulement")).toBe("true");

    await referentielService.agences({ actifSeulement: false });
    expect(derniereUrl?.searchParams.get("actifSeulement")).toBe("false");
  });

  it("crée une agence avec sa ville", async () => {
    const agence = await referentielService.creerAgence({
      code: "00117",
      nom: "NOUVELLE",
      ville: "Douala",
      adresse: null,
      telephone: null,
    });

    expect(derniereEcriture?.methode).toBe("POST");
    expect(derniereEcriture?.corps).toMatchObject({ code: "00117", ville: "Douala" });
    expect(agence.actif).toBe(true);
  });

  /**
   * Closing is reversible. `PATCH`, not `PUT`: only the open state changes, and **the code is kept**
   * so the branch can be reopened.
   */
  it("rouvre une agence fermée sans toucher à son code", async () => {
    const agence = await referentielService.reactiverAgence(3);

    expect(derniereEcriture?.methode).toBe("PATCH");
    expect(derniereUrl?.pathname).toBe("/api/v1/referentiels/agences/3/reactivation");
    expect(agence.actif).toBe(true);
    expect(agence.code).toBe("00002");
  });

  /**
   * `DELETE` **deactivates**, despite the verb: a case file opened under a closed branch stays valid
   * and its code must still point to something. The service returns the branch, not `void`, so the
   * screen can show its new state.
   */
  it("rend l'agence désactivée plutôt que rien", async () => {
    const agence = await referentielService.desactiverAgence(3);

    expect(derniereEcriture?.methode).toBe("DELETE");
    expect(derniereUrl?.pathname).toBe("/api/v1/referentiels/agences/3");
    expect(agence.actif).toBe(false);
    expect(agence.code).toBe("00002");
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
