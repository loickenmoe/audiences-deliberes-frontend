import { fireEvent, screen, waitFor, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { OngletDocuments } from "@/components/modules/dossiers/onglet-documents";
import { ErreurApi } from "@/lib/api/errors";
import type { DocumentDossier } from "@/types/domaine";
import { MESSAGES, rendre } from "../utils/rendu";

/**
 * Documents tab: upload, download (with or without letterhead for a representation letter),
 * deletion (immediate for the DJ/DJA, a request otherwise) and the outcome of each sharing action.
 * Who may share or arbitrate is covered by `partage-documents.test.tsx`.
 */
const etat = vi.hoisted(() => ({ documents: { data: undefined as unknown, isLoading: false, error: null as unknown } }));
const mutations = vi.hoisted(() => ({
  supprimer: vi.fn(),
  deposer: vi.fn(),
  partager: vi.fn(),
  retirer: vi.fn(),
  arbitrer: vi.fn(),
}));
const services = vi.hoisted(() => ({ consulter: vi.fn(), recupererContenu: vi.fn(), lettre: vi.fn() }));
const telechargerBlob = vi.hoisted(() => vi.fn());

vi.mock("@/hooks/useDossiers", () => ({
  useDocumentsDossier: () => etat.documents,
  useSupprimerDocument: () => ({ mutateAsync: mutations.supprimer, isPending: false }),
  useDeposerDocument: () => ({ mutateAsync: mutations.deposer, isPending: false }),
}));
vi.mock("@/hooks/useGed", () => ({
  usePartagerDocument: () => ({ mutateAsync: mutations.partager, isPending: false }),
  useRetirerPartage: () => ({ mutateAsync: mutations.retirer, isPending: false }),
  useArbitrerPartage: () => ({ mutateAsync: mutations.arbitrer, isPending: false }),
  useEtatPartageDossier: () => ({ data: { avocatConstitue: true } }),
  useRejeterPartage: () => ({ mutateAsync: vi.fn(), isPending: false }),
}));
vi.mock("@/hooks/useLibelles", () => ({ useLibelles: () => ({ nomUtilisateur: (id: number) => `Utilisateur ${id}` }) }));
vi.mock("@/services/gedService", () => ({
  gedService: { consulter: services.consulter, recupererContenu: services.recupererContenu },
}));
vi.mock("@/services/constitutionService", () => ({
  constitutionService: { lettrePourPapierPreimprime: services.lettre },
}));
vi.mock("@/lib/documents", async (original) => ({
  ...(await original<typeof import("@/lib/documents")>()),
  telechargerBlob,
}));

const toast = vi.hoisted(() => ({ success: vi.fn(), error: vi.fn() }));
vi.mock("sonner", () => ({ toast }));

const DOC = MESSAGES.fr.documents;
const F = MESSAGES.fr.fiche;
const CONFIRMER = MESSAGES.fr.metier.confirmer;
const JURISTE = ["ROLE_JURISTE", "ROLE_SAISIE", "ROLE_CONSULTATION"];
const DJ = ["ROLE_DJ", "ROLE_JURISTE", "ROLE_SAISIE", "ROLE_CONSULTATION"];

function piece(partiel: Partial<DocumentDossier>): DocumentDossier {
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
    partageAvocat: "NON",
    ...partiel,
  } as DocumentDossier;
}

function liste(documents: DocumentDossier[]) {
  etat.documents = { data: { content: documents, totalPages: 1, totalElements: documents.length }, isLoading: false, error: null };
}

function confirmer(titre: string, libelle: string) {
  const fenetre = screen.getByRole("dialog", { name: titre, hidden: true });
  fireEvent.click(within(fenetre).getByRole("button", { name: libelle, hidden: true }));
}

beforeEach(() => {
  vi.clearAllMocks();
  liste([]);
  for (const mutation of Object.values(mutations)) mutation.mockResolvedValue({});
  services.consulter.mockResolvedValue({ urlTelechargement: "https://minio/x" });
  services.recupererContenu.mockResolvedValue(new Blob(["x"]));
  services.lettre.mockResolvedValue(new Blob(["pdf"]));
});

