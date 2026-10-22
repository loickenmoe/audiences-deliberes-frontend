import { screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { JournalAudiences } from "@/components/modules/audiences/journal-audiences";
import type { AudienceDuJour, CompteRenduAttendu } from "@/types/domaine";
import { rendre } from "../utils/rendu";

/**
 * Screen 44, hearing log. The screen must **distinguish** a missing report from one submitted by
 * the other party; confusing them would blame a legal officer for a hearing already reported, or vice versa.
 */
const journal = vi.fn();
const attendus = vi.fn();

vi.mock("@/hooks/useAudiences", () => ({
  useJournalAudiences: () => journal(),
  useComptesRendusAttendus: () => attendus(),
}));

vi.mock("@/hooks/useLibelles", () => ({
  useLibelles: () => ({ nomUtilisateur: (id: number) => `Juriste ${id}` }),
}));

function audience(partiel: Partial<AudienceDuJour> = {}): AudienceDuJour {
  return {
    audienceId: 1,
    dossierId: 7,
    referenceDossier: "DOS-2026-001",
    juridiction: "TGI Douala",
    etape: "INSTANCE",
    statut: "TENUE",
    juristesAffectes: [10],
    compteRenduJuriste: "Affaire appelée",
    compteRenduAvocat: null,
    avocatDuCompteRendu: null,
    urlPieceJointeAvocat: null,
    ...partiel,
  };
}

function attendu(partiel: Partial<CompteRenduAttendu> = {}): CompteRenduAttendu {
  return {
    audienceId: 2,
    dossierId: 8,
    referenceDossier: "DOS-2026-002",
    juridiction: "Cour d'appel",
    etape: "RECOURS_1",
    datePlanifiee: "2026-09-01",
    joursDeRetard: 12,
    juristesAffectes: [10],
    compteRenduAvocatDepose: false,
    ...partiel,
  };
}

beforeEach(() => {
  journal.mockReturnValue({ data: { content: [], totalPages: 0, totalElements: 0 }, isLoading: false, error: null });
  attendus.mockReturnValue({ data: { content: [], totalPages: 0, totalElements: 0 }, isLoading: false, error: null });
});

describe("journal des audiences", () => {
  it("montre les deux comptes rendus côte à côte", () => {
    journal.mockReturnValue({
      data: {
        content: [audience({ compteRenduJuriste: "Récit juriste", compteRenduAvocat: "Récit avocat" })],
        totalPages: 1,
        totalElements: 1,
      },
      isLoading: false,
      error: null,
    });

    rendre(<JournalAudiences />);

    expect(screen.getByText("Récit juriste")).toBeInTheDocument();
    expect(screen.getByText("Récit avocat")).toBeInTheDocument();
    expect(screen.getByText("DOS-2026-001")).toBeInTheDocument();
    expect(screen.getByText("Juriste 10")).toBeInTheDocument();
  });

  /** A missing report is flagged and not confused with a lawyer's missing submission. */
  it("distingue le compte rendu manquant du dépôt absent de l'avocat", () => {
    journal.mockReturnValue({
      data: {
        content: [audience({ compteRenduJuriste: null, compteRenduAvocat: null })],
        totalPages: 1,
        totalElements: 1,
      },
      isLoading: false,
      error: null,
    });

    rendre(<JournalAudiences />);

    expect(screen.getByText("Manquant")).toBeInTheDocument();
    expect(screen.getByText("Non déposé")).toBeInTheDocument();
  });

  it("dit qu'il n'y a rien eu plutôt que d'afficher un tableau vide", () => {
    rendre(<JournalAudiences />);

    expect(screen.getByText("Aucune audience ce jour-là.")).toBeInTheDocument();
  });

  /**
   * On a single page the bar **stays visible**: it carries the total count and the rows-per-page
   * choice. Only the navigation controls are inert.
   */
  it("garde la barre de pagination sur une page unique, mais sans navigation possible", () => {
    journal.mockReturnValue({
      data: { content: [audience()], totalPages: 1, totalElements: 1 },
      isLoading: false,
      error: null,
    });

    rendre(<JournalAudiences />);

    expect(screen.getByRole("button", { name: "Page suivante" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Page précédente" })).toBeDisabled();
    expect(screen.getAllByLabelText("Lignes par page").length).toBeGreaterThan(0);
  });

  /** The document attached by the lawyer (court record, hearing note) can be opened from the log. */
  it("propose la pièce jointe au compte rendu de l'avocat", () => {
    journal.mockReturnValue({
      data: {
        content: [
          audience({
            compteRenduAvocat: "Récit avocat",
            urlPieceJointeAvocat: "https://stockage/plumitif.pdf?signature=abc",
          }),
        ],
        totalPages: 1,
        totalElements: 1,
      },
      isLoading: false,
      error: null,
    });

    rendre(<JournalAudiences />);

    const lien = screen.getByRole("link", { name: "Consulter la pièce" });
    expect(lien).toHaveAttribute("href", "https://stockage/plumitif.pdf?signature=abc");
  });

  /** Without an attachment no link is offered. */
  it("ne propose aucun lien quand l'avocat n'a rien joint", () => {
    journal.mockReturnValue({
      data: { content: [audience({ compteRenduAvocat: "Récit avocat" })], totalPages: 1, totalElements: 1 },
      isLoading: false,
      error: null,
    });

    rendre(<JournalAudiences />);

    expect(screen.queryByRole("link", { name: "Consulter la pièce" })).not.toBeInTheDocument();
  });

  it("signale que l'avocat a rapporté là où la banque n'a pas écrit", () => {
    attendus.mockReturnValue({
      data: { content: [attendu({ compteRenduAvocatDepose: true })], totalPages: 1, totalElements: 1 },
      isLoading: false,
      error: null,
    });

    rendre(<JournalAudiences />);

    expect(screen.getByText("DOS-2026-002")).toBeInTheDocument();
    expect(screen.getByText("12 jour(s)")).toBeInTheDocument();
    expect(screen.getByText("L’avocat a rapporté")).toBeInTheDocument();
  });

  /**
   * Pagination must show whenever a next page exists: a silently truncated list is worse than a
   * long one.
   */
  it("pagine le journal dès qu'une seconde page existe", () => {
    journal.mockReturnValue({
      data: { content: [audience()], totalPages: 3, totalElements: 25 },
      isLoading: false,
      error: null,
    });

    rendre(<JournalAudiences />);

    expect(screen.getByRole("button", { name: "Page suivante" })).toBeInTheDocument();
    expect(screen.getByText("Page 1 sur 3")).toBeInTheDocument();
  });

  it("annonce qu'aucun compte rendu ne manque, plutôt qu'un tableau vide", () => {
    rendre(<JournalAudiences />);

    expect(screen.getByText("Aucun compte rendu en attente sur cette période.")).toBeInTheDocument();
  });
});
