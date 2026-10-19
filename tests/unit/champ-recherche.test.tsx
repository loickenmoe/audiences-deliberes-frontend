import { fireEvent, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { ChampRecherche, DELAI_RECHERCHE } from "@/components/metier/champ-recherche";
import { rendre } from "../utils/rendu";

/**
 * Filtering **as you type**. Key guarantee: one request per **pause**, not per character, otherwise
 * an eight-letter word would reload the list eight times.
 *
 * Uses the real clock with a shortened `delai` prop: fake timers conflict with Testing Library's
 * internal waiting.
 */
describe("champ de recherche au fil de la frappe", () => {
  /** Short enough to keep the suite fast, long enough for clear margins. */
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

    // The input is visible immediately, but nothing has been sent yet.
    expect(screen.getByLabelText("Référence")).toHaveValue("DOS");
    await patienter(MARGE);
    expect(onChangement).not.toHaveBeenCalled();
  });

  it("propage une seule fois après la pause, et non une fois par caractère", async () => {
    const onChangement = vi.fn();
    poser(onChangement);
    const champ = screen.getByLabelText("Référence");

    // Eight successive keystrokes, like a word typed in one go.
    for (const saisie of ["D", "DO", "DOS", "DOS-", "DOS-2", "DOS-20", "DOS-202", "DOS-2026"]) {
      fireEvent.change(champ, { target: { value: saisie } });
    }

    await waitFor(() => expect(onChangement).toHaveBeenCalledTimes(1));
    expect(onChangement).toHaveBeenCalledWith("DOS-2026");
  });

  /**
   * Proves the timer is **reset**, not stacked: without `clearTimeout`, the first partial pause would
   * already have triggered a call.
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

  /** Clearing the field is a search like any other: it removes the filter. */
  it("propage une saisie vidée", async () => {
    const onChangement = vi.fn();
    poser(onChangement, "DOS");

    fireEvent.change(screen.getByLabelText("Référence"), { target: { value: "" } });

    await waitFor(() => expect(onChangement).toHaveBeenCalledWith(""));
  });

  /**
   * The current value comes from the URL. When it changes without typing ("Clear filters" button,
   * shared link, back navigation), the field must follow, or it would show a word that no longer filters.
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
    // This reset is not sent back to the caller: it came from it.
    await patienter(DELAI + MARGE);
    expect(onChangement).not.toHaveBeenCalled();
  });

  /**
   * `onChangement` is recreated on every render by the caller (an arrow function in JSX). If it were
   * an effect dependency, the timer would restart forever.
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
   * **Enter searches immediately**, without waiting for the pause: it is the key everyone presses
   * after typing a search.
   */
  it("cherche aussitôt sur Entrée, sans attendre la pause", async () => {
    const onChangement = vi.fn();
    poser(onChangement);
    const champ = screen.getByLabelText("Référence");

    fireEvent.change(champ, { target: { value: "DOS" } });
    fireEvent.keyDown(champ, { key: "Enter" });

    // No waiting: that is the point of the shortcut.
    expect(onChangement).toHaveBeenCalledWith("DOS");

    // The pending timer does not trigger a second call for the same input.
    await patienter(DELAI + MARGE);
    expect(onChangement).toHaveBeenCalledTimes(1);
  });

  /**
   * **Leaving the field searches immediately.** Otherwise a pending timer firing after a click on a
   * result would call `router.replace` and override the navigation to the case file. Clicking a link
   * blurs first, so the search runs before navigation, and navigation has the last word.
   */
  it("cherche aussitôt en quittant le champ, sans attendre la pause", async () => {
    const onChangement = vi.fn();
    poser(onChangement);
    const champ = screen.getByLabelText("Référence");

    fireEvent.change(champ, { target: { value: "DOS" } });
    fireEvent.blur(champ);

    // No waiting: that is the point.
    expect(onChangement).toHaveBeenCalledWith("DOS");

    // The pending timer does not trigger a second call for the same input.
    await patienter(DELAI + MARGE);
    expect(onChangement).toHaveBeenCalledTimes(1);
  });

  /** Leaving a field without typing anything triggers no search. */
  it("ne cherche pas en quittant un champ inchangé", async () => {
    const onChangement = vi.fn();
    poser(onChangement, "DOS");

    fireEvent.blur(screen.getByLabelText("Référence"));

    await patienter(MARGE);
    expect(onChangement).not.toHaveBeenCalled();
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

  /** The production value matches the rest of the project: 300 ms, like `SelecteurCherchable`. */
  it("applique 300 ms par défaut, la valeur déjà retenue ailleurs", () => {
    expect(DELAI_RECHERCHE).toBe(300);
  });
});
