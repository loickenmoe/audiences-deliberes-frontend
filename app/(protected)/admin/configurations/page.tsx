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
 * Screen 41 - system settings. Readable by every internal profile (#47, `ROLE_CONSULTATION`):
 * these thresholds explain the application's behaviour. Editing remains DJ-only (#48).
 */
export default async function PageConfigurations() {
  const session = await exigerCapacite("consulterConfigurations");
  return (
    <div className="flex flex-col gap-8">
      <ParametresSysteme modifiable={peut(session.roles, "administrerConfigurations")} />
      {/*
        In-app channel supervision lives on this administration screen but is guarded
        **separately**: reading a global rate across all recipients is not the same as reading
        thresholds. Settings are open to `ROLE_CONSULTATION`; this block is not.
      */}
      {peut(session.roles, "superviserAlertes") ? <SupervisionAlertes /> : null}
      {/*
        External notification supervision. Same guard as above: these rows carry recipients'
        contact details and provider errors, which the backend reserves to the DJ and DJA.
      */}
      {peut(session.roles, "superviserAlertes") ? <SupervisionNotifications /> : null}
    </div>
  );
}
