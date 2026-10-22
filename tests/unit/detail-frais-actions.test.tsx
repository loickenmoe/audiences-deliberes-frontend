import { fireEvent, screen, waitFor, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { DetailFrais } from "@/components/modules/frais/detail-frais";
import { ErreurApi } from "@/lib/api/errors";
import type { DemandeFrais } from "@/types/domaine";
import { MESSAGES, rendre } from "../utils/rendu";

/**
 * Screen 29 - expense workflow: only the action due to the current profile at the current step is
 * offered; the RG-INT-03 rule applied is stated; each decision is confirmed.
 */
const etat = vi.hoisted(() => ({ requete: { data: undefined as unknown, isLoading: false, error: null as unknown } }));
const mutations = vi.hoisted(() => ({ decider: vi.fn(), payer: vi.fn() }));

vi.mock("@/hooks/useFrais", async () => {
  const reel = await vi.importActual<typeof import("@/hooks/useFrais")>("@/hooks/useFrais");
  return {
    ...reel,
    useDemandeFrais: () => etat.requete,
    useDecisionFrais: () => ({ mutateAsync: mutations.decider, isPending: false }),
    usePaiementFrais: () => ({ mutateAsync: mutations.payer, isPending: false }),
  };
});

const toast = vi.hoisted(() => ({ success: vi.fn(), error: vi.fn() }));
vi.mock("sonner", () => ({ toast }));

const F = MESSAGES.fr.frais;
const ASSISTANTE = ["ROLE_ASSISTANTE", "ROLE_CONSULTATION"];
const DJA = ["ROLE_DJA", "ROLE_JURISTE", "ROLE_CONSULTATION"];
const DJ = ["ROLE_DJ", "ROLE_JURISTE", "ROLE_CONSULTATION"];

function demande(partiel: Partial<DemandeFrais>): DemandeFrais {
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
  } as DemandeFrais;
}

function charger(d: DemandeFrais) {
  etat.requete = { data: d, isLoading: false, error: null };
}

function confirmer(titre: string, libelle: string) {
  const fenetre = screen.getByRole("dialog", { name: titre, hidden: true });
  fireEvent.click(within(fenetre).getByRole("button", { name: libelle, hidden: true }));
  return fenetre;
}

beforeEach(() => {
  vi.clearAllMocks();
  mutations.decider.mockResolvedValue({ statutCircuit: "CONFORMITE" });
  mutations.payer.mockResolvedValue({});
});

describe("DetailFrais - état", () => {
  it("affiche le chargement puis l'erreur", () => {
    etat.requete = { data: undefined, isLoading: true, error: null };
    const { rerender } = rendre(<DetailFrais demandeId={7} roles={ASSISTANTE} />);
    expect(screen.getByRole("status")).toBeInTheDocument();

    etat.requete = { data: undefined, isLoading: false, error: new ErreurApi({ code: "X", message: "Demande introuvable" }) };
    rerender(<DetailFrais demandeId={7} roles={ASSISTANTE} />);
    expect(screen.getByText("Demande introuvable")).toBeInTheDocument();
  });

  it.each<[Partial<DemandeFrais>, RegExp]>([
    [{}, /montant sous le seuil applicable/],
    [{ validationConjointeRequise: true, dossierSensible: true }, /le dossier appelle une diligence particulière/],
    [{ validationConjointeRequise: true }, /le montant dépasse le seuil applicable/],
  ])("énonce la règle appliquée %o", (partiel, texte) => {
    charger(demande(partiel));
    rendre(<DetailFrais demandeId={7} roles={ASSISTANTE} />);
    expect(screen.getAllByText(texte).length).toBeGreaterThan(0);
  });
});

