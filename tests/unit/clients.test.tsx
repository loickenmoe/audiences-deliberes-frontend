import { fireEvent, screen, waitFor, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { FormulaireClient } from "@/components/modules/clients/formulaire-client";
import { ListeClients } from "@/components/modules/clients/liste-clients";
import { VueClient } from "@/components/modules/clients/vue-client";
import { ErreurApi } from "@/lib/api/errors";
import type { Client, Dossier } from "@/types/domaine";
import { MESSAGES, rendre } from "../utils/rendu";

/**
 * Clients: search (filters in the URL), creation and edition with server-assigned reference, and
 * the consolidated view of every case against a client.
 */
const etat = vi.hoisted(() => ({
  liste: { data: undefined as unknown, isLoading: false, error: null as unknown, refetch: vi.fn() },
  client: { data: undefined as unknown, isLoading: false, error: null as unknown },
  vue: { data: undefined as unknown, isLoading: false, error: null as unknown },
}));
const mutations = vi.hoisted(() => ({ creer: vi.fn(), modifier: vi.fn(), reset: vi.fn() }));
const navigation = vi.hoisted(() => ({ replace: vi.fn(), parametres: new URLSearchParams() }));
const filtresRecus = vi.hoisted(() => vi.fn());

vi.mock("@/hooks/useClients", () => ({
  useClients: (filtres: unknown) => {
    filtresRecus(filtres);
    return etat.liste;
  },
  useClient: () => etat.client,
  useVueClientDossiers: () => etat.vue,
  useCreerClient: () => ({ mutateAsync: mutations.creer, isPending: false, reset: mutations.reset }),
  useModifierClient: () => ({ mutateAsync: mutations.modifier, isPending: false, reset: mutations.reset }),
}));
vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace: navigation.replace, push: vi.fn() }),
  usePathname: () => "/clients",
  useSearchParams: () => navigation.parametres,
}));

const toast = vi.hoisted(() => ({ success: vi.fn() }));
vi.mock("sonner", () => ({ toast }));

const T = MESSAGES.fr.clients;
const C = MESSAGES.fr.commun;
const SAISIE = ["ROLE_SAISIE", "ROLE_CONSULTATION"];

const CLIENT: Client = {
  id: 4,
  reference: "CLI-2026-0004",
  nom: "Société Test",
  email: "contact@test.cm",
  telephone: null,
  createdAt: "2026-01-05T09:00:00",
} as Client;

beforeEach(() => {
  vi.clearAllMocks();
  navigation.parametres = new URLSearchParams();
  etat.liste = { data: { content: [CLIENT], totalPages: 1, totalElements: 1 }, isLoading: false, error: null, refetch: vi.fn() };
  etat.client = { data: CLIENT, isLoading: false, error: null };
  etat.vue = { data: { recouvrement: [], exploitationLitiges: [] }, isLoading: false, error: null };
  mutations.creer.mockResolvedValue({ reference: "CLI-2026-0009" });
  mutations.modifier.mockResolvedValue({});
});

describe("ListeClients", () => {
  it("liste les clients avec un lien vers leur vue consolidée", () => {
    rendre(<ListeClients roles={SAISIE} />);

    expect(screen.getByRole("link", { name: "CLI-2026-0004" })).toHaveAttribute("href", "/clients/4");
    expect(screen.getByText("contact@test.cm")).toBeInTheDocument();
    expect(screen.getByText("—")).toBeInTheDocument();
  });

  it("transmet les filtres de l'URL et y écrit la recherche", async () => {
    navigation.parametres = new URLSearchParams("nom=Soc&reference=CLI");
    rendre(<ListeClients roles={SAISIE} />);
    expect(filtresRecus).toHaveBeenLastCalledWith({ nom: "Soc", reference: "CLI", page: 0, size: 10 });

    fireEvent.change(screen.getByLabelText(T.rechercheNom), { target: { value: "Afri" } });
    await waitFor(() => expect(navigation.replace.mock.calls.at(-1)?.[0]).toContain("nom=Afri"));
  });

  it("ouvre la création à qui peut créer, et seulement à lui", () => {
    const { unmount } = rendre(<ListeClients roles={["ROLE_CONSULTATION"]} />);
    expect(screen.queryByRole("button", { name: T.nouveauClient })).not.toBeInTheDocument();
    unmount();

    rendre(<ListeClients roles={SAISIE} />);
    fireEvent.click(screen.getByRole("button", { name: T.nouveauClient }));
    expect(screen.getByRole("dialog", { name: T.creerTitre, hidden: true })).toHaveAttribute("open");
  });

  it("annonce l'absence de résultat et propose de réessayer", () => {
    etat.liste = { data: undefined, isLoading: false, error: new Error("réseau"), refetch: vi.fn() };
    rendre(<ListeClients roles={SAISIE} />);
    fireEvent.click(screen.getByRole("button", { name: C.reessayer }));
    expect(etat.liste.refetch).toHaveBeenCalled();
  });
});

