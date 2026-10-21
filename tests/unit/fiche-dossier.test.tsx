import { fireEvent, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { FicheDossier } from "@/components/modules/dossiers/fiche-dossier";
import { ErreurApi } from "@/lib/api/errors";
import type { Dossier } from "@/types/domaine";
import { MESSAGES, rendre } from "../utils/rendu";

/**
 * Screen 07 - case page: header actions follow both the profile and the case state, and the tabs
 * follow the WAI-ARIA pattern. Tabs and modals have their own tests: they are stubbed here.
 */
const requete = vi.hoisted(() => ({ valeur: { data: undefined as unknown, isLoading: false, error: null as unknown } }));
vi.mock("@/hooks/useDossiers", () => ({ useDossier: () => requete.valeur }));

function bouchon(nom: string) {
  return (props: { ouvert?: boolean; intention?: string; demandeId?: number | null }) => (
    <div data-testid={nom} data-ouvert={String(props.ouvert ?? "")} data-intention={props.intention ?? ""} />
  );
}
vi.mock("@/components/modules/dossiers/onglet-synthese", () => ({ OngletSynthese: bouchon("synthese") }));
vi.mock("@/components/modules/dossiers/onglet-etapes", () => ({ OngletEtapes: bouchon("etapes") }));
vi.mock("@/components/modules/dossiers/onglet-audiences", () => ({ OngletAudiences: bouchon("audiences") }));
vi.mock("@/components/modules/dossiers/onglet-deliberes", () => ({ OngletDeliberes: bouchon("deliberes") }));
vi.mock("@/components/modules/dossiers/onglet-alarmes", () => ({ OngletAlarmes: bouchon("alarmes") }));
vi.mock("@/components/modules/dossiers/onglet-decisions", () => ({ OngletDecisions: bouchon("decisions") }));
vi.mock("@/components/modules/dossiers/onglet-historique", () => ({ OngletHistorique: bouchon("historique") }));
vi.mock("@/components/modules/dossiers/onglet-documents", () => ({ OngletDocuments: bouchon("documents") }));
vi.mock("@/components/modules/dossiers/onglet-publications", () => ({ OngletPublications: bouchon("publications") }));
vi.mock("@/components/modules/dossiers/derogations-en-attente", () => ({ DerogationsEnAttente: bouchon("derogations") }));
vi.mock("@/components/modules/dossiers/modale-affectation", () => ({ ModaleAffectation: bouchon("modale-affectation") }));
vi.mock("@/components/modules/dossiers/modale-constitution", () => ({ ModaleConstitution: bouchon("modale-constitution") }));
vi.mock("@/components/modules/dossiers/modale-derogation", () => ({ ModaleDerogation: bouchon("modale-derogation") }));
vi.mock("@/components/modules/dossiers/modale-diligence", () => ({ ModaleDiligence: bouchon("modale-diligence") }));
vi.mock("@/components/modules/dossiers/modale-sensibilite", () => ({ ModaleSensibilite: bouchon("modale-sensibilite") }));
vi.mock("@/components/modules/constitutions/modale-lettre", () => ({ ModaleLettre: bouchon("modale-lettre") }));

const F = MESSAGES.fr.fiche;
const DJ = ["ROLE_DJ", "ROLE_JURISTE", "ROLE_CONSULTATION", "ROLE_SAISIE"];
const JURISTE = ["ROLE_JURISTE", "ROLE_CONSULTATION", "ROLE_SAISIE"];
const SH = ["ROLE_SH", "ROLE_CONSULTATION", "ROLE_SAISIE"];

function dossier(partiel: Partial<Dossier> = {}): Dossier {
  return {
    id: 3,
    reference: "DOS-2026-0003",
    nature: "Recouvrement de créance",
    categorie: "RECOUVREMENT",
    clientId: 8,
    clientNom: "Société Test",
    createdAt: "2026-01-05T09:00:00",
    estSensible: false,
    sensibiliteStatut: null,
    etapes: [],
    ...partiel,
  } as Dossier;
}

function charger(valeur: Dossier) {
  requete.valeur = { data: valeur, isLoading: false, error: null };
}

beforeEach(() => {
  charger(dossier());
});

describe("FicheDossier - état", () => {
  it("affiche le chargement puis l'erreur", () => {
    requete.valeur = { data: undefined, isLoading: true, error: null };
    const { rerender } = rendre(<FicheDossier dossierId={3} roles={JURISTE} />);
    expect(screen.getByRole("status")).toBeInTheDocument();

    requete.valeur = { data: undefined, isLoading: false, error: new ErreurApi({ code: "X", message: "Dossier introuvable" }) };
    rerender(<FicheDossier dossierId={3} roles={JURISTE} />);
    expect(screen.getByText("Dossier introuvable")).toBeInTheDocument();
  });

  it("présente le dossier et son client, sans nom de client quand il manque", () => {
    charger(dossier({ clientNom: null } as Partial<Dossier>));
    rendre(<FicheDossier dossierId={3} roles={JURISTE} />);

    expect(screen.getByRole("heading", { name: "Recouvrement de créance" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "#8" })).toHaveAttribute("href", "/clients/8");
  });
});

describe("FicheDossier - actions selon le profil et l'état", () => {
  it("propose au juriste l'affectation, la sollicitation et la proposition de diligence", () => {
    rendre(<FicheDossier dossierId={3} roles={JURISTE} />);

    expect(screen.getByRole("button", { name: F.actionAffectation })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: F.actionConstitution })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: F.actionDiligenceProposer })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: F.actionDerogation })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: F.actionSensibilite })).not.toBeInTheDocument();
  });

  it("demande la dérogation et l'arbitrage sur un dossier sensible validé", () => {
    charger(dossier({ estSensible: true, sensibiliteStatut: "VALIDEE" }));
    rendre(<FicheDossier dossierId={3} roles={DJ} />);

    expect(screen.getByText(`${MESSAGES.fr.dossiers.champEstSensible} · ${MESSAGES.fr.domaine.StatutValidation.VALIDEE}`)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: F.actionDerogation })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: F.actionDiligenceRetirer })).toBeInTheDocument();
    expect(screen.getByTestId("derogations")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: F.actionDiligencePoser })).not.toBeInTheDocument();
  });

  it("ne propose que l'arbitrage sur une proposition en attente", () => {
    charger(dossier({ estSensible: true, sensibiliteStatut: "EN_ATTENTE" }));
    rendre(<FicheDossier dossierId={3} roles={DJ} />);

    fireEvent.click(screen.getByRole("button", { name: F.actionSensibilite }));
    expect(screen.getByTestId("modale-sensibilite")).toHaveAttribute("data-ouvert", "true");
    expect(screen.queryByRole("button", { name: F.actionDiligenceRetirer })).not.toBeInTheDocument();
    expect(screen.queryByTestId("derogations")).not.toBeInTheDocument();
  });

  it("ouvre chaque modale sur l'action choisie", () => {
    charger(dossier());
    rendre(<FicheDossier dossierId={3} roles={DJ} />);

    fireEvent.click(screen.getByRole("button", { name: F.actionAffectation }));
    expect(screen.getByTestId("modale-affectation")).toHaveAttribute("data-ouvert", "true");
    fireEvent.click(screen.getByRole("button", { name: F.actionConstitution }));
    expect(screen.getByTestId("modale-constitution")).toHaveAttribute("data-ouvert", "true");
    expect(screen.getByTestId("modale-affectation")).toHaveAttribute("data-ouvert", "false");

    fireEvent.click(screen.getByRole("button", { name: F.actionDiligencePoser }));
    expect(screen.getByTestId("modale-diligence")).toHaveAttribute("data-intention", "poser");
  });

  it("ouvre la proposition de diligence avec son intention", () => {
    rendre(<FicheDossier dossierId={3} roles={JURISTE} />);
    expect(screen.queryByTestId("modale-diligence")).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: F.actionDiligenceProposer }));
    expect(screen.getByTestId("modale-diligence")).toHaveAttribute("data-intention", "proposer");
  });

  it("ouvre la dérogation et le retrait de diligence", () => {
    charger(dossier({ estSensible: true, sensibiliteStatut: "VALIDEE" }));
    rendre(<FicheDossier dossierId={3} roles={DJ} />);

    fireEvent.click(screen.getByRole("button", { name: F.actionDerogation }));
    expect(screen.getByTestId("modale-derogation")).toHaveAttribute("data-ouvert", "true");
    fireEvent.click(screen.getByRole("button", { name: F.actionDiligenceRetirer }));
    expect(screen.getByTestId("modale-diligence")).toHaveAttribute("data-intention", "retirer");
  });
});

