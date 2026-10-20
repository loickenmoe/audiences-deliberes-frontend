import { fireEvent, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { FormulaireRapport } from "@/components/modules/reporting/formulaire-rapport";
import { ErreurApi } from "@/lib/api/errors";
import type { Rapport } from "@/types/domaine";
import { MESSAGES, rendreAvecRequetes } from "../utils/rendu";

/**
 * Screen 40 - activity report. Nothing is sent before the user asks; a 204 is an empty state, not
 * an error; the export reuses the displayed period and scope.
 */
const service = vi.hoisted(() => ({ genererRapport: vi.fn(), exporterRapport: vi.fn() }));
vi.mock("@/services/reportingService", () => ({ reportingService: service }));

const toast = vi.hoisted(() => ({ success: vi.fn(), error: vi.fn(), info: vi.fn() }));
vi.mock("sonner", () => ({ toast }));

const telechargerBlob = vi.hoisted(() => vi.fn());
vi.mock("@/lib/documents", async (original) => ({
  ...(await original<typeof import("@/lib/documents")>()),
  telechargerBlob,
}));

const R = MESSAGES.fr.rapports;

const RAPPORT = {
  type: "MENSUEL",
  dateDebut: "2026-08-20",
  dateFin: "2026-09-20",
  nbNouveauxDossiers: 12,
  nbAudiencesTenues: 31,
  nbDemandesFraisDeposees: 4,
  nbDeliberesEnregistres: 6,
  nbLitigesGagnes: 3,
  nbLitigesPerdus: 2,
  nbLitigesMixtes: 1,
  provisionsReprises: 1500000,
} as Rapport;

beforeEach(() => {
  vi.clearAllMocks();
  service.genererRapport.mockResolvedValue(RAPPORT);
});

describe("FormulaireRapport", () => {
  it("n'envoie rien avant le clic, puis affiche les indicateurs", async () => {
    rendreAvecRequetes(<FormulaireRapport />);
    expect(screen.getByText(R.avantGeneration)).toBeInTheDocument();
    expect(service.genererRapport).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole("button", { name: R.generer }));

    expect(await screen.findByText("Du 2026-08-20 au 2026-09-20")).toBeInTheDocument();
    expect(screen.getByText("31")).toBeInTheDocument();
    expect(screen.getByText(R.nbLitigesMixtes)).toBeInTheDocument();
    expect(service.genererRapport).toHaveBeenCalledWith(expect.objectContaining({ type: "MENSUEL" }));
  });

  it("présente une période sans activité comme un état vide", async () => {
    service.genererRapport.mockResolvedValue(null);
    rendreAvecRequetes(<FormulaireRapport />);
    fireEvent.click(screen.getByRole("button", { name: R.generer }));

    expect(await screen.findByText(R.vide)).toBeInTheDocument();
  });

  it("signale l'échec de la compilation", async () => {
    service.genererRapport.mockRejectedValue(new ErreurApi({ code: "X", message: "Serveur indisponible" }));
    rendreAvecRequetes(<FormulaireRapport />);
    fireEvent.click(screen.getByRole("button", { name: R.generer }));

    await waitFor(() => expect(toast.error).toHaveBeenCalledWith("Serveur indisponible"));
    expect(await screen.findByRole("alert")).toHaveTextContent("Serveur indisponible");
  });

  it("garde le périmètre quand le type de période change, et masque le résultat affiché", async () => {
    rendreAvecRequetes(<FormulaireRapport />);
    fireEvent.change(screen.getByLabelText(R.perimetre), { target: { value: "RECOUVREMENT" } });
    fireEvent.click(screen.getByRole("button", { name: R.generer }));
    await screen.findByText("31");

    fireEvent.change(screen.getByLabelText(R.type, { exact: false }), { target: { value: "ANNUEL" } });

    expect(screen.queryByText("31")).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: R.generer }));
    await waitFor(() =>
      expect(service.genererRapport).toHaveBeenLastCalledWith(
        expect.objectContaining({ type: "ANNUEL", categorie: "RECOUVREMENT" }),
      ),
    );

    // Back to every category.
    fireEvent.change(screen.getByLabelText(R.perimetre), { target: { value: "" } });
    fireEvent.click(screen.getByRole("button", { name: R.generer }));
    await waitFor(() =>
      expect(service.genererRapport).toHaveBeenLastCalledWith(expect.objectContaining({ categorie: undefined })),
    );
  });

  it("refuse une période inversée", () => {
    rendreAvecRequetes(<FormulaireRapport />);
    fireEvent.change(document.getElementById("rapport-debut")!, { target: { value: "2026-09-30" } });
    fireEvent.change(document.getElementById("rapport-fin")!, { target: { value: "2026-09-01" } });

    expect(screen.getByText(R.periodeInversee)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: R.generer })).toBeDisabled();
    expect(screen.getByRole("button", { name: MESSAGES.fr.metier.exporter })).toBeDisabled();
  });

  it("exporte au format choisi", async () => {
    const contenu = new Blob(["x"]);
    service.exporterRapport.mockResolvedValue(contenu);
    rendreAvecRequetes(<FormulaireRapport />);

    fireEvent.change(screen.getByLabelText(MESSAGES.fr.metier.formatExport), { target: { value: "EXCEL" } });
    fireEvent.click(screen.getByRole("button", { name: MESSAGES.fr.metier.exporter }));

    await waitFor(() => expect(telechargerBlob).toHaveBeenCalled());
    expect(service.exporterRapport).toHaveBeenCalledWith(expect.objectContaining({ type: "MENSUEL" }), "EXCEL");
    expect(toast.success).toHaveBeenCalledWith("Rapport EXCEL téléchargé.");
  });

  it("dit qu'il n'y a rien à exporter plutôt que de livrer un fichier vide", async () => {
    service.exporterRapport.mockResolvedValue(null);
    rendreAvecRequetes(<FormulaireRapport />);
    fireEvent.click(screen.getByRole("button", { name: MESSAGES.fr.metier.exporter }));

    expect(await screen.findByText(R.vide)).toBeInTheDocument();
    expect(toast.info).toHaveBeenCalledWith(R.exportVide);
    expect(telechargerBlob).not.toHaveBeenCalled();
  });

  it("signale un export échoué", async () => {
    service.exporterRapport.mockRejectedValue(new ErreurApi({ code: "X", message: "Export impossible" }));
    rendreAvecRequetes(<FormulaireRapport />);
    fireEvent.click(screen.getByRole("button", { name: MESSAGES.fr.metier.exporter }));

    await waitFor(() => expect(toast.error).toHaveBeenCalledWith("Export impossible"));
    expect(screen.getByRole("button", { name: MESSAGES.fr.metier.exporter })).toBeEnabled();
  });
});
