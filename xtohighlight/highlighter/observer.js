import { buildTextIndex } from "./conversions";
import { renderer } from "./renderer";

class DOMObserver {
  constructor() {
    this.observer = null;
    this.timeout = null;
  }

  start() {
    if (!this.observer) return;
    this.observer = new MutationObserver(mutations => this.handle(mutations));
    this.observer.observe(document.body, {childList: true, subtree: true, characterData: true});
  }

  stop() {
    this.observer?.disconnect();
    this.observer = null;
  }

  handle(mutations) {
    clearTimeout(this.timeout);

    this.timeout = setTimeout(() => {
      buildTextIndex();
      Renderer.renderAll(),
      200
    });
  }
}

export const domObserver = new DOMObserver();