describe("DetailFrais - actions", () => {
  it("l'Assistante transmet une demande déposée au contrôle d'opportunité", async () => {
    charger(demande({}));
    rendre(<DetailFrais demandeId={7} roles={ASSISTANTE} />);
    fireEvent.click(screen.getByRole("button", { name: F.transmettre }));
    confirmer(F.transmettreTitre, F.transmettre);

    await waitFor(() => expect(mutations.decider).toHaveBeenCalledWith({ etape: "conformite", id: 7, decision: { accord: true } }));
    expect(toast.success).toHaveBeenCalledWith(F.transmise);
  });

  it("la DJA est prévenue que la validation conjointe suivra", async () => {
    mutations.decider.mockResolvedValue({ statutCircuit: "OPPORTUNITE" });
    charger(demande({ statutCircuit: "CONFORMITE", validationConjointeRequise: true }));
    rendre(<DetailFrais demandeId={7} roles={DJA} />);
    fireEvent.click(screen.getByRole("button", { name: F.valider }));
    const fenetre = confirmer(F.validerTitre, F.valider);
    expect(within(fenetre).getByText(F.validerMessageConjointe)).toBeInTheDocument();

    await waitFor(() => expect(toast.success).toHaveBeenCalledWith(F.conjointeDeclenchee));
  });

  it("la DJA valide une demande sans validation conjointe", async () => {
    mutations.decider.mockResolvedValue({ statutCircuit: "VALIDEE" });
    charger(demande({ statutCircuit: "CONFORMITE" }));
    rendre(<DetailFrais demandeId={7} roles={DJA} />);
    fireEvent.click(screen.getByRole("button", { name: F.valider }));
    confirmer(F.validerTitre, F.valider);

    await waitFor(() => expect(toast.success).toHaveBeenCalledWith(F.validee));
  });

  it("le DJ donne son accord conjoint, puis attend celui de la DJA", async () => {
    mutations.decider.mockResolvedValueOnce({ statutCircuit: "OPPORTUNITE" }).mockResolvedValueOnce({ statutCircuit: "VALIDEE" });
    charger(demande({ statutCircuit: "OPPORTUNITE", validationConjointeRequise: true }));
    const { unmount } = rendre(<DetailFrais demandeId={7} roles={DJ} />);
    expect(screen.getByRole("button", { name: F.refuser })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: F.donnerAccord }));
    confirmer(F.accordTitre, F.donnerAccord);
    await waitFor(() => expect(toast.success).toHaveBeenCalledWith(F.accordEnregistre));

    fireEvent.click(screen.getByRole("button", { name: F.donnerAccord }));
    confirmer(F.accordTitre, F.donnerAccord);
    await waitFor(() => expect(toast.success).toHaveBeenLastCalledWith(F.accordEnregistreValidee));
    unmount();

    charger(demande({ statutCircuit: "OPPORTUNITE", validations: [{ etape: "CONJOINTE_DJ" }] } as Partial<DemandeFrais>));
    rendre(<DetailFrais demandeId={7} roles={DJ} />);
    expect(screen.getByText(F.attenteDja)).toBeInTheDocument();
  });

  it("la DJA ayant voté attend le DJ", () => {
    charger(demande({ statutCircuit: "OPPORTUNITE", validations: [{ etape: "CONJOINTE_DJA" }] } as Partial<DemandeFrais>));
    rendre(<DetailFrais demandeId={7} roles={DJA} />);
    expect(screen.getByText(F.attenteDj)).toBeInTheDocument();
  });

  it("l'Assistante enregistre le paiement, sans possibilité de rejet", async () => {
    charger(demande({ statutCircuit: "VALIDEE" }));
    rendre(<DetailFrais demandeId={7} roles={ASSISTANTE} />);
    expect(screen.queryByRole("button", { name: F.rejeter })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: F.payer }));
    confirmer(F.payerTitre, F.payer);

    await waitFor(() => expect(mutations.payer).toHaveBeenCalledWith(7));
    expect(toast.success).toHaveBeenCalledWith(F.payee);
  });

  it("signale une décision refusée", async () => {
    mutations.decider.mockRejectedValue(new ErreurApi({ code: "X", message: "Déjà traitée" }));
    charger(demande({}));
    rendre(<DetailFrais demandeId={7} roles={ASSISTANTE} />);
    fireEvent.click(screen.getByRole("button", { name: F.transmettre }));
    confirmer(F.transmettreTitre, F.transmettre);

    await waitFor(() => expect(toast.error).toHaveBeenCalledWith("Déjà traitée"));
  });

  it("ne propose rien à qui n'a pas d'action à cette étape, ni sur une demande close", () => {
    charger(demande({}));
    const { unmount } = rendre(<DetailFrais demandeId={7} roles={DJ} />);
    expect(screen.getByText(F.aucuneAction)).toBeInTheDocument();
    unmount();

    charger(demande({ statutCircuit: "PAYEE" }));
    rendre(<DetailFrais demandeId={7} roles={ASSISTANTE} />);
    expect(screen.queryByText(F.actions)).not.toBeInTheDocument();
  });

  it("ouvre le rejet motivé", () => {
    charger(demande({}));
    rendre(<DetailFrais demandeId={7} roles={ASSISTANTE} />);
    fireEvent.click(screen.getByRole("button", { name: F.rejeter }));
    expect(screen.getByRole("dialog", { name: F.rejetTitre, hidden: true })).toHaveAttribute("open");
  });
});
