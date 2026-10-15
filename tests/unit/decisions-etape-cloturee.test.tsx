import { fireEvent, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { OngletDecisions } from "@/components/modules/dossiers/onglet-decisions";
import type { Dossier } from "@/types/domaine";
import { rendre } from "../utils/rendu";

/**
 * Les décisions d'un dossier suivent l'état de ses étapes (QF-66, demandé le 2026-10-15).
 *
 * **Le défaut.** Sur un dossier tout juste créé, à l'étape Ouverture, l'onglet Décisions proposait
 * « Suivre une condamnation » et « Archiver à la jurisprudence ». La condamnation n'avait aucune
 * règle ; la jurisprudence en avait une côté serveur, mais l'écran laissait remplir tout le
 * formulaire avant de refuser.
 *
 * **Les deux règles, désormais tenues à l'écran comme au serveur.**
 * - La condamnation, comme l'adjudication (RG-DEF-01) : une étape **clôturée**, obligatoire.
 * - La jurisprudence : le dossier **clos**, plus aucune étape ouverte - une décision n'y entre
 *   qu'une fois définitive.
 */
vi.mock("@/hooks/useDecisions", () => ({
  useDecisionsDossier: () => ({ data: { adjudications: [], condamnations: [] }, isLoading: false, error: null }),
  useJurisprudences: () => ({ data: { content: [] }, isLoading: false, error: null, refetch: vi.fn() }),
  useCreerAdjudication: () => ({ mutateAsync: vi.fn(), isPending: false }),
  useCreerCondamnation: () => ({ mutateAsync: vi.fn(), isPending: false }),
  useModifierStatutCondamnation: () => ({ mutateAsync: vi.fn(), isPending: false }),
  useArchiverJurisprudence: () => ({ mutateAsync: vi.fn(), isPending: false }),
}));

const JURISTE = ["ROLE_JURISTE", "ROLE_SAISIE", "ROLE_CONSULTATION"];

function dossier(...statuts: string[]): Dossier {
  return {
    id: 3,
    reference: "DOS-2026-003",
    etapes: statuts.map((statut, index) => ({
      id: index + 1,
      type: index === 0 ? "INSTANCE" : "APPEL",
      statutCycleVie: statut,
    })),
  } as unknown as Dossier;
}

const suivre = () => screen.getByRole("button", { name: "Suivre une condamnation" });
const archiver = () => screen.getByRole("button", { name: "Archiver à la jurisprudence" });

describe("un dossier tout juste ouvert", () => {
  /** Le cas signalé : rien n'a été jugé, rien ne se suit ni ne s'archive. */
  it("ne permet ni de suivre une condamnation, ni d'archiver, et dit pourquoi", () => {
    rendre(<OngletDecisions dossier={dossier("OUVERTURE")} roles={JURISTE} />);

    expect(suivre()).toBeDisabled();
    expect(archiver()).toBeDisabled();
    expect(screen.getByText(/Une condamnation se suit une fois l’étape clôturée/)).toBeInTheDocument();
    expect(screen.getByText(/toutes les étapes de ce dossier doivent être clôturées/)).toBeInTheDocument();
  });
});

describe("un dossier dont l'étape est clôturée", () => {
  it("permet de suivre une condamnation et d'archiver", () => {
    rendre(<OngletDecisions dossier={dossier("CLOTURE")} roles={JURISTE} />);

    expect(suivre()).toBeEnabled();
    expect(archiver()).toBeEnabled();
    expect(screen.queryByText(/Une condamnation se suit une fois l’étape clôturée/)).not.toBeInTheDocument();
  });

  /** Une étape archivée est fermée aussi : elle ne rouvre pas le dossier. */
  it("compte une étape archivée comme fermée pour la jurisprudence", () => {
    rendre(<OngletDecisions dossier={dossier("CLOTURE", "ARCHIVE")} roles={JURISTE} />);
    expect(archiver()).toBeEnabled();
  });

  /**
   * La condamnation de l'instance clôturée se suit pendant que l'appel court ; mais la décision
   * n'est pas définitive, et n'entre pas dans la base jurisprudentielle.
   */
  it("instance clôturée, appel en cours : la condamnation oui, la jurisprudence non", () => {
    rendre(<OngletDecisions dossier={dossier("CLOTURE", "EN_COURS")} roles={JURISTE} />);

    expect(suivre()).toBeEnabled();
    expect(archiver()).toBeDisabled();
  });
});

describe("la modale de condamnation", () => {
  /** Elle ne propose que les étapes clôturées, et l'étape y est obligatoire. */
  it("n'offre que les étapes clôturées, et exige d'en choisir une", () => {
    rendre(<OngletDecisions dossier={dossier("CLOTURE", "EN_COURS")} roles={JURISTE} />);
    fireEvent.click(suivre());
    const modale = screen.getByRole("dialog", { name: "Suivre une condamnation" });

    const etape = within(modale).getByLabelText(/Étape clôturée/);
    const options = within(etape).getAllByRole("option").map((o) => o.textContent);
    expect(options).toHaveLength(2); // l'invite, et la seule étape clôturée
    expect(options.join(" ")).not.toMatch(/Appel/);

    fireEvent.click(within(modale).getByRole("button", { name: "Enregistrer" }));
    expect(within(modale).getAllByText(/obligatoire/i).length).toBeGreaterThan(0);
  });
});
