import { fireEvent, screen, waitFor, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { FileConstitutions } from "@/components/modules/constitutions/file-constitutions";
import { ErreurApi } from "@/lib/api/errors";
import type { DemandeConstitution } from "@/types/domaine";
import { MESSAGES, rendre } from "../utils/rendu";

/**
 * Screen 35 - representation requests: the SH signs (the letter lands in the case DMS) or rejects
 * with a reason; whoever requested drafts the letter; everyone else reads it.
 */
const etat = vi.hoisted(() => ({ requete: { data: undefined as unknown, isLoading: false, error: null as unknown } }));
const lister = vi.hoisted(() => vi.fn());
const decider = vi.hoisted(() => vi.fn());
const ged = vi.hoisted(() => ({ consulter: vi.fn(), recupererContenu: vi.fn() }));
const navigation = vi.hoisted(() => ({ push: vi.fn(), replace: vi.fn(), parametres: new URLSearchParams() }));

vi.mock("@/hooks/useConstitutions", () => ({
  useConstitutions: (statut: unknown, page: number) => {
    lister(statut, page);
    return etat.requete;
  },
  useDeciderConstitution: () => ({ mutateAsync: decider, isPending: false }),
}));
vi.mock("@/services/gedService", () => ({ gedService: ged }));
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: navigation.push, replace: navigation.replace }),
  usePathname: () => "/constitutions",
  useSearchParams: () => navigation.parametres,
}));
vi.mock("@/components/modules/constitutions/modale-lettre", () => ({
  ModaleLettre: ({ demandeId }: { demandeId: number | null }) => (demandeId === null ? null : <p>{`Lettre de la demande ${demandeId}`}</p>),
}));
vi.mock("@/components/metier/apercu-fichier", () => ({
  ApercuFichier: ({ ouvert, nomFichier, obtenir }: { ouvert: boolean; nomFichier: string; obtenir: () => Promise<Blob> }) =>
    ouvert ? (
      <button type="button" onClick={() => void obtenir().catch(() => undefined)}>
        {`Aperçu ${nomFichier}`}
      </button>
    ) : null,
}));

const toast = vi.hoisted(() => ({ success: vi.fn(), error: vi.fn() }));
vi.mock("sonner", () => ({ toast }));

const T = MESSAGES.fr.constitutions;
const C = MESSAGES.fr.commun;
const SH = ["ROLE_SH", "ROLE_CONSULTATION"];
const JURISTE = ["ROLE_JURISTE", "ROLE_CONSULTATION"];

function demande(partiel: Partial<DemandeConstitution>): DemandeConstitution {
  return {
    id: 8,
    dossierId: 3,
    referenceDossier: "DOS-2026-0003",
    prestataireNom: "Me Eto",
    prestataireType: "AVOCAT",
    demandeurNom: "Awa Ndiaye",
    dateDemande: "2026-10-01T10:00:00",
    motif: "Expertise",
    statut: "EN_ATTENTE",
    dateDecision: null,
    valideParNom: null,
    motifRejet: null,
    lettreDocumentId: null,
    redactionPossible: false,
    ...partiel,
  } as DemandeConstitution;
}

function liste(demandes: DemandeConstitution[], totalPages = 1) {
  etat.requete = { data: { content: demandes, totalPages, totalElements: demandes.length }, isLoading: false, error: null };
}

beforeEach(() => {
  vi.clearAllMocks();
  navigation.parametres = new URLSearchParams();
  liste([]);
  decider.mockResolvedValue({});
  ged.consulter.mockResolvedValue({ urlTelechargement: "https://minio/l" });
  ged.recupererContenu.mockResolvedValue(new Blob(["pdf"]));
});

describe("FileConstitutions - vues", () => {
  it("ouvre le SH sur les demandes à signer", () => {
    rendre(<FileConstitutions roles={SH} />);

    expect(screen.getByRole("button", { name: T.vues.aSigner })).toHaveAttribute("aria-pressed", "true");
    expect(lister).toHaveBeenCalledWith("EN_ATTENTE", 0);
    expect(screen.getByText(T.videASigner)).toBeInTheDocument();
  });

  it("ouvre le juriste sur toutes les demandes et change de vue par l'URL", async () => {
    rendre(<FileConstitutions roles={JURISTE} />);

    expect(lister).toHaveBeenCalledWith(null, 0);
    expect(screen.getByText(T.vide)).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: T.vues.aSigner }));
    await waitFor(() => expect(navigation.replace).toHaveBeenCalledWith(expect.stringContaining("vue=aSigner"), expect.anything()));
  });

  it("affiche le chargement puis l'erreur", () => {
    etat.requete = { data: undefined, isLoading: true, error: null };
    const { rerender } = rendre(<FileConstitutions roles={JURISTE} />);
    expect(screen.getByRole("status")).toBeInTheDocument();

    etat.requete = { data: undefined, isLoading: false, error: new ErreurApi({ code: "X", message: "File indisponible" }) };
    rerender(<FileConstitutions roles={JURISTE} />);
    expect(screen.getByText("File indisponible")).toBeInTheDocument();
  });
});

