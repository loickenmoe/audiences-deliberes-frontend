import { fireEvent, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { FormulaireDossier } from "@/components/modules/dossiers/formulaire-dossier";
import { ErreurApi } from "@/lib/api/errors";
import { MESSAGES, rendre } from "../utils/rendu";

/**
 * Screen 06 - case creation. The category follows from the nature and decides the required
 * documents; the case is created first, then its documents are filed in the DMS.
 */
const etat = vi.hoisted(() => ({
  natures: { data: [] as unknown[] | undefined, isLoading: false, error: null as unknown },
  clients: { data: undefined as unknown, isLoading: false, error: null as unknown },
  juristes: { data: [] as unknown[] | undefined, isLoading: false, error: null as unknown },
  avocats: { data: undefined as unknown, isLoading: false, error: null as unknown },
}));
const creer = vi.hoisted(() => vi.fn());
const deposer = vi.hoisted(() => vi.fn());
const push = vi.hoisted(() => vi.fn());
const toast = vi.hoisted(() => ({ success: vi.fn(), error: vi.fn(), warning: vi.fn() }));

vi.mock("@/hooks/useReferentiels", () => ({
  useNaturesDossier: () => etat.natures,
  useTypesClientSensible: () => ({ data: [{ id: 1, code: "PEP", libelle: "Personne exposée" }] }),
  useUtilisateurs: () => etat.juristes,
  useAgences: () => ({
    data: { content: [{ id: 3, code: "00002", nom: "BONANJO", ville: "Douala", adresse: null, actif: true }] },
    isLoading: false,
  }),
}));
vi.mock("@/hooks/useClients", () => ({ useClients: () => etat.clients }));
vi.mock("@/hooks/useIntervenants", () => ({ useIntervenants: () => etat.avocats }));
vi.mock("@/hooks/useDossiers", () => ({ useCreerDossier: () => ({ mutateAsync: creer, isPending: false }) }));
vi.mock("@/services/gedService", () => ({ gedService: { deposer } }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ push, replace: vi.fn() }) }));
vi.mock("sonner", () => ({ toast }));

const D = MESSAGES.fr.dossiers;
const DOC = MESSAGES.fr.documents;
const OBLIGATOIRE = MESSAGES.fr.metier.champObligatoire;

const NATURES = [
  { id: 1, libelle: "Recouvrement de créance", categorie: "RECOUVREMENT" },
  { id: 2, libelle: "Contestation de prélèvement", categorie: "EXPLOITATION_LITIGES" },
];

function champ(libelle: string) {
  return screen.getByLabelText(libelle, { exact: false });
}

function choisirDansListe(combobox: string, option: RegExp) {
  fireEvent.click(screen.getByRole("combobox", { name: new RegExp(combobox) }));
  fireEvent.mouseDown(screen.getByRole("option", { name: option }));
}

function fichier(nom: string) {
  return new File(["contenu"], nom, { type: "application/pdf" });
}

/** Every required field, for a recovery case. */
function remplir() {
  fireEvent.change(champ(D.champNature), { target: { value: "Recouvrement de créance" } });
  fireEvent.change(champ(D.champJuridiction), { target: { value: "TGI Douala" } });
  fireEvent.change(champ(D.champClient), { target: { value: "8" } });
  fireEvent.change(champ(D.champRisque), { target: { value: "5000000" } });
  fireEvent.change(screen.getByLabelText(`${D.champDemandeurs} 1`), { target: { value: " Afriland " } });
  fireEvent.change(screen.getByLabelText(`${D.champDefendeurs} 1`), { target: { value: "SARL Débitrice" } });
  choisirDansListe(D.champAgenceOrigine, /00002/);
  fireEvent.click(screen.getByRole("checkbox", { name: "Awa Ndiaye" }));
  choisirDansListe(D.champAvocats, /Me Mballa/);
}

function joindre(type: "DOSSIER_CREDIT" | "PV_TRANSFERT", nom: string) {
  const libelle = DOC.fichierDe.replace("{piece}", DOC.types[type]);
  fireEvent.change(screen.getByLabelText(libelle), { target: { files: [fichier(nom)] } });
}

