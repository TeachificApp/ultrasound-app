import { useRef, useState, useCallback, useEffect } from "react";
import { v4 as uuidv4 } from "uuid";
import { Trash2, Circle, Square, CheckCircle2, Upload } from "lucide-react";
import type { HotspotData, HotspotRegion, HotspotShape } from "../../types/quiz";

interface Props {
  data: HotspotData;
  onChange: (data: HotspotData) => void;
}

type DrawMode = "circle" | "rect" | "select";

interface DragState {
  startX: number;
  startY: number;
  currentX: number;
  currentY: number;
  active: boolean;
}

export function HotspotEditor({ data, onChange }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const imgRef = useRef<HTMLImageElement | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [drawMode, setDrawMode] = useState<DrawMode>("circle");
  const [drag, setDrag] = useState<DragState>({ startX: 0, startY: 0, currentX: 0, currentY: 0, active: false });
  const [selectedRegionId, setSelectedRegionId] = useState<string | null>(null);
  const [imgLoaded, setImgLoaded] = useState(false);

  // Load image when imageUrl changes
  useEffect(() => {
    if (!data.imageUrl) { setImgLoaded(false); return; }
    const img = new Image();
    img.onload = () => { imgRef.current = img; setImgLoaded(true); };
    img.src = data.imageUrl;
  }, [data.imageUrl]);

  const redraw = useCallback(() => {
    const canvas = canvasRef.current;
    const img = imgRef.current;
    if (!canvas || !img || !imgLoaded) return;
    const ctx = canvas.getContext("2d")!;
    const W = canvas.width;
    const H = canvas.height;
    ctx.clearRect(0, 0, W, H);
    ctx.drawImage(img, 0, 0, W, H);

    // Draw regions
    data.regions.forEach((r) => {
      const isSelected = r.id === selectedRegionId;
      ctx.strokeStyle = r.correct ? "#24abbc" : "#ef4444";
      ctx.fillStyle = r.correct ? "rgba(21,164,183,0.18)" : "rgba(239,68,68,0.18)";
      ctx.lineWidth = isSelected ? 3 : 2;
      ctx.setLineDash(isSelected ? [6, 3] : []);

      const px = (r.x / 100) * W;
      const py = (r.y / 100) * H;

      if (r.shape === "circle" && r.radius != null) {
        const pr = (r.radius / 100) * Math.min(W, H);
        ctx.beginPath();
        ctx.arc(px, py, pr, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
      } else if (r.shape === "rect" && r.width != null && r.height != null) {
        const pw = (r.width / 100) * W;
        const ph = (r.height / 100) * H;
        ctx.beginPath();
        ctx.rect(px - pw / 2, py - ph / 2, pw, ph);
        ctx.fill();
        ctx.stroke();
      }

      // Label
      ctx.setLineDash([]);
      ctx.fillStyle = r.correct ? "#0d7a87" : "#b91c1c";
      ctx.font = "bold 12px sans-serif";
      ctx.fillText(r.label || "Region", px + 4, py - 4);
    });

    // Draw in-progress region
    if (drag.active) {
      const x1 = drag.startX, y1 = drag.startY, x2 = drag.currentX, y2 = drag.currentY;
      ctx.strokeStyle = "#24abbc";
      ctx.fillStyle = "rgba(21,164,183,0.15)";
      ctx.lineWidth = 2;
      ctx.setLineDash([5, 3]);
      if (drawMode === "circle") {
        const r = Math.sqrt((x2 - x1) ** 2 + (y2 - y1) ** 2);
        ctx.beginPath();
        ctx.arc(x1, y1, r, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
      } else {
        ctx.beginPath();
        ctx.rect(Math.min(x1, x2), Math.min(y1, y2), Math.abs(x2 - x1), Math.abs(y2 - y1));
        ctx.fill();
        ctx.stroke();
      }
    }
  }, [data.regions, drag, drawMode, selectedRegionId, imgLoaded]);

  useEffect(() => { redraw(); }, [redraw]);

  const getCanvasPos = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const rect = canvasRef.current!.getBoundingClientRect();
    return { x: e.clientX - rect.left, y: e.clientY - rect.top };
  };

  const onMouseDown = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (drawMode === "select") {
      // Hit-test regions
      const { x, y } = getCanvasPos(e);
      const W = canvasRef.current!.width, H = canvasRef.current!.height;
      const hit = data.regions.find((r) => {
        const px = (r.x / 100) * W, py = (r.y / 100) * H;
        if (r.shape === "circle" && r.radius != null) {
          const pr = (r.radius / 100) * Math.min(W, H);
          return Math.sqrt((x - px) ** 2 + (y - py) ** 2) <= pr;
        }
        if (r.shape === "rect" && r.width != null && r.height != null) {
          const pw = (r.width / 100) * W, ph = (r.height / 100) * H;
          return x >= px - pw / 2 && x <= px + pw / 2 && y >= py - ph / 2 && y <= py + ph / 2;
        }
        return false;
      });
      setSelectedRegionId(hit?.id ?? null);
      return;
    }
    const { x, y } = getCanvasPos(e);
    setDrag({ startX: x, startY: y, currentX: x, currentY: y, active: true });
  };

  const onMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!drag.active) return;
    const { x, y } = getCanvasPos(e);
    setDrag((d) => ({ ...d, currentX: x, currentY: y }));
  };

  const onMouseUp = () => {
    if (!drag.active) return;
    const W = canvasRef.current!.width, H = canvasRef.current!.height;
    const { startX: x1, startY: y1, currentX: x2, currentY: y2 } = drag;
    setDrag((d) => ({ ...d, active: false }));

    let region: HotspotRegion;
    if (drawMode === "circle") {
      const r = Math.sqrt((x2 - x1) ** 2 + (y2 - y1) ** 2);
      if (r < 5) return;
      region = {
        id: uuidv4(), label: "", correct: false, shape: "circle",
        x: (x1 / W) * 100, y: (y1 / H) * 100,
        radius: (r / Math.min(W, H)) * 100,
      };
    } else {
      const w = Math.abs(x2 - x1), h = Math.abs(y2 - y1);
      if (w < 5 || h < 5) return;
      region = {
        id: uuidv4(), label: "", correct: false, shape: "rect",
        x: ((Math.min(x1, x2) + w / 2) / W) * 100,
        y: ((Math.min(y1, y2) + h / 2) / H) * 100,
        width: (w / W) * 100, height: (h / H) * 100,
      };
    }
    onChange({ ...data, regions: [...data.regions, region] });
    setSelectedRegionId(region.id);
  };

  const uploadImage = () => {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = "image/*";
    input.onchange = (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = () => onChange({ ...data, imageUrl: reader.result as string });
      reader.readAsDataURL(file);
    };
    input.click();
  };

  const updateRegion = (id: string, updates: Partial<HotspotRegion>) => {
    onChange({ ...data, regions: data.regions.map((r) => (r.id === id ? { ...r, ...updates } : r)) });
  };

  const deleteRegion = (id: string) => {
    onChange({ ...data, regions: data.regions.filter((r) => r.id !== id) });
    if (selectedRegionId === id) setSelectedRegionId(null);
  };

  const selectedRegion = data.regions.find((r) => r.id === selectedRegionId);

  return (
    <div className="space-y-4">
      {/* Toolbar */}
      <div className="flex items-center gap-2 flex-wrap">
        <button
          onClick={uploadImage}
          className="flex items-center gap-1.5 px-3 py-1.5 text-sm bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors"
        >
          <Upload className="w-3.5 h-3.5" />
          {data.imageUrl ? "Change image" : "Upload image"}
        </button>

        {data.imageUrl && (
          <>
            <div className="h-5 w-px bg-gray-200" />
            {(["circle", "rect", "select"] as const).map((mode) => (
              <button
                key={mode}
                onClick={() => setDrawMode(mode)}
                className={`flex items-center gap-1.5 px-3 py-1.5 text-sm rounded-lg transition-colors ${
                  drawMode === mode
                    ? "bg-teal-500 text-white"
                    : "bg-gray-100 hover:bg-gray-200 text-gray-700"
                }`}
              >
                {mode === "circle" && <Circle className="w-3.5 h-3.5" />}
                {mode === "rect" && <Square className="w-3.5 h-3.5" />}
                {mode === "select" && <CheckCircle2 className="w-3.5 h-3.5" />}
                {mode === "circle" ? "Circle" : mode === "rect" ? "Rectangle" : "Select"}
              </button>
            ))}
          </>
        )}

        <label className="flex items-center gap-2 text-sm text-gray-600 cursor-pointer ml-auto">
          <input
            type="checkbox"
            checked={data.multiSelect}
            onChange={(e) => onChange({ ...data, multiSelect: e.target.checked })}
            className="accent-teal-500"
          />
          Multiple correct regions
        </label>
      </div>

      {/* Canvas */}
      {!data.imageUrl ? (
        <div
          onClick={uploadImage}
          className="w-full h-64 border-2 border-dashed border-gray-200 rounded-xl flex flex-col items-center justify-center text-gray-400 hover:border-teal-400 hover:text-teal-500 cursor-pointer transition-colors"
        >
          <Upload className="w-8 h-8 mb-2" />
          <p className="text-sm font-medium">Click to upload an image</p>
          <p className="text-xs">PNG, JPG, GIF up to 5MB</p>
        </div>
      ) : (
        <div ref={containerRef} className="relative border border-gray-200 rounded-xl overflow-hidden">
          <canvas
            ref={canvasRef}
            width={640}
            height={400}
            className="w-full cursor-crosshair"
            style={{ cursor: drawMode === "select" ? "pointer" : "crosshair" }}
            onMouseDown={onMouseDown}
            onMouseMove={onMouseMove}
            onMouseUp={onMouseUp}
            onMouseLeave={onMouseUp}
          />
          <div className="absolute top-2 left-2 bg-black/50 text-white text-xs px-2 py-1 rounded-md">
            {drawMode === "select" ? "Click a region to select it" : `Draw ${drawMode} regions`}
          </div>
        </div>
      )}

      {/* Region list */}
      {data.regions.length > 0 && (
        <div className="space-y-2">
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Regions ({data.regions.length})</p>
          {data.regions.map((r) => (
            <div
              key={r.id}
              onClick={() => setSelectedRegionId(r.id)}
              className={`flex items-center gap-3 p-3 rounded-xl border-2 cursor-pointer transition-all ${
                r.id === selectedRegionId ? "border-teal-400 bg-teal-50/50" : "border-gray-100 hover:border-gray-200"
              }`}
            >
              <div className={`w-3 h-3 rounded-full shrink-0 ${r.correct ? "bg-teal-500" : "bg-red-400"}`} />
              <input
                type="text"
                value={r.label}
                onChange={(e) => { e.stopPropagation(); updateRegion(r.id, { label: e.target.value }); }}
                placeholder="Region label"
                className="flex-1 text-sm border-none outline-none bg-transparent"
                onClick={(e) => e.stopPropagation()}
              />
              <span className="text-xs text-gray-400 font-mono">{r.shape}</span>
              <label
                className="flex items-center gap-1 text-xs text-gray-500 cursor-pointer"
                onClick={(e) => e.stopPropagation()}
              >
                <input
                  type="checkbox"
                  checked={r.correct}
                  onChange={(e) => updateRegion(r.id, { correct: e.target.checked })}
                  className="accent-teal-500"
                />
                Correct
              </label>
              <button
                onClick={(e) => { e.stopPropagation(); deleteRegion(r.id); }}
                className="p-1 text-gray-300 hover:text-red-400"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
