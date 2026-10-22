import { beforeEach, describe, expect, it, vi } from "vitest";

import { CLES } from "@/hooks/const";
import * as audiences from "@/hooks/useAudiences";
import * as deliberes from "@/hooks/useDeliberes";
import * as dossiers from "@/hooks/useDossiers";
import * as ged from "@/hooks/useGed";
import { audienceService } from "@/services/audienceService";
import { delibereService } from "@/services/delibereService";
import { dossierService } from "@/services/dossierService";
import { gedService } from "@/services/gedService";
import { executerMutation, executerRequete, rendreRequete } from "../utils/hooks";

/**
 * Case, hearing, deliberation and DMS hooks: each reads the right endpoint with its parameters, and
 * each action refreshes exactly the caches showing what it changed.
 */
vi.mock("@/services/dossierService", async () => ({ dossierService: (await import("../utils/hooks")).serviceSimule({ id: 9, clientId: 4 }) }));
vi.mock("@/services/gedService", async () => ({ gedService: (await import("../utils/hooks")).serviceSimule() }));
vi.mock("@/services/audienceService", async () => ({ audienceService: (await import("../utils/hooks")).serviceSimule() }));
vi.mock("@/services/delibereService", async () => ({ delibereService: (await import("../utils/hooks")).serviceSimule() }));

const toast = vi.hoisted(() => ({ success: vi.fn() }));
vi.mock("sonner", () => ({ toast }));

const services = {
  dossier: dossierService as unknown as Record<string, ReturnType<typeof vi.fn>>,
  ged: gedService as unknown as Record<string, ReturnType<typeof vi.fn>>,
  audience: audienceService as unknown as Record<string, ReturnType<typeof vi.fn>>,
  delibere: delibereService as unknown as Record<string, ReturnType<typeof vi.fn>>,
};

beforeEach(() => vi.clearAllMocks());

describe("lectures", () => {
  it.each<[string, () => { isSuccess: boolean }, keyof typeof services, string, unknown[]]>([
    ["useDossiers", () => dossiers.useDossiers({ page: 1 }), "dossier", "lister", [{ page: 1 }]],
    ["useDossiers sans filtre", () => dossiers.useDossiers(), "dossier", "lister", [{}]],
    ["useDossier", () => dossiers.useDossier(3), "dossier", "consulter", [3]],
    ["useHistoriqueDossier", () => dossiers.useHistoriqueDossier(3, 2, 25), "dossier", "historique", [3, 2, 25]],
    ["useDocumentsDossier", () => dossiers.useDocumentsDossier(3), "ged", "listerDocumentsDossier", [3, 0, 10]],
    ["useDerogations", () => dossiers.useDerogations(3, "EN_ATTENTE"), "dossier", "listerDerogations", [3, "EN_ATTENTE"]],
    ["useAudiencesDossier", () => audiences.useAudiencesDossier(3), "audience", "listerAudiences", [3, 0, 10]],
    ["useAlarmesDossier", () => audiences.useAlarmesDossier(3, 1, 5), "audience", "listerAlarmes", [3, 1, 5]],
    ["useJournalAudiences", () => audiences.useJournalAudiences("2026-10-01"), "audience", "journal", ["2026-10-01", 0, 10]],
    [
      "useComptesRendusAttendus",
      () => audiences.useComptesRendusAttendus("2026-10-01", "2026-10-31"),
      "audience",
      "comptesRendusAttendus",
      ["2026-10-01", "2026-10-31", 0, 10],
    ],
    ["useCalendrier", () => audiences.useCalendrier("HEBDOMADAIRE", "2026-10-05"), "audience", "calendrier", ["HEBDOMADAIRE", "2026-10-05"]],
    ["useDeliberesDossier", () => deliberes.useDeliberesDossier(3), "delibere", "lister", [3]],
    ["useProrogations", () => deliberes.useProrogations(21), "delibere", "listerProrogations", [21]],
    ["useRecours", () => deliberes.useRecours(21, true), "delibere", "recours", [21]],
    ["useDemandesSuppression", () => ged.useDemandesSuppression(null), "ged", "listerDemandesSuppression", [null, 0, 10]],
    ["usePartagesAvocat", () => ged.usePartagesAvocat(1), "ged", "partagesAvocat", [1, 10]],
    ["useEtatPartageDossier", () => ged.useEtatPartageDossier(3), "ged", "etatPartageDossier", [3]],
    ["useRapportJournalier", () => ged.useRapportJournalier("2026-10-01"), "ged", "rapportJournalier", ["2026-10-01"]],
  ])("%s", async (_nom, hook, service, methode, attendus) => {
    await executerRequete(hook);
    expect(services[service][methode]).toHaveBeenCalledWith(...attendus);
  });

  it.each<[string, () => { fetchStatus: string }]>([
    ["un dossier sans identifiant", () => dossiers.useDossier(0)],
    ["les documents d'un identifiant invalide", () => dossiers.useDocumentsDossier(Number.NaN)],
    ["des dérogations inutiles", () => dossiers.useDerogations(3, undefined, false)],
    ["les audiences sans dossier", () => audiences.useAudiencesDossier(0)],
    ["les alarmes sans dossier", () => audiences.useAlarmesDossier(-1)],
    ["un journal à date incomplète", () => audiences.useJournalAudiences("2026-10")],
    ["des comptes rendus sans borne", () => audiences.useComptesRendusAttendus("2026-10-01", "")],
    ["les délibérés sans dossier", () => deliberes.useDeliberesDossier(0)],
    ["l'historique sans délibéré", () => deliberes.useProrogations(null)],
    ["un recours non consultable", () => deliberes.useRecours(21, false)],
    ["un rapport à date incomplète", () => ged.useRapportJournalier("")],
  ])("n'interroge pas le serveur pour %s", (_cas, hook) => {
    expect(rendreRequete(hook).fetchStatus).toBe("idle");
  });
});

