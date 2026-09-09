import { apiClient } from "@/lib/api/client";
import type { CreerIntervenant, Intervenant } from "@/types/domaine";
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
  /** #62 — `ROLE_CONSULTATION`. Sans filtre, retourne les deux types. */
  lister: async (type?: TypeIntervenant): Promise<Intervenant[]> => {
    const { data } = await apiClient.get<Intervenant[]>(BASE, { params: type ? { type } : {} });
    return data;
  },

  /** #61 — `ROLE_DJ`, `ROLE_DJA`. Voir les invariants sur {@link CreerIntervenant}. */
  creer: async (corps: CreerIntervenant): Promise<Intervenant> => {
    const { data } = await apiClient.post<Intervenant>(BASE, corps);
    return data;
  },
};
