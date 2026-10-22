import { fireEvent, screen, waitFor, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { TableauDeBordExecutif } from "@/components/modules/reporting/tableau-de-bord";
import { ErreurApi } from "@/lib/api/errors";
import type { DetailIndicateur, TableauDeBord } from "@/types/domaine";
import { MESSAGES, rendreAvecRequetes } from "../utils/rendu";

/**
 * Screen 39 - executive dashboard: nine indicators, a scope kept in the URL, and a detail per block
 * whose rows lead to the record they count.
 */
const service = vi.hoisted(() => ({ tableauDeBord: vi.fn(), detailTableauDeBord: vi.fn() }));
vi.mock("@/services/reportingService", () => ({ reportingService: service }));

const navigation = vi.hoisted(() => ({ replace: vi.fn(), parametres: new URLSearchParams() }));
vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace: navigation.replace, push: vi.fn() }),
  usePathname: () => "/tableau-de-bord",
  useSearchParams: () => navigation.parametres,
}));

const T = MESSAGES.fr.tableauDeBord;
const D = MESSAGES.fr.detailIndicateur;
const ROLES_DJ = ["ROLE_DJ", "ROLE_JURISTE", "ROLE_CONSULTATION"];

const DONNEES: TableauDeBord = {
  nbDossiersActifs: 42,
  nbAffairesVidees: 17,
  nbAudiencesPlanifiees: 9,
  nbDemandesFraisEnAttente: 3,
  nbProrogationsAlerte: 2,
  nbLitigesGagnes: 5,
  nbLitigesPerdus: 4,
  nbLitigesMixtes: 1,
  provisionsReprises: 250000,
} as TableauDeBord;

function ligne(partiel: Partial<DetailIndicateur>): DetailIndicateur {
  return {
    id: 1,
    dossierId: 3,
    referenceDossier: "DOS-2026-003",
    intitule: "Assignation",
    precision: "Tribunal de Douala",
    date: null,
    montant: null,
    ...partiel,
  };
}

function page(lignes: DetailIndicateur[], totalPages = 1) {
  return { content: lignes, totalPages, totalElements: lignes.length * totalPages };
}

beforeEach(() => {
  vi.clearAllMocks();
  navigation.parametres = new URLSearchParams();
  service.tableauDeBord.mockResolvedValue(DONNEES);
  service.detailTableauDeBord.mockResolvedValue(page([]));
});

async function ouvrir(libelle: string) {
  fireEvent.click(await screen.findByRole("button", { name: `Voir le détail de « ${libelle} »` }));
  return screen.findByRole("dialog", { hidden: true });
}

describe("TableauDeBordExecutif", () => {
  it("affiche les neuf indicateurs et le lien vers les rapports", async () => {
    rendreAvecRequetes(<TableauDeBordExecutif roles={ROLES_DJ} />);

    expect(await screen.findByText("42")).toBeInTheDocument();
    expect(screen.getAllByRole("button", { name: /^Voir le détail de/ })).toHaveLength(9);
    expect(screen.getByRole("link", { name: T.versRapports })).toHaveAttribute("href", "/rapports");
    expect(service.tableauDeBord).toHaveBeenCalledWith(undefined);
  });

  it("masque le lien vers les rapports à qui ne peut pas en générer", async () => {
    rendreAvecRequetes(<TableauDeBordExecutif roles={["ROLE_CONSULTATION"]} />);

    await screen.findByText("42");
    expect(screen.queryByRole("link", { name: T.versRapports })).not.toBeInTheDocument();
  });

  it("lit le périmètre dans l'URL et l'y écrit quand il change", async () => {
    navigation.parametres = new URLSearchParams("categorie=RECOUVREMENT");
    rendreAvecRequetes(<TableauDeBordExecutif roles={ROLES_DJ} />);

    await screen.findByText("42");
    expect(service.tableauDeBord).toHaveBeenCalledWith("RECOUVREMENT");

    fireEvent.change(screen.getByLabelText(T.perimetre, { exact: false }), { target: { value: "" } });
    await waitFor(() => expect(navigation.replace).toHaveBeenCalled());
  });

  it("ignore un périmètre inconnu", async () => {
    navigation.parametres = new URLSearchParams("categorie=INCONNUE");
    rendreAvecRequetes(<TableauDeBordExecutif roles={ROLES_DJ} />);

    await screen.findByText("42");
    expect(service.tableauDeBord).toHaveBeenCalledWith(undefined);
  });

  it("propose de réessayer en cas d'échec", async () => {
    service.tableauDeBord.mockRejectedValueOnce(new ErreurApi({ code: "X", message: "Indicateurs indisponibles" }));
    rendreAvecRequetes(<TableauDeBordExecutif roles={ROLES_DJ} />);

    expect(await screen.findByText("Indicateurs indisponibles")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: T.titre }));
    expect(await screen.findByText("42")).toBeInTheDocument();
  });
});

