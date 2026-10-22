import { fireEvent, screen, waitFor, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { OngletDeliberes } from "@/components/modules/dossiers/onglet-deliberes";
import { ErreurApi } from "@/lib/api/errors";
import { demain } from "@/lib/calendrier";
import type { Delibere, Dossier, Prorogation, Recours } from "@/types/domaine";
import { MESSAGES, rendre } from "../utils/rendu";

/**
 * Screen 10 - deliberations of a case file: taken under advisement, extended, reopened or decided,
 * then the certified copy and the appeal deadline. Only the actions valid in each state are offered.
 */
const etat = vi.hoisted(() => ({
  deliberes: { data: [] as unknown[] | undefined, isLoading: false, error: null as unknown },
  recours: { data: undefined as unknown, error: null as unknown },
  prorogations: { data: [] as unknown[] | undefined, isLoading: false, error: null as unknown },
}));
const mutations = vi.hoisted(() => ({
  enregistrer: vi.fn(),
  expedition: vi.fn(),
  proroger: vi.fn(),
  rabattre: vi.fn(),
  vider: vi.fn(),
}));
const useRecours = vi.hoisted(() => vi.fn());

vi.mock("@/hooks/useDeliberes", () => ({
  useDeliberesDossier: () => etat.deliberes,
  useEnregistrerDelibere: () => ({ mutateAsync: mutations.enregistrer, isPending: false }),
  useModifierExpedition: () => ({ mutateAsync: mutations.expedition, isPending: false }),
  useProroger: () => ({ mutateAsync: mutations.proroger, isPending: false }),
  useRabattre: () => ({ mutateAsync: mutations.rabattre, isPending: false }),
  useViderDelibere: () => ({ mutateAsync: mutations.vider, isPending: false }),
  useProrogations: () => etat.prorogations,
  useRecours: (id: number, actif: boolean) => useRecours(id, actif),
}));

const toast = vi.hoisted(() => ({ success: vi.fn(), error: vi.fn(), warning: vi.fn() }));
vi.mock("sonner", () => ({ toast }));

const M = MESSAGES.fr.deliberes;
const C = MESSAGES.fr.commun;
const OBLIGATOIRE = MESSAGES.fr.metier.champObligatoire;
const JURISTE = ["ROLE_JURISTE", "ROLE_CONSULTATION", "ROLE_SAISIE"];
const LECTEUR = ["ROLE_CONSULTATION"];

function dossier(statutEtape = "EN_DELIBERE"): Dossier {
  return {
    id: 3,
    reference: "DOS-2026-003",
    etapes: [
      { id: 5, type: "INSTANCE", statutCycleVie: statutEtape },
      { id: 6, type: "RECOURS_1", statutCycleVie: "EN_COURS" },
    ],
  } as unknown as Dossier;
}

function delibere(partiel: Partial<Delibere> = {}): Delibere {
  return {
    id: 21,
    dossierId: 3,
    etapeId: 5,
    dateDeliberee: "2026-10-15",
    etat: "EN_ATTENTE",
    resultat: null,
    statutExpedition: null,
    dateEcheanceRecours: null,
    nombreProrogations: 0,
    dateRabattement: null,
    motifRabattement: null,
    createdAt: "2026-09-01T09:00:00",
    ...partiel,
  };
}

function dialogue(titre: string) {
  return screen.getByRole("dialog", { name: titre, hidden: true });
}

function bouton(conteneur: HTMLElement, nom: string) {
  return within(conteneur).getByRole("button", { name: nom, hidden: true });
}

beforeEach(() => {
  vi.clearAllMocks();
  etat.deliberes = { data: [], isLoading: false, error: null };
  etat.recours = { data: undefined, error: null };
  etat.prorogations = { data: [], isLoading: false, error: null };
  useRecours.mockImplementation(() => etat.recours);
  for (const mutation of Object.values(mutations)) mutation.mockResolvedValue({});
});

describe("OngletDeliberes - liste", () => {
  it("affiche le chargement puis l'erreur du serveur", () => {
    etat.deliberes = { data: undefined, isLoading: true, error: null };
    const { rerender } = rendre(<OngletDeliberes dossier={dossier()} roles={JURISTE} />);
    expect(screen.getByRole("status")).toBeInTheDocument();

    etat.deliberes = { data: undefined, isLoading: false, error: new ErreurApi({ code: "X", message: "Indisponible" }) };
    rerender(<OngletDeliberes dossier={dossier()} roles={JURISTE} />);
    expect(screen.getByText("Indisponible")).toBeInTheDocument();
  });

  it("explique pourquoi on ne peut pas mettre en délibéré sans étape en délibéré", () => {
    rendre(<OngletDeliberes dossier={dossier("EN_COURS")} roles={JURISTE} />);

    expect(screen.getByText(M.aucun)).toBeInTheDocument();
    expect(screen.getByText(M.aucuneEtapeEnDelibere)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: M.mettreEnDelibere })).toBeDisabled();
  });

  it("ne propose aucune action à qui ne gère pas les délibérés", () => {
    etat.deliberes.data = [delibere(), delibere({ id: 22, etat: "VIDE", resultat: "MIXTE" })];
    rendre(<OngletDeliberes dossier={dossier()} roles={LECTEUR} />);

    expect(screen.queryByRole("button", { name: M.mettreEnDelibere })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: M.vider })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: M.marquerLevee })).not.toBeInTheDocument();
    // The appeal deadline is read only by those who manage it.
    expect(useRecours).toHaveBeenCalledWith(22, false);
  });

  it("propose les trois actions sur un délibéré en attente dont l'étape est en délibéré", () => {
    etat.deliberes.data = [delibere()];
    rendre(<OngletDeliberes dossier={dossier()} roles={JURISTE} />);

    expect(screen.getByText("Délibéré annoncé au 15 octobre 2026")).toBeInTheDocument();
    expect(screen.getByText(MESSAGES.fr.domaine.EtatDelibere.EN_ATTENTE)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Enregistrer la décision du délibéré annoncé au 15 octobre 2026" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Proroger le délibéré annoncé au 15 octobre 2026" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Rabattre le délibéré annoncé au 15 octobre 2026" })).toBeInTheDocument();
    // The step already has a pending deliberation: it cannot be put under advisement again.
    expect(screen.getByRole("button", { name: M.mettreEnDelibere })).toBeDisabled();
  });

  it("affiche un délibéré rabattu et son motif", () => {
    etat.deliberes.data = [
      delibere({ etat: "RABATTU", dateRabattement: "2026-10-01", motifRabattement: "Pièce nouvelle" }),
    ];
    rendre(<OngletDeliberes dossier={dossier("EN_COURS")} roles={JURISTE} />);

    expect(screen.getByText("Rabattu le 1 octobre 2026")).toBeInTheDocument();
    expect(screen.getByText("Motif : Pièce nouvelle")).toBeInTheDocument();
  });

  it("dit qu'une décision favorable n'ouvre aucun recours", () => {
    etat.deliberes.data = [delibere({ etat: "VIDE", resultat: "FAVORABLE", statutExpedition: "A_LEVER" })];
    rendre(<OngletDeliberes dossier={dossier("CLOTURE")} roles={JURISTE} />);

    expect(screen.getByText("Décision du 15 octobre 2026")).toBeInTheDocument();
    expect(screen.getByText(M.aucunRecours)).toBeInTheDocument();
    expect(screen.getByText(MESSAGES.fr.domaine.StatutExpedition.A_LEVER)).toBeInTheDocument();
  });

  it.each<[Partial<Recours>, string]>([
    [{ recoursExerce: true }, M.recoursExerce],
    [{ cloture: true }, M.recoursCloture],
    [{ delaiExpire: true }, M.recoursExpire],
    [{}, M.recoursOuvert],
  ])("décrit la situation du recours %o", (situation, texte) => {
    etat.recours.data = { delibereId: 21, recoursExerce: false, delaiExpire: false, cloture: false, ...situation };
    etat.deliberes.data = [
      delibere({ etat: "VIDE", resultat: "DEFAVORABLE", dateEcheanceRecours: "2026-11-15T12:00:00" }),
    ];
    rendre(<OngletDeliberes dossier={dossier("EN_COURS")} roles={JURISTE} />);

    expect(screen.getByText(texte)).toBeInTheDocument();
  });

  it("signale l'erreur de lecture du recours", () => {
    etat.recours.error = new ErreurApi({ code: "X", message: "Recours illisible" });
    etat.deliberes.data = [delibere({ etat: "VIDE", resultat: "MIXTE" })];
    rendre(<OngletDeliberes dossier={dossier("EN_COURS")} roles={JURISTE} />);

    expect(screen.getByRole("alert")).toHaveTextContent("Recours illisible");
  });

  it("bascule l'expédition dans les deux sens et signale un échec", async () => {
    etat.deliberes.data = [
      delibere({ etat: "VIDE", resultat: "FAVORABLE", statutExpedition: "A_LEVER" }),
      delibere({ id: 22, etat: "VIDE", resultat: "FAVORABLE", statutExpedition: "LEVEE" }),
    ];
    rendre(<OngletDeliberes dossier={dossier("CLOTURE")} roles={JURISTE} />);

    fireEvent.click(screen.getByRole("button", { name: M.marquerLevee }));
    await waitFor(() => expect(mutations.expedition).toHaveBeenCalledWith({ delibereId: 21, statut: "LEVEE" }));
    expect(toast.success).toHaveBeenCalledWith(M.expeditionMiseAJour);

    mutations.expedition.mockRejectedValueOnce(new ErreurApi({ code: "X", message: "Refusé" }));
    fireEvent.click(screen.getByRole("button", { name: M.remettreALever }));
    await waitFor(() => expect(toast.error).toHaveBeenCalledWith("Refusé"));
    expect(mutations.expedition).toHaveBeenLastCalledWith({ delibereId: 22, statut: "A_LEVER" });
  });
});

