import { fireEvent, screen, waitFor, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { OngletDecisions } from "@/components/modules/dossiers/onglet-decisions";
import { ErreurApi } from "@/lib/api/errors";
import type { Adjudication, Condamnation, Dossier } from "@/types/domaine";
import { MESSAGES, rendre } from "../utils/rendu";

/**
 * Screen 14 - final decisions: awards, monetary judgments and their payment follow-up, archived
 * decisions. The step rules are covered by `decisions-etape-cloturee.test.tsx`.
 */
const etat = vi.hoisted(() => ({
  decisions: { data: undefined as unknown, isLoading: false, error: null as unknown },
  archives: { data: undefined as unknown, isLoading: false, error: null as unknown, refetch: vi.fn() },
}));
const mutations = vi.hoisted(() => ({ adjudication: vi.fn(), condamnation: vi.fn(), statut: vi.fn() }));

vi.mock("@/hooks/useDecisions", () => ({
  useDecisionsDossier: () => etat.decisions,
  useJurisprudences: () => etat.archives,
  useCreerAdjudication: () => ({ mutateAsync: mutations.adjudication, isPending: false }),
  useCreerCondamnation: () => ({ mutateAsync: mutations.condamnation, isPending: false }),
  useModifierStatutCondamnation: () => ({ mutateAsync: mutations.statut, isPending: false }),
}));
vi.mock("@/components/modules/jurisprudence/liste-jurisprudences", () => ({
  ListeJurisprudences: ({ jurisprudences }: { jurisprudences: unknown[] }) => (
    <p>{`${jurisprudences.length} décision(s) archivée(s)`}</p>
  ),
}));
vi.mock("@/components/modules/jurisprudence/modale-archivage", () => ({
  ModaleArchivage: ({ ouvert }: { ouvert: boolean }) => (ouvert ? <p>Archivage ouvert</p> : null),
}));

const toast = vi.hoisted(() => ({ success: vi.fn(), error: vi.fn() }));
vi.mock("sonner", () => ({ toast }));

const T = MESSAGES.fr.decisions;
const C = MESSAGES.fr.commun;
const OBLIGATOIRE = MESSAGES.fr.metier.champObligatoire;
const JURISTE = ["ROLE_JURISTE", "ROLE_CONSULTATION"];

const DOSSIER = {
  id: 3,
  etapes: [
    { id: 5, type: "INSTANCE", statutCycleVie: "CLOTURE" },
    { id: 6, type: "RECOURS_1", statutCycleVie: "CLOTURE" },
  ],
} as unknown as Dossier;

const ADJUDICATION: Adjudication = {
  id: 1,
  dossierId: 3,
  etapeId: 5,
  beneficiaire: "Afriland First Bank",
  statutComptabilisation: "ECR-2026-01",
  repriseProvision: true,
  restitutionSoulte: true,
  mutation: true,
  reliquat: 250000,
  dateDecision: "2026-09-01",
  createdAt: "2026-09-01T10:00:00",
  updatedAt: null,
};

const CONDAMNATION: Condamnation = {
  id: 2,
  dossierId: 3,
  etapeId: null,
  sens: "TIERS_REDEVABLE",
  naturePaiement: "Dommages et intérêts",
  statutPaiement: "EN_ATTENTE",
  dateDecision: "2026-09-02",
  createdAt: "2026-09-02T10:00:00",
  updatedAt: null,
};

function modale(titre: string) {
  return screen.getByRole("dialog", { name: titre, hidden: true });
}

function champ(conteneur: HTMLElement, libelle: string) {
  return within(conteneur).getByLabelText(libelle, { exact: false });
}

beforeEach(() => {
  vi.clearAllMocks();
  etat.decisions = { data: { adjudications: [ADJUDICATION], condamnations: [CONDAMNATION] }, isLoading: false, error: null };
  etat.archives = { data: { content: [] }, isLoading: false, error: null, refetch: vi.fn() };
  for (const mutation of Object.values(mutations)) mutation.mockResolvedValue({});
});

describe("OngletDecisions - listes", () => {
  it("affiche le chargement puis l'erreur des décisions", () => {
    etat.decisions = { data: undefined, isLoading: true, error: null };
    const { rerender } = rendre(<OngletDecisions dossier={DOSSIER} roles={JURISTE} />);
    expect(screen.getByRole("status")).toBeInTheDocument();

    etat.decisions = { data: undefined, isLoading: false, error: new ErreurApi({ code: "X", message: "Décisions indisponibles" }) };
    rerender(<OngletDecisions dossier={DOSSIER} roles={JURISTE} />);
    expect(screen.getByText("Décisions indisponibles")).toBeInTheDocument();
  });

  it("détaille l'adjudication et son suivi financier", () => {
    rendre(<OngletDecisions dossier={DOSSIER} roles={JURISTE} />);

    expect(screen.getByText("Afriland First Bank")).toBeInTheDocument();
    expect(screen.getByText("Comptabilisation : ECR-2026-01")).toBeInTheDocument();
    expect(screen.getAllByText(T.repriseProvision).length).toBeGreaterThan(0);
    expect(screen.getAllByText(T.mutation).length).toBeGreaterThan(0);
    // A judgment without a step keeps an explicit dash.
    expect(screen.getByText("—")).toBeInTheDocument();
  });

  it("montre le statut de paiement en lecture seule à qui ne gère pas les décisions", () => {
    rendre(<OngletDecisions dossier={DOSSIER} roles={["ROLE_CONSULTATION"]} />);

    expect(screen.getByText(MESSAGES.fr.domaine.StatutPaiementCondamnation.EN_ATTENTE)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: T.mettreAJour })).not.toBeInTheDocument();
  });

  it("dit quand il n'y a ni adjudication ni condamnation", () => {
    etat.decisions = { data: { adjudications: [], condamnations: [] }, isLoading: false, error: null };
    rendre(<OngletDecisions dossier={DOSSIER} roles={JURISTE} />);

    expect(screen.getByText(T.aucuneAdjudication)).toBeInTheDocument();
    expect(screen.getByText(T.aucuneCondamnation)).toBeInTheDocument();
    expect(screen.getByText(T.aucuneArchivee)).toBeInTheDocument();
  });

  it("affiche les décisions archivées, leur chargement et leur erreur", () => {
    etat.archives = { data: { content: [{ id: 1 }, { id: 2 }] }, isLoading: false, error: null, refetch: vi.fn() };
    const { rerender } = rendre(<OngletDecisions dossier={DOSSIER} roles={JURISTE} />);
    expect(screen.getByText("2 décision(s) archivée(s)")).toBeInTheDocument();

    etat.archives = { data: undefined, isLoading: true, error: null, refetch: vi.fn() };
    rerender(<OngletDecisions dossier={DOSSIER} roles={JURISTE} />);
    expect(screen.getByRole("status")).toBeInTheDocument();

    etat.archives = { data: undefined, isLoading: false, error: new ErreurApi({ code: "X", message: "Archives indisponibles" }), refetch: vi.fn() };
    rerender(<OngletDecisions dossier={DOSSIER} roles={JURISTE} />);
    expect(screen.getByText("Archives indisponibles")).toBeInTheDocument();
  });

  it("ouvre l'archivage d'un dossier clos", () => {
    rendre(<OngletDecisions dossier={DOSSIER} roles={JURISTE} />);
    fireEvent.click(screen.getByRole("button", { name: T.archiver }));
    expect(screen.getByText("Archivage ouvert")).toBeInTheDocument();
  });
});

