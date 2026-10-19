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
import { CasesACocher, GardeSaisie, SelecteurAgence, SelecteurCherchable } from "@/components/metier";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Champ, Input, Select, Textarea } from "@/components/ui/champ";
import { useClients } from "@/hooks/useClients";
import { useCreerDossier } from "@/hooks/useDossiers";
import { useIntervenants } from "@/hooks/useIntervenants";
import { useNaturesDossier, useTypesClientSensible, useUtilisateurs } from "@/hooks/useReferentiels";
import { appliquerErreurApi } from "@/lib/api/erreurs-formulaire";
import { messageErreur } from "@/lib/api/errors";
import { ListeParties } from "@/components/modules/dossiers/liste-parties";
import { PiecesAJoindre, type PieceAJoindre } from "@/components/modules/dossiers/pieces-a-joindre";
import { piecesDeCategorie, type TypeDocument } from "@/lib/documents";
import { gedService } from "@/services/gedService";

/**
 * Screen 06 - case creation (US 1.1, FR-DOS-01).
 * The form adapts to the selected nature: the backend derives the category from the reference data
 * (RG-DOS-02) and rejects a mismatch, so the category is derived and only displayed here.
 * The category decides the required documents (both, not either):
 * · `RECOUVREMENT` → original credit file and transfer report;
 * · `EXPLOITATION_LITIGES` → account incident reference and supporting evidence.
 * The backend still checks; repeating it here avoids a round trip for a visible omission.
 */
