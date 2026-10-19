import { screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { OngletAudiences } from "@/components/modules/dossiers/onglet-audiences";
import type { Audience, Dossier, Publication } from "@/types/domaine";
import { rendre } from "../utils/rendu";

/**
 * The lawyer's report, linked to its hearing. It lives in publications, linked to the hearing but
 * not stored on it: the tab must show it next to the legal officer's account.
 */
const audiences = vi.fn();
const publications = vi.fn();

vi.mock("@/hooks/useAudiences", () => ({
  useAudiencesDossier: () => audiences(),
  usePlanifierAudience: () => ({ mutateAsync: vi.fn(), isPending: false }),
  useEnregistrerCompteRendu: () => ({ mutateAsync: vi.fn(), isPending: false }),
  useAnnulerAudience: () => ({ mutateAsync: vi.fn(), isPending: false }),
  // The note to the lawyer, mounted for whoever may write it.
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

  /** Without a lawyer submission nothing is announced: the screen does not promise a missing document. */
  it("n'annonce rien quand l'avocat n'a pas déposé", () => {
    rendre(<OngletAudiences dossier={DOSSIER} roles={["ROLE_ASSISTANTE", "ROLE_CONSULTATION"]} />);

    expect(screen.queryByRole("link", { name: "Compte rendu de l’avocat" })).not.toBeInTheDocument();
  });

  /**
   * A submission pending validation is readable by no legal officer. The filter is on the request:
   * the component asks for validated ones only.
   */
  it("ne demande que les publications validées", () => {
    rendre(<OngletAudiences dossier={DOSSIER} roles={["ROLE_JURISTE", "ROLE_CONSULTATION"]} />);

    expect(publications).toHaveBeenCalledWith(true);
  });

  /**
   * The "Hearings" tab is open to all internal profiles, the publication list is not: without this
   * guard, SH would get a 403 on a screen it is allowed to see.
   */
  it("n'interroge pas les publications pour un profil qui n'y a pas droit", () => {
    rendre(<OngletAudiences dossier={DOSSIER} roles={["ROLE_SH", "ROLE_CONSULTATION"]} />);

    expect(publications).toHaveBeenCalledWith(false);
  });
});
