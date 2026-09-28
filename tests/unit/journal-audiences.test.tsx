import { screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { JournalAudiences } from "@/components/modules/audiences/journal-audiences";
import type { AudienceDuJour, CompteRenduAttendu } from "@/types/domaine";
import { rendre } from "../utils/rendu";

/**
 * Écran 44 — journal des audiences (observation métier du 2026-09-25).
 *
 * Ce que ces tests protègent : l'écran **distingue** un compte rendu absent d'un compte rendu
 * déposé par l'autre partie. C'est toute la valeur de l'écran — confondre les deux ferait
 * reprocher à un juriste une audience dont l'avocat a déjà rendu compte, ou l'inverse.
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

  /** Un compte rendu absent se signale ; il ne se confond pas avec un dépôt non fait de l'avocat. */
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

  /** Une seule page : pas de commandes de navigation, qui n'auraient rien à faire. */
  it("n'affiche pas la pagination quand tout tient sur une page", () => {
    journal.mockReturnValue({
      data: { content: [audience()], totalPages: 1, totalElements: 1 },
      isLoading: false,
      error: null,
    });

    rendre(<JournalAudiences />);

    expect(screen.queryByRole("button", { name: "Page suivante" })).not.toBeInTheDocument();
  });

  /** La pièce que l'avocat joint — plumitif, note d'audience — se consulte depuis le journal. */
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

  /** Sans pièce jointe, aucun lien n'est proposé : l'écran n'invente pas un document. */
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
   * La pagination ne s'affiche que lorsqu'une page suivante existe : une liste tronquée sans le
   * dire est pire qu'une liste longue, car rien n'avertit qu'il manque quelque chose.
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
