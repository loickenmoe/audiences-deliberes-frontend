import { fireEvent, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { CasesACocher, SelecteurCherchable } from "@/components/metier";
import { rendre as render } from "../utils/rendu";

const JURISTES = [
  { id: 2, libelle: "Jean Juriste" },
  { id: 3, libelle: "Awa Mbarga" },
];

/**
 * Bloc Affectation (2026-09-22) : les juristes se cochent, les avocats se cherchent. La liste native à
 * sélection multiple qu'ils remplacent exigeait Ctrl (ou Cmd), et un clic sans Ctrl effaçait toute la
 * sélection sans le dire.
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

    // Le legend nomme le groupe seulement s'il est le premier enfant du fieldset.
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
   * En choix multiple, la valeur du champ est la saisie en cours, presque toujours vide : un
   * « required » natif bloquait l'envoi du formulaire de création même avec des avocats choisis.
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
    // Ce qui compte : le navigateur tient le formulaire pour valide, la saisie étant vide.
    expect(champ.required).toBe(false);
    expect(champ.form?.checkValidity()).toBe(true);
    // Et l'obligation reste annoncée aux lecteurs d'écran.
    expect(champ).toHaveAttribute("aria-required", "true");
  });
});
