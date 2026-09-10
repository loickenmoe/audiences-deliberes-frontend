/**
 * @vitest-environment node
 *
 * Sous jsdom, un corps `FormData` envoyé par `XMLHttpRequest` et intercepté par MSW n'est jamais
 * relu : la requête reste suspendue et le test expire sans rien vérifier. Sous Node, axios passe par
 * son adaptateur HTTP, qui encode réellement le multipart — ce que ce fichier veut justement
 * vérifier. Aucun composant n'est rendu ici : l'environnement DOM est inutile.
 */
import { HttpResponse, http } from "msw";
import { setupServer } from "msw/node";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";

import { estTypeConnu, natureApercu, piecesDeCategorie } from "@/lib/documents";
import { gedService } from "@/services/gedService";

/**
 * GED côté frontend : dépôt, consultation, suppression.
 *
 * Deux pièges couverts ici, qu'aucun test d'affichage n'attraperait :
 * · avec `application/json` pour type par défaut, axios 1.x convertit un FormData en JSON — le
 *   fichier ne partirait jamais ;
 * · une URL pré-signée ne doit pas recevoir notre jeton, que MinIO vérifierait à la place de la
 *   signature.
 */
const BASE = "http://localhost:8080/api/v1";
const MINIO = "http://localhost:9000";

let derniere: { url: URL; contentType: string | null; autorisation: string | null; corps: FormData | null } | null =
  null;

const serveur = setupServer(
  http.post(`${BASE}/ged/documents`, async ({ request }) => {
    const contentType = request.headers.get("content-type");
    derniere = {
      url: new URL(request.url),
      contentType,
      autorisation: request.headers.get("authorization"),
      corps: contentType?.startsWith("multipart/form-data") ? await request.formData() : null,
    };
    return HttpResponse.json({ id: 5, nomFichier: "pv.pdf" }, { status: 201 });
  }),
  http.delete(`${BASE}/ged/documents/:id`, ({ params }) =>
    params.id === "1"
      ? HttpResponse.json({ id: 1, estSupprime: true }, { status: 200 })
      : HttpResponse.json({ id: 9, documentId: 2, statut: "EN_ATTENTE" }, { status: 202 }),
  ),
  http.get(`${MINIO}/audiences-app/dossiers/7/pv.pdf`, ({ request }) => {
    derniere = { url: new URL(request.url), contentType: null, autorisation: request.headers.get("authorization"), corps: null };
    return new HttpResponse("%PDF-1.4", { headers: { "Content-Type": "application/pdf" } });
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

describe("dépôt (#38)", () => {
  it("envoie le fichier en multipart, jamais converti en JSON", async () => {
    const fichier = new File(["contenu"], "pv.pdf", { type: "application/pdf" });

    await gedService.deposer(7, "PV_TRANSFERT", fichier);

    expect(derniere?.contentType).toMatch(/^multipart\/form-data; boundary=/);
    const envoye = derniere?.corps?.get("file");
    expect(envoye).toBeInstanceOf(File);
    expect((envoye as File).name).toBe("pv.pdf");
  });

  it("passe le dossier et le type en paramètres, comme les attend le backend", async () => {
    await gedService.deposer(7, "PV_TRANSFERT", new File(["x"], "pv.pdf"));

    expect(derniere?.url.searchParams.get("dossierId")).toBe("7");
    expect(derniere?.url.searchParams.get("typeDocument")).toBe("PV_TRANSFERT");
  });
});

describe("suppression (#40)", () => {
  it("reconnaît une suppression immédiate au statut 200", async () => {
    const resultat = await gedService.supprimer(1);
    expect(resultat.immediate).toBe(true);
  });

  it("reconnaît une demande de suppression au statut 202", async () => {
    const resultat = await gedService.supprimer(2);
    expect(resultat.immediate).toBe(false);
    if (!resultat.immediate) expect(resultat.demande.statut).toBe("EN_ATTENTE");
  });
});

describe("contenu d'un document", () => {
  it("lit l'URL pré-signée sans y joindre de jeton", async () => {
    const contenu = await gedService.recupererContenu(`${MINIO}/audiences-app/dossiers/7/pv.pdf?X-Amz-Signature=abc`);

    expect(await contenu.text()).toBe("%PDF-1.4");
    // Un en-tête Authorization ferait vérifier notre jeton à la place de la signature.
    expect(derniere?.autorisation).toBeNull();
  });
});

describe("règles des pièces", () => {
  it("appelle, pour chaque catégorie, les pièces de ses références exigées", () => {
    expect(piecesDeCategorie("RECOUVREMENT")).toEqual(["DOSSIER_CREDIT", "PV_TRANSFERT"]);
    expect(piecesDeCategorie("EXPLOITATION_LITIGES")).toEqual(["INCIDENT_COMPTE", "ELEMENT_JUSTIFICATIF"]);
  });

  it("déduit l'aperçu possible de l'extension, comme le backend en déduit le format", () => {
    expect(natureApercu("pv.PDF")).toBe("pdf");
    expect(natureApercu("scan.jpg")).toBe("image");
    expect(natureApercu("note.txt")).toBe("texte");
    // Un tableur ne s'affiche pas dans un navigateur : il se télécharge.
    expect(natureApercu("etat.xlsx")).toBeNull();
  });

  it("affiche tel quel un type déposé hors de l'interface", () => {
    expect(estTypeConnu("PV_TRANSFERT")).toBe(true);
    // La lettre de constitution est déposée par le backend sous un libellé français.
    expect(estTypeConnu("Lettre de constitution")).toBe(false);
  });
});
