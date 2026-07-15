console.log("loaded highlighter");

let isHighlighterActive = false;
let isHighlighting = false;
var currentcolor = "#ffff0050";

let highlights = []; // [{start: number, end: number, color, color: currentcolor}]
let highlightRects = []; // divs act as highlights
let previewRects = [];
let textOffsets = new Map(); // index for conversions

let cursor = document.createElement("div");
cursor.className = "cursor";
document.body.appendChild(cursor);

function buildTextIndex() { // build index for conversions
  textOffsets.clear();

  const walker = document.createTreeWalker(
    document.body, 
    NodeFilter.SHOW_TEXT,
    {
      acceptNode(node) {
        return node.nodeValue.trim().length ? NodeFilter.FILTER_ACCEPT : NodeFilter.FILTER_REJECT;
      }
    }
  ); 

  let offset = 0;
  let node;

  while (node = walker.nextNode()) {
    textOffsets.set(node, offset);
    offset += node.nodeValue.length;
  }
}


function rangeToOffsets(range) { // convert DOM range into offset 
  const start = textOffsets.get(range.startContainer) + range.startOffset;
  const end = textOffsets.get(range.endContainer) + range.endOffset;

  return {start: Math.min(start, end), end: Math.max(start, end)}; // allow selecting backwards
}

