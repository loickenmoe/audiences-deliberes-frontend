import { fireEvent, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { Dialog } from "@/components/ui/dialog";
import { rendre as render } from "../utils/rendu";

/**
 * A closed `<dialog>` stays in the DOM and the case file screen mounts several at once, so each one
 * must carry **its own** accessible name. A fixed title id would make one dialog announce another's title.
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
   * The browser emits `close` whether closing comes from the user or from code. Relaying the latter
   * would call `onFermeture` in cascade and close the whole flow (ERR-003, F7).
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

    // Escape and the close button close the element without going through the parent.
    (screen.getByRole("dialog") as HTMLDialogElement).close();

    expect(onFermeture).toHaveBeenCalledTimes(1);
  });

  /**
   * The dialog is rendered inside forms, so it must not contain a `<form>` (HTML forbids nesting).
   * Its close button goes through `close()`, the same path as above.
   */
  it("se ferme par son bouton, sans formulaire qui s'imbriquerait dans celui du parent", () => {
    const onFermeture = vi.fn();
    render(
      <form>
        <Dialog ouvert onFermeture={onFermeture} titre="Aperçu" />
      </form>,
    );

    expect(screen.getByRole("dialog").querySelector("form")).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Fermer" }));

    expect(onFermeture).toHaveBeenCalledTimes(1);
  });
});
