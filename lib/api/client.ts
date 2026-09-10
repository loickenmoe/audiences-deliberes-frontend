import axios, { type AxiosInstance, type InternalAxiosRequestConfig } from "axios";

import { getEnv } from "@/lib/env";
import { normaliserErreur } from "@/lib/api/errors";

/**
 * Client HTTP unique de l'application.
 *
 * Jalon F1 : transport et normalisation des erreurs.
 * Jalon F2 : l'injection du jeton Keycloak se branchera via {@link definirFournisseurDeJeton}, sans
 * toucher au reste du fichier. Deux chemins coexisteront — `auth()` côté serveur, la session côté
 * navigateur — d'où l'indirection par fonction plutôt qu'une lecture directe de la session ici.
 */

type FournisseurDeJeton = () => Promise<string | null>;

let fournisseurDeJeton: FournisseurDeJeton = async () => null;

/** Branché au jalon F2. Permet aussi aux tests d'injecter un jeton déterministe. */
export function definirFournisseurDeJeton(fournisseur: FournisseurDeJeton): void {
  fournisseurDeJeton = fournisseur;
}

export const apiClient: AxiosInstance = axios.create({
  headers: {
    "Content-Type": "application/json",
    Accept: "application/json",
  },
});

/**
 * `baseURL` est résolue à chaque requête, pas à la création du module : la validation
 * d'environnement doit pouvoir échouer au premier appel réel plutôt qu'à l'import, ce qui
 * rendrait les tests unitaires dépendants d'une configuration complète.
 */
apiClient.interceptors.request.use(async (config: InternalAxiosRequestConfig) => {
  config.baseURL ??= getEnv().NEXT_PUBLIC_API_URL;

  const jeton = await fournisseurDeJeton();
  if (jeton) {
    config.headers.set("Authorization", `Bearer ${jeton}`);
  }

  return config;
});

/**
 * Toute défaillance ressort en {@link ErreurApi}. Aucune redirection n'est déclenchée ici : le
 * projet de référence renvoyait vers `/login` depuis l'intercepteur, ce qui rend les erreurs
 * intestables et court-circuite la gestion d'état des écrans. La décision de rediriger appartient
 * aux gardes de route (F2).
 */
apiClient.interceptors.response.use(
  (reponse) => reponse,
  async (erreur) => Promise.reject(normaliserErreur(await relireCorpsBinaire(erreur))),
);

/**
 * Une requête demandée en binaire (`responseType: "blob"`, pour un export PDF ou Excel) reçoit
 * **aussi** ses erreurs en binaire : un `Blob` dans un navigateur, un tampon ou un texte sous Node.
 * `normaliserErreur` étant synchrone, il ne pouvait pas le lire, et retombait sur le message
 * générique du statut — le message du backend était perdu. On le relit ici, une fois pour tous les
 * téléchargements de l'application.
 */
async function relireCorpsBinaire(erreur: unknown): Promise<unknown> {
  const reponse = (erreur as { response?: { data?: unknown } } | null)?.response;
  if (!reponse) return erreur;
  const donnees = reponse.data;
  let texte: string | null = null;
  if (typeof Blob !== "undefined" && donnees instanceof Blob) texte = await donnees.text();
  else if (donnees instanceof ArrayBuffer) texte = new TextDecoder().decode(donnees);
  else if (ArrayBuffer.isView(donnees)) texte = new TextDecoder().decode(donnees);
  else if (typeof donnees === "string") texte = donnees;
  if (texte !== null) {
    try {
      reponse.data = JSON.parse(texte);
    } catch {
      // Pas du JSON (page d'erreur d'un proxy, par exemple) : le statut suffira à qualifier l'erreur.
    }
  }
  return erreur;
}

/** Enveloppe de pagination du backend — `{content, totalPages, totalElements}`, sans écho de page. */
export interface PageReponse<T> {
  content: T[];
  totalPages: number;
  totalElements: number;
}
