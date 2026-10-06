"use client";

import {
  AlarmClock,
  CalendarDays,
  FolderOpen,
  Receipt,
  Scale,
  ThumbsDown,
  Trophy,
  TrendingUp,
  Wallet,
} from "lucide-react";
import { useTranslations } from "next-intl";
import Link from "next/link";
import type { ReactNode } from "react";

import { EtatChargement, EtatErreur } from "@/components/global";
import { MontantFcfa, Pourcentage } from "@/components/metier";
import { Button } from "@/components/ui/button";
import { useTableauDeBord } from "@/hooks/useReporting";
import { messageErreur } from "@/lib/api/errors";
import { peut } from "@/lib/rbac";
import type { TableauDeBord } from "@/types/domaine";

/**
 * Écran 39 — tableau de bord exécutif (FR-REP-02, US 8.5).
 *
 * Neuf indicateurs **temps réel, tous dossiers confondus** : le backend ne les restreint ni à une
 * période ni au portefeuille de l'appelant. Chacun porte une phrase qui dit ce qu'il compte —
 * « dossiers actifs » n'a pas le même sens pour tout le monde, et un chiffre qu'on interprète mal
 * pilote mal.
 *
 * **Gagnés, perdus et mixtes suivent le taux** (métier, 2026-10-03, observation 12) : un
 * pourcentage ne dit pas sur combien d'affaires il porte. Les trois sont affichés côte à côte et
 * **aucun n'est déduit** : un délibéré mixte n'est ni gagné ni perdu, et le ranger d'office aurait
 * fait lire un chiffre faux sans moyen de s'en apercevoir.
 *
 * Lecture réservée au DJ et à la DJA (backend Q-95).
 */
export function TableauDeBordExecutif({ roles }: { roles: readonly string[] }) {
  const t = useTranslations("tableauDeBord");
  const requete = useTableauDeBord();

  if (requete.isLoading) return <EtatChargement lignes={6} />;
  if (requete.error) {
    return (
      <EtatErreur
        message={messageErreur(requete.error)}
        action={
          <Button variante="secondaire" onClick={() => void requete.refetch()}>
            {t("titre")}
          </Button>
        }
      />
    );
  }

  const donnees = requete.data;
  if (!donnees) return null;

  return (
    <div className="flex flex-col gap-5">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div className="flex flex-col gap-1">
          <h1 className="text-[length:var(--taille-2xl)] font-semibold tracking-tight">{t("titre")}</h1>
          <p className="max-w-prose text-texte-secondaire">{t("description")}</p>
        </div>
        {/* Le DJ et la DJA portent `ROLE_JURISTE` depuis Q-81 : le rapport leur est accessible. */}
        {peut(roles, "genererRapport") ? (
          <Link
            href="/rapports"
            className="text-[length:var(--taille-sm)] underline underline-offset-4 hover:text-marque-texte"
          >
            {t("versRapports")}
          </Link>
        ) : null}
      </header>

      <dl className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        <Indicateur
          icone={<FolderOpen size={18} aria-hidden />}
          libelle={t("nbDossiersActifs")}
          aide={t("nbDossiersActifsAide")}
          valeur={<Nombre valeur={donnees.nbDossiersActifs} />}
        />
        <Indicateur
          icone={<CalendarDays size={18} aria-hidden />}
          libelle={t("nbAudiencesPlanifiees")}
          aide={t("nbAudiencesPlanifieesAide")}
          valeur={<Nombre valeur={donnees.nbAudiencesPlanifiees} />}
        />
        <Indicateur
          icone={<Receipt size={18} aria-hidden />}
          libelle={t("nbDemandesFraisEnAttente")}
          aide={t("nbDemandesFraisEnAttenteAide")}
          valeur={<Nombre valeur={donnees.nbDemandesFraisEnAttente} />}
        />
        <Indicateur
          icone={<AlarmClock size={18} aria-hidden />}
          libelle={t("nbProrogationsAlerte")}
          aide={t("nbProrogationsAlerteAide")}
          valeur={<Nombre valeur={donnees.nbProrogationsAlerte} />}
          alerte={donnees.nbProrogationsAlerte > 0}
        />
        <Indicateur
          icone={<TrendingUp size={18} aria-hidden />}
          libelle={t("tauxSuccesRecouvrement")}
          aide={t("tauxSuccesRecouvrementAide")}
          valeur={<Pourcentage valeur={donnees.tauxSuccesRecouvrement} />}
        />
        <Indicateur
          icone={<Trophy size={18} aria-hidden />}
          libelle={t("nbLitigesGagnes")}
          aide={t("nbLitigesGagnesAide")}
          valeur={<Nombre valeur={donnees.nbLitigesGagnes} />}
        />
        <Indicateur
          icone={<ThumbsDown size={18} aria-hidden />}
          libelle={t("nbLitigesPerdus")}
          aide={t("nbLitigesPerdusAide")}
          valeur={<Nombre valeur={donnees.nbLitigesPerdus} />}
        />
        <Indicateur
          icone={<Scale size={18} aria-hidden />}
          libelle={t("nbLitigesMixtes")}
          aide={t("nbLitigesMixtesAide")}
          valeur={<Nombre valeur={donnees.nbLitigesMixtes} />}
        />
        <Indicateur
          icone={<Wallet size={18} aria-hidden />}
          libelle={t("provisionsReprises")}
          aide={t("provisionsReprisesAide")}
          valeur={<MontantFcfa valeur={donnees.provisionsReprises} />}
        />
      </dl>
    </div>
  );
}

/** Les compteurs sont des entiers : les afficher en `data-nombres` aligne les colonnes. */
function Nombre({ valeur }: { valeur: number }) {
  return <span data-nombres>{valeur}</span>;
}

function Indicateur({
  icone,
  libelle,
  aide,
  valeur,
  alerte = false,
}: {
  icone: ReactNode;
  libelle: string;
  aide: string;
  valeur: ReactNode;
  /** Un compteur d'alertes non nul se signale — la couleur double le chiffre, elle ne le remplace pas. */
  alerte?: boolean;
}) {
  return (
    <div className="flex flex-col gap-2 rounded-lg border border-bordure bg-surface p-4">
      <dt className="flex items-center gap-2 text-[length:var(--taille-sm)] font-medium text-texte-secondaire">
        <span className={alerte ? "text-attention" : "text-texte-tertiaire"}>{icone}</span>
        {libelle}
      </dt>
      <dd className="flex flex-col gap-1">
        <span
          className={`text-[length:var(--taille-2xl)] font-semibold tracking-tight ${alerte ? "text-attention" : ""}`}
        >
          {valeur}
        </span>
        <span className="text-[length:var(--taille-xs)] text-texte-tertiaire">{aide}</span>
      </dd>
    </div>
  );
}

export type { TableauDeBord };
