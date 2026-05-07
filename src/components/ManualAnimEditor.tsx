import { useState, useRef, useCallback, useEffect } from "react";
import * as opentype from "opentype.js";
import Icon from "@/components/ui/icon";

interface Point { x: number; y: number; }
interface CharData { char: string; strokes: Point[][]; }

interface Props {
  font: opentype.Font;
  fontSize: number;
  color: string;
  onSave: (data: CharData[]) => void;
  onClose: () => void;
  existingData: CharData[];
}

const CHARS_TO_EDIT = "АБВГДЕЁЖЗИЙКЛМНОПРСТУФХЦЧШЩЪЫЬЭЮЯабвгдеёжзийклмнопрстуфхцчшщъыьэюяABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789.,!?-–—:;\"'()";

const CANVAS_W = 420;
const CANVAS_H = 320;

export default function ManualAnimEditor({ font, fontSize, color, onSave, onClose, existingData }: Props) {
  const [currentChar, setCurrentChar] = useState(CHARS_TO_EDIT[0]);
  const [strokes, setStrokes] = useState<Point[][]>([]);
  const [currentStroke, setCurrentStroke] = useState<Point[]>([]);
  const [isDrawing, setIsDrawing] = useState(false);
  const [savedChars, setSavedChars] = useState<CharData[]>(existingData);
  const [previewPlaying, setPreviewPlaying] = useState(false);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const previewRef = useRef<number | null>(null);

  const refFontSize = Math.min(fontSize * 1.8, 160);
  const refX = CANVAS_W / 2 - refFontSize * 0.3;
  const refY = CANVAS_H / 2 + refFontSize * 0.35;

  const drawScene = useCallback((overrideStrokes?: Point[][], animStrokeIdx?: number, animPtIdx?: number) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d")!;

    // Фон
    ctx.fillStyle = "#0d0d0d";
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Сетка
    ctx.strokeStyle = "#181818";
    ctx.lineWidth = 1;
    for (let x = 0; x <= canvas.width; x += 24) {
      ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, canvas.height); ctx.stroke();
    }
    for (let y = 0; y <= canvas.height; y += 24) {
      ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(canvas.width, y); ctx.stroke();
    }

    // Базовая линия
    ctx.strokeStyle = "#1e2e1e";
    ctx.lineWidth = 1;
    ctx.setLineDash([4, 4]);
    ctx.beginPath(); ctx.moveTo(0, refY); ctx.lineTo(canvas.width, refY); ctx.stroke();
    ctx.setLineDash([]);

    // Фантомная буква (контур шрифта) — светлая подложка
    const path = font.getPath(currentChar, refX, refY, refFontSize);
    ctx.save();
    ctx.globalAlpha = 0.18;
    ctx.fillStyle = "#ffffff";
    path.fill = "#ffffff";
    path.draw(ctx);
    ctx.restore();

    const displayStrokes = overrideStrokes ?? strokes;
    const allStrokes = [...displayStrokes, ...(currentStroke.length > 1 ? [currentStroke] : [])];

    // Рисуем штрихи
    for (let si = 0; si < allStrokes.length; si++) {
      const stroke = allStrokes[si];
      if (stroke.length < 2) continue;

      const isAnimating = animStrokeIdx !== undefined;
      const isCurrentAnim = isAnimating && si === animStrokeIdx;
      const isPastAnim = isAnimating && si < animStrokeIdx!;
      const hue = (si * 55 + 30) % 360;

      const pts = isCurrentAnim ? stroke.slice(0, animPtIdx ?? stroke.length) : stroke;
      if (pts.length < 2) continue;

      // Тень для глубины
      ctx.shadowColor = `hsla(${hue}, 80%, 60%, 0.3)`;
      ctx.shadowBlur = 4;

      ctx.beginPath();
      ctx.moveTo(pts[0].x, pts[0].y);
      for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i].x, pts[i].y);
      ctx.strokeStyle = isPastAnim
        ? `hsla(${hue}, 60%, 55%, 0.7)`
        : `hsl(${hue}, 80%, 65%)`;
      ctx.lineWidth = isCurrentAnim ? 2.5 : 2;
      ctx.lineCap = "round";
      ctx.lineJoin = "round";
      ctx.stroke();

      ctx.shadowBlur = 0;

      // Стартовая точка (только не в режиме анимации)
      if (!isAnimating) {
        ctx.beginPath();
        ctx.arc(stroke[0].x, stroke[0].y, 5, 0, Math.PI * 2);
        ctx.fillStyle = `hsl(${hue}, 90%, 70%)`;
        ctx.fill();
        // Цифра порядка штриха
        ctx.font = "bold 10px IBM Plex Mono, monospace";
        ctx.fillStyle = "#0d0d0d";
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillText(String(si + 1), stroke[0].x, stroke[0].y);
      }

      // Стрелка направления на конце (только не в режиме анимации)
      if (!isAnimating && stroke.length >= 2) {
        const last = stroke[stroke.length - 1];
        const prev = stroke[Math.max(0, stroke.length - 3)];
        const dx = last.x - prev.x, dy = last.y - prev.y;
        const len = Math.sqrt(dx * dx + dy * dy);
        if (len > 0) {
          const nx = dx / len, ny = dy / len;
          const arrowSize = 8;
          ctx.beginPath();
          ctx.moveTo(last.x, last.y);
          ctx.lineTo(last.x - nx * arrowSize - ny * arrowSize * 0.5, last.y - ny * arrowSize + nx * arrowSize * 0.5);
          ctx.moveTo(last.x, last.y);
          ctx.lineTo(last.x - nx * arrowSize + ny * arrowSize * 0.5, last.y - ny * arrowSize - nx * arrowSize * 0.5);
          ctx.strokeStyle = `hsl(${hue}, 80%, 65%)`;
          ctx.lineWidth = 1.5;
          ctx.stroke();
        }
      }
    }

    ctx.textAlign = "left";
    ctx.textBaseline = "alphabetic";
  }, [font, currentChar, refX, refY, refFontSize, strokes, currentStroke]);

  useEffect(() => { drawScene(); }, [drawScene]);

  // Превью анимации
  const playPreview = useCallback(() => {
    if (strokes.length === 0) return;
    setPreviewPlaying(true);
    let si = 0, pi = 0;
    const spd = 3;
    const tick = () => {
      if (si >= strokes.length) {
        setPreviewPlaying(false);
        drawScene(); // сбросить
        return;
      }
      pi = Math.min(pi + spd, strokes[si].length);
      drawScene(strokes, si, pi);
      if (pi >= strokes[si].length) { si++; pi = 0; }
      previewRef.current = requestAnimationFrame(tick);
    };
    previewRef.current = requestAnimationFrame(tick);
  }, [strokes, drawScene]);

  useEffect(() => {
    return () => { if (previewRef.current) cancelAnimationFrame(previewRef.current); };
  }, []);

  const getPos = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current!;
    const rect = canvas.getBoundingClientRect();
    return {
      x: (e.clientX - rect.left) * (canvas.width / rect.width),
      y: (e.clientY - rect.top) * (canvas.height / rect.height),
    };
  };

  const onMouseDown = (e: React.MouseEvent<HTMLCanvasElement>) => {
    setIsDrawing(true);
    setCurrentStroke([getPos(e)]);
  };

  const onMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!isDrawing) return;
    setCurrentStroke(prev => [...prev, getPos(e)]);
  };

  const onMouseUp = () => {
    if (isDrawing && currentStroke.length > 1) {
      setStrokes(prev => [...prev, currentStroke]);
    }
    setCurrentStroke([]);
    setIsDrawing(false);
  };

  const clearStrokes = () => { setStrokes([]); setCurrentStroke([]); };
  const undoLast = () => setStrokes(prev => prev.slice(0, -1));

  const saveChar = () => {
    if (strokes.length === 0) return;
    const newSaved = savedChars.filter(c => c.char !== currentChar).concat({ char: currentChar, strokes });
    setSavedChars(newSaved);
    const idx = CHARS_TO_EDIT.indexOf(currentChar);
    const next = CHARS_TO_EDIT[idx + 1];
    if (next) {
      setCurrentChar(next);
      const found = newSaved.find(c => c.char === next);
      setStrokes(found?.strokes ?? []);
    }
  };

  const loadChar = (ch: string) => {
    setCurrentChar(ch);
    const found = savedChars.find(c => c.char === ch);
    setStrokes(found?.strokes ?? []);
    setCurrentStroke([]);
  };

  const isSaved = (ch: string) => savedChars.some(c => c.char === ch);

  return (
    <div className="fixed inset-0 z-50 flex" style={{ background: "rgba(0,0,0,0.95)" }}>

      {/* Left panel: символы */}
      <div className="flex flex-col flex-shrink-0 overflow-hidden"
        style={{ width: 200, background: "#0f0f0f", borderRight: "1px solid #1e1e1e" }}>
        <div className="p-3" style={{ borderBottom: "1px solid #1e1e1e" }}>
          <p className="text-xs font-semibold mb-0.5" style={{ color: "#888" }}>Символы</p>
          <p className="text-xs leading-snug" style={{ color: "#3a3a3a" }}>
            Выберите букву и нарисуйте штрихи в порядке написания
          </p>
        </div>
        <div className="flex-1 overflow-y-auto p-2 flex flex-wrap gap-0.5">
          {CHARS_TO_EDIT.split("").map(ch => (
            <button key={ch} onClick={() => loadChar(ch)}
              className="w-7 h-7 rounded text-xs font-mono flex items-center justify-center transition-all"
              style={{
                background: ch === currentChar ? "#1e2e1e" : "transparent",
                border: `1px solid ${ch === currentChar ? "#2a4a2a" : "transparent"}`,
                color: isSaved(ch) ? "#4ade80" : ch === currentChar ? "#e5e5e5" : "#444",
              }}>
              {ch}
            </button>
          ))}
        </div>
        <div className="p-3" style={{ borderTop: "1px solid #1e1e1e" }}>
          <p className="text-xs mb-2" style={{ color: isSaved(currentChar) ? "#4ade80" : "#444" }}>
            {savedChars.length} из {CHARS_TO_EDIT.length} настроено
          </p>
          <button onClick={() => onSave(savedChars)}
            className="w-full py-2 rounded text-xs font-semibold"
            style={{ background: savedChars.length > 0 ? "#e5e5e5" : "#1a1a1a", color: savedChars.length > 0 ? "#0a0a0a" : "#333" }}>
            Применить
          </button>
        </div>
      </div>

      {/* Center: canvas */}
      <div className="flex-1 flex flex-col items-center justify-center gap-4 p-6">

        {/* Header */}
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <span className="text-5xl" style={{
              color: "#4ade80",
              fontFamily: "serif",
              lineHeight: 1,
            }}>
              {currentChar}
            </span>
          </div>
          <div style={{ color: "#3a3a3a", fontSize: 12, maxWidth: 260, lineHeight: 1.5 }}>
            <p style={{ color: "#666", marginBottom: 2 }}>
              Нарисуйте штрихи <strong style={{ color: "#888" }}>в порядке написания</strong>
            </p>
            <p>Каждый отрыв мыши = новый штрих. Цифры показывают порядок.</p>
          </div>
        </div>

        <canvas ref={canvasRef} width={CANVAS_W} height={CANVAS_H}
          className="cursor-crosshair"
          style={{ border: "1px solid #1e1e1e", borderRadius: 4, touchAction: "none", width: CANVAS_W, height: CANVAS_H }}
          onMouseDown={onMouseDown}
          onMouseMove={onMouseMove}
          onMouseUp={onMouseUp}
          onMouseLeave={onMouseUp}
        />

        {/* Controls */}
        <div className="flex items-center gap-2">
          <button onClick={undoLast}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded text-xs transition-all"
            style={{ background: "#161616", border: "1px solid #222", color: "#666" }}>
            <Icon name="Undo" size={12} /> Отменить
          </button>
          <button onClick={clearStrokes}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded text-xs transition-all"
            style={{ background: "#161616", border: "1px solid #222", color: "#666" }}>
            <Icon name="Trash2" size={12} /> Очистить
          </button>
          <button onClick={playPreview} disabled={strokes.length === 0 || previewPlaying}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded text-xs transition-all"
            style={{
              background: strokes.length > 0 && !previewPlaying ? "#1a2030" : "#161616",
              border: `1px solid ${strokes.length > 0 && !previewPlaying ? "#2a4060" : "#222"}`,
              color: strokes.length > 0 && !previewPlaying ? "#7eb8f7" : "#444",
            }}>
            <Icon name="Play" size={12} /> {previewPlaying ? "Играет…" : "Превью"}
          </button>
          <button onClick={saveChar} disabled={strokes.length === 0}
            className="flex items-center gap-1.5 px-4 py-1.5 rounded text-xs font-semibold transition-all"
            style={{
              background: strokes.length > 0 ? "#e5e5e5" : "#161616",
              color: strokes.length > 0 ? "#0a0a0a" : "#333",
              border: "1px solid transparent",
            }}>
            <Icon name="Check" size={12} /> Сохранить
          </button>
        </div>

        <p style={{ color: "#2a2a2a", fontSize: 11 }}>
          Штрихов: {strokes.length} · Нарисуйте так, как пишет рука
        </p>
      </div>

      <button onClick={onClose}
        className="absolute top-4 right-4 w-8 h-8 flex items-center justify-center rounded transition-all"
        style={{ background: "#161616", color: "#555", border: "1px solid #222" }}>
        <Icon name="X" size={14} />
      </button>
    </div>
  );
}
