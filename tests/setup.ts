import "@testing-library/jest-dom/vitest";

import { cleanup } from "@testing-library/react";
import { afterEach } from "vitest";

/**
 * jsdom n'implémente pas `<dialog>` : `showModal()` et `close()` y sont absents, et tout composant
 * modal lèverait une exception au montage.
 *
 * On fournit le minimum comportemental — bascule de `open` et émission de `close` — plutôt que de
 * renoncer à l'élément natif, qui apporte gratuitement le piégeage du focus, la fermeture par Échap
 * et l'inertie de l'arrière-plan dans un vrai navigateur. Ces aspects-là sont couverts par les
 * parcours Playwright, pas ici.
 */
if (typeof HTMLDialogElement !== "undefined" && !HTMLDialogElement.prototype.showModal) {
  HTMLDialogElement.prototype.showModal = function showModal(this: HTMLDialogElement) {
    this.open = true;
  };
  HTMLDialogElement.prototype.show = function show(this: HTMLDialogElement) {
    this.open = true;
  };
  HTMLDialogElement.prototype.close = function close(this: HTMLDialogElement) {
    this.open = false;
    this.dispatchEvent(new Event("close"));
  };
}

/**
 * jsdom n'implémente pas non plus `URL.createObjectURL`. Tout écran qui affiche un fichier déjà
 * reçu - une pièce de la GED, l'aperçu d'une signature - passe par une adresse `blob:` locale,
 * parce que l'appel porte le jeton et qu'une balise `<img src>` pointant sur l'API ne l'emporterait
 * pas. Sans ce minimum, ces écrans lèvent au montage.
 *
 * L'adresse rendue est factice et ne retient rien : les tests unitaires ne lisent pas le contenu,
 * ils vérifient que l'écran le demande et le relâche. Le contenu lui-même relève des parcours
 * Playwright, dans un vrai navigateur.
 */
if (typeof URL.createObjectURL !== "function") {
  let rang = 0;
  URL.createObjectURL = () => `blob:test/${(rang += 1)}`;
  URL.revokeObjectURL = () => undefined;
}

afterEach(() => {
  cleanup();
});
