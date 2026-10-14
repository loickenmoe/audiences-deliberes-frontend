import { screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { EspaceAvocat } from "@/components/modules/portail/espace-avocat";
import type { Publication } from "@/types/domaine";
import { rendre } from "../utils/rendu";

/**
 * La correspondance lue par l'avocat sur son espace (QF-58, signalé en recette le 2026-10-14).
 *
 * **Le défaut que ces tests protègent.** Quand le DJ ou la DJA transmet une correspondance sur une
 * publication, l'avocat en est notifié deux fois - une alerte et une notification prestataire. Mais
 * aucun écran ne l'affichait : une notification qui renvoie vers une page muette dit qu'il y a
 * quelque chose à lire sans le donner.
 *
 * **Et la règle que le dernier test garde.** Les commentaires des juristes ne sont pas pour lui. Le
 * juriste ne s'adresse jamais directement à l'avocat (Q-20, US 5.5, RG-INT-07) : il écrit pour le
 * DJ/DJA, qui tranche et transmet. Le backend les tient hors de la charge utile du portail ; si un
 * jour ils y entraient, cet écran ne doit toujours pas les montrer.
 */
/*
 * L'écran lit la page courante dans l'URL : sans routeur monté, `useFiltresUrl` échoue avant tout
 * rendu. Même mise en place que `explications.test.tsx`.
 */
vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace: vi.fn(), push: vi.fn() }),
  usePathname: () => "/portail",
  useSearchParams: () => new URLSearchParams(),
}));

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
    // Une lettre sans signature n'en est pas une : l'avocat doit savoir à qui il répond.
    const signature = screen.getByText(/Transmise par Loïc Kenmoe/);
    expect(signature).toBeInTheDocument();
    // La date est portée par l'attribut machine : le format affiché suit la langue, pas ce test.
    expect(signature.querySelector("time")).toHaveAttribute("datetime", "2026-10-14T09:00:00");
  });

  /**
   * Le message est saisi dans une zone de texte : ses retours à la ligne font partie de ce que la
   * Direction Juridique a écrit. Les aplatir changerait le texte reçu.
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
   * L'absence se dit. Une cellule vide laisserait croire à un affichage incomplet là où il n'y a
   * simplement rien à lire : la plupart des publications n'appellent aucune correspondance.
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

  /** Chaque publication porte la sienne : aucune ne doit hériter de celle d'une autre. */
  it("rattache chaque correspondance à sa propre publication", () => {
    afficher(
      publication({ id: 44, correspondance: CORRESPONDANCE }),
      publication({ id: 45, referenceDossier: "DOS-2026-004" }),
    );

    expect(screen.getByText("Merci de préciser la date de l'audience.")).toBeInTheDocument();
    expect(screen.getByText("Aucune")).toBeInTheDocument();
  });

  /**
   * **RG-INT-07.** Si un commentaire interne arrivait jusqu'ici - par un contrat élargi, par une
   * erreur de mapping -, l'écran ne doit pas le montrer. La délibération entre le juriste et le
   * DJ/DJA ne s'adresse pas à celui dont elle discute.
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
