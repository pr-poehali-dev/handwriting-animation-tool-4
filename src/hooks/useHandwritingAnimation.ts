import { useCallback, useRef } from "react";
import * as opentype from "opentype.js";

export interface StrokePoint {
  x: number;
  y: number;
  type: "M" | "L" | "C" | "Q" | "Z";
  cp1?: { x: number; y: number };
  cp2?: { x: number; y: number };
}

export interface CharStroke {
  char: string;
  strokes: StrokePoint[][];
}

/**
 * Получаем все точки пути из Path команд opentype
 */
function pathToStrokes(path: opentype.Path): StrokePoint[][] {
  const strokes: StrokePoint[][] = [];
  let current: StrokePoint[] = [];
  let cx = 0, cy = 0;

  for (const cmd of path.commands) {
    if (cmd.type === "M") {
      if (current.length > 0) strokes.push(current);
      current = [{ x: cmd.x, y: cmd.y, type: "M" }];
      cx = cmd.x; cy = cmd.y;
    } else if (cmd.type === "L") {
      current.push({ x: cmd.x, y: cmd.y, type: "L" });
      cx = cmd.x; cy = cmd.y;
    } else if (cmd.type === "C") {
      current.push({
        x: cmd.x, y: cmd.y, type: "C",
        cp1: { x: cmd.x1, y: cmd.y1 },
        cp2: { x: cmd.x2, y: cmd.y2 },
      });
      cx = cmd.x; cy = cmd.y;
    } else if (cmd.type === "Q") {
      current.push({
        x: cmd.x, y: cmd.y, type: "Q",
        cp1: { x: cmd.x1, y: cmd.y1 },
      });
      cx = cmd.x; cy = cmd.y;
    } else if (cmd.type === "Z") {
      current.push({ x: cx, y: cy, type: "Z" });
      strokes.push(current);
      current = [];
    }
  }
  if (current.length > 0) strokes.push(current);
  return strokes.filter(s => s.length > 1);
}

/**
 * Интерполяция точки на кривой Безье (t от 0 до 1)
 */
function cubicBezier(t: number, p0: number, p1: number, p2: number, p3: number) {
  const u = 1 - t;
  return u * u * u * p0 + 3 * u * u * t * p1 + 3 * u * t * t * p2 + t * t * t * p3;
}

function quadBezier(t: number, p0: number, p1: number, p2: number) {
  const u = 1 - t;
  return u * u * p0 + 2 * u * t * p1 + t * t * p2;
}

/**
 * Раскладываем stroke в список точек для рисования с нужным разрешением
 */
function flattenStroke(stroke: StrokePoint[], steps = 20): { x: number; y: number }[] {
  const pts: { x: number; y: number }[] = [];
  let px = 0, py = 0;
  for (const p of stroke) {
    if (p.type === "M") {
      pts.push({ x: p.x, y: p.y });
      px = p.x; py = p.y;
    } else if (p.type === "L") {
      pts.push({ x: p.x, y: p.y });
      px = p.x; py = p.y;
    } else if (p.type === "C" && p.cp1 && p.cp2) {
      for (let i = 1; i <= steps; i++) {
        const t = i / steps;
        pts.push({
          x: cubicBezier(t, px, p.cp1.x, p.cp2.x, p.x),
          y: cubicBezier(t, py, p.cp1.y, p.cp2.y, p.y),
        });
      }
      px = p.x; py = p.y;
    } else if (p.type === "Q" && p.cp1) {
      for (let i = 1; i <= steps; i++) {
        const t = i / steps;
        pts.push({
          x: quadBezier(t, px, p.cp1.x, p.x),
          y: quadBezier(t, py, p.cp1.y, p.y),
        });
      }
      px = p.x; py = p.y;
    }
  }
  return pts;
}

export interface AnimationOptions {
  font: opentype.Font;
  canvas: HTMLCanvasElement;
  text: string;
  fontSize: number;
  color: string;
  bgColor: string;
  transparent: boolean;
  speedMs: number; // ms на символ
  onComplete?: () => void;
  onProgress?: (charIndex: number) => void;
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

    const { font, canvas, text, fontSize, color, bgColor, transparent, speedMs, onComplete, onProgress } = opts;
    const ctx = canvas.getContext("2d")!;
    const scale = fontSize / font.unitsPerEm;

