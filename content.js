console.log("loaded highlighter");

let isHighlighterActive = false;

let highlights = [];// [{start: number, end: number}]
let highlightRects = [];
let previewRects = [];

let cursor = document.createElement("div");
cursor.className = "cursor";
document.body.appendChild(cursor);

function getTextNodes() {
  const walker = document.createTreeWalker(
    document.body, 
    NodeFilter.SHOW_TEXT,
    {
      acceptNode(node) {
        return node.nodeValue.trim() ? NodeFilter.FILTER_ACCEPT : NodeFilter.FILTER_REJECT;
      }
    }
  );

  const nodes = [];

  while (walker.nextNode()) {
    nodes.push(walker.currentNode);
  }

  return nodes;
}


function getDocumentText() {
  return getTextNodes().map(n => n.nodeValue).join("");
}


function rangeToOffsets(range) {
  const nodes = getTextNodes();

  let start = 0;
  let end = 0;

  let cursor = 0;

  for (const node of nodes) {

    if (node === range.startContainer) {
      start = cursor + range.startOffset;
    }

    if (node === range.endContainer) {
      end = cursor + range.endOffset;
    }

    cursor += node.nodeValue.length;
  }

  return {start: Math.min(start, end), end: Math.max(start, end)};
}


function offsetsToRange(start, end) {

  const nodes = getTextNodes();

  let cursor = 0;

  let startNode = null;
  let startOffset = 0;

  let endNode = null;
  let endOffset = 0;

  for (const node of nodes) {

    const next = cursor + node.nodeValue.length;

    if (startNode === null && start >= cursor && start <= next) {
      startNode = node;
      startOffset = start - cursor;
    }

    if ( endNode === null && end >= cursor && end <= next) {
      endNode = node;
      endOffset = end - cursor;
    }

    cursor = next;
  }


  if (!startNode || !endNode) return null;

  const range = document.createRange();

  range.setStart(startNode, startOffset);
  range.setEnd(endNode, endOffset);

  return range;
}

function mergeHighlight(newHighlight) {

  let result = [];

  let merged = {start: newHighlight.start, end: newHighlight.end};

  for (const h of highlights) {

    const overlap = merged.start <= h.end && merged.end >= h.start;
    const inside = merged.start >= h.start && merged.end <= h.end;

    if (inside) {
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

function clearRects(rects) {
  for (const r of rects) r.remove();
  rects.length = 0;
}


function drawRange(range, storage, highlightidx) {
  for (const rect of range.getClientRects()) {
    // filter out non text
   
    const div = document.createElement("div");

    div.className = "highlight";
    div.dataset.index = highlightidx;

    const padding = 4;

    div.style.position = "absolute";
    div.style.pointerEvents = "none";

    div.style.left = `${rect.left + scrollX - padding}px`;
    div.style.top = `${rect.top + scrollY}px`;
    div.style.width = `${rect.width + padding * 2}px`;
    div.style.height = `${rect.height}px`;

    document.body.appendChild(div);

    storage.push(div);
  }
}

function updateHighlights() {
  clearRects(highlightRects);

  highlights.forEach((h, index) => {
    const range = offsetsToRange( h.start, h.end);

    if (range) drawRange(range, highlightRects, index);
  });
}

function showPreview() {

  clearRects(previewRects);

  const selection = window.getSelection();

  if ( !selection || selection.rangeCount === 0 || selection.isCollapsed) return;

  const range = selection.getRangeAt(0);

  if (!range.toString().trim()) return;

  drawRange( range, previewRects);
}

function saveHighlight() {
  clearRects(previewRects);
  
  const selection = window.getSelection();
  
  if ( !selection || selection.rangeCount === 0 || selection.isCollapsed)return;
  
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
  }
);

document.addEventListener("mouseup", () => {
    if (!isHighlighterActive) return;
    saveHighlight();
  }
);

document.addEventListener("selectionchange", () => {
    if (!isHighlighterActive) return;
    showPreview();
  }
);

window.addEventListener("resize", () => {
    if (!isHighlighterActive) return;
    updateHighlights();
  }
);

document.addEventListener("mousemove", event => {
    const element = document.elementFromPoint(event.clientX, event.clientY);
    if (!element) return;

    let hoveredHighlight = null;

    for (const rect of highlightRects) {

        const box = rect.getBoundingClientRect();

        if (
            event.clientX >= box.left &&
            event.clientX <= box.right &&
            event.clientY >= box.top &&
            event.clientY <= box.bottom
        ) {
            hoveredHighlight = rect;
            break;
        }
    };

    if (hoveredHighlight && isHighlighterActive) {
        cursor.classList.add("delete-icon");
      } else {
        cursor.classList.remove("delete-icon");
    }


    const fs = parseFloat(getComputedStyle(element).fontSize) || 16;
    const h = Math.max(14, fs * 1.2);
    const w = Math.max(10, fs * 0.7);

    cursor.style.width = `${w}px`;
    cursor.style.height = `${h}px`;
    cursor.style.left = `${event.clientX}px`;
    cursor.style.top = `${event.clientY}px`;
  }
);


document.addEventListener("mousedown", event => {
  if (!isHighlighterActive) return;
  let hoveredHighlight = null;

  for (const rect of highlightRects) {

    const box = rect.getBoundingClientRect();

    if (
      event.clientX >= box.left &&
      event.clientX <= box.right &&
      event.clientY >= box.top &&
      event.clientY <= box.bottom
    ) {
      const idx = Number(rect.dataset.index);
      highlights.splice(idx, 1);
      browser.storage.local.set({highlights});
      updateHighlights();
      break;
    }
  };
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