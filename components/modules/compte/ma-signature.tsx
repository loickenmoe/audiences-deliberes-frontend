"use client";

import { Eye, Trash2 } from "lucide-react";
import { useTranslations } from "next-intl";
import { useEffect, useState } from "react";
import { toast } from "sonner";

import { EtatChargement, EtatErreur } from "@/components/global";
import { ApercuFichier } from "@/components/metier/apercu-fichier";
import { DateHeureValeur, DialogueConfirmation, Televersement } from "@/components/metier";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useEcritureSignature, useMaSignature, useMonImageSignature } from "@/hooks/useSignature";
import { messageErreur } from "@/lib/api/errors";
import { signatureService } from "@/services/signatureService";

/** Ce que la lettre sait apposer, et rien d'autre. */
const FORMATS = ["image/png", "image/jpeg"];
/** Large pour une signature scannée, étroit pour une photographie : le serveur applique la même. */
const TAILLE_MAX = 200_000;

/**
 * Ma signature enregistrée (N8, métier du 2026-10-03 puis du 2026-10-06).
 *
 * **Chacun dépose la sienne, et personne d'autre.** L'écran ne connaît aucun identifiant : il parle
 * de « ma » signature, et le serveur travaille sur la session. C'est la seule forme où une signature
 * garde un sens - celle qu'un tiers détient ne vaut déjà plus rien.
 *
 * **Ce qu'elle fait, et ce qu'elle ne fait pas.** Elle s'appose sur les lettres de constitution que
 * vous signez, à la place du nom à signer à la main. Elle **n'ajoute aucune valeur juridique** : ce
 * qui fait preuve, c'est la trace horodatée de votre signature dans l'application. L'écran le dit,
 * plutôt que de laisser croire le contraire - un utilisateur qui croirait tenir là une garantie
 * s'appuierait sur du vide.
 */
export function MaSignature() {
  const t = useTranslations("compte");
  const tc = useTranslations("commun");
  const etat = useMaSignature();
  const image = useMonImageSignature(etat.data?.deposee ?? false);
  const { deposer, retirer } = useEcritureSignature();
  const [retraitOuvert, setRetraitOuvert] = useState(false);
  const [apercuOuvert, setApercuOuvert] = useState(false);

  /*
   * La vignette s'affiche depuis une adresse `blob:` locale : l'appel porte le jeton, et une
   * balise `<img src>` pointant sur l'API ne l'emporterait pas. L'adresse retient le contenu en
   * mémoire tant qu'elle n'est pas libérée, d'où la libération à chaque changement et au démontage
   * - sans quoi chaque remplacement de signature en laisserait une derrière lui.
   */
  const contenu = image.data;
  const [vignette, setVignette] = useState<string | null>(null);
  useEffect(() => {
    if (!contenu) {
      setVignette(null);
      return;
    }
    const url = URL.createObjectURL(contenu);
    setVignette(url);
    return () => URL.revokeObjectURL(url);
  }, [contenu]);

  async function choisir(fichier: File | undefined) {
    if (!fichier) return;
    /*
     * Les deux mêmes refus que le serveur, dits ici : attendre un aller-retour pour apprendre qu'un
     * PDF n'est pas une image est une seconde perdue pour rien. Le serveur reste l'autorité.
     *
     * Le champ de téléversement parle le premier, et refuse sur l'**extension** - c'est la règle du
     * backend (Q-46). Ces contrôles-ci portent sur le **type** du contenu, celui que le serveur
     * vérifie pour la signature : ils rattrapent un fichier dont l'extension ment.
     */
    if (!FORMATS.includes(fichier.type)) {
      toast.error(t("formatRefuse"));
      return;
    }
    if (fichier.size > TAILLE_MAX) {
      toast.error(t("tropLourde"));
      return;
    }
    try {
      await deposer.mutateAsync(fichier);
      toast.success(t("deposee"));
    } catch (erreur) {
      toast.error(messageErreur(erreur));
    }
  }

  async function confirmerRetrait() {
    try {
      await retirer.mutateAsync();
      toast.success(t("retiree"));
      setRetraitOuvert(false);
    } catch (erreur) {
      toast.error(messageErreur(erreur));
    }
  }

  if (etat.isLoading) return <EtatChargement lignes={4} />;
  if (etat.error) return <EtatErreur message={messageErreur(etat.error)} />;

  const deposee = etat.data?.deposee ?? false;

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t("signatureTitre")}</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <p className="max-w-prose text-[length:var(--taille-sm)] text-texte-secondaire">
          {t("signatureDescription")}
        </p>
        {/*
          Dit à l'écran, pas seulement dans le code : un utilisateur qui croirait tenir là une
          garantie juridique s'appuierait sur du vide.
        */}
        <p className="max-w-prose text-[length:var(--taille-xs)] text-texte-tertiaire">
          {t("signaturePortee")}
        </p>

        {deposee ? (
          <div className="flex flex-col items-start gap-2">
            <div className="flex w-fit items-center rounded border border-bordure bg-surface p-3">
              {vignette ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={vignette} alt={t("apercu")} className="max-h-24" />
              ) : (
                <span className="text-[length:var(--taille-sm)] text-texte-tertiaire">
                  {tc("chargement")}
                </span>
              )}
            </div>
            {/*
              L'oeil, comme partout ailleurs dans l'application : la vignette montre que quelque
              chose est déposé, elle ne permet pas de vérifier le trait. Déposer une signature sans
              pouvoir la relire en grand reviendrait à signer les yeux fermés.
            */}
            <Button variante="secondaire" taille="sm" onClick={() => setApercuOuvert(true)}>
              <Eye size={14} aria-hidden />
              {t("voir")}
            </Button>
            {etat.data?.deposeeLe ? (
              <p className="text-[length:var(--taille-xs)] text-texte-tertiaire">
                {t("deposeeLe")} <DateHeureValeur valeur={etat.data.deposeeLe} />
              </p>
            ) : null}
          </div>
        ) : (
          <p className="text-[length:var(--taille-sm)] text-texte-secondaire">{t("aucune")}</p>
        )}

        {/*
          Le champ de téléversement maison : il porte son libellé, annonce ses formats et sa taille
          limite, et a déjà passé l'audit d'accessibilité. En refaire un ici referait aussi ses
          défauts.
        */}
        <Televersement
          nom="signature"
          label={deposee ? t("remplacer") : t("deposer")}
          formatsAcceptes={["png", "jpg", "jpeg"]}
          tailleMax={TAILLE_MAX}
          onChangement={(fichier) => void choisir(fichier ?? undefined)}
        />

        {deposee ? (
          <div>
            <Button variante="secondaire" onClick={() => setRetraitOuvert(true)}>
              <Trash2 size={15} aria-hidden />
              {t("retirer")}
            </Button>
          </div>
        ) : null}

        <p className="text-[length:var(--taille-xs)] text-texte-tertiaire">{t("formatsAdmis")}</p>
      </CardContent>

      {apercuOuvert ? (
        <ApercuFichier
          ouvert
          onFermeture={() => setApercuOuvert(false)}
          nomFichier={etat.data?.type === "image/jpeg" ? "signature.jpg" : "signature.png"}
          obtenir={() => signatureService.monImage()}
        />
      ) : null}

      {retraitOuvert ? (
        <DialogueConfirmation
          ouvert
          onFermeture={() => setRetraitOuvert(false)}
          onConfirmation={() => void confirmerRetrait()}
          titre={t("retraitTitre")}
          message={t("retraitMessage")}
          libelleConfirmation={t("retirer")}
          destructif
          enCours={retirer.isPending}
        />
      ) : null}
    </Card>
  );
}
