import { apiClient, type PageReponse } from "@/lib/api/client";
import type { CreerDossier, Dossier, FiltresDossiers } from "@/types/domaine";

/**
 * Dossiers (#1, #2, #3) — miroir 1:1 des endpoints, sans logique métier.
 *
 * Les règles de cohérence (catégorie déduite de la nature, champs conditionnels, dossier sensible)
 * sont portées par le backend. Le formulaire les rejoue en amont pour éviter un aller-retour, mais
 * c'est le backend qui arbitre : ce service ne décide de rien.
 */
export const dossierService = {
  /**
   * #2 — liste paginée.
   *
   * `reference`, `clientId` et `mesDossiers` ont été ajoutés au backend en M16 (QF-07) : sans eux,
   * un juriste ne pouvait retrouver un dossier qu'en parcourant les pages. Filtrer côté navigateur
   * n'était pas une option — sur une liste paginée, la recherche n'aurait porté que sur la page
   * affichée et aurait donc menti.
   */
  lister: async (filtres: FiltresDossiers = {}): Promise<PageReponse<Dossier>> => {
    const { data } = await apiClient.get<PageReponse<Dossier>>("/dossiers", {
      params: {
        nature: filtres.nature || undefined,
        categorie: filtres.categorie || undefined,
        juridiction: filtres.juridiction || undefined,
        reference: filtres.reference || undefined,
        clientId: filtres.clientId ?? undefined,
        // `false` est le défaut du backend : ne pas l'envoyer garde l'URL lisible.
        mesDossiers: filtres.mesDossiers ? true : undefined,
        page: filtres.page ?? 0,
        size: filtres.size ?? 20,
      },
    });
    return data;
  },

  /** #3 */
  consulter: async (id: number): Promise<Dossier> => {
    const { data } = await apiClient.get<Dossier>(`/dossiers/${id}`);
    return data;
  },

  /**
   * #1 — création. Exige `ROLE_SAISIE`.
   *
   * `categorie` n'est délibérément pas transmise : le backend la déduit de `nature` (RG-DOS-02) et
   * refuse une valeur divergente. L'envoyer n'apporterait qu'un risque d'incohérence.
   */
  creer: async (dossier: CreerDossier): Promise<Dossier> => {
    const { data } = await apiClient.post<Dossier>("/dossiers", dossier);
    return data;
  },
};
