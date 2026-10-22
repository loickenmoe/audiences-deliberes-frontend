/**
 * @vitest-environment node
 *
 * Lawyer portal (#23, #29, #31): what goes over the wire. The key point is **isolation**: an external
 * provider must only reach its own endpoints. These tests check that no call targets internal
 * endpoints, and that submissions follow the contracts of stories 4.1, 5.1 and 5.3.
 */
import { HttpResponse, http, type JsonBodyType } from "msw";
import { setupServer } from "msw/node";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";

import { fraisService } from "@/services/fraisService";
import { portailAvocatService } from "@/services/portailAvocatService";
import { publicationService } from "@/services/publicationService";

const BASE = "http://localhost:8080/api/v1";

let derniere: { methode: string; url: URL; corps: unknown; formulaire?: FormData } | null = null;

async function capturer(request: Request, reponse: JsonBodyType = { id: 7 }) {
  const type = request.headers.get("content-type") ?? "";
  if (type.startsWith("multipart/form-data")) {
    derniere = {
      methode: request.method,
      url: new URL(request.url),
      corps: null,
      formulaire: await request.formData(),
    };
  } else {
    const texte = await request.text();
    derniere = {
      methode: request.method,
      url: new URL(request.url),
      corps: texte ? JSON.parse(texte) : null,
    };
  }
  return HttpResponse.json(reponse);
}

const PAGE_VIDE = { content: [], totalPages: 0, totalElements: 0 };

const serveur = setupServer(
  http.get(`${BASE}/avocat/mes-dossiers`, ({ request }) => capturer(request, PAGE_VIDE)),
  http.get(`${BASE}/avocat/mes-dossiers/:id/audiences`, ({ request }) => capturer(request, [])),
  http.get(`${BASE}/avocat/mes-publications`, ({ request }) => capturer(request, PAGE_VIDE)),
  http.get(`${BASE}/avocat/mes-constitutions`, ({ request }) => capturer(request, [])),
  http.post(`${BASE}/frais/demandes`, ({ request }) => capturer(request)),
  http.post(`${BASE}/publications/cr-audience`, ({ request }) => capturer(request)),
  http.post(`${BASE}/publications/autres`, ({ request }) => capturer(request)),
  http.post(`${BASE}/avocat/pieces-justificatives`, ({ request }) =>
    capturer(request, { cle: "frais/uuid-facture.pdf", nomFichier: "facture.pdf", urlTelechargement: "http://minio/x" }),
  ),
);

beforeAll(() => {
  process.env.NEXT_PUBLIC_API_URL = BASE;
  process.env.NEXT_PUBLIC_WS_URL = "http://localhost:8080/ws";
  // `onUnhandledRequest: "error"` enforces isolation: any call to an internal endpoint not declared
  // above fails the test instead of going unnoticed.
  serveur.listen({ onUnhandledRequest: "error" });
});
afterEach(() => {
  serveur.resetHandlers();
  derniere = null;
});
afterAll(() => serveur.close());

describe("lectures du portail", () => {
  it("demande ses dossiers sur l'endpoint qui lui est propre, pas sur /dossiers", async () => {
    await portailAvocatService.mesDossiers();

    expect(derniere?.url.pathname).toBe("/api/v1/avocat/mes-dossiers");
    // A selector, not a work queue: a large page avoids paginating a dropdown.
    expect(derniere?.url.searchParams.get("size")).toBe("100");
  });

  it("lit les audiences dossier par dossier", async () => {
    await portailAvocatService.audiencesDeMonDossier(42);

    expect(derniere?.url.pathname).toBe("/api/v1/avocat/mes-dossiers/42/audiences");
  });

  it("relit ses publications et ses constitutions sur ses propres endpoints", async () => {
    await portailAvocatService.mesPublications();
    expect(derniere?.url.pathname).toBe("/api/v1/avocat/mes-publications");

    await portailAvocatService.mesConstitutions();
    expect(derniere?.url.pathname).toBe("/api/v1/avocat/mes-constitutions");
    expect(derniere?.url.search).toBe("");
  });
});

