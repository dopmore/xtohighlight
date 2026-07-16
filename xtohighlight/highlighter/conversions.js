/**
 handle text/range conversions and mapping
 DOM Range <-> absolute text offsets
 ex.: "hello world" <-> hello = 0-5, world = 6-11
**/ 

import { state } from "./state"; 

function shouldIgnoreNode(node) {
  if(!node.parentElement) {
    return false;
  }

  const tag = node.parentElement.tagName;

  return (tag === "SCRIPT" || tag === "STYLE" || tag === "NOSCRIPT");
}

export function buildTextIndex() { // build index for conversions
  state.textOffsets.clear();

  const walker = document.createTreeWalker(
    document.body, 
    NodeFilter.SHOW_TEXT,
    {
      acceptNode(node) {
        if (!node.nodeValue || !node.nodeValue.length) {
          return NodeFilter.FILTER_REJECT;
        }
        if(shouldIgnoreNode(node)) {
          return NodeFilter.FILTER_REJECT;
        }
        return NodeFilter.FILTER_ACCEPT;
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

export function rangeToOffsets(range) { // convert DOM range into offset 
  let start = state.textOffsets.get(range.startContainer) + range.startOffset;
  let end = state.textOffsets.get(range.endContainer) + range.endOffset;

  if (isNaN(start) || isNaN(end)) {
    return null;
  }

  return {start: Math.min(start, end), end: Math.max(start, end)}; 
  // allow selecting backwards
}

export function getTextRanges(start, end) {
  const ranges = [];

  for (const [node, offset] of state.textOffsets) {
    const nodeEnd = node.nodeValue.length + offset;

    if (nodeEnd <= start) continue;
    if (offset >= end) break;

    const range = document.createRange();
    range.setStart(node, Math.max(0, start - offset));
    range.setEnd(node, Math.min(node.nodeValue.length, end - offset));
    // console.log(range);
    if (!range.collapsed) ranges.push(range);
  }
  return ranges;
} // offsetToRange not needed

export function getCurrentSelection() {
  const selection = window.getSelection();

  if (!selection || selection.rangeCount === 0 || selection.isCollapsed) return null;

  const range = selection.getRangeAt(0);

  if (!range.toString().trim()) return null;
  return range;
}