describe("DetailIndicateurModale", () => {
  it("mène les audiences vers l'onglet audiences, avec date et sans montant", async () => {
    service.detailTableauDeBord.mockResolvedValue(
      page([ligne({ date: "2026-10-02" }), ligne({ id: 2, dossierId: null, referenceDossier: null })]),
    );
    rendreAvecRequetes(<TableauDeBordExecutif roles={ROLES_DJ} />);
    const dialogue = await ouvrir(T.nbAudiencesPlanifiees);

    const lien = await within(dialogue).findByRole("link", { name: "Ouvrir le dossier DOS-2026-003", hidden: true });
    expect(lien).toHaveAttribute("href", "/dossiers/3?onglet=audiences");
    expect(within(dialogue).getByText(D.colonneDate)).toBeInTheDocument();
    expect(within(dialogue).queryByText(D.colonneMontant)).not.toBeInTheDocument();
    expect(within(dialogue).getByText(D.sansDossier)).toBeInTheDocument();
    expect(within(dialogue).getByText("2 élément(s)")).toBeInTheDocument();
    expect(service.detailTableauDeBord).toHaveBeenCalledWith("AUDIENCES_PLANIFIEES", 0, undefined);
  });

  it("mène les frais vers leur propre écran", async () => {
    service.detailTableauDeBord.mockResolvedValue(page([ligne({ id: 8, referenceDossier: null, montant: 120000 })]));
    rendreAvecRequetes(<TableauDeBordExecutif roles={ROLES_DJ} />);
    const dialogue = await ouvrir(T.nbDemandesFraisEnAttente);

    const lien = await within(dialogue).findByRole("link", { name: D.ouvrirFrais, hidden: true });
    expect(lien).toHaveAttribute("href", "/frais/8");
    expect(within(dialogue).getByText(D.colonneMontant)).toBeInTheDocument();
  });

  it("ouvre la synthèse pour un indicateur sans onglet et signale un dossier supprimé", async () => {
    service.detailTableauDeBord.mockResolvedValue(
      page([ligne({}), ligne({ id: 2, dossierId: 9, referenceDossier: null, montant: null })]),
    );
    rendreAvecRequetes(<TableauDeBordExecutif roles={ROLES_DJ} />);
    const dialogue = await ouvrir(T.nbDossiersActifs);

    const lien = await within(dialogue).findByRole("link", { name: "Ouvrir le dossier DOS-2026-003", hidden: true });
    expect(lien).toHaveAttribute("href", "/dossiers/3");
    expect(within(dialogue).getByText(D.dossierSupprime)).toBeInTheDocument();
  });

  it("explique qu'une prorogation peut produire plusieurs alertes", async () => {
    rendreAvecRequetes(<TableauDeBordExecutif roles={ROLES_DJ} />);
    const dialogue = await ouvrir(T.nbProrogationsAlerte);

    expect(await within(dialogue).findByText(D.vide)).toBeInTheDocument();
    expect(within(dialogue).getByText(`0 élément(s) ${D.uneLigneParAlerte}`)).toBeInTheDocument();
  });

  it("pagine le détail", async () => {
    service.detailTableauDeBord.mockResolvedValue(page([ligne({})], 3));
    rendreAvecRequetes(<TableauDeBordExecutif roles={ROLES_DJ} />);
    const dialogue = await ouvrir(T.nbLitigesGagnes);

    expect(await within(dialogue).findByText("Page 1 sur 3")).toBeInTheDocument();
    const precedente = () => within(dialogue).getByRole("button", { name: D.pagePrecedente, hidden: true });
    expect(precedente()).toBeDisabled();

    fireEvent.click(within(dialogue).getByRole("button", { name: D.pageSuivante, hidden: true }));
    expect(await within(dialogue).findByText("Page 2 sur 3")).toBeInTheDocument();
    fireEvent.click(precedente());
    expect(await within(dialogue).findByText("Page 1 sur 3")).toBeInTheDocument();
    expect(service.detailTableauDeBord).toHaveBeenCalledWith("LITIGES_GAGNES", 1, undefined);
  });

  it("affiche l'erreur du détail", async () => {
    service.detailTableauDeBord.mockRejectedValue(new ErreurApi({ code: "X", message: "Détail indisponible" }));
    rendreAvecRequetes(<TableauDeBordExecutif roles={ROLES_DJ} />);
    const dialogue = await ouvrir(T.provisionsReprises);

    expect(await within(dialogue).findByText("Détail indisponible")).toBeInTheDocument();
  });
});
