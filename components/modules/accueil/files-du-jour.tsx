"use client";

import type { LucideIcon } from "lucide-react";
import { Bell, FileSignature, FolderOpen, Gavel, Receipt, Trash2 } from "lucide-react";
import { useTranslations } from "next-intl";
import Link from "next/link";
import type { ReactNode } from "react";

import { Skeleton } from "@/components/ui/skeleton";
import { TAILLE_COMPTEUR } from "@/hooks/const";
import { useNombreNotificationsATraiter } from "@/hooks/useAlertes";
import { useConstitutions } from "@/hooks/useConstitutions";
import { useDossiers } from "@/hooks/useDossiers";
import { useDemandesFrais } from "@/hooks/useFrais";
import { useDemandesSuppression } from "@/hooks/useGed";
import { usePublications } from "@/hooks/usePublications";
import { peut, profilPrincipal, type Capacite } from "@/lib/rbac";
import { cn } from "@/lib/utils";

/**
 * Files de travail de l'accueil (écran 02).
 *
 * **Ce que cet écran remplace.** Jusqu'ici, l'accueil affichait la liste des identifiants de
 * capacités en police à chasse fixe — une vue de mise au point, utile pendant la construction du
 * socle, sans valeur pour un juriste. Chaque profil trouve désormais ce qui **l'attend**, avec le
 * compte et le lien direct vers la file concernée.
 *
 * **Une carte par capacité, jamais par rôle.** Le DJ porte `ROLE_JURISTE` depuis Q-81 : raisonner
 * par rôle afficherait des files incohérentes. Les capacités viennent de `lib/rbac.ts`, dérivé des
 * `@PreAuthorize` du backend — la même source que la navigation.
 *
 * **Chaque carte interroge son propre compte**, sur une page d'un seul élément : `totalElements`
 * suffit, et une carte lente n'empêche pas les autres de s'afficher. Ce n'était vrai qu'en
 * intention jusqu'à Q-100 — quatre cartes rapatriaient en fait une page entière, soit jusqu'à vingt
 * lignes complètes chacune, pour n'afficher qu'un nombre. Les hooks de React interdisant
 * un appel conditionnel, chaque file est un composant distinct, monté seulement si la capacité est
 * accordée.
 */
export function FilesDuJour({ roles }: { roles: readonly string[] }) {
  const t = useTranslations("accueil");
  const profil = profilPrincipal(roles);

  const cartes: ReactNode[] = [];
  const si = (capacite: Capacite, carte: ReactNode) => {
    if (peut(roles, capacite)) cartes.push(carte);
  };

  si("consulterFrais", <FileFraisAControler key="frais" roles={roles} />);
  si("validerPublication", <FilePublicationsAValider key="publications" />);
  si("signerConstitution", <FileConstitutionsASigner key="constitutions" />);
  si("arbitrerSuppressions", <FileSuppressions key="suppressions" />);
  si("consulterDossiers", <FileMesDossiers key="dossiers" />);
  cartes.push(<FileNotifications key="notifications" />);

  return (
    <section className="flex flex-col gap-3">
      <h2 className="text-[length:var(--taille-lg)] font-semibold">{t("filesTitre")}</h2>
      <p className="max-w-prose text-[length:var(--taille-sm)] text-texte-secondaire">
        {profil ? t("filesDescription") : t("filesDescriptionSansProfil")}
      </p>
      <ul className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">{cartes}</ul>
    </section>
  );
}

/**
 * Une file : un compte, un libellé, un lien. Le compte est mis en avant, parce que c'est lui qui
 * décide si l'on clique ; `attention` ne se déclenche qu'au-delà de zéro — un compteur à zéro est
 * une bonne nouvelle, pas une alerte.
 */
