import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { ModaleConstitution } from "@/components/modules/dossiers/modale-constitution";
import { rendre } from "../utils/rendu";

/**
 * Les deux enchaînements de la constitution (QF-60, signalé le 2026-10-14).
 *
 * **Ce qui manquait.** Une fois la sollicitation enregistrée, rien ne menait à la rédaction de la
 * lettre : il fallait quitter le dossier, trouver la file des constitutions, et y retrouver sa
 * demande parmi les autres. Or le backend était fait pour cet enchaînement depuis le début - la
 * lettre **naît avec la demande**, sans numéro, « pour que le juriste puisse la rédiger aussitôt ».
 *
 * Ce fichier couvre la première moitié : la modale de sollicitation annonce la demande qu'elle vient
 * de créer. La seconde moitié - la signature qui mène à l'onglet Documents - est vérifiée par le
 * parcours e2e, la navigation étant ce qu'il faut y éprouver.
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

  /** La modale se ferme d'abord : deux boîtes de dialogue empilées cacheraient la rédaction. */
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
   * **Rien ne s'enchaîne sur un échec.** Si l'enregistrement est refusé, il n'y a pas de lettre à
   * rédiger : ouvrir la rédaction afficherait un formulaire sur une demande qui n'existe pas.
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
   * Et une saisie incomplète ne part pas du tout : le serveur n'est pas appelé, donc il n'y a rien
   * à enchaîner. Le reproche est nommé champ par champ.
   */
  it("n'appelle ni le serveur ni l'enchaînement sur une saisie incomplète", async () => {
    const onSollicitee = vi.fn();
    poser(onSollicitee);

    await userEvent.setup().click(screen.getByRole("button", { name: "Soumettre" }));

    expect(solliciter).not.toHaveBeenCalled();
    expect(onSollicitee).not.toHaveBeenCalled();
  });

  /** L'enchaînement est facultatif : la modale reste utilisable sans lui. */
  it("fonctionne sans enchaînement fourni", async () => {
    solliciter.mockResolvedValue({ id: 77 });
    const { onFermeture } = poser(undefined);

    await remplirEtSoumettre();

    await waitFor(() => expect(onFermeture).toHaveBeenCalled());
  });
});
