import { fireEvent, screen, waitFor, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { OngletAudiences } from "@/components/modules/dossiers/onglet-audiences";
import { ErreurApi } from "@/lib/api/errors";
import type { Audience, Dossier } from "@/types/domaine";
import { MESSAGES, rendre } from "../utils/rendu";

/**
 * Screen 09 - case hearings: scheduling on a step in progress (a duplicate asks for confirmation),
 * the report from the hearing day onwards, cancellation with a reason and the note to the counsel.
 * The counsel's report link is covered by `compte-rendu-avocat.test.tsx`.
 */
const etat = vi.hoisted(() => ({
  audiences: { data: undefined as unknown, isLoading: false, error: null as unknown },
}));
const mutations = vi.hoisted(() => ({ planifier: vi.fn(), compteRendu: vi.fn(), annuler: vi.fn(), note: vi.fn() }));

vi.mock("@/hooks/useAudiences", () => ({
  useAudiencesDossier: () => etat.audiences,
  usePlanifierAudience: () => ({ mutateAsync: mutations.planifier, isPending: false }),
  useEnregistrerCompteRendu: () => ({ mutateAsync: mutations.compteRendu, isPending: false }),
  useAnnulerAudience: () => ({ mutateAsync: mutations.annuler, isPending: false }),
  useModifierNoteAvocat: () => ({ mutateAsync: mutations.note, isPending: false }),
}));
vi.mock("@/hooks/usePublications", () => ({ usePublications: () => ({ data: { content: [] } }) }));

const toast = vi.hoisted(() => ({ success: vi.fn(), error: vi.fn() }));
vi.mock("sonner", () => ({ toast }));

const A = MESSAGES.fr.audiences;
const C = MESSAGES.fr.commun;
const OBLIGATOIRE = MESSAGES.fr.metier.champObligatoire;
const JURISTE = ["ROLE_JURISTE", "ROLE_CONSULTATION"];

const DOSSIER = {
  id: 3,
  createdAt: "2026-01-05T09:00:00",
  juridictionSaisie: "TGI Douala",
  etapes: [
    { id: 5, type: "INSTANCE", statutCycleVie: "EN_COURS" },
    { id: 6, type: "RECOURS_1", statutCycleVie: "OUVERTURE" },
  ],
} as unknown as Dossier;

function audience(partiel: Partial<Audience>): Audience {
  return {
    id: 1,
    dossierId: 3,
    etapeId: 5,
    datePlanifiee: "2026-02-10",
    dateTenue: null,
    juridiction: null,
    compteRendu: null,
    statut: "PLANIFIEE",
    createdAt: "2026-01-10T09:00:00",
    motifAnnulation: null,
    dateAnnulation: null,
    noteAvocat: null,
    ...partiel,
  } as Audience;
}

function liste(audiences: Audience[]) {
  etat.audiences = { data: { content: audiences, totalPages: 1, totalElements: audiences.length }, isLoading: false, error: null };
}

function modale(titre: string) {
  return screen.getByRole("dialog", { name: titre, hidden: true });
}

function bouton(conteneur: HTMLElement, nom: string) {
  return within(conteneur).getByRole("button", { name: nom, hidden: true });
}

beforeEach(() => {
  vi.clearAllMocks();
  liste([]);
  for (const mutation of Object.values(mutations)) mutation.mockResolvedValue({});
});

describe("OngletAudiences - liste", () => {
  it("affiche le chargement puis l'erreur", () => {
    etat.audiences = { data: undefined, isLoading: true, error: null };
    const { rerender } = rendre(<OngletAudiences dossier={DOSSIER} roles={JURISTE} />);
    expect(screen.getByRole("status")).toBeInTheDocument();

    etat.audiences = { data: undefined, isLoading: false, error: new ErreurApi({ code: "X", message: "Audiences indisponibles" }) };
    rerender(<OngletAudiences dossier={DOSSIER} roles={JURISTE} />);
    expect(screen.getByText("Audiences indisponibles")).toBeInTheDocument();
  });

  it("explique pourquoi on ne peut pas planifier sans étape en cours", () => {
    const sansEtape = { ...DOSSIER, etapes: [{ id: 6, type: "RECOURS_1", statutCycleVie: "OUVERTURE" }] } as unknown as Dossier;
    rendre(<OngletAudiences dossier={sansEtape} roles={JURISTE} />);

    expect(screen.getByText(A.aucune)).toBeInTheDocument();
    expect(screen.getByText(A.aucuneEtapeEnCours)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: A.planifier })).toBeDisabled();
  });

  it("montre pour chaque audience son compte rendu, son motif d'annulation, sa note ou l'action possible", () => {
    liste([
      audience({ id: 1, compteRendu: "Renvoi au 10 mars", statut: "TENUE", juridiction: "Cour d'appel" }),
      audience({ id: 2, statut: "ANNULEE", motifAnnulation: "Grève des greffiers" }),
      audience({ id: 3, noteAvocat: "Apporter les pièces" }),
      audience({ id: 4, datePlanifiee: "2099-01-01", etapeId: 99 }),
    ]);
    rendre(<OngletAudiences dossier={DOSSIER} roles={JURISTE} />);

    expect(screen.getByText("Renvoi au 10 mars")).toBeInTheDocument();
    expect(screen.getByText("Cour d'appel")).toBeInTheDocument();
    expect(screen.getByText("Motif : Grève des greffiers")).toBeInTheDocument();
    expect(screen.getByText("Apporter les pièces")).toBeInTheDocument();
    // A past scheduled hearing can be reported; a future one cannot yet.
    expect(screen.getAllByRole("button", { name: A.saisirCompteRendu })).toHaveLength(1);
    expect(screen.getByText("#99")).toBeInTheDocument();
    expect(screen.getAllByText("—").length).toBeGreaterThan(0);
  });

  it("ne propose aucune action en lecture seule", () => {
    liste([audience({})]);
    rendre(<OngletAudiences dossier={DOSSIER} roles={["ROLE_CONSULTATION"]} />);

    expect(screen.queryByRole("button", { name: A.planifier })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: A.saisirCompteRendu })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /^Annuler l’audience du/ })).not.toBeInTheDocument();
  });
});

