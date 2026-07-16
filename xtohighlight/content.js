import { CONFIG } from "./config";
import { state } from "./highlighter/state";
import {  buildTextIndex,
          getCurrentSelection,
          rangeToOffsets,
          getTextRanges
} from "./highlighter/conversions";

import {  addHighlight, 
          removeHighlight, 
          loadHighlights 
} from "./highlighter/highlights";

import { renderer } from "./highlighter/renderer";

import { cursor } from "./highlighter/cursor";

import { domObserver } from "./highlighter/observer";

async function start() {
  await loadHighlights();
  buildTextIndex();
  renderer.rederAll();
}

start();

document.addEventListener("keydown", event => {
  if (event.target.isContentEditable || CONFIG.SELECTORS.IGNORE_TAGS.includes(event.target.tagName)) {
    return;
  }

  switch (event.key.toLowerCase()) {
    case "y":
      state.color = CONFIG.COLORS.yellow;
      cursor.updateColor();
      break;

    case "r":
      state.color = CONFIG.COLORS.red;
      cursor.updateColor();
      break;

    case "b":
      state.color = CONFIG.COLORS.blue;
      cursor.updateColor();
      break;

    case "x":
      toggleHighlighter();
      break;

    case "escape":
      stopHighlighter();
      break;
  }
});

function toggleHighlighter() {
  const active = state.toggleActive();
  if (active) {
    buildTextIndex();
    domObserver.start();
    cursor.show();
  } else {
    stopHighlighter();
  }
}

function stopHighlighter() {
  state.active = false;

  domObserver.stop();
  cursor.hide();

  renderer.clear("preview");
}

document.addEventListener("mousemove", event => {
  if (!state.active) return;
  const target = document.elementFromPoint(event.clientX, event.clientY);
  if (!target) return;

  cursor.move(event.clientX, event.clientY, target)
});

document.addEventListener("selectionchange", event => {
  if (!state.active) return;
  
  const range = getCurrentSelection();

  if (!range) {
    renderer.clear("preview");
    return;
  }

  const offset = rangeToOffsets(range);

  if (!offset) return;

  const ranges = getTextRanges(rangeToOffsets.start, offset.end);
  
  renderer.renderPreview(ranges);
});

document.addEventListener("mouseup", async () => {
  if (!state.active) return;
  const range = getCurrentSelection();
  
  if (!range) {
    renderer.clear("preview");
    return;
  }
  
  const offset = rangeToOffsets(range);
  
  if (!offset) return;
  
  await addHighlight({
    start: offset.start,
    end: offset.end,
    color: state.color
  });

  renderer.rederAll();

  renderer.clear("preview");

  window.getSelection()?.removeAllRanges();
  
});

window.addEventListener("resize", () => {
  if (state.active) renderer.rederAll();
})