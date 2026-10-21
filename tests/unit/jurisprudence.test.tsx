import { fireEvent, screen, waitFor, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { BaseJurisprudentielle } from "@/components/modules/jurisprudence/base-jurisprudentielle";
import { ListeJurisprudences } from "@/components/modules/jurisprudence/liste-jurisprudences";
import { ModaleArchivage } from "@/components/modules/jurisprudence/modale-archivage";
import { ErreurApi } from "@/lib/api/errors";
import type { Jurisprudence } from "@/types/domaine";
import { MESSAGES, rendre } from "../utils/rendu";

/**
 * Screen 38 - case law: search with filters in the URL, decisions opened through a fresh download
 * address, and archiving a decision with its indexing.
 */
const etat = vi.hoisted(() => ({ requete: { data: undefined as unknown, isLoading: false, error: null as unknown, refetch: vi.fn() } }));
const filtresRecus = vi.hoisted(() => vi.fn());
const archiver = vi.hoisted(() => vi.fn());
const recupererContenu = vi.hoisted(() => vi.fn());
const navigation = vi.hoisted(() => ({ replace: vi.fn(), parametres: new URLSearchParams() }));

vi.mock("@/hooks/useDecisions", () => ({
  useJurisprudences: (filtres: unknown) => {
    filtresRecus(filtres);
    return etat.requete;
  },
  useArchiverJurisprudence: () => ({ mutateAsync: archiver, isPending: false }),
}));
vi.mock("@/services/gedService", () => ({ gedService: { recupererContenu } }));
vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace: navigation.replace, push: vi.fn() }),
  usePathname: () => "/jurisprudence",
  useSearchParams: () => navigation.parametres,
}));
vi.mock("@/components/metier/apercu-fichier", () => ({
  ApercuFichier: ({ ouvert, nomFichier, obtenir, onFermeture }: { ouvert: boolean; nomFichier: string; obtenir: () => Promise<Blob>; onFermeture: () => void }) =>
    ouvert ? (
      <>
        <button type="button" onClick={() => void obtenir().catch(() => undefined)}>{`Aperçu ${nomFichier}`}</button>
        <button type="button" onClick={onFermeture}>Fermer l'aperçu</button>
      </>
    ) : null,
}));

const toast = vi.hoisted(() => ({ success: vi.fn() }));
vi.mock("sonner", () => ({ toast }));

const J = MESSAGES.fr.jurisprudence;
const OBLIGATOIRE = MESSAGES.fr.metier.champObligatoire;

function decision(partiel: Partial<Jurisprudence>): Jurisprudence {
  return {
    id: 1,
    dossierId: 3,
    typeArchive: "GROSSE",
    motsCles: ["hypothèque", "saisie"],
    natureDecision: "Jugement",
    juridiction: "TGI Douala",
    dateDecision: "2026-05-04",
    urlTelechargement: "https://minio/old",
    createdAt: "2026-06-01T10:00:00",
    ...partiel,
  };
}

function page(decisions: Jurisprudence[], totalPages = 1) {
  etat.requete = { data: { content: decisions, totalPages, totalElements: decisions.length }, isLoading: false, error: null, refetch: vi.fn() };
}

beforeEach(() => {
  vi.clearAllMocks();
  navigation.parametres = new URLSearchParams();
  page([]);
  archiver.mockResolvedValue({});
  recupererContenu.mockResolvedValue(new Blob(["pdf"]));
});

describe("BaseJurisprudentielle", () => {
  it("cherche avec les filtres de l'URL et dit quand rien ne correspond", () => {
    navigation.parametres = new URLSearchParams("motCle=saisie");
    rendre(<BaseJurisprudentielle roles={["ROLE_CONSULTATION"]} />);

    expect(filtresRecus).toHaveBeenLastCalledWith({ motCle: "saisie", natureDecision: "", juridiction: "", page: 0 });
    expect(screen.getByText(J.videRecherche)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: J.archiver })).not.toBeInTheDocument();
  });

  it("dit que la base est vide, et écrit une recherche dans l'URL", async () => {
    rendre(<BaseJurisprudentielle roles={["ROLE_CONSULTATION"]} />);
    expect(screen.getByText(J.vide)).toBeInTheDocument();

    fireEvent.change(document.getElementById("filtre-juridiction")!, { target: { value: " Douala " } });
    await waitFor(() => expect(navigation.replace.mock.calls.at(-1)?.[0]).toContain("juridiction=Douala"));
  });

  it("liste les décisions et pagine", () => {
    page([decision({}), decision({ id: 2, dossierId: null })], 2);
    rendre(<BaseJurisprudentielle roles={["ROLE_JURISTE", "ROLE_CONSULTATION"]} />);

    expect(screen.getByRole("link", { name: J.voirDossier })).toHaveAttribute("href", "/dossiers/3");
    expect(screen.getByText("—")).toBeInTheDocument();
    expect(screen.getAllByText("hypothèque")).toHaveLength(2);
    fireEvent.click(screen.getByRole("button", { name: MESSAGES.fr.metier.suivant }));
    expect(navigation.replace).toHaveBeenCalled();
  });

  it("affiche le chargement puis l'erreur", () => {
    etat.requete = { data: undefined, isLoading: true, error: null, refetch: vi.fn() };
    const { rerender } = rendre(<BaseJurisprudentielle roles={["ROLE_CONSULTATION"]} />);
    expect(screen.getByRole("status")).toBeInTheDocument();

    etat.requete = { data: undefined, isLoading: false, error: new ErreurApi({ code: "X", message: "Base indisponible" }), refetch: vi.fn() };
    rerender(<BaseJurisprudentielle roles={["ROLE_CONSULTATION"]} />);
    expect(screen.getByText("Base indisponible")).toBeInTheDocument();
  });

  it("ouvre l'archivage à qui gère les décisions", () => {
    rendre(<BaseJurisprudentielle roles={["ROLE_JURISTE", "ROLE_CONSULTATION"]} />);
    fireEvent.click(screen.getByRole("button", { name: J.archiver }));
    expect(screen.getByRole("dialog", { name: J.archiverTitre, hidden: true })).toHaveAttribute("open");
  });
});

