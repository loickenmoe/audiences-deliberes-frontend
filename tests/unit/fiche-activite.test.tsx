import { fireEvent, screen, waitFor, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { FicheActivite } from "@/components/modules/reporting/fiche-activite";
import { ErreurApi } from "@/lib/api/errors";
import type { ActionDetaillee, RapportActivite } from "@/types/domaine";
import { MESSAGES, rendreAvecRequetes } from "../utils/rendu";

/**
 * A person's activity sheet: the period is chosen first, then the counts are shown, each opening
 * the counted actions, each leading to its case file tab.
 */
const service = vi.hoisted(() => ({
  rapportActivite: vi.fn(),
  exporterActivite: vi.fn(),
  detailsActivite: vi.fn(),
}));
vi.mock("@/services/reportingService", () => ({ reportingService: service }));

const telechargerBlob = vi.hoisted(() => vi.fn());
vi.mock("@/lib/documents", async (original) => ({
  ...(await original<typeof import("@/lib/documents")>()),
  telechargerBlob,
}));

const M = MESSAGES.fr.activite;

const RAPPORT: RapportActivite = {
  utilisateurId: 7,
  nom: "Awa Ndiaye",
  profil: "JURISTE",
  dateDebut: "2026-09-01",
  dateFin: "2026-09-30",
  lignes: [
    { code: "AUDIENCE_PLANIFIEE", total: 4 },
    { code: "DOSSIER_CREE", total: 2 },
  ],
  delaiMoyenSaisieCompteRendu: 2.25,
} as RapportActivite;

function action(partiel: Partial<ActionDetaillee>): ActionDetaillee {
  return {
    id: 1,
    code: "AUDIENCE_PLANIFIEE",
    action: "Audience planifiée",
    dateAction: "2026-09-12T10:00:00",
    dossierId: 3,
    referenceDossier: "DOS-2026-003",
    ...partiel,
  };
}

async function afficher() {
  fireEvent.click(screen.getByRole("button", { name: M.afficher }));
  await screen.findByRole("table");
}

beforeEach(() => {
  vi.clearAllMocks();
  service.rapportActivite.mockResolvedValue(RAPPORT);
  service.detailsActivite.mockResolvedValue({ content: [], totalPages: 0, totalElements: 0 });
});

describe("FicheActivite - période et affichage", () => {
  it("invite à choisir une période tant que rien n'est affiché", () => {
    rendreAvecRequetes(<FicheActivite />);

    expect(screen.getByRole("heading", { name: M.titre })).toBeInTheDocument();
    expect(screen.getByText(M.avantGeneration)).toBeInTheDocument();
    // No download before the sheet has been seen.
    expect(screen.queryByRole("button", { name: M.telecharger })).not.toBeInTheDocument();
  });

  it("affiche chaque nature avec son nombre et le délai moyen, pour soi-même", async () => {
    rendreAvecRequetes(<FicheActivite />);
    await afficher();

    expect(service.rapportActivite).toHaveBeenCalledWith(expect.any(String), expect.any(String), undefined);
    const lignes = screen.getAllByRole("row");
    expect(lignes).toHaveLength(3);
    const premiere = lignes[1]!;
    expect(within(premiere).getByText(MESSAGES.fr.historique.actions.AUDIENCE_PLANIFIEE)).toBeInTheDocument();
    expect(within(premiere).getByText("4")).toBeInTheDocument();
    expect(screen.getByText("2.3 j")).toBeInTheDocument();
  });

  it("n'affiche pas de délai quand aucun compte rendu n'a été saisi", async () => {
    service.rapportActivite.mockResolvedValue({ ...RAPPORT, delaiMoyenSaisieCompteRendu: null });
    rendreAvecRequetes(<FicheActivite />);
    await afficher();

    expect(screen.queryByText(M.delai, { exact: false })).not.toBeInTheDocument();
  });

  it("annonce une période sans activité", async () => {
    service.rapportActivite.mockResolvedValue(null);
    rendreAvecRequetes(<FicheActivite />);
    fireEvent.click(screen.getByRole("button", { name: M.afficher }));

    expect(await screen.findByText(M.vide)).toBeInTheDocument();
    expect(screen.getByText(M.videTexte)).toBeInTheDocument();
  });

  it("parle de l'autre personne quand une cible est donnée", async () => {
    service.rapportActivite.mockResolvedValue(null);
    rendreAvecRequetes(<FicheActivite cible={{ utilisateurId: 7 }} nomAffiche="Awa Ndiaye" />);

    expect(screen.getByRole("heading", { name: "Activité de Awa Ndiaye" })).toBeInTheDocument();
    expect(screen.getByText(M.descriptionAutre)).toBeInTheDocument();
    // Ids carry the target, so two sheets can share the screen.
    expect(document.getElementById("activite-debut-u7")).not.toBeNull();

    fireEvent.click(screen.getByRole("button", { name: M.afficher }));
    expect(await screen.findByText(M.videTexteAutre)).toBeInTheDocument();
    expect(service.rapportActivite).toHaveBeenCalledWith(expect.any(String), expect.any(String), { utilisateurId: 7 });
  });

  it("désigne un avocat du répertoire par son identifiant d'avocat", () => {
    rendreAvecRequetes(<FicheActivite cible={{ avocatId: 9 }} />);

    expect(document.getElementById("activite-debut-a9")).not.toBeNull();
    expect(screen.getByRole("heading", { name: "Activité de cette personne" })).toBeInTheDocument();
  });

  it("refuse une période inversée", () => {
    rendreAvecRequetes(<FicheActivite />);
    fireEvent.change(document.getElementById("activite-debut-moi")!, { target: { value: "2026-09-30" } });
    fireEvent.change(document.getElementById("activite-fin-moi")!, { target: { value: "2026-09-01" } });

    expect(screen.getByText(M.periodeInversee)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: M.afficher })).toBeDisabled();
  });

  it("affiche le message du serveur en cas d'échec", async () => {
    service.rapportActivite.mockRejectedValue(new ErreurApi({ code: "X", message: "Accès refusé" }));
    rendreAvecRequetes(<FicheActivite />);
    fireEvent.click(screen.getByRole("button", { name: M.afficher }));

    expect(await screen.findByText("Accès refusé")).toBeInTheDocument();
  });
});

