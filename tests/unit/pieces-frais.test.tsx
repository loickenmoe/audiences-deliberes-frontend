import { screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { normaliserMontant } from "@/components/modules/portail/formulaire-frais";

import { DetailFrais } from "@/components/modules/frais/detail-frais";
import type { DemandeFrais } from "@/types/domaine";
import { rendre } from "../utils/rendu";

/**
 * Supporting documents of a fee request. The screen shows the original file name and a signed URL
 * returned by the backend, never the raw storage paths of `piecesJustificatives`, so the Assistant
 * can open the documents to check compliance.
 */
const requete = vi.fn();

vi.mock("@/hooks/useFrais", async () => {
  const reel = await vi.importActual<typeof import("@/hooks/useFrais")>("@/hooks/useFrais");
  return {
    ...reel,
    useDemandeFrais: () => requete(),
    useDecisionFrais: () => ({ mutateAsync: vi.fn(), isPending: false }),
    usePaiementFrais: () => ({ mutateAsync: vi.fn(), isPending: false }),
  };
});

function demande(partiel: Partial<DemandeFrais> = {}): DemandeFrais {
  return {
    id: 7,
    dossierId: 3,
    referenceDossier: "DOS-2026-003",
    avocatId: 1,
    avocatNom: "Me Fotso",
    montant: 1_200_000,
    piecesJustificatives: [],
    piecesTelechargeables: [],
    statutCircuit: "DEPOSEE",
    motifRejet: null,
    statutPaiement: "EN_ATTENTE",
    referenceFacture: "FAC-001",
    dossierSensible: false,
    seuilApplicable: 50_000_000,
    validationConjointeRequise: false,
    validations: [],
    createdAt: "2026-09-28T09:00:00",
    updatedAt: null,
    ...partiel,
  };
}

beforeEach(() => {
  requete.mockReturnValue({ data: demande(), isLoading: false, error: null });
});

describe("pièces d'une demande de frais", () => {
  it("rend chaque pièce stockée consultable et téléchargeable, sous son vrai nom", () => {
    requete.mockReturnValue({
      data: demande({
        piecesJustificatives: ["frais/8f3a2b1c-4d5e-6f70-8a9b-0c1d2e3f4a5b-facture.pdf"],
        piecesTelechargeables: [
          {
            cle: "frais/8f3a2b1c-4d5e-6f70-8a9b-0c1d2e3f4a5b-facture.pdf",
            nomFichier: "facture.pdf",
            urlTelechargement: "https://stockage/facture.pdf?signature=abc",
          },
        ],
      }),
      isLoading: false,
      error: null,
    });

    rendre(<DetailFrais demandeId={7} roles={["ROLE_ASSISTANTE"]} />);

    expect(screen.getByText("facture.pdf")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Consulter - facture.pdf" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Télécharger - facture.pdf" })).toBeInTheDocument();
  });

  /**
   * The storage path must never be displayed: it means nothing to anyone.
   */
  it("n'affiche plus le chemin de stockage à la place du document", () => {
    const cle = "frais/8f3a2b1c-4d5e-6f70-8a9b-0c1d2e3f4a5b-facture.pdf";
    requete.mockReturnValue({
      data: demande({
        piecesJustificatives: [cle],
        piecesTelechargeables: [
          { cle, nomFichier: "facture.pdf", urlTelechargement: "https://stockage/facture.pdf" },
        ],
      }),
      isLoading: false,
      error: null,
    });

    rendre(<DetailFrais demandeId={7} roles={["ROLE_ASSISTANTE"]} />);

    expect(screen.queryByText(cle)).not.toBeInTheDocument();
  });

  /**
   * Labels entered before uploads existed point to no file. Hiding them would suggest no document
   * was declared; making them clickable would promise a document that does not exist.
   */
  it("affiche sans bouton les pièces déclarées qui n'ont pas de fichier", () => {
    requete.mockReturnValue({
      data: demande({ piecesJustificatives: ["facture papier remise en main propre"] }),
      isLoading: false,
      error: null,
    });

    rendre(<DetailFrais demandeId={7} roles={["ROLE_ASSISTANTE"]} />);

    expect(screen.getByText("facture papier remise en main propre")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /^Consulter/ })).not.toBeInTheDocument();
  });

  it("dit clairement qu'aucune pièce n'accompagne la demande", () => {
    rendre(<DetailFrais demandeId={7} roles={["ROLE_ASSISTANTE"]} />);

    expect(screen.getByText("Aucune pièce jointe à cette demande.")).toBeInTheDocument();
  });
});

/**
 * Amount normalization. A lawyer must be able to type "12 000" (with spaces, as the application
 * itself displays it) and still submit.
 */
describe("normalisation du montant", () => {
  it("accepte les espaces, y compris ceux qu'on ne voit pas", () => {
    expect(normaliserMontant("12 000")).toBe("12000");
    /*
     * Non-breaking (U+00A0) and narrow non-breaking (U+202F) spaces come from copy-paste out of a
     * spreadsheet or the application itself. They are **invisible**, so refusing them would be baffling.
     */
    expect(normaliserMontant("12\u00a0000")).toBe("12000");
    expect(normaliserMontant("1\u202f500\u202f000")).toBe("1500000");
  });

  it("traduit la virgule décimale en point", () => {
    // `Number("12,5")` is NaN: without this conversion the amount would be empty or rejected.
    expect(normaliserMontant("12,5")).toBe("12.5");
    expect(normaliserMontant("1 500,75")).toBe("1500.75");
  });

  it("laisse intact ce qui est déjà un nombre", () => {
    expect(normaliserMontant("12000")).toBe("12000");
    expect(normaliserMontant("12000.5")).toBe("12000.5");
  });

  /** It normalizes, it does not validate: the form rejects what is not a number. */
  it("ne rend pas valide ce qui ne l'est pas", () => {
    expect(normaliserMontant("abc")).toBe("abc");
    expect(normaliserMontant("12 000 F")).toBe("12000F");
  });
});
