import { fireEvent, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { ActiviteDesAvocats } from "@/components/modules/reporting/activite-des-avocats";
import { ActiviteParPersonne } from "@/components/modules/reporting/activite-par-personne";
import { ErreurApi } from "@/lib/api/errors";
import type { RapportAvocats, RapportNominatif } from "@/types/domaine";
import { MESSAGES, rendreAvecRequetes } from "../utils/rendu";

/**
 * The two management tables of the reporting screen: internal production per person, and lawyers'
 * submissions. Indicators only, sorted by name; a name opens that person's full activity sheet.
 */
const service = vi.hoisted(() => ({
  rapportNominatif: vi.fn(),
  rapportAvocats: vi.fn(),
  rapportActivite: vi.fn(),
  exporterActivite: vi.fn(),
  detailsActivite: vi.fn(),
}));
vi.mock("@/services/reportingService", () => ({ reportingService: service }));

const N = MESSAGES.fr.nominatif;
const A = MESSAGES.fr.avocatsActivite;

const NOMINATIF: RapportNominatif = {
  dateDebut: "2026-09-01",
  dateFin: "2026-09-30",
  lignes: [
    {
      utilisateurId: 7,
      nom: "Awa Ndiaye",
      profil: "Juriste",
      dossiersOuverts: 3,
      audiencesPlanifiees: 5,
      comptesRendusSaisis: 4,
      deliberesEnregistres: 1,
      lettresRedigees: 2,
      fraisTraites: 6,
      delaiMoyenSaisieCompteRendu: 1.5,
    },
    {
      utilisateurId: 9,
      nom: null,
      profil: null,
      dossiersOuverts: 0,
      audiencesPlanifiees: 0,
      comptesRendusSaisis: 0,
      deliberesEnregistres: 0,
      lettresRedigees: 0,
      fraisTraites: 0,
      delaiMoyenSaisieCompteRendu: null,
    },
  ],
} as RapportNominatif;

const AVOCATS: RapportAvocats = {
  dateDebut: "2026-09-01",
  dateFin: "2026-09-30",
  lignes: [
    {
      utilisateurId: 11,
      avocatId: 4,
      nom: "Me Mballa",
      comptesRendusDeposes: 2,
      demandesFraisDeposees: 1,
      autresPublicationsDeposees: 0,
      explicationsFournies: 3,
    },
    {
      utilisateurId: 12,
      avocatId: null,
      nom: null,
      comptesRendusDeposes: 1,
      demandesFraisDeposees: 0,
      autresPublicationsDeposees: 0,
      explicationsFournies: 0,
    },
  ],
};

beforeEach(() => {
  vi.clearAllMocks();
  service.rapportNominatif.mockResolvedValue(NOMINATIF);
  service.rapportAvocats.mockResolvedValue(AVOCATS);
  service.rapportActivite.mockResolvedValue(null);
});

describe("ActiviteParPersonne", () => {
  it("affiche une ligne par personne, sans délai quand rien n'a été saisi", async () => {
    rendreAvecRequetes(<ActiviteParPersonne />);
    expect(screen.getByText(N.avantGeneration)).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: N.genererAccessible }));

    expect(await screen.findByRole("button", { name: "Awa Ndiaye" })).toBeInTheDocument();
    expect(screen.getByText("Juriste")).toBeInTheDocument();
    expect(screen.getByText("1.5 j")).toBeInTheDocument();
    // A removed account keeps its records, under a neutral label.
    expect(screen.getByRole("button", { name: "Compte retiré (#9)" })).toBeInTheDocument();
    expect(screen.getByText(N.delaiSansObjet)).toBeInTheDocument();
  });

  it("ouvre puis ferme la fiche complète d'une personne", async () => {
    rendreAvecRequetes(<ActiviteParPersonne />);
    fireEvent.click(screen.getByRole("button", { name: N.genererAccessible }));
    fireEvent.click(await screen.findByRole("button", { name: "Awa Ndiaye" }));

    expect(screen.getByRole("heading", { name: "Activité de Awa Ndiaye" })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: N.fermerFiche }));
    expect(screen.queryByRole("heading", { name: "Activité de Awa Ndiaye" })).not.toBeInTheDocument();
  });

  it("annonce une période sans activité", async () => {
    service.rapportNominatif.mockResolvedValue(null);
    rendreAvecRequetes(<ActiviteParPersonne />);
    fireEvent.click(screen.getByRole("button", { name: N.genererAccessible }));

    expect(await screen.findByText(N.vide)).toBeInTheDocument();
  });

  it("refuse une période inversée et affiche l'erreur du serveur", async () => {
    service.rapportNominatif.mockRejectedValue(new ErreurApi({ code: "X", message: "Réservé à la Direction" }));
    rendreAvecRequetes(<ActiviteParPersonne />);

    fireEvent.change(document.getElementById("nominatif-debut")!, { target: { value: "2026-09-30" } });
    fireEvent.change(document.getElementById("nominatif-fin")!, { target: { value: "2026-09-01" } });
    expect(screen.getByText(N.periodeInversee)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: N.genererAccessible })).toBeDisabled();

    fireEvent.change(document.getElementById("nominatif-fin")!, { target: { value: "2026-10-01" } });
    fireEvent.click(screen.getByRole("button", { name: N.genererAccessible }));
    expect(await screen.findByText("Réservé à la Direction")).toBeInTheDocument();
  });
});