function enregistrer() {
  fireEvent.click(screen.getByRole("button", { name: MESSAGES.fr.commun.enregistrer }));
}

beforeEach(() => {
  vi.clearAllMocks();
  etat.natures = { data: NATURES, isLoading: false, error: null };
  etat.clients = {
    data: { content: [{ id: 8, reference: "CLI-008", nom: "Société Test" }], totalPages: 1, totalElements: 1 },
    isLoading: false,
    error: null,
  };
  etat.juristes = {
    data: [
      { id: 4, prenom: "Awa", nom: "Ndiaye", email: "awa.ndiaye@afriland.cm" },
      { id: 5, prenom: null, nom: null, email: null },
    ],
    isLoading: false,
    error: null,
  };
  etat.avocats = {
    data: { content: [{ id: 11, nom: "Me Mballa" }], totalPages: 1, totalElements: 1 },
    isLoading: false,
    error: null,
  };
  creer.mockResolvedValue({ id: 42, reference: "DOS-2026-0042" });
  deposer.mockResolvedValue({});
});

describe("FormulaireDossier - chargement", () => {
  it("attend les listes de référence", () => {
    etat.clients = { data: undefined, isLoading: true, error: null };
    rendre(<FormulaireDossier />);
    expect(screen.getByRole("status")).toBeInTheDocument();
  });

  it("refuse d'afficher un formulaire sans ses listes", () => {
    etat.natures = { data: undefined, isLoading: false, error: new ErreurApi({ code: "X", message: "Référentiel indisponible" }) };
    rendre(<FormulaireDossier />);
    expect(screen.getByText("Référentiel indisponible")).toBeInTheDocument();
  });

  it("coche le juriste connecté, reconnu par son courriel", () => {
    rendre(<FormulaireDossier courrielUtilisateur="AWA.NDIAYE@afriland.cm" />);
    expect(screen.getByRole("checkbox", { name: "Awa Ndiaye" })).toBeChecked();
    // Without name nor email, the account is still selectable under its id.
    expect(screen.getByRole("checkbox", { name: "#5" })).not.toBeChecked();
  });
});

describe("FormulaireDossier - saisie", () => {
  it("signale les champs obligatoires sans rien créer", async () => {
    rendre(<FormulaireDossier />);
    enregistrer();

    expect((await screen.findAllByText(OBLIGATOIRE)).length).toBeGreaterThan(3);
    expect(creer).not.toHaveBeenCalled();
  });

  it("déduit la catégorie de la nature et demande les pièces correspondantes", () => {
    rendre(<FormulaireDossier />);
    expect(screen.queryByText(D.sectionPieces)).not.toBeInTheDocument();

    fireEvent.change(champ(D.champNature), { target: { value: "Recouvrement de créance" } });
    expect(screen.getByText(MESSAGES.fr.domaine.CategorieDossier.RECOUVREMENT)).toBeInTheDocument();
    expect(screen.getByText(D.aidePiecesRecouvrement)).toBeInTheDocument();
    expect(document.getElementById("dossierCreditOrigine")).not.toBeNull();

    fireEvent.change(champ(D.champNature), { target: { value: "Contestation de prélèvement" } });
    expect(document.getElementById("incidentCompteReference")).not.toBeNull();
    expect(document.getElementById("elementsJustificatifs")).not.toBeNull();
  });

  it("exige le type de client d'un dossier sensible", async () => {
    rendre(<FormulaireDossier />);
    remplir();
    fireEvent.click(screen.getByLabelText(D.champEstSensible));
    enregistrer();

    expect(await screen.findByText(OBLIGATOIRE)).toBeInTheDocument();
    expect(creer).not.toHaveBeenCalled();
  });

  it("refuse de créer un dossier sans ses pièces obligatoires", async () => {
    rendre(<FormulaireDossier />);
    remplir();
    joindre("DOSSIER_CREDIT", "credit.pdf");
    enregistrer();

    await waitFor(() => expect(toast.error).toHaveBeenCalledWith(DOC.piecesManquantes));
    expect(screen.getByText(DOC.fichierManquant)).toBeInTheDocument();
    expect(creer).not.toHaveBeenCalled();
  });
});

