import { fireEvent, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { ExportAudit } from "@/components/modules/audit/export-audit";
import { VerificateurEmpreinte } from "@/components/modules/audit/verificateur-empreinte";
import { ErreurApi } from "@/lib/api/errors";
import type { ArchiveAudit } from "@/types/domaine";
import { MESSAGES, rendre } from "../utils/rendu";

/**
 * Sealed audit exports and their verification: an export needs a period, each archive can be
 * fetched again, and a held file is recognized by its fingerprint computed in the browser.
 */
const exporter = vi.hoisted(() => vi.fn());
const archives = vi.hoisted(() => ({ data: undefined as unknown }));
const service = vi.hoisted(() => ({ urlArchive: vi.fn(), verifier: vi.fn() }));
const empreinteFichier = vi.hoisted(() => vi.fn());

vi.mock("@/hooks/useAudit", () => ({
  useExporterAudit: () => ({ mutate: exporter, isPending: false }),
  useArchivesAudit: () => archives,
}));
vi.mock("@/hooks/useLibelles", () => ({ useLibelles: () => ({ nomUtilisateur: (id: number) => `Utilisateur ${id}` }) }));
vi.mock("@/services/auditService", () => ({ auditService: service }));
vi.mock("@/lib/empreinte", async (original) => ({
  ...(await original<typeof import("@/lib/empreinte")>()),
  empreinteFichier,
}));

const toast = vi.hoisted(() => ({ success: vi.fn(), error: vi.fn() }));
vi.mock("sonner", () => ({ toast }));

const A = MESSAGES.fr.audit;
const EMPREINTE = "a".repeat(64);

const ARCHIVE: ArchiveAudit = {
  id: 3,
  reference: "AUD-2026-0042",
  utilisateurId: 4,
  dateExport: "2026-10-01T10:00:00",
  dateDebut: "2026-09-01",
  dateFin: "2026-09-30",
  perimetre: "TOUT",
  format: "PDF",
  lignes: 120,
  empreinte: EMPREINTE,
  tailleOctets: 2048,
} as ArchiveAudit;

beforeEach(() => {
  vi.clearAllMocks();
  archives.data = { content: [] };
});

describe("ExportAudit", () => {
  it("exige une période avant d'extraire, et la propose par raccourci", () => {
    const periode = vi.fn();
    rendre(<ExportAudit filtres={{ perimetre: "TOUT" } as never} debut="" fin="" onPeriode={periode} />);

    expect(screen.getByRole("alert")).toHaveTextContent(A.periodeObligatoire);
    expect(screen.getByRole("button", { name: A.exporterPdf })).toBeDisabled();
    expect(screen.getByText(A.archivesVide)).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: A.periode.mois }));
    expect(periode).toHaveBeenCalledWith({ debut: expect.any(String), fin: expect.any(String) });
  });

  it("extrait au format choisi, remet le fichier et annonce l'empreinte", () => {
    const clic = vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(() => undefined);
    exporter.mockImplementation((_variables, { onSuccess }) =>
      onSuccess({ fichier: new Blob(["x"]), nomFichier: "audit.pdf", empreinte: EMPREINTE }),
    );
    rendre(<ExportAudit filtres={{ perimetre: "TOUT" } as never} debut="2026-09-01" fin="2026-09-30" onPeriode={vi.fn()} />);
    fireEvent.click(screen.getByRole("button", { name: A.exporterExcel }));

    expect(exporter).toHaveBeenCalledWith(
      { filtres: { perimetre: "TOUT", dateDebut: "2026-09-01", dateFin: "2026-09-30" }, format: "EXCEL" },
      expect.anything(),
    );
    expect(clic).toHaveBeenCalled();
    expect(toast.success).toHaveBeenCalledWith("Extraction produite et scellée (empreinte aaaaaaaaaaaa…).");
    clic.mockRestore();
  });

  it("signale une extraction refusée", () => {
    exporter.mockImplementation((_variables, { onError }) => onError(new ErreurApi({ code: "X", message: "Période trop longue" })));
    rendre(<ExportAudit filtres={{} as never} debut="2026-09-01" fin="2026-09-30" onPeriode={vi.fn()} />);
    fireEvent.click(screen.getByRole("button", { name: A.exporterPdf }));

    expect(toast.error).toHaveBeenCalledWith("Période trop longue");
  });

  it("liste les archives et récupère l'une d'elles", async () => {
    const ouvrir = vi.spyOn(window, "open").mockImplementation(() => null);
    service.urlArchive.mockResolvedValueOnce("https://minio/a").mockRejectedValueOnce(new ErreurApi({ code: "X", message: "Archive absente" }));
    archives.data = { content: [ARCHIVE, { ...ARCHIVE, id: 4, reference: "AUD-2026-0043", utilisateurId: null }] };
    rendre(<ExportAudit filtres={{} as never} debut="" fin="" onPeriode={vi.fn()} />);

    expect(screen.getByText("AUD-2026-0042")).toBeInTheDocument();
    expect(screen.getByText("Utilisateur 4", { exact: false })).toBeInTheDocument();
    const boutons = screen.getAllByRole("button", { name: A.recuperer });
    fireEvent.click(boutons[0]!);
    await waitFor(() => expect(ouvrir).toHaveBeenCalledWith("https://minio/a", "_blank", "noopener,noreferrer"));
    fireEvent.click(boutons[1]!);
    await waitFor(() => expect(toast.error).toHaveBeenCalledWith("Archive absente"));
    ouvrir.mockRestore();
  });
});

