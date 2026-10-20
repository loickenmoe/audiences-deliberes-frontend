import { fireEvent, screen, waitFor, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { OngletAlarmes } from "@/components/modules/dossiers/onglet-alarmes";
import { ErreurApi } from "@/lib/api/errors";
import type { Alarme, Dossier } from "@/types/domaine";
import { MESSAGES, rendre } from "../utils/rendu";

/**
 * Screen 11 - case alarms. Rescheduling closes the alarm and creates a linked one; an active alarm
 * past its due date is flagged, never closed on its own.
 */
const etat = vi.hoisted(() => ({
  alarmes: { data: undefined as unknown, isLoading: false, error: null as unknown },
}));
const mutations = vi.hoisted(() => ({ creer: vi.fn(), reprogrammer: vi.fn(), traiter: vi.fn() }));

vi.mock("@/hooks/useAudiences", () => ({
  useAlarmesDossier: () => etat.alarmes,
  useCreerAlarme: () => ({ mutateAsync: mutations.creer, isPending: false }),
  useReprogrammerAlarme: () => ({ mutateAsync: mutations.reprogrammer, isPending: false }),
  useTraiterAlarme: () => ({ mutateAsync: mutations.traiter, isPending: false }),
}));
vi.mock("@/hooks/useLibelles", () => ({ useLibelles: () => ({ nomUtilisateur: (id: number) => `Utilisateur ${id}` }) }));

const toast = vi.hoisted(() => ({ success: vi.fn(), error: vi.fn() }));
vi.mock("sonner", () => ({ toast }));

const A = MESSAGES.fr.audiences;
const C = MESSAGES.fr.commun;
const OBLIGATOIRE = MESSAGES.fr.metier.champObligatoire;
const JURISTE = ["ROLE_JURISTE", "ROLE_CONSULTATION"];
const FUTUR = "2099-01-01T09:00";

const DOSSIER = {
  id: 3,
  etapes: [
    { id: 5, type: "INSTANCE", statutCycleVie: "EN_COURS" },
    { id: 6, type: "RECOURS_1", statutCycleVie: "OUVERTURE" },
  ],
} as unknown as Dossier;

function alarme(partiel: Partial<Alarme>): Alarme {
  return {
    id: 1,
    dossierId: 3,
    etapeId: 5,
    objet: "Relancer le greffe",
    dateEcheance: "2099-06-01T09:00:00",
    statut: "ACTIVE",
    dateTraitement: null,
    alarmePrecedenteId: null,
    createdBy: 4,
    createdAt: "2026-09-01T09:00:00",
    ...partiel,
  };
}

function liste(alarmes: Alarme[]) {
  etat.alarmes = { data: { content: alarmes, totalPages: 1, totalElements: alarmes.length }, isLoading: false, error: null };
}

function dialogue(titre: string) {
  return screen.getByRole("dialog", { name: titre, hidden: true });
}

beforeEach(() => {
  vi.clearAllMocks();
  liste([]);
  for (const mutation of Object.values(mutations)) mutation.mockResolvedValue({});
});

describe("OngletAlarmes - liste", () => {
  it("affiche le chargement puis l'erreur", () => {
    etat.alarmes = { data: undefined, isLoading: true, error: null };
    const { rerender } = rendre(<OngletAlarmes dossier={DOSSIER} roles={JURISTE} />);
    expect(screen.getByRole("status")).toBeInTheDocument();

    etat.alarmes = { data: undefined, isLoading: false, error: new ErreurApi({ code: "X", message: "Alarmes indisponibles" }) };
    rerender(<OngletAlarmes dossier={DOSSIER} roles={JURISTE} />);
    expect(screen.getByText("Alarmes indisponibles")).toBeInTheDocument();
  });

  it("dit qu'il n'y a aucune alarme", () => {
    rendre(<OngletAlarmes dossier={DOSSIER} roles={JURISTE} />);
    expect(screen.getByText(A.alarmesAucune)).toBeInTheDocument();
  });

  it("signale l'alarme échue, la reprise et l'auteur", () => {
    liste([
      alarme({ id: 1, dateEcheance: "2020-01-01T09:00:00" }),
      alarme({ id: 2, objet: "Audience reportée", alarmePrecedenteId: 1, etapeId: 99, createdBy: null }),
      alarme({ id: 3, objet: "Ancienne", statut: "TRAITEE" }),
    ]);
    rendre(<OngletAlarmes dossier={DOSSIER} roles={JURISTE} />);

    expect(screen.getByText(A.echue)).toBeInTheDocument();
    expect(screen.getByText(A.reprise)).toBeInTheDocument();
    expect(screen.getAllByText("Utilisateur 4")).toHaveLength(2);
    // An unknown step keeps its id rather than an empty cell.
    expect(screen.getByText("#99")).toBeInTheDocument();
    // A handled alarm offers no action.
    expect(screen.getAllByRole("button", { name: /^Marquer traitée - / })).toHaveLength(2);
  });

  it("n'offre aucune action à qui ne gère pas les audiences", () => {
    liste([alarme({})]);
    rendre(<OngletAlarmes dossier={DOSSIER} roles={["ROLE_CONSULTATION"]} />);

    expect(screen.queryByRole("button", { name: A.creerAlarme })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /^Marquer traitée/ })).not.toBeInTheDocument();
  });
});

