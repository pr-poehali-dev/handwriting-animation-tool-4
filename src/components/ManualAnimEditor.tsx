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

export default function ManualAnimEditor({ font, fontSize, color, onSave, onClose, existingData }: Props) {
  const [currentChar, setCurrentChar] = useState("А");
  const [strokes, setStrokes] = useState<Point[][]>([]);
  const [currentStroke, setCurrentStroke] = useState<Point[]>([]);
  const [isDrawing, setIsDrawing] = useState(false);
  const [savedChars, setSavedChars] = useState<CharData[]>(existingData);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const drawChar = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d")!;
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Grid bg
    ctx.fillStyle = "#0f0f0f";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.strokeStyle = "#1a1a1a";
    ctx.lineWidth = 1;
    for (let x = 0; x < canvas.width; x += 20) {
      ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, canvas.height); ctx.stroke();
    }
    for (let y = 0; y < canvas.height; y += 20) {
      ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(canvas.width, y); ctx.stroke();
    }

    // Фантомный символ (контур шрифта)
    const path = font.getPath(currentChar, 30, canvas.height / 2 + fontSize * 0.35, fontSize * 1.5);
    ctx.save();
    ctx.globalAlpha = 0.12;
    ctx.fillStyle = "#ffffff";
    path.fill = "#ffffff";
    path.draw(ctx);
    ctx.restore();

    // Нарисованные штрихи
    const allStrokes = [...strokes, ...(currentStroke.length > 1 ? [currentStroke] : [])];
    for (let si = 0; si < allStrokes.length; si++) {
      const stroke = allStrokes[si];
      if (stroke.length < 2) continue;
      ctx.beginPath();
      ctx.moveTo(stroke[0].x, stroke[0].y);
      for (let i = 1; i < stroke.length; i++) ctx.lineTo(stroke[i].x, stroke[i].y);
      ctx.strokeStyle = `hsl(${(si * 60) % 360}, 80%, 65%)`;
      ctx.lineWidth = 2.5;
      ctx.lineCap = "round";
      ctx.lineJoin = "round";
      ctx.stroke();

      // Точки
      for (const pt of stroke) {
        ctx.beginPath();
        ctx.arc(pt.x, pt.y, 3, 0, Math.PI * 2);
        ctx.fillStyle = `hsl(${(si * 60) % 360}, 80%, 65%)`;
        ctx.fill();
      }
    }
  }, [font, currentChar, fontSize, strokes, currentStroke]);

  useEffect(() => { drawChar(); }, [drawChar]);

  const getPos = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current!;
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    const client = "touches" in e ? e.touches[0] : e;
    return {
      x: (client.clientX - rect.left) * scaleX,
      y: (client.clientY - rect.top) * scaleY,
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

  const undoLast = () => { setStrokes(prev => prev.slice(0, -1)); };

  const saveChar = () => {
    if (strokes.length === 0) return;
    setSavedChars(prev => {
      const filtered = prev.filter(c => c.char !== currentChar);
      return [...filtered, { char: currentChar, strokes }];
    });
    // Переходим к следующему символу
    const idx = CHARS_TO_EDIT.indexOf(currentChar);
    if (idx < CHARS_TO_EDIT.length - 1) {
      setCurrentChar(CHARS_TO_EDIT[idx + 1]);
      setStrokes([]);
    }
  };

  const loadChar = (ch: string) => {
    setCurrentChar(ch);
    const found = savedChars.find(c => c.char === ch);
    setStrokes(found ? found.strokes : []);
  };

  const isSaved = (ch: string) => savedChars.some(c => c.char === ch);

  return (
    <div className="fixed inset-0 z-50 flex" style={{ background: "rgba(0,0,0,0.92)" }}>
      {/* Left: char list */}
      <div
        className="flex flex-col overflow-hidden flex-shrink-0"
        style={{ width: 220, background: "#111", borderRight: "1px solid #222" }}
      >
        <div className="p-3" style={{ borderBottom: "1px solid #222" }}>
          <p className="text-xs font-medium mb-1" style={{ color: "#888" }}>Символы для настройки</p>
          <p className="text-xs" style={{ color: "#555" }}>Нажмите на символ → нарисуйте штрихи → Сохранить</p>
        </div>
        <div className="flex-1 overflow-y-auto p-2 flex flex-wrap gap-1">
          {CHARS_TO_EDIT.split("").map(ch => (
            <button
              key={ch}
              onClick={() => loadChar(ch)}
              className="w-8 h-8 rounded text-sm font-mono transition-all duration-100 flex items-center justify-center"
              style={{
                background: ch === currentChar ? "#2a2a2a" : "transparent",
                border: ch === currentChar ? "1px solid #444" : "1px solid transparent",
                color: isSaved(ch) ? "#4ade80" : "#666",
              }}
            >
              {ch}
            </button>
          ))}
        </div>
        <div className="p-3" style={{ borderTop: "1px solid #222" }}>
          <p className="text-xs mb-2" style={{ color: "#4ade80" }}>
            Настроено: {savedChars.length} / {CHARS_TO_EDIT.length}
          </p>
          <button
            onClick={() => onSave(savedChars)}
            className="w-full py-2 rounded text-xs font-medium transition-all"
            style={{ background: "#e5e5e5", color: "#0f0f0f" }}
          >
            Применить настройки
          </button>
        </div>
      </div>

      {/* Center: canvas */}
      <div className="flex-1 flex flex-col items-center justify-center gap-4 p-6">
        <div className="flex items-center gap-3 mb-2">
          <span className="text-4xl font-mono" style={{ color: "#e5e5e5", fontFamily: "serif" }}>{currentChar}</span>
          <span className="text-sm" style={{ color: "#555" }}>— нарисуйте штрихи как пишется эта буква</span>
        </div>

        <canvas
          ref={canvasRef}
          width={400}
          height={300}
          className="rounded cursor-crosshair"
          style={{ border: "1px solid #222", touchAction: "none", width: 400, height: 300 }}
          onMouseDown={onMouseDown}
          onMouseMove={onMouseMove}
          onMouseUp={onMouseUp}
          onMouseLeave={onMouseUp}
        />

        <div className="flex items-center gap-2">
          <button
            onClick={undoLast}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded text-xs transition-all"
            style={{ background: "#1a1a1a", border: "1px solid #2a2a2a", color: "#888" }}
          >
            <Icon name="Undo" size={12} /> Отменить
          </button>
          <button
            onClick={clearStrokes}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded text-xs transition-all"
            style={{ background: "#1a1a1a", border: "1px solid #2a2a2a", color: "#888" }}
          >
            <Icon name="Trash2" size={12} /> Очистить
          </button>
          <button
            onClick={saveChar}
            disabled={strokes.length === 0}
            className="flex items-center gap-1.5 px-4 py-1.5 rounded text-xs font-medium transition-all"
            style={{
              background: strokes.length > 0 ? "#e5e5e5" : "#1a1a1a",
              color: strokes.length > 0 ? "#0f0f0f" : "#444",
              border: "1px solid transparent",
            }}
          >
            <Icon name="Check" size={12} /> Сохранить и далее
          </button>
        </div>

        <p className="text-xs" style={{ color: "#444" }}>
          Зажмите и ведите мышью — каждый отрыв создаёт новый штрих
        </p>
      </div>

      {/* Close */}
      <button
        onClick={onClose}
        className="absolute top-4 right-4 w-8 h-8 flex items-center justify-center rounded transition-all"
        style={{ background: "#1a1a1a", color: "#666" }}
      >
        <Icon name="X" size={14} />
      </button>
    </div>
  );
}