const CHAMPS = [
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
  /** Email of the logged-in user: used to pre-check them if they are a lawyer. */
  courrielUtilisateur?: string | null;
} = {}) {
  const t = useTranslations("dossiers");
  const tc = useTranslations("commun");
  const tm = useTranslations("metier");
  const td = useTranslations("domaine");
  const tdoc = useTranslations("documents");
  const routeur = useRouter();
  const [pieces, setPieces] = useState<PieceAJoindre[]>([]);
  /*
   * Expected documents still missing a file. Flagged only after a save attempt, not before: a form
   * that is all red before being filled in is unreadable.
   */
  const [piecesManquantes, setPiecesManquantes] = useState<readonly TypeDocument[]>([]);
  const [envoiPieces, setEnvoiPieces] = useState(false);
  const creer = useCreerDossier();

  const natures = useNaturesDossier();
  const typesSensibles = useTypesClientSensible();
  const juristes = useUtilisateurs("JURISTE");
  /*
   * Server-side search instead of loading a large page: the field only shows what the server
   * returns for the current input, so it is never silently truncated. Same wiring as the case
   * page's "Edit assignment" modal.
   */
  const [rechercheAvocat, setRechercheAvocat] = useState("");
  const avocats = useIntervenants({ type: "AVOCAT", nom: rechercheAvocat || undefined });
  // Selection lists are not paginated: a large page is loaded rather than paginating a `<select>`.
  // If volume became an issue, a server-side search field would be needed, not a bigger load.
  const clients = useClients({ page: 0, size: 200 });

  const schema = useMemo(
    () =>
      z
        .object({
          nature: z.string().min(1, tm("champObligatoire")),
          juridictionSaisie: z.string().trim().min(1, tm("champObligatoire")).max(100),
          clientId: z.coerce.number().int().positive(tm("champObligatoire")),
          // At least one of each, several allowed.
          demandeurs: z
            .array(z.object({ nom: z.string().trim().min(1, tm("champObligatoire")).max(255) }))
            .min(1, tm("champObligatoire")),
          defendeurs: z
            .array(z.object({ nom: z.string().trim().min(1, tm("champObligatoire")).max(255) }))
            .min(1, tm("champObligatoire")),
          risqueEncouru: z.coerce.number().min(0, tm("champObligatoire")),
          recoursExerces: z.string().optional(),
          motifRenvoi: z.string().max(255).optional(),
          // Required: the code comes from the branch reference list and is no longer typed in. The
          // litigation branch code stays optional, since a case is not always transferred.
          codeAgenceOrigine: z.string().min(1, tm("champObligatoire")).max(20),
          codeAgenceContentieuse: z.string().max(20).optional(),
          dossierCreditOrigine: z.string().max(50).optional(),
          pvTransfert: z.string().max(255).optional(),
          incidentCompteReference: z.string().max(50).optional(),
          elementsJustificatifs: z.string().optional(),
          estSensible: z.boolean().optional(),
          seuilMontant: z.union([z.coerce.number().min(0), z.literal("")]).optional(),
          typeClientSensible: z.string().optional(),
          juristesAffectes: z.array(z.coerce.number()).min(1, tm("champObligatoire")),
          avocatsAffectes: z.array(z.coerce.number()).min(1, tm("champObligatoire")),
        })
        .superRefine((valeurs, contexte) => {
          /*
           * Conditional references are not required: the attached files are. That check is done on
           * the files at save time, outside this schema, since files are not form fields.
           */

          // A sensitive case is a proposal: it only makes sense with the two elements the DJ will
          // arbitrate.
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
    // The schema does not depend on the nature reference data: conditional references are not
    // required, and the category no longer drives any validation here.
    [tm],
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
      nature: "",
      juridictionSaisie: "",
      // One empty row on each side: the form opens on what it expects, rather than on an empty
      // block where the user would have to guess an "Add" button exists.
      demandeurs: [{ nom: "" }],
      defendeurs: [{ nom: "" }],
      // Empty rather than absent: the picker receives a string, and the zod resolver reports
      // "required field" instead of "expected string, received undefined".
      codeAgenceOrigine: "",
      codeAgenceContentieuse: "",
      estSensible: false,
      juristesAffectes: [],
      avocatsAffectes: [],
    },
  });

  /*
   * The lawyer creating the case is assigned by default (the box can be unchecked). They are
   * matched by email, the only field shared by the Keycloak session and the lawyer list, which
   * match since the user is created from their token on first login. Without a match nothing is
   * checked. The form is not marked dirty, so leaving a freshly opened page does not trigger the
   * input guard.
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
    /*
     * Documents first: no point creating the case to find out it lacks required documents. This
     * check cannot live in the schema (files are not form fields) nor on the server, which only
     * receives them after creation, so the screen alone enforces it.
     */
    if (categorie) {
      const deposees = new Set(pieces.map((piece) => piece.type));
      const manquantes = piecesDeCategorie(categorie).filter((type) => !deposees.has(type));
      setPiecesManquantes(manquantes);
      if (manquantes.length > 0) {
        toast.error(tdoc("piecesManquantes"));
        return;
      }
    }

    try {
      const cree = await creer.mutateAsync({
        nature: valeurs.nature,
        juridictionSaisie: valeurs.juridictionSaisie,
        clientId: Number(valeurs.clientId),
        parties: {
          demandeurs: valeurs.demandeurs.map((partie) => partie.nom.trim()),
          defendeurs: valeurs.defendeurs.map((partie) => partie.nom.trim()),
        },
        risqueEncouru: Number(valeurs.risqueEncouru),
        recoursExerces: valeurs.recoursExerces || undefined,
        motifRenvoi: valeurs.motifRenvoi || undefined,
        codeAgenceOrigine: valeurs.codeAgenceOrigine,
        codeAgenceContentieuse: valeurs.codeAgenceContentieuse || undefined,
        // Only send the documents of the relevant category: the others are meaningless here and
        // would be stored for nothing.
        dossierCreditOrigine:
          categorie === "RECOUVREMENT" ? valeurs.dossierCreditOrigine || undefined : undefined,
        pvTransfert: categorie === "RECOUVREMENT" ? valeurs.pvTransfert || undefined : undefined,
        incidentCompteReference:
          categorie === "EXPLOITATION_LITIGES" ? valeurs.incidentCompteReference || undefined : undefined,
        elementsJustificatifs:
          categorie === "EXPLOITATION_LITIGES" ? valeurs.elementsJustificatifs || undefined : undefined,
        estSensible: valeurs.estSensible ?? false,
        seuilMontant: valeurs.estSensible ? Number(valeurs.seuilMontant) : undefined,
        typeClientSensible: valeurs.estSensible ? valeurs.typeClientSensible || undefined : undefined,
        juristesAffectes: valeurs.juristesAffectes.map(Number),
        avocatsAffectes: valeurs.avocatsAffectes.map(Number),
      });
      /*
       * Second step: documents are uploaded to the DMS once the case exists (the upload needs its
       * id). At this point the case exists: an upload failure must neither cancel it nor invite
       * re-creating it.
       * Upload everything possible, then open the case on its documents, naming those to upload
       * again.
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
        // No expiry: the user must be able to read the list of documents to upload again.
        toast.warning(tdoc("depotEchec", { nombre: echecs.length, noms: echecs.join(", ") }), {
          duration: Infinity,
        });
        routeur.push(`/dossiers/${cree.id}?onglet=documents`);
        return;
      }
      // The reference is assigned by the server: announcing it is the only way for the author to
      // know under which number the case was opened.
      toast.success(t("dossierCree", { reference: cree.reference }));
      // The created case opens directly: it is what the user will look at next.
      routeur.push(`/dossiers/${cree.id}`);
    } catch (erreur) {
      // The backend names the faulty field itself, so the error lands in the right place without a
      // mapping table.
      if (!appliquerErreurApi(erreur, setError, CHAMPS)) {
        setError("root", { message: messageErreur(erreur) });
      }
    }
  });

  if (natures.isLoading || clients.isLoading || juristes.isLoading || avocats.isLoading) {
    return <EtatChargement lignes={10} />;
  }

  /*
   * Without this branch, a failed request would show the form with empty dropdowns and the user
   * would think no client exists. These four lists are mandatory: without them no case can be
   * created.
   */
  const echec = natures.error ?? clients.error ?? juristes.error ?? avocats.error;
  if (echec) {
    return <EtatErreur message={messageErreur(echec)} />;
  }


  /**
   * Reference field of an expected document, rendered by the documents block at the start of its
   * row.
   */
  /*
   * References naming each document. No asterisk: they are optional, the neighbouring file is
   * required.
   */
  function champReference(type: TypeDocument) {
    switch (type) {
      case "DOSSIER_CREDIT":
        return (
          <Champ
            id="dossierCreditOrigine"
            label={t("champDossierCredit")}
            erreur={errors.dossierCreditOrigine?.message}
          >
            <Input
              id="dossierCreditOrigine"
              placeholder={t("placeholderDossierCredit")}
              enErreur={!!errors.dossierCreditOrigine}
              {...register("dossierCreditOrigine")}
            />
          </Champ>
        );
      case "PV_TRANSFERT":
        return (
          <Champ
            id="pvTransfert"
            label={t("champPvTransfert")}
            erreur={errors.pvTransfert?.message}
          >
            <Input
              id="pvTransfert"
              placeholder={t("placeholderPvTransfert")}
              enErreur={!!errors.pvTransfert}
              {...register("pvTransfert")}
            />
          </Champ>
        );
      case "INCIDENT_COMPTE":
        return (
          <Champ
            id="incidentCompteReference"
            label={t("champIncidentCompte")}
            erreur={errors.incidentCompteReference?.message}
          >
            <Input
              id="incidentCompteReference"
              placeholder={t("placeholderIncidentCompte")}
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
            erreur={errors.elementsJustificatifs?.message}
          >
            <Textarea
              id="elementsJustificatifs"
              rows={3}
              placeholder={t("placeholderElementsJustificatifs")}
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
            {/*
              The reference is not entered: the server assigns it (DOS-2026-0001) and the
              confirmation shows it on creation.
            */}
            <Champ
              id="nature"
              label={t("champNature")}
              obligatoire
              erreur={errors.nature?.message}
            >
              <Select id="nature" enErreur={!!errors.nature} {...register("nature")}>
                <option value="">{t("choisirNature")}</option>
                {(natures.data ?? []).map((nature) => (
                  // The value is the **label**: that is what the backend resolves (RG-DOS-02).
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
                placeholder={t("placeholderJuridiction")}
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
                placeholder={t("placeholderRisque")}
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

            {/*
              No free-text "alarm" field here: actual alarms live in the `alarme` table, with a due
              date and a recipient.
            */}
            <p className="text-[length:var(--taille-xs)] text-texte-tertiaire sm:col-span-2">
              {t("renvoiAlarmes")}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>{t("sectionParties")}</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-4 sm:grid-cols-2">
            <div className="sm:col-span-2 grid gap-4 sm:grid-cols-2">
              <ListeParties
                nom="demandeurs"
                label={t("champDemandeurs")}
                placeholder={t("placeholderDemandeurs")}
                libelleAjout={t("ajouterDemandeur")}
                control={control}
                register={register}
                errors={errors}
              />
              <ListeParties
                nom="defendeurs"
                label={t("champDefendeurs")}
                placeholder={t("placeholderDefendeurs")}
                libelleAjout={t("ajouterDefendeur")}
                control={control}
                register={register}
                errors={errors}
              />
            </div>
            <Champ id="recoursExerces" label={t("champRecours")}>
              <Input
                id="recoursExerces"
                placeholder={t("placeholderRecours")}
                {...register("recoursExerces")}
              />
            </Champ>
            <Champ id="motifRenvoi" label={t("champMotifRenvoi")}>
              <Input
                id="motifRenvoi"
                placeholder={t("placeholderMotifRenvoi")}
                {...register("motifRenvoi")}
              />
            </Champ>
            {/*
              Both branch codes come from the branch reference list, shown as "code · name · city"
              with the address as a second line to tell homonymous branches apart.
            */}
            <Controller
              control={control}
              name="codeAgenceOrigine"
              render={({ field }) => (
                <div className="flex flex-col gap-1">
                  <SelecteurAgence
                    id="codeAgenceOrigine"
                    label={t("champAgenceOrigine")}
                    obligatoire
                    valeur={field.value}
                    onChangement={(code) => field.onChange(code ?? "")}
                  />
                  {errors.codeAgenceOrigine?.message ? (
                    <p className="text-[length:var(--taille-xs)] text-danger">
                      {errors.codeAgenceOrigine.message}
                    </p>
                  ) : null}
                </div>
              )}
            />
            <Controller
              control={control}
              name="codeAgenceContentieuse"
              render={({ field }) => (
                <SelecteurAgence
                  id="codeAgenceContentieuse"
                  label={t("champAgenceContentieuse")}
                  valeur={field.value}
                  onChangement={(code) => field.onChange(code ?? "")}
                />
              )}
            />
          </CardContent>
        </Card>

        {/*
          Documents only appear once the nature is chosen: always showing the four fields would
          suggest they are all required, while only two are.
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
                A single block: each document combines its reference and its file. References remain
                form fields, validated and sent at creation; the documents block only lays them out.
                Files are uploaded to the DMS after creation.
              */}
              <PiecesAJoindre
                categorie={categorie}
                onChangement={setPieces}
                reference={champReference}
                manquantes={piecesManquantes}
              />
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
              Checkboxes for lawyers (a short list to see at a glance), search with chips for
              counsel (a growing reference list).
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
                      placeholder={t("phSeuilMontant")}
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
                        // The backend expects the **code** and rejects it if it is not in the
                        // reference list.
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

      {/* The longest form of the application: losing it through a menu click is costly. */}
      <GardeSaisie actif={isDirty && !isSubmitting} />
    </div>
  );
}
