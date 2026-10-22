import { renderHook, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { CLES } from "@/hooks/const";
import * as alertes from "@/hooks/useAlertes";
import * as audit from "@/hooks/useAudit";
import * as clients from "@/hooks/useClients";
import * as configurations from "@/hooks/useConfigurations";
import * as constitutions from "@/hooks/useConstitutions";
import * as decisions from "@/hooks/useDecisions";
import * as explications from "@/hooks/useDemandesExplication";
import * as frais from "@/hooks/useFrais";
import * as intervenants from "@/hooks/useIntervenants";
import { useLibelles } from "@/hooks/useLibelles";
import * as notifications from "@/hooks/useNotifications";
import * as portail from "@/hooks/usePortailAvocat";
import * as publications from "@/hooks/usePublications";
import * as referentiels from "@/hooks/useReferentiels";
import * as signature from "@/hooks/useSignature";
import fr from "@/messages/fr.json";
import { alerteService } from "@/services/alerteService";
import { auditService } from "@/services/auditService";
import { clientService } from "@/services/clientService";
import { configurationService } from "@/services/configurationService";
import { constitutionService } from "@/services/constitutionService";
import { decisionService } from "@/services/decisionService";
import { demandeExplicationService } from "@/services/demandeExplicationService";
import { fraisService } from "@/services/fraisService";
import { intervenantService } from "@/services/intervenantService";
import { notificationService } from "@/services/notificationService";
import { portailAvocatService } from "@/services/portailAvocatService";
import { publicationService } from "@/services/publicationService";
import { referentielService } from "@/services/referentielService";
import { signatureService } from "@/services/signatureService";
import { executerMutation, executerRequete, rendreRequete } from "../utils/hooks";

/**
 * Business hooks: each reads its endpoint with the screen's parameters, and each action refreshes
 * exactly the caches showing what it changed.
 */
const simuler = vi.hoisted(() => async (nom: string) => ({
  [nom]: (await import("../utils/hooks")).serviceSimule({ id: 5, totalElements: 3 }),
}));
vi.mock("@/services/alerteService", () => simuler("alerteService"));
vi.mock("@/services/auditService", () => simuler("auditService"));
vi.mock("@/services/clientService", () => simuler("clientService"));
vi.mock("@/services/configurationService", () => simuler("configurationService"));
vi.mock("@/services/constitutionService", () => simuler("constitutionService"));
vi.mock("@/services/decisionService", () => simuler("decisionService"));
vi.mock("@/services/demandeExplicationService", () => simuler("demandeExplicationService"));
vi.mock("@/services/fraisService", () => simuler("fraisService"));
vi.mock("@/services/intervenantService", () => simuler("intervenantService"));
vi.mock("@/services/notificationService", () => simuler("notificationService"));
vi.mock("@/services/portailAvocatService", () => simuler("portailAvocatService"));
vi.mock("@/services/publicationService", () => simuler("publicationService"));
vi.mock("@/services/referentielService", () => simuler("referentielService"));
vi.mock("@/services/signatureService", () => simuler("signatureService"));
vi.mock("@/providers/alertes.provider", () => ({ useCanalAlertes: () => ({ connecte: true }) }));

const toast = vi.hoisted(() => ({ success: vi.fn() }));
vi.mock("sonner", () => ({ toast }));

type Simule = Record<string, ReturnType<typeof vi.fn>>;
const S = {
  alerte: alerteService as unknown as Simule,
  audit: auditService as unknown as Simule,
  client: clientService as unknown as Simule,
  configuration: configurationService as unknown as Simule,
  constitution: constitutionService as unknown as Simule,
  decision: decisionService as unknown as Simule,
  explication: demandeExplicationService as unknown as Simule,
  frais: fraisService as unknown as Simule,
  intervenant: intervenantService as unknown as Simule,
  notification: notificationService as unknown as Simule,
  portail: portailAvocatService as unknown as Simule,
  publication: publicationService as unknown as Simule,
  referentiel: referentielService as unknown as Simule,
  signature: signatureService as unknown as Simule,
};
type Service = keyof typeof S;
type Mutation = () => { mutateAsync: (v: never) => Promise<unknown> };

beforeEach(() => vi.clearAllMocks());

describe("lectures", () => {
  it.each<[string, () => { isSuccess: boolean }, Service, string, unknown[]]>([
    ["useClients", () => clients.useClients({ nom: "A", page: 1 }), "client", "rechercher", [{ nom: "A", page: 1 }]],
    ["useClient", () => clients.useClient(4), "client", "consulter", [4]],
    ["useVueClientDossiers", () => clients.useVueClientDossiers(4), "client", "vueConsolidee", [4]],
    ["useDecisionsDossier", () => decisions.useDecisionsDossier(3), "decision", "lister", [3]],
    ["useJurisprudences", () => decisions.useJurisprudences({ page: 0 } as never), "decision", "rechercherJurisprudences", [{ page: 0 }]],
    ["usePublications", () => publications.usePublications({ dossierId: 3 }), "publication", "lister", [{ dossierId: 3 }]],
    ["usePublication", () => publications.usePublication(7), "publication", "consulter", [7]],
    ["useConstitutions", () => constitutions.useConstitutions(null), "constitution", "lister", [null, 0, 10]],
    ["useLettreConstitution", () => constitutions.useLettreConstitution(8), "constitution", "lettre", [8]],
    ["useRepertoire", () => constitutions.useRepertoire(""), "constitution", "repertoire", [undefined, 0, 10]],
    ["useRepertoire nommé", () => constitutions.useRepertoire("Eto", 1, 5), "constitution", "repertoire", ["Eto", 1, 5]],
    ["useIntervenants", () => intervenants.useIntervenants({ type: "AVOCAT" }), "intervenant", "lister", [{ type: "AVOCAT" }]],
    ["useIntervenants sans filtre", () => intervenants.useIntervenants(), "intervenant", "lister", [{}]],
    ["useMesDossiers", () => portail.useMesDossiers("DOS"), "portail", "mesDossiers", ["DOS"]],
    ["useAudiencesDeMonDossier", () => portail.useAudiencesDeMonDossier(3), "portail", "audiencesDeMonDossier", [3]],
    ["usePiecesDeMonDossier", () => portail.usePiecesDeMonDossier(3), "portail", "piecesDeMonDossier", [3]],
    ["useMesPublications", () => portail.useMesPublications(2), "portail", "mesPublications", [2]],
    ["useMesConstitutions", () => portail.useMesConstitutions(), "portail", "mesConstitutions", []],
    [
      "useAgences",
      () => referentiels.useAgences({ recherche: "  bon ", page: 1, size: 20 }),
      "referentiel",
      "agences",
      [{ recherche: "bon", actifSeulement: true, page: 1, size: 20 }],
    ],
    ["useAgences sans filtre", () => referentiels.useAgences(), "referentiel", "agences", [{ recherche: undefined, actifSeulement: true, page: undefined, size: undefined }]],
    ["useNaturesDossier", () => referentiels.useNaturesDossier("RECOUVREMENT"), "referentiel", "naturesDossier", ["RECOUVREMENT"]],
    ["useTypesClientSensible", () => referentiels.useTypesClientSensible(), "referentiel", "typesClientSensible", []],
    ["useUtilisateurs", () => referentiels.useUtilisateurs("JURISTE"), "referentiel", "utilisateurs", [{ profil: "JURISTE" }]],
    ["useUtilisateurs tous", () => referentiels.useUtilisateurs(), "referentiel", "utilisateurs", [undefined]],
    ["useAudit", () => audit.useAudit({ perimetre: "TOUT" } as never), "audit", "consulter", [{ perimetre: "TOUT" }, 0, 10]],
    ["useAudit sans filtre", () => audit.useAudit({} as never, 2, 25), "audit", "consulter", [{}, 2, 25]],
    ["useArchivesAudit", () => audit.useArchivesAudit(1), "audit", "archives", [1, 10]],
    ["useMesNotifications", () => alertes.useMesNotifications("DECLENCHEE", 0, 10, "PROROGATION" as never), "alerte", "mesNotifications", ["DECLENCHEE", 0, 10, "PROROGATION"]],
    ["useMesNotifications toutes", () => alertes.useMesNotifications(null), "alerte", "mesNotifications", [null, 0, 10, undefined]],
    ["useStatistiquesDiffusion", () => alertes.useStatistiquesDiffusion("2026-10-01", "2026-10-31"), "alerte", "statistiquesDiffusion", ["2026-10-01", "2026-10-31"]],
    ["useDemandesFrais", () => frais.useDemandesFrais(null, 1), "frais", "lister", [null, 1, 10]],
    ["useDemandeFrais", () => frais.useDemandeFrais(5), "frais", "consulter", [5]],
    ["useMaSignature", () => signature.useMaSignature(), "signature", "mienne", []],
    ["useMonImageSignature", () => signature.useMonImageSignature(true), "signature", "monImage", []],
    ["useConfigurations", () => configurations.useConfigurations(), "configuration", "lister", []],
    ["useDemandesExplication", () => explications.useDemandesExplication(true, 2), "explication", "lister", [true, 2]],
    ["useSupervisionNotifications", () => notifications.useSupervisionNotifications("2026-10-01", "2026-10-31"), "notification", "superviser", ["2026-10-01", "2026-10-31"]],
  ])("%s", async (_nom, hook, service, methode, attendus) => {
    await executerRequete(hook);
    expect(S[service][methode]).toHaveBeenCalledWith(...attendus);
  });

  it("compte les notifications à traiter sur une seule ligne", async () => {
    expect(await executerRequete(() => alertes.useNombreNotificationsATraiter())).toBe(3);
    expect(S.alerte.mesNotifications).toHaveBeenCalledWith("DECLENCHEE", 0, 1);
  });

  it("rafraîchit moins souvent quand le canal temps réel est ouvert", () => {
    expect(alertes.cadenceRafraichissement({ connecte: true })).toBe(alertes.CADENCE_CANAL_OUVERT);
    expect(alertes.cadenceRafraichissement({ connecte: false })).toBe(alertes.CADENCE_REPLI);
  });

  it.each<[string, () => { fetchStatus: string }]>([
    ["un client inconnu", () => clients.useClient(undefined)],
    ["la vue d'un client inconnu", () => clients.useVueClientDossiers(undefined)],
    ["les décisions sans dossier", () => decisions.useDecisionsDossier(0)],
    ["des publications masquées", () => publications.usePublications({}, false)],
    ["une publication sans identifiant", () => publications.usePublication(Number.NaN)],
    ["une lettre sans demande", () => constitutions.useLettreConstitution(null)],
    ["les audiences sans dossier choisi", () => portail.useAudiencesDeMonDossier(null)],
    ["les pièces sans dossier choisi", () => portail.usePiecesDeMonDossier(null)],
    ["une diffusion sans période", () => alertes.useStatistiquesDiffusion("", "2026-10-31")],
    ["une demande de frais sans identifiant", () => frais.useDemandeFrais(0)],
    ["l'image d'une signature absente", () => signature.useMonImageSignature(false)],
    ["une supervision désactivée", () => notifications.useSupervisionNotifications("2026-10-01", "2026-10-31", false)],
  ])("n'interroge pas le serveur pour %s", (_cas, hook) => {
    expect(rendreRequete(hook).fetchStatus).toBe("idle");
  });
});

describe("actions", () => {
  it.each<[string, Mutation, unknown, Service, string, unknown[], unknown[][]]>([
    ["création de client", () => clients.useCreerClient(), { nom: "A" }, "client", "creer", [{ nom: "A" }], [[CLES.clients]]],
    ["modification de client", () => clients.useModifierClient(4), { nom: "B" }, "client", "modifier", [4, { nom: "B" }], [[CLES.client, 4], [CLES.clients]]],
    ["adjudication", () => decisions.useCreerAdjudication(3), { beneficiaire: "X" }, "decision", "creerAdjudication", [3, { beneficiaire: "X" }], [[CLES.decisionsDossier, 3], [CLES.dossier, 3]]],
    ["condamnation", () => decisions.useCreerCondamnation(3), { sens: "S" }, "decision", "creerCondamnation", [3, { sens: "S" }], [[CLES.decisionsDossier, 3], [CLES.dossier, 3]]],
    ["statut de paiement", () => decisions.useModifierStatutCondamnation(3), { id: 2, statutPaiement: "PAYE" }, "decision", "modifierStatutCondamnation", [2, "PAYE"], [[CLES.decisionsDossier, 3], [CLES.dossier, 3]]],
    ["archivage", () => decisions.useArchiverJurisprudence(), { indexation: { a: 1 }, fichier: "f" }, "decision", "archiverJurisprudence", [{ a: 1 }, "f"], [[CLES.jurisprudences]]],
    ["validation de publication", () => publications.useValiderPublication(), { id: 7, decision: { statut: "VALIDE" } }, "publication", "valider", [7, { statut: "VALIDE" }], [[CLES.publication, 7], [CLES.publications]]],
    ["commentaire", () => publications.useCommenterPublication(), { id: 7, contenu: "c" }, "publication", "commenter", [7, "c"], [[CLES.publication, 7], [CLES.publications]]],
    ["correspondance", () => publications.useTransmettreCorrespondance(), { id: 7, contenu: "c" }, "publication", "transmettreCorrespondance", [7, "c"], [[CLES.publication, 7], [CLES.publications]]],
    ["lettre", () => constitutions.useRedigerLettre(), { demandeId: 8, lettre: { corps: "x" } }, "constitution", "redigerLettre", [8, { corps: "x" }], [[CLES.constitutions]]],
    ["sollicitation", () => constitutions.useSolliciterConstitution(), { dossierId: 3 }, "constitution", "solliciter", [{ dossierId: 3 }, expect.anything()], [[CLES.constitutions]]],
    ["décision de constitution", () => constitutions.useDeciderConstitution(), { id: 8, decision: { statut: "V" } }, "constitution", "decider", [8, { statut: "V" }], [[CLES.constitutions], [CLES.documentsDossier]]],
    ["création d'intervenant", () => intervenants.useCreerIntervenant(), { nom: "Me" }, "intervenant", "creer", [{ nom: "Me" }], [[CLES.intervenants]]],
    ["modification d'intervenant", () => intervenants.useModifierIntervenant(11), { nom: "Me" }, "intervenant", "modifier", [11, { nom: "Me" }], [[CLES.intervenants]]],
    ["dépôt de frais", () => portail.useDeposerFrais(), { montant: 1 }, "frais", "deposer", [{ montant: 1 }], [[CLES.demandesFrais]]],
    ["dépôt de compte rendu", () => portail.useDeposerCompteRendu(), { audienceId: 1, fichier: null }, "publication", "deposerCompteRendu", [{ audienceId: 1, fichier: null }, null], [[CLES.mesPublications]]],
    ["autre publication", () => portail.useDeposerAutrePublication(), { dossierId: 3, typeDocument: "AUTRE", fichier: "f", restrictionAcces: 4 }, "publication", "deposerAutre", [3, "AUTRE", "f", 4], [[CLES.mesPublications]]],
    ["export d'audit", () => audit.useExporterAudit(), { filtres: { dateDebut: "a", dateFin: "b" }, format: "PDF" }, "audit", "exporter", [{ dateDebut: "a", dateFin: "b" }, "PDF"], [[CLES.audit, "archives"]]],
    ["traitement d'alerte", () => alertes.useTraiterAlerte(), 6, "alerte", "traiter", [6], [[CLES.notifications]]],
    ["paiement de frais", () => frais.usePaiementFrais(), 5, "frais", "enregistrerPaiement", [5], [[CLES.demandesFrais]]],
    ["paramètre", () => configurations.useModifierConfiguration(), { cle: "TAILLE_MAX_GED", valeur: "10" }, "configuration", "modifier", ["TAILLE_MAX_GED", "10"], [[CLES.configurations], [CLES.audit]]],
    ["seuil d'alerte", () => configurations.useModifierConfiguration(), { cle: "CHARGE_MAX_AVOCAT", valeur: "12" }, "alerte", "modifierSeuil", ["CHARGE_MAX_AVOCAT", 12], [[CLES.configurations], [CLES.audit]]],
    ["relance", () => notifications.useRelancerNotification(), 9, "notification", "relancer", [9], [[CLES.notifications, "supervision"]]],
  ])("%s", async (_nom, hook, variables, service, methode, attendus, cles) => {
    expect(await executerMutation(hook, variables as never)).toEqual(cles);
    expect(S[service][methode]).toHaveBeenCalledWith(...attendus);
  });

  it("annonce la création et la modification d'un client ou d'un intervenant", async () => {
    await executerMutation(() => clients.useCreerClient(), {} as never);
    await executerMutation(() => clients.useModifierClient(4), {} as never);
    await executerMutation(() => intervenants.useCreerIntervenant(), {} as never);
    await executerMutation(() => intervenants.useModifierIntervenant(4), {} as never);
    expect(toast.success.mock.calls.map(([message]) => message)).toEqual([
      fr.clients.creationReussie,
      fr.clients.modificationReussie,
      fr.intervenants.creationReussie,
      fr.intervenants.modificationReussie,
    ]);
  });

  it("journalise le refus d'un client sans le masquer", async () => {
    const erreur = vi.spyOn(console, "error").mockImplementation(() => undefined);
    S.client.creer!.mockRejectedValueOnce(new Error("Doublon"));
    S.client.modifier!.mockRejectedValueOnce(new Error("Introuvable"));
    await expect(executerMutation(() => clients.useCreerClient(), {} as never)).rejects.toThrow("Doublon");
    await expect(executerMutation(() => clients.useModifierClient(4), {} as never)).rejects.toThrow("Introuvable");
    expect(erreur).toHaveBeenCalledTimes(2);
    erreur.mockRestore();
  });

  it.each<[frais.EtapeDecision, string]>([
    ["conformite", "controlerConformite"],
    ["opportunite", "controlerOpportunite"],
    ["conjointe", "validerConjointement"],
  ])("la décision « %s » de frais suit son circuit", async (etape, methode) => {
    expect(await executerMutation(() => frais.useDecisionFrais(), { etape, id: 5, decision: { favorable: true } } as never)).toEqual([
      [CLES.demandesFrais],
    ]);
    expect(S.frais[methode]).toHaveBeenCalledWith(5, { favorable: true });
  });

  it("dépose et retire une signature", async () => {
    const { wrapper } = enveloppe();
    const { result } = renderHook(() => signature.useEcritureSignature(), { wrapper });
    await result.current.deposer.mutateAsync(new File(["x"], "s.png"));
    await result.current.retirer.mutateAsync();
    expect(S.signature.deposer).toHaveBeenCalled();
    expect(S.signature.retirer).toHaveBeenCalled();
  });

  it("demande et répond à une explication", async () => {
    const { wrapper } = enveloppe();
    const { result } = renderHook(() => explications.useEcritureExplication(), { wrapper });
    await result.current.demander.mutateAsync({ dossierId: 3 } as never);
    await result.current.repondre.mutateAsync({ id: 2, reponse: "r" });
    expect(S.explication.demander).toHaveBeenCalledWith({ dossierId: 3 }, expect.anything());
    expect(S.explication.repondre).toHaveBeenCalledWith(2, "r");
  });

  it("crée, modifie, désactive et réactive une agence", async () => {
    const { wrapper } = enveloppe();
    const { result } = renderHook(() => referentiels.useEcritureAgence(), { wrapper });
    await result.current.creer.mutateAsync({ code: "1" } as never);
    await result.current.modifier.mutateAsync({ id: 3, corps: { code: "2" } as never });
    await result.current.desactiver.mutateAsync(3);
    await result.current.reactiver.mutateAsync(3);
    expect(S.referentiel.creerAgence).toHaveBeenCalledWith({ code: "1" });
    expect(S.referentiel.modifierAgence).toHaveBeenCalledWith(3, { code: "2" });
    expect(S.referentiel.desactiverAgence).toHaveBeenCalledWith(3);
    expect(S.referentiel.reactiverAgence).toHaveBeenCalledWith(3);
  });
});

describe("useLibelles", () => {
  it("nomme utilisateurs et avocats, et garde l'identifiant d'un inconnu", async () => {
    S.referentiel.utilisateurs!.mockResolvedValue([
      { id: 4, prenom: "Awa", nom: "Ndiaye", email: null },
      { id: 5, prenom: null, nom: null, email: "paul@afriland.cm" },
      { id: 6, prenom: null, nom: null, email: null },
    ]);
    S.intervenant.lister!.mockResolvedValue({ content: [{ id: 11, nom: "Me Mballa" }] });
    const { wrapper } = enveloppe();
    const { result } = renderHook(() => useLibelles(), { wrapper });

    await waitFor(() => expect(result.current.chargement).toBe(false));
    await waitFor(() => expect(result.current.nomUtilisateur(4)).toBe("Awa Ndiaye"));
    expect(result.current.nomUtilisateur(5)).toBe("paul@afriland.cm");
    expect(result.current.nomUtilisateur(6)).toBe("#6");
    expect(result.current.nomUtilisateur(99)).toBe("#99");
    await waitFor(() => expect(result.current.nomIntervenant(11)).toBe("Me Mballa"));
    expect(result.current.nomIntervenant(12)).toBe("#12");
  });
});

function enveloppe() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  return {
    wrapper: ({ children }: { children: ReactNode }) => <QueryClientProvider client={client}>{children}</QueryClientProvider>,
  };
}
