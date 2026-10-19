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

/** What the letter can display, and nothing else. */
const FORMATS = ["image/png", "image/jpeg"];
/** Wide for a scanned signature, narrow for a photo: the server applies the same limit. */
const TAILLE_MAX = 200_000;

/**
 * My saved signature.
 * Each user uploads only their own: the screen knows no id and the server works on the session.
 * It is placed on the representation letters the user signs, instead of a handwritten signature
 * field. It adds no legal value: the proof is the timestamped signing record in the application,
 * and the screen says so.
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
   * The thumbnail is shown from a local `blob:` URL because the call carries the token, which an
   * `<img src>` pointing at the API would not. The URL is revoked on each change and on unmount to
   * avoid leaking memory.
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
     * Same two checks as the server, done here to save a round trip; the server remains the
     * authority.
     * The upload field already rejects by extension; these checks are on the content type, which
     * the server verifies for signatures, and catch a file whose extension lies.
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
        {/* Stated on screen so the user does not assume a legal guarantee. */}
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
              Eye icon, as elsewhere in the application: the thumbnail is too small to check the
              signature, so it can be viewed full size.
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
          Reuses the shared upload field: it carries its label, announces formats and size limit,
          and is already accessibility-audited.
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
