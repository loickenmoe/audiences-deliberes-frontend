import { fireEvent, screen, waitFor, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { FormulaireIntervenant } from "@/components/modules/intervenants/formulaire-intervenant";
import { ListeIntervenants } from "@/components/modules/intervenants/liste-intervenants";
import { ErreurApi } from "@/lib/api/errors";
import type { Intervenant } from "@/types/domaine";
import { MESSAGES, rendre } from "../utils/rendu";

/**
 * Screen 42 - third-party directory: a lawyer needs an application account, another provider has
 * none; consent to external notifications defaults by type; type and login are fixed once created.
 */
const etat = vi.hoisted(() => ({ liste: { data: undefined as unknown, isLoading: false, error: null as unknown, refetch: vi.fn() } }));
const filtresRecus = vi.hoisted(() => vi.fn());
const mutations = vi.hoisted(() => ({ creer: vi.fn(), modifier: vi.fn(), reset: vi.fn() }));
const navigation = vi.hoisted(() => ({ replace: vi.fn(), parametres: new URLSearchParams() }));

vi.mock("@/hooks/useIntervenants", () => ({
  useIntervenants: (filtres: unknown) => {
    filtresRecus(filtres);
    return etat.liste;
  },
  useCreerIntervenant: () => ({ mutateAsync: mutations.creer, isPending: false, reset: mutations.reset }),
  useModifierIntervenant: () => ({ mutateAsync: mutations.modifier, isPending: false, reset: mutations.reset }),
}));
vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace: navigation.replace, push: vi.fn() }),
  usePathname: () => "/intervenants",
  useSearchParams: () => navigation.parametres,
}));

const I = MESSAGES.fr.intervenants;
const C = MESSAGES.fr.commun;
const DJ = ["ROLE_DJ", "ROLE_JURISTE", "ROLE_CONSULTATION"];

const AVOCAT: Intervenant = {
  id: 11,
  type: "AVOCAT",
  nom: "Me Mballa",
  email: "mballa@cabinet.cm",
  telephone: null,
  compteKeycloak: "avocat.mballa",
  notification: true,
} as Intervenant;
const HUISSIER: Intervenant = { id: 12, type: "AUTRE_PRESTATAIRE", nom: "Huissier X", email: null, telephone: "690000000", compteKeycloak: null, notification: false } as Intervenant;

function liste(intervenants: Intervenant[]) {
  etat.liste = { data: { content: intervenants, totalPages: 1, totalElements: intervenants.length }, isLoading: false, error: null, refetch: vi.fn() };
}

function champ(conteneur: HTMLElement, libelle: string) {
  return within(conteneur).queryByLabelText(libelle) ?? within(conteneur).getByLabelText(new RegExp(`^${libelle}`));
}

beforeEach(() => {
  vi.clearAllMocks();
  navigation.parametres = new URLSearchParams();
  liste([AVOCAT, HUISSIER]);
  mutations.creer.mockResolvedValue({});
  mutations.modifier.mockResolvedValue({});
});

describe("ListeIntervenants", () => {
  it("affiche le chargement, l'erreur avec relance, puis le répertoire vide", () => {
    etat.liste = { data: undefined, isLoading: true, error: null, refetch: vi.fn() };
    const { rerender } = rendre(<ListeIntervenants roles={DJ} />);
    expect(screen.getByRole("status")).toBeInTheDocument();

    etat.liste = { data: undefined, isLoading: false, error: new ErreurApi({ code: "X", message: "Répertoire indisponible" }), refetch: vi.fn() };
    rerender(<ListeIntervenants roles={DJ} />);
    fireEvent.click(screen.getByRole("button", { name: I.titre }));
    expect(etat.liste.refetch).toHaveBeenCalled();

    liste([]);
    rerender(<ListeIntervenants roles={DJ} />);
    expect(screen.getByText(I.aucunIntervenantTexte)).toBeInTheDocument();
    expect(screen.getAllByRole("button", { name: I.nouvelIntervenant })).toHaveLength(2);
  });

  it("liste avocats et prestataires, et filtre par type", () => {
    rendre(<ListeIntervenants roles={["ROLE_CONSULTATION"]} />);

    expect(screen.getByText("avocat.mballa")).toBeInTheDocument();
    expect(screen.getByText(I.sansCompte)).toBeInTheDocument();
    expect(screen.getAllByText("—")).toHaveLength(2);
    expect(screen.queryByRole("button", { name: "Modifier Me Mballa" })).not.toBeInTheDocument();

    fireEvent.change(screen.getByLabelText(I.filtreType), { target: { value: "AVOCAT" } });
    expect(filtresRecus).toHaveBeenLastCalledWith({ type: "AVOCAT", page: 0, size: 10 });
  });

  it("ouvre la création et la modification", () => {
    rendre(<ListeIntervenants roles={DJ} />);
    fireEvent.click(screen.getByRole("button", { name: I.nouvelIntervenant }));
    expect(screen.getByRole("dialog", { name: I.creerTitre, hidden: true })).toHaveAttribute("open");
    fireEvent.click(screen.getByRole("button", { name: "Modifier Me Mballa" }));
    expect(screen.getByRole("dialog", { name: I.modifierTitre, hidden: true })).toHaveAttribute("open");
  });
});

