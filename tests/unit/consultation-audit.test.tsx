import { fireEvent, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { ConsultationAudit } from "@/components/modules/audit/consultation-audit";
import { ErreurApi } from "@/lib/api/errors";
import { MESSAGES, rendre } from "../utils/rendu";

/**
 * Audit screen: search the audit log by scope, author, action and period; inconsistent criteria
 * are stopped on screen; the export reuses the displayed filters.
 */
const useAudit = vi.hoisted(() => vi.fn());
const refetch = vi.hoisted(() => vi.fn());
const exportRecu = vi.hoisted(() => vi.fn());

vi.mock("@/hooks/useAudit", () => ({ useAudit: (...args: unknown[]) => useAudit(...args) }));
vi.mock("@/hooks/useLibelles", () => ({ useLibelles: () => ({ nomUtilisateur: (id: number) => `Utilisateur ${id}` }) }));
vi.mock("@/hooks/useReferentiels", () => ({ useUtilisateurs: () => ({ data: [{ id: 4 }, { id: 5 }] }) }));
vi.mock("@/components/modules/audit/verificateur-empreinte", () => ({ VerificateurEmpreinte: () => null }));
vi.mock("@/components/modules/audit/export-audit", () => ({
  ExportAudit: (props: { filtres: unknown; onPeriode: (p: { debut: string; fin: string }) => void }) => {
    exportRecu(props.filtres);
    return (
      <button type="button" onClick={() => props.onPeriode({ debut: "2026-10-01", fin: "2026-10-31" })}>
        Ce mois-ci
      </button>
    );
  },
}));

const A = MESSAGES.fr.audit;

function resultat(contenu: unknown[], actionsDisponibles: unknown[] = []) {
  useAudit.mockReturnValue({
    data: { content: contenu, totalPages: 2, totalElements: 15, actionsDisponibles },
    isLoading: false,
    error: null,
    refetch,
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  resultat([]);
});

describe("ConsultationAudit", () => {
  it("affiche chaque action, son auteur et ses détails lisibles", () => {
    resultat(
      [
        {
          id: 1,
          code: "DOSSIER_CREE",
          action: "Création du dossier",
          dateAction: "2026-10-01T10:00:00",
          utilisateurId: 4,
          details: { juristes: [4, 5], seuil: { montant: 10 }, motif: "", reference: "DOS-1" },
        },
        { id: 2, code: "INCONNU", action: "Action ancienne", dateAction: "2026-10-02T10:00:00", utilisateurId: null, details: {} },
      ],
      [{ code: "DOSSIER_CREE", libelle: "Création du dossier" }],
    );
    rendre(<ConsultationAudit />);

    expect(screen.getAllByText(MESSAGES.fr.historique.actions.DOSSIER_CREE).length).toBeGreaterThan(0);
    expect(screen.getByText("Action ancienne")).toBeInTheDocument();
    expect(screen.getByText("4, 5")).toBeInTheDocument();
    expect(screen.getByText('{"montant":10}')).toBeInTheDocument();
    expect(screen.getByText("DOS-1")).toBeInTheDocument();
    expect(screen.getAllByText("—").length).toBeGreaterThanOrEqual(2);
    expect(screen.getByText(A.consultationTracee)).toBeInTheDocument();
  });

  const LIGNE = { id: 1, code: "DOSSIER_CREE", action: "Création", dateAction: "2026-10-01T10:00:00", utilisateurId: 4, details: null };

  it("transmet les filtres et revient à la première page à chaque changement", () => {
    resultat([LIGNE]);
    rendre(<ConsultationAudit />);
    fireEvent.click(screen.getByRole("button", { name: MESSAGES.fr.metier.suivant }));
    expect(useAudit).toHaveBeenLastCalledWith(expect.anything(), 1, 10);

    fireEvent.change(screen.getByLabelText(A.filtreAuteur), { target: { value: "4" } });
    fireEvent.change(screen.getByLabelText(A.filtreAction), { target: { value: "" } });
    fireEvent.change(screen.getByLabelText(A.du), { target: { value: "2026-10-01" } });
    fireEvent.change(screen.getByLabelText(A.au), { target: { value: "2026-10-31" } });

    expect(useAudit).toHaveBeenLastCalledWith(
      { perimetre: "TOUT", dossierId: undefined, utilisateurId: 4, code: undefined, dateDebut: "2026-10-01", dateFin: "2026-10-31" },
      0,
      10,
    );
  });

  it("exige le numéro du dossier pour la portée « un dossier »", () => {
    rendre(<ConsultationAudit />);
    fireEvent.change(screen.getByLabelText(A.filtrePerimetre), { target: { value: "UN_DOSSIER" } });

    expect(screen.getByRole("alert")).toHaveTextContent(A.dossierManquant);
    fireEvent.change(screen.getByLabelText(A.filtreDossier), { target: { value: "12" } });
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    expect(useAudit).toHaveBeenLastCalledWith(expect.objectContaining({ perimetre: "UN_DOSSIER", dossierId: 12 }), 0, 10);
    expect(exportRecu).toHaveBeenLastCalledWith(expect.objectContaining({ dossierId: 12 }));

    // Leaving the scope forgets the case number.
    fireEvent.change(screen.getByLabelText(A.filtrePerimetre), { target: { value: "HORS_DOSSIER" } });
    expect(useAudit).toHaveBeenLastCalledWith(expect.objectContaining({ perimetre: "HORS_DOSSIER", dossierId: undefined }), 0, 10);
  });

  it("refuse une période inversée, puis réinitialise tous les filtres", () => {
    rendre(<ConsultationAudit />);
    fireEvent.change(screen.getByLabelText(A.du), { target: { value: "2026-10-31" } });
    fireEvent.change(screen.getByLabelText(A.au), { target: { value: "2026-10-01" } });
    expect(screen.getByRole("alert")).toHaveTextContent(A.fenetreInversee);

    fireEvent.click(screen.getByRole("button", { name: A.reinitialiser }));
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    expect(useAudit).toHaveBeenLastCalledWith(
      { perimetre: "TOUT", dossierId: undefined, utilisateurId: undefined, code: undefined, dateDebut: undefined, dateFin: undefined },
      0,
      10,
    );
  });

  it("applique la période choisie dans l'export", () => {
    rendre(<ConsultationAudit />);
    fireEvent.click(screen.getByRole("button", { name: "Ce mois-ci" }));
    expect(useAudit).toHaveBeenLastCalledWith(expect.objectContaining({ dateDebut: "2026-10-01", dateFin: "2026-10-31" }), 0, 10);
  });

  it("change la taille de page et propose de réessayer après un échec", () => {
    resultat([LIGNE]);
    rendre(<ConsultationAudit />);
    fireEvent.change(screen.getByLabelText(MESSAGES.fr.metier.lignesParPage), { target: { value: "25" } });
    expect(useAudit).toHaveBeenLastCalledWith(expect.anything(), 0, 25);

    useAudit.mockReturnValue({ data: undefined, isLoading: false, error: new ErreurApi({ code: "X", message: "Audit indisponible" }), refetch });
    fireEvent.change(screen.getByLabelText(A.filtreAuteur), { target: { value: "5" } });
    fireEvent.click(screen.getByRole("button", { name: MESSAGES.fr.commun.reessayer }));
    expect(refetch).toHaveBeenCalled();
  });
});
