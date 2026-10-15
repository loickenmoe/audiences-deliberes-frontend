"use client";

import {
  AlarmClock,
  CalendarDays,
  CircleCheckBig,
  FolderOpen,
  Receipt,
  Scale,
  ThumbsDown,
  Trophy,
  Wallet,
} from "lucide-react";
import { useTranslations } from "next-intl";
import Link from "next/link";
import { useState, type ReactNode } from "react";

import { EtatChargement, EtatErreur } from "@/components/global";
import { MontantFcfa } from "@/components/metier";
import { DetailIndicateurModale } from "@/components/modules/reporting/detail-indicateur";
import { Button } from "@/components/ui/button";
import { Champ, Select } from "@/components/ui/champ";
import { useTableauDeBord } from "@/hooks/useReporting";
import { useFiltresUrl } from "@/hooks/useFiltresUrl";
import { messageErreur } from "@/lib/api/errors";
import { peut } from "@/lib/rbac";
import type { IndicateurTableauDeBord, TableauDeBord } from "@/types/domaine";
import { CategorieDossier } from "@/types/enums";

/**
 * Écran 39 — tableau de bord exécutif (FR-REP-02, US 8.5).
 *
 * Neuf indicateurs **temps réel, tous dossiers confondus** : le backend ne les restreint ni à une
 * période ni au portefeuille de l'appelant. Chacun porte une phrase qui dit ce qu'il compte —
 * « dossiers actifs » n'a pas le même sens pour tout le monde, et un chiffre qu'on interprète mal
 * pilote mal.
 *
 * **Des nombres, pas un pourcentage** (métier, 2026-10-06). L'écran portait un « taux de succès du
 * recouvrement » ; il porte désormais ce que ce taux résumait : les litiges **gagnés**, **perdus**
 * et **mixtes**. Un pourcentage ne dit pas sur combien d'affaires il porte, et les trois nombres le
 * disent sans calcul. **Aucun n'est déduit** : un délibéré mixte n'est ni gagné ni perdu, et le
 * ranger d'office aurait fait lire un chiffre faux sans moyen de s'en apercevoir.
 *
 * Le **rapport périodique** (écran 40) garde son taux : borné à une période et exporté, il se lit
 * autrement qu'un indicateur de pilotage temps réel.
 *
 * Lecture réservée au DJ et à la DJA (backend Q-95).
 */
