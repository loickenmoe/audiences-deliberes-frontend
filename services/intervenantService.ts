import { TAILLE_PAGE } from "@/hooks/const";
import { apiClient, type PageReponse } from "@/lib/api/client";
import type { CreerIntervenant, Intervenant, ModifierIntervenant } from "@/types/domaine";
import type { TypeIntervenant } from "@/types/enums";

/**
 * Référentiel des intervenants (#61, #62).
 *
 * Écran indispensable au démarrage : **sans avocat en base, aucun dossier ne peut être créé** —
 * `avocatsAffectes` est obligatoire à la création (`@NotEmpty`).
 *
 * Ni modification ni suppression : le backend ne les expose pas, les user stories ne les demandent
 * pas.
 */
const BASE = "/intervenants";

export const intervenantService = {
  /**
   * #62 — `ROLE_CONSULTATION`. Sans filtre, retourne les deux types.
   *
   * **Paginé et cherchable depuis Q-100/Q-105.** `nom` porte la recherche au fil de la frappe des
   * sélecteurs : ils n'ont plus besoin de détenir tout l'annuaire pour laisser choisir.
   */
  lister: async (params: {
    type?: TypeIntervenant;
    nom?: string;
    page?: number;
    size?: number;
  } = {}): Promise<PageReponse<Intervenant>> => {
    const { data } = await apiClient.get<PageReponse<Intervenant>>(BASE, {
      params: {
        ...(params.type ? { type: params.type } : {}),
        ...(params.nom ? { nom: params.nom } : {}),
        page: params.page ?? 0,
        size: params.size ?? TAILLE_PAGE,
      },
    });
    return data;
  },

  /** #61 — `ROLE_DJ`, `ROLE_DJA`. Voir les invariants sur {@link CreerIntervenant}. */
  creer: async (corps: CreerIntervenant): Promise<Intervenant> => {
    const { data } = await apiClient.post<Intervenant>(BASE, corps);
    return data;
  },

  /**
   * 🆕 `PUT /intervenants/{id}` (Q-117) — `ROLE_DJ`, `ROLE_DJA`. Le type et l'identifiant de connexion
   * sont figés : seuls le nom, les coordonnées et la notification se corrigent.
   */
  modifier: async (id: number, corps: ModifierIntervenant): Promise<Intervenant> => {
    const { data } = await apiClient.put<Intervenant>(`${BASE}/${id}`, corps);
    return data;
  },
};
