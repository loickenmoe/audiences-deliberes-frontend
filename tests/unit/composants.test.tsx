import { screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { EtatChargement, EtatErreur, EtatVide } from "@/components/global/etats";
import { StatutChip } from "@/components/global/statut-chip";
import { Button } from "@/components/ui/button";
import { Champ, Input } from "@/components/ui/champ";
import { rendre as render } from "../utils/rendu";

describe("Button", () => {
  /**
   * Le point le plus facile à défaire par inadvertance : le rouge de marque n'est pas lisible en
   * texte et se confondrait avec le rouge d'erreur. L'action principale doit rester anthracite.
   */
  it("l'action principale est anthracite, jamais rouge", () => {
    render(<Button>Enregistrer</Button>);
    const bouton = screen.getByRole("button", { name: "Enregistrer" });

    expect(bouton.className).toContain("bg-anthracite");
    expect(bouton.className).not.toContain("bg-marque");
    expect(bouton.className).not.toContain("bg-danger");
  });

  /** Une suppression se signale par un contour, pas par un aplat : l'acte doit être délibéré. */
  it("l'action destructive est contournée, pas remplie", () => {
    render(<Button variante="destructive">Supprimer</Button>);
    const bouton = screen.getByRole("button", { name: "Supprimer" });

    expect(bouton.className).toContain("border-danger");
    expect(bouton.className).not.toContain("bg-danger ");
  });

  it("est de type button par défaut, pour ne pas soumettre un formulaire par accident", () => {
    render(<Button>Filtrer</Button>);
    expect(screen.getByRole("button", { name: "Filtrer" })).toHaveAttribute("type", "button");
  });
});

describe("états standards", () => {
  it("l'état vide annonce ce qui manque et propose une sortie", () => {
    render(
      <EtatVide
        titre="Aucun dossier"
        description="Aucun dossier ne correspond à ces filtres."
        action={<Button>Créer un dossier</Button>}
      />,
    );

    expect(screen.getByText("Aucun dossier")).toBeVisible();
    expect(screen.getByRole("button", { name: "Créer un dossier" })).toBeVisible();
  });

  /** Une erreur doit être annoncée aux technologies d'assistance, pas seulement colorée. */
  it("l'état d'erreur porte le rôle alert", () => {
    render(<EtatErreur message="Cette référence est déjà utilisée." />);

    const alerte = screen.getByRole("alert");
    expect(alerte).toBeVisible();
    expect(alerte).toHaveTextContent("Cette référence est déjà utilisée.");
  });

  it("le chargement est annoncé et masque son ossature décorative", () => {
    const { container } = render(<EtatChargement lignes={3} />);

    expect(screen.getByRole("status")).toBeInTheDocument();
    expect(screen.getByText("Chargement en cours")).toHaveClass("sr-only");
    expect(container.querySelectorAll('[aria-hidden="true"]')).toHaveLength(3);
  });
});

describe("bilinguisme des composants", () => {
  /**
   * Le seul moyen d'attraper un texte resté en dur : rendre le même composant dans les deux
   * langues et vérifier que la sortie change.
   */
  it("l'état de chargement s'annonce dans la langue active", () => {
    const { unmount } = render(<EtatChargement lignes={1} />, { langue: "fr" });
    expect(screen.getByText("Chargement en cours")).toBeInTheDocument();
    unmount();

    render(<EtatChargement lignes={1} />, { langue: "en" });
    expect(screen.getByText("Loading")).toBeInTheDocument();
  });

  it("le titre d'erreur par défaut suit la langue active", () => {
    const { unmount } = render(<EtatErreur />, { langue: "fr" });
    expect(screen.getByRole("alert")).toHaveTextContent("Le chargement a échoué");
    unmount();

    render(<EtatErreur />, { langue: "en" });
    expect(screen.getByRole("alert")).toHaveTextContent("Loading failed");
  });
});

describe("StatutChip", () => {
  /** La couleur double le libellé, elle ne le remplace pas : lisible sans percevoir la couleur. */
  it("affiche toujours un libellé textuel", () => {
    render(<StatutChip ton="danger">Rejetée</StatutChip>);
    expect(screen.getByText("Rejetée")).toBeVisible();
  });

  it("distingue le ton danger du ton neutre", () => {
    const { rerender } = render(<StatutChip ton="danger">Rejetée</StatutChip>);
    const danger = screen.getByText("Rejetée").className;

    rerender(<StatutChip>Déposée</StatutChip>);
    const neutre = screen.getByText("Déposée").className;

    expect(danger).not.toBe(neutre);
    expect(danger).toContain("text-danger");
  });
});

/**
 * `Champ` rattache au contrôle les paragraphes qui le décrivent (défaut corrigé le 2026-10-07).
 *
 * Les deux portaient déjà leur identifiant - `{id}-aide`, `{id}-erreur` - mais rien ne les reliait :
 * ils existaient pour qui voit l'écran et disparaissaient pour qui l'écoute, sur les 128 champs de
 * l'application. Le commentaire du composant affirmait pourtant le contraire.
 */
describe("Champ, rattachement de l'aide et de l'erreur", () => {
  it("relie l'aide au contrôle", () => {
    render(
      <Champ id="juridiction" label="Juridiction saisie" aide="Le tribunal saisi.">
        <Input id="juridiction" />
      </Champ>,
    );

    const controle = screen.getByLabelText("Juridiction saisie");
    const aide = screen.getByText("Le tribunal saisi.");
    expect(controle).toHaveAttribute("aria-describedby", aide.id);
  });

  /** L'erreur remplace l'aide : deux messages concurrents sous un champ en erreur se gênent. */
  it("relie l'erreur au contrôle, et l'aide s'efface", () => {
    render(
      <Champ id="juridiction" label="Juridiction saisie" aide="Le tribunal saisi." erreur="Champ requis">
        <Input id="juridiction" />
      </Champ>,
    );

    const controle = screen.getByLabelText("Juridiction saisie");
    const erreur = screen.getByText("Champ requis");
    expect(controle).toHaveAttribute("aria-describedby", erreur.id);
    expect(screen.queryByText("Le tribunal saisi.")).not.toBeInTheDocument();
  });

  /** Ce que l'appelant a posé lui-même est conservé : le nôtre s'y ajoute, il ne l'écrase pas. */
  it("conserve un aria-describedby déjà posé par l'appelant", () => {
    render(
      <>
        <p id="consigne-externe">Consigne posée ailleurs.</p>
        <Champ id="juridiction" label="Juridiction saisie" aide="Le tribunal saisi.">
          <Input id="juridiction" aria-describedby="consigne-externe" />
        </Champ>
      </>,
    );

    expect(screen.getByLabelText("Juridiction saisie")).toHaveAttribute(
      "aria-describedby",
      "consigne-externe juridiction-aide",
    );
  });

  it("n'ajoute rien quand il n'y a ni aide ni erreur", () => {
    render(
      <Champ id="juridiction" label="Juridiction saisie">
        <Input id="juridiction" />
      </Champ>,
    );

    expect(screen.getByLabelText("Juridiction saisie")).not.toHaveAttribute("aria-describedby");
  });
});
