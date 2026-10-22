import { fireEvent, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { FormulaireFrais } from "@/components/modules/portail/formulaire-frais";
import { ErreurApi } from "@/lib/api/errors";
import { MESSAGES, rendre } from "../utils/rendu";

/**
 * Screen 30 - expense request by the lawyer: each document is filed as soon as chosen, the attempt
 * names every missing field, and a server refusal lands on the field it names.
 */
const deposer = vi.hoisted(() => vi.fn());
const deposerPiece = vi.hoisted(() => vi.fn());
const recupererContenu = vi.hoisted(() => vi.fn());
const push = vi.hoisted(() => vi.fn());

vi.mock("@/hooks/usePortailAvocat", () => ({ useDeposerFrais: () => ({ mutate: deposer, isPending: false }) }));
vi.mock("@/services/portailAvocatService", () => ({ portailAvocatService: { deposerPieceJustificative: deposerPiece } }));
vi.mock("@/services/gedService", () => ({ gedService: { recupererContenu } }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ push, replace: vi.fn() }) }));
vi.mock("@/components/modules/portail/selecteur-dossier", () => ({
  SelecteurDossier: ({ onChangement }: { onChangement: (id: number) => void }) => (
    <button type="button" onClick={() => onChangement(3)}>
      Choisir le dossier 3
    </button>
  ),
}));
vi.mock("@/components/metier/apercu-fichier", () => ({
  ApercuFichier: ({ nomFichier, obtenir, onFermeture }: { nomFichier: string; obtenir: () => Promise<Blob>; onFermeture: () => void }) => (
    <div>
      <button type="button" onClick={() => void obtenir()}>{`Aperçu ${nomFichier}`}</button>
      <button type="button" onClick={onFermeture}>Fermer l'aperçu</button>
    </div>
  ),
}));

const toast = vi.hoisted(() => ({ success: vi.fn(), error: vi.fn() }));
vi.mock("sonner", () => ({ toast }));

const P = MESSAGES.fr.portail;
const DOC = MESSAGES.fr.documents;

function fichier(nom: string) {
  return new File(["x"], nom, { type: "application/pdf" });
}

function choisirFichier(nom: string) {
  fireEvent.change(screen.getByLabelText(P.piecesFichier), { target: { files: [fichier(nom)] } });
}

beforeEach(() => {
  vi.clearAllMocks();
  let rang = 0;
  deposerPiece.mockImplementation(async (f: File) => {
    rang += 1;
    return { cle: `cle-${rang}`, nomFichier: f.name, urlTelechargement: `https://minio/${rang}` };
  });
  recupererContenu.mockResolvedValue(new Blob(["x"]));
});