describe("ActiviteDesAvocats", () => {
  it("affiche les dépôts de chaque avocat et signale ceux retirés du répertoire", async () => {
    rendreAvecRequetes(<ActiviteDesAvocats />);
    expect(screen.getByText(A.avantGeneration)).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: A.afficherAccessible }));

    expect(await screen.findByRole("button", { name: "Me Mballa" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Compte #12" })).toBeInTheDocument();
    expect(screen.getAllByText(A.horsRepertoire)).toHaveLength(1);
  });

  it("ouvre la fiche d'un avocat par son dossier de répertoire, sinon par son compte", async () => {
    rendreAvecRequetes(<ActiviteDesAvocats />);
    fireEvent.click(screen.getByRole("button", { name: A.afficherAccessible }));

    fireEvent.click(await screen.findByRole("button", { name: "Me Mballa" }));
    fireEvent.click(screen.getByRole("button", { name: MESSAGES.fr.activite.afficher }));
    expect(await screen.findByText(MESSAGES.fr.activite.vide)).toBeInTheDocument();
    expect(service.rapportActivite).toHaveBeenLastCalledWith(expect.any(String), expect.any(String), { avocatId: 4 });

    fireEvent.click(screen.getByRole("button", { name: A.fermerFiche }));
    fireEvent.click(screen.getByRole("button", { name: "Compte #12" }));
    fireEvent.click(screen.getByRole("button", { name: MESSAGES.fr.activite.afficher }));
    await screen.findByText(MESSAGES.fr.activite.vide);
    expect(service.rapportActivite).toHaveBeenLastCalledWith(expect.any(String), expect.any(String), {
      utilisateurId: 12,
    });
  });

  it("annonce une période sans dépôt", async () => {
    service.rapportAvocats.mockResolvedValue(null);
    rendreAvecRequetes(<ActiviteDesAvocats />);
    fireEvent.click(screen.getByRole("button", { name: A.afficherAccessible }));

    expect(await screen.findByText(A.vide)).toBeInTheDocument();
  });

  it("refuse une période inversée et affiche l'erreur du serveur", async () => {
    service.rapportAvocats.mockRejectedValue(new ErreurApi({ code: "X", message: "Indisponible" }));
    rendreAvecRequetes(<ActiviteDesAvocats />);

    fireEvent.change(document.getElementById("avocats-debut")!, { target: { value: "2026-09-30" } });
    fireEvent.change(document.getElementById("avocats-fin")!, { target: { value: "2026-09-01" } });
    expect(screen.getByText(A.periodeInversee)).toBeInTheDocument();

    fireEvent.change(document.getElementById("avocats-fin")!, { target: { value: "2026-10-01" } });
    fireEvent.click(screen.getByRole("button", { name: A.afficherAccessible }));
    expect(await screen.findByText("Indisponible")).toBeInTheDocument();
  });
});