describe("OngletDeliberes - historique des prorogations", () => {
  function ouvrirHistorique() {
    etat.deliberes.data = [delibere({ nombreProrogations: 2 })];
    rendre(<OngletDeliberes dossier={dossier()} roles={JURISTE} />);
    expect(screen.getByText("Prorogé 2 fois")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: M.voirProrogations }));
    return dialogue(M.voirProrogations);
  }

  it("liste les prorogations et signale celles au-delà du seuil", () => {
    etat.prorogations.data = [
      { id: 1, delibereId: 21, date: "2026-10-20", motif: null, compteur: 1, alerte: false, createdAt: "2026-10-01T10:00:00" },
      { id: 2, delibereId: 21, date: "2026-11-03", motif: "Juge absent", compteur: 4, alerte: true, createdAt: "2026-10-15T10:00:00" },
    ] satisfies Prorogation[];
    const modale = ouvrirHistorique();

    expect(within(modale).getByText("Juge absent")).toBeInTheDocument();
    expect(within(modale).getByText(M.auDelaDuSeuil)).toBeInTheDocument();
    // The footer button, the header cross carrying the same accessible name.
    fireEvent.click(within(modale).getAllByRole("button", { name: C.fermer, hidden: true }).at(-1)!);
  });

  it("affiche le chargement de l'historique", () => {
    etat.prorogations = { data: undefined, isLoading: true, error: null };
    const modale = ouvrirHistorique();
    expect(within(modale).getByRole("status", { hidden: true })).toBeInTheDocument();
  });

  it("affiche l'erreur de l'historique", () => {
    etat.prorogations = { data: undefined, isLoading: false, error: new ErreurApi({ code: "X", message: "Historique indisponible" }) };
    const modale = ouvrirHistorique();
    expect(within(modale).getByText("Historique indisponible")).toBeInTheDocument();
  });

  it("dit qu'il n'y a aucune prorogation", () => {
    const modale = ouvrirHistorique();
    expect(within(modale).getByText(M.aucuneProrogation)).toBeInTheDocument();
  });
});

