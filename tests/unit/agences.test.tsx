import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { SelecteurAgence } from "@/components/metier/selecteur-agence";
import { rendre as render } from "../utils/rendu";

/**
 * Branch directory. The list **shows** enough to recognize a branch, and the form receives the
 * **code**, never the technical id.
 */
const BONANJO = {
  id: 3,
  code: "00002",
  nom: "BONANJO",
  ville: "Douala",
  adresse: "Quartier administratif Bonanjo",
  telephone: "233 42 68 00",
  actif: true,
};

/** The two namesakes in the directory: same name, same city, different addresses. */
const MBALLA_UN = {
  id: 75,
  code: "00108",
  nom: "MBALLA II",
  ville: "Yaoundé",
  adresse: "Mballa 2",
  telephone: null,
  actif: true,
};
const MBALLA_DEUX = {
  id: 82,
  code: "108",
  nom: "MBALLA II",
  ville: "Yaoundé",
  adresse: "Carrefour Regie",
  telephone: null,
  actif: true,
};

const parametres = vi.fn();
let contenu: unknown[] = [BONANJO];

vi.mock("@/hooks/useReferentiels", () => ({
  useAgences: (params: unknown) => {
    parametres(params);
    return { data: { content: contenu, totalPages: 1, totalElements: contenu.length }, isLoading: false };
  },
}));

describe("SelecteurAgence", () => {
  /**
   * Branch code, name and city are shown. The word "Agence" precedes the name because names are
   * place names, and "00001 HIPPODROME" could read as a location.
   */
  it("affiche code, nom et ville sur la ligne de l'agence", async () => {
    contenu = [BONANJO];
    render(<SelecteurAgence valeur={null} onChangement={() => {}} label="Agence d'origine" />);

    await userEvent.click(screen.getByRole("combobox", { name: /Agence d'origine/ }));

    expect(await screen.findByRole("option", { name: /00002 · Agence BONANJO · Douala/ })).toBeInTheDocument();
  });

  /**
   * Two branches share the same name in the same city: without the address, the list would show
   * them identically.
   */
  it("sépare deux agences homonymes par leur adresse", async () => {
    contenu = [MBALLA_UN, MBALLA_DEUX];
    render(<SelecteurAgence valeur={null} onChangement={() => {}} label="Agence d'origine" />);

    await userEvent.click(screen.getByRole("combobox", { name: /Agence d'origine/ }));

    expect(await screen.findByText("Mballa 2")).toBeInTheDocument();
    expect(screen.getByText("Carrefour Regie")).toBeInTheDocument();
    // Both rows exist and carry different codes.
    expect(screen.getByRole("option", { name: /00108 · Agence MBALLA II/ })).toBeInTheDocument();
    expect(screen.getByRole("option", { name: /^108 · Agence MBALLA II/ })).toBeInTheDocument();
  });

  /**
   * The case file stores the plain **code**, with no foreign key: the form must receive it, not the
   * technical id.
   */
  it("rend le code de l'agence, non son identifiant technique", async () => {
    contenu = [BONANJO];
    const onChangement = vi.fn();
    render(<SelecteurAgence valeur={null} onChangement={onChangement} label="Agence d'origine" />);

    await userEvent.click(screen.getByRole("combobox", { name: /Agence d'origine/ }));
    await userEvent.click(await screen.findByRole("option", { name: /00002 · Agence BONANJO/ }));

    expect(onChangement).toHaveBeenCalledWith("00002");
    expect(onChangement).not.toHaveBeenCalledWith(3);
  });

  /**
   * The selection must stay visible once the list closes, otherwise an empty field would look like
   * lost input.
   */
  it("garde l'agence choisie affichée après la fermeture de la liste", async () => {
    contenu = [BONANJO];
    render(<SelecteurAgence valeur="00002" onChangement={() => {}} label="Agence d'origine" />);

    await waitFor(() =>
      expect(screen.getByRole("combobox", { name: /Agence d'origine/ })).toHaveValue(
        "00002 · Agence BONANJO · Douala",
      ),
    );
  });

  /**
   * The prefix is **translated**: a hard-coded word would leave "Agence" in the English interface.
   */
  it("traduit le mot qui précède le nom", async () => {
    contenu = [BONANJO];
    render(<SelecteurAgence valeur={null} onChangement={() => {}} label="Originating branch" />, {
      langue: "en",
    });

    await userEvent.click(screen.getByRole("combobox", { name: /Originating branch/ }));

    expect(await screen.findByRole("option", { name: /00002 · Branch BONANJO · Douala/ })).toBeInTheDocument();
  });

  /**
   * Offering a closed branch would lead to a code the backend rejects, so the request is always sent
   * with `actifSeulement`.
   */
  it("ne demande que les agences ouvertes", () => {
    contenu = [BONANJO];
    parametres.mockClear();
    render(<SelecteurAgence valeur={null} onChangement={() => {}} label="Agence d'origine" />);

    expect(parametres).toHaveBeenCalledWith(expect.objectContaining({ actifSeulement: true }));
  });
});

/**
 * Required asterisk and help text (N5). The asterisk is red like on every other field, and sits
 * **outside** the `<label>` so the accessible name is the label alone.
 */
describe("SelecteurAgence, marque d'obligation et aide", () => {
  it("rend l'astérisque en rouge, hors du nom accessible du champ", () => {
    contenu = [BONANJO];
    render(
      <SelecteurAgence valeur={null} onChangement={() => {}} label="Agence d'origine" obligatoire />,
    );

    // The accessible name is the label **alone**: that is what a screen reader announces.
    const champ = screen.getByRole("combobox", { name: "Agence d'origine" });
    expect(champ).toHaveAttribute("aria-required", "true");

    const asterisque = screen.getByText("*");
    expect(asterisque).toHaveClass("text-danger");
    // Decorative: the requirement is conveyed by `aria-required`, not by this character.
    expect(asterisque).toHaveAttribute("aria-hidden");
  });

  it("n'affiche aucune astérisque quand le champ est facultatif", () => {
    contenu = [BONANJO];
    render(<SelecteurAgence valeur={null} onChangement={() => {}} label="Agence du contentieux" />);

    expect(screen.queryByText("*")).not.toBeInTheDocument();
    expect(screen.getByRole("combobox", { name: "Agence du contentieux" })).not.toHaveAttribute(
      "aria-required",
    );
  });
});
