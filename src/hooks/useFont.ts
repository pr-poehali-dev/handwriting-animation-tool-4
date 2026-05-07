import { useState, useCallback } from "react";
import * as opentype from "opentype.js";

export interface LoadedFont {
  font: opentype.Font;
  name: string;
  fileName: string;
}

export function useFont() {
  const [loadedFont, setLoadedFont] = useState<LoadedFont | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadFont = useCallback((file: File) => {
    setLoading(true);
    setError(null);
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const buffer = e.target?.result as ArrayBuffer;
        const font = opentype.parse(buffer);
        setLoadedFont({ font, name: font.names.fullName?.en || file.name, fileName: file.name });
        setLoading(false);
      } catch {
        setError("Не удалось загрузить шрифт. Убедитесь, что файл в формате TTF или OTF.");
        setLoading(false);
      }
    };
    reader.readAsArrayBuffer(file);
  }, []);

  return { loadedFont, loading, error, loadFont };
}