describe("OngletDeliberes - mise en délibéré", () => {
  function ouvrir() {
    rendre(<OngletDeliberes dossier={dossier()} roles={JURISTE} />);
    fireEvent.click(screen.getByRole("button", { name: M.mettreEnDelibere }));
    return dialogue(M.mettreEnDelibere);
  }

  it("exige la date annoncée", async () => {
    const modale = ouvrir();
    fireEvent.click(bouton(modale, C.enregistrer));

    expect(await within(modale).findByText(OBLIGATOIRE)).toBeInTheDocument();
    expect(mutations.enregistrer).not.toHaveBeenCalled();
  });

  it("enregistre une mise en délibéré", async () => {
    const modale = ouvrir();
    fireEvent.change(within(modale).getByLabelText(M.champDateAnnoncee, { exact: false }), {
      target: { value: "2026-11-02" },
    });
    fireEvent.click(bouton(modale, C.enregistrer));

    await waitFor(() => expect(mutations.enregistrer).toHaveBeenCalledWith({ etapeId: 5, dateDeliberee: "2026-11-02" }));
    expect(toast.success).toHaveBeenCalledWith(M.miseEnDelibereEnregistree);
  });

  it("enregistre une décision déjà rendue, avec l'échéance du recours quand elle s'impose", async () => {
    const modale = ouvrir();
    fireEvent.click(within(modale).getByLabelText(M.dejaRendu));
    fireEvent.change(within(modale).getByLabelText(M.champDateDecision, { exact: false }), {
      target: { value: "2026-10-01" },
    });
    fireEvent.click(bouton(modale, C.enregistrer));
    expect(await within(modale).findByText(OBLIGATOIRE)).toBeInTheDocument();

    fireEvent.change(within(modale).getByLabelText(M.champResultat, { exact: false }), { target: { value: "DEFAVORABLE" } });
    fireEvent.click(bouton(modale, C.enregistrer));
    await waitFor(() => expect(within(modale).getByLabelText(M.champEcheance, { exact: false })).toBeInTheDocument());
    expect(mutations.enregistrer).not.toHaveBeenCalled();

    fireEvent.change(within(modale).getByLabelText(M.champEcheance, { exact: false }), {
      target: { value: "2026-11-01T12:00" },
    });
    fireEvent.click(bouton(modale, C.enregistrer));
    await waitFor(() =>
      expect(mutations.enregistrer).toHaveBeenCalledWith({
        etapeId: 5,
        dateDeliberee: "2026-10-01",
        resultat: "DEFAVORABLE",
        dateEcheanceRecours: "2026-11-01T12:00",
      }),
    );
    expect(toast.success).toHaveBeenCalledWith(M.delibereEnregistre);
  });

  it("affiche le refus du serveur dans la modale", async () => {
    mutations.enregistrer.mockRejectedValue(new ErreurApi({ code: "X", message: "Étape close" }));
    const modale = ouvrir();
    fireEvent.change(within(modale).getByLabelText(M.champDateAnnoncee, { exact: false }), {
      target: { value: "2026-11-02" },
    });
    fireEvent.click(bouton(modale, C.enregistrer));

    expect(await within(modale).findByText("Étape close")).toBeInTheDocument();
  });
});

