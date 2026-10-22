import { fireEvent, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { FileFrais } from "@/components/modules/frais/file-frais";
import { FilePublications } from "@/components/modules/publications/file-publications";
import { ErreurApi } from "@/lib/api/errors";
import type { DemandeFrais, Publication } from "@/types/domaine";
import { MESSAGES, rendre } from "../utils/rendu";

/**
 * The expense and publication queues open on what awaits the current profile; the view lives in
 * the URL. Lawyers see case references without a link, since they have no case file screen.
 */
const useDemandesFrais = vi.hoisted(() => vi.fn());
const usePublications = vi.hoisted(() => vi.fn());
const navigation = vi.hoisted(() => ({ replace: vi.fn(), parametres: new URLSearchParams() }));

vi.mock("@/hooks/useFrais", () => ({ useDemandesFrais: (...args: unknown[]) => useDemandesFrais(...args) }));
vi.mock("@/hooks/usePublications", () => ({ usePublications: (...args: unknown[]) => usePublications(...args) }));
vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace: navigation.replace, push: vi.fn() }),
  usePathname: () => "/frais",
  useSearchParams: () => navigation.parametres,
}));

const F = MESSAGES.fr.frais;
const P = MESSAGES.fr.publications;
const ASSISTANTE = ["ROLE_ASSISTANTE", "ROLE_CONSULTATION"];
const DJA = ["ROLE_DJA", "ROLE_JURISTE", "ROLE_CONSULTATION"];
const AVOCAT = ["ROLE_AVOCAT"];

function page<T>(contenu: T[], error: unknown = null) {
  return { data: error ? undefined : { content: contenu, totalPages: 1, totalElements: contenu.length }, isLoading: false, error, refetch: vi.fn() };
}

function demande(partiel: Partial<DemandeFrais>): DemandeFrais {
  return {
    id: 5,
    referenceFacture: "F-2026-1",
    dossierId: 3,
    referenceDossier: "DOS-2026-0003",
    avocatNom: "Me Mballa",
    montant: 150000,
    createdAt: "2026-10-01T10:00:00",
    statutCircuit: "DEPOSEE",
    validationConjointeRequise: false,
    validations: [],
    ...partiel,
  } as DemandeFrais;
}

function publication(partiel: Partial<Publication>): Publication {
  return {
    id: 7,
    type: "CR_AUDIENCE",
    audienceDate: "2026-09-20",
    dossierId: 3,
    referenceDossier: "DOS-2026-0003",
    avocatNom: "Me Mballa",
    dateDepot: "2026-10-01T10:00:00",
    statutValidation: "DEPOSE",
    restrictionAccesNom: null,
    ...partiel,
  } as Publication;
}

beforeEach(() => {
  vi.clearAllMocks();
  navigation.parametres = new URLSearchParams();
  useDemandesFrais.mockReturnValue(page([]));
  usePublications.mockReturnValue(page([]));
});

describe("FileFrais", () => {
  it("ouvre l'Assistante sur le contrôle de conformité", () => {
    rendre(<FileFrais roles={ASSISTANTE} />);

    expect(useDemandesFrais).toHaveBeenLastCalledWith("DEPOSEE", 0, 10);
    expect(screen.getByText(F.videControle)).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: F.vues.aPayer }));
    expect(navigation.replace).toHaveBeenCalledWith(expect.stringContaining("vue=aPayer"), expect.anything());
  });

  it("montre l'étape conjointe et l'accord déjà donné par la DJA", () => {
    navigation.parametres = new URLSearchParams("vue=toutes");
    useDemandesFrais.mockReturnValue(
      page([
        demande({ statutCircuit: "CONFORMITE", validationConjointeRequise: true }),
        demande({ id: 6, referenceFacture: "F-2026-2", statutCircuit: "OPPORTUNITE", validations: [{ etape: "CONJOINTE_DJA" }] } as Partial<DemandeFrais>),
      ]),
    );
    rendre(<FileFrais roles={DJA} />);

    expect(useDemandesFrais).toHaveBeenLastCalledWith(null, 0, 10);
    expect(screen.getByRole("link", { name: "F-2026-1" })).toHaveAttribute("href", "/frais/5");
    expect(screen.getAllByRole("link", { name: "DOS-2026-0003" })[0]).toHaveAttribute("href", "/dossiers/3");
    expect(screen.getByText(F.conjointeRequise)).toBeInTheDocument();
    expect(screen.getByText(F.votreAccordDonne)).toBeInTheDocument();
  });

  it("garde la référence du dossier en texte pour un avocat, sans choix de vue", () => {
    useDemandesFrais.mockReturnValue(page([demande({})]));
    rendre(<FileFrais roles={AVOCAT} />);

    expect(screen.getByText("DOS-2026-0003")).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "DOS-2026-0003" })).not.toBeInTheDocument();
    expect(screen.queryByRole("group", { name: F.vue })).not.toBeInTheDocument();
  });

  it("explique qu'un compte d'avocat n'est pas rattaché au répertoire", () => {
    useDemandesFrais.mockReturnValue(page([], new ErreurApi({ code: "ERR-AVOCAT-NON-RATTACHE", message: "x", statut: 403 })));
    rendre(<FileFrais roles={AVOCAT} />);

    expect(screen.getByText(MESSAGES.fr.portail.compteNonRattacheTitre)).toBeInTheDocument();
  });
});

describe("FilePublications", () => {
  it("ouvre l'Assistante sur ce qui attend sa validation", () => {
    rendre(<FilePublications roles={ASSISTANTE} />);

    expect(usePublications).toHaveBeenLastCalledWith({ statut: "DEPOSE", page: 0, size: 10 });
    expect(screen.getByText(P.videAValider)).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: P.vues.rejetees }));
    expect(navigation.replace).toHaveBeenCalledWith(expect.stringContaining("vue=rejetees"), expect.anything());
  });

  it("liste les publications, leur dossier et leur restriction d'accès", () => {
    usePublications.mockReturnValue(page([publication({}), publication({ id: 8, restrictionAccesNom: "Awa Ndiaye" })]));
    rendre(<FilePublications roles={["ROLE_JURISTE", "ROLE_CONSULTATION"]} />);

    expect(usePublications).toHaveBeenLastCalledWith({ statut: null, page: 0, size: 10 });
    expect(screen.getAllByRole("link", { name: "Compte rendu d’audience du 20 septembre 2026" })[0]).toHaveAttribute("href", "/publications/7");
    expect(screen.getByText("Réservée à Awa Ndiaye")).toBeInTheDocument();
    expect(screen.queryByRole("group", { name: P.vue })).not.toBeInTheDocument();
  });
});
