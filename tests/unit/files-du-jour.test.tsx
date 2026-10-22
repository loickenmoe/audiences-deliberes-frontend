import { screen, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { FilesDuJour } from "@/components/modules/accueil/files-du-jour";
import { MESSAGES, rendre } from "../utils/rendu";

/**
 * Home screen queues: one card per capability, each with its own count; the expense card shows the
 * step the profile is responsible for.
 */
const appels = vi.hoisted(() => ({ frais: vi.fn() }));
const compte = (totalElements: number, isLoading = false) => ({ data: { totalElements }, isLoading });

vi.mock("@/hooks/useFrais", () => ({
  useDemandesFrais: (statut: string) => {
    appels.frais(statut);
    return compte(2);
  },
}));
vi.mock("@/hooks/usePublications", () => ({ usePublications: () => compte(0) }));
vi.mock("@/hooks/useConstitutions", () => ({ useConstitutions: () => compte(1) }));
vi.mock("@/hooks/useGed", () => ({ useDemandesSuppression: () => compte(3) }));
vi.mock("@/hooks/useDossiers", () => ({ useDossiers: () => ({ data: undefined, isLoading: true }) }));
vi.mock("@/hooks/useAlertes", () => ({ useNombreNotificationsATraiter: () => ({ data: 5, isLoading: false }) }));

const A = MESSAGES.fr.accueil;

function carte(titre: string) {
  return screen.getByText(titre).closest("a")!;
}

beforeEach(() => vi.clearAllMocks());

describe("FilesDuJour", () => {
  it.each<[string[], string, string]>([
    [["ROLE_ASSISTANTE", "ROLE_CONSULTATION"], "DEPOSEE", A.fraisTitre.DEPOSEE],
    [["ROLE_DJA", "ROLE_JURISTE", "ROLE_CONSULTATION"], "CONFORMITE", A.fraisTitre.CONFORMITE],
    [["ROLE_DJ", "ROLE_JURISTE", "ROLE_CONSULTATION"], "OPPORTUNITE", A.fraisTitre.OPPORTUNITE],
  ])("montre au profil %j l'étape de frais qui lui revient", (roles, statut, titre) => {
    rendre(<FilesDuJour roles={roles} />);

    expect(appels.frais).toHaveBeenCalledWith(statut);
    expect(within(carte(titre)).getByText("2")).toBeInTheDocument();
    expect(carte(titre)).toHaveAttribute("href", "/frais");
  });

  it("donne à chaque file son compte et son lien, et attend celui qui charge", () => {
    rendre(<FilesDuJour roles={["ROLE_ASSISTANTE", "ROLE_CONSULTATION"]} />);

    expect(within(carte(A.publicationsTitre)).getByText("0")).toBeInTheDocument();
    expect(carte(A.dossiersTitre)).toHaveAttribute("href", "/dossiers?mesDossiers=true");
    expect(within(carte(A.notificationsTitre)).getByText("5")).toBeInTheDocument();
    expect(screen.getByText(A.filesDescription)).toBeInTheDocument();
  });

  it("ouvre au SH sa file de signatures, et au DJ celle des suppressions", () => {
    const { unmount } = rendre(<FilesDuJour roles={["ROLE_SH", "ROLE_CONSULTATION"]} />);
    expect(carte(A.constitutionsTitre)).toHaveAttribute("href", "/constitutions");
    unmount();

    rendre(<FilesDuJour roles={["ROLE_DJ", "ROLE_JURISTE", "ROLE_CONSULTATION"]} />);
    expect(carte(A.suppressionsTitre)).toHaveAttribute("href", "/ged/demandes-suppression");
  });

  it("ne montre que les notifications à un compte sans profil", () => {
    rendre(<FilesDuJour roles={[]} />);

    expect(screen.getByText(A.filesDescriptionSansProfil)).toBeInTheDocument();
    expect(screen.getAllByRole("link")).toHaveLength(1);
  });
});
