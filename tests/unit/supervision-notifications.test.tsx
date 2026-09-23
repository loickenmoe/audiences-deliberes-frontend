import { fireEvent, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { SupervisionNotifications } from "@/components/modules/administration/supervision-notifications";
import { tauxAboutissement } from "@/lib/notifications";
import type { LigneCanalNotification, SupervisionNotifications as Supervision } from "@/types/domaine";
import { rendre } from "../utils/rendu";

const relancer = vi.fn();
let donnees: Supervision | undefined;

vi.mock("@/hooks/useNotifications", () => ({
  useSupervisionNotifications: () => ({ data: donnees, isLoading: false, error: null }),
  useRelancerNotification: () => ({ mutate: relancer, isPending: false }),
}));

function ligne(partiel: Partial<LigneCanalNotification> & { canal: string }): LigneCanalNotification {
  return {
    enAttente: 0,
    remises: 0,
    confirmees: 0,
    echecs: 0,
    sansRetour: 0,
    nonJoignables: 0,
    ...partiel,
  };
}

beforeEach(() => {
  relancer.mockReset();
  donnees = {
    dateDebut: "2026-09-01",
    dateFin: "2026-09-30",
    engineActif: false,
    canaux: [
      ligne({ canal: "EMAIL", confirmees: 8, echecs: 2 }),
      ligne({ canal: "SMS", remises: 3, sansRetour: 1, nonJoignables: 4 }),
      ligne({ canal: "WHATSAPP" }),
      ligne({ canal: "TEAMS", enAttente: 1 }),
    ],
    derniersEchecs: [
      {
        id: 12,
        eventId: "alerte-42:EMAIL",
        typeEvenement: "RAPPEL_AUDIENCE",
        canal: "EMAIL",
        statut: "SANS_RETOUR",
        destinataire: "juriste.test@afrilandfirstbank.com",
        destinataireOrigine: "avocat@cabinet.cm",
        derniereErreur: null,
        tentatives: 1,
        dateCreation: "2026-09-20T10:00:00",
      },
      {
        id: 13,
        eventId: "affectation-5-p9:SMS",
        typeEvenement: "AFFECTATION_DOSSIER",
        canal: "SMS",
        statut: "NON_JOIGNABLE",
        destinataire: null,
        destinataireOrigine: null,
        derniereErreur: "COORDONNEE_ABSENTE",
        tentatives: 0,
        dateCreation: "2026-09-21T09:00:00",
      },
    ],
  };
});

describe("taux d'aboutissement", () => {
  it("exclut du calcul les destinataires sans coordonnée", () => {
    // 3 remises + 1 sans retour + 4 non joignables : 3 sur 4, les non joignables mis à part.
    expect(tauxAboutissement(ligne({ canal: "SMS", remises: 3, sansRetour: 1, nonJoignables: 4 }))).toBe(75);
  });

  it("ne rend aucun taux pour un canal sans envoi", () => {
    expect(tauxAboutissement(ligne({ canal: "WHATSAPP" }))).toBeNull();
    // Un canal qui n'a que des fiches incomplètes ne dit rien de lui-même non plus.
    expect(tauxAboutissement(ligne({ canal: "SMS", nonJoignables: 3 }))).toBeNull();
  });

  it("compte les remises non confirmées comme abouties, faute de mieux", () => {
    expect(tauxAboutissement(ligne({ canal: "EMAIL", confirmees: 8, echecs: 2 }))).toBe(80);
  });
});

describe("SupervisionNotifications", () => {
  it("affiche une ligne par canal avec ses six états", () => {
    rendre(<SupervisionNotifications />);

    const tableau = screen.getByRole("table", { name: "Notifications par canal" });
    expect(tableau).toBeInTheDocument();
    const lignes = screen.getAllByRole("row");
    // Quatre canaux, plus les deux en-têtes de tableau.
    expect(lignes.length).toBeGreaterThanOrEqual(5);
    expect(screen.getByRole("cell", { name: "80 %" })).toBeInTheDocument();
    expect(screen.getByRole("cell", { name: "75 %" })).toBeInTheDocument();
    // WhatsApp n'a rien envoyé : pas de taux inventé.
    expect(screen.getAllByRole("cell", { name: "—" }).length).toBeGreaterThanOrEqual(1);
  });

  it("dit que rien ne part tant que le moteur est coupé", () => {
    rendre(<SupervisionNotifications />);
    expect(screen.getByText(/Notification Engine est désactivé/)).toBeInTheDocument();
  });

  it("montre le destinataire réel quand la redirection l'a remplacé", () => {
    rendre(<SupervisionNotifications />);
    expect(screen.getByText("Destinataire réel : avocat@cabinet.cm")).toBeInTheDocument();
  });

  it("relance un envoi abandonné", async () => {
    rendre(<SupervisionNotifications />);

    const boutons = screen.getAllByRole("button", { name: "Relancer" });
    fireEvent.click(boutons[0]!);

    await waitFor(() => expect(relancer).toHaveBeenCalledTimes(1));
    expect(relancer.mock.calls[0]?.[0]).toBe(12);
  });

  /** Sans coordonnée, relancer referait le même constat : le backend le refuse, l'écran aussi. */
  it("n'offre pas de relance sans destinataire", () => {
    rendre(<SupervisionNotifications />);
    expect(screen.getAllByRole("button", { name: "Relancer" })[1]).toBeDisabled();
  });

  it("annonce quand il n'y a rien à examiner", () => {
    donnees = { ...donnees!, derniersEchecs: [] };
    rendre(<SupervisionNotifications />);
    expect(screen.getByText("Aucun envoi à examiner")).toBeInTheDocument();
  });

  it("est traduite en anglais", () => {
    rendre(<SupervisionNotifications />, { langue: "en" });
    expect(screen.getByRole("heading", { name: "External notifications" })).toBeInTheDocument();
    expect(screen.getByRole("table", { name: "Notifications by channel" })).toBeInTheDocument();
  });
});
