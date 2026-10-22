import { fireEvent, screen, waitFor, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { FormulaireAgence } from "@/components/modules/administration/formulaire-agence";
import { ListeAgences } from "@/components/modules/administration/liste-agences";
import { ErreurApi } from "@/lib/api/errors";
import type { Agence } from "@/types/domaine";
import { MESSAGES, rendre } from "../utils/rendu";

/**
 * Branch reference list: readable by all, administered by the DJ/DJA. Branches are closed and
 * reopened, never deleted; the code is fixed once created.
 */
const etat = vi.hoisted(() => ({ agences: { data: undefined as unknown, isLoading: false, error: null as unknown, refetch: vi.fn() } }));
const parametres = vi.hoisted(() => vi.fn());
const ecriture = vi.hoisted(() => ({
  creer: { mutateAsync: vi.fn(), isPending: false, reset: vi.fn() },
  modifier: { mutateAsync: vi.fn(), isPending: false, reset: vi.fn() },
  desactiver: { mutateAsync: vi.fn(), isPending: false },
  reactiver: { mutateAsync: vi.fn(), isPending: false },
}));

vi.mock("@/hooks/useReferentiels", () => ({
  useAgences: (p: unknown) => {
    parametres(p);
    return etat.agences;
  },
  useEcritureAgence: () => ecriture,
}));

const toast = vi.hoisted(() => ({ success: vi.fn(), error: vi.fn() }));
vi.mock("sonner", () => ({ toast }));

const A = MESSAGES.fr.agences;
const C = MESSAGES.fr.commun;
const DJ = ["ROLE_DJ", "ROLE_JURISTE", "ROLE_CONSULTATION"];
const LECTEUR = ["ROLE_CONSULTATION"];

const BONANJO: Agence = { id: 3, code: "00002", nom: "BONANJO", ville: "Douala", adresse: null, telephone: null, actif: true } as Agence;
const FERMEE: Agence = { id: 4, code: "00009", nom: "AKWA", ville: "Douala", adresse: "Rue X", telephone: "233", actif: false } as Agence;

function liste(agences: Agence[]) {
  etat.agences = { data: { content: agences, totalPages: 1, totalElements: agences.length }, isLoading: false, error: null, refetch: vi.fn() };
}

beforeEach(() => {
  vi.clearAllMocks();
  liste([BONANJO, FERMEE]);
  for (const mutation of Object.values(ecriture)) mutation.mutateAsync.mockResolvedValue({});
});

describe("ListeAgences", () => {
  it("affiche le chargement, l'erreur avec une relance, et le référentiel vide", () => {
    etat.agences = { data: undefined, isLoading: true, error: null, refetch: vi.fn() };
    const { rerender } = rendre(<ListeAgences roles={DJ} />);
    expect(screen.getByRole("status")).toBeInTheDocument();

    etat.agences = { data: undefined, isLoading: false, error: new ErreurApi({ code: "X", message: "Référentiel indisponible" }), refetch: vi.fn() };
    rerender(<ListeAgences roles={DJ} />);
    fireEvent.click(screen.getByRole("button", { name: A.reessayer }));
    expect(etat.agences.refetch).toHaveBeenCalled();

    liste([]);
    rerender(<ListeAgences roles={DJ} />);
    expect(screen.getByText(A.aucuneAgenceTexte)).toBeInTheDocument();
    expect(screen.getAllByRole("button", { name: A.nouvelleAgence })).toHaveLength(2);
  });

  it("cherche toutes les agences, fermées comprises, et revient en première page", () => {
    liste([]);
    rendre(<ListeAgences roles={LECTEUR} />);
    fireEvent.change(screen.getByLabelText(A.rechercher), { target: { value: "bona" } });

    expect(parametres).toHaveBeenLastCalledWith({ recherche: "bona", actifSeulement: false, page: 0, size: 25 });
    expect(screen.getByText(A.aucuneAgenceRecherche)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: A.nouvelleAgence })).not.toBeInTheDocument();
  });

  it("montre l'état de chaque agence, sans action en lecture seule", () => {
    rendre(<ListeAgences roles={LECTEUR} />);

    expect(screen.getByText(A.ouverte)).toBeInTheDocument();
    expect(screen.getByText(A.fermee)).toBeInTheDocument();
    expect(screen.getAllByText("-")).toHaveLength(2);
    expect(screen.queryByRole("button", { name: "Modifier l’agence BONANJO" })).not.toBeInTheDocument();
  });

  it("désactive après confirmation, et signale un échec", async () => {
    ecriture.desactiver.mutateAsync.mockResolvedValueOnce({}).mockRejectedValueOnce(new ErreurApi({ code: "X", message: "Refusé" }));
    rendre(<ListeAgences roles={DJ} />);
    const desactiver = () => {
      fireEvent.click(screen.getByRole("button", { name: "Désactiver l’agence BONANJO" }));
      const fenetre = screen.getByRole("dialog", { name: A.desactiverTitre, hidden: true });
      fireEvent.click(within(fenetre).getByRole("button", { name: A.desactiver, hidden: true }));
    };

    desactiver();
    await waitFor(() => expect(toast.success).toHaveBeenCalledWith("L’agence BONANJO est désactivée."));
    expect(ecriture.desactiver.mutateAsync).toHaveBeenCalledWith(3);
    desactiver();
    await waitFor(() => expect(toast.error).toHaveBeenCalledWith("Refusé"));
  });

  it("rouvre sans confirmation, et signale un échec", async () => {
    ecriture.reactiver.mutateAsync.mockResolvedValueOnce({}).mockRejectedValueOnce(new ErreurApi({ code: "X", message: "Refusé" }));
    rendre(<ListeAgences roles={DJ} />);
    const bouton = screen.getByRole("button", { name: "Réactiver l’agence AKWA" });

    fireEvent.click(bouton);
    await waitFor(() => expect(toast.success).toHaveBeenCalledWith("L’agence AKWA est de nouveau ouverte."));
    fireEvent.click(bouton);
    await waitFor(() => expect(toast.error).toHaveBeenCalledWith("Refusé"));
  });

  it("ouvre la création et la modification", () => {
    rendre(<ListeAgences roles={DJ} />);
    fireEvent.click(screen.getByRole("button", { name: A.nouvelleAgence }));
    expect(screen.getByRole("dialog", { name: A.creerTitre, hidden: true })).toHaveAttribute("open");

    fireEvent.click(screen.getByRole("button", { name: "Modifier l’agence BONANJO" }));
    expect(screen.getByRole("dialog", { name: A.modifierTitre, hidden: true })).toHaveAttribute("open");
  });
});

