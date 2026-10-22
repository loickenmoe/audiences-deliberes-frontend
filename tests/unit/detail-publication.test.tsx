import { fireEvent, screen, waitFor, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { DetailPublication } from "@/components/modules/publications/detail-publication";
import { ErreurApi } from "@/lib/api/errors";
import type { Publication } from "@/types/domaine";
import { MESSAGES, rendre } from "../utils/rendu";

/**
 * Screen 32 - a lawyer's publication: the Assistant validates it (or only acknowledges a hearing
 * report), a legal officer comments for the DJ/DJA, the DJ/DJA sends the single correspondence.
 */
const etat = vi.hoisted(() => ({ requete: { data: undefined as unknown, isLoading: false, error: null as unknown } }));
const mutations = vi.hoisted(() => ({ valider: vi.fn(), commenter: vi.fn(), transmettre: vi.fn() }));
const contenuFichier = vi.hoisted(() => vi.fn());
const telechargerBlob = vi.hoisted(() => vi.fn());

vi.mock("@/hooks/usePublications", () => ({
  usePublication: () => etat.requete,
  useValiderPublication: () => ({ mutateAsync: mutations.valider, isPending: false }),
  useCommenterPublication: () => ({ mutateAsync: mutations.commenter, isPending: false }),
  useTransmettreCorrespondance: () => ({ mutateAsync: mutations.transmettre, isPending: false }),
}));
vi.mock("@/services/publicationService", () => ({ publicationService: { contenuFichier } }));
vi.mock("@/lib/documents", async (original) => ({
  ...(await original<typeof import("@/lib/documents")>()),
  telechargerBlob,
}));
vi.mock("@/components/metier/apercu-fichier", () => ({
  ApercuFichier: ({ ouvert, nomFichier }: { ouvert: boolean; nomFichier: string }) =>
    ouvert ? <p>{`Aperçu de ${nomFichier}`}</p> : null,
}));

const toast = vi.hoisted(() => ({ success: vi.fn(), error: vi.fn() }));
vi.mock("sonner", () => ({ toast }));

const P = MESSAGES.fr.publications;
const C = MESSAGES.fr.commun;
const OBLIGATOIRE = MESSAGES.fr.metier.champObligatoire;
const ASSISTANTE = ["ROLE_ASSISTANTE", "ROLE_CONSULTATION"];
const JURISTE = ["ROLE_JURISTE", "ROLE_CONSULTATION"];
const DJ = ["ROLE_DJ", "ROLE_JURISTE", "ROLE_CONSULTATION"];

function publication(partiel: Partial<Publication>): Publication {
  return {
    id: 7,
    type: "AUTRE",
    typeDocument: null,
    statutValidation: "DEPOSE",
    dossierId: 3,
    referenceDossier: "DOS-2026-0003",
    avocatNom: "Me Mballa",
    audienceDate: null,
    dateDepot: "2026-10-01T10:00:00",
    restrictionAccesNom: null,
    nomFichier: "conclusions.pdf",
    contenu: null,
    motifRejet: null,
    commentaires: [],
    correspondance: null,
    ...partiel,
  } as Publication;
}

function charger(p: Publication) {
  etat.requete = { data: p, isLoading: false, error: null };
}

function dialogue(titre: string) {
  return screen.getByRole("dialog", { name: titre, hidden: true });
}

beforeEach(() => {
  vi.clearAllMocks();
  for (const mutation of Object.values(mutations)) mutation.mockResolvedValue({});
  contenuFichier.mockResolvedValue(new Blob(["x"]));
});

describe("DetailPublication - accès", () => {
  it("affiche le chargement", () => {
    etat.requete = { data: undefined, isLoading: true, error: null };
    rendre(<DetailPublication publicationId={7} roles={JURISTE} />);
    expect(screen.getByRole("status")).toBeInTheDocument();
  });

  it.each<[string, ErreurApi, string]>([
    ["un accès restreint", new ErreurApi({ code: "ERR-009", message: "x", statut: 403 }), P.accesRestreint],
    ["une publication introuvable", new ErreurApi({ code: "RESSOURCE_INTROUVABLE", message: "x", statut: 404 }), P.introuvable],
    ["une autre erreur", new ErreurApi({ code: "ERREUR_INTERNE", message: "Panne", statut: 500 }), "Panne"],
  ])("présente %s", (_cas, erreur, texte) => {
    etat.requete = { data: undefined, isLoading: false, error: erreur };
    rendre(<DetailPublication publicationId={7} roles={JURISTE} />);
    expect(screen.getByText(texte)).toBeInTheDocument();
  });
});

describe("DetailPublication - contenu", () => {
  it("résume une pièce réservée à un juriste, et la télécharge ou la montre", async () => {
    charger(publication({ statutValidation: "VALIDE", typeDocument: "CONCLUSIONS" as never, restrictionAccesNom: "Awa Ndiaye" }));
    rendre(<DetailPublication publicationId={7} roles={["ROLE_CONSULTATION"]} />);

    expect(screen.getByText("Réservée à Awa Ndiaye")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "DOS-2026-0003" })).toHaveAttribute("href", "/dossiers/3");
    fireEvent.click(screen.getByRole("button", { name: P.consulter }));
    expect(screen.getByText("Aperçu de conclusions.pdf")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: P.telecharger }));
    await waitFor(() => expect(telechargerBlob).toHaveBeenCalledWith(expect.any(Blob), "conclusions.pdf"));
  });

  it("signale un téléchargement échoué", async () => {
    contenuFichier.mockRejectedValue(new ErreurApi({ code: "X", message: "Fichier absent" }));
    charger(publication({ statutValidation: "VALIDE", nomFichier: null }));
    rendre(<DetailPublication publicationId={7} roles={["ROLE_CONSULTATION"]} />);
    fireEvent.click(screen.getByRole("button", { name: P.telecharger }));

    expect(await screen.findByRole("alert")).toHaveTextContent("Fichier absent");
  });

  it("montre un compte rendu, sa date d'audience, et masque la pièce jointe absente", () => {
    charger(publication({ type: "CR_AUDIENCE", audienceDate: "2026-09-20", contenu: "Affaire renvoyée", nomFichier: null, statutValidation: "VALIDE" }));
    rendre(<DetailPublication publicationId={7} roles={["ROLE_CONSULTATION"]} />);

    expect(screen.getByText("Affaire renvoyée")).toBeInTheDocument();
    expect(screen.getByText(P.restrictionTous)).toBeInTheDocument();
    expect(screen.queryByText(P.pieceJointe)).not.toBeInTheDocument();
  });

  it("propose la pièce jointe d'un compte rendu qui en a une", () => {
    charger(publication({ type: "CR_AUDIENCE", nomFichier: "pv.pdf", statutValidation: "VALIDE" }));
    rendre(<DetailPublication publicationId={7} roles={["ROLE_CONSULTATION"]} />);
    expect(screen.getByText(P.pieceJointe)).toBeInTheDocument();
  });

  it("affiche le motif d'un rejet", () => {
    charger(publication({ statutValidation: "REJETE", motifRejet: "Illisible" }));
    rendre(<DetailPublication publicationId={7} roles={ASSISTANTE} />);
    expect(screen.getByText("Publication rejetée. Motif : Illisible")).toBeInTheDocument();
  });
});

