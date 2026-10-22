import { screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { EspaceAvocat } from "@/components/modules/portail/espace-avocat";
import type { Publication } from "@/types/domaine";
import { rendre } from "../utils/rendu";

/**
 * Correspondence read by the lawyer in their portal. When the DJ or DJA forwards correspondence on a
 * publication, the lawyer is notified and this screen must show it.
 *
 * Legal officers' comments are not for the lawyer (US 5.5, RG-INT-07): they write for the DJ/DJA,
 * who decides and forwards. The backend keeps them out of the portal payload; this screen must not
 * show them either.
 */
/*
 * The screen reads the current page from the URL: without a mounted router, `useFiltresUrl` fails
 * before rendering. Same setup as `explications.test.tsx`.
 */
vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace: vi.fn(), push: vi.fn() }),
  usePathname: () => "/portail",
  useSearchParams: () => new URLSearchParams(),
}));

/*
 * The "My case files" section has its own tests: it is stubbed here, this file covering only
 * correspondence.
 */
vi.mock("@/components/modules/portail/mes-dossiers", () => ({ MesDossiers: () => null }));

const publications = vi.fn();
const constitutions = vi.fn();

vi.mock("@/hooks/usePortailAvocat", () => ({
  useMesPublications: () => publications(),
  useMesConstitutions: () => constitutions(),
}));

function publication(partiel: Partial<Publication> = {}): Publication {
  return {
    id: 44,
    type: "AUTRE",
    referenceDossier: "DOS-2026-003",
    dateDepot: "2026-10-10T09:00:00",
    statutValidation: "DEPOSE",
    motifRejet: null,
    commentaires: null,
    correspondance: null,
    ...partiel,
  } as Publication;
}

const CORRESPONDANCE = {
  id: 50,
  publicationId: 44,
  auteurId: 30,
  auteurNom: "Loïc Kenmoe",
  contenu: "Merci de préciser la date de l'audience.",
  createdAt: "2026-10-14T09:00:00",
};

function afficher(...contenu: Publication[]) {
  publications.mockReturnValue({
    data: { content: contenu, totalPages: 1, totalElements: contenu.length },
    isLoading: false,
    error: null,
    refetch: vi.fn(),
  });
  return rendre(<EspaceAvocat />);
}

beforeEach(() => {
  constitutions.mockReturnValue({ data: [], isLoading: false, error: null });
});

describe("la correspondance sur l'espace de l'avocat", () => {
  it("affiche le message transmis, son auteur et sa date", () => {
    afficher(publication({ correspondance: CORRESPONDANCE }));

    expect(screen.getByText("Merci de préciser la date de l'audience.")).toBeInTheDocument();
    // A letter without a signature is not one: the lawyer must know who they are answering.
    const signature = screen.getByText(/Transmise par Loïc Kenmoe/);
    expect(signature).toBeInTheDocument();
    // The date is checked on the machine-readable attribute: the displayed format follows the locale.
    expect(signature.querySelector("time")).toHaveAttribute("datetime", "2026-10-14T09:00:00");
  });

  /**
   * The message is typed in a text area: its line breaks are part of what the legal department
   * wrote. Flattening them would change the text.
   */
  it("conserve les retours à la ligne du message", () => {
    afficher(
      publication({
        correspondance: { ...CORRESPONDANCE, contenu: "Premier point.\nSecond point." },
      }),
    );

    expect(screen.getByText(/Premier point/)).toHaveClass("whitespace-pre-wrap");
  });

  /**
   * Absence is stated: an empty cell would look like an incomplete display, while most publications
   * simply have no correspondence.
   */
  it("dit l'absence de correspondance plutôt que de laisser un vide", () => {
    afficher(publication());

    expect(screen.getByText("Aucune")).toBeInTheDocument();
  });

  it("nomme la colonne dans l'en-tête du tableau", () => {
    afficher(publication({ correspondance: CORRESPONDANCE }));

    expect(
      screen.getByRole("columnheader", { name: "Correspondance de la Direction Juridique" }),
    ).toBeInTheDocument();
  });

  /** Each publication carries its own: none inherits another's. */
  it("rattache chaque correspondance à sa propre publication", () => {
    afficher(
      publication({ id: 44, correspondance: CORRESPONDANCE }),
      publication({ id: 45, referenceDossier: "DOS-2026-004" }),
    );

    expect(screen.getByText("Merci de préciser la date de l'audience.")).toBeInTheDocument();
    expect(screen.getByText("Aucune")).toBeInTheDocument();
  });

  /**
   * **RG-INT-07.** If an internal comment ever reached this screen (wider contract, mapping error),
   * it must not be shown: the discussion between the legal officer and the DJ/DJA is not for the lawyer.
   */
  it("ne montre jamais les commentaires internes des juristes", () => {
    afficher(
      publication({
        correspondance: CORRESPONDANCE,
        commentaires: [
          {
            id: 1,
            publicationId: 44,
            auteurId: 12,
            auteurNom: "Juriste Test",
            contenu: "Le compte rendu me paraît incomplet, à rejeter.",
            createdAt: "2026-10-13T09:00:00",
          },
        ],
      }),
    );

    expect(screen.queryByText(/Le compte rendu me paraît incomplet/)).not.toBeInTheDocument();
    expect(screen.queryByText(/Juriste Test/)).not.toBeInTheDocument();
  });
});
