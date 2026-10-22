import { fireEvent, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { OngletHistorique } from "@/components/modules/dossiers/onglet-historique";
import { OngletPublications } from "@/components/modules/dossiers/onglet-publications";
import { OngletSynthese } from "@/components/modules/dossiers/onglet-synthese";
import { ErreurApi } from "@/lib/api/errors";
import type { Dossier, Publication } from "@/types/domaine";
import { MESSAGES, rendre } from "../utils/rendu";

/**
 * The read-only tabs of the case page: summary, history and publications. A missing value is shown
 * as "—", never as a blank that would suggest nothing exists.
 */
const etat = vi.hoisted(() => ({
  historique: { data: undefined as unknown, isLoading: false, error: null as unknown },
  publications: { data: undefined as unknown, isLoading: false, error: null as unknown },
}));
const pagesDemandees = vi.hoisted(() => ({ historique: [] as number[], publications: [] as number[] }));

vi.mock("@/hooks/useDossiers", () => ({
  useHistoriqueDossier: (_id: number, page: number) => {
    pagesDemandees.historique.push(page);
    return etat.historique;
  },
}));
vi.mock("@/hooks/usePublications", () => ({
  usePublications: ({ page }: { page: number }) => {
    pagesDemandees.publications.push(page);
    return etat.publications;
  },
}));
vi.mock("@/hooks/useLibelles", () => ({
  useLibelles: () => ({
    nomUtilisateur: (id: number) => `Utilisateur ${id}`,
    nomIntervenant: (id: number) => `Avocat ${id}`,
  }),
}));

const D = MESSAGES.fr.dossiers;
const F = MESSAGES.fr.fiche;

function dossier(partiel: Partial<Dossier> = {}): Dossier {
  return {
    id: 3,
    categorie: "RECOUVREMENT",
    juridictionSaisie: "TGI Douala",
    risqueEncouru: 5000000,
    codeAgenceOrigine: "00002",
    codeAgenceContentieuse: null,
    parties: { demandeurs: ["Afriland", "Filiale, SA"], defendeurs: ["SARL Débitrice"] },
    recoursExerces: null,
    motifRenvoi: "",
    dossierCreditOrigine: "CR-77",
    pvTransfert: null,
    incidentCompteReference: "INC-1",
    elementsJustificatifs: "Relevés",
    champAlarme: null,
    juristesAffectes: [4],
    avocatsAffectes: [11, 12],
    estSensible: false,
    sensibiliteStatut: null,
    sensibiliteMotifRetrait: null,
    seuilOrigine: null,
    ...partiel,
  } as unknown as Dossier;
}

beforeEach(() => {
  pagesDemandees.historique = [];
  pagesDemandees.publications = [];
});

describe("OngletSynthese", () => {
  it("affiche l'identification, les parties séparées par un point-virgule et les affectations", () => {
    rendre(<OngletSynthese dossier={dossier()} />);

    expect(screen.getByText("TGI Douala")).toBeInTheDocument();
    expect(screen.getByText("Afriland ; Filiale, SA")).toBeInTheDocument();
    expect(screen.getByText("Utilisateur 4")).toBeInTheDocument();
    expect(screen.getByText("Avocat 12")).toBeInTheDocument();
    // Recovery: only its pair of documents; empty values show a dash.
    expect(screen.getByText("CR-77")).toBeInTheDocument();
    expect(screen.queryByText("INC-1")).not.toBeInTheDocument();
    expect(screen.getAllByText("—").length).toBeGreaterThan(2);
    expect(screen.getByText(F.nonSensible)).toBeInTheDocument();
  });

  it("montre les pièces d'un litige d'exploitation et le champ d'alarme hérité", () => {
    rendre(
      <OngletSynthese
        dossier={dossier({
          categorie: "EXPLOITATION_LITIGES",
          champAlarme: "Ancienne alarme",
          juristesAffectes: [],
          avocatsAffectes: [],
        } as Partial<Dossier>)}
      />,
    );

    expect(screen.getByText("INC-1")).toBeInTheDocument();
    expect(screen.getByText("Ancienne alarme")).toBeInTheDocument();
    expect(screen.getAllByText(F.aucun)).toHaveLength(2);
  });

  it("détaille une diligence rejetée", () => {
    rendre(
      <OngletSynthese
        dossier={dossier({
          estSensible: true,
          sensibiliteStatut: "REJETEE",
          seuilMontant: 1000000,
          seuilOrigine: "GLOBAL",
          typeClientSensible: "PEP",
          sensibiliteMotifRejet: "Risque faible",
        } as Partial<Dossier>)}
      />,
    );

    expect(screen.getByText(MESSAGES.fr.domaine.StatutValidation.REJETEE)).toBeInTheDocument();
    expect(screen.getByText(MESSAGES.fr.domaine.SeuilOrigine.GLOBAL)).toBeInTheDocument();
    expect(screen.getByText("Risque faible")).toBeInTheDocument();
  });

  it("garde la trace d'une diligence validée sans statut ni origine connus", () => {
    rendre(<OngletSynthese dossier={dossier({ estSensible: true, sensibiliteStatut: null } as Partial<Dossier>)} />);

    expect(screen.getByText(F.statutSensibilite)).toBeInTheDocument();
    expect(screen.queryByText(F.motifRejet)).not.toBeInTheDocument();
  });

  it("explique le retrait d'une diligence", () => {
    rendre(
      <OngletSynthese
        dossier={dossier({ sensibiliteMotifRetrait: "Encours remboursé", seuilOrigine: "DEROGATION" } as Partial<Dossier>)}
      />,
    );

    expect(screen.getByText(F.sensibiliteMotifRetrait)).toBeInTheDocument();
    expect(screen.getByText("Encours remboursé")).toBeInTheDocument();
    expect(screen.getByText(MESSAGES.fr.domaine.SeuilOrigine.DEROGATION)).toBeInTheDocument();
  });

  it("retire la diligence sans origine connue", () => {
    rendre(<OngletSynthese dossier={dossier({ sensibiliteMotifRetrait: "Encours remboursé" } as Partial<Dossier>)} />);
    expect(screen.getByText("Encours remboursé")).toBeInTheDocument();
  });
});

describe("OngletHistorique", () => {
  it("affiche le chargement, l'erreur puis l'historique vide", () => {
    etat.historique = { data: undefined, isLoading: true, error: null };
    const { rerender } = rendre(<OngletHistorique dossierId={3} />);
    expect(screen.getByRole("status")).toBeInTheDocument();

    etat.historique = { data: undefined, isLoading: false, error: new ErreurApi({ code: "X", message: "Historique indisponible" }) };
    rerender(<OngletHistorique dossierId={3} />);
    expect(screen.getByText("Historique indisponible")).toBeInTheDocument();

    etat.historique = { data: { content: [], totalPages: 0, totalElements: 0 }, isLoading: false, error: null };
    rerender(<OngletHistorique dossierId={3} />);
    expect(screen.getByText(F.historiqueVide)).toBeInTheDocument();
  });

  it("traduit chaque action et rend ses détails lisibles", () => {
    etat.historique = {
      data: {
        content: [
          {
            id: 1,
            code: "DOSSIER_CREE",
            action: "Création du dossier",
            dateAction: "2026-09-01T10:00:00",
            utilisateurId: 4,
            details: { juristes: [4, 5], seuil: { montant: 10 }, motif: "", reference: "DOS-1" },
          },
          { id: 2, code: "INCONNU", action: "Action ancienne", dateAction: "2026-09-02T10:00:00", utilisateurId: null, details: null },
        ],
        totalPages: 2,
        totalElements: 12,
      },
      isLoading: false,
      error: null,
    };
    rendre(<OngletHistorique dossierId={3} />);

    expect(screen.getByText(MESSAGES.fr.historique.actions.DOSSIER_CREE)).toBeInTheDocument();
    expect(screen.getByText("Utilisateur 4", { exact: false })).toBeInTheDocument();
    expect(screen.getByText(F.historiqueSysteme, { exact: false })).toBeInTheDocument();
    expect(screen.getByText("4, 5")).toBeInTheDocument();
    expect(screen.getByText('{"montant":10}')).toBeInTheDocument();
    expect(screen.getByText("DOS-1")).toBeInTheDocument();
    expect(screen.getByText("—")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: MESSAGES.fr.metier.suivant }));
    expect(pagesDemandees.historique.at(-1)).toBe(1);
  });
});