describe("VerificateurEmpreinte", () => {
  function deposer(nom = "audit.pdf") {
    fireEvent.change(document.getElementById("verifier-fichier")!, { target: { files: [new File(["x"], nom)] } });
  }

  it("reconnaît un fichier scellé ici", async () => {
    empreinteFichier.mockResolvedValue(EMPREINTE);
    service.verifier.mockResolvedValue({ reconnue: true, archive: ARCHIVE });
    rendre(<VerificateurEmpreinte />);
    fireEvent.click(screen.getByRole("button", { name: A.verifierChoisir }));
    deposer();

    expect(await screen.findByText("Fichier reconnu : archive AUD-2026-0042, du 2026-09-01 au 2026-09-30, 120 ligne(s).")).toBeInTheDocument();
    expect(screen.getByText(A.verifierPortee)).toBeInTheDocument();
    expect(screen.getByText("audit.pdf")).toBeInTheDocument();
    expect(service.verifier).toHaveBeenCalledWith(EMPREINTE);
  });

  it("dit qu'un fichier est inconnu", async () => {
    empreinteFichier.mockResolvedValue(EMPREINTE);
    service.verifier.mockResolvedValue({ reconnue: false, archive: null });
    rendre(<VerificateurEmpreinte />);
    deposer();

    expect(await screen.findByText(A.verifierInconnue)).toBeInTheDocument();
    expect(screen.getByText(A.verifierInconnueAide)).toBeInTheDocument();
  });

  it("explique qu'il faut HTTPS, ou que la vérification a échoué", async () => {
    empreinteFichier.mockRejectedValueOnce(new Error("CONTEXTE_NON_SECURISE")).mockRejectedValueOnce(new Error("autre"));
    rendre(<VerificateurEmpreinte />);

    deposer();
    expect(await screen.findByText(A.verifierContexte)).toBeInTheDocument();
    deposer();
    expect(await screen.findByText(A.verifierEchec)).toBeInTheDocument();
  });

  it("ignore une sélection vide", () => {
    rendre(<VerificateurEmpreinte />);
    fireEvent.change(document.getElementById("verifier-fichier")!, { target: { files: [] } });
    expect(empreinteFichier).not.toHaveBeenCalled();
  });
});