describe("OngletDeliberes - actions sur un délibéré en attente", () => {
  function agir(action: "viderAria" | "prorogerAria" | "rabattreAria", titre: string) {
    etat.deliberes.data = [delibere()];
    rendre(<OngletDeliberes dossier={dossier()} roles={JURISTE} />);
    fireEvent.click(screen.getByRole("button", { name: M[action].replace("{date}", "15 octobre 2026") }));
    return dialogue(titre);
  }

  it("enregistre une décision favorable sans échéance", async () => {
    const modale = agir("viderAria", M.vider);
    fireEvent.click(bouton(modale, C.enregistrer));
    expect(await within(modale).findByText(OBLIGATOIRE)).toBeInTheDocument();

    fireEvent.change(within(modale).getByLabelText(M.champResultat, { exact: false }), { target: { value: "FAVORABLE" } });
    fireEvent.click(bouton(modale, C.enregistrer));

    await waitFor(() => expect(mutations.vider).toHaveBeenCalledWith({ delibereId: 21, corps: { resultat: "FAVORABLE" } }));
    expect(toast.success).toHaveBeenCalledWith(M.delibereVide);
  });

  it("affiche le refus d'enregistrer la décision", async () => {
    mutations.vider.mockRejectedValue(new ErreurApi({ code: "X", message: "Déjà vidé" }));
    const modale = agir("viderAria", M.vider);
    fireEvent.change(within(modale).getByLabelText(M.champResultat, { exact: false }), { target: { value: "FAVORABLE" } });
    fireEvent.click(bouton(modale, C.enregistrer));

    expect(await within(modale).findByText("Déjà vidé")).toBeInTheDocument();
  });

  it("proroge à une date future, avec un motif facultatif", async () => {
    mutations.proroger.mockResolvedValue({ date: "2026-11-20", alerte: false, compteur: 1 });
    const modale = agir("prorogerAria", M.prorogerTitre);
    fireEvent.change(within(modale).getByLabelText(M.champNouvelleDate, { exact: false }), {
      target: { value: "2020-01-01" },
    });
    fireEvent.click(bouton(modale, M.proroger));
    expect(await within(modale).findByText(OBLIGATOIRE)).toBeInTheDocument();

    fireEvent.change(within(modale).getByLabelText(M.champNouvelleDate, { exact: false }), { target: { value: demain() } });
    fireEvent.change(within(modale).getByLabelText(M.champMotifFacultatif), { target: { value: "  Juge absent  " } });
    fireEvent.click(bouton(modale, M.proroger));

    await waitFor(() =>
      expect(mutations.proroger).toHaveBeenCalledWith({ delibereId: 21, corps: { date: demain(), motif: "Juge absent" } }),
    );
    expect(toast.success).toHaveBeenCalledWith("Délibéré prorogé au 20 novembre 2026.");
  });

  it("avertit quand la prorogation dépasse le seuil, et n'envoie pas de motif vide", async () => {
    mutations.proroger.mockResolvedValue({ date: "2026-11-20", alerte: true, compteur: 4 });
    const modale = agir("prorogerAria", M.prorogerTitre);
    fireEvent.change(within(modale).getByLabelText(M.champNouvelleDate, { exact: false }), { target: { value: demain() } });
    fireEvent.click(bouton(modale, M.proroger));

    await waitFor(() => expect(toast.warning).toHaveBeenCalled());
    expect(mutations.proroger).toHaveBeenCalledWith({ delibereId: 21, corps: { date: demain() } });
  });

  it("affiche le refus de proroger", async () => {
    mutations.proroger.mockRejectedValue(new ErreurApi({ code: "X", message: "Prorogation refusée" }));
    const modale = agir("prorogerAria", M.prorogerTitre);
    fireEvent.change(within(modale).getByLabelText(M.champNouvelleDate, { exact: false }), { target: { value: demain() } });
    fireEvent.click(bouton(modale, M.proroger));

    expect(await within(modale).findByText("Prorogation refusée")).toBeInTheDocument();
  });

  it("rabat le délibéré avec un motif obligatoire", async () => {
    const modale = agir("rabattreAria", M.rabattreTitre);
    fireEvent.click(bouton(modale, M.rabattre));
    expect(await within(modale).findByText(OBLIGATOIRE)).toBeInTheDocument();

    fireEvent.change(within(modale).getByLabelText(M.champMotif, { exact: false }), { target: { value: " Pièce nouvelle " } });
    fireEvent.click(bouton(modale, M.rabattre));

    await waitFor(() =>
      expect(mutations.rabattre).toHaveBeenCalledWith({
        delibereId: 21,
        corps: { date: expect.any(String), motif: "Pièce nouvelle" },
      }),
    );
    expect(toast.success).toHaveBeenCalledWith(M.delibereRabattu);
  });

  it("affiche le refus de rabattre", async () => {
    mutations.rabattre.mockRejectedValue(new ErreurApi({ code: "X", message: "Rabattement refusé" }));
    const modale = agir("rabattreAria", M.rabattreTitre);
    fireEvent.change(within(modale).getByLabelText(M.champMotif, { exact: false }), { target: { value: "Motif" } });
    fireEvent.click(bouton(modale, M.rabattre));

    expect(await within(modale).findByText("Rabattement refusé")).toBeInTheDocument();
  });
});
