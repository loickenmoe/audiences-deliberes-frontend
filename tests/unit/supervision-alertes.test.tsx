import { fireEvent, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { SupervisionAlertes } from "@/components/modules/administration/supervision-alertes";
import { ErreurApi } from "@/lib/api/errors";
import { MESSAGES, rendre } from "../utils/rendu";

/**
 * In-app channel monitoring: delivery (with its 99 % threshold) and real-time broadcast (usage, no
 * threshold) are shown apart; an empty window is neither compliant nor failing.
 */
const etat = vi.hoisted(() => ({ requete: { data: undefined as unknown, isLoading: false, isFetching: false, error: null as unknown, refetch: vi.fn() } }));
const periode = vi.hoisted(() => vi.fn());

vi.mock("@/hooks/useAlertes", () => ({
  useStatistiquesDiffusion: (debut: string, fin: string) => {
    periode(debut, fin);
    return etat.requete;
  },
}));

const S = MESSAGES.fr.supervisionAlertes;

function statistiques(partiel: Record<string, unknown>) {
  etat.requete = {
    data: {
      observees: 200,
      diffusees: 150,
      differees: 49,
      echecs: 1,
      nonTraitees: 12,
      tauxDelivrance: 99.5,
      tauxDiffusionTempsReel: 75,
      seuilRespecte: true,
      ...partiel,
    },
    isLoading: false,
    isFetching: false,
    error: null,
    refetch: vi.fn(),
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  statistiques({});
});

describe("SupervisionAlertes", () => {
  it("présente les deux taux séparément, et les comptes", () => {
    rendre(<SupervisionAlertes />);

    expect(screen.getByText("99.50 %")).toBeInTheDocument();
    expect(screen.getByText(S.seuilRespecte)).toBeInTheDocument();
    expect(screen.getByText("75.00 %")).toBeInTheDocument();
    expect(screen.getByText(S.sansSeuil)).toBeInTheDocument();
    expect(screen.getByText("12 alerte(s) de cette période n’ont pas encore été ouvertes par leur destinataire.", { exact: false })).toBeInTheDocument();
  });

  it("signale un taux sous le seuil", () => {
    statistiques({ tauxDelivrance: 97, seuilRespecte: false, echecs: 0 });
    rendre(<SupervisionAlertes />);
    expect(screen.getByText(S.seuilFranchi)).toBeInTheDocument();
  });

  it("ne mesure rien sur une période sans alerte", () => {
    statistiques({ observees: 0 });
    rendre(<SupervisionAlertes />);
    expect(screen.getByText(S.aucuneMesure)).toBeInTheDocument();
    expect(screen.queryByText(S.tauxDelivrance)).not.toBeInTheDocument();
  });

  it("refuse une fenêtre inversée", () => {
    rendre(<SupervisionAlertes />);
    fireEvent.change(screen.getByLabelText(S.du), { target: { value: "2026-10-31" } });
    fireEvent.change(screen.getByLabelText(S.au), { target: { value: "2026-10-01" } });

    expect(screen.getByRole("alert")).toHaveTextContent(S.fenetreInversee);
    expect(screen.getByRole("button", { name: S.actualiser })).toBeDisabled();
    expect(periode).toHaveBeenLastCalledWith("2026-10-31", "2026-10-01");
  });

  it("affiche le chargement, puis l'erreur avec une relance", () => {
    etat.requete = { data: undefined, isLoading: true, isFetching: true, error: null, refetch: vi.fn() };
    const { rerender } = rendre(<SupervisionAlertes />);
    expect(screen.getByRole("status")).toBeInTheDocument();

    etat.requete = { data: undefined, isLoading: false, isFetching: false, error: new ErreurApi({ code: "X", message: "Mesure indisponible" }), refetch: vi.fn() };
    rerender(<SupervisionAlertes />);
    expect(screen.getByText("Mesure indisponible")).toBeInTheDocument();
    for (const bouton of screen.getAllByRole("button", { name: S.actualiser })) fireEvent.click(bouton);
    expect(etat.requete.refetch).toHaveBeenCalledTimes(2);
  });

  it("n'affiche rien tant qu'aucune mesure n'est arrivée", () => {
    etat.requete = { data: undefined, isLoading: false, isFetching: false, error: null, refetch: vi.fn() };
    rendre(<SupervisionAlertes />);
    expect(screen.queryByText(S.tauxDelivrance)).not.toBeInTheDocument();
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });
});
