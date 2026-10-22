import { fireEvent, screen, waitFor, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { ListeDossiers } from "@/components/modules/dossiers/liste-dossiers";
import type { Dossier } from "@/types/domaine";
import { MESSAGES, rendre } from "../utils/rendu";

/**
 * Screen 05 - case search. Filters live in the URL and run server-side; the most advanced step and
 * a concurrent CCJA appeal are both shown.
 */
const useDossiers = vi.hoisted(() => vi.fn());
vi.mock("@/hooks/useDossiers", () => ({ useDossiers: (filtres: unknown) => useDossiers(filtres) }));
vi.mock("@/hooks/useReferentiels", () => ({
  useNaturesDossier: () => ({ data: [{ id: 1, libelle: "Recouvrement de créance" }] }),
}));

const navigation = vi.hoisted(() => ({ replace: vi.fn(), parametres: new URLSearchParams() }));
vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace: navigation.replace, push: vi.fn() }),
  usePathname: () => "/dossiers",
  useSearchParams: () => navigation.parametres,
}));

const D = MESSAGES.fr.dossiers;

function dossier(partiel: Partial<Dossier>): Dossier {
  return {
    id: 1,
    reference: "DOS-2026-0001",
    clientId: 8,
    clientNom: "Société Test",
    nature: "Recouvrement de créance",
    juridictionSaisie: "TGI Douala",
    risqueEncouru: 5000000,
    etapes: [],
    ...partiel,
  } as Dossier;
}

const refetch = vi.fn();

function resultat(dossiers: Dossier[]) {
  useDossiers.mockReturnValue({
    data: { content: dossiers, totalPages: 1, totalElements: dossiers.length },
    isLoading: false,
    error: null,
    refetch,
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  navigation.parametres = new URLSearchParams();
  resultat([]);
});

describe("ListeDossiers", () => {
  it("affiche chaque dossier avec son lien, son client et ses étapes", () => {
    resultat([
      dossier({
        etapes: [
          { id: 1, type: "INSTANCE", statutCycleVie: "CLOTURE" },
          { id: 2, type: "RECOURS_1", statutCycleVie: "EN_COURS" },
          { id: 3, type: "RECOURS_2_CCJA", statutCycleVie: "OUVERTURE" },
        ] as Dossier["etapes"],
      }),
      dossier({ id: 2, reference: "DOS-2026-0002", clientNom: null, clientId: 9 } as Partial<Dossier>),
    ]);
    rendre(<ListeDossiers roles={["ROLE_SAISIE", "ROLE_CONSULTATION"]} />);

    expect(screen.getByRole("link", { name: "DOS-2026-0001" })).toHaveAttribute("href", "/dossiers/1");
    expect(screen.getByText("#9")).toBeInTheDocument();
    const ligne = screen.getByRole("link", { name: "DOS-2026-0001" }).closest("tr")!;
    // The most advanced step and the concurrent CCJA appeal; the closed first instance is not repeated.
    expect(within(ligne).getByText(MESSAGES.fr.domaine.TypeEtape.RECOURS_1, { exact: false })).toBeInTheDocument();
    expect(within(ligne).getByText(MESSAGES.fr.domaine.TypeEtape.RECOURS_2_CCJA, { exact: false })).toBeInTheDocument();
    expect(within(ligne).queryByText(MESSAGES.fr.domaine.TypeEtape.INSTANCE, { exact: false })).not.toBeInTheDocument();
    // Announced to screen readers once loaded (the pagination shows it too).
    expect(screen.getAllByText("2 éléments").length).toBeGreaterThan(0);
    expect(screen.getByRole("link", { name: D.nouveauDossier })).toHaveAttribute("href", "/dossiers/nouveau");
  });

  it("masque la création à qui ne peut pas créer, et annonce l'absence de résultat", () => {
    rendre(<ListeDossiers roles={["ROLE_CONSULTATION"]} />);

    expect(screen.queryByRole("link", { name: D.nouveauDossier })).not.toBeInTheDocument();
    expect(screen.getByText(D.aucunDossier)).toBeInTheDocument();
  });

  it("transmet au serveur les filtres lus dans l'URL", () => {
    navigation.parametres = new URLSearchParams(
      "reference=DOS&categorie=RECOUVREMENT&nature=Recouvrement%20de%20cr%C3%A9ance&mesDossiers=1&estSensible=1" +
        "&sensibiliteStatut=EN_ATTENTE&typeEtape=RECOURS_1&statutEtape=EN_COURS&dateDebut=2026-01-01&dateFin=2026-12-31&tri=REFERENCE",
    );
    rendre(<ListeDossiers roles={["ROLE_CONSULTATION"]} />);

    expect(useDossiers).toHaveBeenLastCalledWith(
      expect.objectContaining({
        reference: "DOS",
        categorie: "RECOUVREMENT",
        nature: "Recouvrement de créance",
        mesDossiers: true,
        estSensible: true,
        sensibiliteStatut: "EN_ATTENTE",
        typeEtape: "RECOURS_1",
        statutEtape: "EN_COURS",
        dateDebut: "2026-01-01",
        dateFin: "2026-12-31",
        tri: "REFERENCE",
      }),
    );
  });

  it("n'envoie aucun filtre vide", () => {
    rendre(<ListeDossiers roles={["ROLE_CONSULTATION"]} />);

    expect(useDossiers).toHaveBeenLastCalledWith(
      expect.objectContaining({ reference: undefined, categorie: undefined, mesDossiers: false, estSensible: undefined }),
    );
  });

  it("écrit les filtres choisis dans l'URL", async () => {
    rendre(<ListeDossiers roles={["ROLE_CONSULTATION"]} />);

    fireEvent.change(screen.getByLabelText(D.filtreCategorie), { target: { value: "RECOUVREMENT" } });
    fireEvent.change(screen.getByLabelText(D.filtreNature), { target: { value: "Recouvrement de créance" } });
    fireEvent.change(screen.getByLabelText(D.filtreTypeEtape), { target: { value: "INSTANCE" } });
    fireEvent.change(screen.getByLabelText(D.filtreStatutEtape), { target: { value: "EN_COURS" } });
    fireEvent.change(screen.getByLabelText(D.filtreAudienceDebut), { target: { value: "2026-01-01" } });
    fireEvent.change(screen.getByLabelText(D.filtreTri), { target: { value: "REFERENCE" } });
    fireEvent.change(screen.getByLabelText(D.filtreSensibiliteStatut), { target: { value: "VALIDE" } });
    fireEvent.click(screen.getByLabelText(D.filtreSensiblesSeuls));
    fireEvent.click(screen.getByLabelText(D.mesDossiers));
    fireEvent.change(screen.getByLabelText(D.rechercheReference), { target: { value: "DOS-1" } });

    await waitFor(() => expect(navigation.replace.mock.calls.at(-1)?.[0]).toContain("reference=DOS-1"));
    const url = navigation.replace.mock.calls.at(-1)?.[0] as string;
    for (const attendu of ["typeEtape=INSTANCE", "statutEtape=EN_COURS", "tri=REFERENCE", "mesDossiers=1", "estSensible=1"]) {
      expect(url).toContain(attendu);
    }
  });

  it("propose de réessayer après un échec", () => {
    useDossiers.mockReturnValue({ data: undefined, isLoading: false, error: new Error("réseau"), refetch });
    rendre(<ListeDossiers roles={["ROLE_CONSULTATION"]} />);

    fireEvent.click(screen.getByRole("button", { name: MESSAGES.fr.commun.reessayer }));
    expect(refetch).toHaveBeenCalled();
  });
});