describe("OngletAudiences - planification", () => {
  function ouvrir() {
    rendre(<OngletAudiences dossier={DOSSIER} roles={JURISTE} />);
    fireEvent.click(screen.getByRole("button", { name: A.planifier }));
    return modale(A.planifier);
  }

  it("refuse une date antérieure à l'ouverture du dossier", async () => {
    const fenetre = ouvrir();
    fireEvent.click(bouton(fenetre, C.enregistrer));
    expect(await within(fenetre).findByText(OBLIGATOIRE)).toBeInTheDocument();

    fireEvent.change(within(fenetre).getByLabelText(A.champDate, { exact: false }), { target: { value: "2025-12-31" } });
    fireEvent.click(bouton(fenetre, C.enregistrer));
    expect(await within(fenetre).findByText(A.dateAvantOuverture)).toBeInTheDocument();
    expect(mutations.planifier).not.toHaveBeenCalled();
  });

  it("planifie sur l'étape en cours, à la juridiction du dossier par défaut", async () => {
    const fenetre = ouvrir();
    expect(within(fenetre).getByLabelText(A.champJuridiction)).toHaveValue("TGI Douala");
    fireEvent.change(within(fenetre).getByLabelText(A.champDate, { exact: false }), { target: { value: "2026-03-10" } });
    fireEvent.click(bouton(fenetre, C.enregistrer));

    await waitFor(() =>
      expect(mutations.planifier).toHaveBeenCalledWith({
        audience: { etapeId: 5, datePlanifiee: "2026-03-10", juridiction: "TGI Douala" },
        forcer: false,
      }),
    );
    expect(toast.success).toHaveBeenCalledWith(A.audiencePlanifiee);
  });

  it("fait confirmer un doublon puis rejoue la même demande en la forçant", async () => {
    mutations.planifier.mockRejectedValueOnce(new ErreurApi({ code: "ERR-005", message: "Doublon", statut: 409 }));
    const fenetre = ouvrir();
    fireEvent.change(within(fenetre).getByLabelText(A.champDate, { exact: false }), { target: { value: "2026-03-10" } });
    fireEvent.click(bouton(fenetre, C.enregistrer));

    const confirmation = await waitFor(() => modale(A.doublonTitre));
    fireEvent.click(bouton(confirmation, MESSAGES.fr.metier.confirmer));
    await waitFor(() =>
      expect(mutations.planifier).toHaveBeenLastCalledWith({
        audience: { etapeId: 5, datePlanifiee: "2026-03-10", juridiction: "TGI Douala" },
        forcer: true,
      }),
    );
  });

  it("affiche tout autre refus dans la modale", async () => {
    mutations.planifier.mockRejectedValue(new ErreurApi({ code: "ERREUR_INTERNE", message: "Étape close", statut: 500 }));
    const fenetre = ouvrir();
    fireEvent.change(within(fenetre).getByLabelText(A.champDate, { exact: false }), { target: { value: "2026-03-10" } });
    fireEvent.click(bouton(fenetre, C.enregistrer));

    expect(await within(fenetre).findByText("Étape close")).toBeInTheDocument();
  });
});

