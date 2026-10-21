import { fireEvent, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { FormulairePublication } from "@/components/modules/portail/formulaire-publication";
import { ErreurApi } from "@/lib/api/errors";
import { MESSAGES, rendre } from "../utils/rendu";

/**
 * Screen 33 - the lawyer submits a hearing report (a hearing and a text, optional attachment) or a
 * case document (a type and a file). Each kind says what happens next.
 */
const etat = vi.hoisted(() => ({ audiences: { data: [] as unknown[] | undefined, isLoading: false } }));
const mutations = vi.hoisted(() => ({ compteRendu: vi.fn(), autre: vi.fn() }));
const demandees = vi.hoisted(() => vi.fn());
const navigation = vi.hoisted(() => ({ push: vi.fn(), back: vi.fn() }));

vi.mock("@/hooks/usePortailAvocat", () => ({
  useAudiencesDeMonDossier: (dossierId: number | null) => {
    demandees(dossierId);
    return etat.audiences;
  },
  useDeposerCompteRendu: () => ({ mutate: mutations.compteRendu, isPending: false }),
  useDeposerAutrePublication: () => ({ mutate: mutations.autre, isPending: false }),
}));
vi.mock("next/navigation", () => ({ useRouter: () => ({ push: navigation.push, back: navigation.back, replace: vi.fn() }) }));
vi.mock("@/components/modules/portail/selecteur-dossier", () => ({
  SelecteurDossier: ({ onChangement }: { onChangement: (id: number) => void }) => (
    <>
      <button type="button" onClick={() => onChangement(3)}>
        Dossier 3
      </button>
      <button type="button" onClick={() => onChangement(4)}>
        Dossier 4
      </button>
    </>
  ),
}));
vi.mock("@/components/metier/apercu-fichier", () => ({
  ApercuFichier: ({ nomFichier, onFermeture }: { nomFichier: string; onFermeture: () => void }) => (
    <button type="button" onClick={onFermeture}>{`Fermer ${nomFichier}`}</button>
  ),
}));

const toast = vi.hoisted(() => ({ success: vi.fn(), error: vi.fn() }));
vi.mock("sonner", () => ({ toast }));

const P = MESSAGES.fr.portail;

function joindre(libelle: string, nom: string) {
  fireEvent.change(screen.getByLabelText(libelle), { target: { files: [new File(["x"], nom, { type: "application/pdf" })] } });
}

beforeEach(() => {
  vi.clearAllMocks();
  etat.audiences = { data: [{ id: 11, datePlanifiee: "2026-09-20", statut: "TENUE" }], isLoading: false };
});

describe("FormulairePublication - compte rendu", () => {
  it("n'envoie rien tant que l'audience et le texte manquent", () => {
    rendre(<FormulairePublication />);
    const deposer = screen.getByRole("button", { name: P.natures.compteRendu.action });
    expect(deposer).toBeDisabled();
    expect(demandees).toHaveBeenLastCalledWith(null);

    fireEvent.click(screen.getByRole("button", { name: "Dossier 3" }));
    expect(demandees).toHaveBeenLastCalledWith(3);
    fireEvent.change(document.getElementById("publication-audience")!, { target: { value: "11" } });
    expect(deposer).toBeDisabled();
    fireEvent.change(document.getElementById("publication-contenu")!, { target: { value: "  " } });
    expect(deposer).toBeDisabled();
  });

  it("dépose le compte rendu avec sa pièce jointe, puis revient au portail", () => {
    mutations.compteRendu.mockImplementation((_corps, { onSuccess }) => onSuccess());
    rendre(<FormulairePublication />);
    fireEvent.click(screen.getByRole("button", { name: "Dossier 3" }));
    fireEvent.change(document.getElementById("publication-audience")!, { target: { value: "11" } });
    fireEvent.change(document.getElementById("publication-contenu")!, { target: { value: " Renvoi au 10 mars " } });
    joindre(P.pieceJointe, "plumitif.pdf");
    fireEvent.click(screen.getByRole("button", { name: `${MESSAGES.fr.documents.consulter} - plumitif.pdf` }));
    fireEvent.click(screen.getByRole("button", { name: "Fermer plumitif.pdf" }));
    fireEvent.click(screen.getByRole("button", { name: P.natures.compteRendu.action }));

    expect(mutations.compteRendu).toHaveBeenCalledWith(
      { dossierId: 3, audienceId: 11, contenu: "Renvoi au 10 mars", fichier: expect.any(File) },
      expect.anything(),
    );
    expect(toast.success).toHaveBeenCalledWith(P.compteRenduDepose);
    expect(navigation.push).toHaveBeenCalledWith("/portail");
  });

  it("oublie l'audience choisie quand le dossier change, et dit quand il n'y en a aucune", () => {
    rendre(<FormulairePublication />);
    fireEvent.click(screen.getByRole("button", { name: "Dossier 3" }));
    fireEvent.change(document.getElementById("publication-audience")!, { target: { value: "11" } });

    etat.audiences = { data: [], isLoading: false };
    fireEvent.click(screen.getByRole("button", { name: "Dossier 4" }));
    expect(document.getElementById("publication-audience")!).toHaveValue("");
    expect(screen.getByText(P.aucuneAudience)).toBeInTheDocument();
    // Back to no hearing chosen.
    fireEvent.change(document.getElementById("publication-audience")!, { target: { value: "" } });
  });

  it("signale un dépôt refusé", () => {
    mutations.compteRendu.mockImplementation((_corps, { onError }) => onError(new ErreurApi({ code: "X", message: "Audience future" })));
    rendre(<FormulairePublication />);
    fireEvent.click(screen.getByRole("button", { name: "Dossier 3" }));
    fireEvent.change(document.getElementById("publication-audience")!, { target: { value: "11" } });
    fireEvent.change(document.getElementById("publication-contenu")!, { target: { value: "Texte" } });
    fireEvent.click(screen.getByRole("button", { name: P.natures.compteRendu.action }));

    expect(toast.error).toHaveBeenCalledWith("Audience future");
  });
});

describe("FormulairePublication - document", () => {
  it("dépose un document du type choisi, et oublie le fichier en changeant de nature", () => {
    mutations.autre.mockImplementation((_corps, { onSuccess }) => onSuccess());
    rendre(<FormulairePublication />);
    fireEvent.click(screen.getByRole("button", { name: "Dossier 3" }));
    fireEvent.click(screen.getByLabelText(P.natures.document.titre, { exact: false }));
    const deposer = screen.getByRole("button", { name: P.natures.document.action });
    expect(deposer).toBeDisabled();

    fireEvent.change(screen.getByLabelText(P.typeDocument, { exact: false }), { target: { value: "DECISION" } });
    joindre(P.fichier, "jugement.pdf");
    fireEvent.click(deposer);

    expect(mutations.autre).toHaveBeenCalledWith({ dossierId: 3, typeDocument: "DECISION", fichier: expect.any(File) }, expect.anything());
    expect(toast.success).toHaveBeenCalledWith(P.publicationDeposee);
  });

  it("annule en revenant à l'écran précédent", () => {
    rendre(<FormulairePublication />);
    fireEvent.click(screen.getByRole("button", { name: P.annuler }));
    expect(navigation.back).toHaveBeenCalled();
  });
});