describe("FormulaireIntervenant", () => {
  function fenetre(titre: string) {
    return screen.getByRole("dialog", { name: titre, hidden: true });
  }

  it("exige l'identifiant d'un avocat, puis le crée avec son consentement par défaut", async () => {
    rendre(<FormulaireIntervenant ouvert onFermeture={vi.fn()} />);
    const modale = fenetre(I.creerTitre);
    fireEvent.change(champ(modale, I.colonneNom), { target: { value: "Me Eto" } });
    fireEvent.click(within(modale).getByRole("button", { name: C.enregistrer, hidden: true }));
    expect(await within(modale).findByText(MESSAGES.fr.metier.champObligatoire)).toBeInTheDocument();

    fireEvent.change(champ(modale, I.colonneCompte), { target: { value: "avocat.eto" } });
    fireEvent.click(within(modale).getByRole("button", { name: C.enregistrer, hidden: true }));
    await waitFor(() =>
      expect(mutations.creer).toHaveBeenCalledWith({
        type: "AVOCAT",
        nom: "Me Eto",
        email: undefined,
        telephone: undefined,
        compteKeycloak: "avocat.eto",
        notification: true,
      }),
    );
  });

  it("crée un autre prestataire sans compte, et refuse un téléphone invalide", async () => {
    rendre(<FormulaireIntervenant ouvert onFermeture={vi.fn()} />);
    const modale = fenetre(I.creerTitre);
    fireEvent.change(champ(modale, I.colonneType), { target: { value: "AUTRE_PRESTATAIRE" } });
    expect(within(modale).getByText(I.comptePrestataire)).toBeInTheDocument();
    fireEvent.change(champ(modale, I.colonneNom), { target: { value: "Huissier Y" } });
    fireEvent.change(champ(modale, I.colonneTelephone), { target: { value: "12" } });
    fireEvent.click(within(modale).getByRole("button", { name: C.enregistrer, hidden: true }));
    expect(await within(modale).findByText(I.telephoneFormat)).toBeInTheDocument();

    fireEvent.change(champ(modale, I.colonneTelephone), { target: { value: "690000000" } });
    fireEvent.click(within(modale).getByRole("button", { name: C.enregistrer, hidden: true }));
    await waitFor(() => expect(mutations.creer).toHaveBeenCalled());
    expect(mutations.creer.mock.calls[0]![0]).toMatchObject({ type: "AUTRE_PRESTATAIRE", compteKeycloak: undefined, telephone: "690000000" });
  });

  it("modifie les coordonnées sans toucher au type ni à l'identifiant", async () => {
    const fermer = vi.fn();
    rendre(<FormulaireIntervenant ouvert onFermeture={fermer} intervenant={AVOCAT} />);
    const modale = fenetre(I.modifierTitre);
    expect(champ(modale, I.colonneType)).toBeDisabled();
    expect(champ(modale, I.colonneCompte)).toBeDisabled();
    fireEvent.change(champ(modale, I.colonneEmail), { target: { value: "" } });
    fireEvent.click(within(modale).getByLabelText(I.notification));
    fireEvent.click(within(modale).getByRole("button", { name: C.enregistrer, hidden: true }));

    await waitFor(() =>
      expect(mutations.modifier).toHaveBeenCalledWith({ nom: "Me Mballa", email: null, telephone: null, notification: false }),
    );
    expect(fermer).toHaveBeenCalled();
  });

  it("rattache un identifiant déjà pris à son champ, et toute autre erreur en tête", async () => {
    mutations.creer
      .mockRejectedValueOnce(new ErreurApi({ code: "ERR-CONFLICT", message: "Compte déjà lié", statut: 409 }))
      .mockRejectedValueOnce(new ErreurApi({ code: "ERREUR_INTERNE", message: "Panne", statut: 500 }));
    rendre(<FormulaireIntervenant ouvert onFermeture={vi.fn()} />);
    const modale = fenetre(I.creerTitre);
    fireEvent.change(champ(modale, I.colonneNom), { target: { value: "Me Eto" } });
    fireEvent.change(champ(modale, I.colonneCompte), { target: { value: "avocat.eto" } });

    fireEvent.click(within(modale).getByRole("button", { name: C.enregistrer, hidden: true }));
    expect(await within(modale).findByText("Compte déjà lié")).toBeInTheDocument();
    fireEvent.click(within(modale).getByRole("button", { name: C.enregistrer, hidden: true }));
    expect(await within(modale).findByText("Panne")).toBeInTheDocument();
    fireEvent.click(within(modale).getByRole("button", { name: C.annuler, hidden: true }));
    expect(mutations.reset).toHaveBeenCalled();
  });
});
