import { fireEvent, screen, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { ParametresSysteme } from "@/components/modules/administration/parametres-systeme";
import { ErreurApi } from "@/lib/api/errors";
import type { ConfigurationSysteme } from "@/types/domaine";
import { MESSAGES, rendre } from "../utils/rendu";

/**
 * Screen 41 - system settings: each key brings its input (bounded integer or closed list), values
 * are checked before saving and saved one by one; who changed what and when is shown on the row.
 */
const etat = vi.hoisted(() => ({ requete: { data: undefined as unknown, isLoading: false, error: null as unknown, refetch: vi.fn() } }));
const modifier = vi.hoisted(() => vi.fn());

vi.mock("@/hooks/useConfigurations", () => ({
  useConfigurations: () => etat.requete,
  useModifierConfiguration: () => ({ mutate: modifier, isPending: false }),
}));
vi.mock("@/hooks/useLibelles", () => ({ useLibelles: () => ({ nomUtilisateur: (id: number) => `Utilisateur ${id}` }) }));
vi.mock("@/components/modules/administration/grille-notifications", () => ({ GrilleNotifications: () => null }));

const toast = vi.hoisted(() => ({ success: vi.fn(), error: vi.fn() }));
vi.mock("sonner", () => ({ toast }));

const T = MESSAGES.fr.configurations;

function parametre(partiel: Partial<ConfigurationSysteme>): ConfigurationSysteme {
  return {
    cle: "SEUIL_PROROGATIONS",
    valeur: "3",
    description: null,
    modifiablePar: "DJ",
    dateModification: null,
    dernierAuteurId: null,
    typeValeur: "ENTIER",
    valeurMinimale: 1,
    valeurMaximale: 10,
    valeursPossibles: [],
    listeVideAutorisee: false,
    ...partiel,
  };
}

function charger(parametres: ConfigurationSysteme[]) {
  etat.requete = { data: parametres, isLoading: false, error: null, refetch: vi.fn() };
}

beforeEach(() => {
  vi.clearAllMocks();
  charger([parametre({})]);
});

describe("ParametresSysteme - écran", () => {
  it("affiche le chargement, puis l'erreur avec une relance", () => {
    etat.requete = { data: undefined, isLoading: true, error: null, refetch: vi.fn() };
    const { rerender } = rendre(<ParametresSysteme modifiable />);
    expect(screen.getByRole("status")).toBeInTheDocument();

    etat.requete = { data: undefined, isLoading: false, error: new ErreurApi({ code: "X", message: "Paramètres indisponibles" }), refetch: vi.fn() };
    rerender(<ParametresSysteme modifiable />);
    fireEvent.click(screen.getByRole("button", { name: T.enregistrer }));
    expect(etat.requete.refetch).toHaveBeenCalled();
  });

  it("dit qu'il n'y a aucun paramètre hors grille, et prévient de la lecture seule", () => {
    charger([parametre({ cle: "GRILLE_NOTIFICATION_AUDIENCE" })]);
    rendre(<ParametresSysteme modifiable={false} />);

    expect(screen.getByText(T.vide)).toBeInTheDocument();
    expect(screen.getByText(T.lectureSeule)).toBeInTheDocument();
  });
});

describe("ParametresSysteme - entier borné", () => {
  it("décrit le paramètre, ses bornes et sa dernière modification", () => {
    charger([
      parametre({ dateModification: "2026-10-01T10:00:00", dernierAuteurId: 4 }),
      parametre({ cle: "INCONNUE", description: "Description serveur", dateModification: "2026-10-01T10:00:00" }),
      parametre({ cle: "TAILLE_MAX_GED", valeur: "10485760", valeurMinimale: null }),
    ]);
    rendre(<ParametresSysteme modifiable />);

    expect(screen.getByText(MESSAGES.fr.referentiels.configurations.SEUIL_PROROGATIONS)).toBeInTheDocument();
    expect(screen.getByText("Description serveur")).toBeInTheDocument();
    expect(screen.getByText(/par Utilisateur 4$/)).toBeInTheDocument();
    expect(screen.getByText(/^Modifiée le [^p]*$/)).toBeInTheDocument();
    expect(screen.getByText(T.jamaisModifiee)).toBeInTheDocument();
    expect(screen.getAllByText("Entier entre 1 et 10")).toHaveLength(2);
  });

  it("refuse une valeur hors bornes ou non entière, et enregistre une valeur valide", () => {
    modifier.mockImplementation((_variables, { onSuccess }) => onSuccess({ valeur: "5" }));
    rendre(<ParametresSysteme modifiable />);
    const champ = screen.getByLabelText(T.valeur, { exact: false });
    const enregistrer = screen.getByRole("button", { name: T.enregistrer });
    expect(enregistrer).toBeDisabled();

    fireEvent.change(champ, { target: { value: "50" } });
    expect(screen.getByText("La valeur doit être comprise entre 1 et 10.")).toBeInTheDocument();
    fireEvent.change(champ, { target: { value: "5a" } });
    expect(screen.getByText(MESSAGES.fr.configurations.refus.entier)).toBeInTheDocument();
    expect(enregistrer).toBeDisabled();

    fireEvent.change(champ, { target: { value: " 5 " } });
    fireEvent.click(enregistrer);
    expect(modifier).toHaveBeenCalledWith({ cle: "SEUIL_PROROGATIONS", valeur: "5" }, expect.anything());
    expect(toast.success).toHaveBeenCalledWith("Paramètre SEUIL_PROROGATIONS enregistré.");
  });

  it("annule une saisie, et signale un enregistrement refusé", () => {
    modifier.mockImplementation((_variables, { onError }) => onError(new ErreurApi({ code: "X", message: "Refusé" })));
    rendre(<ParametresSysteme modifiable />);
    const champ = screen.getByLabelText(T.valeur, { exact: false });

    fireEvent.change(champ, { target: { value: "4" } });
    fireEvent.click(screen.getByRole("button", { name: T.annuler }));
    expect(champ).toHaveValue("3");

    fireEvent.change(champ, { target: { value: "4" } });
    fireEvent.click(screen.getByRole("button", { name: T.enregistrer }));
    expect(toast.error).toHaveBeenCalledWith("Refusé");
  });
});

describe("ParametresSysteme - liste fermée", () => {
  it("coche les canaux par leur nom et les enregistre dans l'ordre publié", () => {
    charger([
      parametre({
        cle: "CANAUX_NOTIFICATION_DEFAUT",
        valeur: "APPLICATIF",
        typeValeur: "LISTE",
        valeurMinimale: null,
        valeurMaximale: null,
        valeursPossibles: ["APPLICATIF", "OUTLOOK", "TEAMS"],
      }),
      parametre({ cle: "AUTRE_LISTE", valeur: "A", typeValeur: "LISTE", valeursPossibles: ["A", "B"] }),
    ]);
    rendre(<ParametresSysteme modifiable />);

    const article = screen.getByRole("heading", { name: "CANAUX_NOTIFICATION_DEFAUT" }).closest("article")!;
    expect(within(article).getByLabelText(MESSAGES.fr.domaine.CanalAlerte.APPLICATIF)).toBeChecked();
    fireEvent.click(within(article).getByLabelText(MESSAGES.fr.domaine.CanalAlerte.TEAMS));
    fireEvent.click(within(article).getByRole("button", { name: T.enregistrer }));

    expect(modifier).toHaveBeenCalledWith({ cle: "CANAUX_NOTIFICATION_DEFAUT", valeur: "APPLICATIF,TEAMS" }, expect.anything());
    // Other lists show their codes.
    expect(screen.getByLabelText("B")).toBeInTheDocument();
  });
});
