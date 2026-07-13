console.log("loaded highlighter");

let isHighlighterActive = false;
let isHighlighting = false;

let highlights = []; // [{start: number, end: number}]
let highlightRects = []; // divs act as highlights
let previewRects = [];

let cursor = document.createElement("div");
cursor.className = "cursor";
document.body.appendChild(cursor);

function getTextNodes() { // filter out all the textNodes
  const walker = document.createTreeWalker(
    document.body, 
    NodeFilter.SHOW_TEXT,
    {
      acceptNode(node) {
        return node.nodeValue.length ? NodeFilter.FILTER_ACCEPT : NodeFilter.FILTER_REJECT;
      }
    }
  ); 

  const nodes = [];

  while (walker.nextNode()) nodes.push(walker.currentNode);

  return nodes;
}


function getDocumentText() { // rt one large string with all text combined without whitespace (stringed page Text)
  return getTextNodes().map(n => n.nodeValue).join("");
}


function rangeToOffsets(range) { // convert DOM range into offset in the stringed page Text
  const nodes = getTextNodes();

  let start = 0;
  let end = 0;

  let currentChar = 0; // walk over the 

  for (const node of nodes) {
    // find corresponding start/end node
    if (node === range.startContainer) {
      start = currentChar + range.startOffset;
    }

    if (node === range.endContainer) { 
      end = currentChar + range.endOffset;
    }
    if (start && end) break; // avoid searching after start and end have been found
    currentChar += node.nodeValue.length;
  }

  return {start: Math.min(start, end), end: Math.max(start, end)}; // allow selecting backwards
}


function offsetsToRange(start, end) { // converts offset in the stringed page Text to DOM range

  const nodes = getTextNodes();

  let currentChar = 0;

  let startNode = null;
  let startOffset = 0;

  let endNode = null;
  let endOffset = 0;

  for (const node of nodes) {

    const next = currentChar + node.nodeValue.length;

    if (!startNode && start >= currentChar && start <= next) {
      startNode = node;
      startOffset = start - currentChar;
    }

    if (!endNode && end >= currentChar && end <= next) {
      endNode = node;
      endOffset = end - currentChar;
    }

    currentChar = next;
  }


  if (!startNode || !endNode) return null;

  const range = document.createRange();

  range.setStart(startNode, startOffset);
  range.setEnd(endNode, endOffset);

  return range;
}

function mergeHighlight(newHighlight) { // collapse overlaps into as little highlights as possible

  let result = [];

  let merged = {...newHighlight};

  for (const h of highlights) {

    const overlap = merged.start <= h.end && merged.end >= h.start;
    const inside = merged.start >= h.start && merged.end <= h.end;

    if (inside) { // ignore new highlights inside existing Highlights
      return;
    }

    if (overlap) {
      merged.start = Math.min( merged.start, h.start);
      merged.end = Math.max( merged.end, h.end);
    } else {
      result.push(h);
    }
  }

  result.push(merged);
  result.sort((a, b) => a.start - b.start);

  highlights = result;
}

function clearRects(rects) { // rm all divs
  for (const r of rects) r.remove();
  rects.length = 0;
}


function drawRange(range, storage, highlightidx) { // draw divs
  for (const rect of range.getClientRects()) {
    console.log(rect, range, range.getClientRects())
    const div = document.createElement("div");

    div.className = "highlight";
    div.dataset.index = highlightidx;

    const padding = 4;

    div.style.left = `${rect.left + scrollX - padding}px`;
    div.style.top = `${rect.top + scrollY}px`;
    div.style.width = `${rect.width + padding * 2}px`;
    div.style.height = `${rect.height}px`;

    document.body.appendChild(div);

    storage.push(div);
  }
}

function updateHighlights() { // redraw highlights
  clearRects(highlightRects);

  highlights.forEach((h, index) => {
    const range = offsetsToRange( h.start, h.end);

    if (range) drawRange(range, highlightRects, index);
  });
}

function showPreview() { // show current highlight (before mouselift)
  clearRects(previewRects);

  const selection = window.getSelection();

  if (!selection || selection.rangeCount === 0 || selection.isCollapsed) return;

  const range = selection.getRangeAt(0);

  if (!range.toString().trim()) return;

  drawRange( range, previewRects);
}

function saveHighlight() {
  clearRects(previewRects);
  
  const selection = window.getSelection();
  
  if (!selection || selection.rangeCount === 0 || selection.isCollapsed)return;
  
  const range = selection.getRangeAt(0);
  if (!range.toString().trim()) return;

  navigator.clipboard.writeText(range.toString().trim());

  const offsets = rangeToOffsets(range);

  mergeHighlight({start: offsets.start, end: offsets.end});

  browser.storage.local.set({highlights}).then((result) => {
    console.log(result);
    console.log(browser.storage.local.get("highlights"));
  });

  selection.removeAllRanges();

  updateHighlights();

  console.log(highlights);
}

// EventListeners
document.addEventListener("keydown", event => {
    // console.log(event.key); 
    if (event.target.isContentEditable ||
        event.target.tagName === "INPUT" ||
        event.target.tagName === "TEXTAREA") return;

    if (event.key.toLowerCase() === "x") {
      isHighlighterActive = !isHighlighterActive;
    }

    if (event.key === "Escape") {
      if (!isHighlighterActive) return;
      isHighlighterActive = false;
    }

    document.documentElement.classList.toggle("highlighter-active", isHighlighterActive);
    cursor.style.display = isHighlighterActive ? "block" : "none";
    console.log( "highlighter", isHighlighterActive);
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