describe("DetailPublication - validation par l'Assistante", () => {
  it("valide une pièce restreinte en nommant son destinataire", async () => {
    charger(publication({ restrictionAccesNom: "Awa Ndiaye" }));
    rendre(<DetailPublication publicationId={7} roles={ASSISTANTE} />);
    fireEvent.click(screen.getByRole("button", { name: P.valider }));

    const fenetre = dialogue(P.validerTitre);
    expect(within(fenetre).getByText(P.validerMessageRestreinte.replace("{nom}", "Awa Ndiaye"))).toBeInTheDocument();
    fireEvent.click(within(fenetre).getByRole("button", { name: P.valider, hidden: true }));
    await waitFor(() => expect(mutations.valider).toHaveBeenCalledWith({ id: 7, decision: { statut: "VALIDE" } }));
    expect(toast.success).toHaveBeenCalledWith(P.validee);
  });

  it("accuse seulement réception d'un compte rendu, sans rejet possible", async () => {
    charger(publication({ type: "CR_AUDIENCE" }));
    rendre(<DetailPublication publicationId={7} roles={ASSISTANTE} />);
    expect(screen.queryByRole("button", { name: P.rejeter })).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: P.accuserReception }));
    const fenetre = dialogue(P.accuserReceptionTitre);
    expect(within(fenetre).getByText(P.accuserReceptionMessage)).toBeInTheDocument();
    fireEvent.click(within(fenetre).getByRole("button", { name: P.accuserReception, hidden: true }));
    await waitFor(() => expect(toast.success).toHaveBeenCalledWith(P.receptionAccusee));
  });

  it("signale l'échec d'une validation", async () => {
    mutations.valider.mockRejectedValue(new ErreurApi({ code: "X", message: "Déjà traitée" }));
    charger(publication({}));
    rendre(<DetailPublication publicationId={7} roles={ASSISTANTE} />);
    fireEvent.click(screen.getByRole("button", { name: P.valider }));
    expect(within(dialogue(P.validerTitre)).getByText(P.validerMessage)).toBeInTheDocument();
    fireEvent.click(within(dialogue(P.validerTitre)).getByRole("button", { name: P.valider, hidden: true }));

    await waitFor(() => expect(toast.error).toHaveBeenCalledWith("Déjà traitée"));
  });

  it("exige le motif d'un rejet, puis rejette ou affiche le refus", async () => {
    mutations.valider.mockRejectedValueOnce(new ErreurApi({ code: "X", message: "Rejet impossible" }));
    charger(publication({}));
    rendre(<DetailPublication publicationId={7} roles={ASSISTANTE} />);
    fireEvent.click(screen.getByRole("button", { name: P.rejeter }));
    const fenetre = dialogue(P.rejetTitre);
    const rejeter = () => fireEvent.click(within(fenetre).getByRole("button", { name: P.rejeter, hidden: true }));

    rejeter();
    expect(await within(fenetre).findByText(OBLIGATOIRE)).toBeInTheDocument();
    fireEvent.change(within(fenetre).getByLabelText(P.champMotifRejet, { exact: false }), { target: { value: " Illisible " } });
    rejeter();
    expect(await within(fenetre).findByText("Rejet impossible")).toBeInTheDocument();
    rejeter();
    await waitFor(() => expect(toast.success).toHaveBeenCalledWith(P.rejetee));
    expect(mutations.valider).toHaveBeenLastCalledWith({ id: 7, decision: { statut: "REJETE", motifRejet: "Illisible" } });
    fireEvent.click(within(fenetre).getByRole("button", { name: C.annuler, hidden: true }));
  });

  it("ne propose rien à valider à un autre profil", () => {
    charger(publication({}));
    rendre(<DetailPublication publicationId={7} roles={JURISTE} />);
    expect(screen.queryByText(P.validation)).not.toBeInTheDocument();
  });
});

