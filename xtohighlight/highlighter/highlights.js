import { state } from "./state";
import { storage } from "../storage";

export function getHighlights() {
  return state.highlights;
}

export function getHighlightsByColor(color) {
  return state.highlights.filter(h => h.color === color);
}

export function mergeHighlight(highlight) {
  // return smallest non overlapping list of highlights
  let result = [];
  
  let merged = highlight;
  
  for (const h of state.highlights) {
    if (h.end < merged.start ||
        h.start > merged.end ||
        h.color !== merged.color) { 
      // skip non-overlapping highlights / diff color
      result.push(h);
      continue;
    }
    
    merged = {
      start: Math.min(merged.start, h.start),
      end: Math.max(merged.end, h.end),
      color: merged.color
    }
  }
  
  result.push(merged);
  result.sort((a, b) => a.start - b.start);

  state.setHighlights(result);
}

export async function addHighlight(highlight) { 
  mergeHighlight(highlight);
  await persist();
}

export function removeHighlight(highlights) {
  return highlights.filter(h => h !== target);
}

export async function removeHihglightAtPoint(x, y) {
  const highlight = state.highlights.find(h => 
    h.color === state.color &&
    x >= h.renderLeft &&
    x <= h.renderRight &&
    y >= h.renderTop &&
    y <= h.renderBottom
  );

  if (highlight) {
    await removeHighlight(highlight);
    return true;
  } 
  return false;
}

export async function loadHighlights() {
  const saved = await storage.loadHighlights();
  if (Array.isArray(saved)) state.setHighlights(saved);
}

async function persist() {
  await storage.saveHighlights(state.highlights);
}