describe("dépôt d'une demande de frais (#23, US 4.1)", () => {
  /**
   * UC-INT-01 step 4: the lawyer **uploads** supporting documents. The file is sent alone, and its
   * **storage key** accompanies the request ("document paths or references" in the data dictionary).
   */
  it("téléverse une pièce en multipart et en récupère la clé", async () => {
    const fichier = new File(["x"], "facture.pdf", { type: "application/pdf" });

    const piece = await portailAvocatService.deposerPieceJustificative(fichier);

    expect(derniere?.url.pathname).toBe("/api/v1/avocat/pieces-justificatives");
    expect((derniere?.formulaire?.get("file") as File)?.name).toBe("facture.pdf");
    expect(piece.cle).toBe("frais/uuid-facture.pdf");
  });

  it("envoie le dossier, le montant, la référence et les clés des pièces", async () => {
    await fraisService.deposer({
      dossierId: 4,
      montant: 1_200_000,
      piecesJustificatives: ["frais/uuid-facture.pdf", "frais/uuid-releve.pdf"],
      referenceFacture: "FAC-2026-001",
    });

    expect(derniere?.methode).toBe("POST");
    expect(derniere?.url.pathname).toBe("/api/v1/frais/demandes");
    expect(derniere?.corps).toEqual({
      dossierId: 4,
      montant: 1_200_000,
      // Storage paths, not labels: this is what makes the document viewable.
      piecesJustificatives: ["frais/uuid-facture.pdf", "frais/uuid-releve.pdf"],
      referenceFacture: "FAC-2026-001",
    });
  });
});

describe("dépôts de publication (#29, #31)", () => {
  /**
   * The report is sent as multipart: metadata as parameters, the optional document as a part.
   * Without a document, no part is sent.
   */
  it("envoie le compte rendu en multipart, rattaché à une audience, sans pièce", async () => {
    await publicationService.deposerCompteRendu({ dossierId: 4, audienceId: 9, contenu: "Renvoi au 12." });

    expect(derniere?.url.pathname).toBe("/api/v1/publications/cr-audience");
    const params = derniere!.url.searchParams;
    expect(params.get("dossierId")).toBe("4");
    expect(params.get("audienceId")).toBe("9");
    expect(params.get("contenu")).toBe("Renvoi au 12.");
    expect(params.has("restrictionAcces")).toBe(false);
    expect(derniere?.formulaire?.get("file")).toBeNull();
  });

  it("joint la pièce au compte rendu quand elle est fournie", async () => {
    const plumitif = new File(["x"], "plumitif.pdf", { type: "application/pdf" });

    await publicationService.deposerCompteRendu({ dossierId: 4, audienceId: 9, contenu: "Renvoi" }, plumitif);

    expect((derniere?.formulaire?.get("file") as File)?.name).toBe("plumitif.pdf");
    expect(derniere?.url.searchParams.get("contenu")).toBe("Renvoi");
  });

  it("envoie une autre publication en multipart : métadonnées en paramètres, fichier en partie", async () => {
    const fichier = new File(["contenu"], "conclusion.pdf", { type: "application/pdf" });

    await publicationService.deposerAutre(4, "CONCLUSION", fichier);

    expect(derniere?.url.pathname).toBe("/api/v1/publications/autres");
    expect(derniere?.url.searchParams.get("dossierId")).toBe("4");
    expect(derniere?.url.searchParams.get("typeDocument")).toBe("CONCLUSION");
    // The file must really be sent: with the default JSON type, axios would serialize the FormData
    // and the part would be lost.
    expect((derniere?.formulaire?.get("file") as File)?.name).toBe("conclusion.pdf");
  });

  it("omet la restriction d'accès quand aucun lecteur n'est désigné", async () => {
    const fichier = new File(["x"], "piece.pdf", { type: "application/pdf" });

    await publicationService.deposerAutre(4, "PIECE", fichier);

    expect(derniere?.url.searchParams.has("restrictionAcces")).toBe(false);
  });
});
