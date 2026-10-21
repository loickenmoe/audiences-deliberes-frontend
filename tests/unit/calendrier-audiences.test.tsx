import { fireEvent, screen, waitFor, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { CalendrierAudiences } from "@/components/modules/audiences/calendrier-audiences";
import { ErreurApi } from "@/lib/api/errors";
import type { EntreeCalendrier } from "@/types/domaine";
import { MESSAGES, rendre } from "../utils/rendu";

/**
 * Screen 22 - hearing calendar: an agenda per day over a week, month or quarter aligned on natural
 * boundaries, browsed period by period, and exported as PDF or Excel.
 */
const etat = vi.hoisted(() => ({ requete: { data: undefined as unknown, isLoading: false, error: null as unknown, refetch: vi.fn() } }));
const demande = vi.hoisted(() => vi.fn());
const exporterCalendrier = vi.hoisted(() => vi.fn());
const telechargerBlob = vi.hoisted(() => vi.fn());

vi.mock("@/hooks/useAudiences", () => ({
  useCalendrier: (periode: string, debut: string) => {
    demande(periode, debut);
    return etat.requete;
  },
}));
vi.mock("@/hooks/useLibelles", () => ({
  useLibelles: () => ({ nomUtilisateur: (id: number) => `Juriste ${id}`, nomIntervenant: (id: number) => `Avocat ${id}` }),
}));
vi.mock("@/services/audienceService", () => ({ audienceService: { exporterCalendrier } }));
vi.mock("@/lib/documents", async (original) => ({
  ...(await original<typeof import("@/lib/documents")>()),
  telechargerBlob,
}));

const K = MESSAGES.fr.calendrier;
const P = MESSAGES.fr.domaine.PeriodeCalendrier;

function entree(partiel: Partial<EntreeCalendrier>): EntreeCalendrier {
  return {
    audienceId: 1,
    dossierId: 3,
    referenceDossier: "DOS-2026-0003",
    juridiction: "TGI Douala",
    etape: "INSTANCE",
    juristesAffectes: [4],
    avocatsAffectes: [11],
    codeAgenceOrigine: null,
    clientNom: "Société Test",
    risqueEncouru: 5000000,
    datePlanifiee: "2026-10-14",
    ...partiel,
  };
}

function charger(entrees: EntreeCalendrier[]) {
  etat.requete = { data: entrees, isLoading: false, error: null, refetch: vi.fn() };
}

beforeEach(() => {
  vi.clearAllMocks();
  charger([]);
  exporterCalendrier.mockResolvedValue(new Blob(["x"]));
});

describe("CalendrierAudiences", () => {
  it("ouvre sur la semaine en cours, un lundi", () => {
    rendre(<CalendrierAudiences />);

    const [periode, debut] = demande.mock.calls.at(-1)!;
    expect(periode).toBe("HEBDOMADAIRE");
    expect(new Date(`${debut}T00:00:00`).getDay()).toBe(1);
    expect(screen.getByText(K.aucune)).toBeInTheDocument();
  });

  it("regroupe les audiences par jour, dans l'ordre", () => {
    charger([
      entree({ audienceId: 2, datePlanifiee: "2026-10-16", etape: "ETAPE_INCONNUE", juristesAffectes: [], avocatsAffectes: [], clientNom: null }),
      entree({}),
    ]);
    rendre(<CalendrierAudiences />);

    const jours = screen.getAllByRole("heading", { level: 2 });
    expect(jours).toHaveLength(2);
    const premier = jours[0]!.closest("section")!;
    expect(within(premier).getByRole("link", { name: "DOS-2026-0003" })).toHaveAttribute("href", "/dossiers/3");
    expect(within(premier).getByText("Juriste 4")).toBeInTheDocument();
    expect(within(premier).getByText(MESSAGES.fr.domaine.TypeEtape.INSTANCE)).toBeInTheDocument();
    const second = jours[1]!.closest("section")!;
    expect(within(second).getByText("ETAPE_INCONNUE")).toBeInTheDocument();
    expect(within(second).getAllByText("—")).toHaveLength(3);
    expect(screen.getByText("· 2 audiences")).toBeInTheDocument();
  });

  it("change de période et la parcourt", () => {
    rendre(<CalendrierAudiences />);
    fireEvent.click(screen.getByRole("button", { name: P.MENSUELLE }));
    const debutMois = demande.mock.calls.at(-1)![1] as string;
    expect(demande.mock.calls.at(-1)![0]).toBe("MENSUELLE");
    expect(debutMois.endsWith("-01")).toBe(true);

    fireEvent.click(screen.getByRole("button", { name: K.suivante }));
    expect(demande.mock.calls.at(-1)![1]).not.toBe(debutMois);
    fireEvent.click(screen.getByRole("button", { name: K.precedente }));
    expect(demande.mock.calls.at(-1)![1]).toBe(debutMois);
    fireEvent.click(screen.getByRole("button", { name: K.suivante }));
    fireEvent.click(screen.getByRole("button", { name: K.aujourdhui }));
    expect(demande.mock.calls.at(-1)![1]).toBe(debutMois);
  });

  it("exporte la période au format choisi, sous un nom daté", async () => {
    rendre(<CalendrierAudiences />);
    const debut = demande.mock.calls.at(-1)![1] as string;

    fireEvent.click(screen.getByRole("button", { name: K.exporterExcel }));
    await waitFor(() => expect(telechargerBlob).toHaveBeenCalledWith(expect.any(Blob), `calendrier-hebdomadaire-${debut}.xlsx`));
    fireEvent.click(screen.getByRole("button", { name: K.exporterPdf }));
    await waitFor(() => expect(telechargerBlob).toHaveBeenLastCalledWith(expect.any(Blob), `calendrier-hebdomadaire-${debut}.pdf`));
    expect(exporterCalendrier).toHaveBeenCalledWith("HEBDOMADAIRE", debut, "PDF");
  });

  it("signale un export échoué", async () => {
    exporterCalendrier.mockRejectedValue(new ErreurApi({ code: "X", message: "Export impossible" }));
    rendre(<CalendrierAudiences />);
    fireEvent.click(screen.getByRole("button", { name: K.exporterPdf }));

    expect(await screen.findByRole("alert")).toHaveTextContent("Export impossible");
  });

  it("affiche le chargement, puis l'erreur avec une relance", () => {
    etat.requete = { data: undefined, isLoading: true, error: null, refetch: vi.fn() };
    const { rerender } = rendre(<CalendrierAudiences />);
    expect(screen.getByRole("status")).toBeInTheDocument();

    etat.requete = { data: undefined, isLoading: false, error: new ErreurApi({ code: "X", message: "Calendrier indisponible" }), refetch: vi.fn() };
    rerender(<CalendrierAudiences />);
    fireEvent.click(screen.getByRole("button", { name: MESSAGES.fr.commun.reessayer }));
    expect(etat.requete.refetch).toHaveBeenCalled();
  });
});
