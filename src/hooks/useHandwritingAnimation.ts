import { useCallback, useRef } from "react";
import * as opentype from "opentype.js";

/** Строит Path2D из команд opentype.Path */
function buildPath2D(path: opentype.Path): Path2D {
  const p2d = new Path2D();
  for (const cmd of path.commands) {
    if (cmd.type === "M") p2d.moveTo(cmd.x, cmd.y);
    else if (cmd.type === "L") p2d.lineTo(cmd.x, cmd.y);
    else if (cmd.type === "C") p2d.bezierCurveTo(cmd.x1, cmd.y1, cmd.x2, cmd.y2, cmd.x, cmd.y);
    else if (cmd.type === "Q") p2d.quadraticCurveTo(cmd.x1, cmd.y1, cmd.x, cmd.y);
    else if (cmd.type === "Z") p2d.closePath();
  }
  return p2d;
}

export interface AnimationOptions {
  font: opentype.Font;
  canvas: HTMLCanvasElement;
  text: string;
  fontSize: number;
  color: string;
  bgColor: string;
  transparent: boolean;
  /** Пикселей в кадре (скорость): 1..80 */
  pointsPerFrame: number;
  /** Не используется в этой реализации, оставлен для совместимости */
  smoothness: number;
  /** Данные ручной настройки (если есть) */
  manualData?: { char: string; strokes: { x: number; y: number }[][] }[];
  onComplete?: () => void;
  onProgress?: (charIndex: number) => void;
}

interface CharEntry {
  path: opentype.Path;
  path2d: Path2D;
  bb: { x1: number; y1: number; x2: number; y2: number };
  /** Пути для ручной анимации (абс. координаты) */
  manualStrokes?: { x: number; y: number }[][];
  xOffset: number;
  yOffset: number;
}

/** Разбивает текст на строки с автопереносом */
function buildLines(
  font: opentype.Font,
  text: string,
  fontSize: number,
  maxWidth: number,
): string[] {
  const lines: string[] = [];
  let cur = "";
  for (const word of text.split(/(\s|\n)/)) {
    if (word === "\n") { lines.push(cur); cur = ""; continue; }
    const test = cur + word;
    const bb = font.getPath(test, 0, 0, fontSize).getBoundingBox();
    if (bb.x2 > maxWidth && cur.length > 0) {
      lines.push(cur); cur = word;
    } else {
      cur = test;
    }
  }
  lines.push(cur);
  return lines;
}

