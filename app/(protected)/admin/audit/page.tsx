import { getTranslations } from "next-intl/server";

import { ConsultationAudit } from "@/components/modules/audit/consultation-audit";
import { exigerCapacite } from "@/lib/serverAuth";

export async function generateMetadata() {
  const t = await getTranslations("audit");
  return { title: t("titre") };
}

/**
 * Écran 43 — audit des actions historisées (backend Q-112). DJ et DJA.
 *
 * **Pourquoi un écran à part, et pas un bloc sur la Configuration.** Ce sont deux tâches
 * différentes : administrer — lire un réglage, le changer — et enquêter — remonter le temps, croiser
 * auteur, période et nature. Le journal de Q-110 vivait sous les paramètres faute de mieux ; il
 * déménage ici, où il n'est plus qu'un cas particulier (périmètre « hors dossier »).
 *
 * La garde est `consulterAudit`, **distincte** d'`administrerConfigurations` : lire l'activité
 * nommée d'un collègue n'est pas écrire un seuil, et un assouplissement futur de l'une ne doit pas
 * déplacer l'autre.
 */
export default async function PageAudit() {
  await exigerCapacite("consulterAudit");
  return <ConsultationAudit />;
}
