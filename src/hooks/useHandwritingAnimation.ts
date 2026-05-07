import { useCallback, useRef } from "react";
import * as opentype from "opentype.js";

// Кубическая кривая Безье
function cubicBezier(t: number, p0: number, p1: number, p2: number, p3: number) {
  const u = 1 - t;
  return u * u * u * p0 + 3 * u * u * t * p1 + 3 * u * t * t * p2 + t * t * t * p3;
}

function quadBezier(t: number, p0: number, p1: number, p2: number) {
  const u = 1 - t;
  return u * u * p0 + 2 * u * t * p1 + t * t * p2;
}

// Разворачиваем путь opentype в массив точек
function flattenPath(path: opentype.Path, steps = 24): { x: number; y: number }[][] {
  const contours: { x: number; y: number }[][] = [];
  let current: { x: number; y: number }[] = [];
  let px = 0, py = 0;

  for (const cmd of path.commands) {
    if (cmd.type === "M") {
      if (current.length > 1) contours.push(current);
      current = [{ x: cmd.x, y: cmd.y }];
      px = cmd.x; py = cmd.y;
    } else if (cmd.type === "L") {
      current.push({ x: cmd.x, y: cmd.y });
      px = cmd.x; py = cmd.y;
    } else if (cmd.type === "C") {
      for (let i = 1; i <= steps; i++) {
        const t = i / steps;
        current.push({
          x: cubicBezier(t, px, cmd.x1, cmd.x2, cmd.x),
          y: cubicBezier(t, py, cmd.y1, cmd.y2, cmd.y),
        });
      }
      px = cmd.x; py = cmd.y;
    } else if (cmd.type === "Q") {
      for (let i = 1; i <= steps; i++) {
        const t = i / steps;
        current.push({
          x: quadBezier(t, px, cmd.x1, cmd.x),
          y: quadBezier(t, py, cmd.y1, cmd.y),
        });
      }
      px = cmd.x; py = cmd.y;
    } else if (cmd.type === "Z") {
      if (current.length > 1) {
        current.push({ ...current[0] }); // замкнуть
        contours.push(current);
      }
      current = [];
    }
  }
  if (current.length > 1) contours.push(current);
  return contours;
}

export interface AnimationOptions {
  font: opentype.Font;
  canvas: HTMLCanvasElement;
  text: string;
  fontSize: number;
  color: string;
  bgColor: string;
  transparent: boolean;
  /** Количество точек Безье в кадре (скорость) — 1..50, по умолчанию 6 */
  pointsPerFrame: number;
  /** Плавность — шаг разбивки кривых (4..32), влияет на гладкость */
  smoothness: number;
  onComplete?: () => void;
  onProgress?: (charIndex: number) => void;
}

interface CharEntry {
  char: string;
  /** Все контуры буквы в виде плоских точек */
  contours: { x: number; y: number }[][];
  /** Готовый путь opentype для финального fill-рендера */
  path: opentype.Path;
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
      bgColor, transparent, pointsPerFrame, smoothness, onComplete, onProgress,
    } = opts;

    const ctx = canvas.getContext("2d")!;
    const scale = fontSize / font.unitsPerEm;
    const maxWidth = canvas.width - 40;
    const lineHeight = fontSize * 1.4;

    // ── Разбиваем текст на строки ──
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

    // ── Собираем все символы ──
    const chars: CharEntry[] = [];
    let lineY = fontSize + 20;

    for (const line of lines) {
      let lx = 20;
      for (const char of line) {
        if (char === " " || char === "\t") {
          lx += (font.charToGlyph(" ").advanceWidth || fontSize * 0.3) * scale;
          continue;
        }
        const path = font.getPath(char, lx, lineY, fontSize);
        const contours = flattenPath(path, smoothness);
        if (contours.length > 0) {
          chars.push({ char, contours, path });
        }
        lx += (font.charToGlyph(char).advanceWidth || 0) * scale;
      }
      lineY += lineHeight;
    }

    if (chars.length === 0) { onComplete?.(); return; }

    // ── Хелперы рисования ──
    const drawBg = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      if (!transparent) {
        ctx.fillStyle = bgColor;
        ctx.fillRect(0, 0, canvas.width, canvas.height);
      }
    };

    // Рисует уже завершённый символ как fill (точный шрифт)
    const drawFinishedChar = (ch: CharEntry) => {
      ch.path.fill = color;
      ch.path.stroke = null;
      ch.path.draw(ctx);
    };

    // ── Состояние анимации ──
    const finishedChars: CharEntry[] = [];
    let charIdx = 0;
    let contourIdx = 0;
    const ptIdx = 0;

    // Смещение внутри текущего контура (сколько точек уже нарисовано)
    let drawnPts = 0;

    const redrawScene = () => {
      drawBg();
      // Рисуем все завершённые символы fill-ом (без изменения шрифта!)
      for (const fc of finishedChars) {
        drawFinishedChar(fc);
      }
    };

    const step = () => {
      if (!isRunning.current) return;

      if (charIdx >= chars.length) {
        onComplete?.();
        return;
      }

      const ch = chars[charIdx];
      const contour = ch.contours[contourIdx];

      // Двигаем указатель на pointsPerFrame точек вперёд
      drawnPts = Math.min(drawnPts + pointsPerFrame, contour ? contour.length : 0);

      // Перерисовываем всё
      redrawScene();

      // Рисуем текущий контур до drawnPts — как stroke поверх
      // Все уже завершённые контуры текущей буквы тоже рисуем stroke
      ctx.save();
      ctx.strokeStyle = color;
      ctx.lineWidth = Math.max(fontSize / 28, 1.2);
      ctx.lineCap = "round";
      ctx.lineJoin = "round";

      // Завершённые контуры текущей буквы (до contourIdx)
      for (let ci = 0; ci < contourIdx; ci++) {
        const c = ch.contours[ci];
        if (c.length < 2) continue;
        ctx.beginPath();
        ctx.moveTo(c[0].x, c[0].y);
        for (let i = 1; i < c.length; i++) ctx.lineTo(c[i].x, c[i].y);
        ctx.stroke();
      }

      // Текущий контур до drawnPts
      if (contour && drawnPts > 1) {
        ctx.beginPath();
        ctx.moveTo(contour[0].x, contour[0].y);
        for (let i = 1; i < drawnPts; i++) ctx.lineTo(contour[i].x, contour[i].y);
        ctx.stroke();
      }

      ctx.restore();

      // Переход к следующей точке / контуру / символу
      if (!contour || drawnPts >= contour.length) {
        contourIdx++;
        drawnPts = 0;

        if (contourIdx >= ch.contours.length) {
          // Символ завершён — добавляем в finishedChars как fill
          finishedChars.push(ch);
          onProgress?.(charIdx);
          charIdx++;
          contourIdx = 0;
          drawnPts = 0;
        }
      }

      animRef.current = requestAnimationFrame(step);
    };

    drawBg();
    animRef.current = requestAnimationFrame(step);
  }, [stop]);

  return { animate, stop };
}
