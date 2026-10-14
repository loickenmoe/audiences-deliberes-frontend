import { fireEvent, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { ChampRecherche, DELAI_RECHERCHE } from "@/components/metier/champ-recherche";
import { rendre } from "../utils/rendu";

/**
 * Le filtrage **au fil de la frappe** (QF-57).
 *
 * **Le défaut corrigé.** Les filtres textuels des listes se validaient sur `onBlur` : il fallait
 * quitter le champ pour voir le résultat. Signalé en recette le 2026-10-14 - on tape, et rien ne se
 * passe.
 *
 * **Ce que ces tests protègent, et qui est tout l'enjeu.** Une requête par **pause**, pas par
 * caractère. C'était la seule objection valable à `onChange`, écrite noir sur blanc dans le code
 * d'origine : « écrire dans l'URL à chaque frappe produirait une requête par caractère ». Si le
 * délai sautait, le défaut reviendrait sous une autre forme - une liste rechargée huit fois pour un
 * mot de huit lettres.
 *
 * **Horloge réelle, et délai raccourci par la propriété prévue pour cela.** Les minuteurs simulés
 * entrent en conflit avec l'attente interne de Testing Library : les six tests expiraient. Le
 * composant expose déjà `delai`, et mieux vaut un test rapide sur la vraie horloge qu'un test bloqué
 * sur une fausse.
 */
describe("champ de recherche au fil de la frappe", () => {
  /** Assez court pour que la suite reste rapide, assez long pour que les marges soient franches. */
  const DELAI = 200;
  const MARGE = 70;

  const patienter = (ms: number) => new Promise((resoudre) => setTimeout(resoudre, ms));

  function poser(onChangement: (valeur: string) => void, valeur = "") {
    return rendre(
      <ChampRecherche
        id="f"
        label="Référence"
        valeur={valeur}
        onChangement={onChangement}
        delai={DELAI}
      />,
    );
  }

  it("garde la frappe à l'écran sans rien propager tant qu'elle continue", async () => {
    const onChangement = vi.fn();
    poser(onChangement);

    fireEvent.change(screen.getByLabelText("Référence"), { target: { value: "DOS" } });

    // La saisie est visible aussitôt - c'est ce qui manquait -, mais rien n'est encore parti.
    expect(screen.getByLabelText("Référence")).toHaveValue("DOS");
    await patienter(MARGE);
    expect(onChangement).not.toHaveBeenCalled();
  });

  it("propage une seule fois après la pause, et non une fois par caractère", async () => {
    const onChangement = vi.fn();
    poser(onChangement);
    const champ = screen.getByLabelText("Référence");

    // Huit frappes successives, comme un mot tapé d'un trait.
    for (const saisie of ["D", "DO", "DOS", "DOS-", "DOS-2", "DOS-20", "DOS-202", "DOS-2026"]) {
      fireEvent.change(champ, { target: { value: saisie } });
    }

    await waitFor(() => expect(onChangement).toHaveBeenCalledTimes(1));
    expect(onChangement).toHaveBeenCalledWith("DOS-2026");
  });

  /**
   * Le cas qui prouve que le minuteur est **réarmé** et non empilé : sans le `clearTimeout`, la
   * première pause partielle aurait déjà déclenché un appel.
   */
  it("réarme le délai à chaque frappe", async () => {
    const onChangement = vi.fn();
    poser(onChangement);
    const champ = screen.getByLabelText("Référence");

    fireEvent.change(champ, { target: { value: "DO" } });
    await patienter(DELAI - MARGE);
    expect(onChangement).not.toHaveBeenCalled();

    fireEvent.change(champ, { target: { value: "DOS" } });
    await patienter(DELAI - MARGE);
    expect(onChangement).not.toHaveBeenCalled();

    await waitFor(() => expect(onChangement).toHaveBeenCalledTimes(1));
    expect(onChangement).toHaveBeenCalledWith("DOS");
  });

  /** Vider le champ est une recherche comme une autre : elle retire le filtre. */
  it("propage une saisie vidée", async () => {
    const onChangement = vi.fn();
    poser(onChangement, "DOS");

    fireEvent.change(screen.getByLabelText("Référence"), { target: { value: "" } });

    await waitFor(() => expect(onChangement).toHaveBeenCalledWith(""));
  });

  /**
   * La valeur en vigueur vient de l'URL. Quand elle change sans passer par la frappe - bouton
   * « Effacer les filtres », lien partagé, retour arrière -, le champ doit suivre : sans cela il
   * garderait à l'écran un mot qui ne filtre plus rien.
   */
  it("suit une remise à zéro venue de l'extérieur, sans la renvoyer", async () => {
    const onChangement = vi.fn();
    const { rerender } = poser(onChangement, "DOS");
    expect(screen.getByLabelText("Référence")).toHaveValue("DOS");

    rerender(
      <ChampRecherche
        id="f"
        label="Référence"
        valeur=""
        onChangement={onChangement}
        delai={DELAI}
      />,
    );

    expect(screen.getByLabelText("Référence")).toHaveValue("");
    // Et cette remise à zéro ne repart pas vers l'appelant : elle vient de lui.
    await patienter(DELAI + MARGE);
    expect(onChangement).not.toHaveBeenCalled();
  });

  /**
   * Le piège qui aurait bouclé : `onChangement` est recréée à chaque rendu par l'appelant - une
   * fonction fléchée dans le JSX. Si elle entrait dans les dépendances de l'effet, le minuteur
   * repartirait sans fin.
   */
  it("ne boucle pas quand l'appelant recrée sa fonction à chaque rendu", async () => {
    const espion = vi.fn();
    const { rerender } = rendre(
      <ChampRecherche
        id="f"
        label="Référence"
        valeur=""
        onChangement={(v) => espion(v)}
        delai={DELAI}
      />,
    );

    fireEvent.change(screen.getByLabelText("Référence"), { target: { value: "A" } });
    for (let tour = 0; tour < 5; tour += 1) {
      rerender(
        <ChampRecherche
          id="f"
          label="Référence"
          valeur=""
          onChangement={(v) => espion(v)}
          delai={DELAI}
        />,
      );
    }

    await waitFor(() => expect(espion).toHaveBeenCalledTimes(1));
    await patienter(DELAI * 2);
    expect(espion).toHaveBeenCalledTimes(1);
  });

  /**
   * **Entrée cherche tout de suite**, sans attendre la pause.
   *
   * Deux écrans offraient déjà ce raccourci avant QF-57 - la base jurisprudentielle et le répertoire
   * des avocats. Le fil de la frappe le rend inutile, mais le retirer aurait enlevé une habitude à
   * qui l'avait prise, et c'est la touche que tout le monde presse après avoir tapé une recherche.
   */
  it("cherche aussitôt sur Entrée, sans attendre la pause", async () => {
    const onChangement = vi.fn();
    poser(onChangement);
    const champ = screen.getByLabelText("Référence");

    fireEvent.change(champ, { target: { value: "DOS" } });
    fireEvent.keyDown(champ, { key: "Enter" });

    // Sans attente : c'est tout l'objet du raccourci.
    expect(onChangement).toHaveBeenCalledWith("DOS");

    // Et le minuteur en cours ne provoque pas un second appel pour la même saisie.
    await patienter(DELAI + MARGE);
    expect(onChangement).toHaveBeenCalledTimes(1);
  });

  it("ignore les autres touches", () => {
    const onChangement = vi.fn();
    poser(onChangement);
    const champ = screen.getByLabelText("Référence");

    fireEvent.change(champ, { target: { value: "DOS" } });
    fireEvent.keyDown(champ, { key: "a" });
    fireEvent.keyDown(champ, { key: "Escape" });

    expect(onChangement).not.toHaveBeenCalled();
  });

  /** La valeur de production reste celle du reste du projet : 300 ms, comme `SelecteurCherchable`. */
  it("applique 300 ms par défaut, la valeur déjà retenue ailleurs", () => {
    expect(DELAI_RECHERCHE).toBe(300);
  });
});
