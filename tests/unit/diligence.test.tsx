import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { ModaleDiligence } from "@/components/modules/dossiers/modale-diligence";
import type { Dossier } from "@/types/domaine";
import { rendre as render } from "../utils/rendu";

/**
 * N4: special diligence can be revised after the case file is opened. **Required fields depend on
 * the intent**: proposing and setting need a threshold and a type, removing clears them; the reason
 * is mandatory to propose and to remove, optional for the legal director who sets it.
 */
const proposer = vi.fn();
const modifier = vi.fn();

vi.mock("@/hooks/useDossiers", () => ({
  useProposerDiligence: () => ({ mutateAsync: proposer, isPending: false }),
  useModifierDiligence: () => ({ mutateAsync: modifier, isPending: false }),
}));

vi.mock("@/hooks/useReferentiels", () => ({
  useTypesClientSensible: () => ({
    data: [
      { id: 1, code: "VIP", libelle: "Client VIP" },
      { id: 2, code: "PPE", libelle: "Personne politiquement exposée" },
    ],
  }),
}));

const DOSSIER = {
  id: 7,
  reference: "DOS-2026-0007",
  estSensible: false,
  seuilMontant: null,
  sensibiliteStatut: "EN_ATTENTE",
  sensibiliteMotifRejet: null,
  sensibiliteMotifRetrait: null,
} as unknown as Dossier;

beforeEach(() => {
  proposer.mockReset();
  modifier.mockReset();
  proposer.mockResolvedValue(DOSSIER);
  modifier.mockResolvedValue(DOSSIER);
});

describe("ModaleDiligence", () => {
  it("propose la diligence avec son seuil, son type et ce qui a changé", async () => {
    render(
      <ModaleDiligence dossier={DOSSIER} intention="proposer" ouvert onFermeture={() => {}} />,
    );

    await userEvent.type(screen.getByLabelText(/Seuil proposé/), "60000000");
    await userEvent.selectOptions(screen.getByLabelText(/Type de client/), "VIP");
    await userEvent.type(
      screen.getByLabelText(/Ce qui a changé depuis l’ouverture/),
      "La contrepartie est devenue une personne exposée",
    );
    await userEvent.click(screen.getByRole("button", { name: "Enregistrer" }));

    await waitFor(() =>
      expect(proposer).toHaveBeenCalledWith({
        seuilMontant: 60_000_000,
        typeClientSensible: "VIP",
        motif: "La contrepartie est devenue une personne exposée",
      }),
    );
    expect(modifier).not.toHaveBeenCalled();
  });

  /**
   * A proposal must state what changed: the legal director decides based on that reason. The
   * backend applies the same rule.
   */
  it("refuse une proposition sans motif, et n'appelle pas le serveur", async () => {
    render(
      <ModaleDiligence dossier={DOSSIER} intention="proposer" ouvert onFermeture={() => {}} />,
    );

    await userEvent.type(screen.getByLabelText(/Seuil proposé/), "60000000");
    await userEvent.selectOptions(screen.getByLabelText(/Type de client/), "VIP");
    await userEvent.click(screen.getByRole("button", { name: "Enregistrer" }));

    expect(await screen.findByText("Ce champ est obligatoire.")).toBeInTheDocument();
    expect(proposer).not.toHaveBeenCalled();
  });

  /** The legal director sets it without arbitration: the reason is optional. */
  it("pose la diligence directement, motif facultatif", async () => {
    render(<ModaleDiligence dossier={DOSSIER} intention="poser" ouvert onFermeture={() => {}} />);

    await userEvent.type(screen.getByLabelText(/Seuil proposé/), "75000000");
    await userEvent.selectOptions(screen.getByLabelText(/Type de client/), "PPE");
    await userEvent.click(screen.getByRole("button", { name: "Enregistrer" }));

    await waitFor(() =>
      expect(modifier).toHaveBeenCalledWith({
        estSensible: true,
        seuilMontant: 75_000_000,
        typeClientSensible: "PPE",
        motif: undefined,
      }),
    );
  });

  /**
   * Removal needs neither threshold nor type (it clears them); showing them would suggest they are
   * required.
   */
  it("retire la diligence sans demander de seuil ni de type", async () => {
    const sensible = { ...DOSSIER, estSensible: true, sensibiliteStatut: "VALIDEE" } as Dossier;
    render(<ModaleDiligence dossier={sensible} intention="retirer" ouvert onFermeture={() => {}} />);

    expect(screen.queryByLabelText(/Seuil proposé/)).not.toBeInTheDocument();
    expect(screen.queryByLabelText(/Type de client/)).not.toBeInTheDocument();

    await userEvent.type(
      screen.getByLabelText(/Motif du retrait/),
      "L’affaire s’est révélée ordinaire",
    );
    await userEvent.click(screen.getByRole("button", { name: "Retirer" }));

    await waitFor(() =>
      expect(modifier).toHaveBeenCalledWith({
        estSensible: false,
        motif: "L’affaire s’est révélée ordinaire",
      }),
    );
  });

  /** Lifting diligence takes the case file out of double validation: the audit will ask why. */
  it("refuse un retrait sans motif", async () => {
    const sensible = { ...DOSSIER, estSensible: true, sensibiliteStatut: "VALIDEE" } as Dossier;
    render(<ModaleDiligence dossier={sensible} intention="retirer" ouvert onFermeture={() => {}} />);

    await userEvent.click(screen.getByRole("button", { name: "Retirer" }));

    expect(await screen.findByText("Ce champ est obligatoire.")).toBeInTheDocument();
    expect(modifier).not.toHaveBeenCalled();
  });

  /** Removal is destructive for the case file: its button says so. */
  it("annonce le retrait comme une action à part", () => {
    const sensible = { ...DOSSIER, estSensible: true, sensibiliteStatut: "VALIDEE" } as Dossier;
    render(<ModaleDiligence dossier={sensible} intention="retirer" ouvert onFermeture={() => {}} />);

    expect(screen.getByRole("button", { name: "Retirer" })).toBeInTheDocument();
    expect(screen.getByText(/repasse au seuil global/)).toBeInTheDocument();
  });

  it("traduit les trois intentions", () => {
    const { unmount } = render(
      <ModaleDiligence dossier={DOSSIER} intention="proposer" ouvert onFermeture={() => {}} />,
      { langue: "en" },
    );
    expect(screen.getByText("Propose special attention")).toBeInTheDocument();
    unmount();

    render(<ModaleDiligence dossier={DOSSIER} intention="poser" ouvert onFermeture={() => {}} />, {
      langue: "en",
    });
    expect(screen.getByText("Set the case to special attention")).toBeInTheDocument();
  });
});
