import { fireEvent, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { GrilleNotifications } from "@/components/modules/administration/grille-notifications";
import {
  basculerCase,
  canalActif,
  colonnesModifiees,
  estCleDeGrille,
  lireListe,
  SECTIONS_GRILLE,
  saisieInitiale,
  telephoneValide,
} from "@/lib/notifications";
import type { ConfigurationSysteme } from "@/types/domaine";
import { EvenementPrestataire, TypeAlerte } from "@/types/enums";
import { rendre } from "../utils/rendu";

/** Le composant n'est jugé que sur ce qu'il demande d'enregistrer ; le fil HTTP est testé ailleurs. */
const mutateAsync = vi.fn();
vi.mock("@/hooks/useConfigurations", () => ({
  useModifierConfiguration: () => ({ mutateAsync, isPending: false }),
}));

beforeEach(() => {
  mutateAsync.mockReset();
  mutateAsync.mockResolvedValue({});
});

function liste(cle: string, valeur: string, valeursPossibles: readonly string[]): ConfigurationSysteme {
  return {
    cle,
    valeur,
    description: null,
    modifiablePar: "ROLE_DJ",
    dateModification: null,
    dernierAuteurId: null,
    typeValeur: "LISTE",
    valeurMinimale: null,
    valeurMaximale: null,
    valeursPossibles: [...valeursPossibles],
    listeVideAutorisee: cle !== "CANAUX_NOTIFICATION_DEFAUT",
  };
}

const CONFIGURATIONS: ConfigurationSysteme[] = [
  liste("CANAUX_NOTIFICATION_DEFAUT", "APPLICATIF,OUTLOOK", ["APPLICATIF", "OUTLOOK", "TEAMS"]),
  liste("CANAUX_NOTIFICATION_PRESTATAIRES", "COURRIEL_PERSONNEL,SMS", ["COURRIEL_PERSONNEL", "SMS", "WHATSAPP"]),
  liste("GRILLE_NOTIFICATION_OUTLOOK", TypeAlerte.join(","), TypeAlerte),
  liste("GRILLE_NOTIFICATION_TEAMS", "RAPPEL_AUDIENCE", TypeAlerte),
  liste("GRILLE_NOTIFICATION_COURRIEL_PERSONNEL", EvenementPrestataire.join(","), EvenementPrestataire),
  liste("GRILLE_NOTIFICATION_SMS", "RAPPEL_AUDIENCE,AFFECTATION_DOSSIER", EvenementPrestataire),
  liste("GRILLE_NOTIFICATION_WHATSAPP", "", EvenementPrestataire),
];

function section(identifiant: string) {
  const trouvee = SECTIONS_GRILLE.find((s) => s.identifiant === identifiant);
  if (!trouvee) throw new Error(identifiant);
  return trouvee;
}
const INTERNES = section("internes");
const PRESTATAIRES = section("prestataires");

describe("logique de la grille des notifications (Q-118)", () => {
  it("reconnaît les colonnes de grille, et elles seules", () => {
    expect(estCleDeGrille("GRILLE_NOTIFICATION_SMS")).toBe(true);
    expect(estCleDeGrille("CANAUX_NOTIFICATION_PRESTATAIRES")).toBe(false);
    expect(estCleDeGrille("FORMATS_GED")).toBe(false);
  });

  it("lit une liste vide comme aucun élément", () => {
    expect(lireListe("")).toEqual([]);
    expect(lireListe(" sms , rappel_audience ")).toEqual(["SMS", "RAPPEL_AUDIENCE"]);
  });

  it("ne renvoie que les colonnes modifiées, avec leur valeur à envoyer", () => {
    const initiale = saisieInitiale(PRESTATAIRES, CONFIGURATIONS);
    expect(colonnesModifiees(initiale, CONFIGURATIONS)).toEqual([]);

    const sansRappel = basculerCase(initiale, "GRILLE_NOTIFICATION_SMS", "RAPPEL_AUDIENCE", [...EvenementPrestataire]);
    expect(colonnesModifiees(sansRappel, CONFIGURATIONS)).toEqual([
      { cle: "GRILLE_NOTIFICATION_SMS", valeur: "AFFECTATION_DOSSIER" },
    ]);

    const toutDecoche = basculerCase(sansRappel, "GRILLE_NOTIFICATION_SMS", "AFFECTATION_DOSSIER", [...EvenementPrestataire]);
    expect(colonnesModifiees(toutDecoche, CONFIGURATIONS)).toEqual([{ cle: "GRILLE_NOTIFICATION_SMS", valeur: "" }]);
  });

  it("garde l'ordre publié par le backend quand on coche", () => {
    const initiale = saisieInitiale(PRESTATAIRES, CONFIGURATIONS);
    const coche = basculerCase(initiale, "GRILLE_NOTIFICATION_SMS", "CONSTITUTION_VALIDEE", [...EvenementPrestataire]);
    expect(coche.GRILLE_NOTIFICATION_SMS).toEqual(["CONSTITUTION_VALIDEE", "RAPPEL_AUDIENCE", "AFFECTATION_DOSSIER"]);
  });

  it("dit si un canal est allumé par l'interrupteur de son public", () => {
    expect(canalActif(INTERNES, "OUTLOOK", CONFIGURATIONS)).toBe(true);
    expect(canalActif(INTERNES, "TEAMS", CONFIGURATIONS)).toBe(false);
    expect(canalActif(PRESTATAIRES, "WHATSAPP", CONFIGURATIONS)).toBe(false);
  });
});

function rendreGrille(modifiable: boolean) {
  return rendre(<GrilleNotifications configurations={CONFIGURATIONS} modifiable={modifiable} />);
}

describe("GrilleNotifications", () => {
  it("affiche une case par événement et par canal, cochée selon la configuration", () => {
    rendreGrille(true);

    expect(screen.getByRole("checkbox", { name: "Rappel d’audience par Teams" })).toBeChecked();
    expect(screen.getByRole("checkbox", { name: "Alarme arrivée à échéance par Teams" })).not.toBeChecked();
    expect(screen.getByRole("checkbox", { name: "Affectation à un dossier par SMS" })).toBeChecked();
    expect(screen.getByRole("checkbox", { name: "Frais rejetés par WhatsApp" })).not.toBeChecked();
    expect(screen.getAllByRole("checkbox")).toHaveLength(TypeAlerte.length * 2 + EvenementPrestataire.length * 3);
  });

  it("signale les canaux coupés sans masquer leur colonne", () => {
    rendreGrille(true);
    // Teams (internes) et WhatsApp (prestataires) sont coupés par leur interrupteur.
    expect(screen.getAllByText("Canal coupé")).toHaveLength(2);
  });

  it("n'envoie que la colonne modifiée, même vidée entièrement", async () => {
    rendreGrille(true);

    fireEvent.click(screen.getByRole("checkbox", { name: "Rappel d’audience par SMS" }));
    fireEvent.click(screen.getByRole("checkbox", { name: "Affectation à un dossier par SMS" }));
    fireEvent.click(screen.getByRole("button", { name: "Enregistrer la grille « Prestataires »" }));

    await waitFor(() => expect(mutateAsync).toHaveBeenCalledTimes(1));
    expect(mutateAsync).toHaveBeenCalledWith({ cle: "GRILLE_NOTIFICATION_SMS", valeur: "" });
  });

  it("en consultation seule, les cases sont figées et aucun bouton n'apparaît", () => {
    rendreGrille(false);

    expect(screen.getByRole("checkbox", { name: "Rappel d’audience par Teams" })).toBeDisabled();
    expect(screen.queryByRole("button")).toBeNull();
  });

  it("est traduite en anglais", () => {
    rendre(<GrilleNotifications configurations={CONFIGURATIONS} modifiable />, { langue: "en" });
    expect(screen.getByRole("heading", { name: "External notifications grid" })).toBeInTheDocument();
    expect(screen.getByRole("checkbox", { name: "Assigned to a case by Personal email" })).toBeChecked();
  });
});

describe("saisie d'un numéro de téléphone (étape 11)", () => {
  it("accepte un numéro camerounais sous ses trois écritures, séparateurs compris", () => {
    for (const saisie of ["650228936", "650 228 936", "650-228-936", "237650228936", "+237650228936", "+237 650 228 936"]) {
      expect(telephoneValide(saisie)).toBe(true);
    }
  });

  /** Les mobiles Camtel commencent eux aussi par 6 : 620 XX XX XX. */
  it("accepte les mobiles Camtel", () => {
    for (const saisie of ["620228936", "6 20 22 89 36", "+237 6 20 22 89 36"]) {
      expect(telephoneValide(saisie)).toBe(true);
    }
  });

  /** Les lignes fixes, en 2, ne reçoivent ni SMS ni WhatsApp. */
  it("refuse les lignes fixes", () => {
    for (const saisie of ["222228936", "+237 2 22 22 89 36"]) {
      expect(telephoneValide(saisie)).toBe(false);
    }
  });

  it("accepte un numéro étranger, indicatif obligatoire", () => {
    expect(telephoneValide("+33 6 12 34 56 78")).toBe(true);
    expect(telephoneValide("+241 01 23 45 67")).toBe(true);
    // Sans indicatif, il faudrait le deviner.
    expect(telephoneValide("33612345678")).toBe(false);
  });

  it("refuse un numéro camerounais trop court ou trop long, même avec l'indicatif", () => {
    for (const saisie of ["65022893", "6502289361", "+23765022893", "+2376502289361", "0650228936", "750228936", "abc"]) {
      expect(telephoneValide(saisie)).toBe(false);
    }
  });

  /** Un prestataire sans téléphone reste permis : le champ n'est pas obligatoire. */
  it("accepte l'absence de numéro", () => {
    expect(telephoneValide("")).toBe(true);
    expect(telephoneValide("   ")).toBe(true);
  });
});
