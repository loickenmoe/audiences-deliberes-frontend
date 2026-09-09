import { apiClient } from "@/lib/api/client";
import type { NatureDossier, TypeClientSensible, Utilisateur } from "@/types/domaine";
import type { CategorieDossier } from "@/types/enums";

/**
 * Référentiels de formulaire et annuaire interne (#64, #65, #66).
 *
 * Ces trois listes sont **fermées, petites et stables** : elles se chargent une fois par session en
 * cache long, et servent aussi à résoudre les identifiants numériques que le backend renvoie sans
 * libellé (cf. `hooks/useLibelles.ts`).
 *
 * Toutes sont en lecture seule : les référentiels sont administrés par le DJ directement en base
 * (CONF02), et Keycloak reste la source de vérité des identités.
 */
export const referentielService = {
  /** #64 — filtrable par catégorie ; seules les entrées actives sont retournées. */
  naturesDossier: async (categorie?: CategorieDossier): Promise<NatureDossier[]> => {
    const { data } = await apiClient.get<NatureDossier[]>("/referentiels/natures-dossier", {
      params: categorie ? { categorie } : {},
    });
    return data;
  },

  /** #65 */
  typesClientSensible: async (): Promise<TypeClientSensible[]> => {
    const { data } = await apiClient.get<TypeClientSensible[]>(
      "/referentiels/types-client-sensible",
    );
    return data;
  },

  /**
   * #66 — annuaire interne. `ROLE_CONSULTATION` : **l'avocat en est exclu par conception**, il ne
   * doit pas énumérer le personnel. Comptes actifs seuls par défaut.
   *
   * ⚠ Un utilisateur n'y figure qu'**après sa première connexion** (QF-16, provisionnement
   * paresseux) : la liste n'est pas l'annuaire de la Direction Juridique, c'est celui des comptes
   * déjà utilisés.
   */
  utilisateurs: async (params?: {
    profil?: string;
    inclureInactifs?: boolean;
  }): Promise<Utilisateur[]> => {
    const { data } = await apiClient.get<Utilisateur[]>("/utilisateurs", { params: params ?? {} });
    return data;
  },
};