function mergeHighlight(newHighlight) { // collapse overlaps into as little highlights as possible
  let result = [];

  let merged = {...newHighlight};

  for (const h of highlights) {
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

  highlights = result;
}

function getTextRanges(start, end) {
  const ranges = [];

  for (const [node, offset] of textOffsets) {
    const nodeEnd = node.nodeValue.length + offset;

    if (nodeEnd <= start) continue;
    if (offset >= end) break;

    const range = document.createRange();
    range.setStart(node, Math.max(0, start - offset));
    range.setEnd(node, Math.min(node.nodeValue.length, end - offset));

    if (!range.collapsed) ranges.push(range);
  }
  console.log(ranges);
  return ranges;
}
function getTextRanges(start, end) {
  const ranges = [];

  for (const [node, offset] of textOffsets) {
    const nodeEnd = node.nodeValue.length + offset;

    if (nodeEnd <= start) continue;
    if (offset >= end) break;

    const range = document.createRange();
    range.setStart(node, Math.max(0, start - offset));
    range.setEnd(node, Math.min(node.nodeValue.length, end - offset));

    if (!range.collapsed) ranges.push(range);
  }
  console.log(ranges);
  return ranges;
}



function clearRects(rects) { // rm all divs
  for (const r of rects) r.remove();
  rects.length = 0;
}

function drawRange(range, storage, highlightidx, color) { // draw divs
  const padding = 4;

  for (const rect of range.getClientRects()) {
    const div = document.createElement("div");

    div.className = "highlight";
    div.dataset.index = highlightidx;
    
    div.style.cssText = `
      background: ${color};
      left: ${rect.left + scrollX - padding}px;
      top: ${rect.top + scrollY}px;
      width: ${rect.width + padding * 2}px;
      height: ${rect.height}px;
    ` // avoid 4 seperate css style mutations

    document.body.appendChild(div);
    storage.push(div);
  }
}

function updateHighlights() { // redraw highlights
  clearRects(highlightRects);

  highlights.forEach((h, index) => {
    const ranges = getTextRanges(h.start, h.end);
    ranges.forEach(range => drawRange(range, highlightRects, index, h.color));
  });
}

function showPreview() { // show current highlight (before mouselift)
  clearRects(previewRects);
  
  const selection = window.getSelection();
  
  if (!selection || selection.rangeCount === 0 || selection.isCollapsed) return;
  
  const range = selection.getRangeAt(0);
  
  if (!range.toString().trim()) return;
  
  const offsets = rangeToOffsets(range);

  const ranges = getTextRanges(offsets.start, offsets.end);
  ranges.forEach(range => drawRange(range, previewRects, -1, currentcolor));
 
}

function saveHighlight() {
  clearRects(previewRects);
  
  const selection = window.getSelection();
  
  if (!selection || selection.rangeCount === 0 || selection.isCollapsed)return;
  
  const range = selection.getRangeAt(0);
  if (!range.toString().trim()) return;

  navigator.clipboard.writeText(range.toString().trim()); // copy last highlight

  const offsets = rangeToOffsets(range);

  mergeHighlight({start: offsets.start, end: offsets.end, color: currentcolor}); // collapse highlights

  browser.storage.local.set({highlights}).then((result) => {
    console.log(result);
    console.log(browser.storage.local.get("highlights"));
  });

  selection.removeAllRanges();

  updateHighlights();

  // console.log(highlights);
}

// EventListeners
document.addEventListener("keydown", event => {
    // console.log(event.key); 
    if (event.target.isContentEditable ||
        event.target.tagName === "INPUT" ||
        event.target.tagName === "TEXTAREA") return;

    if (event.key.toLowerCase() === "y") {
      currentcolor = "#ffff0050";
      cursor.style.background = "#ffff0050";
    }
    if (event.key.toLowerCase() === "r") {
      currentcolor = "#ff000050";
      cursor.style.background = "#ff000050";
    }
    if (event.key.toLowerCase() === "b") {
      currentcolor = "#0000ff50";
      cursor.style.background = "#0000ff50";
    }

    if (event.key.toLowerCase() === "x") {
      isHighlighterActive = !isHighlighterActive;
      if (isHighlighterActive) buildTextIndex();
      document.documentElement.classList.toggle("highlighter-active", isHighlighterActive);
      cursor.style.display = isHighlighterActive ? "block" : "none";
      console.log( "highlighter", isHighlighterActive);
    }

    if (event.key === "Escape") {
      if (!isHighlighterActive) return;
      isHighlighterActive = false;
    }

    if (!isHighlighterActive) {
        clearRects(highlightRects);
        clearRects(previewRects);
    } else {
        updateHighlights();
        showPreview();
    }
});

document.addEventListener("mousemove", event => {
  if (!isHighlighterActive) return;
  const element = document.elementFromPoint(event.clientX, event.clientY);
  if (!element) return;
  
  cursor.classList.toggle("delete-icon", event.target.classList.contains("highlight"));
  
  const fs = parseFloat(getComputedStyle(element).fontSize) || 16;
  const h = Math.max(14, fs * 1.2);
  const w = Math.max(10, fs * 0.7);
  
  cursor.style.width = `${w}px`;
  cursor.style.height = `${h}px`;
  cursor.style.left = `${event.clientX}px`;
  cursor.style.top = `${event.clientY}px`;
});

document.addEventListener("mouseup", () => {
  if (!isHighlighterActive) return;
  saveHighlight();
  isHighlighting = false;
  document.documentElement.style.setProperty("--highlights-selectable", "auto")
});

document.addEventListener("mousedown", event => {
  if (!isHighlighterActive) return;
  
  if (event.target.classList.contains("highlight")) {
    highlights.splice(Number(event.target.dataset.index), 1)
    updateHighlights()
  }

  isHighlighting = true;
  document.documentElement.style.setProperty("--highlights-selectable", "none");
});

document.addEventListener("selectionchange", () => {
  if (!isHighlighterActive) return;
  showPreview();
});

window.addEventListener("resize", () => {
  if (!isHighlighterActive) return;
  updateHighlights();
});

// logic for not showing cursor when leaving window, idk works

document.addEventListener("blur", () => {
  cursor.style.display = "none";
});

document.addEventListener("focus", () => {
    if (isHighlighterActive) cursor.style.display = "block";
});
document.addEventListener("mouseover", () => {
    if (isHighlighterActive) cursor.style.display = "block";
});

window.addEventListener("mouseout", event => {
    if (!event.relatedTarget) cursor.style.display = "none";
});