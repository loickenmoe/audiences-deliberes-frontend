import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { ModaleDiligence } from "@/components/modules/dossiers/modale-diligence";
import type { Dossier } from "@/types/domaine";
import { rendre as render } from "../utils/rendu";

/**
 * N4 — la diligence particulière se révise après l'ouverture du dossier (métier, 2026-10-03,
 * observation 5 ; les deux sens arrêtés le 2026-10-06).
 *
 * Ce que ces tests tiennent : **ce qui est exigé change avec l'intention**. Proposer et poser
 * demandent un seuil et un type, retirer les efface ; le motif est obligatoire pour proposer et
 * pour retirer, facultatif pour le DJ qui pose. Une modale unique servant trois gestes, c'est
 * exactement là qu'une confusion passerait inaperçue.
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
   * Proposer sans dire ce qui a changé n'a pas de sens : le dossier vivait sans diligence, et le
   * DJ arbitre sur ce motif. Le backend applique la même règle.
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

  /** Le DJ pose sans arbitrage : le motif l'aide, il ne le contraint pas. */
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
   * Le retrait n'a besoin ni de seuil ni de type - il les efface. Les afficher aurait laissé croire
   * qu'il faut les renseigner pour retirer.
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

  /** Lever la diligence sort le dossier du circuit de double validation : l'audit demandera pourquoi. */
  it("refuse un retrait sans motif", async () => {
    const sensible = { ...DOSSIER, estSensible: true, sensibiliteStatut: "VALIDEE" } as Dossier;
    render(<ModaleDiligence dossier={sensible} intention="retirer" ouvert onFermeture={() => {}} />);

    await userEvent.click(screen.getByRole("button", { name: "Retirer" }));

    expect(await screen.findByText("Ce champ est obligatoire.")).toBeInTheDocument();
    expect(modifier).not.toHaveBeenCalled();
  });

  /** Le retrait est destructif à l'échelle du dossier : son bouton le dit. */
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
