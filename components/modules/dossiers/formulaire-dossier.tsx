"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { ArrowLeft } from "lucide-react";
import { useTranslations } from "next-intl";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import { Controller, useForm } from "react-hook-form";
import { toast } from "sonner";
import { z } from "zod";

import { EtatChargement, EtatErreur } from "@/components/global";
import { CasesACocher, GardeSaisie, SelecteurCherchable } from "@/components/metier";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Champ, Input, Select, Textarea } from "@/components/ui/champ";
import { useClients } from "@/hooks/useClients";
import { useCreerDossier } from "@/hooks/useDossiers";
import { useIntervenants } from "@/hooks/useIntervenants";
import { useNaturesDossier, useTypesClientSensible, useUtilisateurs } from "@/hooks/useReferentiels";
import { appliquerErreurApi } from "@/lib/api/erreurs-formulaire";
import { messageErreur } from "@/lib/api/errors";
import { PiecesAJoindre, type PieceAJoindre } from "@/components/modules/dossiers/pieces-a-joindre";
import type { TypeDocument } from "@/lib/documents";
import { gedService } from "@/services/gedService";

/**
 * Écran 06 — création d'un dossier (US 1.1, FR-DOS-01).
 *
 * **Le formulaire s'adapte à la nature choisie, pas à une catégorie saisie.** Le backend déduit la
 * catégorie du référentiel (RG-DOS-02) et refuse une catégorie divergente ; la demander à
 * l'utilisateur créerait une contradiction possible pour aucun gain. Elle est donc dérivée ici et
 * seulement affichée.
 *
 * Cette dérivation décide des pièces exigées, en **ET** et non en OU (Q-11) :
 * · `RECOUVREMENT` → dossier de crédit d'origine **et** PV de transfert ;
 * · `EXPLOITATION_LITIGES` → référence d'incident de compte **et** éléments justificatifs.
 *
 * Le contrôle reste côté backend ; le rejouer ici évite un aller-retour pour une omission visible.
 */
const CHAMPS = [
  "reference",
  "nature",
  "juridictionSaisie",
  "clientId",
  "risqueEncouru",
  "dossierCreditOrigine",
  "pvTransfert",
  "incidentCompteReference",
  "elementsJustificatifs",
  "seuilMontant",
  "typeClientSensible",
  "juristesAffectes",
  "avocatsAffectes",
] as const;

