import "@testing-library/jest-dom/vitest";

import { cleanup } from "@testing-library/react";
import { afterEach } from "vitest";

/**
 * jsdom does not implement `<dialog>` (`showModal()` and `close()` are missing). This provides the
 * minimal behavior (toggle `open`, emit `close`); focus trapping, Escape and background inertness
 * are covered by Playwright.
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
 * jsdom does not implement `URL.createObjectURL` either. Screens showing a downloaded file use a
 * local `blob:` URL because the request carries the token, which an `<img src>` would not.
 * The returned URL is fake: unit tests only check that the screen creates and revokes it.
 */
if (typeof URL.createObjectURL !== "function") {
  let rang = 0;
  URL.createObjectURL = () => `blob:test/${(rang += 1)}`;
  URL.revokeObjectURL = () => undefined;
}

afterEach(() => {
  cleanup();
});