    // Собираем все символы и их пути
    const chars: { char: string; strokes: { x: number; y: number }[][]; xOffset: number; yOffset: number }[] = [];
    const x = 20;
    const lineHeight = fontSize * 1.4;
    let lineY = fontSize + 20;
    const maxWidth = canvas.width - 40;

    // Разбиваем текст на строки с переносом
    const words = text.split(/(\s|\n)/);
    const lines: string[] = [];
    let currentLine = "";

    for (const word of words) {
      if (word === "\n") {
        lines.push(currentLine);
        currentLine = "";
        continue;
      }
      const test = currentLine + word;
      const testPath = font.getPath(test, 0, 0, fontSize);
      const bb = testPath.getBoundingBox();
      if (bb.x2 > maxWidth && currentLine.length > 0) {
        lines.push(currentLine);
        currentLine = word;
      } else {
        currentLine = test;
      }
    }
    lines.push(currentLine);

    // Собираем символы со смещениями
    for (const line of lines) {
      let lx = 20;
      for (const char of line) {
        if (char === " ") {
          lx += fontSize * 0.3;
          continue;
        }
        const glyphPath = font.getPath(char, lx, lineY, fontSize);
        const rawStrokes = pathToStrokes(glyphPath);
        const flatStrokes = rawStrokes.map(s => flattenStroke(s, 16));
        if (flatStrokes.length > 0) {
          chars.push({ char, strokes: flatStrokes, xOffset: lx, yOffset: lineY });
        }
        const glyph = font.charToGlyph(char);
        lx += (glyph.advanceWidth || 0) * scale;
      }
      lineY += lineHeight;
    }

    if (chars.length === 0) { onComplete?.(); return; }

    // Рисуем фон один раз
    const drawBg = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      if (!transparent) {
        ctx.fillStyle = bgColor;
        ctx.fillRect(0, 0, canvas.width, canvas.height);
      }
    };

    // Буфер уже нарисованных символов
    const drawnChars: typeof chars = [];
    let charIdx = 0;
    let strokeIdx = 0;
    let ptIdx = 0;

    const msPerPt = 8; // скорость внутри одной буквы
    let lastTime = 0;

    const redrawAll = () => {
      drawBg();
      ctx.strokeStyle = color;
      ctx.lineWidth = fontSize / 30;
      ctx.lineCap = "round";
      ctx.lineJoin = "round";
      for (const dc of drawnChars) {
        for (const stroke of dc.strokes) {
          if (stroke.length < 2) continue;
          ctx.beginPath();
          ctx.moveTo(stroke[0].x, stroke[0].y);
          for (let i = 1; i < stroke.length; i++) ctx.lineTo(stroke[i].x, stroke[i].y);
          ctx.stroke();
        }
      }
    };

    const step = (now: number) => {
      if (!isRunning.current) return;
      if (now - lastTime < msPerPt) {
        animRef.current = requestAnimationFrame(step);
        return;
      }
      lastTime = now;

      if (charIdx >= chars.length) {
        onComplete?.();
        return;
      }

      const ch = chars[charIdx];
      const stroke = ch.strokes[strokeIdx];

      redrawAll();
      ctx.strokeStyle = color;
      ctx.lineWidth = fontSize / 30;
      ctx.lineCap = "round";
      ctx.lineJoin = "round";

      // Рисуем текущий незавершённый штрих
      if (stroke && ptIdx > 0) {
        ctx.beginPath();
        ctx.moveTo(stroke[0].x, stroke[0].y);
        for (let i = 1; i <= ptIdx; i++) ctx.lineTo(stroke[i].x, stroke[i].y);
        ctx.stroke();
      }

      ptIdx++;
      if (!stroke || ptIdx >= stroke.length) {
        strokeIdx++;
        ptIdx = 0;
        if (strokeIdx >= ch.strokes.length) {
          drawnChars.push(ch);
          onProgress?.(charIdx);
          charIdx++;
          strokeIdx = 0;
          ptIdx = 0;
        }
      }

      animRef.current = requestAnimationFrame(step);
    };

    drawBg();
    animRef.current = requestAnimationFrame(step);
  }, [stop]);

  return { animate, stop };
}
