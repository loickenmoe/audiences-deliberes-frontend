import { fireEvent, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { RepertoireAvocats } from "@/components/modules/repertoire/repertoire-avocats";
import { ErreurApi } from "@/lib/api/errors";
import type { AvocatRepertoire } from "@/types/domaine";
import { MESSAGES, rendre } from "../utils/rendu";

/**
 * Screen 34 - lawyer directory: load and won deliberations as counts; the activity sheet is open
 * to the DJ and DJA only.
 */
const etat = vi.hoisted(() => ({ requete: { data: undefined as unknown, isLoading: false, error: null as unknown } }));
const noms = vi.hoisted(() => vi.fn());
const navigation = vi.hoisted(() => ({ replace: vi.fn(), parametres: new URLSearchParams() }));

vi.mock("@/hooks/useConstitutions", () => ({
  useRepertoire: (nom: string) => {
    noms(nom);
    return etat.requete;
  },
}));
vi.mock("@/components/modules/reporting/fiche-activite", () => ({
  FicheActivite: ({ nomAffiche, cible }: { nomAffiche: string; cible: { avocatId: number } }) => (
    <p>{`Activité de ${nomAffiche} (${cible.avocatId})`}</p>
  ),
}));
vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace: navigation.replace, push: vi.fn() }),
  usePathname: () => "/repertoire",
  useSearchParams: () => navigation.parametres,
}));

const R = MESSAGES.fr.repertoire;
const DJ = ["ROLE_DJ", "ROLE_JURISTE", "ROLE_CONSULTATION"];
const JURISTE = ["ROLE_JURISTE", "ROLE_CONSULTATION"];

const AVOCATS: AvocatRepertoire[] = [
  { id: 11, nom: "Me Mballa", email: "mballa@cabinet.cm", telephone: null, indicateurCharge: 0, deliberesFavorables: 0, deliberesTotal: 0, indicateurPerformance: 0 },
  { id: 12, nom: "Me Eto", email: null, telephone: "690000000", indicateurCharge: 3, deliberesFavorables: 3, deliberesTotal: 4, indicateurPerformance: 75 },
];

beforeEach(() => {
  vi.clearAllMocks();
  navigation.parametres = new URLSearchParams();
  etat.requete = { data: { content: AVOCATS, totalPages: 1, totalElements: 2 }, isLoading: false, error: null };
});

describe("RepertoireAvocats", () => {
  it("donne la charge et les délibérés gagnés en nombres, sans zéro trompeur", () => {
    rendre(<RepertoireAvocats roles={JURISTE} />);

    expect(screen.getByRole("link", { name: "mballa@cabinet.cm" })).toHaveAttribute("href", "mailto:mballa@cabinet.cm");
    expect(screen.getByText("Aucun dossier actif")).toBeInTheDocument();
    expect(screen.getByText(R.aucunDelibere)).toBeInTheDocument();
    expect(screen.getByText("3 gagnés sur 4 délibérés")).toBeInTheDocument();
    expect(screen.getAllByText("—")).toHaveLength(2);
    expect(screen.queryByRole("button", { name: R.voirActivite })).not.toBeInTheDocument();
  });

  it("ouvre puis ferme l'activité d'un avocat pour le DJ", () => {
    rendre(<RepertoireAvocats roles={DJ} />);
    fireEvent.click(screen.getAllByRole("button", { name: R.voirActivite })[1]!);

    expect(screen.getByText("Activité de Me Eto (12)")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: R.fermerActivite }));
    expect(screen.queryByText("Activité de Me Eto (12)")).not.toBeInTheDocument();
  });

  it("filtre par nom dans l'URL et le dit quand rien ne correspond", async () => {
    navigation.parametres = new URLSearchParams("nom=Zz");
    etat.requete = { data: { content: [], totalPages: 0, totalElements: 0 }, isLoading: false, error: null };
    rendre(<RepertoireAvocats roles={JURISTE} />);

    expect(noms).toHaveBeenLastCalledWith("Zz");
    expect(screen.getByText(R.videRecherche)).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText(R.rechercheNom), { target: { value: " Eto " } });
    await waitFor(() => expect(navigation.replace.mock.calls.at(-1)?.[0]).toContain("nom=Eto"));
  });

  it("dit que le répertoire est vide, et affiche le chargement puis l'erreur", () => {
    etat.requete = { data: { content: [], totalPages: 0, totalElements: 0 }, isLoading: false, error: null };
    const { rerender } = rendre(<RepertoireAvocats roles={JURISTE} />);
    expect(screen.getByText(R.vide)).toBeInTheDocument();

    etat.requete = { data: undefined, isLoading: true, error: null };
    rerender(<RepertoireAvocats roles={JURISTE} />);
    expect(screen.getByRole("status")).toBeInTheDocument();

    etat.requete = { data: undefined, isLoading: false, error: new ErreurApi({ code: "X", message: "Répertoire indisponible" }) };
    rerender(<RepertoireAvocats roles={JURISTE} />);
    expect(screen.getByText("Répertoire indisponible")).toBeInTheDocument();
  });
});
