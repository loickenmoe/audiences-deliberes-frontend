import { TAILLE_SELECTEUR } from "@/hooks/const";
import { apiClient, type PageReponse } from "@/lib/api/client";
import type {
  Agence,
  AgenceEcriture,
  NatureDossier,
  TypeClientSensible,
  Utilisateur,
} from "@/types/domaine";
import type { CategorieDossier } from "@/types/enums";

/**
 * Référentiels de formulaire, annuaire interne (#64, #65, #66) et référentiel des agences.
 *
 * Les listes `naturesDossier`, `typesClientSensible` et `utilisateurs` sont **fermées, petites et
 * stables** : elles se chargent une fois par session en cache long, et servent aussi à résoudre les
 * identifiants numériques que le backend renvoie sans libellé (cf. `hooks/useLibelles.ts`). Elles
 * restent en lecture seule - administrées par le DJ directement en base (CONF02) - et Keycloak
 * reste la source de vérité des identités.
 *
 * Les **agences** font exception sur les deux points : elles sont paginées et cherchées côté
 * serveur (82 entrées, recherche au fil de la frappe demandée par le métier), et elles s'écrivent
 * depuis l'application, par le DJ ou la DJA. Le code d'agence engage les dossiers qui le portent :
 * il n'est plus question de le saisir à la main.
 */
export const referentielService = {
  /**
   * Agences de la banque (métier, 2026-10-03, observation 2).
   *
   * **Paginée et cherchée côté serveur**, contrairement aux trois listes ci-dessous : 82 agences ne
   * tiennent pas dans une liste déroulante lisible, et le métier a demandé la recherche au fil de
   * la frappe - « si on commence par entrer le nom d'une agence, l'app nous renvoie progressivement
   * les agences avec ces noms ». La recherche porte sur le **code** et sur le **nom**.
   *
   * `actifSeulement` vaut vrai par défaut : la saisie ne propose que les agences ouvertes. Seul
   * l'écran d'administration demande tout.
   */
  agences: async (params?: {
    recherche?: string;
    actifSeulement?: boolean;
    page?: number;
    size?: number;
  }): Promise<PageReponse<Agence>> => {
    const { data } = await apiClient.get<PageReponse<Agence>>("/referentiels/agences", {
      params: { ...(params ?? {}), size: params?.size ?? TAILLE_SELECTEUR },
    });
    return data;
  },

  /** `ROLE_DJ` ou `ROLE_DJA` : le code engage les dossiers qui le portent. */
  creerAgence: async (corps: AgenceEcriture): Promise<Agence> => {
    const { data } = await apiClient.post<Agence>("/referentiels/agences", corps);
    return data;
  },

  /**
   * `ROLE_DJ` ou `ROLE_DJA`. Le **code ne se modifie pas** : les dossiers le portent en clair, sans
   * clé étrangère, et le changer les détacherait silencieusement de leur agence. Le backend refuse
   * un code différent de celui enregistré.
   */
  modifierAgence: async (id: number, corps: AgenceEcriture): Promise<Agence> => {
    const { data } = await apiClient.put<Agence>(`/referentiels/agences/${id}`, corps);
    return data;
  },

  /**
   * **Désactive, ne supprime pas** - malgré le verbe HTTP. Un dossier ouvert sous une agence fermée
   * reste un dossier valide, et son code doit continuer de désigner quelque chose. La fermeture est
   * réversible : cf. `reactiverAgence`.
   */
  desactiverAgence: async (id: number): Promise<Agence> => {
    const { data } = await apiClient.delete<Agence>(`/referentiels/agences/${id}`);
    return data;
  },

  /**
   * Rouvre une agence fermée (métier, 2026-10-06). `ROLE_DJ` ou `ROLE_DJA`.
   *
   * `PATCH` et non `PUT` : on ne remplace pas l'agence, on change son seul état d'ouverture. Le
   * **code est conservé** - c'est la même agence qui rouvre, et les dossiers ouverts sous elle
   * n'ont jamais cessé de le désigner.
   */
  reactiverAgence: async (id: number): Promise<Agence> => {
    const { data } = await apiClient.patch<Agence>(`/referentiels/agences/${id}/reactivation`);
    return data;
  },

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
