import { fireEvent, screen, waitFor, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { FileSuppressions } from "@/components/modules/ged/file-suppressions";
import { ErreurApi } from "@/lib/api/errors";
import type { DemandeSuppression } from "@/types/domaine";
import { MESSAGES, rendre } from "../utils/rendu";

/**
 * Screen 36 - deletion requests: the DJ/DJA views the document, then approves (deleted for good)
 * or rejects with a reason sent to the legal officer.
 */
const etat = vi.hoisted(() => ({ requete: { data: undefined as unknown, isLoading: false, error: null as unknown } }));
const lister = vi.hoisted(() => vi.fn());
const decider = vi.hoisted(() => vi.fn());
const ged = vi.hoisted(() => ({ consulter: vi.fn(), recupererContenu: vi.fn() }));

vi.mock("@/hooks/useGed", () => ({
  useDemandesSuppression: (statut: unknown, page: number) => {
    lister(statut, page);
    return etat.requete;
  },
  useDeciderSuppression: () => ({ mutateAsync: decider, isPending: false }),
}));
vi.mock("@/hooks/useLibelles", () => ({ useLibelles: () => ({ nomUtilisateur: (id: number) => `Utilisateur ${id}` }) }));
vi.mock("@/services/gedService", () => ({ gedService: ged }));
vi.mock("@/components/metier/apercu-fichier", () => ({
  ApercuFichier: ({ ouvert, nomFichier, obtenir }: { ouvert: boolean; nomFichier: string; obtenir: () => Promise<Blob> }) =>
    ouvert ? (
      <button type="button" onClick={() => void obtenir().catch(() => undefined)}>
        {`Aperçu ${nomFichier}`}
      </button>
    ) : null,
}));

const toast = vi.hoisted(() => ({ success: vi.fn(), error: vi.fn() }));
vi.mock("sonner", () => ({ toast }));

const T = MESSAGES.fr.suppressions;
const C = MESSAGES.fr.commun;

function demande(partiel: Partial<DemandeSuppression>): DemandeSuppression {
  return {
    id: 1,
    documentId: 7,
    documentNom: "assignation.pdf",
    typeDocument: "PV_TRANSFERT",
    dossierId: 3,
    referenceDossier: "DOS-2026-0003",
    demandeurId: 4,
    motif: "Doublon",
    statut: "EN_ATTENTE",
    valideParId: null,
    motifRejet: null,
    dateDemande: "2026-10-01T10:00:00",
    dateDecision: null,
    dateDerniereRelance: null,
    ...partiel,
  };
}

function liste(demandes: DemandeSuppression[], totalPages = 1) {
  etat.requete = { data: { content: demandes, totalPages, totalElements: demandes.length }, isLoading: false, error: null };
}

beforeEach(() => {
  vi.clearAllMocks();
  liste([]);
  decider.mockResolvedValue({});
  ged.consulter.mockResolvedValue({ urlTelechargement: "https://minio/d" });
  ged.recupererContenu.mockResolvedValue(new Blob(["x"]));
});

describe("FileSuppressions - vues", () => {
  it("ouvre sur les demandes en attente, puis montre l'historique", () => {
    rendre(<FileSuppressions />);
    expect(screen.getByText(T.aucuneEnAttente)).toBeInTheDocument();
    expect(lister).toHaveBeenLastCalledWith("EN_ATTENTE", 0);

    fireEvent.click(screen.getByRole("button", { name: T.toutes }));
    expect(screen.getByText(T.aucune)).toBeInTheDocument();
    expect(lister).toHaveBeenLastCalledWith(null, 0);
  });

  it("affiche le chargement puis l'erreur", () => {
    etat.requete = { data: undefined, isLoading: true, error: null };
    const { rerender } = rendre(<FileSuppressions />);
    expect(screen.getByRole("status")).toBeInTheDocument();

    etat.requete = { data: undefined, isLoading: false, error: new ErreurApi({ code: "X", message: "File indisponible" }) };
    rerender(<FileSuppressions />);
    expect(screen.getByText("File indisponible")).toBeInTheDocument();
  });
});

describe("FileSuppressions - lignes", () => {
  it("décrit chaque demande, son type, sa relance et sa décision", () => {
    liste(
      [
        demande({ id: 1, dateDerniereRelance: "2026-10-04T10:00:00" }),
        demande({ id: 2, documentNom: "b.pdf", typeDocument: "Type ancien", demandeurId: null, statut: "REJETEE", dateDecision: "2026-10-05T10:00:00", valideParId: 9, motifRejet: "Utile" }),
        demande({ id: 3, documentNom: "c.pdf", typeDocument: null, statut: "APPROUVEE", dateDecision: "2026-10-05T10:00:00" }),
      ],
      2,
    );
    rendre(<FileSuppressions />);

    expect(screen.getByText(MESSAGES.fr.documents.types.PV_TRANSFERT)).toBeInTheDocument();
    expect(screen.getByText("Type ancien")).toBeInTheDocument();
    expect(screen.getByText(T.relancee, { exact: false })).toBeInTheDocument();
    expect(screen.getByText("Utilisateur 9 ·", { exact: false })).toBeInTheDocument();
    expect(screen.getByText("Motif : Utile")).toBeInTheDocument();
    expect(screen.getByText("—")).toBeInTheDocument();
    expect(screen.getAllByRole("button", { name: /^Approuver la suppression/ })).toHaveLength(1);
    expect(screen.getAllByRole("link")[0]).toHaveAttribute("href", "/dossiers/3?onglet=documents");

    fireEvent.click(screen.getByRole("button", { name: MESSAGES.fr.metier.suivant }));
    expect(lister).toHaveBeenLastCalledWith("EN_ATTENTE", 1);
  });

  it("montre le document avant décision", async () => {
    liste([demande({})]);
    rendre(<FileSuppressions />);
    fireEvent.click(screen.getByRole("button", { name: "Consulter - assignation.pdf" }));
    fireEvent.click(screen.getByRole("button", { name: "Aperçu assignation.pdf" }));

    await waitFor(() => expect(ged.recupererContenu).toHaveBeenCalledWith("https://minio/d"));
  });

  it("refuse un aperçu sans adresse de téléchargement", async () => {
    ged.consulter.mockResolvedValue({ urlTelechargement: null });
    liste([demande({})]);
    rendre(<FileSuppressions />);
    fireEvent.click(screen.getByRole("button", { name: "Consulter - assignation.pdf" }));
    fireEvent.click(screen.getByRole("button", { name: "Aperçu assignation.pdf" }));

    await waitFor(() => expect(ged.consulter).toHaveBeenCalledWith(7));
    expect(ged.recupererContenu).not.toHaveBeenCalled();
  });
});

describe("FileSuppressions - décisions", () => {
  it("approuve après confirmation, et signale un échec", async () => {
    decider.mockResolvedValueOnce({}).mockRejectedValueOnce(new ErreurApi({ code: "X", message: "Déjà supprimé" }));
    liste([demande({})]);
    rendre(<FileSuppressions />);
    const approuver = () => {
      fireEvent.click(screen.getByRole("button", { name: "Approuver la suppression - assignation.pdf" }));
      const fenetre = screen.getByRole("dialog", { name: T.approbationTitre, hidden: true });
      fireEvent.click(within(fenetre).getByRole("button", { name: T.approuver, hidden: true }));
    };

    approuver();
    await waitFor(() => expect(toast.success).toHaveBeenCalledWith("Document « assignation.pdf » supprimé."));
    expect(decider).toHaveBeenCalledWith({ documentId: 7 });
    approuver();
    await waitFor(() => expect(toast.error).toHaveBeenCalledWith("Déjà supprimé"));
  });

  it("rejette avec un motif obligatoire, et affiche le refus", async () => {
    decider.mockRejectedValueOnce(new ErreurApi({ code: "X", message: "Rejet impossible" }));
    liste([demande({})]);
    rendre(<FileSuppressions />);
    fireEvent.click(screen.getByRole("button", { name: "Rejeter la demande - assignation.pdf" }));
    const fenetre = screen.getByRole("dialog", { name: T.rejetTitre, hidden: true });
    const rejeter = () => fireEvent.click(within(fenetre).getByRole("button", { name: T.rejeter, hidden: true }));

    rejeter();
    expect(await within(fenetre).findByText(MESSAGES.fr.metier.champObligatoire)).toBeInTheDocument();
    fireEvent.change(within(fenetre).getByLabelText(T.champMotifRejet, { exact: false }), { target: { value: " Utile " } });
    rejeter();
    expect(await within(fenetre).findByText("Rejet impossible")).toBeInTheDocument();
    rejeter();
    await waitFor(() => expect(toast.success).toHaveBeenCalledWith(T.rejetee));
    expect(decider).toHaveBeenLastCalledWith({ documentId: 7, motifRejet: "Utile" });
    fireEvent.click(within(fenetre).getByRole("button", { name: C.annuler, hidden: true }));
  });
});
