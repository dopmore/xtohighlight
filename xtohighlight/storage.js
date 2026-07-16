import { CONFIG } from "./config";

export const storage = {
  async loadHighlights() {
    try {
      const result = await browser.storage.local.get(CONFIG.STORAGE_KEY);
      
      return result[CONFIG.STORAGE_KEY] ?? [];
    } catch (error) {
      console.error("Failed loading Highlights: ", error);
      return [];
    }
  },

  async saveHighlights(highlights) {
    try {
      await browser.storage.local.set({[CONFIG.STORAGE_KEY]: highlights});
    } catch (error) {
      console.error("Failed saving Highlights: ", error);
    }
  },

  async clear() {
    try {
      await browser.storage.local.remove(CONFIG.STORAGE_KEY);
    } catch (error) {
      console.error("Failed clearing Highlights: ", error);
    }
  }
}
