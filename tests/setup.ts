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

afterEach(() => {
  cleanup();
});
