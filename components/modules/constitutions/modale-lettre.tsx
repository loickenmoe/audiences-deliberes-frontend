"use client";

import { useTranslations } from "next-intl";
import { useEffect, useState } from "react";
import { toast } from "sonner";

import { EtatChargement } from "@/components/global";
import { Button } from "@/components/ui/button";
import { Champ, Input, Textarea } from "@/components/ui/champ";
import { Dialog } from "@/components/ui/dialog";
import { useLettreConstitution, useRedigerLettre } from "@/hooks/useConstitutions";
import { messageErreur } from "@/lib/api/errors";
import type { LettreConstitution } from "@/types/domaine";

/**
 * Representation letter editor.
 * The lawyer drafts; the line manager (SH) may correct before signing. Traceability records who
 * wrote the last version, and an SH revision is labelled as such at the top of this modal.
 * `modifiable` comes from the server; the screen does not derive it from a status.
 * A signed letter can no longer be edited by anyone (it has been sent and is stored in the DMS):
 * the form becomes read-only and says so.
 */
export function ModaleLettre({
  demandeId,
  ouvert,
  onFermeture,
}: {
  demandeId: number | null;
  ouvert: boolean;
  onFermeture: () => void;
}) {
  const t = useTranslations("constitutions");
  const tc = useTranslations("commun");
  const requete = useLettreConstitution(ouvert ? demandeId : null);
  const rediger = useRedigerLettre();
  const [saisie, setSaisie] = useState<LettreConstitution | null>(null);
  const [erreur, setErreur] = useState("");

  // The letter comes from the network: it is copied into local state so it can be edited without
  // writing to the query cache shared by other screens.
  useEffect(() => {
    if (requete.data) setSaisie(requete.data);
  }, [requete.data]);

  /*
   * `modifiable` means "by me" and comes from the server: the screen does not duplicate the rule,
   * since a rule kept in two places ends up diverging and the server has the final say anyway.
   */
  const modifiable = saisie?.modifiable ?? false;

  function changer<C extends keyof LettreConstitution>(champ: C, valeur: LettreConstitution[C]) {
    setSaisie((precedente) => (precedente ? { ...precedente, [champ]: valeur } : precedente));
  }

  /**
   * Number segments are edited separately: the server stores them as one block, the screen splits
   * them. Their count varies by department (e.g. four or six).
   */
  const segments = (saisie?.suffixeNumero ?? "").split("/");

  function changerSegment(index: number, valeur: string) {
    const suivants = [...segments];
    suivants[index] = valeur;
    changer("suffixeNumero", suivants.join("/"));
  }

  async function enregistrer() {
    if (!saisie || demandeId === null) return;
    setErreur("");
    try {
      await rediger.mutateAsync({
        demandeId,
        lettre: {
          numero: saisie.numero,
          suffixeNumero: saisie.suffixeNumero,
          lieu: saisie.lieu,
          destinataireNom: saisie.destinataireNom,
          destinataireQualite: saisie.destinataireQualite,
          destinataireVille: saisie.destinataireVille,
          concerne: saisie.concerne,
          objet: saisie.objet,
          corps: saisie.corps,
          signataire: saisie.signataire,
        },
      });
      toast.success(t("lettreEnregistree"));
      onFermeture();
    } catch (e) {
      setErreur(messageErreur(e));
    }
  }

  return (
    <Dialog
      ouvert={ouvert}
      onFermeture={onFermeture}
      titre={t("lettreTitre")}
      description={modifiable ? t("lettreDescription") : t("lettreLectureSeule")}
      pied={
        <>
          <Button variante="secondaire" onClick={onFermeture} disabled={rediger.isPending}>
            {modifiable ? tc("annuler") : tc("fermer")}
          </Button>
          {modifiable ? (
            <Button onClick={() => void enregistrer()} disabled={rediger.isPending}>
              {t("lettreEnregistrer")}
            </Button>
          ) : null}
        </>
      }
    >
      {requete.isLoading || !saisie ? (
        <EtatChargement lignes={6} />
      ) : (
        <div className="flex flex-col gap-4">
          {/*
            Who wrote the last version, so the lawyer sees an SH correction when opening the letter
            without digging into the history.
          */}
          {saisie.redigeParNom ? (
            <p className="text-[length:var(--taille-xs)] text-texte-tertiaire">
              {saisie.redigeParProfil === "SH"
                ? t("redigeeParSh", { nom: saisie.redigeParNom })
                : t("redigeePar", { nom: saisie.redigeParNom })}
            </p>
          ) : null}

          <fieldset className="flex flex-col gap-2">
            <legend className="text-[length:var(--taille-sm)] font-medium">{t("lettreNumeroTitre")}</legend>
            <p className="text-[length:var(--taille-xs)] text-texte-secondaire">
              {saisie.numero === null ? t("lettreNumeroALaSignature") : t("lettreNumeroAttribue")}
            </p>
            <div className="flex flex-wrap items-center gap-1">
              <span aria-hidden className="text-[length:var(--taille-sm)]">N°</span>
              <Input
                id="lettre-numero"
                placeholder={t("phLettreNumero")}
                aria-label={t("lettreNumero")}
                className="w-20"
                inputMode="numeric"
                value={saisie.numero ?? ""}
                disabled={!modifiable}
                onChange={(evenement) =>
                  changer("numero", evenement.target.value === "" ? null : Number(evenement.target.value))
                }
              />
              {segments.map((segment, index) => (
                // eslint-disable-next-line react/no-array-index-key -- a segment has no identity of its own
                <span key={index} className="flex items-center gap-1">
                  <span aria-hidden className="text-texte-secondaire">/</span>
                  <Input
                    id={`lettre-segment-${index}`}
                    aria-label={t("lettreSegment", { rang: index + 1 })}
                    className="w-28"
                    value={segment}
                    disabled={!modifiable}
                    onChange={(evenement) => changerSegment(index, evenement.target.value)}
                  />
                </span>
              ))}
            </div>
          </fieldset>

          <Champ id="lettre-lieu" label={t("lettreLieu")}>
            <Input
              id="lettre-lieu"
              placeholder={t("phLettreLieu")}
              value={saisie.lieu}
              disabled={!modifiable}
              onChange={(evenement) => changer("lieu", evenement.target.value)}
            />
          </Champ>

          <Champ id="lettre-destinataire" label={t("lettreDestinataire")}>
            <Input
              id="lettre-destinataire"
              placeholder={t("phLettreDestinataire")}
              value={saisie.destinataireNom ?? ""}
              disabled={!modifiable}
              onChange={(evenement) => changer("destinataireNom", evenement.target.value)}
            />
          </Champ>
          <Champ id="lettre-qualite" label={t("lettreQualite")}>
            <Input
              id="lettre-qualite"
              placeholder={t("phLettreQualite")}
              value={saisie.destinataireQualite ?? ""}
              disabled={!modifiable}
              onChange={(evenement) => changer("destinataireQualite", evenement.target.value)}
            />
          </Champ>
          <Champ id="lettre-ville" label={t("lettreVille")}>
            <Input
              id="lettre-ville"
              placeholder={t("phLettreVille")}
              value={saisie.destinataireVille ?? ""}
              disabled={!modifiable}
              onChange={(evenement) => changer("destinataireVille", evenement.target.value)}
            />
          </Champ>

          <Champ id="lettre-concerne" label={t("lettreConcerne")}>
            <Input
              id="lettre-concerne"
              placeholder={t("phLettreConcerne")}
              value={saisie.concerne ?? ""}
              disabled={!modifiable}
              onChange={(evenement) => changer("concerne", evenement.target.value)}
            />
          </Champ>
          <Champ id="lettre-objet" label={t("lettreObjet")} obligatoire>
            <Input
              id="lettre-objet"
              placeholder={t("phLettreObjet")}
              value={saisie.objet}
              disabled={!modifiable}
              onChange={(evenement) => changer("objet", evenement.target.value)}
            />
          </Champ>

          <Champ id="lettre-corps" label={t("lettreCorps")} obligatoire aide={t("lettreCorpsAide")}>
            <Textarea
              id="lettre-corps"
              placeholder={t("phLettreCorps")}
              rows={10}
              value={saisie.corps}
              disabled={!modifiable}
              onChange={(evenement) => changer("corps", evenement.target.value)}
            />
          </Champ>

          <Champ id="lettre-signataire" label={t("lettreSignataire")} obligatoire>
            <Input
              id="lettre-signataire"
              placeholder={t("phLettreSignataire")}
              value={saisie.signataire}
              disabled={!modifiable}
              onChange={(evenement) => changer("signataire", evenement.target.value)}
            />
          </Champ>

          {erreur ? (
            <p role="alert" className="text-[length:var(--taille-sm)] text-danger">
              {erreur}
            </p>
          ) : null}
        </div>
      )}
    </Dialog>
  );
}