describe("OngletDecisions - suivi du paiement", () => {
  it("met à jour le statut choisi, et seulement s'il change", async () => {
    rendre(<OngletDecisions dossier={DOSSIER} roles={JURISTE} />);
    const bouton = screen.getByRole("button", { name: T.mettreAJour });
    expect(bouton).toBeDisabled();

    fireEvent.change(screen.getByLabelText("Statut de paiement - Dommages et intérêts"), { target: { value: "PAYE" } });
    fireEvent.click(bouton);

    await waitFor(() => expect(mutations.statut).toHaveBeenCalledWith({ id: 2, statutPaiement: "PAYE" }));
    expect(toast.success).toHaveBeenCalledWith(T.statutMisAJour);
  });

  it("signale un échec de mise à jour", async () => {
    mutations.statut.mockRejectedValue(new ErreurApi({ code: "X", message: "Refusé" }));
    rendre(<OngletDecisions dossier={DOSSIER} roles={JURISTE} />);
    fireEvent.change(screen.getByLabelText("Statut de paiement - Dommages et intérêts"), {
      target: { value: "RECOUVREMENT_FORCE" },
    });
    fireEvent.click(screen.getByRole("button", { name: T.mettreAJour }));

    await waitFor(() => expect(toast.error).toHaveBeenCalledWith("Refusé"));
  });
});

