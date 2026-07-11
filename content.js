console.log("loaded highlighter")

let isHighlighterActive = false;
let highlights = []; // {startNode, startOffset, endNode, endOffset}
let highlightRects = [];
let previewRects = [];

function clearRects(rects) { rects.forEach(el => el.remove()); rects.length = 0; }

function showActiveHighlight() {
  clearRects(previewRects);

  const selection = window.getSelection(); // curr selection

  if (!selection.toString().trim()) return; // return if whitespace only

  drawHighlight(selection.getRangeAt(0), previewRects); // update current highlight
}

function saveHighlight() {
  clearRects(previewRects);
  const selection = window.getSelection();

  if (!selection.toString().trim()) return;

  highlights.push(selection.getRangeAt(0).cloneRange());
  updateHighlights();
}

function drawHighlight(range, storage) {
  const rects = range.getClientRects();

  for (const rect of rects) {
    const highlight = document.createElement("div");

    highlight.className = "highlight";

    const padding = 4;

    highlight.style.left = `${rect.left + window.scrollX - padding}px`;
    highlight.style.top = `${rect.top + window.scrollY}px`;
    highlight.style.width = `${rect.width + 2 * padding}px`;
    highlight.style.height = `${rect.height}px`;

    document.body.appendChild(highlight);
    storage.push(highlight);
  }
}

function updateHighlights() {
  clearRects(highlightRects);
  for (const range of highlights) {
    drawHighlight(range, highlightRects);
  }
}


document.addEventListener("keydown", (event) => {
  if (event.key.toLowerCase() === 'x') {
    isHighlighterActive = !isHighlighterActive;

    document.documentElement.classList.toggle("highlighter-active", isHighlighterActive);

    console.log('turned', isHighlighterActive ? "on" : "off");
  }
});

document.addEventListener("mouseup", () => {
  if (!isHighlighterActive) return;
  saveHighlight();
});

document.addEventListener("resize", () => {
  if (!isHighlighterActive) return;
  updateHighlights();
})


document.addEventListener("selectionchange", () => {
  if (!isHighlighterActive) return;
  showActiveHighlight();
});
