console.log("loaded highlighter");
const STORAGE_KEY = `highlights${location.origin}${location.pathname}`;

const state = {
  active: false,
  color: "#ffff0050",
  
  highlights: [],
  // [{start: number, end: number, color, color: currentcolor}]
  rects: { // divs act as highlights (overlay)
    highlightRects: [],
    previewRects: []
  },
  
  textOffsets: new Map() // index for conversions
};

const COLORS = { // eyboard shortcuts for colors
  y: "#ffff0050",
  r: "#ff000050",
  b: "#0000ff50"
};

const cursor = document.createElement("div");
cursor.className = "cursor";
document.body.appendChild(cursor);

loadHighlights(); // try loading saved highlights on page-basis

function buildTextIndex() { // build index for conversions
  state.textOffsets.clear();

  const walker = document.createTreeWalker(
    document.body, 
    NodeFilter.SHOW_TEXT,
    {
      acceptNode(node) {
        return node.nodeValue.length ? NodeFilter.FILTER_ACCEPT : NodeFilter.FILTER_REJECT;
      }
    }
  ); 

  let offset = 0;
  let node;

  while (node = walker.nextNode()) {
    state.textOffsets.set(node, offset);
    offset += node.nodeValue.length;
  }
}

// DOM range <-> Offset conversions

function rangeToOffsets(range) { // convert DOM range into offset 
  let start = state.textOffsets.get(range.startContainer) + range.startOffset;
  let end = state.textOffsets.get(range.endContainer) + range.endOffset;
  if (isNaN(start) || isNaN(end)) {
    return null;
  }
  return {start: Math.min(start, end), end: Math.max(start, end)}; // allow selecting backwards
}

function offsetToRange(start, end) {
  const range = document.createRange();

  let startNode = null;
  let endNode = null;
  let startOffset = 0;
  let endOffset = 0;

  for (const [node, offset] of state.textOffsets) {
    const nodeEnd = node.nodeValue.length + offset;

    if (startNode === null && start >= offset && start <= nodeEnd) {
      startNode = node;
      startOffset = start - offset
    }

    if (end >= offset && end <= nodeEnd) {
      endNode = node;
      endOffset = end - offset;
      break;
    }
  }

  if (!startNode||!endNode) return null;

  range.setStart(startNode, startOffset);
  range.setEnd(endNode, endOffset);

  return range;
}

function getTextRanges(start, end) {
  const ranges = [];

  for (const [node, offset] of state.textOffsets) {
    const nodeEnd = node.nodeValue.length + offset;

    if (nodeEnd <= start) continue;
    if (offset >= end) break;

    const range = document.createRange();
    range.setStart(node, Math.max(0, start - offset));
    range.setEnd(node, Math.min(node.nodeValue.length, end - offset));
    if (!range.collapsed) ranges.push(range);
  }
  return ranges;
}

// highlight-logic

function mergeHighlight(newHighlight) { // collapse overlaps into as little highlights as possible
  let result = [];
  
  let merged = {...newHighlight};
  
  for (const h of state.highlights) {
    if (h.end < merged.start || h.start > merged.end || h.color !== merged.color) { // skip non-overlapping highlights / diff color
      result.push(h)
      continue;
    }
    
    merged.start = Math.min( merged.start, h.start);
    merged.end = Math.max( merged.end, h.end);
    merged.color = h.color;
  }
  
  result.push(merged);
  result.sort((a, b) => a.start - b.start);
  
  state.highlights = result;
}

function removeHighlight(highlight) {
  state.highlights.splice(state.highlights.indexOf(highlight), 1);
  saveHighlights();
  updateHighlightRects();
}

function saveHighlights() {
  browser.storage.local.set({[STORAGE_KEY]: state.highlights});
}

async function loadHighlights() {
  const result = await browser.storage.local.get(STORAGE_KEY);

  state.highlights = result[STORAGE_KEY] || [];
}

// Rect-logic, drawing highlights

function clearRects(rects) { // rm all divs
  for (const r of rects) r.remove();
  rects.length = 0;
}

function drawRanges(ranges, storage, highlightidx, color) { // draw divs
  const padding = 2;
  
  const rects = [];
  for (const range of ranges) {
    if (range === null) return;
    rects.push(...range.getClientRects());
  };

  const lines = new Map();

  for (const rect of rects) {
    const key = Math.round(rect.top);

    if (!lines.has(key)) {
      lines.set(key, []);
    }

    lines.get(key).push(rect);
  } // sort all rects by top

  const mergedRects = []; // merge Rects on the same line (else links, bold etc. would get their own highlight, ew ugly)

  for( const lineRects of lines.values()) {
    mergedRects.push({
      left: Math.min(...lineRects.map(r => r.left)),
      right: Math.max(...lineRects.map(r => r.right)),
      top: Math.min(...lineRects.map(r => r.top)),
      height: Math.max(...lineRects.map(r => r.height))
    });
  }

  for (const rect of mergedRects) {
    const div = document.createElement("div");
    div.className = "highlight";
    div.dataset.index = highlightidx;
    
    div.style.cssText = `
      background: ${color};
      left: ${rect.left + scrollX - padding}px;
      top: ${rect.top + scrollY}px;
      width: ${rect.right - rect.left + padding * 2}px;
      height: ${rect.height}px;
    ` // avoid 4 seperate css style mutations

    document.body.appendChild(div);
    storage.push(div);
  }
}

