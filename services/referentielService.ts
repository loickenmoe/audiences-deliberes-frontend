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
 * Form reference data, internal directory (#64, #65, #66) and bank branches.
 * `naturesDossier`, `typesClientSensible` and `utilisateurs` are small, stable, read-only lists
 * (administered in the database, CONF02), cached long and also used to resolve numeric ids
 * (see `hooks/useLibelles.ts`). Keycloak remains the source of truth for identities.
 * Branches are the exception: paginated, searched server-side and editable by the DJ or DJA.
 */
export const referentielService = {
  /**
   * Bank branches, paginated and searched server-side (search-as-you-type on code and name).
   * `actifSeulement` defaults to true so input only offers open branches; only the admin screen
   * requests all.
   */
  agences: async (params?: {
    recherche?: string;
    actifSeulement?: boolean;
    page?: number;
    size?: number;
  }): Promise<PageReponse<Agence>> => {
    const { data } = await apiClient.get<PageReponse<Agence>>("/referentiels/agences", {
      params: { ...params, size: params?.size ?? TAILLE_SELECTEUR },
    });
    return data;
  },

  /** `ROLE_DJ` or `ROLE_DJA`, since the code is referenced by cases. */
  creerAgence: async (corps: AgenceEcriture): Promise<Agence> => {
    const { data } = await apiClient.post<Agence>("/referentiels/agences", corps);
    return data;
  },

  /**
   * `ROLE_DJ` or `ROLE_DJA`. The code is immutable: cases store it as plain text without a foreign
   * key, so changing it would detach them. The backend rejects a different code.
   */
  modifierAgence: async (id: number, corps: AgenceEcriture): Promise<Agence> => {
    const { data } = await apiClient.put<Agence>(`/referentiels/agences/${id}`, corps);
    return data;
  },

  /**
   * Deactivates, despite the HTTP verb, so cases opened under a closed branch still reference a
   * valid code. Reversible with `reactiverAgence`.
   */
  desactiverAgence: async (id: number): Promise<Agence> => {
    const { data } = await apiClient.delete<Agence>(`/referentiels/agences/${id}`);
    return data;
  },

  /**
   * Reopens a closed branch (`ROLE_DJ` or `ROLE_DJA`). `PATCH` because only the open state changes;
   * the code is kept.
   */
  reactiverAgence: async (id: number): Promise<Agence> => {
    const { data } = await apiClient.patch<Agence>(`/referentiels/agences/${id}/reactivation`);
    return data;
  },

  /** #64: filterable by category; only active entries are returned. */
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
   * #66: internal directory, `ROLE_CONSULTATION` (lawyers are excluded so they cannot enumerate
   * staff). Active accounts only by default. A user only appears after their first login (lazy
   * provisioning).
   */
  utilisateurs: async (params?: {
    profil?: string;
    inclureInactifs?: boolean;
  }): Promise<Utilisateur[]> => {
    const { data } = await apiClient.get<Utilisateur[]>("/utilisateurs", { params: params ?? {} });
    return data;
  },
};
