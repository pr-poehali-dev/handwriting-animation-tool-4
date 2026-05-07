import { useState } from "react";
import Icon from "@/components/ui/icon";

const CODE_LINES = [
  { num: 1, tokens: [{ t: "comment", v: "// Добро пожаловать в редактор" }] },
  { num: 2, tokens: [] },
  { num: 3, tokens: [{ t: "keyword", v: "import" }, { t: "plain", v: " React " }, { t: "keyword", v: "from" }, { t: "string", v: " 'react'" }] },
  { num: 4, tokens: [{ t: "keyword", v: "import" }, { t: "plain", v: " { useState } " }, { t: "keyword", v: "from" }, { t: "string", v: " 'react'" }] },
  { num: 5, tokens: [] },
  { num: 6, tokens: [{ t: "keyword", v: "const" }, { t: "plain", v: " " }, { t: "fn-name", v: "App" }, { t: "plain", v: " = () => {" }] },
  { num: 7, tokens: [{ t: "keyword", v: "  const" }, { t: "plain", v: " [" }, { t: "fn-name", v: "count" }, { t: "plain", v: ", " }, { t: "fn-name", v: "setCount" }, { t: "plain", v: "] = " }, { t: "fn-name", v: "useState" }, { t: "plain", v: "(" }, { t: "number", v: "0" }, { t: "plain", v: ")" }] },
  { num: 8, tokens: [] },
  { num: 9, tokens: [{ t: "keyword", v: "  return" }, { t: "plain", v: " (" }] },
  { num: 10, tokens: [{ t: "plain", v: "    <" }, { t: "tag", v: "div" }, { t: "attr", v: " className" }, { t: "plain", v: "=" }, { t: "string", v: '"app"' }, { t: "plain", v: ">" }] },
  { num: 11, tokens: [{ t: "plain", v: "      <" }, { t: "tag", v: "h1" }, { t: "plain", v: ">Привет</" }, { t: "tag", v: "h1" }, { t: "plain", v: ">" }] },
  { num: 12, tokens: [{ t: "plain", v: "      <" }, { t: "tag", v: "button" }] },
  { num: 13, tokens: [{ t: "plain", v: "        " }, { t: "attr", v: "onClick" }, { t: "plain", v: "={() => " }, { t: "fn-name", v: "setCount" }, { t: "plain", v: "(count + " }, { t: "number", v: "1" }, { t: "plain", v: ")}" }] },
  { num: 14, tokens: [{ t: "plain", v: "      >" }] },
  { num: 15, tokens: [{ t: "plain", v: "        Нажатий: {count}" }] },
  { num: 16, tokens: [{ t: "plain", v: "      </" }, { t: "tag", v: "button" }, { t: "plain", v: ">" }] },
  { num: 17, tokens: [{ t: "plain", v: "    </" }, { t: "tag", v: "div" }, { t: "plain", v: ">" }] },
  { num: 18, tokens: [{ t: "plain", v: "  )" }] },
  { num: 19, tokens: [{ t: "plain", v: "}" }] },
  { num: 20, tokens: [] },
  { num: 21, tokens: [{ t: "keyword", v: "export" }, { t: "keyword", v: " default" }, { t: "plain", v: " " }, { t: "fn-name", v: "App" }] },
];

const FILE_TREE = [
  { id: "src", name: "src", type: "folder", depth: 0, open: true },
  { id: "app", name: "App.tsx", type: "file", depth: 1, active: true },
  { id: "idx", name: "index.tsx", type: "file", depth: 1 },
  { id: "comp", name: "components", type: "folder", depth: 1, open: true },
  { id: "btn", name: "Button.tsx", type: "file", depth: 2 },
  { id: "input", name: "Input.tsx", type: "file", depth: 2 },
  { id: "styles", name: "styles", type: "folder", depth: 1, open: false },
  { id: "css", name: "index.css", type: "file", depth: 2 },
  { id: "public", name: "public", type: "folder", depth: 0, open: false },
  { id: "pkg", name: "package.json", type: "file", depth: 0 },
];

const TOOLS_LEFT = [
  { id: "explorer", icon: "FolderOpen", label: "Проводник" },
  { id: "search", icon: "Search", label: "Поиск" },
  { id: "git", icon: "GitBranch", label: "Контроль версий" },
  { id: "extensions", icon: "Puzzle", label: "Расширения" },
];

const TOOLS_BOTTOM = [
  { id: "settings", icon: "Settings", label: "Настройки" },
  { id: "account", icon: "User", label: "Аккаунт" },
];