function updateHighlightRects() { // redraw highlights
  clearRects(state.rects.highlightRects);

  state.highlights.forEach((h, index) => {
    const ranges = getTextRanges(h.start, h.end);
    drawRanges(ranges, state.rects.highlightRects, index, h.color);
  });
}

// selection preview

function showPreview() { // show current highlight (before mouselift)
  clearRects(state.rects.previewRects);
  
  const selection = window.getSelection();
  
  if (!selection || selection.rangeCount === 0 || selection.isCollapsed) return;
  
  const selRange = selection.getRangeAt(0);
  
  if (!selRange.toString().trim()) return;
  
  const offsets = rangeToOffsets(selRange);

  if(!offsets) {
    selection.removeAllRanges();
    return;
  }

  const ranges = getTextRanges(offsets.start, offsets.end);
  drawRanges(ranges, state.rects.previewRects, -1, state.color); 
}

function saveHighlight() {
  clearRects(state.rects.previewRects);
  
  const selection = window.getSelection();
  
  if (!selection || selection.rangeCount === 0 || selection.isCollapsed) return;
  
  const range = selection.getRangeAt(0);
  if (!range.toString().trim()) return;

  navigator.clipboard.writeText(range.toString().trim()); // copy last highlight

  const offsets = rangeToOffsets(range);

  if (!offsets) {
    selection.removeAllRanges();
    return
  }

  mergeHighlight({start: offsets.start, end: offsets.end, color: state.color}); // collapse highlights

  saveHighlights();

  selection.removeAllRanges();

  updateHighlightRects();
}

function getHighlightFromPoint(x, y) {
  const rect = state.rects.highlightRects.find(div => {
    const r = div.getBoundingClientRect();

    if (state.highlights[Number(div.dataset.index)].color !== state.color) return false;
    // skip other non currentcolor highlights

    return (
      x >= r.left + scrollX &&
      x <= r.right + scrollX &&
      y >= r.top + scrollY &&
      y <= r.bottom + scrollY
    )
  });
  return rect ? state.highlights[Number(rect.dataset.index)] : null
}

function copyHighlightTexts(color = null) {
  const highlights = color ? 
  state.highlights.filter(h => h.color === color) : state.highlights;

  const text = highlights.map(h => offsetToRange(h.start, h.end)?.toString().trim()).join("\n");

  navigator.clipboard.writeText(text);
}

// EventListeners
document.addEventListener("keydown", event => {
  if (event.target.isContentEditable ||
      event.target.tagName === "INPUT" ||
      event.target.tagName === "TEXTAREA") return;

  const key = event.key.toLocaleLowerCase()

  if (COLORS[key]){
    if (state.color === COLORS[key]) {
      copyHighlightTexts(state.color);
      return;
    }

    state.color = COLORS[key];
    cursor.style.background = COLORS[key];
  } 

  switch (event.key.toLocaleLowerCase()) {
    case "x":
      state.active = !state.active;
      console.log("highlighter", state.active);
    break;
      
    case "Escape":
      if (!state.active) return;
      state.active = false;
    break;
  
    case "c":
      copyHighlightTexts();
    break;
  }
      
  if (!state.active) {
    clearRects(state.rects.highlightRects);
    clearRects(state.rects.previewRects);
  } else {
    buildTextIndex();
    updateHighlightRects();
    showPreview();
  }

  document.documentElement.classList.toggle("highlighter-active", state.active);
  cursor.style.display = state.active ? "block" : "none";
});


document.addEventListener("mousemove", event => {
  if (!state.active) return;
  const element = document.elementFromPoint(event.clientX, event.clientY);
  if (!element) return;
  
  const highlight = getHighlightFromPoint(event.clientX + scrollX, event.clientY + scrollY);

  cursor.classList.toggle("action-icons", highlight && highlight.color===state.color); // adds copy / delete icon to indicate that actions are possible
  

  const fs = parseFloat(getComputedStyle(element).fontSize) || 16;
  const h = Math.max(14, fs * 1.2);
  const w = Math.max(10, fs * 0.7);
  
  cursor.style.width = `${w}px`;
  cursor.style.height = `${h}px`;
  cursor.style.left = `${event.clientX}px`;
  cursor.style.top = `${event.clientY}px`;
});

document.addEventListener("mouseup", () => {
  if (!state.active) return;
  saveHighlight();
});

document.addEventListener("mousedown", event => {
  if (!state.active) return;
  if (event.button !== 0) return;
  const highlight = getHighlightFromPoint(event.clientX + scrollX, event.clientY + scrollY);
  if (highlight && highlight.color === state.color) {
    removeHighlight(highlight);
    updateHighlightRects()
  }
});

document.addEventListener("contextmenu", event => {
  if (!event.target.classList.contains("highlight")) return;

  event.preventDefault();

  const h = state.highlights[Number(event.target.dataset.index)];
  const range = offsetToRange(h.start, h.end);

  if (range) navigator.clipboard.writeText(range.toString());
});

document.addEventListener("selectionchange", () => {
  if (!state.active) return;
  showPreview();
});

window.addEventListener("resize", () => {
  if (!state.active) return;
  updateHighlightRects();
});

// logic for not showing cursor when leaving window, idk works

document.addEventListener("focus", () => {if (state.active) cursor.style.display = "block";});
document.addEventListener("mouseover", () => {if (state.active) cursor.style.display = "block";});
document.addEventListener("blur", () => {cursor.style.display = "none";});
window.addEventListener("mouseout", event => {if (!event.relatedTarget) cursor.style.display = "none";});