describe("OngletDocuments - liste", () => {
  it("affiche le chargement, l'erreur, puis l'absence de document", () => {
    etat.documents = { data: undefined, isLoading: true, error: null };
    const { rerender } = rendre(<OngletDocuments dossierId={3} roles={JURISTE} />);
    expect(screen.getByRole("status")).toBeInTheDocument();

    etat.documents = { data: undefined, isLoading: false, error: new ErreurApi({ code: "X", message: "GED indisponible" }) };
    rerender(<OngletDocuments dossierId={3} roles={JURISTE} />);
    expect(screen.getByText("GED indisponible")).toBeInTheDocument();

    liste([piece({ estSupprime: true })]);
    rerender(<OngletDocuments dossierId={3} roles={JURISTE} />);
    expect(screen.getByText(F.documentsVide)).toBeInTheDocument();
  });

  it("nomme chaque type de pièce, même inconnu ou absent", () => {
    liste([
      piece({ id: 1, typeDocument: "PV_TRANSFERT", auteurChargementId: null }),
      piece({ id: 2, nomFichier: "b.pdf", typeDocument: "Type ancien" }),
      piece({ id: 3, nomFichier: "c.pdf", typeDocument: null } as Partial<DocumentDossier>),
    ]);
    rendre(<OngletDocuments dossierId={3} roles={["ROLE_CONSULTATION"]} />);

    expect(screen.getByText(DOC.types.PV_TRANSFERT)).toBeInTheDocument();
    expect(screen.getByText("Type ancien")).toBeInTheDocument();
    expect(screen.getAllByText("—")).toHaveLength(2);
  });
});

describe("OngletDocuments - téléchargement", () => {
  it("télécharge le fichier par une adresse fraîchement signée", async () => {
    liste([piece({})]);
    rendre(<OngletDocuments dossierId={3} roles={JURISTE} />);
    fireEvent.click(screen.getByRole("button", { name: `${DOC.telecharger} - assignation.pdf` }));

    await waitFor(() => expect(telechargerBlob).toHaveBeenCalledWith(expect.any(Blob), "assignation.pdf"));
    expect(services.recupererContenu).toHaveBeenCalledWith("https://minio/x");
  });

  it("signale un document illisible ou une adresse absente", async () => {
    services.recupererContenu.mockRejectedValueOnce(new Error("Stockage injoignable"));
    services.consulter.mockResolvedValueOnce({ urlTelechargement: "https://minio/x" }).mockResolvedValueOnce({ urlTelechargement: null });
    liste([piece({})]);
    rendre(<OngletDocuments dossierId={3} roles={JURISTE} />);
    const bouton = screen.getByRole("button", { name: `${DOC.telecharger} - assignation.pdf` });

    fireEvent.click(bouton);
    expect(await screen.findByRole("alert")).toHaveTextContent(DOC.apercuErreur);
    fireEvent.click(bouton);
    await waitFor(() => expect(screen.getByRole("alert")).toHaveTextContent("URL de téléchargement absente"));
  });

  it("propose la lettre de constitution sans en-tête, pour le papier préimprimé", async () => {
    liste([piece({ nomFichier: "lettre.PDF", typeDocument: "Lettre de constitution" })]);
    rendre(<OngletDocuments dossierId={3} roles={JURISTE} />);
    fireEvent.click(screen.getByRole("button", { name: `${DOC.telechargerSansEntete} - lettre.PDF` }));

    await waitFor(() => expect(telechargerBlob).toHaveBeenCalledWith(expect.any(Blob), "lettre-sans-entete.pdf"));
  });

  it("signale l'échec de la lettre sans en-tête", async () => {
    services.lettre.mockRejectedValue(new ErreurApi({ code: "X", message: "Lettre introuvable" }));
    liste([piece({ typeDocument: "Lettre de constitution" })]);
    rendre(<OngletDocuments dossierId={3} roles={JURISTE} />);
    fireEvent.click(screen.getByRole("button", { name: `${DOC.telechargerSansEntete} - assignation.pdf` }));

    expect(await screen.findByRole("alert")).toHaveTextContent("Lettre introuvable");
  });
});

describe("OngletDocuments - suppression", () => {
  it("le DJ supprime directement", async () => {
    mutations.supprimer.mockResolvedValue({ immediate: true });
    liste([piece({})]);
    rendre(<OngletDocuments dossierId={3} roles={DJ} />);
    fireEvent.click(screen.getByRole("button", { name: `${DOC.supprimer} - assignation.pdf` }));
    confirmer(DOC.suppressionTitre, DOC.supprimer);

    await waitFor(() => expect(toast.success).toHaveBeenCalledWith(DOC.documentSupprime));
    expect(mutations.supprimer).toHaveBeenCalledWith(7);
  });

  it("le juriste demande la suppression, et voit le refus du serveur", async () => {
    mutations.supprimer
      .mockResolvedValueOnce({ immediate: false })
      .mockRejectedValueOnce(new ErreurApi({ code: "X", message: "Demande déjà en cours" }));
    liste([piece({})]);
    rendre(<OngletDocuments dossierId={3} roles={JURISTE} />);
    const bouton = screen.getByRole("button", { name: `${DOC.demanderSuppression} - assignation.pdf` });

    fireEvent.click(bouton);
    confirmer(DOC.demandeSuppressionTitre, DOC.demanderSuppression);
    await waitFor(() => expect(toast.success).toHaveBeenCalledWith(DOC.demandeEnvoyee));

    fireEvent.click(bouton);
    confirmer(DOC.demandeSuppressionTitre, DOC.demanderSuppression);
    expect(await screen.findByRole("alert")).toHaveTextContent("Demande déjà en cours");
  });
});

