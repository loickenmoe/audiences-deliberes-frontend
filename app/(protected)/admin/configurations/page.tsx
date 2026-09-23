import { getTranslations } from "next-intl/server";

import { ParametresSysteme } from "@/components/modules/administration/parametres-systeme";
import { SupervisionAlertes } from "@/components/modules/administration/supervision-alertes";
import { SupervisionNotifications } from "@/components/modules/administration/supervision-notifications";
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
        Supervision des notifications externes (D17). Même garde que ci-dessus : ces lignes portent
        les coordonnées des destinataires et les erreurs des fournisseurs, que le backend réserve au
        DJ et à la DJA.
      */}
      {peut(session.roles, "superviserAlertes") ? <SupervisionNotifications /> : null}
    </div>
  );
}
