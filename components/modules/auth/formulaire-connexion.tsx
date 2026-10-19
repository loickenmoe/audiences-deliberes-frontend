"use client";

import { Eye, EyeOff } from "lucide-react";
import { useTranslations } from "next-intl";
import { useActionState, useState } from "react";
import { useFormStatus } from "react-dom";

import { Button } from "@/components/ui/button";
import { connexion, type EtatConnexion } from "@/lib/actions/connexion";

const ETAT_INITIAL: EtatConnexion = {};

const CHAMP =
  "h-11 w-full rounded border border-bordure-forte bg-surface px-3 text-[length:var(--taille-base)] outline-none";

function BoutonSoumettre() {
  const { pending } = useFormStatus();
  const t = useTranslations("connexion");
  return (
    <Button type="submit" taille="lg" className="w-full" disabled={pending}>
      {pending ? t("enCours") : t("action")}
    </Button>
  );
}

/**
 * Login form.
 * Fields are sent to a server action: the password is never stored in React state nor in the
 * browser bundle. It goes from the field to the Next.js server, which presents it to Keycloak, and
 * is not kept anywhere.
 * The action returns a message key, never text: the component translates it in the active language.
 */
export function FormulaireConnexion({ messageInitial }: { messageInitial?: string | null }) {
  const [etat, action] = useActionState(connexion, ETAT_INITIAL);
  const [motDePasseVisible, setMotDePasseVisible] = useState(false);
  const t = useTranslations("connexion");

  const message = etat.cleErreur ? t(etat.cleErreur) : (messageInitial ?? null);
  const libelleBascule = motDePasseVisible ? t("masquerMotDePasse") : t("afficherMotDePasse");

  return (
    <form action={action} className="mt-5 flex flex-col gap-3">
      {message ? (
        <p
          role="alert"
          className="rounded border border-danger/40 bg-danger-fond px-4 py-3 text-[length:var(--taille-sm)] text-danger"
        >
          {message}
        </p>
      ) : null}

      <div className="flex flex-col gap-1.5">
        <label htmlFor="identifiant" className="text-[length:var(--taille-sm)] font-medium">
          {t("identifiant")}
        </label>
        <input
          id="identifiant"
          name="identifiant"
          type="text"
          autoComplete="username"
          autoCapitalize="none"
          spellCheck={false}
          required
          className={CHAMP}
        />
      </div>

      <div className="flex flex-col gap-1.5">
        <label htmlFor="motDePasse" className="text-[length:var(--taille-sm)] font-medium">
          {t("motDePasse")}
        </label>
        <div className="relative">
          <input
            id="motDePasse"
            name="motDePasse"
            /** Visibility toggle so the user can check what they typed before submitting. */
            type={motDePasseVisible ? "text" : "password"}
            autoComplete="current-password"
            required
            className={`${CHAMP} pr-11`}
          />
          <button
            type="button"
            onClick={() => setMotDePasseVisible((visible) => !visible)}
            aria-label={libelleBascule}
            aria-pressed={motDePasseVisible}
            title={libelleBascule}
            className="absolute inset-y-0 right-0 flex w-11 items-center justify-center rounded-r text-texte-tertiaire transition-colors hover:text-texte"
          >
            {motDePasseVisible ? <EyeOff size={17} aria-hidden /> : <Eye size={17} aria-hidden />}
          </button>
        </div>
      </div>

      <div className="mt-1.5">
        <BoutonSoumettre />
      </div>
    </form>
  );
}
