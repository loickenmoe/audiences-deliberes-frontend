import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { EcranExplications } from "@/components/modules/explications/ecran-explications";
import { rendre as render } from "../utils/rendu";
import type { DemandeExplication } from "@/types/domaine";

/**
 * Explanation requests, from both sides (N7). The same screen serves management and the lawyer,
 * each seeing only their own actions: management writes, the lawyer answers. The screen also
 * **states** before acting that an answer cannot be rewritten, and that automatic reminders pause
 * during the exchange.
 */
/*
 * The list paginates through the URL, like every queue in the application. Outside Next there is no
 * router, so a minimal one is provided.
 */
vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace: vi.fn(), push: vi.fn() }),
  usePathname: () => "/demandes-explication",
  useSearchParams: () => new URLSearchParams(),
}));

const demander = vi.fn();
const repondre = vi.fn();

const EN_ATTENTE: DemandeExplication = {
  id: 1,
  avocatId: 99,
  avocatNom: "Cabinet TAMO",
  dossierId: 7,
  referenceDossier: "DOS-2026-0001",
  auteurNom: "Juridique Dir",
  contenu: "Deux audiences sans compte rendu.",
  dateDemande: "2026-10-07T09:00:00",
  reponse: null,
  dateReponse: null,
  enAttente: true,
};

const REPONDUE: DemandeExplication = {
  ...EN_ATTENTE,
  id: 2,
  reponse: "Le greffe ne m'a pas transmis le plumitif.",
  dateReponse: "2026-10-07T15:00:00",
  enAttente: false,
};

let lignes: DemandeExplication[] = [EN_ATTENTE];

vi.mock("@/hooks/useDemandesExplication", () => ({
  useDemandesExplication: () => ({
    data: { content: lignes, totalPages: 1, totalElements: lignes.length },
    isLoading: false,
    error: null,
    refetch: vi.fn(),
  }),
  useEcritureExplication: () => ({
    demander: { mutateAsync: demander, isPending: false },
    repondre: { mutateAsync: repondre, isPending: false },
  }),
}));

vi.mock("@/hooks/useConstitutions", () => ({
  useRepertoire: () => ({ data: { content: [{ id: 99, nom: "Cabinet TAMO" }] }, isLoading: false }),
}));

const DIRECTION = ["ROLE_DJ"];
const AVOCAT = ["ROLE_AVOCAT"];

beforeEach(() => {
  demander.mockReset().mockResolvedValue(EN_ATTENTE);
  repondre.mockReset().mockResolvedValue(REPONDUE);
  lignes = [EN_ATTENTE];
});

describe("écran des demandes d'explication", () => {
  it("la direction peut écrire, l'avocat non", () => {
    render(<EcranExplications roles={DIRECTION} />);
    expect(screen.getByRole("button", { name: "Demander une explication" })).toBeInTheDocument();
  });

  it("l'avocat ne voit pas le bouton d'écriture", () => {
    render(<EcranExplications roles={AVOCAT} />);
    expect(screen.queryByRole("button", { name: "Demander une explication" })).not.toBeInTheDocument();
  });

  /** Answering is the lawyer's action: management does not answer its own request. */
  it("seul l'avocat se voit proposer de répondre", () => {
    render(<EcranExplications roles={DIRECTION} />);
    expect(screen.queryByRole("button", { name: "Répondre" })).not.toBeInTheDocument();
  });

  it("l'avocat répond à une demande en attente, et sa réponse part", async () => {
    render(<EcranExplications roles={AVOCAT} />);

    await userEvent.click(screen.getByRole("button", { name: "Répondre" }));
    // The request being answered stays visible: no answering from memory.
    expect(screen.getAllByText("Deux audiences sans compte rendu.").length).toBeGreaterThan(0);

    await userEvent.type(screen.getByLabelText("Votre réponse"), "Le greffe n'a rien transmis.");
    await userEvent.click(screen.getByRole("button", { name: "Envoyer" }));

    await waitFor(() => expect(repondre).toHaveBeenCalledTimes(1));
    expect(repondre.mock.calls[0]?.[0]).toEqual({ id: 1, reponse: "Le greffe n'a rien transmis." });
  });

  /**
   * An answer cannot be rewritten: it is a dated statement, so the dialog says so before sending.
   */
  it("annonce qu'on ne répond qu'une fois", async () => {
    render(<EcranExplications roles={AVOCAT} />);

    await userEvent.click(screen.getByRole("button", { name: "Répondre" }));

    expect(screen.getByText(/ne pourra plus être modifiée/)).toBeInTheDocument();
  });

  /** An answered request no longer offers the button and shows the answer. */
  it("une demande répondue affiche la réponse, sans proposer d'y revenir", () => {
    lignes = [REPONDUE];
    render(<EcranExplications roles={AVOCAT} />);

    expect(screen.getByText("Le greffe ne m'a pas transmis le plumitif.")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Répondre" })).not.toBeInTheDocument();
  });

  /**
   * The reminder pause is stated **before** sending, otherwise management would see reminders stop
   * without knowing why.
   */
  it("prévient que la relance automatique se suspend", async () => {
    render(<EcranExplications roles={DIRECTION} />);

    await userEvent.click(screen.getByRole("button", { name: "Demander une explication" }));

    expect(screen.getByText(/la relance automatique de ses comptes rendus est suspendue/)).toBeInTheDocument();
  });

  it("refuse d'envoyer une demande sans avocat désigné", async () => {
    render(<EcranExplications roles={DIRECTION} />);

    await userEvent.click(screen.getByRole("button", { name: "Demander une explication" }));
    await userEvent.type(screen.getByLabelText(/Ce que vous lui demandez/), "Expliquez-vous.");
    await userEvent.click(screen.getByRole("button", { name: "Envoyer" }));

    await waitFor(() => expect(screen.getByText(/Choisissez l’avocat/)).toBeInTheDocument());
    expect(demander).not.toHaveBeenCalled();
  });
});
