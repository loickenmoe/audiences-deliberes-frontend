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
 * Rédaction de la lettre de constitution (backend Q-124, amendant Q-115 B2).
 *
 * **Deux plumes, et c'est voulu.** Le juriste rédige ; le supérieur hiérarchique corrige avant de
 * signer. Jusqu'au 2026-10-06 il ne pouvait que lire, pour que la seconde signature garde son sens
 * - le métier a tranché l'inverse : il corrige plutôt que de renvoyer. Ce que la séparation des
 * plumes garantissait, la **traçabilité** le garantit : la lettre porte qui l'a écrite en dernier,
 * et une reprise par le SH est nommée comme telle, en haut de cette modale.
 *
 * `modifiable` vient du serveur - l'écran ne le déduit pas d'un statut qu'il aurait pu mal lire.
 *
 * **Une lettre signée ne se réécrit pas**, ni par le juriste ni par le SH. Elle est partie chez un
 * huissier et figure dans la GED : la retoucher ferait mentir la pièce. Le formulaire passe alors
 * en lecture seule, et le dit.
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

  // La lettre arrive par le réseau : on la recopie dans l'état local pour pouvoir l'éditer sans
  // écrire dans le cache de la requête, qui d'autres écrans partagent.
  useEffect(() => {
    if (requete.data) setSaisie(requete.data);
  }, [requete.data]);

  /*
   * `modifiable` dit « par moi », et vient du serveur (Q-126) : la lettre appartient à celui qui a
   * sollicité la constitution, le SH la corrige avant de signer, et une lettre signée ne se
   * retouche plus - pour personne. L'écran ne redouble pas la condition : une règle tenue à deux
   * endroits finit par diverger, et c'est le serveur qui a le dernier mot de toute façon.
   */
  const modifiable = saisie?.modifiable ?? false;

  function changer<C extends keyof LettreConstitution>(champ: C, valeur: LettreConstitution[C]) {
    setSaisie((precedente) => (precedente ? { ...precedente, [champ]: valeur } : precedente));
  }

  /**
   * Les segments du numéro sont édités séparément, comme la direction juridique l'a demandé : le
   * serveur les stocke d'un bloc, l'écran les découpe. Leur nombre varie d'un service à l'autre —
   * quatre sur le papier de la DRH, six sur celui du recouvrement.
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
            Qui a écrit la dernière version (N8). Depuis que le SH peut corriger avant de signer,
            le juriste doit le voir en ouvrant sa lettre - sans aller fouiller l'historique. La
            correction du SH est nommée comme telle : c'est le seul cas où la séparation des plumes
            a été franchie, et c'est ce que la traçabilité doit rendre visible.
          */}
          {saisie.redigeParNom ? (
            <p className="text-[length:var(--taille-xs)] text-texte-tertiaire">
              {saisie.redigeParProfil === "SH"
                ? t("redigeeParSh", { nom: saisie.redigeParNom })
                : t("redigeePar", { nom: saisie.redigeParNom })}
            </p>
          ) : null}

          {/* ── La ligne du numéro ─────────────────────────────────────────── */}
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
                // eslint-disable-next-line react/no-array-index-key -- un segment n'a pas d'identité propre
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

          {/* ── Le destinataire ────────────────────────────────────────────── */}
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
