import { fireEvent, screen, waitFor, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { OngletDocuments } from "@/components/modules/dossiers/onglet-documents";
import type { DocumentDossier, StatutPartageAvocat } from "@/types/domaine";
import { rendre } from "../utils/rendu";

/**
 * Le partage d'une pièce avec l'avocat, depuis l'onglet Documents (QF-64, backend Q-139).
 *
 * **Les règles arbitrées le 2026-10-15, telles que l'écran doit les annoncer.** Tout juriste
 * partage ; sur un dossier **sensible**, son geste devient une **proposition** que le DJ ou la DJA
 * valide. L'écran ne décide rien - le serveur le fait - mais il doit proposer le bon geste, sous le
 * bon nom : un juriste qui lirait « Partager » sur un dossier sensible croirait la pièce partie.
 */
const documents = vi.fn();
const partager = vi.fn();
const retirer = vi.fn();
const arbitrer = vi.fn();
/** QF-65 : un avocat affecté est-il constitué ? Par défaut oui, pour que le bandeau reste muet. */
const etat = vi.fn();

vi.mock("@/hooks/useDossiers", () => ({
  useDocumentsDossier: () => documents(),
  useSupprimerDocument: () => ({ mutateAsync: vi.fn(), isPending: false }),
  useDeposerDocument: () => ({ mutateAsync: vi.fn(), isPending: false }),
}));

vi.mock("@/hooks/useGed", () => ({
  usePartagerDocument: () => ({ mutateAsync: partager, isPending: false }),
  useRetirerPartage: () => ({ mutateAsync: retirer, isPending: false }),
  useArbitrerPartage: () => ({ mutateAsync: arbitrer, isPending: false }),
  useEtatPartageDossier: () => etat(),
}));

vi.mock("@/hooks/useLibelles", () => ({
  useLibelles: () => ({ nomUtilisateur: () => "Juriste Test" }),
}));

const JURISTE = ["ROLE_JURISTE", "ROLE_SAISIE", "ROLE_CONSULTATION"];
const DJ = ["ROLE_DJ", "ROLE_JURISTE", "ROLE_SAISIE", "ROLE_CONSULTATION"];
const ASSISTANTE = ["ROLE_ASSISTANTE", "ROLE_SAISIE", "ROLE_CONSULTATION"];
const SH = ["ROLE_SH", "ROLE_SAISIE", "ROLE_CONSULTATION"];

function piece(partageAvocat: StatutPartageAvocat): DocumentDossier {
  return {
    id: 7,
    dossierId: 3,
    nomFichier: "assignation.pdf",
    typeDocument: "AUTRE",
    format: "PDF",
    poids: 1024,
    auteurChargementId: 10,
    dateChargement: "2026-10-15T09:00:00",
    estSupprime: false,
    urlTelechargement: null,
    partageAvocat,
  } as DocumentDossier;
}

function afficher(roles: string[], statut: StatutPartageAvocat, sensible = false) {
  documents.mockReturnValue({
    data: { content: [piece(statut)], totalPages: 1, totalElements: 1 },
    isLoading: false,
    error: null,
  });
  return rendre(<OngletDocuments dossierId={3} roles={roles} sensible={sensible} />);
}

beforeEach(() => {
  etat.mockReturnValue({ data: { avocatConstitue: true } });
  partager.mockReset();
  retirer.mockReset();
  arbitrer.mockReset();
});

describe("l'état du partage se lit sur chaque pièce", () => {
  it.each([
    ["NON", "Non partagé"],
    ["PROPOSE", "En attente de validation"],
    ["PARTAGE", "Partagé"],
  ] as const)("%s s'affiche « %s »", (statut, libelle) => {
    afficher(JURISTE, statut);
    expect(screen.getByText(libelle)).toBeInTheDocument();
  });
});

describe("le juriste partage, ou propose sur un dossier sensible", () => {
  it("dossier ordinaire : il partage", () => {
    afficher(JURISTE, "NON");
    expect(screen.getByRole("button", { name: "Partager avec l'avocat - assignation.pdf" })).toBeInTheDocument();
  });

  /**
   * <b>La règle du dossier sensible, vue de l'écran.</b> Le geste du juriste ne partage pas : il
   * propose. Le nommer « Partager » lui ferait croire la pièce partie chez l'avocat.
   */
  it("dossier sensible : il propose, et ne lit jamais « Partager »", () => {
    afficher(JURISTE, "NON", true);
    expect(screen.getByRole("button", { name: "Proposer le partage - assignation.pdf" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /^Partager avec l'avocat/ })).not.toBeInTheDocument();
  });

  it("la proposition est confirmée avant de partir, et annoncée comme telle", async () => {
    partager.mockResolvedValue({ partageAvocat: "PROPOSE" });
    afficher(JURISTE, "NON", true);

    fireEvent.click(screen.getByRole("button", { name: "Proposer le partage - assignation.pdf" }));
    expect(partager).not.toHaveBeenCalled();
    expect(screen.getByText(/ne sera visible de l'avocat qu'après validation du DJ ou de la DJA/)).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Proposer le partage" }));
    await waitFor(() => expect(partager).toHaveBeenCalledWith(7));
  });

  /** Le DJ qui partage lui-même n'a pas à se valider : sur un dossier sensible, il partage. */
  it("le DJ partage directement, même sur un dossier sensible", () => {
    afficher(DJ, "NON", true);
    expect(screen.getByRole("button", { name: "Partager avec l'avocat - assignation.pdf" })).toBeInTheDocument();
  });

  it("une pièce partagée se retire, une proposition s'annule", () => {
    const { unmount } = afficher(JURISTE, "PARTAGE");
    expect(screen.getByRole("button", { name: "Retirer le partage - assignation.pdf" })).toBeInTheDocument();
    unmount();

    afficher(JURISTE, "PROPOSE", true);
    expect(screen.getByRole("button", { name: "Annuler la proposition - assignation.pdf" })).toBeInTheDocument();
  });
});

describe("la validation reste au DJ et à la DJA", () => {
  it("le DJ valide ou rejette une proposition", () => {
    afficher(DJ, "PROPOSE", true);
    expect(screen.getByRole("button", { name: "Valider le partage - assignation.pdf" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Rejeter - assignation.pdf" })).toBeInTheDocument();
  });

  it("le juriste ne valide pas sa propre proposition", () => {
    afficher(JURISTE, "PROPOSE", true);
    expect(screen.queryByRole("button", { name: /^Valider le partage/ })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /^Rejeter/ })).not.toBeInTheDocument();
  });

  /** Un rejet exige un motif : le juriste qui a proposé doit savoir pourquoi la pièce ne part pas. */
  it("un rejet sans motif ne part pas", async () => {
    afficher(DJ, "PROPOSE", true);
    fireEvent.click(screen.getByRole("button", { name: "Rejeter - assignation.pdf" }));
    const modale = await screen.findByRole("dialog", { name: "Rejeter ce partage" });

    fireEvent.click(within(modale).getByRole("button", { name: "Rejeter" }));

    expect(arbitrer).not.toHaveBeenCalled();
    expect(within(modale).getByText(/obligatoire/i)).toBeInTheDocument();
  });
});

/**
 * **QF-65 : le SH et l'Assistante partagent**, « ils sont à la base des juristes ». Même principe
 * que le juriste : sur un dossier sensible, leur geste propose, et le DJ ou la DJA valide.
 */
describe("le SH et l'Assistante partagent comme un juriste", () => {
  it.each([
    ["l'Assistante", ASSISTANTE],
    ["le SH", SH],
  ])("%s partage un dossier ordinaire, et propose un dossier sensible", (_, roles) => {
    const { unmount } = afficher(roles, "NON");
    expect(screen.getByRole("button", { name: "Partager avec l'avocat - assignation.pdf" })).toBeInTheDocument();
    unmount();

    afficher(roles, "NON", true);
    expect(screen.getByRole("button", { name: "Proposer le partage - assignation.pdf" })).toBeInTheDocument();
    // Et la validation reste à la direction.
    expect(screen.queryByRole("button", { name: /^Valider le partage/ })).not.toBeInTheDocument();
  });
});

/**
 * **QF-65 : l'absence de constitution se dit.** Signalé en recette : le juriste partageait, lisait
 * « Partagé », et l'avocat ne voyait rien, faute de lettre signée.
 */
describe("aucun avocat constitué", () => {
  it("un bandeau le dit, au-dessus du tableau", () => {
    etat.mockReturnValue({ data: { avocatConstitue: false } });
    afficher(JURISTE, "NON");

    expect(screen.getByRole("note")).toHaveTextContent(/Aucun avocat n'est encore constitué sur ce dossier/);
  });

  it("et la confirmation du partage le répète, là où la décision se prend", () => {
    etat.mockReturnValue({ data: { avocatConstitue: false } });
    afficher(JURISTE, "NON");

    fireEvent.click(screen.getByRole("button", { name: "Partager avec l'avocat - assignation.pdf" }));
    expect(
      screen.getByText(/elle ne lui sera visible qu'à la signature de sa lettre de constitution/),
    ).toBeInTheDocument();
  });

  it("un avocat constitué : aucun bandeau", () => {
    afficher(JURISTE, "NON");
    expect(screen.queryByRole("note")).not.toBeInTheDocument();
  });

  /** Tant que la réponse n'est pas arrivée, l'écran n'affirme rien. */
  it("l'état encore inconnu : aucun bandeau", () => {
    etat.mockReturnValue({ data: undefined });
    afficher(JURISTE, "NON");
    expect(screen.queryByRole("note")).not.toBeInTheDocument();
  });
});

