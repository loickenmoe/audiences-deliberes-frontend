import { screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { OngletAudiences } from "@/components/modules/dossiers/onglet-audiences";
import type { Audience, Dossier, Publication } from "@/types/domaine";
import { rendre } from "../utils/rendu";

/**
 * Le compte rendu de l'avocat, rattaché à son audience (signalé en recette, 2026-09-28).
 *
 * **Ce que ces tests protègent.** Le compte rendu de l'avocat vit dans les publications, rattaché à
 * l'audience mais pas porté par elle : l'onglet n'affichait donc que le récit du juriste, et une
 * audience dont l'avocat avait rendu compte paraissait muette. Personne ne savait où chercher.
 */
const audiences = vi.fn();
const publications = vi.fn();

vi.mock("@/hooks/useAudiences", () => ({
  useAudiencesDossier: () => audiences(),
  usePlanifierAudience: () => ({ mutateAsync: vi.fn(), isPending: false }),
  useEnregistrerCompteRendu: () => ({ mutateAsync: vi.fn(), isPending: false }),
  useAnnulerAudience: () => ({ mutateAsync: vi.fn(), isPending: false }),
  // QF-64 : la note à l’avocat, montée pour qui peut l’écrire.
  useModifierNoteAvocat: () => ({ mutateAsync: vi.fn(), isPending: false }),
}));

vi.mock("@/hooks/usePublications", () => ({
  usePublications: (_filtres: unknown, actif = true) => publications(actif),
}));

const DOSSIER = {
  id: 3,
  reference: "DOS-2026-003",
  createdAt: "2026-01-05T09:00:00",
  etapes: [{ id: 5, type: "INSTANCE", statutCycleVie: "EN_COURS" }],
} as unknown as Dossier;

function audience(partiel: Partial<Audience> = {}): Audience {
  return {
    id: 11,
    dossierId: 3,
    etapeId: 5,
    datePlanifiee: "2026-09-20",
    dateTenue: null,
    compteRendu: null,
    statut: "PLANIFIEE",
    createdAt: "2026-09-01T09:00:00",
    motifAnnulation: null,
    dateAnnulation: null,
    ...partiel,
  } as Audience;
}

function compteRenduAvocat(partiel: Partial<Publication> = {}): Publication {
  return {
    id: 44,
    type: "CR_AUDIENCE",
    audienceId: 11,
    statutValidation: "VALIDE",
    contenu: "Affaire renvoyée au mois prochain",
    audienceDate: "2026-09-20",
    ...partiel,
  } as Publication;
}

beforeEach(() => {
  audiences.mockReturnValue({
    data: { content: [audience()], totalPages: 1, totalElements: 1 },
    isLoading: false,
    error: null,
  });
  publications.mockReturnValue({ data: { content: [], totalPages: 0, totalElements: 0 } });
});

describe("compte rendu de l'avocat sur l'audience", () => {
  it("signale le compte rendu de l'avocat sur la ligne de son audience", () => {
    publications.mockReturnValue({
      data: { content: [compteRenduAvocat()], totalPages: 1, totalElements: 1 },
    });

    rendre(<OngletAudiences dossier={DOSSIER} roles={["ROLE_ASSISTANTE", "ROLE_CONSULTATION"]} />);

    const lien = screen.getByRole("link", { name: "Compte rendu de l’avocat" });
    expect(lien).toHaveAttribute("href", "/publications/44");
  });

  /** Sans dépôt de l'avocat, rien n'est annoncé : l'écran ne promet pas un document absent. */
  it("n'annonce rien quand l'avocat n'a pas déposé", () => {
    rendre(<OngletAudiences dossier={DOSSIER} roles={["ROLE_ASSISTANTE", "ROLE_CONSULTATION"]} />);

    expect(screen.queryByRole("link", { name: "Compte rendu de l’avocat" })).not.toBeInTheDocument();
  });

  /**
   * Un dépôt en attente de validation n'est lisible d'aucun juriste : le rattacher ferait croire à
   * une information disponible. Le filtre porte sur la requête — le composant demande les validées.
   */
  it("ne demande que les publications validées", () => {
    rendre(<OngletAudiences dossier={DOSSIER} roles={["ROLE_JURISTE", "ROLE_CONSULTATION"]} />);

    expect(publications).toHaveBeenCalledWith(true);
  });

  /**
   * L'onglet « Audiences » est ouvert à tous les profils internes, la liste des publications ne
   * l'est pas : sans ce garde-fou, le SH recevrait un 403 sur un écran qui lui est permis.
   */
  it("n'interroge pas les publications pour un profil qui n'y a pas droit", () => {
    rendre(<OngletAudiences dossier={DOSSIER} roles={["ROLE_SH", "ROLE_CONSULTATION"]} />);

    expect(publications).toHaveBeenCalledWith(false);
  });
});
