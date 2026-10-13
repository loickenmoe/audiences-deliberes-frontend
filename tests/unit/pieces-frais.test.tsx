import { screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { normaliserMontant } from "@/components/modules/portail/formulaire-frais";

import { DetailFrais } from "@/components/modules/frais/detail-frais";
import type { DemandeFrais } from "@/types/domaine";
import { rendre } from "../utils/rendu";

/**
 * Les pièces justificatives d'une demande de frais (signalé en recette, 2026-09-28).
 *
 * **Ce que ces tests protègent.** L'écran n'affichait que le contenu brut de
 * `piecesJustificatives` — des chemins de stockage, illisibles et non cliquables — alors que le
 * backend rend depuis Q-97 le nom d'origine et une adresse signée. L'Assistante devait donc statuer
 * sur la conformité sans pouvoir ouvrir les documents, ce que le guide utilisateur promettait
 * pourtant : « le contrôle de conformité porte sur les documents, pas sur leurs noms ».
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
   * Le chemin de stockage ne doit plus jamais s'afficher : c'est lui qu'on voyait à la place du
   * document, et il ne dit rien à personne.
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
   * Les libellés saisis avant que le téléversement n'existe ne désignent aucun fichier. Les taire
   * ferait croire qu'aucune pièce n'a été déclarée ; les rendre cliquables promettrait un document
   * qui n'existe pas.
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
 * La normalisation du montant (QF-56).
 *
 * **Le défaut, tel qu'il a été vécu en recette** : l'avocat écrit « 12 000 » - comme il l'écrit
 * partout, et comme l'application l'affiche elle-même -, le bouton « Déposer » reste éteint, et rien
 * ne dit pourquoi. La validation exigeait des chiffres collés.
 */
describe("normalisation du montant", () => {
  it("accepte les espaces, y compris ceux qu'on ne voit pas", () => {
    expect(normaliserMontant("12 000")).toBe("12000");
    /*
     * L'insécable (U+00A0) et l'insécable étroite (U+202F) arrivent par copier-coller depuis un
     * tableur ou depuis l'application elle-même. Elles sont **invisibles à l'œil** : un refus sans
     * message aurait été indéchiffrable.
     */
    expect(normaliserMontant("12\u00a0000")).toBe("12000");
    expect(normaliserMontant("1\u202f500\u202f000")).toBe("1500000");
  });

  it("traduit la virgule décimale en point", () => {
    // `Number("12,5")` vaut NaN : sans cette traduction, le montant partait vide ou refusé.
    expect(normaliserMontant("12,5")).toBe("12.5");
    expect(normaliserMontant("1 500,75")).toBe("1500.75");
  });

  it("laisse intact ce qui est déjà un nombre", () => {
    expect(normaliserMontant("12000")).toBe("12000");
    expect(normaliserMontant("12000.5")).toBe("12000.5");
  });

  /** Elle normalise, elle ne valide pas : c'est au formulaire de refuser ce qui n'est pas un nombre. */
  it("ne rend pas valide ce qui ne l'est pas", () => {
    expect(normaliserMontant("abc")).toBe("abc");
    expect(normaliserMontant("12 000 F")).toBe("12000F");
  });
});