describe("FormulaireFrais", () => {
  it("nomme chaque champ manquant sans rien envoyer", () => {
    rendre(<FormulaireFrais />);
    fireEvent.click(screen.getByRole("button", { name: P.deposer }));

    for (const message of [P.fraisDossierManquant, P.fraisReferenceManquante, P.fraisMontantManquant, P.fraisPiecesManquantes]) {
      expect(screen.getByText(message)).toBeInTheDocument();
    }
    expect(deposer).not.toHaveBeenCalled();

    // Fixing a field clears its message.
    fireEvent.change(screen.getByLabelText(P.referenceFacture, { exact: false }), { target: { value: "F-1" } });
    expect(screen.queryByText(P.fraisReferenceManquante)).not.toBeInTheDocument();
  });

  it("distingue un montant illisible d'un montant absent", () => {
    rendre(<FormulaireFrais />);
    fireEvent.change(screen.getByLabelText(P.montant, { exact: false }), { target: { value: "douze" } });
    fireEvent.click(screen.getByRole("button", { name: P.deposer }));

    expect(screen.getByText(P.fraisMontantInvalide)).toBeInTheDocument();
  });

  it("dépose la demande avec ses pièces, puis revient à la liste", async () => {
    deposer.mockImplementation((_corps, { onSuccess }) => onSuccess());
    rendre(<FormulaireFrais />);
    fireEvent.click(screen.getByRole("button", { name: "Choisir le dossier 3" }));
    fireEvent.change(screen.getByLabelText(P.referenceFacture, { exact: false }), { target: { value: " F-1 " } });
    fireEvent.change(screen.getByLabelText(P.montant, { exact: false }), { target: { value: "12 500,5" } });
    choisirFichier("facture.pdf");
    await screen.findByRole("button", { name: `${DOC.consulter} - facture.pdf` });
    choisirFichier("recu.pdf");
    await screen.findByRole("button", { name: `${DOC.consulter} - recu.pdf` });
    fireEvent.click(screen.getByRole("button", { name: P.deposer }));

    expect(deposer).toHaveBeenCalledWith(
      { dossierId: 3, montant: 12500.5, piecesJustificatives: ["cle-1", "cle-2"], referenceFacture: "F-1" },
      expect.anything(),
    );
    expect(toast.success).toHaveBeenCalledWith(P.fraisDeposes);
    expect(push).toHaveBeenCalledWith("/frais");
  });

  it("montre et retire les pièces déjà chargées", async () => {
    rendre(<FormulaireFrais />);
    choisirFichier("a.pdf");
    await screen.findByRole("button", { name: `${DOC.consulter} - a.pdf` });
    choisirFichier("b.pdf");
    await screen.findByRole("button", { name: `${DOC.consulter} - b.pdf` });

    // The last one sits next to the upload; earlier ones are listed below.
    fireEvent.click(screen.getByRole("button", { name: `${DOC.consulter} - b.pdf` }));
    fireEvent.click(screen.getByRole("button", { name: "Aperçu b.pdf" }));
    await waitFor(() => expect(recupererContenu).toHaveBeenCalledWith("https://minio/2"));
    fireEvent.click(screen.getByRole("button", { name: "Fermer l'aperçu" }));

    fireEvent.click(screen.getByRole("button", { name: `${DOC.consulter} - a.pdf` }));
    expect(screen.getByRole("button", { name: "Aperçu a.pdf" })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Retirer la pièce 1" }));
    expect(screen.queryByRole("button", { name: "Retirer la pièce 1" })).not.toBeInTheDocument();

    // The upload component's own remove button drops the last document.
    fireEvent.click(screen.getByRole("button", { name: MESSAGES.fr.metier.retirerFichier }));
    expect(screen.queryByRole("button", { name: `${DOC.consulter} - b.pdf` })).not.toBeInTheDocument();
  });

  it("signale une pièce refusée", async () => {
    deposerPiece.mockRejectedValue(new ErreurApi({ code: "ERR-008", message: "Format refusé" }));
    rendre(<FormulaireFrais />);
    choisirFichier("a.pdf");

    await waitFor(() => expect(toast.error).toHaveBeenCalledWith("Format refusé"));
  });

  it("place le refus du serveur sur le champ qu'il désigne, sinon le notifie", async () => {
    deposer
      .mockImplementationOnce((_corps, { onError }) =>
        onError(new ErreurApi({ code: "ERR-006", message: "Facture déjà déposée", champ: "referenceFacture", statut: 409 })),
      )
      .mockImplementationOnce((_corps, { onError }) => onError(new ErreurApi({ code: "X", message: "Service indisponible" })));
    rendre(<FormulaireFrais />);
    fireEvent.click(screen.getByRole("button", { name: "Choisir le dossier 3" }));
    fireEvent.change(screen.getByLabelText(P.referenceFacture, { exact: false }), { target: { value: "F-1" } });
    fireEvent.change(screen.getByLabelText(P.montant, { exact: false }), { target: { value: "1000" } });
    choisirFichier("a.pdf");
    await screen.findByRole("button", { name: `${DOC.consulter} - a.pdf` });

    fireEvent.click(screen.getByRole("button", { name: P.deposer }));
    expect(screen.getByText("Facture déjà déposée")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: P.deposer }));
    expect(toast.error).toHaveBeenCalledWith("Service indisponible");
  });

  it("annule vers la liste des frais", () => {
    rendre(<FormulaireFrais />);
    fireEvent.click(screen.getByRole("button", { name: P.annuler }));
    expect(push).toHaveBeenCalledWith("/frais");
  });
});