describe("OngletDocuments - partage", () => {
  it("annonce un partage effectif ou une proposition, selon la réponse du serveur", async () => {
    mutations.partager.mockResolvedValueOnce({ partageAvocat: "PARTAGE" }).mockResolvedValueOnce({ partageAvocat: "PROPOSE" });
    liste([piece({})]);
    rendre(<OngletDocuments dossierId={3} roles={JURISTE} />);
    const bouton = screen.getByRole("button", { name: `${DOC.partager} - assignation.pdf` });

    fireEvent.click(bouton);
    confirmer(DOC.partageTitre, DOC.partager);
    await waitFor(() => expect(toast.success).toHaveBeenCalledWith(DOC.partagee));

    fireEvent.click(bouton);
    confirmer(DOC.partageTitre, DOC.partager);
    await waitFor(() => expect(toast.success).toHaveBeenLastCalledWith(DOC.proposee));
  });

  it("retire un partage, et signale un échec", async () => {
    mutations.retirer.mockResolvedValueOnce({}).mockRejectedValueOnce(new ErreurApi({ code: "X", message: "Déjà retiré" }));
    liste([piece({ partageAvocat: "PARTAGE" })]);
    rendre(<OngletDocuments dossierId={3} roles={JURISTE} />);
    const bouton = screen.getByRole("button", { name: `${DOC.retirerPartage} - assignation.pdf` });

    fireEvent.click(bouton);
    confirmer(DOC.retraitTitre, DOC.retirerPartage);
    await waitFor(() => expect(toast.success).toHaveBeenCalledWith(DOC.partageRetire));

    fireEvent.click(bouton);
    confirmer(DOC.retraitTitre, DOC.retirerPartage);
    expect(await screen.findByRole("alert")).toHaveTextContent("Déjà retiré");
  });

  it("le DJ valide une proposition", async () => {
    liste([piece({ partageAvocat: "PROPOSE" })]);
    rendre(<OngletDocuments dossierId={3} roles={DJ} sensible />);
    fireEvent.click(screen.getByRole("button", { name: `${DOC.validerPartage} - assignation.pdf` }));
    confirmer(DOC.validerPartage, DOC.validerPartage);

    await waitFor(() => expect(mutations.arbitrer).toHaveBeenCalledWith({ documentId: 7 }));
    expect(toast.success).toHaveBeenCalledWith(DOC.partageValide);
  });
});

describe("OngletDocuments - dépôt", () => {
  it("dépose une pièce du type choisi, puis vide le champ", async () => {
    rendre(<OngletDocuments dossierId={3} roles={JURISTE} />);
    const deposer = screen.getByRole("button", { name: DOC.deposer });
    expect(deposer).toBeDisabled();

    fireEvent.change(screen.getByLabelText(DOC.typePiece), { target: { value: "PV_TRANSFERT" } });
    fireEvent.change(screen.getByLabelText(MESSAGES.fr.metier.choisirFichier), {
      target: { files: [new File(["x"], "pv.pdf", { type: "application/pdf" })] },
    });
    expect(screen.getByRole("button", { name: DOC.apercu })).toBeInTheDocument();
    fireEvent.click(deposer);

    await waitFor(() => expect(toast.success).toHaveBeenCalledWith(DOC.pieceDeposee));
    expect(mutations.deposer).toHaveBeenCalledWith({ typeDocument: "PV_TRANSFERT", fichier: expect.any(File) });
    expect(screen.getByRole("button", { name: DOC.deposer })).toBeDisabled();
  });

  it("affiche le refus du dépôt", async () => {
    mutations.deposer.mockRejectedValue(new ErreurApi({ code: "ERR-008", message: "Format refusé" }));
    rendre(<OngletDocuments dossierId={3} roles={JURISTE} />);
    fireEvent.change(screen.getByLabelText(MESSAGES.fr.metier.choisirFichier), {
      target: { files: [new File(["x"], "pv.pdf", { type: "application/pdf" })] },
    });
    fireEvent.click(screen.getByRole("button", { name: DOC.deposer }));

    expect(await screen.findByRole("alert")).toHaveTextContent("Format refusé");
  });
});
