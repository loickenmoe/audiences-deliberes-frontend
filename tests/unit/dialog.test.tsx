import { screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { Dialog } from "@/components/ui/dialog";
import { rendre as render } from "../utils/rendu";

/**
 * Un `<dialog>` fermé reste dans le DOM : la fiche dossier en monte plusieurs à la fois. Chacun
 * doit donc porter **son** nom accessible. Avec un identifiant de titre fixe, la confirmation
 * d'affectation s'annonçait « Modifier l'affectation » — le titre de la modale voisine.
 */
describe("Dialog", () => {
  it("donne à chaque modale son propre nom, même quand plusieurs coexistent", () => {
    render(
      <>
        <Dialog ouvert={false} onFermeture={() => {}} titre="Modifier l’affectation" />
        <Dialog ouvert onFermeture={() => {}} titre="Confirmer l’affectation" />
      </>,
    );

    expect(screen.getByRole("dialog", { name: "Confirmer l’affectation" })).toBeInTheDocument();
  });

  it("relie la description à la modale, pour qu'elle soit lue à l'ouverture", () => {
    render(
      <Dialog
        ouvert
        onFermeture={() => {}}
        titre="Demander une dérogation de seuil"
        description="La demande est soumise à l’arbitrage du DJ."
      />,
    );

    expect(screen.getByRole("dialog")).toHaveAccessibleDescription(
      "La demande est soumise à l’arbitrage du DJ.",
    );
  });

  /**
   * Le navigateur émet `close` que la fermeture vienne de l'utilisateur ou du programme. Relayer la
   * seconde rappelait `onFermeture` en cascade : masquer la modale d'affectation pour afficher sa
   * confirmation refermait tout le parcours (ERR-003, F7).
   */
  it("ne relaie pas une fermeture décidée par le parent", () => {
    const onFermeture = vi.fn();
    const { rerender } = render(<Dialog ouvert onFermeture={onFermeture} titre="Affectation" />);

    rerender(<Dialog ouvert={false} onFermeture={onFermeture} titre="Affectation" />);

    expect(onFermeture).not.toHaveBeenCalled();
  });

  it("relaie une fermeture décidée par l'utilisateur (Échap, bouton de fermeture)", () => {
    const onFermeture = vi.fn();
    render(<Dialog ouvert onFermeture={onFermeture} titre="Affectation" />);

    // Échap et `<form method="dialog">` ferment l'élément sans passer par le parent.
    (screen.getByRole("dialog") as HTMLDialogElement).close();

    expect(onFermeture).toHaveBeenCalledTimes(1);
  });
});
