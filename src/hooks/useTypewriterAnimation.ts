import { useCallback, useRef } from "react";
import * as opentype from "opentype.js";

export interface TypewriterOptions {
  font: opentype.Font;
  canvas: HTMLCanvasElement;
  text: string;
  fontSize: number;
  color: string;
  bgColor: string;
  transparent: boolean;
  charDelayMs: number;
  onComplete?: () => void;
  onProgress?: (charIndex: number) => void;
}

export function useTypewriterAnimation() {
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isRunning = useRef(false);

  const stop = useCallback(() => {
    if (timerRef.current) clearTimeout(timerRef.current);
    isRunning.current = false;
  }, []);

  const animate = useCallback((opts: TypewriterOptions) => {
    stop();
    isRunning.current = true;

    const { font, canvas, text, fontSize, color, bgColor, transparent, charDelayMs, onComplete, onProgress } = opts;
    const ctx = canvas.getContext("2d")!;
    const scale = fontSize / font.unitsPerEm;

    // Разбиваем на строки с авто-переносом
    const maxWidth = canvas.width - 40;
    const lineHeight = fontSize * 1.4;
    const lines: string[] = [];
    let currentLine = "";

    for (const word of text.split(/(\s|\n)/)) {
      if (word === "\n") { lines.push(currentLine); currentLine = ""; continue; }
      const test = currentLine + word;
      const bb = font.getPath(test, 0, 0, fontSize).getBoundingBox();
      if (bb.x2 > maxWidth && currentLine.length > 0) {
        lines.push(currentLine);
        currentLine = word;
      } else {
        currentLine = test;
      }
    }
    lines.push(currentLine);

    // Флаттен в массив {char, x, y}
    const allChars: { char: string; x: number; y: number }[] = [];
    let lineY = fontSize + 20;
    for (const line of lines) {
      let lx = 20;
      for (const char of line) {
        allChars.push({ char, x: lx, y: lineY });
        if (char === " ") { lx += fontSize * 0.3; continue; }
        const glyph = font.charToGlyph(char);
        lx += (glyph.advanceWidth || 0) * scale;
      }
      lineY += lineHeight;
    }

    const drawBg = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      if (!transparent) {
        ctx.fillStyle = bgColor;
        ctx.fillRect(0, 0, canvas.width, canvas.height);
      }
    };

    let idx = 0;
    const drawn: typeof allChars = [];

    const tick = () => {
      if (!isRunning.current || idx >= allChars.length) {
        if (idx >= allChars.length) onComplete?.();
        return;
      }

      drawn.push(allChars[idx]);
      onProgress?.(idx);

      drawBg();
      ctx.fillStyle = color;

      for (const c of drawn) {
        if (c.char === " ") continue;
        const p = font.getPath(c.char, c.x, c.y, fontSize);
        p.fill = color;
        p.draw(ctx);
      }

      // Мигающий курсор
      const last = drawn[drawn.length - 1];
      if (last) {
        ctx.fillStyle = color;
        ctx.fillRect(last.x + fontSize * 0.6, last.y - fontSize * 0.8, 2, fontSize * 0.9);
      }

      idx++;
      timerRef.current = setTimeout(tick, charDelayMs);
    };

    drawBg();
    tick();
  }, [stop]);

  return { animate, stop };
}