describe("actions sur le dossier", () => {
  const FICHE = [[CLES.dossier, 3], [CLES.dossiers], [CLES.derogations, 3]];

  it("la création rafraîchit les listes et la vue du client", async () => {
    const cles = await executerMutation(() => dossiers.useCreerDossier(), { nature: "X" } as never);
    expect(services.dossier.creer).toHaveBeenCalledWith({ nature: "X" });
    expect(cles).toEqual([[CLES.dossiers], [CLES.clientDossiers, 4]]);
  });

  it.each<[string, () => { mutateAsync: (v: never) => Promise<unknown> }, unknown, string, unknown[], string]>([
    [
      "affectation",
      () => dossiers.useModifierAffectation(3),
      { affectation: { juristesAffectes: [1], avocatsAffectes: [2] }, forcer: true },
      "modifierAffectation",
      [3, { juristesAffectes: [1], avocatsAffectes: [2] }, true],
      "affectationEnregistree",
    ],
    [
      "statut d'étape",
      () => dossiers.useModifierStatutEtape(3),
      { etapeId: 5, nouveauStatut: "EN_COURS" },
      "modifierStatutEtape",
      [3, 5, "EN_COURS"],
      "statutEnregistre",
    ],
    ["création d'étape", () => dossiers.useCreerEtape(3), "RECOURS_1", "creerEtape", [3, "RECOURS_1"], "etapeCreee"],
    ["dérogation", () => dossiers.useDemanderDerogation(3), { nouveauSeuil: 1 }, "demanderDerogation", [3, { nouveauSeuil: 1 }], "derogationEnvoyee"],
    ["sensibilité", () => dossiers.useValiderSensibilite(3), { statut: "VALIDEE" }, "validerSensibilite", [3, { statut: "VALIDEE" }], "sensibiliteEnregistree"],
    ["proposition de diligence", () => dossiers.useProposerDiligence(3), { motif: "m" }, "proposerDiligence", [3, { motif: "m" }], "diligenceProposee"],
    ["diligence", () => dossiers.useModifierDiligence(3), { estSensible: false }, "modifierDiligence", [3, { estSensible: false }], "diligenceModifiee"],
    [
      "arbitrage de dérogation",
      () => dossiers.useValiderDerogation(3),
      { auditId: 9, decision: { statut: "VALIDEE" } },
      "validerDerogation",
      [3, 9, { statut: "VALIDEE" }],
      "derogationArbitree",
    ],
  ])("%s : appelle le service, rafraîchit la fiche et l'annonce", async (_nom, hook, variables, methode, attendus, cle) => {
    const cles = await executerMutation(hook, variables as never);
    expect(services.dossier[methode]).toHaveBeenCalledWith(...attendus);
    expect(cles).toEqual(FICHE);
    expect(toast.success).toHaveBeenCalledWith((await import("@/messages/fr.json")).fiche[cle as "etapeCreee"]);
  });

  it("le dépôt et la suppression de document rafraîchissent les documents et la fiche", async () => {
    const fichier = new File(["x"], "a.pdf");
    expect(await executerMutation(() => dossiers.useDeposerDocument(3), { typeDocument: "AUTRE", fichier })).toEqual([
      [CLES.documentsDossier, 3],
      [CLES.dossier, 3],
    ]);
    expect(services.ged.deposer).toHaveBeenCalledWith(3, "AUTRE", fichier);
    await executerMutation(() => dossiers.useSupprimerDocument(3), 7);
    expect(services.ged.supprimer).toHaveBeenCalledWith(7);
  });
});

