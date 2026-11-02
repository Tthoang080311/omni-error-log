// File: src/components/CanvasAnnotator.tsx
'use client';

import React, { useState, useRef, useEffect, useCallback } from 'react';
import {
  Camera,
  PenTool,
  Highlighter,
  Square,
  RotateCcw,
  Trash2,
  Check,
  Upload,
  Sparkles,
} from 'lucide-react';

interface StrokeAction {
  tool: 'TERRACOTTA_PEN' | 'OCHRE_HIGHLIGHTER' | 'TERRACOTTA_BOX';
  points: { x: number; y: number }[];
}

interface CanvasAnnotatorProps {
  slot: 'problem' | 'solution';
  title: string;
  subtitle: string;
  imageUrl?: string;
  isActivePasteTarget: boolean;
  onSelectAsPasteTarget: () => void;
  onImageSaved: (finalUrl: string | undefined) => void;
}

export default function CanvasAnnotator({
  slot,
  title,
  subtitle,
  imageUrl,
  isActivePasteTarget,
  onSelectAsPasteTarget,
  onImageSaved,
}: CanvasAnnotatorProps) {
  const [baseImageSrc, setBaseImageSrc] = useState<string | undefined>(imageUrl);
  const [tool, setTool] = useState<
    'TERRACOTTA_PEN' | 'OCHRE_HIGHLIGHTER' | 'TERRACOTTA_BOX'
  >('TERRACOTTA_PEN');
  const [strokes, setStrokes] = useState<StrokeAction[]>([]);
  const [currentStroke, setCurrentStroke] = useState<StrokeAction | null>(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [hasUnsavedAnnotations, setHasUnsavedAnnotations] = useState(false);

  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const loadedImageRef = useRef<HTMLImageElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    setBaseImageSrc(imageUrl);
  }, [imageUrl]);

  // Vẽ lại toàn bộ ảnh gốc + các nét Bút Đỏ Đất Nung lên Canvas
  const redrawCanvas = useCallback(
    (
      imgElement: HTMLImageElement,
      strokeList: StrokeAction[],
      activeStroke: StrokeAction | null
    ) => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(imgElement, 0, 0, canvas.width, canvas.height);

      const allStrokes = activeStroke ? [...strokeList, activeStroke] : strokeList;

      for (const s of allStrokes) {
        if (s.points.length === 0) continue;
        ctx.save();

        if (s.tool === 'TERRACOTTA_PEN') {
          ctx.strokeStyle = '#C85A3B'; // Đỏ Đất Nung
          ctx.lineWidth = Math.max(3, canvas.width / 220);
          ctx.lineCap = 'round';
          ctx.lineJoin = 'round';
          ctx.beginPath();
          ctx.moveTo(s.points[0].x, s.points[0].y);
          for (let i = 1; i < s.points.length; i++) {
            ctx.lineTo(s.points[i].x, s.points[i].y);
          }
          ctx.stroke();
        } else if (s.tool === 'OCHRE_HIGHLIGHTER') {
          ctx.strokeStyle = 'rgba(212, 140, 42, 0.42)'; // Vàng Nghệ Trầm bán trong suốt
          ctx.lineWidth = Math.max(18, canvas.width / 35);
          ctx.lineCap = 'round';
          ctx.lineJoin = 'round';
          ctx.beginPath();
          ctx.moveTo(s.points[0].x, s.points[0].y);
          for (let i = 1; i < s.points.length; i++) {
            ctx.lineTo(s.points[i].x, s.points[i].y);
          }
          ctx.stroke();
        } else if (s.tool === 'TERRACOTTA_BOX') {
          const start = s.points[0];
          const end = s.points[s.points.length - 1];
          const w = end.x - start.x;
          const h = end.y - start.y;
          ctx.strokeStyle = '#C85A3B';
          ctx.lineWidth = Math.max(3, canvas.width / 220);
          ctx.fillStyle = 'rgba(200, 90, 59, 0.10)';
          ctx.fillRect(start.x, start.y, w, h);
          ctx.strokeRect(start.x, start.y, w, h);
        }

        ctx.restore();
      }
    },
    []
  );

  // Khi baseImageSrc thay đổi, nạp HTMLImageElement và khởi tạo kích thước Canvas
  useEffect(() => {
    if (!baseImageSrc) {
      loadedImageRef.current = null;
      return;
    }

    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      loadedImageRef.current = img;
      const canvas = canvasRef.current;
      if (canvas) {
        const maxWidth = 960;
        const scale = img.width > maxWidth ? maxWidth / img.width : 1;
        canvas.width = Math.round(img.width * scale);
        canvas.height = Math.round(img.height * scale);
        redrawCanvas(img, strokes, null);
      }
    };
    img.src = baseImageSrc;
  }, [baseImageSrc, redrawCanvas, strokes]);

  const uploadDataUrlToServer = useCallback(
    async (dataUrl: string) => {
      setIsSaving(true);
      try {
        const res = await fetch('/api/upload', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ dataUrl, slot }),
        });
        const data = await res.json();
        if (data.ok && data.url) {
          onImageSaved(data.url);
          setHasUnsavedAnnotations(false);
        } else {
          onImageSaved(dataUrl);
        }
      } catch {
        onImageSaved(dataUrl);
      } finally {
        setIsSaving(false);
      }
    },
    [onImageSaved, slot]
  );

  // Xử lý file ảnh từ Clipboard (Cmd+V) hoặc Chọn File
  const handleBlobFile = useCallback(
    (file: File) => {
      const reader = new FileReader();
      reader.onload = (ev) => {
        const resultDataUrl = ev.target?.result as string;
        if (resultDataUrl) {
          setStrokes([]);
          setBaseImageSrc(resultDataUrl);
          void uploadDataUrlToServer(resultDataUrl);
        }
      };
      reader.readAsDataURL(file);
    },
    [uploadDataUrlToServer]
  );

  // Lắng nghe sự kiện Cmd+V toàn cục khi ô ảnh này đang được chọn làm đích dán
  useEffect(() => {
    if (!isActivePasteTarget) return;

    const handleGlobalPaste = (e: ClipboardEvent) => {
      const items = e.clipboardData?.items;
      if (!items) return;

      for (let i = 0; i < items.length; i++) {
        if (items[i].type.indexOf('image') !== -1) {
          const blob = items[i].getAsFile();
          if (blob) {
            e.preventDefault();
            handleBlobFile(blob);
            break;
          }
        }
      }
    };

    window.addEventListener('paste', handleGlobalPaste);
    return () => window.removeEventListener('paste', handleGlobalPaste);
  }, [isActivePasteTarget, handleBlobFile]);

  const getCanvasCoordinates = (
    e: React.MouseEvent<HTMLCanvasElement>
  ): { x: number; y: number } => {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0 };
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    return {
      x: (e.clientX - rect.left) * scaleX,
      y: (e.clientY - rect.top) * scaleY,
    };
  };

  const handleMouseDown = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!loadedImageRef.current) return;
    const pt = getCanvasCoordinates(e);
    const newStroke: StrokeAction = { tool, points: [pt] };
    setCurrentStroke(newStroke);
    setIsDrawing(true);
  };

  const handleMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!isDrawing || !currentStroke || !loadedImageRef.current) return;
    const pt = getCanvasCoordinates(e);
    const updatedStroke: StrokeAction = {
      ...currentStroke,
      points: [...currentStroke.points, pt],
    };
    setCurrentStroke(updatedStroke);
    redrawCanvas(loadedImageRef.current, strokes, updatedStroke);
  };

  const handleMouseUp = () => {
    if (!isDrawing || !currentStroke || !loadedImageRef.current) return;
    const nextStrokes = [...strokes, currentStroke];
    setStrokes(nextStrokes);
    setCurrentStroke(null);
    setIsDrawing(false);
    setHasUnsavedAnnotations(true);
    redrawCanvas(loadedImageRef.current, nextStrokes, null);
  };

  const handleUndoStroke = () => {
    if (!loadedImageRef.current || strokes.length === 0) return;
    const nextStrokes = strokes.slice(0, -1);
    setStrokes(nextStrokes);
    setHasUnsavedAnnotations(true);
    redrawCanvas(loadedImageRef.current, nextStrokes, null);
  };

  const handleCommitAnnotations = async () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const mergedDataUrl = canvas.toDataURL('image/png');
    await uploadDataUrlToServer(mergedDataUrl);
  };

  const handleClearImage = () => {
    setBaseImageSrc(undefined);
    setStrokes([]);
    setHasUnsavedAnnotations(false);
    onImageSaved(undefined);
  };

  return (
    <div
      onClick={onSelectAsPasteTarget}
      className={`rounded-lg border transition-all ${
        isActivePasteTarget
          ? 'border-botanical-sage bg-botanical-surface ring-2 ring-botanical-sage/20'
          : 'border-botanical-border bg-botanical-surface/80 hover:border-botanical-borderHover'
      } p-3`}
    >
      {/* Header của Ô Ảnh */}
      <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <span
            className={`inline-flex h-6 w-6 items-center justify-center rounded-md text-xs font-bold ${
              slot === 'problem'
                ? 'bg-botanical-terracottaBg text-botanical-terracotta'
                : 'bg-botanical-matchaBg text-botanical-matcha'
            }`}
          >
            {slot === 'problem' ? '1' : '2'}
          </span>
          <div>
            <h4 className="text-xs font-semibold text-botanical-ink">{title}</h4>
            <p className="text-[11px] text-botanical-muted">{subtitle}</p>
          </div>
        </div>

        <div className="flex items-center gap-1.5">
          {isActivePasteTarget && (
            <span className="inline-flex items-center gap-1 rounded bg-botanical-chipBg px-2 py-0.5 text-[10px] font-medium text-botanical-chipText">
              <Sparkles className="h-3 w-3" /> Sẵn sàng nhận Cmd+V
            </span>
          )}
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              fileInputRef.current?.click();
            }}
            className="inline-flex items-center gap-1 rounded border border-botanical-border bg-botanical-canvas px-2 py-1 text-[11px] font-medium text-botanical-ink hover:border-botanical-borderHover"
          >
            <Upload className="h-3 w-3" /> Chọn ảnh
          </button>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) handleBlobFile(file);
            }}
          />
        </div>
      </div>

      {/* Nếu chưa có ảnh -> Hiện vùng nhắc bấm Cmd+V */}
      {!baseImageSrc ? (
        <div className="flex min-h-[135px] cursor-pointer flex-col items-center justify-center rounded-md border border-dashed border-botanical-border bg-botanical-canvas/60 p-4 text-center transition hover:bg-botanical-mossMist/40">
          <Camera className="mb-1.5 h-6 w-6 text-botanical-eucalyptus" />
          <p className="text-xs font-medium text-botanical-ink">
            Click vào ô này rồi bấm{' '}
            <kbd className="rounded border border-botanical-border bg-botanical-surface px-1.5 py-0.5 font-mono text-[11px] font-semibold">
              Cmd + V
            </kbd>{' '}
            (hoặc Ctrl + V) để dán ảnh chụp màn hình
          </p>
          <p className="mt-1 text-[11px] text-botanical-muted">
            Hỗ trợ khoanh vùng lỗi sai trực tiếp bằng Bút Đỏ Đất Nung sau khi dán
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          {/* Thanh công cụ Bút Đỏ Đất Nung trên Canvas */}
          <div className="flex flex-wrap items-center justify-between gap-1.5 rounded-md border border-botanical-border bg-botanical-canvas px-2.5 py-1.5">
            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  setTool('TERRACOTTA_PEN');
                }}
                className={`inline-flex items-center gap-1 rounded px-2 py-1 text-[11px] font-medium transition ${
                  tool === 'TERRACOTTA_PEN'
                    ? 'bg-botanical-terracotta text-white shadow-sm'
                    : 'text-botanical-ink hover:bg-botanical-mossMist'
                }`}
              >
                <PenTool className="h-3 w-3" />
                Bút Đỏ Đất Nung
              </button>

              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  setTool('TERRACOTTA_BOX');
                }}
                className={`inline-flex items-center gap-1 rounded px-2 py-1 text-[11px] font-medium transition ${
                  tool === 'TERRACOTTA_BOX'
                    ? 'bg-botanical-terracotta text-white shadow-sm'
                    : 'text-botanical-ink hover:bg-botanical-mossMist'
                }`}
              >
                <Square className="h-3 w-3" />
                Đóng khung chỗ sai
              </button>

              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  setTool('OCHRE_HIGHLIGHTER');
                }}
                className={`inline-flex items-center gap-1 rounded px-2 py-1 text-[11px] font-medium transition ${
                  tool === 'OCHRE_HIGHLIGHTER'
                    ? 'bg-botanical-ochre text-white shadow-sm'
                    : 'text-botanical-ink hover:bg-botanical-mossMist'
                }`}
              >
                <Highlighter className="h-3 w-3" />
                Tô sáng từ khóa
              </button>
            </div>

            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  handleUndoStroke();
                }}
                disabled={strokes.length === 0}
                className="inline-flex items-center gap-1 rounded border border-botanical-border bg-botanical-surface px-2 py-1 text-[11px] text-botanical-ink hover:bg-botanical-mossMist disabled:opacity-40"
                title="Hoàn tác nét vẽ cuối"
              >
                <RotateCcw className="h-3 w-3" /> Hoàn tác
              </button>

              {hasUnsavedAnnotations && (
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    void handleCommitAnnotations();
                  }}
                  disabled={isSaving}
                  className="inline-flex items-center gap-1 rounded bg-botanical-matcha px-2.5 py-1 text-[11px] font-semibold text-white shadow-sm hover:opacity-95"
                >
                  <Check className="h-3 w-3" />
                  {isSaving ? 'Đang lưu...' : 'Gộp nét vẽ vào ảnh'}
                </button>
              )}

              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  handleClearImage();
                }}
                className="inline-flex items-center gap-1 rounded px-2 py-1 text-[11px] text-botanical-terracotta hover:bg-botanical-terracottaBg"
                title="Xóa ảnh"
              >
                <Trash2 className="h-3 w-3" />
              </button>
            </div>
          </div>

          {/* Vùng Canvas vẽ trực tiếp lên ảnh */}
          <div className="relative max-h-[340px] overflow-auto rounded-md border border-botanical-border bg-[#FAFBF8] p-1">
            <canvas
              ref={canvasRef}
              onMouseDown={handleMouseDown}
              onMouseMove={handleMouseMove}
              onMouseUp={handleMouseUp}
              onMouseLeave={handleMouseUp}
              className="mx-auto block max-w-full cursor-crosshair rounded"
            />
          </div>

        </div>
      )}
    </div>
  );
}