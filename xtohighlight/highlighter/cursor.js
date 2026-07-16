import { CONFIG } from "../config"; 
import { state } from "./state";

class Cursor {
  constructor() {
    this.cursor = null;
    this.createCursor();
  }


  createCursor() {
    const cursor = document.createElement("div");
  
    cursor.className = "cursor";
  
    document.body.appendChild(cursor);
  
    this.cursor = cursor;
  
    this.updateColor();
  }

  updateColor() {
    if(!this.cursor) return;

    this.cursor.style.background = state.color;
  }

  move(x, y, target) { // adjust to Fontsize
    if(!this.cursor) return;
    
    const style = window.getComputedStyle(target);
    
    const fontSize = Number.parseFloat(style.fontSize) || 16;
    
    const widht = fontSize * CONFIG.CURSOR.WIDTH_RATIO;
    const height = fontSize * CONFIG.CURSOR.HEIGHT_RATIO;
    
    this.cursor.style.cssText = {
      width: `${widht}px`,
      height: `${height}px`,
      left: `${x}px`,
      top: `${y}px`
    };
  }
  
  setActionState(active) {
    if(!this.cursor) return;
    this.cursor.classList.toggle("action-icons", active);
  }
  
  show() {
    if(!this.cursor) return;
    this.cursor.style.display = "block";
  }

  hide() {
    if(!this.cursor) return;
    this.cursor.style.display = "none";
  }

  destroy() {
    this.cursor?.remove();
    this.cursor = null;
  }
}

export const cursor = new Cursor();