describe("FormulaireAgence", () => {
  function champ(conteneur: HTMLElement, libelle: string) {
    return within(conteneur).queryByLabelText(libelle) ?? within(conteneur).getByLabelText(new RegExp(`^${libelle}`));
  }

  it("exige code, nom et ville, puis crée l'agence", async () => {
    const fermer = vi.fn();
    rendre(<FormulaireAgence ouvert onFermeture={fermer} />);
    const fenetre = screen.getByRole("dialog", { name: A.creerTitre, hidden: true });
    fireEvent.click(within(fenetre).getByRole("button", { name: C.enregistrer, hidden: true }));
    expect(await within(fenetre).findAllByText(MESSAGES.fr.metier.champObligatoire)).toHaveLength(3);

    fireEvent.change(champ(fenetre, A.colonneCode), { target: { value: "00100" } });
    fireEvent.change(champ(fenetre, A.colonneNom), { target: { value: "BONAMOUSSADI" } });
    fireEvent.change(champ(fenetre, A.colonneVille), { target: { value: "Douala" } });
    fireEvent.click(within(fenetre).getByRole("button", { name: C.enregistrer, hidden: true }));

    await waitFor(() =>
      expect(ecriture.creer.mutateAsync).toHaveBeenCalledWith({
        code: "00100",
        nom: "BONAMOUSSADI",
        ville: "Douala",
        adresse: null,
        telephone: null,
      }),
    );
    expect(fermer).toHaveBeenCalled();
  });

  it("modifie une agence en renvoyant son code figé", async () => {
    rendre(<FormulaireAgence ouvert onFermeture={vi.fn()} agence={FERMEE} />);
    const fenetre = screen.getByRole("dialog", { name: A.modifierTitre, hidden: true });
    expect(champ(fenetre, A.colonneCode)).toBeDisabled();
    fireEvent.change(champ(fenetre, A.colonneAdresse), { target: { value: "" } });
    fireEvent.click(within(fenetre).getByRole("button", { name: C.enregistrer, hidden: true }));

    await waitFor(() =>
      expect(ecriture.modifier.mutateAsync).toHaveBeenCalledWith({
        id: 4,
        corps: { code: "00009", nom: "AKWA", ville: "Douala", adresse: null, telephone: "233" },
      }),
    );
  });

  it("rattache un code déjà pris à son champ, et toute autre erreur en tête", async () => {
    ecriture.creer.mutateAsync
      .mockRejectedValueOnce(new ErreurApi({ code: "ERR-CONFLICT", message: "Code déjà utilisé", statut: 409 }))
      .mockRejectedValueOnce(new ErreurApi({ code: "ERREUR_INTERNE", message: "Panne", statut: 500 }));
    rendre(<FormulaireAgence ouvert onFermeture={vi.fn()} />);
    const fenetre = screen.getByRole("dialog", { name: A.creerTitre, hidden: true });
    fireEvent.change(champ(fenetre, A.colonneCode), { target: { value: "00002" } });
    fireEvent.change(champ(fenetre, A.colonneNom), { target: { value: "X" } });
    fireEvent.change(champ(fenetre, A.colonneVille), { target: { value: "Y" } });

    fireEvent.click(within(fenetre).getByRole("button", { name: C.enregistrer, hidden: true }));
    expect(await within(fenetre).findByText("Code déjà utilisé")).toBeInTheDocument();
    fireEvent.click(within(fenetre).getByRole("button", { name: C.enregistrer, hidden: true }));
    expect(await within(fenetre).findByText("Panne")).toBeInTheDocument();

    fireEvent.click(within(fenetre).getByRole("button", { name: C.annuler, hidden: true }));
    expect(ecriture.creer.reset).toHaveBeenCalled();
  });
});
