import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { ModaleConstitution } from "@/components/modules/dossiers/modale-constitution";
import { rendre } from "../utils/rendu";

/**
 * Retainer flow chaining. Once the request is saved, the user goes straight to drafting the letter,
 * which the backend creates **with the request**, without a number.
 *
 * This file covers the first half: the request dialog announces the request it just created.
 * The second half (signature leading to the Documents tab) is covered by the e2e flow.
 */
const solliciter = vi.fn();
const intervenants = vi.fn();

vi.mock("@/hooks/useConstitutions", () => ({
  useSolliciterConstitution: () => ({ mutateAsync: solliciter, isPending: false }),
}));

vi.mock("@/hooks/useIntervenants", () => ({
  useIntervenants: () => intervenants(),
}));

beforeEach(() => {
  solliciter.mockReset();
  intervenants.mockReturnValue({
    data: { content: [{ id: 4, nom: "Me Claire Avocat", type: "AVOCAT" }] },
    isLoading: false,
    error: null,
  });
});

function poser(onSollicitee?: (id: number) => void, onFermeture = vi.fn()) {
  return {
    onFermeture,
    ...rendre(
      <ModaleConstitution
        dossierId={3}
        ouvert
        onFermeture={onFermeture}
        onSollicitee={onSollicitee}
      />,
    ),
  };
}

async function remplirEtSoumettre() {
  const utilisateur = userEvent.setup();
  await utilisateur.selectOptions(screen.getByLabelText(/Prestataire/), "4");
  await utilisateur.type(screen.getByLabelText(/Motif/), "Saisie immobilière à conduire");
  await utilisateur.click(screen.getByRole("button", { name: "Soumettre" }));
}

describe("la sollicitation enchaîne sur la rédaction de la lettre", () => {
  it("annonce la demande enregistrée, pour que la rédaction puisse s'ouvrir", async () => {
    solliciter.mockResolvedValue({ id: 77 });
    const onSollicitee = vi.fn();
    poser(onSollicitee);

    await remplirEtSoumettre();

    await waitFor(() => expect(onSollicitee).toHaveBeenCalledWith(77));
  });

  /** The dialog closes first: two stacked dialogs would hide the drafting screen. */
  it("ferme la sollicitation avant d'ouvrir la rédaction", async () => {
    solliciter.mockResolvedValue({ id: 77 });
    const ordre: string[] = [];
    const onFermeture = vi.fn(() => void ordre.push("fermeture"));
    const onSollicitee = vi.fn(() => void ordre.push("redaction"));
    poser(onSollicitee, onFermeture);

    await remplirEtSoumettre();

    await waitFor(() => expect(ordre).toEqual(["fermeture", "redaction"]));
  });

  /**
   * **Nothing chains on failure.** If saving is refused there is no letter to draft.
   */
  it("n'enchaîne pas quand l'enregistrement est refusé", async () => {
    solliciter.mockRejectedValue(new Error("Le prestataire est déjà constitué sur ce dossier"));
    const onSollicitee = vi.fn();
    poser(onSollicitee);

    await remplirEtSoumettre();

    await waitFor(() => expect(screen.getByRole("alert")).toBeInTheDocument());
    expect(onSollicitee).not.toHaveBeenCalled();
  });

  /**
   * Incomplete input is not sent at all, so nothing chains. Errors are reported field by field.
   */
  it("n'appelle ni le serveur ni l'enchaînement sur une saisie incomplète", async () => {
    const onSollicitee = vi.fn();
    poser(onSollicitee);

    await userEvent.setup().click(screen.getByRole("button", { name: "Soumettre" }));

    expect(solliciter).not.toHaveBeenCalled();
    expect(onSollicitee).not.toHaveBeenCalled();
  });

  /** Chaining is optional: the dialog works without it. */
  it("fonctionne sans enchaînement fourni", async () => {
    solliciter.mockResolvedValue({ id: 77 });
    const { onFermeture } = poser(undefined);

    await remplirEtSoumettre();

    await waitFor(() => expect(onFermeture).toHaveBeenCalled());
  });
});