export default function Index() {
  const [activePanel, setActivePanel] = useState<string>("explorer");
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [activeTab, setActiveTab] = useState("terminal");
  const [bottomPanel, setBottomPanel] = useState<string | null>("terminal");
  const [cursorLine, setCursorLine] = useState(6);
  const [splitView, setSplitView] = useState(false);
  const [files, setFiles] = useState(FILE_TREE);

  const togglePanel = (id: string) => {
    if (activePanel === id && sidebarOpen) {
      setSidebarOpen(false);
    } else {
      setActivePanel(id);
      setSidebarOpen(true);
    }
  };

  const toggleFolder = (id: string) => {
    setFiles(prev => prev.map(f => f.id === id ? { ...f, open: !f.open } : f));
  };

  const visibleFiles = files.filter(f => {
    if (f.depth === 0) return true;
    const parents = files.filter(p => p.type === "folder" && p.depth < f.depth);
    return parents.every(p => p.open);
  });

  return (
    <div className="flex h-screen w-screen overflow-hidden" style={{ background: "var(--editor-bg)" }}>

      {/* Activity Bar */}
      <div
        className="flex flex-col items-center justify-between py-2 flex-shrink-0"
        style={{ width: 44, background: "var(--panel-bg)", borderRight: "1px solid var(--line)" }}
      >
        <div className="flex flex-col gap-0.5 w-full px-1.5">
          {TOOLS_LEFT.map(t => (
            <button
              key={t.id}
              title={t.label}
              onClick={() => togglePanel(t.id)}
              className={`tool-btn ${activePanel === t.id && sidebarOpen ? "active" : ""}`}
            >
              <Icon name={t.icon} size={16} />
            </button>
          ))}
        </div>
        <div className="flex flex-col gap-0.5 w-full px-1.5">
          {TOOLS_BOTTOM.map(t => (
            <button key={t.id} title={t.label} className="tool-btn">
              <Icon name={t.icon} size={16} />
            </button>
          ))}
        </div>
      </div>

      {/* Sidebar Panel */}
      {sidebarOpen && (
        <div
          className="flex flex-col flex-shrink-0 animate-slide-in-right"
          style={{ width: 220, background: "var(--panel-bg)", borderRight: "1px solid var(--line)" }}
        >
          <div
            className="flex items-center justify-between px-3 py-2 flex-shrink-0"
            style={{ borderBottom: "1px solid var(--line)", height: 35 }}
          >
            <span style={{ color: "var(--text-dim)", fontSize: 10, textTransform: "uppercase", letterSpacing: "0.12em" }}>
              {activePanel === "explorer" ? "Проводник" : activePanel === "search" ? "Поиск" : "Расширения"}
            </span>
            <button className="tool-btn w-5 h-5" onClick={() => setSidebarOpen(false)}>
              <Icon name="X" size={12} />
            </button>
          </div>

          {activePanel === "explorer" && (
            <div className="flex-1 overflow-y-auto py-1">
              {visibleFiles.map(file => (
                <div
                  key={file.id}
                  onClick={() => file.type === "folder" ? toggleFolder(file.id) : null}
                  className="flex items-center gap-1.5 cursor-pointer transition-all duration-100 select-none"
                  style={{
                    paddingLeft: 8 + file.depth * 12,
                    paddingRight: 8,
                    paddingTop: 3,
                    paddingBottom: 3,
                    background: file.active ? "var(--surface)" : "transparent",
                    color: file.active ? "var(--text-main)" : "var(--text-mid)",
                    fontSize: 12,
                  }}
                >
                  {file.type === "folder" ? (
                    <Icon name={file.open ? "ChevronDown" : "ChevronRight"} size={11} />
                  ) : (
                    <span style={{ width: 11, display: "inline-block" }} />
                  )}
                  <Icon
                    name={file.type === "folder" ? (file.open ? "FolderOpen" : "Folder") : "FileCode"}
                    size={13}
                    style={{ color: file.type === "folder" ? "#7eb8f7" : "var(--text-dim)", flexShrink: 0 }}
                  />
                  <span>{file.name}</span>
                </div>
              ))}
            </div>
          )}

          {activePanel === "search" && (
            <div className="p-3 flex-1">
              <div
                className="flex items-center gap-2 px-2 py-1.5"
                style={{ background: "var(--surface)", border: "1px solid var(--line)", borderRadius: 2 }}
              >
                <Icon name="Search" size={12} style={{ color: "var(--text-dim)" }} />
                <input
                  className="bg-transparent outline-none w-full"
                  style={{ color: "var(--text-main)", fontFamily: "IBM Plex Mono", fontSize: 12 }}
                  placeholder="Найти в файлах..."
                  autoFocus
                />
              </div>
            </div>
          )}

          {activePanel === "git" && (
            <div className="p-3 flex-1 flex flex-col gap-2">
              <div className="flex items-center gap-2" style={{ color: "var(--text-mid)", fontSize: 12 }}>
                <Icon name="GitBranch" size={13} />
                <span>main</span>
                <span style={{ color: "var(--text-dim)" }}>— нет изменений</span>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Main Area */}
      <div className="flex flex-col flex-1 min-w-0 overflow-hidden">

        {/* Tab Bar */}
        <div
          className="flex items-center flex-shrink-0"
          style={{ height: 35, background: "var(--panel-bg)", borderBottom: "1px solid var(--line)" }}
        >
          <div className="flex items-stretch h-full overflow-x-auto">
            {["App.tsx", "index.tsx", "Button.tsx"].map((tab, i) => (
              <div
                key={tab}
                className="flex items-center gap-2 px-4 cursor-pointer transition-all duration-150 relative flex-shrink-0"
                style={{
                  background: i === 0 ? "var(--editor-bg)" : "transparent",
                  borderRight: "1px solid var(--line)",
                  color: i === 0 ? "var(--text-main)" : "var(--text-dim)",
                  fontSize: 12,
                }}
              >
                {i === 0 && (
                  <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: 1, background: "#7eb8f7" }} />
                )}
                <Icon name="FileCode" size={12} />
                <span>{tab}</span>
                <span
                  className="transition-opacity"
                  style={{ color: "var(--text-dim)", opacity: 0.4, fontSize: 14, lineHeight: 1 }}
                >
                  ×
                </span>
              </div>
            ))}
          </div>

          <div className="flex-1" />

          <div className="flex items-center gap-1 pr-2">
            <button
              title="Разделённый вид"
              onClick={() => setSplitView(!splitView)}
              className={`tool-btn ${splitView ? "active" : ""}`}
            >
              <Icon name="Columns2" size={14} />
            </button>
            <button title="Предпросмотр" className="tool-btn">
              <Icon name="Eye" size={14} />
            </button>
            <div style={{ width: 1, height: 16, background: "var(--line)", margin: "0 4px" }} />
            <button
              className="flex items-center gap-1.5 px-3 py-1 rounded transition-all duration-150 flex-shrink-0"
              style={{ background: "var(--text-main)", color: "var(--editor-bg)", fontSize: 11, fontWeight: 600, letterSpacing: "0.02em" }}
            >
              <Icon name="Play" size={11} />
              Запуск
            </button>
          </div>
        </div>

        {/* Editor + Preview */}
        <div className="flex flex-1 min-h-0 overflow-hidden">

          {/* Code Editor */}
          <div
            className="flex flex-col min-h-0"
            style={{ width: splitView ? "50%" : "100%", borderRight: splitView ? "1px solid var(--line)" : "none" }}
          >
            <div
              className="flex items-center gap-1.5 px-4 flex-shrink-0"
              style={{ height: 28, borderBottom: "1px solid var(--line)", color: "var(--text-dim)", fontSize: 11 }}
            >
              <span>src</span>
              <Icon name="ChevronRight" size={10} />
              <span style={{ color: "var(--text-mid)" }}>App.tsx</span>
            </div>

            <div className="flex-1 overflow-y-auto overflow-x-hidden py-2">
              {CODE_LINES.map((line) => (
                <div
                  key={line.num}
                  className="editor-line"
                  style={{
                    background: line.num === cursorLine ? "rgba(255,255,255,0.025)" : undefined,
                    cursor: "text",
                  }}
                  onClick={() => setCursorLine(line.num)}
                >
                  <span className="line-num">{line.num}</span>
                  <span style={{ flex: 1 }}>
                    {line.tokens.map((tok, ti) => (
                      <span key={ti} className={tok.t === "plain" ? "" : tok.t}>{tok.v}</span>
                    ))}
                    {line.num === cursorLine && (
                      <span className="cursor-blink" />
                    )}
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* Preview */}
          {splitView && (
            <div className="flex flex-col flex-1 min-w-0 animate-fade-in" style={{ background: "var(--editor-bg)" }}>
              <div
                className="flex items-center justify-between px-4 flex-shrink-0"
                style={{ height: 28, borderBottom: "1px solid var(--line)", color: "var(--text-dim)", fontSize: 11 }}
              >
                <div className="flex items-center gap-2">
                  <Icon name="Globe" size={11} />
                  <span>localhost:5173</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <div className="status-dot active" />
                  <span style={{ fontSize: 10 }}>Запущен</span>
                </div>
              </div>
              <div className="flex-1 flex items-center justify-center">
                <div className="text-center animate-scale-in">
                  <div
                    className="mx-auto mb-4 flex items-center justify-center"
                    style={{ width: 48, height: 48, background: "var(--surface)", border: "1px solid var(--line)", borderRadius: 4 }}
                  >
                    <Icon name="Monitor" size={22} style={{ color: "var(--text-dim)" }} />
                  </div>
                  <p style={{ color: "var(--text-dim)", fontSize: 12 }}>Превью появится после запуска</p>
                  <button
                    className="mt-3 px-4 py-1.5 rounded transition-all duration-150"
                    style={{ background: "var(--surface)", border: "1px solid var(--line)", color: "var(--text-mid)", fontSize: 12 }}
                  >
                    Открыть в браузере
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Bottom Panel */}
        {bottomPanel && (
          <div
            className="flex-shrink-0 flex flex-col animate-fade-in"
            style={{ height: 180, borderTop: "1px solid var(--line)", background: "var(--panel-bg)" }}
          >
            <div
              className="flex items-center flex-shrink-0"
              style={{ height: 30, borderBottom: "1px solid var(--line)" }}
            >
              {["terminal", "output", "problems"].map(t => (
                <button
                  key={t}
                  onClick={() => setActiveTab(t)}
                  className={`panel-tab ${activeTab === t ? "active" : ""}`}
                >
                  {t === "terminal" ? "Терминал" : t === "output" ? "Вывод" : "Проблемы"}
                </button>
              ))}
              <div className="flex-1" />
              <button className="tool-btn w-6 h-6 mr-1" onClick={() => setBottomPanel(null)}>
                <Icon name="ChevronDown" size={12} />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto px-4 py-2">
              {activeTab === "terminal" && (
                <div className="font-mono" style={{ fontSize: 11, color: "var(--text-mid)", lineHeight: 1.8 }}>
                  <div>
                    <span style={{ color: "#4ade80" }}>✓</span>
                    <span style={{ color: "var(--text-dim)" }}> vite v5.0.0</span>
                    <span> — готов к работе</span>
                  </div>
                  <div>
                    <span style={{ color: "var(--text-dim)" }}>→</span>
                    <span> Локально: </span>
                    <span style={{ color: "#7eb8f7" }}>http://localhost:5173/</span>
                  </div>
                  <div>
                    <span style={{ color: "var(--text-dim)" }}>→</span>
                    <span> Сеть: </span>
                    <span style={{ color: "#7eb8f7" }}>http://192.168.1.1:5173/</span>
                  </div>
                  <div className="mt-1">
                    <span style={{ color: "#4ade80" }}>$</span>
                    <span> </span>
                    <span className="cursor-blink-block" />
                  </div>
                </div>
              )}
              {activeTab === "output" && (
                <div className="font-mono" style={{ fontSize: 11, color: "var(--text-dim)", lineHeight: 1.8 }}>
                  <div>[info] Сборка завершена за 342ms</div>
                  <div>[info] 24 модуля трансформировано</div>
                  <div>[info] dist/assets/index.js — 142.3 kB</div>
                </div>
              )}
              {activeTab === "problems" && (
                <div className="flex items-center gap-2" style={{ color: "var(--text-dim)", fontSize: 12 }}>
                  <Icon name="CheckCircle" size={13} style={{ color: "#4ade80" }} />
                  Нет проблем
                </div>
              )}
            </div>
          </div>
        )}

        {/* Status Bar */}
        <div
          className="flex items-center justify-between px-3 flex-shrink-0"
          style={{ height: 22, background: "#0a0a0a", borderTop: "1px solid var(--line)" }}
        >
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-1.5" style={{ color: "var(--text-dim)", fontSize: 10 }}>
              <Icon name="GitBranch" size={11} />
              <span>main</span>
            </div>
            <div className="flex items-center gap-1.5" style={{ color: "var(--text-dim)", fontSize: 10 }}>
              <div className="status-dot active" />
              <span>Нет ошибок</span>
            </div>
          </div>

          <div className="flex items-center gap-4" style={{ color: "var(--text-dim)", fontSize: 10 }}>
            <span>Строка {cursorLine}, Кол. 1</span>
            <span>TypeScript React</span>
            <span>UTF-8</span>
            {!bottomPanel && (
              <button
                onClick={() => setBottomPanel("terminal")}
                className="flex items-center gap-1 transition-colors"
                style={{ color: "var(--text-dim)" }}
              >
                <Icon name="Terminal" size={10} />
                Терминал
              </button>
            )}
          </div>
        </div>
      </div>

      <style>{`
        .cursor-blink {
          display: inline-block;
          width: 2px;
          height: 14px;
          background: var(--text-main);
          vertical-align: middle;
          margin-left: 1px;
          animation: blink 1s step-end infinite;
        }
        .cursor-blink-block {
          display: inline-block;
          width: 7px;
          height: 13px;
          background: var(--text-main);
          vertical-align: middle;
          opacity: 0.8;
          animation: blink 1s step-end infinite;
        }
        @keyframes blink {
          0%, 100% { opacity: 1; }
          50% { opacity: 0; }
        }
      `}</style>
    </div>
  );
}
