/**
 * @vitest-environment node
 *
 * Publications (#30, #32-#34, #59), constitutions (#35, #36, #60) et répertoire (#37) : ce qui part
 * sur le fil, et ce que chaque profil se voit proposer.
 */
import { HttpResponse, http, type JsonBodyType } from "msw";
import { setupServer } from "msw/node";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";

import { estCentralisateur, peutCommenter, vuesConstitutions, vuesPublications } from "@/lib/publications";
import { constitutionService } from "@/services/constitutionService";
import { publicationService } from "@/services/publicationService";

const BASE = "http://localhost:8080/api/v1";

let derniere: { methode: string; url: URL; corps: unknown } | null = null;

async function capturer(request: Request, reponse: JsonBodyType = { id: 7 }) {
  const texte = await request.text();
  derniere = { methode: request.method, url: new URL(request.url), corps: texte ? JSON.parse(texte) : null };
  return HttpResponse.json(reponse);
}

const serveur = setupServer(
  http.get(`${BASE}/publications`, ({ request }) => capturer(request, { content: [], totalPages: 0, totalElements: 0 })),
  http.get(`${BASE}/publications/:id`, ({ request }) => capturer(request)),
  http.put(`${BASE}/publications/:id/validation`, ({ request }) => capturer(request)),
  http.post(`${BASE}/publications/:id/commentaires`, ({ request }) => capturer(request)),
  http.post(`${BASE}/publications/:id/correspondance`, ({ request }) => capturer(request)),
  http.get(`${BASE}/constitutions/prestataires`, ({ request }) => capturer(request, [])),
  http.post(`${BASE}/constitutions/prestataires`, ({ request }) => capturer(request)),
  http.put(`${BASE}/constitutions/prestataires/:id/validation`, ({ request }) => capturer(request)),
  http.get(`${BASE}/repertoire/avocats`, ({ request }) => capturer(request, [])),
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

describe("publications", () => {
  it("filtre la file par statut et par dossier", async () => {
    await publicationService.lister({ dossierId: 4, statut: "DEPOSE", page: 1 });

    expect(derniere?.url.searchParams.get("dossierId")).toBe("4");
    expect(derniere?.url.searchParams.get("statut")).toBe("DEPOSE");
    expect(derniere?.url.searchParams.get("page")).toBe("1");
  });

  it("n'envoie ni dossier ni statut quand on n'en demande pas", async () => {
    await publicationService.lister({});
    expect(derniere?.url.searchParams.has("dossierId")).toBe(false);
    expect(derniere?.url.searchParams.has("statut")).toBe(false);
  });

  it("valide, ou rejette avec son motif", async () => {
    await publicationService.valider(7, { statut: "REJETE", motifRejet: "Audience erronée" });

    expect(derniere?.methode).toBe("PUT");
    expect(derniere?.url.pathname).toBe("/api/v1/publications/7/validation");
    expect(derniere?.corps).toEqual({ statut: "REJETE", motifRejet: "Audience erronée" });
  });

  it("commente pour le DJ et la DJA", async () => {
    await publicationService.commenter(7, "Pièce incomplète");

    expect(derniere?.url.pathname).toBe("/api/v1/publications/7/commentaires");
    expect(derniere?.corps).toEqual({ contenu: "Pièce incomplète" });
  });

  it("transmet la correspondance unique", async () => {
    await publicationService.transmettreCorrespondance(7, "Merci de compléter");

    expect(derniere?.methode).toBe("POST");
    expect(derniere?.url.pathname).toBe("/api/v1/publications/7/correspondance");
  });
});

describe("constitutions et répertoire", () => {
  it("la file du SH demande les demandes en attente", async () => {
    await constitutionService.lister("EN_ATTENTE");
    expect(derniere?.url.searchParams.get("statut")).toBe("EN_ATTENTE");
  });

  it("sollicite une constitution avec son motif", async () => {
    await constitutionService.solliciter({ dossierId: 3, prestataireId: 9, motif: "Représentation au TGI" });
    expect(derniere?.corps).toEqual({ dossierId: 3, prestataireId: 9, motif: "Représentation au TGI" });
  });

  it("rejette une constitution avec son motif", async () => {
    await constitutionService.decider(5, { decision: "REJETEE", motifRejet: "Prestataire déjà constitué" });

    expect(derniere?.url.pathname).toBe("/api/v1/constitutions/prestataires/5/validation");
    expect(derniere?.corps).toEqual({ decision: "REJETEE", motifRejet: "Prestataire déjà constitué" });
  });

  it("cherche un avocat par son nom, ou les liste tous", async () => {
    await constitutionService.repertoire("Fotso");
    expect(derniere?.url.searchParams.get("nom")).toBe("Fotso");

    await constitutionService.repertoire();
    expect(derniere?.url.searchParams.has("nom")).toBe(false);
  });
});

describe("ce que chaque profil se voit proposer", () => {
  it("l'Assistante instruit : sa file s'ouvre sur les publications à valider", () => {
    expect(vuesPublications(["ROLE_ASSISTANTE", "ROLE_CONSULTATION"]).map((v) => v.cle)).toEqual([
      "aValider",
      "validees",
      "rejetees",
      "toutes",
    ]);
  });

  it("les juristes, le DJ et la DJA ne voient que les publications validées", () => {
    expect(vuesPublications(["ROLE_JURISTE"]).map((v) => v.statut)).toEqual(["VALIDE"]);
    expect(vuesPublications(["ROLE_DJ", "ROLE_JURISTE"]).map((v) => v.statut)).toEqual(["VALIDE"]);
  });

  it("le juriste commente ; le DJ et la DJA, qui portent aussi ROLE_JURISTE (Q-81), écrivent la correspondance", () => {
    expect(peutCommenter(["ROLE_JURISTE"])).toBe(true);
    expect(estCentralisateur(["ROLE_JURISTE"])).toBe(false);
    expect(peutCommenter(["ROLE_DJA", "ROLE_JURISTE"])).toBe(false);
    expect(estCentralisateur(["ROLE_DJA", "ROLE_JURISTE"])).toBe(true);
  });

  it("le SH ouvre sur les constitutions à signer, le juriste sur l'historique", () => {
    expect(vuesConstitutions(["ROLE_SH"])[0]).toBe("aSigner");
    expect(vuesConstitutions(["ROLE_JURISTE"])[0]).toBe("toutes");
  });
});
