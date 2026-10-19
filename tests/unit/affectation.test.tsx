import { fireEvent, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { CasesACocher, SelecteurCherchable } from "@/components/metier";
import { rendre as render } from "../utils/rendu";

const JURISTES = [
  { id: 2, libelle: "Jean Juriste" },
  { id: 3, libelle: "Awa Mbarga" },
];

/**
 * Assignment block: legal officers are picked with checkboxes, lawyers with a search field.
 * A native multi-select would require Ctrl (or Cmd), and a plain click would silently clear the selection.
 */
describe("CasesACocher", () => {
  it("coche et décoche d'un seul clic, sans effacer les autres choix", () => {
    const onChangement = vi.fn();
    render(<CasesACocher label="Juristes affectés" options={JURISTES} valeur={[2]} onChangement={onChangement} />);

    fireEvent.click(screen.getByRole("checkbox", { name: "Awa Mbarga" }));
    expect(onChangement).toHaveBeenLastCalledWith([2, 3]);

    fireEvent.click(screen.getByRole("checkbox", { name: "Jean Juriste" }));
    expect(onChangement).toHaveBeenLastCalledWith([]);
  });

  it("nomme le groupe par son intitulé et annonce le nombre de choix", () => {
    render(<CasesACocher label="Juristes affectés" obligatoire options={JURISTES} valeur={[2, 3]} onChangement={() => {}} />);

    // The legend names the group only if it is the fieldset's first child.
    expect(screen.getByRole("group", { name: "Juristes affectés" })).toBeInTheDocument();
    expect(screen.getByText("2 sélectionnés")).toBeInTheDocument();
  });

  it("relie son message d'erreur au groupe", () => {
    render(
      <CasesACocher
        label="Juristes affectés"
        options={JURISTES}
        valeur={[]}
        onChangement={() => {}}
        erreur="Ce champ est obligatoire."
      />,
    );

    expect(screen.getByRole("group", { name: "Juristes affectés" })).toHaveAccessibleDescription(
      "Ce champ est obligatoire.",
    );
  });
});

describe("SelecteurCherchable", () => {
  /**
   * In multiple choice, the input value is the current search text, almost always empty: a native
   * "required" would block the creation form even with lawyers selected.
   */
  it("annonce l'obligation sans contrôle natif qui bloquerait un formulaire", () => {
    render(
      <form>
        <SelecteurCherchable
          label="Avocats affectés"
          obligatoire
          multiple
          valeur={[7]}
          onChangement={() => {}}
          options={[{ id: 7, libelle: "Me Fotso" }]}
          onRecherche={() => {}}
        />
      </form>,
    );

    const champ = screen.getByRole("combobox", { name: "Avocats affectés" }) as HTMLInputElement;
    // The browser must consider the form valid even though the input is empty.
    expect(champ.required).toBe(false);
    expect(champ.form?.checkValidity()).toBe(true);
    // The requirement is still announced to screen readers.
    expect(champ).toHaveAttribute("aria-required", "true");
  });
});