describe("OngletAlarmes - actions", () => {
  it("crée une alarme sur la dernière étape par défaut", async () => {
    rendre(<OngletAlarmes dossier={DOSSIER} roles={JURISTE} />);
    fireEvent.click(screen.getByRole("button", { name: A.creerAlarme }));
    const modale = dialogue(A.creerAlarme);

    fireEvent.click(within(modale).getByRole("button", { name: C.enregistrer, hidden: true }));
    expect((await within(modale).findAllByText(OBLIGATOIRE)).length).toBe(2);

    fireEvent.change(within(modale).getByLabelText(A.champObjet, { exact: false }), { target: { value: " Relancer " } });
    fireEvent.change(within(modale).getByLabelText(A.champEcheance, { exact: false }), { target: { value: FUTUR } });
    fireEvent.click(within(modale).getByRole("button", { name: C.enregistrer, hidden: true }));

    await waitFor(() =>
      expect(mutations.creer).toHaveBeenCalledWith({ etapeId: 6, objet: "Relancer", dateEcheance: FUTUR }),
    );
    expect(toast.success).toHaveBeenCalledWith(A.alarmeCreee);
  });

  it("affiche le refus de créer l'alarme", async () => {
    mutations.creer.mockRejectedValue(new ErreurApi({ code: "X", message: "Étape close" }));
    rendre(<OngletAlarmes dossier={DOSSIER} roles={JURISTE} />);
    fireEvent.click(screen.getByRole("button", { name: A.creerAlarme }));
    const modale = dialogue(A.creerAlarme);
    fireEvent.change(within(modale).getByLabelText(A.champObjet, { exact: false }), { target: { value: "Relancer" } });
    fireEvent.change(within(modale).getByLabelText(A.champEcheance, { exact: false }), { target: { value: FUTUR } });
    fireEvent.click(within(modale).getByRole("button", { name: C.enregistrer, hidden: true }));

    expect(await within(modale).findByText("Étape close")).toBeInTheDocument();
  });

  it("reprogramme en reprenant l'objet actuel quand aucun n'est saisi", async () => {
    liste([alarme({})]);
    rendre(<OngletAlarmes dossier={DOSSIER} roles={JURISTE} />);
    fireEvent.click(screen.getByRole("button", { name: "Reprogrammer - Relancer le greffe" }));
    const modale = dialogue(A.reprogrammerTitre);

    fireEvent.change(within(modale).getByLabelText(A.champEcheance, { exact: false }), { target: { value: FUTUR } });
    fireEvent.click(within(modale).getByRole("button", { name: A.reprogrammer, hidden: true }));

    await waitFor(() =>
      expect(mutations.reprogrammer).toHaveBeenCalledWith({
        alarmeId: 1,
        reprogrammation: { objet: undefined, dateEcheance: FUTUR },
      }),
    );
    expect(toast.success).toHaveBeenCalledWith(A.alarmeReprogrammee);
  });

  it("affiche le refus de reprogrammer", async () => {
    mutations.reprogrammer.mockRejectedValue(new ErreurApi({ code: "X", message: "Déjà traitée" }));
    liste([alarme({})]);
    rendre(<OngletAlarmes dossier={DOSSIER} roles={JURISTE} />);
    fireEvent.click(screen.getByRole("button", { name: "Reprogrammer - Relancer le greffe" }));
    const modale = dialogue(A.reprogrammerTitre);
    fireEvent.change(within(modale).getByLabelText(A.champObjetFacultatif), { target: { value: "Nouvel objet" } });
    fireEvent.change(within(modale).getByLabelText(A.champEcheance, { exact: false }), { target: { value: FUTUR } });
    fireEvent.click(within(modale).getByRole("button", { name: A.reprogrammer, hidden: true }));

    expect(await within(modale).findByText("Déjà traitée")).toBeInTheDocument();
    expect(mutations.reprogrammer).toHaveBeenCalledWith({
      alarmeId: 1,
      reprogrammation: { objet: "Nouvel objet", dateEcheance: FUTUR },
    });
  });

  it("marque une alarme traitée après confirmation, et signale un échec", async () => {
    liste([alarme({})]);
    rendre(<OngletAlarmes dossier={DOSSIER} roles={JURISTE} />);

    fireEvent.click(screen.getByRole("button", { name: "Marquer traitée - Relancer le greffe" }));
    fireEvent.click(within(dialogue(A.traiterTitre)).getByRole("button", { name: A.traiter, hidden: true }));
    await waitFor(() => expect(mutations.traiter).toHaveBeenCalledWith(1));
    expect(toast.success).toHaveBeenCalledWith(A.alarmeTraitee);

    mutations.traiter.mockRejectedValueOnce(new ErreurApi({ code: "X", message: "Refusé" }));
    fireEvent.click(screen.getByRole("button", { name: "Marquer traitée - Relancer le greffe" }));
    fireEvent.click(within(dialogue(A.traiterTitre)).getByRole("button", { name: A.traiter, hidden: true }));
    await waitFor(() => expect(toast.error).toHaveBeenCalledWith("Refusé"));
  });
});