describe("actions sur les audiences et les alarmes", () => {
  const AUDIENCES = [[CLES.audiencesDossier, 3], [CLES.dossier, 3], [CLES.calendrier]];
  const ALARMES = [[CLES.alarmesDossier, 3], [CLES.dossier, 3], [CLES.calendrier]];

  it.each<[string, () => { mutateAsync: (v: never) => Promise<unknown> }, unknown, string, unknown[], unknown[][]]>([
    ["planification", () => audiences.usePlanifierAudience(3), { audience: { etapeId: 5 }, forcer: true }, "planifier", [3, { etapeId: 5 }, true], AUDIENCES],
    ["note", () => audiences.useModifierNoteAvocat(3), { audienceId: 1, note: "n" }, "modifierNoteAvocat", [1, "n"], AUDIENCES],
    ["compte rendu", () => audiences.useEnregistrerCompteRendu(3), { audienceId: 1, compteRendu: "c" }, "enregistrerCompteRendu", [1, "c"], AUDIENCES],
    ["annulation", () => audiences.useAnnulerAudience(3), { audienceId: 1, motif: "m" }, "annuler", [1, "m"], AUDIENCES],
    ["traitement d'alarme", () => audiences.useTraiterAlarme(3), 4, "traiterAlarme", [4], ALARMES],
    ["création d'alarme", () => audiences.useCreerAlarme(3), { objet: "o" }, "creerAlarme", [3, { objet: "o" }], ALARMES],
    [
      "reprogrammation",
      () => audiences.useReprogrammerAlarme(3),
      { alarmeId: 4, reprogrammation: { dateEcheance: "d" } },
      "reprogrammerAlarme",
      [4, { dateEcheance: "d" }],
      ALARMES,
    ],
  ])("%s", async (_nom, hook, variables, methode, attendus, cles) => {
    expect(await executerMutation(hook, variables as never)).toEqual(cles);
    expect(services.audience[methode]).toHaveBeenCalledWith(...attendus);
  });
});

describe("actions sur les délibérés", () => {
  const DELIBERES = [[CLES.deliberesDossier, 3], [CLES.dossier, 3], [CLES.prorogations], [CLES.recours]];

  it.each<[string, () => { mutateAsync: (v: never) => Promise<unknown> }, unknown, string, unknown[]]>([
    ["mise en délibéré", () => deliberes.useEnregistrerDelibere(3), { etapeId: 5 }, "enregistrer", [3, { etapeId: 5 }]],
    ["décision", () => deliberes.useViderDelibere(3), { delibereId: 21, corps: { resultat: "FAVORABLE" } }, "vider", [21, { resultat: "FAVORABLE" }]],
    ["prorogation", () => deliberes.useProroger(3), { delibereId: 21, corps: { date: "d" } }, "proroger", [21, { date: "d" }]],
    ["rabattement", () => deliberes.useRabattre(3), { delibereId: 21, corps: { motif: "m" } }, "rabattre", [21, { motif: "m" }]],
    ["expédition", () => deliberes.useModifierExpedition(3), { delibereId: 21, statut: "LEVEE" }, "modifierExpedition", [21, "LEVEE"]],
  ])("%s", async (_nom, hook, variables, methode, attendus) => {
    expect(await executerMutation(hook, variables as never)).toEqual(DELIBERES);
    expect(services.delibere[methode]).toHaveBeenCalledWith(...attendus);
  });
});

describe("actions de la GED", () => {
  const PARTAGE = [[CLES.documentsDossier], [CLES.partagesAvocat]];

  it("approuve ou rejette une demande de suppression", async () => {
    const cles = await executerMutation(() => ged.useDeciderSuppression(), { documentId: 7 });
    expect(services.ged.deciderSuppression).toHaveBeenCalledWith(7, { decision: "APPROUVEE" });
    expect(cles).toEqual([[CLES.demandesSuppression], [CLES.documentsDossier]]);

    await executerMutation(() => ged.useDeciderSuppression(), { documentId: 7, motifRejet: "Pièce utile" });
    expect(services.ged.deciderSuppression).toHaveBeenLastCalledWith(7, { decision: "REJETEE", motifRejet: "Pièce utile" });
  });

  it("partage, retire, valide ou rejette un partage", async () => {
    expect(await executerMutation(() => ged.usePartagerDocument(), 7)).toEqual(PARTAGE);
    expect(services.ged.partagerAvecAvocat).toHaveBeenCalledWith(7, expect.anything());
    expect(await executerMutation(() => ged.useRetirerPartage(), 7)).toEqual(PARTAGE);
    expect(services.ged.retirerPartageAvocat).toHaveBeenCalledWith(7, expect.anything());

    await executerMutation(() => ged.useArbitrerPartage(), { documentId: 7 });
    expect(services.ged.arbitrerPartageAvocat).toHaveBeenCalledWith(7, { decision: "VALIDE" });
    await executerMutation(() => ged.useArbitrerPartage(), { documentId: 7, motif: "Confidentiel" });
    expect(services.ged.arbitrerPartageAvocat).toHaveBeenLastCalledWith(7, { decision: "REJETE", motif: "Confidentiel" });
  });
});