export function TableauDeBordExecutif({ roles }: { roles: readonly string[] }) {
  const t = useTranslations("tableauDeBord");
  const tCategorie = useTranslations("domaine.CategorieDossier");
  /*
   * Le périmètre vit dans l'URL (Q-138) : un lien vers « le tableau de bord du recouvrement » se
   * partage, et un rechargement ne ramène pas l'utilisateur sur « toutes catégories » sans qu'il
   * l'ait demandé. **Toutes catégories par défaut** - c'est ce que l'écran montrait avant, et
   * personne n'est surpris le premier matin.
   */
  const { filtres, definirFiltre } = useFiltresUrl({ categorie: "" });
  const perimetre = (CategorieDossier as readonly string[]).includes(filtres.categorie)
    ? (filtres.categorie as CategorieDossier)
    : undefined;
  const requete = useTableauDeBord(perimetre);

  /*
   * Le bloc dont on regarde le détail (Q-137). Son libellé voyage avec lui : la modale le répète en
   * titre, et l'utilisateur doit retrouver le mot sur lequel il a cliqué.
   *
   * **Déclaré avant les retours anticipés**, et pas seulement par goût : un `useState` placé après
   * un `if (…) return` ne s'exécute pas au même rang d'un rendu à l'autre, ce que React interdit.
   */
  const [ouvert, setOuvert] = useState<{
    indicateur: IndicateurTableauDeBord;
    libelle: string;
  } | null>(null);

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
        <div className="flex flex-wrap items-end gap-4">
          {/*
            Le périmètre commande les neuf indicateurs **et** leur détail. Il est posé dans
            l'en-tête, avant les chiffres : lu après, il laisserait le temps de se tromper sur ce
            qu'on vient de voir.
          */}
          <Champ id="tdb-perimetre" label={t("perimetre")} aide={t("perimetreAide")} className="w-64">
            <Select
              id="tdb-perimetre"
              value={filtres.categorie}
              onChange={(evenement) => definirFiltre("categorie", evenement.target.value)}
            >
              <option value="">{t("perimetreToutes")}</option>
              {CategorieDossier.map((categorie) => (
                <option key={categorie} value={categorie}>
                  {tCategorie(categorie)}
                </option>
              ))}
            </Select>
          </Champ>
          {/* Le DJ et la DJA portent `ROLE_JURISTE` depuis Q-81 : le rapport leur est accessible. */}
          {peut(roles, "genererRapport") ? (
            <Link
              href="/rapports"
              className="pb-2 text-[length:var(--taille-sm)] underline underline-offset-4 hover:text-marque-texte"
            >
              {t("versRapports")}
            </Link>
          ) : null}
        </div>
      </header>

      <dl className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        <Indicateur
          icone={<FolderOpen size={18} aria-hidden />}
          libelle={t("nbDossiersActifs")}
          aide={t("nbDossiersActifsAide")}
          indicateur="DOSSIERS_ACTIFS"
          onDetail={setOuvert}
          valeur={<Nombre valeur={donnees.nbDossiersActifs} />}
        />
        {/* Posé juste après les dossiers actifs : il en est le complément, et se lit avec lui. */}
        <Indicateur
          icone={<CircleCheckBig size={18} aria-hidden />}
          libelle={t("nbAffairesVidees")}
          aide={t("nbAffairesVideesAide")}
          indicateur="AFFAIRES_VIDEES"
          onDetail={setOuvert}
          valeur={<Nombre valeur={donnees.nbAffairesVidees} />}
        />
        <Indicateur
          icone={<CalendarDays size={18} aria-hidden />}
          libelle={t("nbAudiencesPlanifiees")}
          aide={t("nbAudiencesPlanifieesAide")}
          indicateur="AUDIENCES_PLANIFIEES"
          onDetail={setOuvert}
          valeur={<Nombre valeur={donnees.nbAudiencesPlanifiees} />}
        />
        <Indicateur
          icone={<Receipt size={18} aria-hidden />}
          libelle={t("nbDemandesFraisEnAttente")}
          aide={t("nbDemandesFraisEnAttenteAide")}
          indicateur="FRAIS_EN_ATTENTE"
          onDetail={setOuvert}
          valeur={<Nombre valeur={donnees.nbDemandesFraisEnAttente} />}
        />
        <Indicateur
          icone={<AlarmClock size={18} aria-hidden />}
          libelle={t("nbProrogationsAlerte")}
          aide={t("nbProrogationsAlerteAide")}
          indicateur="PROROGATIONS_ALERTE"
          onDetail={setOuvert}
          valeur={<Nombre valeur={donnees.nbProrogationsAlerte} />}
          alerte={donnees.nbProrogationsAlerte > 0}
        />
        <Indicateur
          icone={<Trophy size={18} aria-hidden />}
          libelle={t("nbLitigesGagnes")}
          aide={t("nbLitigesGagnesAide")}
          indicateur="LITIGES_GAGNES"
          onDetail={setOuvert}
          valeur={<Nombre valeur={donnees.nbLitigesGagnes} />}
        />
        <Indicateur
          icone={<ThumbsDown size={18} aria-hidden />}
          libelle={t("nbLitigesPerdus")}
          aide={t("nbLitigesPerdusAide")}
          indicateur="LITIGES_PERDUS"
          onDetail={setOuvert}
          valeur={<Nombre valeur={donnees.nbLitigesPerdus} />}
        />
        <Indicateur
          icone={<Scale size={18} aria-hidden />}
          libelle={t("nbLitigesMixtes")}
          aide={t("nbLitigesMixtesAide")}
          indicateur="DECISIONS_MIXTES"
          onDetail={setOuvert}
          valeur={<Nombre valeur={donnees.nbLitigesMixtes} />}
        />
        <Indicateur
          icone={<Wallet size={18} aria-hidden />}
          libelle={t("provisionsReprises")}
          aide={t("provisionsReprisesAide")}
          indicateur="PROVISIONS_REPRISES"
          onDetail={setOuvert}
          valeur={<MontantFcfa valeur={donnees.provisionsReprises} />}
        />
      </dl>

      <DetailIndicateurModale
        indicateur={ouvert?.indicateur ?? null}
        libelle={ouvert?.libelle ?? ""}
        categorie={perimetre}
        onFermeture={() => setOuvert(null)}
      />
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
  indicateur,
  onDetail,
}: {
  icone: ReactNode;
  libelle: string;
  aide: string;
  valeur: ReactNode;
  /** Un compteur d'alertes non nul se signale — la couleur double le chiffre, elle ne le remplace pas. */
  alerte?: boolean;
  /** Renseigné, le bloc s'ouvre sur le détail de ce qu'il compte (Q-137). */
  indicateur?: IndicateurTableauDeBord;
  onDetail?: (choix: { indicateur: IndicateurTableauDeBord; libelle: string }) => void;
}) {
  const tDetail = useTranslations("detailIndicateur");
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
        {/*
          Un bouton nommé, et non le bloc entier rendu cliquable. Un `<div>` qui réagit au clic au
          milieu d'une liste de définitions n'est ni atteignable au clavier ni annoncé comme une
          action ; et un nombre cliquable s'annoncerait « 12 », sans dire ce qu'il ouvre. Le nom
          accessible porte l'indicateur, parce que neuf boutons « Voir le détail » sur un même écran
          ne se distinguent pas autrement.
        */}
        {indicateur && onDetail ? (
          <button
            type="button"
            className="self-start text-[length:var(--taille-xs)] text-lien underline underline-offset-4 hover:no-underline"
            onClick={() => onDetail({ indicateur, libelle })}
            aria-label={tDetail("voirDetailDe", { libelle })}
          >
            {tDetail("voirDetail")}
          </button>
        ) : null}
      </dd>
    </div>
  );
}

export type { TableauDeBord };
