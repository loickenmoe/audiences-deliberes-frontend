import { fireEvent, screen, waitFor, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { DerogationsEnAttente } from "@/components/modules/dossiers/derogations-en-attente";
import { ModaleAffectation } from "@/components/modules/dossiers/modale-affectation";
import { ModaleDerogation } from "@/components/modules/dossiers/modale-derogation";
import { ModaleSensibilite } from "@/components/modules/dossiers/modale-sensibilite";
import { ErreurApi } from "@/lib/api/errors";
import type { AuditSeuil, Dossier } from "@/types/domaine";
import { MESSAGES, rendre } from "../utils/rendu";

/**
 * Case page modals: threshold derogation (request and arbitration), sensitivity validation and
 * assignment editing. Each one only sends what the backend accepts, and places its refusals.
 */
const etat = vi.hoisted(() => ({ derogations: [] as unknown[] }));
const mutations = vi.hoisted(() => ({ valider: vi.fn(), demander: vi.fn(), sensibilite: vi.fn(), affectation: vi.fn() }));

vi.mock("@/hooks/useDossiers", () => ({
  useDerogations: () => ({ data: etat.derogations }),
  useValiderDerogation: () => ({ mutateAsync: mutations.valider, isPending: false }),
  useDemanderDerogation: () => ({ mutateAsync: mutations.demander, isPending: false }),
  useValiderSensibilite: () => ({ mutateAsync: mutations.sensibilite, isPending: false }),
  useModifierAffectation: () => ({ mutateAsync: mutations.affectation, isPending: false }),
}));
vi.mock("@/hooks/useLibelles", () => ({ useLibelles: () => ({ nomUtilisateur: (id: number) => `Utilisateur ${id}` }) }));
vi.mock("@/hooks/useReferentiels", () => ({
  useTypesClientSensible: () => ({ data: [{ id: 1, code: "PEP", libelle: "Personne exposée" }] }),
  useUtilisateurs: () => ({
    data: [
      { id: 4, prenom: "Awa", nom: "Ndiaye", email: "awa@afriland.cm" },
      { id: 5, prenom: null, nom: null, email: "paul@afriland.cm" },
    ],
    isLoading: false,
  }),
}));
vi.mock("@/hooks/useIntervenants", () => ({
  useIntervenants: () => ({ data: { content: [{ id: 11, nom: "Me Mballa" }, { id: 12, nom: "Me Eto" }] }, isLoading: false }),
}));

const F = MESSAGES.fr.fiche;
const D = MESSAGES.fr.dossiers;
const C = MESSAGES.fr.commun;
const OBLIGATOIRE = MESSAGES.fr.metier.champObligatoire;

function modale(titre: string) {
  return screen.getByRole("dialog", { name: titre, hidden: true });
}

function bouton(conteneur: HTMLElement, nom: string) {
  return within(conteneur).getByRole("button", { name: nom, hidden: true });
}

const DEMANDE: AuditSeuil = {
  id: 9,
  dossierId: 3,
  utilisateurId: 4,
  ancienSeuil: 1000000,
  nouveauSeuil: 2000000,
  motif: "Client stratégique",
  validePar: null,
  statut: "EN_ATTENTE",
  dateAction: "2026-09-10T10:00:00",
};

beforeEach(() => {
  vi.clearAllMocks();
  etat.derogations = [];
  for (const mutation of Object.values(mutations)) mutation.mockResolvedValue({});
});

describe("DerogationsEnAttente", () => {
  it("ne montre rien sans dérogation à arbitrer", () => {
    const { container } = rendre(<DerogationsEnAttente dossierId={3} />);
    expect(container).toBeEmptyDOMElement();
  });

  it("présente chaque demande, y compris sans auteur ni motif", () => {
    etat.derogations = [DEMANDE, { ...DEMANDE, id: 10, utilisateurId: null, motif: null }];
    rendre(<DerogationsEnAttente dossierId={3} />);

    expect(screen.getByText(F.derogationsEnAttente)).toBeInTheDocument();
    expect(screen.getByText("Client stratégique")).toBeInTheDocument();
    expect(screen.getByText("Utilisateur 4", { exact: false })).toBeInTheDocument();
    expect(screen.getAllByRole("button", { name: F.arbitrer })).toHaveLength(2);
  });

  it("valide une dérogation sans motif", async () => {
    etat.derogations = [DEMANDE];
    rendre(<DerogationsEnAttente dossierId={3} />);
    fireEvent.click(screen.getByRole("button", { name: F.arbitrer }));
    fireEvent.click(bouton(modale(F.arbitrageTitre), F.valider));

    await waitFor(() =>
      expect(mutations.valider).toHaveBeenCalledWith({ auditId: 9, decision: { statut: "VALIDEE", motif: undefined } }),
    );
  });

  it("exige un motif pour rejeter, puis rejette", async () => {
    etat.derogations = [DEMANDE];
    rendre(<DerogationsEnAttente dossierId={3} />);
    fireEvent.click(screen.getByRole("button", { name: F.arbitrer }));
    const fenetre = modale(F.arbitrageTitre);

    fireEvent.click(within(fenetre).getByLabelText(F.rejeter));
    fireEvent.click(bouton(fenetre, F.rejeter));
    expect(await within(fenetre).findByText(OBLIGATOIRE)).toBeInTheDocument();

    fireEvent.change(within(fenetre).getByLabelText(F.motifDecision, { exact: false }), { target: { value: " Trop élevé " } });
    fireEvent.click(bouton(fenetre, F.rejeter));
    await waitFor(() =>
      expect(mutations.valider).toHaveBeenCalledWith({ auditId: 9, decision: { statut: "REJETEE", motif: "Trop élevé" } }),
    );
  });

  it("affiche le refus du serveur, sur le motif ou en tête", async () => {
    mutations.valider
      .mockRejectedValueOnce(new ErreurApi({ code: "REQUETE_INVALIDE", message: "Motif trop court", champ: "motif", statut: 400 }))
      .mockRejectedValueOnce(new ErreurApi({ code: "ERREUR_INTERNE", message: "Arbitrage impossible", statut: 500 }));
    etat.derogations = [DEMANDE];
    rendre(<DerogationsEnAttente dossierId={3} />);
    fireEvent.click(screen.getByRole("button", { name: F.arbitrer }));
    const fenetre = modale(F.arbitrageTitre);

    fireEvent.click(bouton(fenetre, F.valider));
    expect(await within(fenetre).findByText("Motif trop court")).toBeInTheDocument();
    fireEvent.click(bouton(fenetre, F.valider));
    expect(await within(fenetre).findByText("Arbitrage impossible")).toBeInTheDocument();
  });
});

describe("ModaleDerogation", () => {
  it("exige le nouveau seuil et le motif, puis demande la dérogation", async () => {
    const fermer = vi.fn();
    rendre(<ModaleDerogation dossierId={3} ouvert onFermeture={fermer} />);
    const fenetre = modale(F.derogationTitre);

    fireEvent.click(bouton(fenetre, C.enregistrer));
    expect((await within(fenetre).findAllByText(OBLIGATOIRE)).length).toBeGreaterThan(0);

    fireEvent.change(within(fenetre).getByLabelText(F.champNouveauSeuil, { exact: false }), { target: { value: "3000000" } });
    fireEvent.change(within(fenetre).getByLabelText(F.champMotif, { exact: false }), { target: { value: "Encours en hausse" } });
    fireEvent.click(bouton(fenetre, C.enregistrer));

    await waitFor(() => expect(mutations.demander).toHaveBeenCalledWith({ nouveauSeuil: 3000000, motif: "Encours en hausse" }));
    expect(fermer).toHaveBeenCalled();
  });

  it("affiche le refus du serveur", async () => {
    mutations.demander.mockRejectedValue(new ErreurApi({ code: "ERREUR_INTERNE", message: "Dossier non sensible", statut: 500 }));
    rendre(<ModaleDerogation dossierId={3} ouvert onFermeture={vi.fn()} />);
    const fenetre = modale(F.derogationTitre);
    fireEvent.change(within(fenetre).getByLabelText(F.champNouveauSeuil, { exact: false }), { target: { value: "1" } });
    fireEvent.change(within(fenetre).getByLabelText(F.champMotif, { exact: false }), { target: { value: "Motif" } });
    fireEvent.click(bouton(fenetre, C.enregistrer));

    expect(await within(fenetre).findByText("Dossier non sensible")).toBeInTheDocument();
  });
});

describe("ModaleSensibilite", () => {
  const DOSSIER = { id: 3, seuilMontant: 1500000 } as Dossier;

  it("propose la proposition de l'avocat comme seuil indicatif", () => {
    rendre(<ModaleSensibilite dossier={DOSSIER} ouvert onFermeture={vi.fn()} />);
    const fenetre = modale(F.sensibiliteTitre);
    expect(within(fenetre).getByLabelText(F.champSeuilAjuste, { exact: false })).toHaveAttribute("placeholder", "1500000");
  });

  it("valide avec un seuil et un type ajustés", async () => {
    rendre(<ModaleSensibilite dossier={DOSSIER} ouvert onFermeture={vi.fn()} />);
    const fenetre = modale(F.sensibiliteTitre);
    fireEvent.change(within(fenetre).getByLabelText(F.champSeuilAjuste, { exact: false }), { target: { value: "2500000" } });
    fireEvent.change(within(fenetre).getByLabelText(F.champTypeAjuste), { target: { value: "PEP" } });
    fireEvent.click(bouton(fenetre, F.valider));

    await waitFor(() =>
      expect(mutations.sensibilite).toHaveBeenCalledWith({
        statut: "VALIDEE",
        seuilMontantAjuste: 2500000,
        typeClientSensibleAjuste: "PEP",
      }),
    );
  });

  it("exige le motif d'un rejet, puis rejette", async () => {
    rendre(<ModaleSensibilite dossier={DOSSIER} ouvert onFermeture={vi.fn()} />);
    const fenetre = modale(F.sensibiliteTitre);
    fireEvent.click(within(fenetre).getByLabelText(F.rejeter));
    fireEvent.click(bouton(fenetre, F.rejeter));
    expect(await within(fenetre).findByText(OBLIGATOIRE)).toBeInTheDocument();

    fireEvent.change(within(fenetre).getByLabelText(F.motifRejet, { exact: false }), { target: { value: " Pas de risque " } });
    fireEvent.click(bouton(fenetre, F.rejeter));
    await waitFor(() => expect(mutations.sensibilite).toHaveBeenCalledWith({ statut: "REJETEE", motifRejet: "Pas de risque" }));
  });

  it("affiche le refus du serveur", async () => {
    mutations.sensibilite.mockRejectedValue(new ErreurApi({ code: "ERREUR_INTERNE", message: "Déjà arbitré", statut: 500 }));
    rendre(<ModaleSensibilite dossier={{ ...DOSSIER, seuilMontant: null } as Dossier} ouvert onFermeture={vi.fn()} />);
    const fenetre = modale(F.sensibiliteTitre);
    fireEvent.click(bouton(fenetre, F.valider));

    expect(await within(fenetre).findByText("Déjà arbitré")).toBeInTheDocument();
  });
});

describe("ModaleAffectation", () => {
  const DOSSIER = { id: 3, juristesAffectes: [4], avocatsAffectes: [11] } as unknown as Dossier;

  it("part de l'affectation actuelle et la remplace", async () => {
    const fermer = vi.fn();
    rendre(<ModaleAffectation dossier={DOSSIER} ouvert onFermeture={fermer} />);
    const fenetre = modale(F.affectationTitre);
    expect(within(fenetre).getByRole("checkbox", { name: "Awa Ndiaye", hidden: true })).toBeChecked();

    fireEvent.click(within(fenetre).getByRole("checkbox", { name: "paul@afriland.cm", hidden: true }));
    fireEvent.click(within(fenetre).getByRole("combobox", { hidden: true }));
    fireEvent.mouseDown(within(fenetre).getByRole("option", { name: "Me Eto", hidden: true }));
    fireEvent.click(bouton(fenetre, C.enregistrer));

    await waitFor(() =>
      expect(mutations.affectation).toHaveBeenCalledWith({
        affectation: { juristesAffectes: [4, 5], avocatsAffectes: [11, 12] },
        forcer: false,
      }),
    );
    expect(fermer).toHaveBeenCalled();
  });

  it("exige au moins un juriste et un avocat", () => {
    rendre(<ModaleAffectation dossier={{ ...DOSSIER, juristesAffectes: [], avocatsAffectes: [] } as unknown as Dossier} ouvert onFermeture={vi.fn()} />);
    const fenetre = modale(F.affectationTitre);
    fireEvent.click(bouton(fenetre, C.enregistrer));

    expect(within(fenetre).getAllByText(OBLIGATOIRE)).toHaveLength(2);
    expect(mutations.affectation).not.toHaveBeenCalled();
  });

  it("fait confirmer une affectation en doublon, puis la force", async () => {
    mutations.affectation.mockRejectedValueOnce(new ErreurApi({ code: "ERR-003", message: "Doublon", statut: 409 }));
    rendre(<ModaleAffectation dossier={DOSSIER} ouvert onFermeture={vi.fn()} />);
    fireEvent.click(bouton(modale(F.affectationTitre), C.enregistrer));

    const confirmation = await waitFor(() => modale(F.doublonTitre));
    fireEvent.click(bouton(confirmation, MESSAGES.fr.metier.confirmer));
    await waitFor(() => expect(mutations.affectation).toHaveBeenLastCalledWith(expect.objectContaining({ forcer: true })));
  });

  it("affiche toute autre erreur dans la modale", async () => {
    mutations.affectation.mockRejectedValue(new ErreurApi({ code: "ERREUR_INTERNE", message: "Affectation refusée", statut: 500 }));
    rendre(<ModaleAffectation dossier={DOSSIER} ouvert onFermeture={vi.fn()} />);
    const fenetre = modale(F.affectationTitre);
    fireEvent.click(bouton(fenetre, C.enregistrer));

    expect(await within(fenetre).findByText("Affectation refusée")).toBeInTheDocument();
  });
});
