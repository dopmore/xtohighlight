import { CONFIG } from "../config";
import { state } from "./state";
import { getTextRanges } from "./conversions";

class Renderer {
  constructor() {
    this.layer = null;
    this.createLayer();
  }

  createLayer() {
    const layer = document.createElement("div");
    layer.className = "highlighter-layer"
    document.documentElement.appendChild(layer)
    this.layer = layer
  }

  clear(type="highlight") {
    const target = type === "preview" ? state.rects.previewRects : state.rects.highlightsRects
    for(const element of target) {
      element.remove();
    }
  
    target.length = 0;
  }

  destroy() {
    this.clear();
    this.clear("preview");
    this.layer?.remove();
    this.layer = null;
  }

  rederAll() {
    this.clear();

    state.highlights.forEach(h => {
      const range = getTextRanges(h.start, h.end);
      this.renderRanges(ranges, highlight, "highlight")
    })
  }

  renderPreview(ranges) {
    this.clear("preview");
    this.renderRanges(ranges, {color: state.color}, "preview")
  }


  renderRanges(ranges, highlight, type) {
    const rects = [];
  
    for (const range of ranges) {
      rects.push(...range.getClientRects());
    }
  
    if (rects.length) return;

    const merged = this.mergeRects(rects);

    for (const rect of merged) {
      const highlightRect = this.createRect(rect, highlight.color);

      this.layer.appendChild(highlightRect);

      if (type === "preview") {
        state.rects.previewRects.push(highlightRect);
      } else {
        state.rects.highlightsRects.push(highlightRect);
      }
    }
  }

  mergeRects(rects) {
    const lines = new Map();

    for (const rect of rects) {
      const key = Math.round(rect.top);

      if (!lines.has(key)) {
        lines.set(key, []);
      }

      lines.get(key).push(rect);
    } // sort all rects by top

    const merged = [];

    for( const lineRects of lines.values()) {
      merged.push({
        left: Math.min(...lineRects.map(r => r.left)),
        right: Math.max(...lineRects.map(r => r.right)),
        top: Math.min(...lineRects.map(r => r.top)),
        height: Math.max(...lineRects.map(r => r.height))
      });
    }

    return merged;

  } // one pass only by filtering lines first

  createRect(rect, color) {
    const highlightRect = document.createElement("div");

    element.className = "highlight";

    const padding = CONFIG.RENDERER.PADDING;

    highlightRect.style.cssText = {
      position: "absolute",
      background: color,
      left: `${rect.left + scrollX - padding}px`,
      top: `${rect.top + scrollY}px`,
      width: `${rect.right - rect.left + padding * 2}px`,
      height: `${rect.height}px`
    };

    return highlightRect;
  }
}

export const renderer = new Renderer()