describe("FicheActivite - téléchargement", () => {
  it("télécharge au format choisi sous le nom attendu", async () => {
    const contenu = new Blob(["x"]);
    service.exporterActivite.mockResolvedValue(contenu);
    rendreAvecRequetes(<FicheActivite />);
    await afficher();

    fireEvent.change(screen.getByLabelText(M.formatExport), { target: { value: "CSV" } });
    fireEvent.click(screen.getByRole("button", { name: M.telecharger }));

    await waitFor(() => expect(telechargerBlob).toHaveBeenCalled());
    expect(service.exporterActivite).toHaveBeenCalledWith(expect.any(String), expect.any(String), "CSV", undefined);
    const [fichier, nom] = telechargerBlob.mock.calls[0]!;
    expect(fichier).toBe(contenu);
    expect(nom).toMatch(/^activite-awa-ndiaye-.*\.csv$/);
  });

  it("ne télécharge rien quand le serveur n'a pas de fichier", async () => {
    service.exporterActivite.mockResolvedValue(null);
    rendreAvecRequetes(<FicheActivite />);
    await afficher();
    fireEvent.click(screen.getByRole("button", { name: M.telecharger }));

    await waitFor(() => expect(service.exporterActivite).toHaveBeenCalled());
    expect(telechargerBlob).not.toHaveBeenCalled();
  });

  it("signale un téléchargement échoué", async () => {
    service.exporterActivite.mockRejectedValue(new Error("réseau"));
    rendreAvecRequetes(<FicheActivite />);
    await afficher();
    fireEvent.click(screen.getByRole("button", { name: M.telecharger }));

    expect(await screen.findByText(M.telechargementEchoue)).toBeInTheDocument();
  });
});

describe("FicheActivite - détail d'une nature", () => {
  async function ouvrirDetail() {
    await afficher();
    fireEvent.click(screen.getByRole("button", { name: /Voir les 4 actions/ }));
  }

  it("mène chaque action vers l'onglet de son dossier, ou vers sa synthèse", async () => {
    service.detailsActivite.mockResolvedValue({
      content: [
        action({ id: 1 }),
        action({ id: 2, code: "DOSSIER_CREE", dossierId: 8, referenceDossier: "DOS-2026-008" }),
        action({ id: 3, dossierId: null, referenceDossier: null }),
        action({ id: 4, dossierId: 5, referenceDossier: null }),
      ],
      totalPages: 1,
      totalElements: 4,
    });
    rendreAvecRequetes(<FicheActivite />);
    await ouvrirDetail();

    const lien = await screen.findByRole("link", { name: "Ouvrir le dossier DOS-2026-003" });
    expect(lien).toHaveAttribute("href", "/dossiers/3?onglet=audiences");
    expect(screen.getByRole("link", { name: "Ouvrir le dossier DOS-2026-008" })).toHaveAttribute(
      "href",
      "/dossiers/8",
    );
    expect(screen.getByText(M.detailHorsDossier)).toBeInTheDocument();
    expect(screen.getByText(M.detailDossierSupprime)).toBeInTheDocument();
    expect(service.detailsActivite).toHaveBeenCalledWith("AUDIENCE_PLANIFIEE", expect.any(String), expect.any(String), 0, undefined);
  });

  it("garde la référence en texte quand le lecteur n'a pas d'écran dossier", async () => {
    service.detailsActivite.mockResolvedValue({ content: [action({})], totalPages: 1, totalElements: 1 });
    rendreAvecRequetes(<FicheActivite lienVersDossier={false} />);
    await ouvrirDetail();

    expect(await screen.findByText("DOS-2026-003")).toBeInTheDocument();
    expect(screen.queryByRole("link")).not.toBeInTheDocument();
  });

  it("annonce un détail vide", async () => {
    rendreAvecRequetes(<FicheActivite />);
    await ouvrirDetail();

    expect(await screen.findByText(M.detailVide)).toBeInTheDocument();
  });

  it("affiche l'erreur du détail", async () => {
    service.detailsActivite.mockRejectedValue(new ErreurApi({ code: "X", message: "Détail indisponible" }));
    rendreAvecRequetes(<FicheActivite />);
    await ouvrirDetail();

    expect(await screen.findByText("Détail indisponible")).toBeInTheDocument();
  });
});