export function useHandwritingAnimation() {
  const animRef = useRef<number | null>(null);
  const isRunning = useRef(false);

  const stop = useCallback(() => {
    if (animRef.current) cancelAnimationFrame(animRef.current);
    isRunning.current = false;
  }, []);

  const animate = useCallback((opts: AnimationOptions) => {
    stop();
    isRunning.current = true;

    const {
      font, canvas, text, fontSize, color,
      bgColor, transparent, pointsPerFrame, manualData,
      onComplete, onProgress,
    } = opts;

    const ctx = canvas.getContext("2d")!;
    const scale = fontSize / font.unitsPerEm;
    const maxWidth = canvas.width - 40;
    const lineHeight = fontSize * 1.4;
    const padding = 20;

    // ── Строим список символов ──
    const lines = buildLines(font, text, fontSize, maxWidth);
    const chars: CharEntry[] = [];
    let lineY = fontSize + padding;

    for (const line of lines) {
      let lx = padding;
      for (const char of line) {
        if (char === " " || char === "\t") {
          lx += (font.charToGlyph(" ").advanceWidth || fontSize * 0.3) * scale;
          continue;
        }
        const path = font.getPath(char, lx, lineY, fontSize);
        const path2d = buildPath2D(path);
        const bb = path.getBoundingBox();

        let manualStrokes: { x: number; y: number }[][] | undefined;
        if (manualData) {
          const found = manualData.find(d => d.char === char);
          if (found && found.strokes.length > 0) {
            // Нормализуем: штрихи из редактора рисовались при размере fontSize*1.5 и x=30, y=canvasH/2+...
            // Применяем affine к текущей позиции буквы
            const refFontSize = fontSize * 1.5;
            const refX = 30;
            const refY = 300 / 2 + refFontSize * 0.35; // 300 — высота канваса редактора
            const srcPath = font.getPath(char, refX, refY, refFontSize);
            const srcBB = srcPath.getBoundingBox();
            const dstBB = bb;
            const scaleXM = (dstBB.x2 - dstBB.x1) / Math.max(srcBB.x2 - srcBB.x1, 1);
            const scaleYM = (dstBB.y2 - dstBB.y1) / Math.max(srcBB.y2 - srcBB.y1, 1);
            manualStrokes = found.strokes.map(stroke =>
              stroke.map(pt => ({
                x: dstBB.x1 + (pt.x - srcBB.x1) * scaleXM,
                y: dstBB.y1 + (pt.y - srcBB.y1) * scaleYM,
              }))
            );
          }
        }

        if (bb.x2 > bb.x1 || bb.y2 > bb.y1) {
          chars.push({ path, path2d, bb, manualStrokes, xOffset: lx, yOffset: lineY });
        }
        lx += (font.charToGlyph(char).advanceWidth || 0) * scale;
      }
      lineY += lineHeight;
    }

    if (chars.length === 0) { onComplete?.(); return; }

    // ── Рисование фона ──
    const drawBg = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      if (!transparent) {
        ctx.fillStyle = bgColor;
        ctx.fillRect(0, 0, canvas.width, canvas.height);
      }
    };

    // Рисует символ полностью (fill)
    const drawFullChar = (ch: CharEntry) => {
      ctx.save();
      ctx.fillStyle = color;
      ctx.fill(ch.path2d, "evenodd");
      ctx.restore();
    };

    // ── Анимация ──
    const finishedChars: CharEntry[] = [];
    let charIdx = 0;

    // Для clip-reveal (авто): прогресс X слева направо по bbox символа
    let revealX = 0;

    // Для ручной анимации: индекс штриха и точки
    let manualStrokeIdx = 0;
    let manualPtIdx = 0;

    const redrawFinished = () => {
      drawBg();
      for (const fc of finishedChars) drawFullChar(fc);
    };

    const step = () => {
      if (!isRunning.current) return;

      if (charIdx >= chars.length) {
        onComplete?.();
        return;
      }

      const ch = chars[charIdx];

      // ── РУЧНАЯ анимация ──
      if (ch.manualStrokes && ch.manualStrokes.length > 0) {
        const strokes = ch.manualStrokes;
        const stroke = strokes[manualStrokeIdx];

        if (!stroke) {
          // Все штрихи завершены
          finishedChars.push(ch);
          onProgress?.(charIdx);
          charIdx++;
          manualStrokeIdx = 0;
          manualPtIdx = 0;
          revealX = 0;
          animRef.current = requestAnimationFrame(step);
          return;
        }

        manualPtIdx = Math.min(manualPtIdx + pointsPerFrame, stroke.length);

        redrawFinished();

        // Рисуем завершённые штрихи текущей буквы
        ctx.save();
        ctx.strokeStyle = color;
        ctx.lineWidth = Math.max(fontSize / 22, 1.5);
        ctx.lineCap = "round";
        ctx.lineJoin = "round";

        for (let si = 0; si < manualStrokeIdx; si++) {
          const s = strokes[si];
          if (s.length < 2) continue;
          ctx.beginPath();
          ctx.moveTo(s[0].x, s[0].y);
          for (let i = 1; i < s.length; i++) ctx.lineTo(s[i].x, s[i].y);
          ctx.stroke();
        }
        // Текущий штрих до manualPtIdx
        if (stroke.length >= 2 && manualPtIdx > 1) {
          ctx.beginPath();
          ctx.moveTo(stroke[0].x, stroke[0].y);
          for (let i = 1; i < manualPtIdx; i++) ctx.lineTo(stroke[i].x, stroke[i].y);
          ctx.stroke();
        }
        ctx.restore();

        if (manualPtIdx >= stroke.length) {
          manualStrokeIdx++;
          manualPtIdx = 0;
        }

        animRef.current = requestAnimationFrame(step);
        return;
      }

      // ── АВТО анимация (clip-reveal слева направо) ──
      const { bb } = ch;
      const charWidth = Math.max(bb.x2 - bb.x1, 1);
      // Добавляем небольшой запас чтобы правый край точно открылся
      const totalWidth = charWidth + fontSize * 0.08;

      revealX = Math.min(revealX + pointsPerFrame, totalWidth);

      redrawFinished();

      // Clip по форме буквы + рисуем прямоугольник раскрытия
      ctx.save();
      ctx.clip(ch.path2d, "evenodd");
      ctx.fillStyle = color;
      ctx.fillRect(bb.x1 - 2, bb.y1 - fontSize * 0.2, revealX + 2, (bb.y2 - bb.y1) + fontSize * 0.4);
      ctx.restore();

      if (revealX >= totalWidth) {
        // Символ полностью открыт — записываем как fill
        finishedChars.push(ch);
        onProgress?.(charIdx);
        charIdx++;
        revealX = 0;
        manualStrokeIdx = 0;
        manualPtIdx = 0;
      }

      animRef.current = requestAnimationFrame(step);
    };

    drawBg();
    animRef.current = requestAnimationFrame(step);
  }, [stop]);

  return { animate, stop };
}