describe("OngletDecisions - adjudication", () => {
  function ouvrir() {
    rendre(<OngletDecisions dossier={DOSSIER} roles={JURISTE} />);
    fireEvent.click(screen.getByRole("button", { name: T.enregistrerAdjudication }));
    return modale(T.enregistrerAdjudication);
  }

  it("exige l'étape, le bénéficiaire, la comptabilisation et un reliquat positif", async () => {
    const fenetre = ouvrir();
    fireEvent.change(champ(fenetre, T.champReliquat), { target: { value: "" } });
    fireEvent.click(within(fenetre).getByRole("button", { name: C.enregistrer, hidden: true }));
    expect(await within(fenetre).findAllByText(OBLIGATOIRE)).toHaveLength(4);

    fireEvent.change(champ(fenetre, T.champReliquat), { target: { value: "-5" } });
    fireEvent.click(within(fenetre).getByRole("button", { name: C.enregistrer, hidden: true }));
    expect(await within(fenetre).findByText(T.reliquatNegatif)).toBeInTheDocument();
    expect(mutations.adjudication).not.toHaveBeenCalled();
  });

  it("enregistre l'adjudication et son suivi financier", async () => {
    const fenetre = ouvrir();
    fireEvent.change(champ(fenetre, T.champEtape), { target: { value: "6" } });
    fireEvent.change(champ(fenetre, T.champBeneficiaire), { target: { value: " Afriland " } });
    fireEvent.change(champ(fenetre, T.champComptabilisation), { target: { value: "ECR-1" } });
    fireEvent.click(within(fenetre).getByLabelText(T.repriseProvision));
    fireEvent.click(within(fenetre).getByLabelText(T.restitutionSoulte));
    fireEvent.click(within(fenetre).getByLabelText(T.mutation));
    fireEvent.change(champ(fenetre, T.champReliquat), { target: { value: "1000" } });
    fireEvent.change(champ(fenetre, T.champDate), { target: { value: "2026-10-01" } });
    fireEvent.click(within(fenetre).getByRole("button", { name: C.enregistrer, hidden: true }));

    await waitFor(() =>
      expect(mutations.adjudication).toHaveBeenCalledWith({
        etapeId: 6,
        beneficiaire: "Afriland",
        statutComptabilisation: "ECR-1",
        repriseProvision: true,
        restitutionSoulte: true,
        mutation: true,
        reliquat: 1000,
        dateDecision: "2026-10-01",
      }),
    );
    expect(toast.success).toHaveBeenCalledWith(T.adjudicationEnregistree);
  });

  it("affiche le refus d'enregistrer l'adjudication", async () => {
    mutations.adjudication.mockRejectedValue(new ErreurApi({ code: "X", message: "Étape non clôturée" }));
    const fenetre = ouvrir();
    fireEvent.change(champ(fenetre, T.champEtape), { target: { value: "5" } });
    fireEvent.change(champ(fenetre, T.champBeneficiaire), { target: { value: "Afriland" } });
    fireEvent.change(champ(fenetre, T.champComptabilisation), { target: { value: "ECR-1" } });
    fireEvent.click(within(fenetre).getByRole("button", { name: C.enregistrer, hidden: true }));

    expect(await within(fenetre).findByText("Étape non clôturée")).toBeInTheDocument();
  });

  it("présélectionne l'étape quand une seule est clôturée", () => {
    const unique = { ...DOSSIER, etapes: [DOSSIER.etapes[0]] } as Dossier;
    rendre(<OngletDecisions dossier={unique} roles={JURISTE} />);
    fireEvent.click(screen.getByRole("button", { name: T.enregistrerAdjudication }));

    expect(champ(modale(T.enregistrerAdjudication), T.champEtape)).toHaveValue("5");
  });
});

describe("OngletDecisions - condamnation", () => {
  function ouvrir() {
    rendre(<OngletDecisions dossier={DOSSIER} roles={JURISTE} />);
    fireEvent.click(screen.getByRole("button", { name: T.suivreCondamnation }));
    return modale(T.suivreCondamnation);
  }

  it("exige le sens, la nature et l'étape, puis enregistre", async () => {
    const fenetre = ouvrir();
    fireEvent.click(within(fenetre).getByRole("button", { name: C.enregistrer, hidden: true }));
    expect(await within(fenetre).findAllByText(OBLIGATOIRE)).toHaveLength(3);

    fireEvent.change(champ(fenetre, T.champSens), { target: { value: "BANQUE_REDEVABLE" } });
    fireEvent.change(champ(fenetre, T.champNature), { target: { value: " Astreinte " } });
    fireEvent.change(champ(fenetre, T.champEtape), { target: { value: "5" } });
    fireEvent.change(champ(fenetre, T.champDate), { target: { value: "2026-10-02" } });
    fireEvent.click(within(fenetre).getByRole("button", { name: C.enregistrer, hidden: true }));

    await waitFor(() =>
      expect(mutations.condamnation).toHaveBeenCalledWith({
        sens: "BANQUE_REDEVABLE",
        naturePaiement: "Astreinte",
        dateDecision: "2026-10-02",
        etapeId: 5,
      }),
    );
    expect(toast.success).toHaveBeenCalledWith(T.condamnationEnregistree);
  });

  it("affiche le refus d'enregistrer la condamnation", async () => {
    mutations.condamnation.mockRejectedValue(new ErreurApi({ code: "X", message: "Condamnation refusée" }));
    const fenetre = ouvrir();
    fireEvent.change(champ(fenetre, T.champSens), { target: { value: "BANQUE_REDEVABLE" } });
    fireEvent.change(champ(fenetre, T.champNature), { target: { value: "Astreinte" } });
    fireEvent.change(champ(fenetre, T.champEtape), { target: { value: "5" } });
    fireEvent.click(within(fenetre).getByRole("button", { name: C.enregistrer, hidden: true }));

    expect(await within(fenetre).findByText("Condamnation refusée")).toBeInTheDocument();
  });
});