describe("FormulaireDossier - création", () => {
  it("crée le dossier, dépose ses pièces puis l'ouvre", async () => {
    rendre(<FormulaireDossier />);
    remplir();
    fireEvent.change(document.getElementById("dossierCreditOrigine")!, { target: { value: "CR-77" } });
    joindre("DOSSIER_CREDIT", "credit.pdf");
    joindre("PV_TRANSFERT", "pv.pdf");
    enregistrer();

    await waitFor(() => expect(push).toHaveBeenCalledWith("/dossiers/42"));
    expect(creer).toHaveBeenCalledWith({
      nature: "Recouvrement de créance",
      juridictionSaisie: "TGI Douala",
      clientId: 8,
      parties: { demandeurs: ["Afriland"], defendeurs: ["SARL Débitrice"] },
      risqueEncouru: 5000000,
      recoursExerces: undefined,
      motifRenvoi: undefined,
      codeAgenceOrigine: "00002",
      codeAgenceContentieuse: undefined,
      dossierCreditOrigine: "CR-77",
      pvTransfert: undefined,
      incidentCompteReference: undefined,
      elementsJustificatifs: undefined,
      estSensible: false,
      seuilMontant: undefined,
      typeClientSensible: undefined,
      juristesAffectes: [4],
      avocatsAffectes: [11],
    });
    expect(deposer).toHaveBeenCalledTimes(2);
    expect(deposer).toHaveBeenCalledWith(42, "DOSSIER_CREDIT", expect.any(File));
    expect(toast.success).toHaveBeenCalledWith("Dossier DOS-2026-0042 créé.");
  });

  it("transmet la proposition de sensibilité", async () => {
    rendre(<FormulaireDossier />);
    remplir();
    joindre("DOSSIER_CREDIT", "credit.pdf");
    joindre("PV_TRANSFERT", "pv.pdf");
    fireEvent.click(screen.getByLabelText(D.champEstSensible));
    fireEvent.change(champ(D.champSeuilMontant), { target: { value: "1000000" } });
    fireEvent.change(champ(D.champTypeClientSensible), { target: { value: "PEP" } });
    enregistrer();

    await waitFor(() => expect(creer).toHaveBeenCalled());
    expect(creer.mock.calls[0]![0]).toMatchObject({ estSensible: true, seuilMontant: 1000000, typeClientSensible: "PEP" });
  });

  it("ouvre le dossier sur ses documents quand une pièce n'a pas pu être déposée", async () => {
    deposer.mockResolvedValueOnce({}).mockRejectedValueOnce(new Error("GED"));
    rendre(<FormulaireDossier />);
    remplir();
    joindre("DOSSIER_CREDIT", "credit.pdf");
    joindre("PV_TRANSFERT", "pv.pdf");
    enregistrer();

    await waitFor(() => expect(push).toHaveBeenCalledWith("/dossiers/42?onglet=documents"));
    expect(toast.warning).toHaveBeenCalledWith(expect.stringContaining("pv.pdf"), { duration: Infinity });
    expect(toast.success).not.toHaveBeenCalled();
  });

  it("place l'erreur du serveur sur le champ qu'il désigne", async () => {
    creer.mockRejectedValue(
      new ErreurApi({ code: "REQUETE_INVALIDE", message: "Juridiction inconnue", champ: "juridictionSaisie", statut: 400 }),
    );
    rendre(<FormulaireDossier />);
    remplir();
    joindre("DOSSIER_CREDIT", "credit.pdf");
    joindre("PV_TRANSFERT", "pv.pdf");
    enregistrer();

    expect(await screen.findByText("Juridiction inconnue")).toBeInTheDocument();
    expect(push).not.toHaveBeenCalled();
  });

  it("affiche en tête une erreur qui ne vise aucun champ", async () => {
    creer.mockRejectedValue(new ErreurApi({ code: "ERREUR_INTERNE", message: "Service indisponible", statut: 500 }));
    rendre(<FormulaireDossier />);
    remplir();
    joindre("DOSSIER_CREDIT", "credit.pdf");
    joindre("PV_TRANSFERT", "pv.pdf");
    enregistrer();

    expect(await screen.findByRole("alert")).toHaveTextContent("Service indisponible");
  });
});
