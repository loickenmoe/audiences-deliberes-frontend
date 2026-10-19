import { fireEvent, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { OngletDecisions } from "@/components/modules/dossiers/onglet-decisions";
import type { Dossier } from "@/types/domaine";
import { rendre } from "../utils/rendu";

/**
 * A case file's decisions follow the state of its steps, enforced on screen as on the server:
 * - A sentence, like an award (RG-DEF-01), requires a **closed** step.
 * - Case law requires a **closed** case file with no open step: a decision enters it only once final.
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
  /** Nothing has been judged yet: nothing can be tracked or archived. */
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

  /** An archived step is closed too: it does not reopen the case file. */
  it("compte une étape archivée comme fermée pour la jurisprudence", () => {
    rendre(<OngletDecisions dossier={dossier("CLOTURE", "ARCHIVE")} roles={JURISTE} />);
    expect(archiver()).toBeEnabled();
  });

  /**
   * The sentence of the closed instance can be tracked while the appeal runs, but the decision is
   * not final and does not enter the case law base.
   */
  it("instance clôturée, appel en cours : la condamnation oui, la jurisprudence non", () => {
    rendre(<OngletDecisions dossier={dossier("CLOTURE", "EN_COURS")} roles={JURISTE} />);

    expect(suivre()).toBeEnabled();
    expect(archiver()).toBeDisabled();
  });
});

describe("la modale de condamnation", () => {
  /** Only closed steps are offered, and the step is mandatory. */
  it("n'offre que les étapes clôturées, et exige d'en choisir une", () => {
    rendre(<OngletDecisions dossier={dossier("CLOTURE", "EN_COURS")} roles={JURISTE} />);
    fireEvent.click(suivre());
    const modale = screen.getByRole("dialog", { name: "Suivre une condamnation" });

    const etape = within(modale).getByLabelText(/Étape clôturée/);
    const options = within(etape).getAllByRole("option").map((o) => o.textContent);
    expect(options).toHaveLength(2); // the placeholder and the only closed step
    expect(options.join(" ")).not.toMatch(/Appel/);

    fireEvent.click(within(modale).getByRole("button", { name: "Enregistrer" }));
    expect(within(modale).getAllByText(/obligatoire/i).length).toBeGreaterThan(0);
  });
});
