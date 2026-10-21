import { fireEvent, screen, waitFor, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { FilePartages } from "@/components/modules/ged/file-partages";
import { RapportJournalierGed } from "@/components/modules/ged/rapport-journalier";
import { aujourdhui } from "@/lib/calendrier";
import { ErreurApi } from "@/lib/api/errors";
import type { PartageAvocat } from "@/types/domaine";
import { MESSAGES, rendre } from "../utils/rendu";

/**
 * DMS queues: document shares awaiting approval on sensitive cases, and the daily DMS report, where
 * a quiet day is not an error.
 */
const etat = vi.hoisted(() => ({
  partages: { data: undefined as unknown, isLoading: false, error: null as unknown },
  rapport: { data: undefined as unknown, isLoading: false, error: null as unknown },
}));
const arbitrer = vi.hoisted(() => vi.fn());
const pages = vi.hoisted(() => vi.fn());
const dates = vi.hoisted(() => vi.fn());
const ged = vi.hoisted(() => ({ consulter: vi.fn(), recupererContenu: vi.fn() }));

vi.mock("@/hooks/useGed", () => ({
  usePartagesAvocat: (page: number) => {
    pages(page);
    return etat.partages;
  },
  useArbitrerPartage: () => ({ mutateAsync: arbitrer, isPending: false }),
  useRapportJournalier: (date: string) => {
    dates(date);
    return etat.rapport;
  },
}));
vi.mock("@/services/gedService", () => ({ gedService: ged }));
vi.mock("@/components/metier/apercu-fichier", () => ({
  ApercuFichier: ({ ouvert, nomFichier, obtenir }: { ouvert: boolean; nomFichier: string; obtenir: () => Promise<Blob> }) =>
    ouvert ? (
      <button type="button" onClick={() => void obtenir().catch(() => undefined)}>
        {`Aperçu ${nomFichier}`}
      </button>
    ) : null,
}));

const toast = vi.hoisted(() => ({ success: vi.fn(), error: vi.fn() }));
vi.mock("sonner", () => ({ toast }));

const P = MESSAGES.fr.partages;
const DOC = MESSAGES.fr.documents;
const R = MESSAGES.fr.rapportJournalier;

const PARTAGE: PartageAvocat = {
  documentId: 7,
  nomFichier: "conclusions.pdf",
  dossierId: 3,
  referenceDossier: "DOS-2026-0003",
  partageParNom: null,
  partageLe: "2026-10-01T10:00:00",
} as PartageAvocat;

beforeEach(() => {
  vi.clearAllMocks();
  etat.partages = { data: { content: [PARTAGE], totalPages: 2, totalElements: 11 }, isLoading: false, error: null };
  arbitrer.mockResolvedValue({});
  ged.consulter.mockResolvedValue({ urlTelechargement: "https://minio/p" });
  ged.recupererContenu.mockResolvedValue(new Blob(["x"]));
});

describe("FilePartages", () => {
  it("affiche le chargement, l'erreur, puis l'absence de partage", () => {
    etat.partages = { data: undefined, isLoading: true, error: null };
    const { rerender } = rendre(<FilePartages />);
    expect(screen.getByRole("status")).toBeInTheDocument();

    etat.partages = { data: undefined, isLoading: false, error: new ErreurApi({ code: "X", message: "File indisponible" }) };
    rerender(<FilePartages />);
    expect(screen.getByText("File indisponible")).toBeInTheDocument();

    etat.partages = { data: { content: [], totalPages: 0, totalElements: 0 }, isLoading: false, error: null };
    rerender(<FilePartages />);
    expect(screen.getByText(P.vide)).toBeInTheDocument();
  });

  it("liste les propositions, montre la pièce et pagine", async () => {
    rendre(<FilePartages />);

    expect(screen.getByRole("link", { name: "DOS-2026-0003" })).toHaveAttribute("href", "/dossiers/3?onglet=documents");
    expect(screen.getByText("-")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: `${DOC.consulter} - conclusions.pdf` }));
    fireEvent.click(screen.getByRole("button", { name: "Aperçu conclusions.pdf" }));
    await waitFor(() => expect(ged.recupererContenu).toHaveBeenCalledWith("https://minio/p"));

    fireEvent.click(screen.getByRole("button", { name: MESSAGES.fr.metier.suivant }));
    expect(pages).toHaveBeenLastCalledWith(1);
  });

  it("refuse un aperçu sans adresse", async () => {
    ged.consulter.mockResolvedValue({ urlTelechargement: null });
    rendre(<FilePartages />);
    fireEvent.click(screen.getByRole("button", { name: `${DOC.consulter} - conclusions.pdf` }));
    fireEvent.click(screen.getByRole("button", { name: "Aperçu conclusions.pdf" }));

    await waitFor(() => expect(ged.consulter).toHaveBeenCalledWith(7));
    expect(ged.recupererContenu).not.toHaveBeenCalled();
  });

  it("valide un partage après confirmation, et signale un échec", async () => {
    arbitrer.mockResolvedValueOnce({}).mockRejectedValueOnce(new ErreurApi({ code: "X", message: "Déjà tranché" }));
    rendre(<FilePartages />);
    const valider = () => {
      fireEvent.click(screen.getByRole("button", { name: "Valider le partage - conclusions.pdf" }));
      const fenetre = screen.getByRole("dialog", { name: DOC.validerPartage, hidden: true });
      fireEvent.click(within(fenetre).getByRole("button", { name: DOC.validerPartage, hidden: true }));
    };

    valider();
    await waitFor(() => expect(toast.success).toHaveBeenCalledWith(DOC.partageValide));
    expect(arbitrer).toHaveBeenCalledWith({ documentId: 7 });
    valider();
    await waitFor(() => expect(toast.error).toHaveBeenCalledWith("Déjà tranché"));
  });

  it("ouvre le rejet motivé", () => {
    rendre(<FilePartages />);
    fireEvent.click(screen.getByRole("button", { name: "Rejeter le partage - conclusions.pdf" }));
    expect(screen.getAllByRole("dialog", { hidden: true }).some((d) => d.hasAttribute("open"))).toBe(true);
  });
});

