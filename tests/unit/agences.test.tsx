import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { SelecteurAgence } from "@/components/metier/selecteur-agence";
import { rendre as render } from "../utils/rendu";

/**
 * Le référentiel des agences (métier, 2026-10-03, observation 2).
 *
 * Les deux codes d'agence d'un dossier étaient du texte libre : sur les 341 dossiers de recette, un
 * seul était renseigné - `5466546546` - et il ne désignait aucune agence. Ce que ces tests
 * garantissent est ce qui empêche la faute de revenir : la liste **montre** de quoi reconnaître
 * l'agence, et le formulaire reçoit le **code**, jamais l'identifiant technique.
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

/** Les deux homonymes du référentiel : même nom, même ville, adresses différentes. */
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
   * « Le code de l'agence, son nom et sa ville, pour mieux orienter l'utilisateur » (métier,
   * 2026-10-05) : le code pour celui qui le connaît par cœur, le nom pour celui qui le cherche, la
   * ville pour l'orienter. Le mot « Agence » précède le nom depuis le 2026-10-06 : les noms sont
   * des toponymes, et « 00001 HIPPODROME » pouvait se lire comme un lieu.
   */
  it("affiche code, nom et ville sur la ligne de l'agence", async () => {
    contenu = [BONANJO];
    render(<SelecteurAgence valeur={null} onChangement={() => {}} label="Agence d'origine" />);

    await userEvent.click(screen.getByRole("combobox", { name: /Agence d'origine/ }));

    expect(await screen.findByRole("option", { name: /00002 · Agence BONANJO · Douala/ })).toBeInTheDocument();
  });

  /**
   * Deux agences portent le même nom dans la même ville. Sans l'adresse, la liste les présenterait
   * à l'identique et le choix serait un tirage au sort.
   */
  it("sépare deux agences homonymes par leur adresse", async () => {
    contenu = [MBALLA_UN, MBALLA_DEUX];
    render(<SelecteurAgence valeur={null} onChangement={() => {}} label="Agence d'origine" />);

    await userEvent.click(screen.getByRole("combobox", { name: /Agence d'origine/ }));

    expect(await screen.findByText("Mballa 2")).toBeInTheDocument();
    expect(screen.getByText("Carrefour Regie")).toBeInTheDocument();
    // Les deux lignes existent bel et bien, et portent des codes différents.
    expect(screen.getByRole("option", { name: /00108 · Agence MBALLA II/ })).toBeInTheDocument();
    expect(screen.getByRole("option", { name: /^108 · Agence MBALLA II/ })).toBeInTheDocument();
  });

  /**
   * Le dossier porte le **code** en clair, sans clé étrangère : c'est lui que le formulaire doit
   * recevoir. Rendre l'identifiant technique aurait enregistré « 3 » comme code d'agence.
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
   * Le choix retenu doit rester lisible une fois la liste refermée : l'utilisateur relit son
   * formulaire avant de l'envoyer, et un champ redevenu vide lui ferait croire à une perte de
   * saisie.
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
   * Le préfixe est **traduit**, demandé « en français comme en anglais » (métier, 2026-10-06). Un
   * mot écrit en dur aurait laissé « Agence » dans l'interface anglaise.
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
   * Proposer une agence fermée ferait saisir un code que le backend refuse : la demande part donc
   * toujours avec `actifSeulement`.
   */
  it("ne demande que les agences ouvertes", () => {
    contenu = [BONANJO];
    parametres.mockClear();
    render(<SelecteurAgence valeur={null} onChangement={() => {}} label="Agence d'origine" />);

    expect(parametres).toHaveBeenCalledWith(expect.objectContaining({ actifSeulement: true }));
  });
});