describe("OngletPublications", () => {
  function publication(partiel: Partial<Publication>): Publication {
    return {
      id: 7,
      type: "AUTRE",
      titre: "Note d'audience",
      statutValidation: "VALIDE",
      avocatNom: "Me Mballa",
      dateDepot: "2026-09-03T10:00:00",
      restrictionAccesNom: null,
      ...partiel,
    } as Publication;
  }

  it("affiche le chargement, l'erreur et l'absence de publication", () => {
    etat.publications = { data: undefined, isLoading: true, error: null };
    const { rerender } = rendre(<OngletPublications dossierId={3} />);
    expect(screen.getByRole("status")).toBeInTheDocument();

    etat.publications = { data: undefined, isLoading: false, error: new ErreurApi({ code: "X", message: "Publications indisponibles" }) };
    rerender(<OngletPublications dossierId={3} />);
    expect(screen.getByText("Publications indisponibles")).toBeInTheDocument();

    etat.publications = { data: { content: [], totalPages: 0, totalElements: 0 }, isLoading: false, error: null };
    rerender(<OngletPublications dossierId={3} />);
    expect(screen.getByText(MESSAGES.fr.publications.ongletAucune)).toBeInTheDocument();
  });

  it("liste les publications, leur restriction d'accès, et pagine", () => {
    etat.publications = {
      data: {
        content: [publication({}), publication({ id: 8, restrictionAccesNom: "Awa Ndiaye" })],
        totalPages: 2,
        totalElements: 12,
      },
      isLoading: false,
      error: null,
    };
    rendre(<OngletPublications dossierId={3} />);

    expect(screen.getAllByRole("link")[0]).toHaveAttribute("href", "/publications/7");
    expect(screen.getByText("Réservée à Awa Ndiaye", { exact: false })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: MESSAGES.fr.metier.suivant }));
    expect(pagesDemandees.publications.at(-1)).toBe(1);
  });
});