export function FormulaireDossier({
  courrielUtilisateur = null,
}: {
  /** Courriel de l'utilisateur connecté : sert à le cocher d'office s'il est juriste. */
  courrielUtilisateur?: string | null;
} = {}) {
  const t = useTranslations("dossiers");
  const tc = useTranslations("commun");
  const tm = useTranslations("metier");
  const td = useTranslations("domaine");
  const tdoc = useTranslations("documents");
  const routeur = useRouter();
  const [pieces, setPieces] = useState<PieceAJoindre[]>([]);
  const [envoiPieces, setEnvoiPieces] = useState(false);
  const creer = useCreerDossier();

  const natures = useNaturesDossier();
  const typesSensibles = useTypesClientSensible();
  const juristes = useUtilisateurs("JURISTE");
  /*
   * Q-105 — la recherche remplace le « charger une grande page » : le champ n'affiche que ce que le
   * serveur renvoie pour la saisie en cours, et ne se tronque donc jamais en silence. C'est le même
   * câblage que la modale « Modifier l'affectation » de la fiche.
   */
  const [rechercheAvocat, setRechercheAvocat] = useState("");
  const avocats = useIntervenants({ type: "AVOCAT", nom: rechercheAvocat || undefined });
  // Les listes de sélection ne sont pas paginables : on charge une page large plutôt que d'imposer
  // une pagination dans un `<select>`. Si le volume devenait un problème, il faudrait un champ de
  // recherche côté serveur — pas un chargement plus gros.
  const clients = useClients({ page: 0, size: 200 });

  const schema = useMemo(
    () =>
      z
        .object({
          reference: z.string().trim().min(1, tm("champObligatoire")).max(50),
          nature: z.string().min(1, tm("champObligatoire")),
          juridictionSaisie: z.string().trim().min(1, tm("champObligatoire")).max(100),
          clientId: z.coerce.number().int().positive(tm("champObligatoire")),
          demandeur: z.string().optional(),
          defendeur: z.string().optional(),
          risqueEncouru: z.coerce.number().min(0, tm("champObligatoire")),
          recoursExerces: z.string().optional(),
          motifRenvoi: z.string().max(255).optional(),
          codeAgenceOrigine: z.string().max(20).optional(),
          codeAgenceContentieuse: z.string().max(20).optional(),
          dossierCreditOrigine: z.string().max(50).optional(),
          pvTransfert: z.string().max(255).optional(),
          incidentCompteReference: z.string().max(50).optional(),
          elementsJustificatifs: z.string().optional(),
          champAlarme: z.string().optional(),
          estSensible: z.boolean().optional(),
          seuilMontant: z.union([z.coerce.number().min(0), z.literal("")]).optional(),
          typeClientSensible: z.string().optional(),
          juristesAffectes: z.array(z.coerce.number()).min(1, tm("champObligatoire")),
          avocatsAffectes: z.array(z.coerce.number()).min(1, tm("champObligatoire")),
        })
        .superRefine((valeurs, contexte) => {
          const categorie = natures.data?.find((n) => n.libelle === valeurs.nature)?.categorie;

          if (categorie === "RECOUVREMENT") {
            if (!valeurs.dossierCreditOrigine?.trim()) {
              contexte.addIssue({
                code: "custom",
                path: ["dossierCreditOrigine"],
                message: tm("champObligatoire"),
              });
            }
            if (!valeurs.pvTransfert?.trim()) {
              contexte.addIssue({ code: "custom", path: ["pvTransfert"], message: tm("champObligatoire") });
            }
          } else if (categorie === "EXPLOITATION_LITIGES") {
            if (!valeurs.incidentCompteReference?.trim()) {
              contexte.addIssue({
                code: "custom",
                path: ["incidentCompteReference"],
                message: tm("champObligatoire"),
              });
            }
            if (!valeurs.elementsJustificatifs?.trim()) {
              contexte.addIssue({
                code: "custom",
                path: ["elementsJustificatifs"],
                message: tm("champObligatoire"),
              });
            }
          }

          // Un dossier sensible est une proposition : elle n'a de sens qu'accompagnée des deux
          // éléments que le DJ devra arbitrer.
          if (valeurs.estSensible) {
            if (valeurs.seuilMontant === "" || valeurs.seuilMontant === undefined) {
              contexte.addIssue({ code: "custom", path: ["seuilMontant"], message: tm("champObligatoire") });
            }
            if (!valeurs.typeClientSensible) {
              contexte.addIssue({
                code: "custom",
                path: ["typeClientSensible"],
                message: tm("champObligatoire"),
              });
            }
          }
        }),
    [natures.data, tm],
  );

  const {
    register,
    control,
    handleSubmit,
    watch,
    setError,
    setValue,
    getValues,
    formState: { errors, isSubmitting, isDirty },
  } = useForm<z.input<typeof schema>>({
    resolver: zodResolver(schema),
    defaultValues: {
      reference: "",
      nature: "",
      juridictionSaisie: "",
      estSensible: false,
      juristesAffectes: [],
      avocatsAffectes: [],
    },
  });

  /*
   * Le juriste qui crée le dossier en est affecté d'office — décision du porteur du projet
   * (2026-09-22) ; sa case reste décochable. Il est reconnu par son courriel : c'est le seul champ
   * commun à la session Keycloak et à la liste des juristes, et il y concorde par construction,
   * l'utilisateur étant créé depuis son jeton à sa première connexion (QF-16). Sans correspondance,
   * rien n'est coché : l'utilisateur coche lui-même. Le formulaire n'est pas marqué modifié — quitter
   * une page à peine ouverte ne doit pas déclencher la garde de saisie.
   */
  const preselectionFaite = useRef(false);
  useEffect(() => {
    if (preselectionFaite.current || !courrielUtilisateur || !juristes.data) return;
    preselectionFaite.current = true;
    const moi = juristes.data.find((u) => u.email?.toLowerCase() === courrielUtilisateur.toLowerCase());
    if (moi && getValues("juristesAffectes").length === 0) setValue("juristesAffectes", [moi.id]);
  }, [courrielUtilisateur, juristes.data, getValues, setValue]);

  const natureChoisie = watch("nature");
  const estSensible = watch("estSensible");
  const categorie = natures.data?.find((n) => n.libelle === natureChoisie)?.categorie;

  const soumettre = handleSubmit(async (valeurs) => {
    try {
      const cree = await creer.mutateAsync({
        reference: valeurs.reference,
        nature: valeurs.nature,
        juridictionSaisie: valeurs.juridictionSaisie,
        clientId: Number(valeurs.clientId),
        parties:
          valeurs.demandeur || valeurs.defendeur
            ? { demandeur: valeurs.demandeur || undefined, defendeur: valeurs.defendeur || undefined }
            : undefined,
        risqueEncouru: Number(valeurs.risqueEncouru),
        recoursExerces: valeurs.recoursExerces || undefined,
        motifRenvoi: valeurs.motifRenvoi || undefined,
        codeAgenceOrigine: valeurs.codeAgenceOrigine || undefined,
        codeAgenceContentieuse: valeurs.codeAgenceContentieuse || undefined,
        // N'envoyer que les pièces de la catégorie concernée : celles de l'autre n'ont pas de sens
        // ici et seraient stockées pour rien.
        dossierCreditOrigine:
          categorie === "RECOUVREMENT" ? valeurs.dossierCreditOrigine || undefined : undefined,
        pvTransfert: categorie === "RECOUVREMENT" ? valeurs.pvTransfert || undefined : undefined,
        incidentCompteReference:
          categorie === "EXPLOITATION_LITIGES" ? valeurs.incidentCompteReference || undefined : undefined,
        elementsJustificatifs:
          categorie === "EXPLOITATION_LITIGES" ? valeurs.elementsJustificatifs || undefined : undefined,
        champAlarme: valeurs.champAlarme || undefined,
        estSensible: valeurs.estSensible ?? false,
        seuilMontant: valeurs.estSensible ? Number(valeurs.seuilMontant) : undefined,
        typeClientSensible: valeurs.estSensible ? valeurs.typeClientSensible || undefined : undefined,
        juristesAffectes: valeurs.juristesAffectes.map(Number),
        avocatsAffectes: valeurs.avocatsAffectes.map(Number),
      });
      /*
       * Deuxième temps : les pièces, déposées en GED une fois le dossier créé — le dépôt exige son
       * identifiant. À ce stade **le dossier existe** : un échec de dépôt ne doit ni l'annuler ni
       * inviter à le recréer. On dépose tout ce qui peut l'être, puis on ouvre la fiche sur ses
       * documents en nommant les pièces à redéposer.
       */
      const echecs: string[] = [];
      if (pieces.length > 0) {
        setEnvoiPieces(true);
        for (const piece of pieces) {
          try {
            await gedService.deposer(cree.id, piece.type, piece.fichier);
          } catch {
            echecs.push(piece.fichier.name);
          }
        }
        setEnvoiPieces(false);
      }

      if (echecs.length > 0) {
        // Sans expiration : l'utilisateur doit pouvoir lire la liste des pièces à redéposer.
        toast.warning(tdoc("depotEchec", { nombre: echecs.length, noms: echecs.join(", ") }), {
          duration: Infinity,
        });
        routeur.push(`/dossiers/${cree.id}?onglet=documents`);
        return;
      }
      // Le dossier créé s'ouvre directement : c'est ce que l'utilisateur va consulter ensuite.
      routeur.push(`/dossiers/${cree.id}`);
    } catch (erreur) {
      // Le backend nomme lui-même le champ fautif depuis M16 (Q-70) : une référence en doublon
      // arrive avec `champ: "reference"` et se pose au bon endroit sans table de correspondance.
      if (!appliquerErreurApi(erreur, setError, CHAMPS)) {
        setError("root", { message: messageErreur(erreur) });
      }
    }
  });

  if (natures.isLoading || clients.isLoading || juristes.isLoading || avocats.isLoading) {
    return <EtatChargement lignes={10} />;
  }

  /*
   * Sans cette branche, une requête en échec laissait afficher le formulaire avec des listes
   * déroulantes vides : l'utilisateur aurait cru qu'aucun client n'existe, au lieu de savoir que le
   * chargement a échoué. Ces quatre listes ne sont pas facultatives — sans elles, aucun dossier
   * n'est créable.
   */
  const echec = natures.error ?? clients.error ?? juristes.error ?? avocats.error;
  if (echec) {
    return <EtatErreur message={messageErreur(echec)} />;
  }


  /**
   * Le champ de référence d'une pièce attendue, rendu par le bloc des pièces en tête de sa ligne.
   * Libellés, identifiants et validation sont ceux d'avant la fusion des deux blocs.
   */
  function champReference(type: TypeDocument) {
    switch (type) {
      case "DOSSIER_CREDIT":
        return (
          <Champ id="dossierCreditOrigine" label={t("champDossierCredit")} obligatoire erreur={errors.dossierCreditOrigine?.message}>
            <Input id="dossierCreditOrigine" enErreur={!!errors.dossierCreditOrigine} {...register("dossierCreditOrigine")} />
          </Champ>
        );
      case "PV_TRANSFERT":
        return (
          <Champ id="pvTransfert" label={t("champPvTransfert")} obligatoire erreur={errors.pvTransfert?.message}>
            <Input id="pvTransfert" enErreur={!!errors.pvTransfert} {...register("pvTransfert")} />
          </Champ>
        );
      case "INCIDENT_COMPTE":
        return (
          <Champ
            id="incidentCompteReference"
            label={t("champIncidentCompte")}
            obligatoire
            erreur={errors.incidentCompteReference?.message}
          >
            <Input
              id="incidentCompteReference"
              enErreur={!!errors.incidentCompteReference}
              {...register("incidentCompteReference")}
            />
          </Champ>
        );
      case "ELEMENT_JUSTIFICATIF":
        return (
          <Champ
            id="elementsJustificatifs"
            label={t("champElementsJustificatifs")}
            obligatoire
            erreur={errors.elementsJustificatifs?.message}
          >
            <Textarea
              id="elementsJustificatifs"
              rows={3}
              enErreur={!!errors.elementsJustificatifs}
              {...register("elementsJustificatifs")}
            />
          </Champ>
        );
      default:
        return null;
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <div>
        <Link
          href="/dossiers"
          className="inline-flex items-center gap-1.5 text-[length:var(--taille-sm)] text-texte-secondaire underline underline-offset-4"
        >
          <ArrowLeft size={14} aria-hidden />
          {t("titre")}
        </Link>
      </div>

      <header className="flex flex-col gap-1">
        <h1 className="text-[length:var(--taille-2xl)] font-semibold tracking-tight">
          {t("creerTitre")}
        </h1>
        <p className="max-w-prose text-texte-secondaire">{t("creerDescription")}</p>
      </header>

      <form onSubmit={soumettre} className="flex max-w-3xl flex-col gap-5">
        {errors.root ? (
          <p
            role="alert"
            className="rounded border border-danger/40 bg-danger-fond px-4 py-3 text-[length:var(--taille-sm)] text-danger"
          >
            {errors.root.message}
          </p>
        ) : null}

        <Card>
          <CardHeader>
            <CardTitle>{t("sectionIdentification")}</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-4 sm:grid-cols-2">
            <Champ
              id="reference"
              label={t("colonneReference")}
              obligatoire
              erreur={errors.reference?.message}
            >
              <Input id="reference" enErreur={!!errors.reference} {...register("reference")} />
            </Champ>

            <Champ
              id="nature"
              label={t("champNature")}
              obligatoire
              aide={t("aideNature")}
              erreur={errors.nature?.message}
            >
              <Select id="nature" enErreur={!!errors.nature} {...register("nature")}>
                <option value="">{t("choisirNature")}</option>
                {(natures.data ?? []).map((nature) => (
                  // La valeur est le **libellé** : c'est ce que le backend résout (RG-DOS-02).
                  <option key={nature.id} value={nature.libelle}>
                    {nature.libelle}
                  </option>
                ))}
              </Select>
            </Champ>

            <Champ
              id="juridictionSaisie"
              label={t("champJuridiction")}
              obligatoire
              erreur={errors.juridictionSaisie?.message}
            >
              <Input
                id="juridictionSaisie"
                enErreur={!!errors.juridictionSaisie}
                {...register("juridictionSaisie")}
              />
            </Champ>

            <Champ id="clientId" label={t("champClient")} obligatoire erreur={errors.clientId?.message}>
              <Select id="clientId" enErreur={!!errors.clientId} {...register("clientId")}>
                <option value="">{t("choisirClient")}</option>
                {(clients.data?.content ?? []).map((client) => (
                  <option key={client.id} value={client.id}>
                    {client.reference} - {client.nom}
                  </option>
                ))}
              </Select>
            </Champ>

            <Champ
              id="risqueEncouru"
              label={t("champRisque")}
              obligatoire
              erreur={errors.risqueEncouru?.message}
            >
              <Input
                id="risqueEncouru"
                type="number"
                min={0}
                step="1000"
                enErreur={!!errors.risqueEncouru}
                {...register("risqueEncouru")}
              />
            </Champ>

            {categorie ? (
              <div className="flex flex-col gap-1.5">
                <span className="text-[length:var(--taille-sm)] font-medium">
                  {t("categorieDeduite")}
                </span>
                <p className="flex h-10 items-center rounded border border-bordure bg-surface-attenuee px-3 text-[length:var(--taille-sm)]">
                  {td(`CategorieDossier.${categorie}` as never)}
                </p>
              </div>
            ) : null}

            {/* Ce n'est pas une pièce : il siégeait à tort dans le bloc des pièces (2026-09-22). */}
            <Champ id="champAlarme" label={t("champAlarme")}>
              <Input id="champAlarme" {...register("champAlarme")} />
            </Champ>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>{t("sectionParties")}</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-4 sm:grid-cols-2">
            <Champ id="demandeur" label={t("champDemandeur")}>
              <Input id="demandeur" {...register("demandeur")} />
            </Champ>
            <Champ id="defendeur" label={t("champDefendeur")}>
              <Input id="defendeur" {...register("defendeur")} />
            </Champ>
            <Champ id="recoursExerces" label={t("champRecours")}>
              <Input id="recoursExerces" {...register("recoursExerces")} />
            </Champ>
            <Champ id="motifRenvoi" label={t("champMotifRenvoi")}>
              <Input id="motifRenvoi" {...register("motifRenvoi")} />
            </Champ>
            <Champ id="codeAgenceOrigine" label={t("champAgenceOrigine")}>
              <Input id="codeAgenceOrigine" {...register("codeAgenceOrigine")} />
            </Champ>
            <Champ id="codeAgenceContentieuse" label={t("champAgenceContentieuse")}>
              <Input id="codeAgenceContentieuse" {...register("codeAgenceContentieuse")} />
            </Champ>
          </CardContent>
        </Card>

        {/*
          Les pièces n'apparaissent qu'une fois la nature choisie : afficher les quatre champs en
          permanence laisserait croire qu'ils sont tous exigés, alors que deux seulement le sont.
        */}
        {categorie ? (
          <Card>
            <CardHeader>
              <CardTitle>{t("sectionPieces")}</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col gap-4">
              <p className="text-[length:var(--taille-sm)] text-texte-secondaire">
                {categorie === "RECOUVREMENT" ? t("aidePiecesRecouvrement") : t("aidePiecesLitiges")}
              </p>

              {/*
                Un seul bloc (2026-09-22) : chaque pièce réunit sa référence, obligatoire, et son
                fichier, facultatif. Les références restent des champs de ce formulaire — enregistrés,
                validés et envoyés à la création comme avant ; le bloc des pièces ne fait que les
                placer. Les fichiers partent toujours après la création, dans la GED.
              */}
              <PiecesAJoindre categorie={categorie} onChangement={setPieces} reference={champReference} />
            </CardContent>
          </Card>
        ) : null}

        <Card>
          <CardHeader>
            <CardTitle>{t("sectionAffectation")}</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            <p className="text-[length:var(--taille-sm)] text-texte-secondaire">
              {t("aideAffectation")}
            </p>
            {/*
              Cases à cocher pour les juristes — une liste courte, qu'on veut voir d'un coup d'œil —,
              recherche avec jetons pour les avocats — un référentiel qui grandit (2026-09-22).
              Chacun se choisit et se retire d'un clic, sans touche à maintenir.
            */}
            <div className="grid gap-4 sm:grid-cols-2">
              <Controller
                control={control}
                name="juristesAffectes"
                render={({ field }) => (
                  <CasesACocher
                    label={t("champJuristes")}
                    obligatoire
                    valeur={(field.value ?? []).map(Number)}
                    onChangement={field.onChange}
                    chargement={juristes.isLoading}
                    erreur={errors.juristesAffectes?.message}
                    options={(juristes.data ?? []).map((utilisateur) => ({
                      id: utilisateur.id,
                      libelle:
                        [utilisateur.prenom, utilisateur.nom].filter(Boolean).join(" ") ||
                        utilisateur.email ||
                        `#${utilisateur.id}`,
                    }))}
                  />
                )}
              />

              <Controller
                control={control}
                name="avocatsAffectes"
                render={({ field }) => (
                  <div className="flex flex-col gap-1">
                    <SelecteurCherchable
                      id="avocatsAffectes"
                      label={t("champAvocats")}
                      obligatoire
                      multiple
                      valeur={(field.value ?? []).map(Number)}
                      onChangement={(valeur) => field.onChange(valeur as number[])}
                      options={(avocats.data?.content ?? []).map((avocat) => ({ id: avocat.id, libelle: avocat.nom }))}
                      onRecherche={setRechercheAvocat}
                      chargement={avocats.isLoading}
                    />
                    {errors.avocatsAffectes?.message ? (
                      <p className="text-[length:var(--taille-xs)] text-danger">{errors.avocatsAffectes.message}</p>
                    ) : null}
                  </div>
                )}
              />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>{t("sectionSensibilite")}</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            <label className="flex items-center gap-2 text-[length:var(--taille-sm)]">
              <input type="checkbox" {...register("estSensible")} />
              {t("champEstSensible")}
            </label>

            {estSensible ? (
              <>
                <p className="text-[length:var(--taille-sm)] text-texte-secondaire">
                  {t("aideSensibilite")}
                </p>
                <div className="grid gap-4 sm:grid-cols-2">
                  <Champ
                    id="seuilMontant"
                    label={t("champSeuilMontant")}
                    obligatoire
                    erreur={errors.seuilMontant?.message}
                  >
                    <Input
                      id="seuilMontant"
                      type="number"
                      min={0}
                      step="1000"
                      enErreur={!!errors.seuilMontant}
                      {...register("seuilMontant")}
                    />
                  </Champ>

                  <Champ
                    id="typeClientSensible"
                    label={t("champTypeClientSensible")}
                    obligatoire
                    erreur={errors.typeClientSensible?.message}
                  >
                    <Select
                      id="typeClientSensible"
                      enErreur={!!errors.typeClientSensible}
                      {...register("typeClientSensible")}
                    >
                      <option value="">{t("choisirType")}</option>
                      {(typesSensibles.data ?? []).map((type) => (
                        // Le backend attend le **code**, et le refuse désormais s'il est inconnu
                        // du référentiel (Q-73).
                        <option key={type.id} value={type.code}>
                          {type.libelle}
                        </option>
                      ))}
                    </Select>
                  </Champ>
                </div>
              </>
            ) : null}
          </CardContent>
        </Card>

        <div className="flex justify-end gap-3">
          <Link
            href="/dossiers"
            data-garde-saisie="ignorer"
            className="self-center text-[length:var(--taille-sm)] underline underline-offset-4"
          >
            {tc("annuler")}
          </Link>
          <Button type="submit" disabled={isSubmitting || creer.isPending || envoiPieces}>
            {envoiPieces ? tdoc("depotEnCours") : tc("enregistrer")}
          </Button>
        </div>
      </form>

      {/* La saisie la plus longue de l'application : la perdre par un clic de menu coûte cher. */}
      <GardeSaisie actif={isDirty && !isSubmitting} />
    </div>
  );
}