describe("FileConstitutions - lignes", () => {
  it("décrit une demande tranchée, son motif de rejet et sa lettre", () => {
    liste(
      [
        demande({ id: 1, statut: "REJETEE", dateDecision: "2026-10-02T10:00:00", valideParNom: "Chef", motifRejet: "Coût", demandeurNom: null }),
        demande({ id: 2, statut: "VALIDEE", dateDecision: "2026-10-03T10:00:00", lettreDocumentId: 40 }),
      ],
      3,
    );
    rendre(<FileConstitutions roles={JURISTE} />);

    expect(screen.getByText("Motif : Coût")).toBeInTheDocument();
    expect(screen.getByText("Chef ·", { exact: false })).toBeInTheDocument();
    expect(screen.getByText("—")).toBeInTheDocument();
    // No signing action outside the pending state.
    expect(screen.queryByRole("button", { name: /^Signer/ })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: MESSAGES.fr.metier.suivant }));
    expect(navigation.replace).toHaveBeenCalled();
  });

  it("montre la lettre signée depuis la GED", async () => {
    liste([demande({ id: 2, statut: "VALIDEE", lettreDocumentId: 40 })]);
    rendre(<FileConstitutions roles={JURISTE} />);
    fireEvent.click(screen.getByRole("button", { name: "Lettre de constitution - DOS-2026-0003" }));
    fireEvent.click(screen.getByRole("button", { name: "Aperçu lettre-constitution-2.pdf" }));

    await waitFor(() => expect(ged.recupererContenu).toHaveBeenCalledWith("https://minio/l"));
    expect(ged.consulter).toHaveBeenCalledWith(40);
  });

  it("refuse une lettre sans adresse de téléchargement", async () => {
    ged.consulter.mockResolvedValue({ urlTelechargement: null });
    liste([demande({ id: 2, statut: "VALIDEE", lettreDocumentId: 40 })]);
    rendre(<FileConstitutions roles={JURISTE} />);
    fireEvent.click(screen.getByRole("button", { name: "Lettre de constitution - DOS-2026-0003" }));
    fireEvent.click(screen.getByRole("button", { name: "Aperçu lettre-constitution-2.pdf" }));

    await waitFor(() => expect(ged.consulter).toHaveBeenCalled());
    expect(ged.recupererContenu).not.toHaveBeenCalled();
  });

  it("propose de rédiger la lettre à son auteur, de la lire aux autres", () => {
    liste([demande({ id: 1, redactionPossible: true }), demande({ id: 2 })]);
    rendre(<FileConstitutions roles={JURISTE} />);

    fireEvent.click(screen.getByRole("button", { name: T.redigerLettre }));
    expect(screen.getByText("Lettre de la demande 1")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: T.consulterLettre })).toBeInTheDocument();
  });
});

describe("FileConstitutions - signature et rejet", () => {
  it("signe puis ouvre les documents du dossier", async () => {
    liste([demande({})]);
    rendre(<FileConstitutions roles={SH} />);
    fireEvent.click(screen.getByRole("button", { name: "Signer la constitution - Me Eto" }));
    const fenetre = screen.getByRole("dialog", { name: T.signerTitre, hidden: true });
    expect(within(fenetre).getByText(/l’avocat en sera prévenu/)).toBeInTheDocument();
    fireEvent.click(within(fenetre).getByRole("button", { name: T.signer, hidden: true }));

    await waitFor(() => expect(navigation.push).toHaveBeenCalledWith("/dossiers/3?onglet=documents"));
    expect(decider).toHaveBeenCalledWith({ id: 8, decision: { decision: "VALIDEE" } });
    expect(toast.success).toHaveBeenCalledWith(T.signee);
  });

  it("prévient qu'un prestataire sans compte reçoit la lettre à la main, et signale un échec", async () => {
    decider.mockRejectedValue(new ErreurApi({ code: "X", message: "Déjà signée" }));
    liste([demande({ prestataireType: "HUISSIER" as never, prestataireNom: "Huissier X" })]);
    rendre(<FileConstitutions roles={SH} />);
    fireEvent.click(screen.getByRole("button", { name: "Signer la constitution - Huissier X" }));
    const fenetre = screen.getByRole("dialog", { name: T.signerTitre, hidden: true });
    expect(within(fenetre).getByText(/transmettez-lui la lettre/)).toBeInTheDocument();
    fireEvent.click(within(fenetre).getByRole("button", { name: T.signer, hidden: true }));

    await waitFor(() => expect(toast.error).toHaveBeenCalledWith("Déjà signée"));
    expect(navigation.push).not.toHaveBeenCalled();
  });

  it("rejette avec un motif obligatoire, et affiche le refus du serveur", async () => {
    decider.mockRejectedValueOnce(new ErreurApi({ code: "X", message: "Rejet impossible" }));
    liste([demande({})]);
    rendre(<FileConstitutions roles={SH} />);
    fireEvent.click(screen.getByRole("button", { name: "Rejeter la constitution - Me Eto" }));
    const fenetre = screen.getByRole("dialog", { name: T.rejetTitre, hidden: true });
    const rejeter = () => fireEvent.click(within(fenetre).getByRole("button", { name: T.rejeter, hidden: true }));

    rejeter();
    expect(await within(fenetre).findByText(MESSAGES.fr.metier.champObligatoire)).toBeInTheDocument();
    fireEvent.change(within(fenetre).getByLabelText(T.champMotifRejet, { exact: false }), { target: { value: " Coût " } });
    rejeter();
    expect(await within(fenetre).findByText("Rejet impossible")).toBeInTheDocument();
    rejeter();
    await waitFor(() => expect(toast.success).toHaveBeenCalledWith(T.rejetee));
    expect(decider).toHaveBeenLastCalledWith({ id: 8, decision: { decision: "REJETEE", motifRejet: "Coût" } });
  });

  it("ferme le rejet sans rien envoyer", () => {
    liste([demande({})]);
    rendre(<FileConstitutions roles={SH} />);
    fireEvent.click(screen.getByRole("button", { name: "Rejeter la constitution - Me Eto" }));
    const fenetre = screen.getByRole("dialog", { name: T.rejetTitre, hidden: true });
    fireEvent.click(within(fenetre).getByRole("button", { name: C.annuler, hidden: true }));

    expect(decider).not.toHaveBeenCalled();
  });
});