describe("FicheDossier - onglets", () => {
  it("ouvre l'onglet demandé, et la synthèse pour un onglet inconnu", () => {
    const { unmount } = rendre(<FicheDossier dossierId={3} roles={JURISTE} ongletInitial="audiences" />);
    expect(screen.getByRole("tab", { name: F.ongletAudiences })).toHaveAttribute("aria-selected", "true");
    expect(screen.getByTestId("audiences")).toBeInTheDocument();
    unmount();

    rendre(<FicheDossier dossierId={3} roles={JURISTE} ongletInitial="inconnu" />);
    expect(screen.getByTestId("synthese")).toBeInTheDocument();
  });

  it("change d'onglet au clic et au clavier", () => {
    rendre(<FicheDossier dossierId={3} roles={JURISTE} />);
    const synthese = screen.getByRole("tab", { name: F.ongletSynthese });

    fireEvent.keyDown(synthese, { key: "ArrowLeft" });
    expect(screen.getByTestId("publications")).toBeInTheDocument();
    fireEvent.keyDown(screen.getByRole("tab", { name: F.ongletPublications }), { key: "ArrowRight" });
    expect(screen.getByTestId("synthese")).toBeInTheDocument();
    fireEvent.keyDown(synthese, { key: "End" });
    expect(screen.getByTestId("publications")).toBeInTheDocument();
    fireEvent.keyDown(screen.getByRole("tab", { name: F.ongletPublications }), { key: "Home" });
    expect(screen.getByTestId("synthese")).toBeInTheDocument();
    // Other keys leave the tab unchanged.
    fireEvent.keyDown(synthese, { key: "a" });
    expect(screen.getByTestId("synthese")).toBeInTheDocument();

    for (const [onglet, panneau] of [
      [F.ongletEtapes, "etapes"],
      [F.ongletDeliberes, "deliberes"],
      [F.ongletAlarmes, "alarmes"],
      [F.ongletDecisions, "decisions"],
      [F.ongletHistorique, "historique"],
      [F.ongletDocuments, "documents"],
    ] as const) {
      fireEvent.click(screen.getByRole("tab", { name: onglet }));
      expect(screen.getByTestId(panneau)).toBeInTheDocument();
    }
  });

  it("n'affiche pas l'onglet publications à qui ne peut pas les lire", () => {
    // A consultation account with no business profile: it does not read publications.
    rendre(<FicheDossier dossierId={3} roles={["ROLE_CONSULTATION"]} ongletInitial="publications" />);

    expect(screen.queryByRole("tab", { name: F.ongletPublications })).not.toBeInTheDocument();
    expect(screen.queryByTestId("publications")).not.toBeInTheDocument();
  });

  it("affiche l'onglet publications au SH, qui les consulte depuis le 21 octobre 2026", () => {
    rendre(<FicheDossier dossierId={3} roles={SH} ongletInitial="publications" />);

    expect(screen.getByRole("tab", { name: F.ongletPublications })).toBeInTheDocument();
  });
});