describe("RapportJournalierGed", () => {
  it("ouvre sur aujourd'hui et revient à aujourd'hui", () => {
    etat.rapport = { data: undefined, isLoading: false, error: null };
    rendre(<RapportJournalierGed />);
    expect(dates).toHaveBeenLastCalledWith(aujourdhui());

    fireEvent.change(screen.getByLabelText(R.champDate), { target: { value: "2026-09-01" } });
    expect(dates).toHaveBeenLastCalledWith("2026-09-01");
    fireEvent.click(screen.getByRole("button", { name: R.aujourdhui }));
    expect(dates).toHaveBeenLastCalledWith(aujourdhui());
  });

  it("présente l'activité et les audiences planifiées du jour", () => {
    etat.rapport = {
      data: {
        date: "2026-10-01",
        dossiersManipules: 4,
        piecesAjoutees: 7,
        affairesNouvelles: 1,
        planificationActes: [
          { dossierId: 3, reference: "DOS-2026-0003" },
          { dossierId: 3, reference: "DOS-2026-0003" },
        ],
      },
      isLoading: false,
      error: null,
    };
    rendre(<RapportJournalierGed />);

    expect(screen.getByText("7")).toBeInTheDocument();
    expect(screen.getAllByRole("link", { name: "DOS-2026-0003" })[0]).toHaveAttribute("href", "/dossiers/3?onglet=audiences");
    expect(screen.queryByText(R.vide)).not.toBeInTheDocument();
  });

  it("dit qu'une journée calme n'est pas une erreur", () => {
    etat.rapport = {
      data: { date: "2026-10-01", dossiersManipules: 0, piecesAjoutees: 0, affairesNouvelles: 0, planificationActes: [] },
      isLoading: false,
      error: null,
    };
    rendre(<RapportJournalierGed />);

    expect(screen.getByText(R.vide)).toBeInTheDocument();
    expect(screen.getByText(R.aucuneAudience)).toBeInTheDocument();
  });

  it("affiche le chargement puis l'erreur", () => {
    etat.rapport = { data: undefined, isLoading: true, error: null };
    const { rerender } = rendre(<RapportJournalierGed />);
    expect(screen.getByRole("status")).toBeInTheDocument();

    etat.rapport = { data: undefined, isLoading: false, error: new ErreurApi({ code: "X", message: "Rapport indisponible" }) };
    rerender(<RapportJournalierGed />);
    expect(screen.getByText("Rapport indisponible")).toBeInTheDocument();
  });
});
