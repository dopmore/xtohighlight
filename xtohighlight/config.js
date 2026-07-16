import { createCursor } from "./highlighter/cursor";

// general configs
export const CONFIG = {
  STORAGE_KEY: "highlights",

  DEFAULT_COLOR: "#ffff0050",

  COLORS = {
    yellow: "#ffff0050",
    red: "#ff000050",
    blue: "#0000ff50"
  },

  SELECTORS: {
    IGNORE_TAGS: [
      "INPUT",
      "TEXTAREA",
      "SELECT",
      "BUTTON"
    ]
  },

  RENDERER: {
    PADDING: 2,
  }, 
  CURSOR: {
    WIDTH_RATIO: 1.2,
    HEIGHT_RATIO: 1.2
  }
}