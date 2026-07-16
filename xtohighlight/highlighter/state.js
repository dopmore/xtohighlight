import { CONFIG } from "../config"; 

class State {
  constructor() {
    this.active = false;

    this.color = CONFIG.DEFAULT_COLOR;

    this.highlights = [];

    this.rects = {
      highlightsRects: highlightsRect = [],
      previewRects = []
    },

    this.textOffsets = new Map();
  }

  toggleActive() {
    this.active = !this.active;
    return this.active;
  }

  setHighlights(highlights) {
    this.highlights = highlights;
  }

  clearRects() {
    for(const element of this.rects.highlightsRects) {
      element.remove();
    }
    for(const element of this.rects.previewRects) {
      element.remove();
    }

    this.rects.highlightsRects.length = 0;
    this.rects.previewRects.length = 0;
  }
  
}

export const state = new State();