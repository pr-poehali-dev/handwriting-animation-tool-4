import { useState, useRef, useCallback, useEffect } from "react";
import Icon from "@/components/ui/icon";
import { useFont } from "@/hooks/useFont";
import { useHandwritingAnimation } from "@/hooks/useHandwritingAnimation";
import { useTypewriterAnimation } from "@/hooks/useTypewriterAnimation";
import { useExportMP4 } from "@/hooks/useExportMP4";
import ManualAnimEditor from "@/components/ManualAnimEditor";
import * as opentype from "opentype.js";

const FORMATS = [
  { id: "16:9", label: "16:9", w: 1280, h: 720 },
  { id: "9:16", label: "9:16", w: 720, h: 1280 },
  { id: "4:3", label: "4:3", w: 1024, h: 768 },
  { id: "fullhd", label: "Full HD", w: 1920, h: 1080 },
];

const ANIM_MODES = [
  { id: "handwriting", label: "Автоматическая анимация символов", icon: "PenLine" },
  { id: "typewriter", label: "Печатная машинка", icon: "Type" },
  { id: "manual", label: "Ручная настройка анимации", icon: "SlidersHorizontal" },
] as const;
type AnimMode = "handwriting" | "typewriter" | "manual";

const PRESET_COLORS = ["#000000", "#ffffff", "#1a1a1a", "#e5e5e5", "#7eb8f7", "#e06c75", "#4ade80", "#e5c07b"];
const PRESET_BG = ["#ffffff", "#f5f5f5", "#000000", "#0f0f0f", "#1a1a2e", "#f0e6d3", "#e8f4f8", "#fef9ef"];

interface ManualCharData { char: string; strokes: { x: number; y: number }[][]; }

function drawStaticText(
  canvas: HTMLCanvasElement,
  font: opentype.Font,
  text: string,
  fontSize: number,
  color: string,
  bgColor: string,
  transparent: boolean,
) {
  const ctx = canvas.getContext("2d")!;
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  if (!transparent) {
    ctx.fillStyle = bgColor;
    ctx.fillRect(0, 0, canvas.width, canvas.height);
  }
  if (!text) return;

  const scale = fontSize / font.unitsPerEm;
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

  let ly = fontSize + 20;
  for (const line of lines) {
    let lx = 20;
    for (const char of line) {
      if (char === " ") { lx += fontSize * 0.3; continue; }
      const p = font.getPath(char, lx, ly, fontSize);
      p.fill = color;
      p.draw(ctx);
      const glyph = font.charToGlyph(char);
      lx += (glyph.advanceWidth || 0) * scale;
    }
    ly += lineHeight;
  }
}

