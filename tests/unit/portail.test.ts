/**
 * @vitest-environment node
 *
 * Portail Avocat (#23, #29, #31 et les quatre lectures de Q-96) : ce qui part sur le fil.
 *
 * L'enjeu de ce jalon n'est pas la forme des écrans, c'est le **cloisonnement** : un prestataire
 * externe ne doit atteindre que des endpoints qui lui sont propres. Ces tests vérifient qu'aucun
 * appel ne vise les endpoints internes, et que les dépôts respectent les contrats des stories 4.1,
 * 5.1 et 5.3.
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
  // `onUnhandledRequest: "error"` est ici la garantie du cloisonnement : tout appel vers un
  // endpoint interne, non déclaré ci-dessus, fait échouer le test au lieu de passer inaperçu.
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
    // Sélecteur, pas file de travail : une page généreuse évite de paginer un menu déroulant.
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
   * UC-INT-01 étape 4 : « l'avocat **charge** les pièces justificatives ». Le fichier part seul, et
   * c'est sa **clé de stockage** qui accompagnera la demande — ce que le dictionnaire des données
   * appelle « chemins ou références des pièces » (QF-26, backend Q-97).
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
      // Des chemins de stockage, pas des libellés : c'est ce qui rend la pièce consultable.
      piecesJustificatives: ["frais/uuid-facture.pdf", "frais/uuid-releve.pdf"],
      referenceFacture: "FAC-2026-001",
    });
  });
});

describe("dépôts de publication (#29, #31)", () => {
  /**
   * Depuis Q-98, le compte rendu part en multipart : les métadonnées en paramètres, la pièce
   * facultative en partie. Sans pièce, aucune partie n'est envoyée — le récit se suffit.
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
    // Le fichier doit réellement partir : avec le type JSON par défaut, axios sérialiserait le
    // FormData et la partie disparaîtrait.
    expect((derniere?.formulaire?.get("file") as File)?.name).toBe("conclusion.pdf");
  });

  it("omet la restriction d'accès quand aucun lecteur n'est désigné", async () => {
    const fichier = new File(["x"], "piece.pdf", { type: "application/pdf" });

    await publicationService.deposerAutre(4, "PIECE", fichier);

    expect(derniere?.url.searchParams.has("restrictionAcces")).toBe(false);
  });
});