describe("ListeJurisprudences", () => {
  it("ouvre une décision par une adresse fraîche, pas celle affichée", async () => {
    const rafraichir = vi.fn().mockResolvedValue([decision({ urlTelechargement: "https://minio/fresh" })]);
    rendre(<ListeJurisprudences jurisprudences={[decision({})]} avecDossier={false} rafraichir={rafraichir} />);
    fireEvent.click(screen.getByRole("button", { name: "Consulter - Jugement, TGI Douala" }));
    fireEvent.click(screen.getByRole("button", { name: "Aperçu Jugement-2026-05-04.pdf" }));

    await waitFor(() => expect(recupererContenu).toHaveBeenCalledWith("https://minio/fresh"));
    expect(screen.queryByText(J.colonneDossier)).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Fermer l'aperçu" }));
  });

  it("refuse une décision sans adresse", async () => {
    const rafraichir = vi.fn().mockResolvedValue([]);
    rendre(<ListeJurisprudences jurisprudences={[decision({})]} avecDossier rafraichir={rafraichir} />);
    fireEvent.click(screen.getByRole("button", { name: "Consulter - Jugement, TGI Douala" }));
    fireEvent.click(screen.getByRole("button", { name: "Aperçu Jugement-2026-05-04.pdf" }));

    await waitFor(() => expect(rafraichir).toHaveBeenCalled());
    expect(recupererContenu).not.toHaveBeenCalled();
  });
});

describe("ModaleArchivage", () => {
  function remplir(fenetre: HTMLElement) {
    fireEvent.change(within(fenetre).getByLabelText(J.champTypeArchive, { exact: false }), { target: { value: "GROSSE" } });
    fireEvent.change(document.getElementById("mots-cles")!, { target: { value: "saisie, hypothèque" } });
    fireEvent.change(document.getElementById("nature-decision")!, { target: { value: " Jugement " } });
    fireEvent.change(document.getElementById("juridiction-decision")!, { target: { value: " TGI Douala " } });
    fireEvent.change(document.getElementById("date-decision-jurisprudence")!, { target: { value: "2026-05-04" } });
  }

  it("exige le fichier et l'indexation, puis archive la décision du dossier", async () => {
    const fermer = vi.fn();
    rendre(<ModaleArchivage dossierId={3} ouvert onFermeture={fermer} />);
    const fenetre = screen.getByRole("dialog", { name: J.archiverTitre, hidden: true });
    fireEvent.click(within(fenetre).getByRole("button", { name: J.archiver, hidden: true }));
    expect(await within(fenetre).findByText(J.fichierObligatoire)).toBeInTheDocument();
    expect(within(fenetre).getAllByText(OBLIGATOIRE)).toHaveLength(5);

    remplir(fenetre);
    fireEvent.change(within(fenetre).getByLabelText(MESSAGES.fr.metier.choisirFichier), {
      target: { files: [new File(["x"], "jugement.pdf", { type: "application/pdf" })] },
    });
    fireEvent.click(within(fenetre).getByRole("button", { name: `${MESSAGES.fr.documents.consulter} - jugement.pdf`, hidden: true }));
    fireEvent.click(screen.getByRole("button", { name: "Fermer l'aperçu" }));
    fireEvent.click(within(fenetre).getByRole("button", { name: J.archiver, hidden: true }));

    await waitFor(() =>
      expect(archiver).toHaveBeenCalledWith({
        indexation: {
          dossierId: 3,
          typeArchive: "GROSSE",
          motsCles: ["saisie", "hypothèque"],
          natureDecision: "Jugement",
          juridiction: "TGI Douala",
          dateDecision: "2026-05-04",
        },
        fichier: expect.any(File),
      }),
    );
    expect(toast.success).toHaveBeenCalledWith(J.archivee);
    expect(fermer).toHaveBeenCalled();
  });

  it("affiche le refus d'archiver", async () => {
    archiver.mockRejectedValue(new ErreurApi({ code: "X", message: "PDF trop lourd" }));
    rendre(<ModaleArchivage ouvert onFermeture={vi.fn()} />);
    const fenetre = screen.getByRole("dialog", { name: J.archiverTitre, hidden: true });
    remplir(fenetre);
    fireEvent.change(within(fenetre).getByLabelText(MESSAGES.fr.metier.choisirFichier), {
      target: { files: [new File(["x"], "jugement.pdf", { type: "application/pdf" })] },
    });
    fireEvent.click(within(fenetre).getByRole("button", { name: J.archiver, hidden: true }));

    expect(await within(fenetre).findByText("PDF trop lourd")).toBeInTheDocument();
  });
});
