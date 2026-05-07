import { useCallback, useRef } from "react";

export interface ExportOptions {
  canvas: HTMLCanvasElement;
  fps?: number;
  onStart?: () => void;
  onEnd?: (url: string) => void;
  onError?: (msg: string) => void;
}

export function useExportMP4() {
  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);

  const startRecording = useCallback((opts: ExportOptions) => {
    const { canvas, fps = 30, onStart, onEnd, onError } = opts;

    const mimeType = MediaRecorder.isTypeSupported("video/mp4")
      ? "video/mp4"
      : MediaRecorder.isTypeSupported("video/webm;codecs=vp9")
      ? "video/webm;codecs=vp9"
      : "video/webm";

    const stream = canvas.captureStream(fps);
    const recorder = new MediaRecorder(stream, { mimeType, videoBitsPerSecond: 8_000_000 });
    chunksRef.current = [];

    recorder.ondataavailable = (e) => {
      if (e.data.size > 0) chunksRef.current.push(e.data);
    };

    recorder.onstop = () => {
      const blob = new Blob(chunksRef.current, { type: mimeType });
      const url = URL.createObjectURL(blob);
      const ext = mimeType.includes("mp4") ? "mp4" : "webm";
      const a = document.createElement("a");
      a.href = url;
      a.download = `handwriting_animation.${ext}`;
      a.click();
      URL.revokeObjectURL(url);
      onEnd?.(url);
    };

    recorder.onerror = () => {
      onError?.("Ошибка записи видео");
    };

    try {
      recorder.start(100);
      recorderRef.current = recorder;
      onStart?.();
    } catch {
      onError?.("Ваш браузер не поддерживает запись видео");
    }
  }, []);

  const stopRecording = useCallback(() => {
    if (recorderRef.current && recorderRef.current.state !== "inactive") {
      recorderRef.current.stop();
    }
  }, []);

  return { startRecording, stopRecording };
}