describe("DetailPublication - échanges", () => {
  it("le juriste lit les commentaires et en envoie un au DJ", async () => {
    mutations.commenter.mockRejectedValueOnce(new ErreurApi({ code: "X", message: "Trop long" }));
    charger(
      publication({
        statutValidation: "VALIDE",
        commentaires: [{ id: 1, auteurNom: null, contenu: "Bon travail", createdAt: "2026-10-02T10:00:00" }],
      } as Partial<Publication>),
    );
    rendre(<DetailPublication publicationId={7} roles={JURISTE} />);
    expect(screen.getByText("Bon travail")).toBeInTheDocument();
    expect(screen.getByText(P.aucuneCorrespondance)).toBeInTheDocument();
    const envoyer = () => fireEvent.click(screen.getByRole("button", { name: P.envoyerDjDja }));

    envoyer();
    expect(await screen.findByText(OBLIGATOIRE)).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText(P.commenter), { target: { value: " À revoir " } });
    envoyer();
    expect(await screen.findByText("Trop long")).toBeInTheDocument();
    envoyer();
    await waitFor(() => expect(toast.success).toHaveBeenCalledWith(P.commentaireEnvoye));
    expect(mutations.commenter).toHaveBeenLastCalledWith({ id: 7, contenu: "À revoir" });
  });

  it("le DJ transmet la correspondance après confirmation", async () => {
    charger(publication({ statutValidation: "VALIDE" }));
    rendre(<DetailPublication publicationId={7} roles={DJ} />);
    expect(screen.getByText(P.aucunCommentaire)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: P.envoyerDjDja })).not.toBeInTheDocument();
    const transmettre = () => fireEvent.click(screen.getByRole("button", { name: P.transmettre }));

    transmettre();
    expect(await screen.findByText(OBLIGATOIRE)).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText(P.champCorrespondance), { target: { value: " Merci de compléter " } });
    transmettre();
    fireEvent.click(within(dialogue(P.transmettreTitre)).getByRole("button", { name: P.transmettre, hidden: true }));

    await waitFor(() => expect(mutations.transmettre).toHaveBeenCalledWith({ id: 7, contenu: "Merci de compléter" }));
    expect(toast.success).toHaveBeenCalledWith(P.correspondanceEnvoyee);
  });

  it("affiche le refus de transmettre", async () => {
    mutations.transmettre.mockRejectedValue(new ErreurApi({ code: "X", message: "Déjà transmise" }));
    charger(publication({ statutValidation: "VALIDE" }));
    rendre(<DetailPublication publicationId={7} roles={DJ} />);
    fireEvent.change(screen.getByLabelText(P.champCorrespondance), { target: { value: "Message" } });
    fireEvent.click(screen.getByRole("button", { name: P.transmettre }));
    fireEvent.click(within(dialogue(P.transmettreTitre)).getByRole("button", { name: P.transmettre, hidden: true }));

    expect(await screen.findByText("Déjà transmise")).toBeInTheDocument();
  });

  it("montre la correspondance déjà transmise", () => {
    charger(
      publication({
        statutValidation: "VALIDE",
        correspondance: { id: 1, auteurNom: null, contenu: "Pièce reçue", createdAt: "2026-10-03T10:00:00" },
      } as Partial<Publication>),
    );
    rendre(<DetailPublication publicationId={7} roles={DJ} />);
    expect(screen.getByText("Pièce reçue")).toBeInTheDocument();
    expect(screen.getByText("Transmise par —", { exact: false })).toBeInTheDocument();
  });
});
