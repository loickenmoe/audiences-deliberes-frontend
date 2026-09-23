"use client";

import { useTranslations } from "next-intl";
import { useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Table, TableWrapper, Tbody, Td, Th, Thead, Tr } from "@/components/ui/table";
import { useModifierConfiguration } from "@/hooks/useConfigurations";
import { messageErreur } from "@/lib/api/errors";
import {
  basculerCase,
  canalActif,
  colonnesModifiees,
  SECTIONS_GRILLE,
  saisieInitiale,
  trouver,
  type SectionGrille,
} from "@/lib/notifications";
import type { ConfigurationSysteme } from "@/types/domaine";

/**
 * Grille des notifications externes (backend Q-118) : pour chaque public, quels événements partent
 * sur quel canal. Une colonne est une clé de configuration ; les lignes sont les valeurs acceptées
 * que le backend publie pour elle.
 *
 * Un canal coupé garde sa colonne, grisée et toujours modifiable : on prépare la grille avant
 * d'allumer le canal, et on le rallume tel qu'on l'avait laissé.
 */
export function GrilleNotifications({
  configurations,
  modifiable,
}: {
  configurations: ConfigurationSysteme[];
  modifiable: boolean;
}) {
  const t = useTranslations("grilleNotifications");
  const sections = SECTIONS_GRILLE.filter((section) =>
    section.colonnes.every(({ cle }) => trouver(configurations, cle)),
  );
  if (sections.length === 0) return null;

  return (
    <section className="flex flex-col gap-4" aria-labelledby="titre-grille-notifications">
      <header className="flex flex-col gap-1">
        <h2 id="titre-grille-notifications" className="text-[length:var(--taille-lg)] font-semibold tracking-tight">
          {t("titre")}
        </h2>
        <p className="max-w-prose text-[length:var(--taille-sm)] text-texte-secondaire">{t("description")}</p>
      </header>
      {sections.map((section) => (
        <SectionGrilleNotifications
          key={section.identifiant}
          section={section}
          configurations={configurations}
          modifiable={modifiable}
        />
      ))}
    </section>
  );
}

function SectionGrilleNotifications({
  section,
  configurations,
  modifiable,
}: {
  section: SectionGrille;
  configurations: ConfigurationSysteme[];
  modifiable: boolean;
}) {
  const t = useTranslations("grilleNotifications");
  const td = useTranslations("domaine");
  const modifier = useModifierConfiguration();
  const [saisie, setSaisie] = useState(() => saisieInitiale(section, configurations));
  const [enCours, setEnCours] = useState(false);

  // Les colonnes d'un même public partagent leurs valeurs acceptées : la première suffit.
  const premiere = section.colonnes[0];
  const evenements = (premiere && trouver(configurations, premiere.cle)?.valeursPossibles) ?? [];
  const modifiees = colonnesModifiees(saisie, configurations);
  const enumEvenement = section.identifiant === "internes" ? "TypeAlerte" : "EvenementPrestataire";
  const enumCanal = section.identifiant === "internes" ? "CanalAlerte" : "CanalPrestataire";
  const libelleEvenement = (code: string) => td(`${enumEvenement}.${code}` as never);
  const libelleCanal = (code: string) => td(`${enumCanal}.${code}` as never);
  const idTitre = `grille-${section.identifiant}`;

  /** Une clé après l'autre : chacune prend effet et s'historise seule, et l'on sait laquelle a échoué. */
  const enregistrer = async () => {
    setEnCours(true);
    try {
      for (const { cle, valeur } of modifiees) {
        try {
          await modifier.mutateAsync({ cle, valeur });
        } catch (erreur) {
          toast.error(messageErreur(erreur));
          return;
        }
      }
      toast.success(t("succes"));
    } finally {
      setEnCours(false);
    }
  };

  return (
    <div className="flex flex-col gap-3">
      <h3 id={idTitre} className="font-medium">
        {t(`sections.${section.identifiant}`)}
      </h3>
      <TableWrapper>
        <Table aria-labelledby={idTitre}>
          <Thead>
            <Tr>
              <Th>{t("evenement")}</Th>
              {section.colonnes.map(({ cle, canal }) => {
                const actif = canalActif(section, canal, configurations);
                return (
                  <Th key={cle} className="text-center">
                    <span className="flex flex-col items-center gap-0.5">
                      <span>{libelleCanal(canal)}</span>
                      {!actif ? (
                        <span className="normal-case tracking-normal text-texte-tertiaire">{t("canalCoupe")}</span>
                      ) : null}
                    </span>
                  </Th>
                );
              })}
            </Tr>
          </Thead>
          <Tbody>
            {evenements.map((evenement) => (
              <Tr key={evenement}>
                <Td>{libelleEvenement(evenement)}</Td>
                {section.colonnes.map(({ cle, canal }) => {
                  const actif = canalActif(section, canal, configurations);
                  return (
                    <Td key={cle} className={actif ? "text-center" : "text-center opacity-60"}>
                      <input
                        type="checkbox"
                        aria-label={t("case", { evenement: libelleEvenement(evenement), canal: libelleCanal(canal) })}
                        checked={(saisie[cle] ?? []).includes(evenement)}
                        disabled={!modifiable || enCours}
                        onChange={() => setSaisie((courante) => basculerCase(courante, cle, evenement, evenements))}
                        className="size-4 accent-[color:var(--afb-anthracite)]"
                      />
                    </Td>
                  );
                })}
              </Tr>
            ))}
          </Tbody>
        </Table>
      </TableWrapper>
      {modifiable ? (
        <div className="flex items-center justify-end gap-2">
          {modifiees.length > 0 ? (
            <Button
              variante="discrete"
              taille="sm"
              disabled={enCours}
              onClick={() => setSaisie(saisieInitiale(section, configurations))}
            >
              {t("annuler")}
            </Button>
          ) : null}
          <Button taille="sm" disabled={modifiees.length === 0 || enCours} onClick={() => void enregistrer()}>
            {t("enregistrer", { section: t(`sections.${section.identifiant}`) })}
          </Button>
        </div>
      ) : null}
    </div>
  );
}