export default function Index() {
  const { loadedFont, loading: fontLoading, error: fontError, loadFont } = useFont();
  const { animate: animateHandwriting, stop: stopHandwriting } = useHandwritingAnimation();
  const { animate: animateTypewriter, stop: stopTypewriter } = useTypewriterAnimation();
  const { startRecording, stopRecording } = useExportMP4();

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [text, setText] = useState("");
  const [fontSize, setFontSize] = useState(64);
  const [fontColor, setFontColor] = useState("#000000");
  const [bgColor, setBgColor] = useState("#ffffff");
  const [transparent, setTransparent] = useState(false);
  const [format, setFormat] = useState(FORMATS[0]);
  const [animMode, setAnimMode] = useState<AnimMode>("handwriting");
  const [animSpeed, setAnimSpeed] = useState(80);
  const [isAnimating, setIsAnimating] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [showManualEditor, setShowManualEditor] = useState(false);
  const [manualData, setManualData] = useState<ManualCharData[]>([]);
  const [fontWeight, setFontWeight] = useState(400);
  const [fontStyle, setFontStyle] = useState<"normal" | "italic">("normal");
  const [textAlign, setTextAlign] = useState<"left" | "center" | "right">("left");

  useEffect(() => {
    if (!loadedFont || !canvasRef.current || isAnimating) return;
    drawStaticText(canvasRef.current, loadedFont.font, text, fontSize, fontColor, bgColor, transparent);
  }, [text, fontSize, fontColor, bgColor, transparent, loadedFont, isAnimating]);

  useEffect(() => {
    if (!canvasRef.current) return;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext("2d")!;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    if (!transparent) { ctx.fillStyle = bgColor; ctx.fillRect(0, 0, canvas.width, canvas.height); }
    if (loadedFont && text) {
      drawStaticText(canvas, loadedFont.font, text, fontSize, fontColor, bgColor, transparent);
    }
  }, [format]);

  const stopAll = useCallback(() => {
    stopHandwriting(); stopTypewriter(); setIsAnimating(false);
  }, [stopHandwriting, stopTypewriter]);

  const runAnimation = useCallback(() => {
    if (!loadedFont || !canvasRef.current || !text.trim()) return;
    stopAll();
    setIsAnimating(true);

    const common = {
      font: loadedFont.font,
      canvas: canvasRef.current,
      text,
      fontSize,
      color: fontColor,
      bgColor,
      transparent,
      onComplete: () => setIsAnimating(false),
    };

    if (animMode === "typewriter") {
      animateTypewriter({ ...common, charDelayMs: animSpeed });
    } else {
      animateHandwriting({ ...common, speedMs: animSpeed });
    }
  }, [loadedFont, text, fontSize, fontColor, bgColor, transparent, animMode, animSpeed, animateHandwriting, animateTypewriter, stopAll]);

  const handleExport = useCallback(() => {
    if (!canvasRef.current || !loadedFont || !text.trim()) return;
    if (isRecording) {
      stopRecording();
      setIsRecording(false);
      return;
    }
    startRecording({
      canvas: canvasRef.current, fps: 30,
      onStart: () => setIsRecording(true),
      onEnd: () => setIsRecording(false),
      onError: (msg) => alert(msg),
    });
    setTimeout(() => runAnimation(), 200);
  }, [canvasRef, loadedFont, text, isRecording, startRecording, stopRecording, runAnimation]);

  const handleFontFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) loadFont(file);
  };

  const previewScale = Math.min(
    Math.max((window.innerWidth - 620) / format.w, 0.1),
    Math.max((window.innerHeight - 160) / format.h, 0.1),
    1
  );

  return (
    <div className="flex h-screen w-screen overflow-hidden" style={{ background: "#0a0a0a", fontFamily: "'IBM Plex Sans', sans-serif" }}>

      {/* ─── LEFT PANEL ─── */}
      <div
        className="flex flex-col flex-shrink-0 overflow-y-auto"
        style={{ width: 300, background: "#111", borderRight: "1px solid #1e1e1e" }}
      >
        {/* Header */}
        <div className="px-5 py-4" style={{ borderBottom: "1px solid #1e1e1e" }}>
          <div className="flex items-center gap-2">
            <Icon name="PenLine" size={18} style={{ color: "#7eb8f7" }} />
            <span className="font-semibold text-sm" style={{ color: "#e5e5e5" }}>
              Рукописная анимация
            </span>
          </div>
        </div>

        {/* ── ШРИФТ ── */}
        <PanelSection title="Шрифт">
          <input ref={fileInputRef} type="file" accept=".ttf,.otf,.woff" className="hidden" onChange={handleFontFile} />
          {fontLoading && <p className="text-xs mb-2" style={{ color: "#555" }}>Загрузка шрифта…</p>}
          {fontError && <p className="text-xs mb-2" style={{ color: "#e06c75" }}>{fontError}</p>}
          <button
            onClick={() => fileInputRef.current?.click()}
            className="w-full py-2 px-3 rounded flex items-center gap-2 text-xs transition-all"
            style={{
              background: loadedFont ? "#1a2a1a" : "#1a1a1a",
              border: `1px solid ${loadedFont ? "#2a4a2a" : "#2a2a2a"}`,
              color: loadedFont ? "#4ade80" : "#888",
            }}
          >
            <Icon name={loadedFont ? "CheckCircle" : "Upload"} size={13} />
            {loadedFont ? loadedFont.name : "Загрузить TTF / OTF шрифт"}
          </button>
          {!loadedFont && (
            <p className="text-xs mt-1.5" style={{ color: "#3a3a3a" }}>
              Скачайте рукописный шрифт на сайте 1001fonts.com и загрузите сюда
            </p>
          )}

          <div className="mt-3">
            <Row label="Размер" value={`${fontSize}px`}>
              <input type="range" min={12} max={200} value={fontSize}
                onChange={e => setFontSize(Number(e.target.value))}
                className="w-full" style={{ accentColor: "#7eb8f7" }} />
            </Row>
          </div>

          <div className="mt-3">
            <label className="text-xs block mb-1.5" style={{ color: "#555" }}>Цвет шрифта</label>
            <div className="flex flex-wrap gap-1.5 mb-2">
              {PRESET_COLORS.map(c => (
                <button key={c} onClick={() => setFontColor(c)}
                  className="w-6 h-6 rounded-full border-2 transition-all flex-shrink-0"
                  style={{ background: c, borderColor: fontColor === c ? "#7eb8f7" : "#2a2a2a" }} />
              ))}
            </div>
            <div className="flex items-center gap-2">
              <input type="color" value={fontColor} onChange={e => setFontColor(e.target.value)}
                className="w-8 h-8 rounded cursor-pointer" style={{ padding: 0, border: "none" }} />
              <input type="text" value={fontColor} onChange={e => setFontColor(e.target.value)}
                className="flex-1 px-2 py-1 rounded text-xs font-mono"
                style={{ background: "#1a1a1a", border: "1px solid #2a2a2a", color: "#888" }} />
            </div>
          </div>

          <div className="mt-3 flex items-center gap-1">
            <ToolBtn active={fontWeight === 700} icon="Bold" title="Жирный" onClick={() => setFontWeight(w => w === 700 ? 400 : 700)} />
            <ToolBtn active={fontStyle === "italic"} icon="Italic" title="Курсив" onClick={() => setFontStyle(s => s === "italic" ? "normal" : "italic")} />
            <div style={{ width: 1, height: 20, background: "#2a2a2a", margin: "0 2px" }} />
            <ToolBtn active={textAlign === "left"} icon="AlignLeft" title="По левому краю" onClick={() => setTextAlign("left")} />
            <ToolBtn active={textAlign === "center"} icon="AlignCenter" title="По центру" onClick={() => setTextAlign("center")} />
            <ToolBtn active={textAlign === "right"} icon="AlignRight" title="По правому краю" onClick={() => setTextAlign("right")} />
          </div>
        </PanelSection>

        {/* ── АНИМАЦИЯ ── */}
        <PanelSection title="Тип анимации">
          <div className="flex flex-col gap-1.5">
            {ANIM_MODES.map(m => (
              <button
                key={m.id}
                onClick={() => m.id === "manual" ? setShowManualEditor(true) : setAnimMode(m.id)}
                className="w-full px-3 py-2.5 rounded flex items-center gap-2.5 text-xs transition-all"
                style={{
                  background: animMode === m.id && m.id !== "manual" ? "#1a2030" : "#161616",
                  border: `1px solid ${animMode === m.id && m.id !== "manual" ? "#2a4060" : "#1e1e1e"}`,
                  color: animMode === m.id && m.id !== "manual" ? "#7eb8f7" : "#666",
                  textAlign: "left",
                }}
              >
                <Icon name={m.icon} size={14} />
                <span>{m.label}</span>
                {m.id === "manual" && manualData.length > 0 && (
                  <span className="ml-auto" style={{ color: "#4ade80" }}>{manualData.length} симв.</span>
                )}
              </button>
            ))}
          </div>

          <div className="mt-3">
            <Row label="Скорость" value={animSpeed < 40 ? "Быстро" : animSpeed < 100 ? "Средне" : "Медленно"}>
              <input type="range" min={5} max={200} value={animSpeed}
                onChange={e => setAnimSpeed(Number(e.target.value))}
                className="w-full" style={{ accentColor: "#7eb8f7" }} />
            </Row>
          </div>

          <div className="mt-3 flex gap-2">
            <button
              onClick={isAnimating ? stopAll : runAnimation}
              disabled={!loadedFont || !text.trim()}
              className="flex-1 py-2 rounded flex items-center justify-center gap-1.5 text-xs font-medium transition-all"
              style={{
                background: isAnimating ? "#2a1010" : (!loadedFont || !text.trim()) ? "#161616" : "#1a2030",
                border: `1px solid ${isAnimating ? "#5a2020" : (!loadedFont || !text.trim()) ? "#1e1e1e" : "#2a4060"}`,
                color: isAnimating ? "#e06c75" : (!loadedFont || !text.trim()) ? "#2a2a2a" : "#7eb8f7",
              }}
            >
              <Icon name={isAnimating ? "Square" : "Play"} size={13} />
              {isAnimating ? "Остановить" : "Воспроизвести"}
            </button>
            <button onClick={runAnimation} disabled={!loadedFont || !text.trim()}
              className="w-9 h-9 rounded flex items-center justify-center transition-all"
              style={{ background: "#161616", border: "1px solid #1e1e1e", color: !loadedFont || !text.trim() ? "#2a2a2a" : "#555" }}
              title="Начать сначала"
            >
              <Icon name="RotateCcw" size={14} />
            </button>
          </div>
        </PanelSection>

        {/* ── ФОН ── */}
        <PanelSection title="Фон">
          <button onClick={() => setTransparent(t => !t)}
            className="w-full py-2 px-3 rounded flex items-center gap-2 text-xs transition-all mb-2"
            style={{
              background: transparent ? "#1a2a1a" : "#161616",
              border: `1px solid ${transparent ? "#2a4a2a" : "#1e1e1e"}`,
              color: transparent ? "#4ade80" : "#555",
            }}
          >
            <Icon name={transparent ? "CheckSquare" : "Square"} size={13} />
            Прозрачный фон
          </button>

          {!transparent && (
            <>
              <div className="flex flex-wrap gap-1.5 mb-2">
                {PRESET_BG.map(c => (
                  <button key={c} onClick={() => setBgColor(c)}
                    className="w-6 h-6 rounded border-2 transition-all"
                    style={{ background: c, borderColor: bgColor === c ? "#7eb8f7" : "#2a2a2a" }} />
                ))}
              </div>
              <div className="flex items-center gap-2">
                <input type="color" value={bgColor} onChange={e => setBgColor(e.target.value)}
                  className="w-8 h-8 rounded cursor-pointer" style={{ padding: 0, border: "none" }} />
                <input type="text" value={bgColor} onChange={e => setBgColor(e.target.value)}
                  className="flex-1 px-2 py-1 rounded text-xs font-mono"
                  style={{ background: "#1a1a1a", border: "1px solid #2a2a2a", color: "#888" }} />
              </div>
            </>
          )}
        </PanelSection>

        {/* ── ФОРМАТ ── */}
        <PanelSection title="Формат видео">
          <div className="grid grid-cols-2 gap-1.5">
            {FORMATS.map(f => (
              <button key={f.id} onClick={() => setFormat(f)}
                className="py-2 px-3 rounded text-xs transition-all"
                style={{
                  background: format.id === f.id ? "#1a2030" : "#161616",
                  border: `1px solid ${format.id === f.id ? "#2a4060" : "#1e1e1e"}`,
                  color: format.id === f.id ? "#7eb8f7" : "#555",
                  textAlign: "left",
                }}
              >
                <div className="font-medium">{f.label}</div>
                <div style={{ opacity: 0.55, fontSize: 10 }}>{f.w}×{f.h}</div>
              </button>
            ))}
          </div>
        </PanelSection>

        {/* ── ЭКСПОРТ ── */}
        <PanelSection title="Экспорт">
          <button
            onClick={handleExport}
            disabled={!loadedFont || !text.trim()}
            className="w-full py-2.5 rounded flex items-center justify-center gap-2 text-xs font-semibold transition-all"
            style={{
              background: isRecording ? "#2a1010" : (!loadedFont || !text.trim()) ? "#161616" : "#e5e5e5",
              color: isRecording ? "#e06c75" : (!loadedFont || !text.trim()) ? "#2a2a2a" : "#0a0a0a",
            }}
          >
            <Icon name={isRecording ? "Square" : "Download"} size={14} />
            {isRecording ? "● Остановить и сохранить MP4" : "Экспорт в MP4"}
          </button>
          {isRecording && (
            <p className="text-xs mt-1.5 text-center" style={{ color: "#e06c75" }}>
              Идёт запись анимации…
            </p>
          )}
          <p className="text-xs mt-1.5" style={{ color: "#333" }}>
            Запись автоматически стартует вместе с анимацией
          </p>
        </PanelSection>

        <div className="h-4" />
      </div>

      {/* ─── MAIN ─── */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">

        {/* Top bar */}
        <div className="flex items-center gap-3 px-5 flex-shrink-0"
          style={{ height: 44, background: "#0f0f0f", borderBottom: "1px solid #1a1a1a" }}>
          <div className="flex items-center gap-1.5">
            <div className="w-2 h-2 rounded-full" style={{ background: loadedFont ? "#4ade80" : "#2a2a2a" }} />
            <span className="text-xs" style={{ color: "#444" }}>
              {loadedFont ? loadedFont.name : "Шрифт не загружен"}
            </span>
          </div>
          <div style={{ width: 1, height: 14, background: "#1e1e1e" }} />
          <span className="text-xs" style={{ color: "#444" }}>
            {format.label} — {format.w}×{format.h}
          </span>
          <div className="flex-1" />
          <span className="text-xs" style={{ color: "#333" }}>
            Текст вводите слева — превью обновляется справа
          </span>
        </div>

        <div className="flex flex-1 min-h-0 overflow-hidden">

          {/* Текстовый редактор */}
          <div className="flex flex-col flex-shrink-0"
            style={{ width: 260, borderRight: "1px solid #1a1a1a", background: "#0d0d0d" }}>
            <div className="px-4 py-2 flex-shrink-0 flex items-center gap-2"
              style={{ borderBottom: "1px solid #1a1a1a", height: 34 }}>
              <Icon name="Type" size={12} style={{ color: "#333" }} />
              <span className="text-xs" style={{ color: "#333" }}>Текст</span>
              <span className="ml-auto text-xs font-mono" style={{ color: "#2a2a2a" }}>{text.length} симв.</span>
            </div>
            <textarea
              value={text}
              onChange={e => setText(e.target.value)}
              placeholder={loadedFont ? "Начните вводить текст…\n\nEnter — новая строка\nТекст переносится автоматически" : "← Сначала загрузите шрифт"}
              disabled={!loadedFont}
              className="flex-1 resize-none outline-none p-4 leading-relaxed"
              style={{
                background: "transparent",
                color: "#c5c5c5",
                fontSize: 13,
                fontFamily: "'IBM Plex Sans', sans-serif",
                caretColor: "#7eb8f7",
                border: "none",
              }}
              spellCheck={false}
            />
            <div className="px-3 py-2 flex items-center gap-2 flex-shrink-0"
              style={{ borderTop: "1px solid #1a1a1a" }}>
              <div className="w-3 h-3 rounded-full border" style={{ background: fontColor, borderColor: "#2a2a2a" }} />
              <span className="text-xs font-mono" style={{ color: "#3a3a3a" }}>{fontColor}</span>
              <div style={{ width: 1, height: 12, background: "#1e1e1e", margin: "0 2px" }} />
              <span className="text-xs font-mono" style={{ color: "#3a3a3a" }}>{fontSize}px</span>
            </div>
          </div>

          {/* Canvas */}
          <div className="flex-1 flex items-center justify-center overflow-auto"
            style={{ background: "#080808", padding: 24 }}>
            {!loadedFont ? (
              <div className="text-center">
                <div className="mx-auto mb-4 flex items-center justify-center rounded"
                  style={{ width: 64, height: 64, background: "#111", border: "1px solid #1e1e1e" }}>
                  <Icon name="Upload" size={28} style={{ color: "#2a2a2a" }} />
                </div>
                <p className="text-sm font-medium mb-1" style={{ color: "#3a3a3a" }}>Загрузите шрифт для начала</p>
                <p className="text-xs mb-4" style={{ color: "#2a2a2a" }}>TTF, OTF или WOFF</p>
                <button onClick={() => fileInputRef.current?.click()}
                  className="px-5 py-2 rounded text-xs font-medium"
                  style={{ background: "#e5e5e5", color: "#0a0a0a" }}>
                  Выбрать файл шрифта
                </button>
              </div>
            ) : (
              <div className="flex flex-col items-center gap-3">
                <div style={{ position: "relative", boxShadow: "0 20px 60px rgba(0,0,0,0.8)" }}>
                  {transparent && (
                    <div style={{
                      position: "absolute", inset: 0, zIndex: 0, borderRadius: 2,
                      backgroundImage: "linear-gradient(45deg,#1e1e1e 25%,transparent 25%,transparent 75%,#1e1e1e 75%),linear-gradient(45deg,#1e1e1e 25%,#141414 25%,#141414 75%,#1e1e1e 75%)",
                      backgroundSize: "16px 16px", backgroundPosition: "0 0,8px 8px",
                    }} />
                  )}
                  <canvas ref={canvasRef} width={format.w} height={format.h}
                    style={{
                      display: "block", position: "relative", zIndex: 1, borderRadius: 2,
                      transform: `scale(${previewScale})`, transformOrigin: "top center",
                      width: format.w, height: format.h,
                    }} />
                </div>
                <p style={{
                  color: "#2a2a2a", fontSize: 11,
                  marginTop: Math.round((previewScale - 1) * format.h) + 8,
                }}>
                  {format.w} × {format.h} px · {format.label}
                </p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Manual Editor */}
      {showManualEditor && loadedFont && (
        <ManualAnimEditor
          font={loadedFont.font}
          fontSize={fontSize}
          color={fontColor}
          existingData={manualData}
          onSave={(data) => { setManualData(data); setAnimMode("manual"); setShowManualEditor(false); }}
          onClose={() => setShowManualEditor(false)}
        />
      )}
    </div>
  );
}

function PanelSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="px-4 py-4" style={{ borderBottom: "1px solid #1a1a1a" }}>
      <p style={{ color: "#3a3a3a", fontSize: 10, textTransform: "uppercase", letterSpacing: "0.1em", fontWeight: 600, marginBottom: 12 }}>
        {title}
      </p>
      {children}
    </div>
  );
}

function Row({ label, value, children }: { label: string; value: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="flex items-center justify-between mb-1">
        <label className="text-xs" style={{ color: "#555" }}>{label}</label>
        <span className="text-xs font-mono" style={{ color: "#555" }}>{value}</span>
      </div>
      {children}
    </div>
  );
}

function ToolBtn({ active, icon, title, onClick }: { active: boolean; icon: string; title: string; onClick: () => void }) {
  return (
    <button onClick={onClick} title={title}
      className="w-8 h-8 rounded flex items-center justify-center transition-all"
      style={{
        background: active ? "#2a2a2a" : "transparent",
        border: "1px solid #2a2a2a",
        color: active ? "#e5e5e5" : "#666",
      }}>
      <Icon name={icon} size={13} />
    </button>
  );
}
