import { fireEvent, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { FileNotifications } from "@/components/modules/notifications/file-notifications";
import { ErreurApi } from "@/lib/api/errors";
import type { Alerte } from "@/types/domaine";
import { MESSAGES, rendre } from "../utils/rendu";

/**
 * Screen 03 - my notifications: views by status, a server-side type filter, the live channel
 * status, and marking an alert as handled.
 */
const useMesNotifications = vi.hoisted(() => vi.fn());
const traiter = vi.hoisted(() => vi.fn());
const canal = vi.hoisted(() => ({ connecte: true }));
const navigation = vi.hoisted(() => ({ replace: vi.fn(), parametres: new URLSearchParams() }));

vi.mock("@/hooks/useAlertes", () => ({
  useMesNotifications: (...args: unknown[]) => useMesNotifications(...args),
  useTraiterAlerte: () => ({ mutate: traiter, isPending: false }),
}));
vi.mock("@/providers/alertes.provider", () => ({ useCanalAlertes: () => canal }));
vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace: navigation.replace, push: vi.fn() }),
  usePathname: () => "/notifications",
  useSearchParams: () => navigation.parametres,
}));

const toast = vi.hoisted(() => ({ success: vi.fn(), error: vi.fn() }));
vi.mock("sonner", () => ({ toast }));

const N = MESSAGES.fr.notifications;
const INTERNE = ["ROLE_JURISTE", "ROLE_CONSULTATION"];
const AVOCAT = ["ROLE_AVOCAT"];

function alerte(partiel: Partial<Alerte>): Alerte {
  return {
    id: 1,
    type: "RAPPEL_AUDIENCE",
    declencheur: "[J-3] Audience du 12 octobre",
    dossierId: 3,
    dateDeclenchement: "2026-10-09T08:00:00",
    statut: "DECLENCHEE",
    dateTraitement: null,
    ...partiel,
  } as Alerte;
}

function resultat(alertes: Alerte[]) {
  useMesNotifications.mockReturnValue({
    data: { content: alertes, totalPages: 1, totalElements: alertes.length },
    isLoading: false,
    error: null,
    refetch: vi.fn(),
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  canal.connecte = true;
  navigation.parametres = new URLSearchParams();
  resultat([]);
});

describe("FileNotifications", () => {
  it("ouvre sur les notifications non lues, et dit que le temps réel est actif", () => {
    rendre(<FileNotifications roles={INTERNE} />);

    expect(useMesNotifications).toHaveBeenLastCalledWith("DECLENCHEE", 0, 10, undefined);
    expect(screen.getByText(N.vide)).toBeInTheDocument();
    expect(screen.getByText(N.tempsReelActif)).toBeInTheDocument();
  });

  it("lit la vue et le type dans l'URL, et signale le repli sans temps réel", () => {
    canal.connecte = false;
    navigation.parametres = new URLSearchParams("vue=traitees&type=PROROGATION");
    rendre(<FileNotifications roles={INTERNE} />);

    expect(useMesNotifications).toHaveBeenLastCalledWith("TRAITEE", 0, 10, "PROROGATION");
    expect(screen.getByText(N.videTraitees)).toBeInTheDocument();
    expect(screen.getByText(N.tempsReelInterrompu)).toBeInTheDocument();
  });

  it("écrit la vue et le type choisis dans l'URL", async () => {
    rendre(<FileNotifications roles={INTERNE} />);
    fireEvent.click(screen.getByRole("button", { name: N.vues.toutes }));
    fireEvent.change(screen.getByLabelText(N.filtreType), { target: { value: "PROROGATION" } });

    await waitFor(() => expect(navigation.replace.mock.calls.at(-1)?.[0]).toContain("type=PROROGATION"));
  });

  it("présente chaque alerte, avec un lien vers son dossier pour un profil interne", () => {
    resultat([
      alerte({}),
      alerte({ id: 2, dossierId: null, statut: "TRAITEE", dateTraitement: "2026-10-10T10:00:00" }),
      alerte({ id: 3, statut: "TRAITEE" }),
    ]);
    rendre(<FileNotifications roles={INTERNE} />);

    expect(screen.getAllByText("Audience du 12 octobre")).toHaveLength(3);
    expect(screen.getAllByRole("link", { name: "#3" }).length).toBeGreaterThan(0);
    expect(screen.getByText(N.horsDossier)).toBeInTheDocument();
    expect(screen.getByText(/^Traitée le /)).toBeInTheDocument();
    expect(screen.getAllByRole("button", { name: N.marquerTraitee })).toHaveLength(1);
  });

  it("montre le dossier sans lien à un avocat", () => {
    resultat([alerte({})]);
    rendre(<FileNotifications roles={AVOCAT} />);

    expect(screen.getByText("#3")).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "#3" })).not.toBeInTheDocument();
  });

  it("marque une alerte traitée, et signale un refus", () => {
    traiter
      .mockImplementationOnce((_id, { onSuccess }) => onSuccess())
      .mockImplementationOnce((_id, { onError }) => onError(new ErreurApi({ code: "X", message: "Pas votre alerte" })));
    resultat([alerte({})]);
    rendre(<FileNotifications roles={INTERNE} />);
    const bouton = screen.getByRole("button", { name: N.marquerTraitee });

    fireEvent.click(bouton);
    expect(traiter).toHaveBeenCalledWith(1, expect.anything());
    expect(toast.success).toHaveBeenCalledWith(N.traiteeSucces);
    fireEvent.click(bouton);
    expect(toast.error).toHaveBeenCalledWith("Pas votre alerte");
  });
});
