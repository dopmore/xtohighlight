const STORAGE_KEY = `highlights${location.origin}${location.pathname}`;

const state = {
  active: false,
  
  config: {
    shortcuts: {
      colors: { // eyboard shortcuts for colors
        y: "#ffff0050",
        r: "#ff000050",
        b: "#0000ff50"
      },
      toggle: "x",
      copyAll: "c",
      deleteAll: "d"
    }
  },
  
  color: null,
  
  highlights: [],
  // [{start: number, end: number, color, color: currentcolor}]
  rects: { // divs act as highlights (overlay)
    highlightRects: [],
    previewRects: []
  },
  
  textOffsets: new Map(), // index for conversions\
  toolbar: null,
  contextMenu: null,
  cursor: null
};


async function init() {
  await loadHighlights(); // try loading saved highlights on page-basis
  await loadSettings();
  createCursor();
  createToolbar();
  createContextMenu();
  
  state.color = Object.values(state.config.shortcuts.colors)[0];
  state.cursor.style.background = state.color;
  buildTextIndex();
  console.log("loaded highlighter");
}

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
  
  if (result[STORAGE_KEY]) state.highlights = result[STORAGE_KEY];
}

function saveHighlight() {
  clearRects(state.rects.previewRects);
  
  const selection = window.getSelection();
  
  if (!selection || selection.rangeCount === 0 || selection.isCollapsed) return;
  
  const range = selection.getRangeAt(0);
  if (!range.toString().trim()) return;

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

function copyHighlightTexts(highlight = null, color = null) {
  if (highlight) {
    navigator.clipboard.writeText(offsetToRange(highlight.start, highlight.end)?.toString());
    return;
  }

  const highlights = color ? 
  state.highlights.filter(h => h.color === color) : state.highlights;

  const text = highlights.map(h => offsetToRange(h.start, h.end)?.toString().trim()).join("\n");

  if (text) navigator.clipboard.writeText(text); // prevent copying nothing
}

function deleteAllHighlights(askConfirm = false) {
  if (askConfirm) {
    if (!confirm("Delete all Highlights?")) return;
  }
  
  state.highlights = [];
  saveHighlights();
  clearRects(state.rects.highlightRects);
  clearRects(state.rects.previewRects);
}

function selectHighlight(highlight) {
  state.rects.highlightRects.forEach(rect => {
    rect.classList.toggle("selected", highlight && Number(rect.dataset.index) === state.highlights.indexOf(highlight));
  });
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

// save/load settings

async function loadSettings() {
  const result = await browser.storage.sync.get("highlighter-settings");

  if (result["highlighter-settings"]) state.config = result["highlighter-settings"];
}

function saveSettings() {
  browser.storage.sync.set({["highlighter-settings"]: state.config});
}

// toolbar

function createToolbar() {
  let dragging = false;
  let startX;
  let startY;
  let startLeft;
  let startTop;

  state.toolbar = document.createElement("div")
  state.toolbar.id = "highlighter-toolbar";
  state.toolbar.classList.add("hidden");
  state.toolbar.innerHTML = `
    <button class="logo" data-action="logo"></button>
    <div class="colors"></div>
    <button data-action="addColor"> + </button>
    <button data-action="copyAll"> 📋 <span>${state.config.shortcuts.copyAll}</span> </button>
    <button data-action="deleteAll"> ${state.config.shortcuts.deleteAll} </button>
    <button data-action="collapse"> ^ </button>
  `;

  document.body.appendChild(state.toolbar);

  state.toolbar.querySelector(".colors").innerHTML = "";

  renderColors(); // colors can change
  
  state.toolbar.addEventListener("click", event => {
    const button = event.target.closest("button");
    if (!button) return;
    const action = button.dataset.action;

    if (event.target.classList.contains("color-button")) {
      if (state.color === event.target.dataset.color) {
        copyHighlightTexts(null, state.color);
        return;
      }
      state.color = event.target.dataset.color;
      state.cursor.style.background = state.color;
      return;
    }

    switch (action) {
      case "collapse":
        state.toolbar.classList.toggle("collapsed");
      break;

      case "logo":
        if (!moved) state.toolbar.classList.toggle("collapsed");
      break;

      case "addColor":
        addColor();
      break;

      case "copyAll":
        copyHighlightTexts();
      break;

      case "deleteAll":
        deleteAllHighlights(true);
      break;
    }
  });

  const logo = state.toolbar.querySelector(".logo");

  let moved = false;

  logo.addEventListener("pointerdown", event => {
      dragging = true;
      moved = false;

      const rect = state.toolbar.getBoundingClientRect();
      
      startX = event.clientX;
      startY = event.clientY;
      
      startLeft = rect.left;
      startTop = rect.top;
      
      logo.setPointerCapture(event.pointerId);
    });
    
    logo.addEventListener("pointermove", event => {
      if (!dragging) return;
      
      const dx = event.clientX - startX;
      const dy = event.clientY - startY;
      
      moved = Math.abs(dx) > 1 || Math.abs(dy) > 1;

      const rect = state.toolbar.getBoundingClientRect();

      const newLeft = Math.max(0, Math.min(startLeft + dx, window.innerWidth - rect.width));
      const newTop = Math.max(0, Math.min(startTop + dy, window.innerHeight - rect.height));

      state.toolbar.style.right = "auto";
      state.toolbar.style.transform = "none";
      state.toolbar.style.left = `${newLeft}px`
      state.toolbar.style.top = `${newTop}px`
  });

  logo.addEventListener("pointerup", event => {
    dragging = false;
    logo.releasePointerCapture(event.pointerId);
  });
}

function renderColors() {
  state.toolbar.querySelector(".colors").innerHTML = "";
  Object.entries(state.config.shortcuts.colors).forEach(([shortcut, color]) => {
    const button = document.createElement("button");
  
    button.className = "color-button";
    button.dataset.color = color;
    button.style.background = color;

    button.dataset.shortcut = shortcut;
    button.textContent = shortcut.toUpperCase();
  
    state.toolbar.querySelector(".colors").appendChild(button);
  });
}

function addColor() {
  const colorPicker = document.createElement("input");
  colorPicker.type = "color";

  colorPicker.onchange = () => {
    const shortcut = prompt("Shortcut-key: ")
    if (!shortcut) return;
    if (state.config.shortcuts.colors[shortcut]) {
      alert("Shortcut already exists");
      return;
    }

    state.config.shortcuts.colors[shortcut.toLowerCase()] = colorPicker.value + "50";
   
    saveSettings();
    renderColors();
  }

  colorPicker.click();
}

// cursor

function createCursor() {
  state.cursor = document.createElement("div");
  state.cursor.className = "cursor";
  document.body.appendChild(state.cursor);
}

// contextMenu

function createContextMenu() {
  let contextMenuTimeout;
  state.contextMenu = document.createElement("div");
  state.contextMenu.id = "highlighter-context-menu";

  document.body.appendChild(state.contextMenu);

  state.contextMenu.addEventListener("click", event => {
    const button = event.target.closest("button");
    if (!button) return;

    const action = button.dataset.action;
    const data = state.contextMenu.dataset;

    const color = data.color;
    const index = Number(data.index);

    const colors = state.config.shortcuts.colors;
    const key = Object.keys(colors).find(k => colors[k] === color);


    switch (action) {
      case "copy":
        if (!isNaN(index)) {
          copyHighlightTexts(state.highlights[index]);
        } else {
          copyHighlightTexts();
        }
      break;
        
      case "delete":
        if (!isNaN(index)) {
          removeHighlight(state.highlights[index]);
        } else {
          deleteAllHighlights(true);
        }
      break;

      case "default":
        const defaultColor = colors[key];
        delete colors[key];
        state.config.shortcuts.colors = {
          [key]: defaultColor,
          ...colors
        };

        saveSettings();
        renderColors();
      break;

      case "copyColor":
        copyHighlightTexts(null, color);
      break;

      case "deleteColor":
        state.highlights = state.highlights.filter(h => h.color !== color);
        delete colors[key];
        saveSettings();
        renderColors();
        saveHighlights();
        updateHighlightRects();
      break;
        
      case "deleteColorHighlights":
        state.highlights = state.highlights.filter(h => h.color !== color);
        saveHighlights();
        updateHighlightRects();
      break;

      case "copyColorHighlights":
        copyHighlightTexts(null, color)
      break;
    }

    state.contextMenu.classList.remove("visible");
  });

  state.contextMenu.addEventListener("mouseleave", () => {
    contextMenuTimeout = setTimeout(() => {
      state.contextMenu.classList.remove("visible");
    }, 200);
  });

  state.contextMenu.addEventListener("mouseenter", () => {
    clearTimeout(contextMenuTimeout);  // let user reenter 
  });
}

function showContextMenu(x, y, items, data = {}) {
  state.contextMenu.innerHTML = "";

  Object.assign(state.contextMenu.dataset, data);

  for (const item of items) {
    const button = document.createElement("button");
    button.textContent = item.text;
    button.dataset.action = item.action;
    
    state.contextMenu.appendChild(button);
  }
  
  state.contextMenu.classList.add("visible");

  const rect = state.contextMenu.getBoundingClientRect();

  const newLeft = Math.max(0, Math.min(x, window.innerWidth - rect.width));
  const newTop = Math.max(0, Math.min(y, window.innerHeight - rect.height));

  state.contextMenu.style.left = `${newLeft + scrollX}px`;
  state.contextMenu.style.top = `${newTop + scrollY}px`;
} 

// EventListeners
document.addEventListener("keydown", event => {
  if (event.target.isContentEditable ||
      event.target.tagName === "INPUT" ||
      event.target.tagName === "TEXTAREA") return;

  const key = event.key.toLocaleLowerCase()
  const colors = state.config.shortcuts.colors;

  if (colors[key]){
    if (state.color === colors[key]) {
      copyHighlightTexts(null, state.color);
      return;
    }

    state.color = colors[key];
    state.cursor.style.background = colors[key];
  } 

  switch (event.key.toLocaleLowerCase()) {
    case state.config.shortcuts.toggle:
      state.active = !state.active;
      console.log("highlighter", state.active);
    break;

    case state.config.shortcuts.copyAll:
      copyHighlightTexts();
    break;

    case state.config.shortcuts.deleteAll:
      deleteAllHighlights(true);
    break;

    case "Escape":
      if (!state.active) return;
      state.active = false;
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
  state.toolbar.classList.toggle("hidden", !state.active);
  state.cursor.style.display = state.active ? "block" : "none";
});


document.addEventListener("mousemove", event => {
  if (!state.active) return;
  const element = document.elementFromPoint(event.clientX, event.clientY);
  if (!element) return;

  if (element.closest("#highlighter-toolbar")) {
    state.cursor.style.display = "none";
    return;
  } else {
    state.cursor.style.display = "block";
  }
  
  const highlight = getHighlightFromPoint(event.clientX + scrollX, event.clientY + scrollY);

  selectHighlight(highlight); // select / remove highlight selection  

  const fs = parseFloat(getComputedStyle(element).fontSize) || 16;
  const h = Math.max(14, fs * 1.2);
  const w = Math.max(10, fs * 0.7);
  
  state.cursor.style.width = `${w}px`;
  state.cursor.style.height = `${h}px`;
  state.cursor.style.left = `${event.clientX}px`;
  state.cursor.style.top = `${event.clientY}px`;
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
  if (!state.active) return;
  event.preventDefault();
  
  const target = event.target;

  if(target.closest(".color-button")) {
    showContextMenu(
      event.clientX,
      event.clientY,
      [
        {text: "copy color highlights", action: "copyColorHighlights"},
        {text: "delete color highlights", action: "deleteColorHighlights"},
        {text: "delete color", action: "deleteColor"},
        {text: "set default color", action: "default"}
      ],
      {color: target.closest(".color-button").dataset.color}
    );

    return;
  }
  
  const highlight = getHighlightFromPoint(event.clientX + scrollX, event.clientY + scrollY);
  
  if (highlight) {
    showContextMenu(
      event.clientX,
      event.clientY,
      [
        {text: "copy highlight", action: "copy"},
        {text: "delete highlight", action: "delete"},
        {text: "copy color highlights", action: "copyColorHighlights"},
        {text: "delete color highlights", action: "deleteColorHighlights"},
        {text: "set default color", action: "default"}
      ],
      {
        index: state.highlights.indexOf(highlight),
        color: highlight.color
      }
    );
    return;
  }
  
  showContextMenu(
    event.clientX,
    event.clientY,
    [
      {text: "copy all highlights", action: "copy"},
      {text: "delete all highlights", action: "delete"},
    ],
    {}
  );
});

document.addEventListener("selectionchange", () => {
  if (!state.active) return;
  showPreview();
});

window.addEventListener("resize", () => {
  if (!state.active) return;
  updateHighlightRects();
});

window.addEventListener("scroll", () => {
  if (!state.active) return;
  updateHighlightRects();
  state.contextMenu.classList.remove("visible");

});

// logic for not showing cursor when leaving window, idk works

document.addEventListener("focus", () => {if (state.active) state.cursor.style.display = "block";});
document.addEventListener("mouseover", () => {if (state.active) state.cursor.style.display = "block";});
document.addEventListener("blur", () => {state.cursor.style.display = "none";});
window.addEventListener("mouseout", event => {if (!event.relatedTarget) state.cursor.style.display = "none";});

init();