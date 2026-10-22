import { fireEvent, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { MesDossiers } from "@/components/modules/portail/mes-dossiers";
import { rendre } from "../utils/rendu";

/**
 * The lawyer's view of their case files: hearings, legal department note, shared documents.
 * Documents and the note are only open to a **retained** lawyer (decided by the server); the screen
 * must say why a list is empty, since "not yet retained" is resolved differently from "no documents".
 * The internal report has no place here.
 */
const audiences = vi.fn();
const pieces = vi.fn();

vi.mock("@/hooks/usePortailAvocat", () => ({
  useAudiencesDeMonDossier: () => audiences(),
  usePiecesDeMonDossier: () => pieces(),
}));

// The selector queries the server as the user types: replaced here by a direct choice.
vi.mock("@/components/modules/portail/selecteur-dossier", () => ({
  SelecteurDossier: ({ onChangement }: { onChangement: (id: number) => void }) => (
    <button type="button" onClick={() => onChangement(3)}>
      Choisir le dossier
    </button>
  ),
}));

function audience(noteAvocat: string | null) {
  return {
    data: [
      {
        id: 11,
        datePlanifiee: "2026-10-20",
        dateTenue: null,
        juridiction: "TGI Douala",
        statut: "PLANIFIEE",
        noteAvocat,
      },
    ],
    isLoading: false,
    error: null,
  };
}

beforeEach(() => {
  audiences.mockReturnValue(audience(null));
  pieces.mockReturnValue({ data: { constitue: true, pieces: [] }, isLoading: false, error: null });
});

function choisir() {
  rendre(<MesDossiers />);
  fireEvent.click(screen.getByRole("button", { name: "Choisir le dossier" }));
}

describe("les pièces du dossier", () => {
  it("rien ne s'affiche tant qu'aucun dossier n'est choisi", () => {
    rendre(<MesDossiers />);
    expect(screen.queryByText("Pièces du dossier")).not.toBeInTheDocument();
  });

  /** "Not yet retained" is resolved by a signature, not by a request to the legal officer. */
  it("non constitué : la raison est dite, et non « aucune pièce »", () => {
    pieces.mockReturnValue({ data: { constitue: false, pieces: [] }, isLoading: false, error: null });
    choisir();

    expect(screen.getByText("Pas encore constitué")).toBeInTheDocument();
    expect(screen.getByText(/une fois votre lettre de constitution signée/)).toBeInTheDocument();
    expect(screen.queryByText("Aucune pièce partagée")).not.toBeInTheDocument();
  });

  it("constitué sans pièce partagée : l'absence est dite", () => {
    choisir();
    expect(screen.getByText("Aucune pièce partagée")).toBeInTheDocument();
  });

  it("constitué : chaque pièce partagée se consulte et se télécharge", () => {
    pieces.mockReturnValue({
      data: {
        constitue: true,
        pieces: [
          { id: 7, nomFichier: "assignation.pdf", typeDocument: "AUTRE", format: "PDF", poids: 1024, partageLe: "2026-10-15T09:00:00" },
        ],
      },
      isLoading: false,
      error: null,
    });
    choisir();

    expect(screen.getByText("assignation.pdf")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Consulter - assignation.pdf" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Télécharger - assignation.pdf" })).toBeInTheDocument();
  });
});

describe("la note de la Direction Juridique", () => {
  it("se lit sur la ligne de son audience, retours à la ligne compris", () => {
    audiences.mockReturnValue(audience("Apportez l'original de l'acte.\nArrivez à 8 h."));
    choisir();

    const note = screen.getByText(/Apportez l'original de l'acte/);
    expect(note).toHaveClass("whitespace-pre-wrap");
    expect(screen.getByText("TGI Douala")).toBeInTheDocument();
  });

  /** The server returns a null note until the lawyer is retained: the screen makes nothing up. */
  it("absente, elle ne laisse qu'un tiret", () => {
    choisir();
    expect(screen.getByRole("columnheader", { name: "Note de la Direction Juridique" })).toBeInTheDocument();
    expect(screen.queryByText(/Apportez/)).not.toBeInTheDocument();
  });
});