function Carte({
  icone: Icone,
  titre,
  aide,
  compte,
  chargement,
  href,
}: {
  icone: LucideIcon;
  titre: string;
  aide: string;
  compte: number | undefined;
  chargement: boolean;
  href: string;
}) {
  const aTraiter = (compte ?? 0) > 0;
  return (
    <li>
      <Link
        href={href}
        className="flex h-full flex-col gap-2 rounded-lg border border-bordure bg-surface p-4 transition-colors hover:border-bordure-forte hover:bg-surface-attenuee focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-anthracite"
      >
        <span className="flex items-center gap-2 text-[length:var(--taille-sm)] font-medium text-texte-secondaire">
          <Icone aria-hidden size={18} className={aTraiter ? "text-attention" : "text-texte-tertiaire"} />
          {titre}
        </span>
        {chargement ? (
          <Skeleton className="h-8 w-12" />
        ) : (
          <span
            data-nombres
            className={cn(
              "text-[length:var(--taille-2xl)] font-semibold tracking-tight",
              aTraiter && "text-attention",
            )}
          >
            {compte ?? 0}
          </span>
        )}
        <span className="text-[length:var(--taille-xs)] text-texte-tertiaire">{aide}</span>
      </Link>
    </li>
  );
}

/**
 * L'Assistante contrôle la conformité d'une demande déposée ; la DJA en contrôle l'opportunité ; le
 * DJ et la DJA valident conjointement. Chacun voit donc l'étape dont **il** a la charge — afficher
 * la même file à tout le monde aurait renvoyé chacun vers le travail d'un autre.
 */
function FileFraisAControler({ roles }: { roles: readonly string[] }) {
  const t = useTranslations("accueil");
  const profil = profilPrincipal(roles);
  const statut = profil === "ROLE_ASSISTANTE" ? "DEPOSEE" : profil === "ROLE_DJA" ? "CONFORMITE" : "OPPORTUNITE";
  const requete = useDemandesFrais(statut, 0, TAILLE_COMPTEUR);
  return (
    <Carte
      icone={Receipt}
      titre={t(`fraisTitre.${statut}` as never)}
      aide={t("fraisAide")}
      compte={requete.data?.totalElements}
      chargement={requete.isLoading}
      href="/frais"
    />
  );
}

function FilePublicationsAValider() {
  const t = useTranslations("accueil");
  const requete = usePublications({ statut: "DEPOSE", page: 0, size: TAILLE_COMPTEUR });
  return (
    <Carte
      icone={FileSignature}
      titre={t("publicationsTitre")}
      aide={t("publicationsAide")}
      compte={requete.data?.totalElements}
      chargement={requete.isLoading}
      href="/publications"
    />
  );
}

function FileConstitutionsASigner() {
  const t = useTranslations("accueil");
  const requete = useConstitutions("EN_ATTENTE", 0, TAILLE_COMPTEUR);
  return (
    <Carte
      icone={Gavel}
      titre={t("constitutionsTitre")}
      aide={t("constitutionsAide")}
      compte={requete.data?.totalElements}
      chargement={requete.isLoading}
      href="/constitutions"
    />
  );
}

function FileSuppressions() {
  const t = useTranslations("accueil");
  const requete = useDemandesSuppression("EN_ATTENTE", 0, TAILLE_COMPTEUR);
  return (
    <Carte
      icone={Trash2}
      titre={t("suppressionsTitre")}
      aide={t("suppressionsAide")}
      compte={requete.data?.totalElements}
      chargement={requete.isLoading}
      href="/ged/demandes-suppression"
    />
  );
}

/** `mesDossiers` se résout sur l'utilisateur authentifié côté backend : aucun identifiant à passer. */
function FileMesDossiers() {
  const t = useTranslations("accueil");
  const requete = useDossiers({ mesDossiers: true, page: 0, size: TAILLE_COMPTEUR });
  return (
    <Carte
      icone={FolderOpen}
      titre={t("dossiersTitre")}
      aide={t("dossiersAide")}
      compte={requete.data?.totalElements}
      chargement={requete.isLoading}
      href="/dossiers?mesDossiers=true"
    />
  );
}

/** Ouverte à tous, avocat compris : c'est le seul écran que chacun partage. */
function FileNotifications() {
  const t = useTranslations("accueil");
  const requete = useNombreNotificationsATraiter();
  return (
    <Carte
      icone={Bell}
      titre={t("notificationsTitre")}
      aide={t("notificationsAide")}
      compte={requete.data}
      chargement={requete.isLoading}
      href="/notifications"
    />
  );
}