describe("FormulaireClient", () => {
  function fenetre(titre: string) {
    return screen.getByRole("dialog", { name: titre, hidden: true });
  }

  it("exige le nom, puis crée le client et annonce sa référence", async () => {
    const fermer = vi.fn();
    rendre(<FormulaireClient ouvert onFermeture={fermer} />);
    const modale = fenetre(T.creerTitre);
    fireEvent.click(within(modale).getByRole("button", { name: C.enregistrer, hidden: true }));
    expect(await within(modale).findByText(MESSAGES.fr.metier.champObligatoire)).toBeInTheDocument();

    fireEvent.change(within(modale).getByLabelText(T.colonneNom, { exact: false }), { target: { value: "Nouvelle SA" } });
    fireEvent.click(within(modale).getByRole("button", { name: C.enregistrer, hidden: true }));

    await waitFor(() => expect(mutations.creer).toHaveBeenCalledWith({ nom: "Nouvelle SA", email: undefined, telephone: undefined }));
    expect(toast.success).toHaveBeenCalledWith("Client CLI-2026-0009 créé.");
    expect(fermer).toHaveBeenCalled();
  });

  it("modifie un client, sa référence restant figée, et envoie null pour un champ vidé", async () => {
    rendre(<FormulaireClient ouvert onFermeture={vi.fn()} client={CLIENT} />);
    const modale = fenetre(T.modifierTitre);
    expect(within(modale).getByText(T.referenceFigee)).toBeInTheDocument();

    fireEvent.change(within(modale).getByLabelText(T.colonneEmail), { target: { value: "" } });
    fireEvent.change(within(modale).getByLabelText(T.colonneTelephone), { target: { value: "690000000" } });
    fireEvent.click(within(modale).getByRole("button", { name: C.enregistrer, hidden: true }));

    await waitFor(() => expect(mutations.modifier).toHaveBeenCalledWith({ nom: "Société Test", email: null, telephone: "690000000" }));
  });

  it("place l'erreur du serveur sur son champ, sinon en tête", async () => {
    mutations.creer
      .mockRejectedValueOnce(new ErreurApi({ code: "REQUETE_INVALIDE", message: "Téléphone invalide", champ: "telephone", statut: 400 }))
      .mockRejectedValueOnce(new ErreurApi({ code: "ERREUR_INTERNE", message: "Service indisponible", statut: 500 }));
    rendre(<FormulaireClient ouvert onFermeture={vi.fn()} />);
    const modale = fenetre(T.creerTitre);
    fireEvent.change(within(modale).getByLabelText(T.colonneNom, { exact: false }), { target: { value: "X" } });

    fireEvent.click(within(modale).getByRole("button", { name: C.enregistrer, hidden: true }));
    expect(await within(modale).findByText("Téléphone invalide")).toBeInTheDocument();
    fireEvent.click(within(modale).getByRole("button", { name: C.enregistrer, hidden: true }));
    expect(await within(modale).findByText("Service indisponible")).toBeInTheDocument();
  });

  it("annule sans rien envoyer", () => {
    const fermer = vi.fn();
    rendre(<FormulaireClient ouvert onFermeture={fermer} />);
    fireEvent.click(within(fenetre(T.creerTitre)).getByRole("button", { name: C.annuler, hidden: true }));

    expect(fermer).toHaveBeenCalled();
    expect(mutations.reset).toHaveBeenCalled();
    expect(mutations.creer).not.toHaveBeenCalled();
  });
});

describe("VueClient", () => {
  const DOSSIER = {
    id: 3,
    reference: "DOS-2026-0003",
    nature: "Recouvrement de créance",
    juridictionSaisie: "TGI Douala",
    risqueEncouru: 5000000,
    etapes: [{ id: 1, type: "INSTANCE", statutCycleVie: "EN_COURS" }],
  } as unknown as Dossier;

  it("affiche le chargement puis l'erreur", () => {
    etat.client = { data: undefined, isLoading: true, error: null };
    const { rerender } = rendre(<VueClient clientId={4} roles={SAISIE} />);
    expect(screen.getByRole("status")).toBeInTheDocument();

    etat.client = { data: undefined, isLoading: false, error: null };
    etat.vue = { data: undefined, isLoading: false, error: new ErreurApi({ code: "X", message: "Vue indisponible" }) };
    rerender(<VueClient clientId={4} roles={SAISIE} />);
    expect(screen.getByText("Vue indisponible")).toBeInTheDocument();
  });

  it("présente les dossiers par catégorie et les coordonnées du client", () => {
    etat.vue = { data: { recouvrement: [DOSSIER, { ...DOSSIER, id: 4, etapes: [] }], exploitationLitiges: [] }, isLoading: false, error: null };
    rendre(<VueClient clientId={4} roles={SAISIE} />);

    expect(screen.getByRole("heading", { name: "Société Test" })).toBeInTheDocument();
    expect(screen.getByText("contact@test.cm")).toBeInTheDocument();
    expect(screen.getByText(MESSAGES.fr.commun.aucuneValeur)).toBeInTheDocument();
    expect(screen.getAllByText("DOS-2026-0003")).toHaveLength(2);
    expect(screen.getByText(T.aucunDossierCategorie)).toBeInTheDocument();
  });

  it("ouvre la modification à qui peut modifier", () => {
    rendre(<VueClient clientId={4} roles={SAISIE} />);
    fireEvent.click(screen.getByRole("button", { name: T.modifier }));
    expect(screen.getByRole("dialog", { name: T.modifierTitre, hidden: true })).toHaveAttribute("open");
  });

  it("ne propose pas la modification en lecture seule", () => {
    rendre(<VueClient clientId={4} roles={["ROLE_CONSULTATION"]} />);
    expect(screen.queryByRole("button", { name: T.modifier })).not.toBeInTheDocument();
  });
});