describe("OngletAudiences - compte rendu, annulation et note", () => {
  it("enregistre le compte rendu d'une audience passée", async () => {
    liste([audience({})]);
    rendre(<OngletAudiences dossier={DOSSIER} roles={JURISTE} />);
    fireEvent.click(screen.getByRole("button", { name: A.saisirCompteRendu }));
    const fenetre = modale(A.compteRenduTitre);

    fireEvent.click(bouton(fenetre, C.enregistrer));
    expect(await within(fenetre).findByText(OBLIGATOIRE)).toBeInTheDocument();
    fireEvent.change(within(fenetre).getByLabelText(A.champCompteRendu, { exact: false }), { target: { value: " Renvoi " } });
    fireEvent.click(bouton(fenetre, C.enregistrer));

    await waitFor(() => expect(mutations.compteRendu).toHaveBeenCalledWith({ audienceId: 1, compteRendu: "Renvoi" }));
    expect(toast.success).toHaveBeenCalledWith(A.compteRenduEnregistre);
  });

  it("affiche le refus d'enregistrer le compte rendu", async () => {
    mutations.compteRendu.mockRejectedValue(new ErreurApi({ code: "X", message: "Audience future" }));
    liste([audience({})]);
    rendre(<OngletAudiences dossier={DOSSIER} roles={JURISTE} />);
    fireEvent.click(screen.getByRole("button", { name: A.saisirCompteRendu }));
    const fenetre = modale(A.compteRenduTitre);
    fireEvent.change(within(fenetre).getByLabelText(A.champCompteRendu, { exact: false }), { target: { value: "Renvoi" } });
    fireEvent.click(bouton(fenetre, C.enregistrer));

    expect(await within(fenetre).findByText("Audience future")).toBeInTheDocument();
  });

  it("annule une audience avec un motif obligatoire", async () => {
    liste([audience({})]);
    rendre(<OngletAudiences dossier={DOSSIER} roles={JURISTE} />);
    fireEvent.click(screen.getByRole("button", { name: "Annuler l’audience du 10 février 2026" }));
    const fenetre = modale(A.annulationTitre);

    fireEvent.click(bouton(fenetre, A.confirmerAnnulation));
    expect(await within(fenetre).findByText(OBLIGATOIRE)).toBeInTheDocument();
    fireEvent.change(within(fenetre).getByLabelText(A.champMotif, { exact: false }), { target: { value: " Grève " } });
    fireEvent.click(bouton(fenetre, A.confirmerAnnulation));

    await waitFor(() => expect(mutations.annuler).toHaveBeenCalledWith({ audienceId: 1, motif: "Grève" }));
    expect(toast.success).toHaveBeenCalledWith(A.audienceAnnulee);
  });

  it("affiche le refus d'annuler", async () => {
    mutations.annuler.mockRejectedValue(new ErreurApi({ code: "X", message: "Déjà tenue" }));
    liste([audience({})]);
    rendre(<OngletAudiences dossier={DOSSIER} roles={JURISTE} />);
    fireEvent.click(screen.getByRole("button", { name: "Annuler l’audience du 10 février 2026" }));
    const fenetre = modale(A.annulationTitre);
    fireEvent.change(within(fenetre).getByLabelText(A.champMotif, { exact: false }), { target: { value: "Grève" } });
    fireEvent.click(bouton(fenetre, A.confirmerAnnulation));

    expect(await within(fenetre).findByText("Déjà tenue")).toBeInTheDocument();
  });

  it("corrige la note à l'avocat, et l'efface quand elle est vidée", async () => {
    liste([audience({ noteAvocat: "Ancienne note" })]);
    rendre(<OngletAudiences dossier={DOSSIER} roles={JURISTE} />);
    const ouvrirNote = () => fireEvent.click(screen.getByRole("button", { name: "Note à l'avocat - audience du 10 février 2026" }));

    ouvrirNote();
    let fenetre = modale(A.noteTitre);
    const champ = within(fenetre).getByLabelText(A.noteAvocat);
    expect(champ).toHaveValue("Ancienne note");
    fireEvent.change(champ, { target: { value: " Nouvelle note " } });
    fireEvent.click(bouton(fenetre, C.enregistrer));
    await waitFor(() => expect(mutations.note).toHaveBeenCalledWith({ audienceId: 1, note: "Nouvelle note" }));
    expect(toast.success).toHaveBeenCalledWith(A.noteEnregistree);

    ouvrirNote();
    fenetre = modale(A.noteTitre);
    fireEvent.change(within(fenetre).getByLabelText(A.noteAvocat), { target: { value: "   " } });
    fireEvent.click(bouton(fenetre, C.enregistrer));
    await waitFor(() => expect(toast.success).toHaveBeenCalledWith(A.noteEffacee));
  });

  it("affiche le refus d'enregistrer la note", async () => {
    mutations.note.mockRejectedValue(new ErreurApi({ code: "X", message: "Note refusée" }));
    liste([audience({})]);
    rendre(<OngletAudiences dossier={DOSSIER} roles={JURISTE} />);
    fireEvent.click(screen.getByRole("button", { name: "Note à l'avocat - audience du 10 février 2026" }));
    const fenetre = modale(A.noteTitre);
    fireEvent.change(within(fenetre).getByLabelText(A.noteAvocat), { target: { value: "Note" } });
    fireEvent.click(bouton(fenetre, C.enregistrer));

    expect(await within(fenetre).findByText("Note refusée")).toBeInTheDocument();
  });
});
