import { getTranslations } from "next-intl/server";

import { ParametresSysteme } from "@/components/modules/administration/parametres-systeme";
import { JournalSysteme } from "@/components/modules/administration/journal-systeme";
import { SupervisionAlertes } from "@/components/modules/administration/supervision-alertes";
import { peut } from "@/lib/rbac";
import { exigerCapacite } from "@/lib/serverAuth";

export async function generateMetadata() {
  const t = await getTranslations("configurations");
  return { title: t("titre") };
}

/**
 * Écran 41 — paramètres système. La lecture est ouverte à tous les profils internes (#47,
 * `ROLE_CONSULTATION`) : ces seuils expliquent le comportement de l'application, les cacher
 * n'aiderait personne. La modification reste au DJ seul (#48).
 */
export default async function PageConfigurations() {
  const session = await exigerCapacite("consulterConfigurations");
  return (
    <div className="flex flex-col gap-8">
      <ParametresSysteme modifiable={peut(session.roles, "administrerConfigurations")} />
      {/*
        Supervision du canal applicatif (Q-109). Elle tient sur cet écran parce que c'est celui de
        l'administration, mais elle est gardée **séparément** : lire un taux global, tous
        destinataires confondus, n'est pas la même chose que lire des seuils. Les paramètres sont
        ouverts à `ROLE_CONSULTATION` ; ce bloc ne l'est pas.
      */}
      {peut(session.roles, "superviserAlertes") ? <SupervisionAlertes /> : null}
      {/*
        Journal des actions système (Q-110). Il ferme la lacune ouverte par RG-DOS-06 : chaque
        modification était historisée, mais celles qui ne portent sur aucun dossier n'avaient aucun
        point de lecture. Sa place est ici parce que la grande majorité d'entre elles sont des
        modifications de paramètres — voici les réglages, voici qui les a changés.
      */}
      {peut(session.roles, "consulterJournalSysteme") ? <JournalSysteme /> : null}
    </div>
  );
}
