"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import confetti from "canvas-confetti";
import { generatePuzzleAction, validatePathsAction } from "./actions";
import type { Pair } from "@/lib/puzzle-engine/pair-link";

type NumberCell = { x: number; y: number; val: number; color: string };
type PathPoint = { x: number; y: number };

const PADDING = 50;
const STORAGE_KEY = "pair-link_completed";

function emptyPaths(pairs: Pair[]): Record<string, PathPoint[][]> {
  const out: Record<string, PathPoint[][]> = {};
  pairs.forEach((p) => {
    const [r1, c1] = p.start;
    const [r2, c2] = p.end;
    out[String(p.id)] = [[{ x: c1, y: r1 }], [{ x: c2, y: r2 }]];
  });
  return out;
}

export default function PairLinkGame() {
  const [gridSize, setGridSize] = useState(6);
  const [numbers, setNumbers] = useState<NumberCell[]>([]);
  const [pairs, setPairs] = useState<Pair[]>([]);
  const [paths, setPaths] = useState<Record<string, PathPoint[][]>>({});
  const [loading, setLoading] = useState(true);
  const [status, setStatus] = useState("");
  const [solved, setSolved] = useState(false);
  const [showClearOverlay, setShowClearOverlay] = useState(false);
  const [timeSeconds, setTimeSeconds] = useState(0);
  const [timerActive, setTimerActive] = useState(false);

  const [isDrawing, setIsDrawing] = useState(false);
  const [activeVal, setActiveVal] = useState<string | null>(null);
  const [activePathIdx, setActivePathIdx] = useState<number | null>(null);

  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const timeSecondsRef = useRef(0);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const isDrawingRef = useRef(false);
  const activeValRef = useRef<string | null>(null);
  const activePathIdxRef = useRef<number | null>(null);
  const hasTriggeredClearRef = useRef(false);

  useEffect(() => {
    isDrawingRef.current = isDrawing;
    activeValRef.current = activeVal;
    activePathIdxRef.current = activePathIdx;
  }, [isDrawing, activeVal, activePathIdx]);

  const [canvasPixelSize, setCanvasPixelSize] = useState(420);
  useEffect(() => {
    const update = () => {
      const w = typeof window !== "undefined" ? window.innerWidth - 40 : 500;
      setCanvasPixelSize(Math.min(500, Math.max(300, w)));
    };
    update();
    window.addEventListener("resize", update);
    return () => window.removeEventListener("resize", update);
  }, []);

  const spacing =
    gridSize > 1 ? (canvasPixelSize - PADDING * 2) / (gridSize - 1) : 0;
  const canvasSize = Math.round(PADDING * 2 + (gridSize - 1) * spacing) || 420;

  const initGame = useCallback(async (size: number) => {
    hasTriggeredClearRef.current = false;
    setLoading(true);
    setSolved(false);
    setShowClearOverlay(false);
    setStatus("探索中");
    setTimeSeconds(0);
    setTimerActive(false);

    const result = await generatePuzzleAction(size);
    if (result.error) {
      setStatus(result.error);
      setLoading(false);
      return;
    }

    setGridSize(result.gridSize);
    setNumbers(result.numbers);
    setPairs(result.pairs);
    setPaths(emptyPaths(result.pairs));
    setStatus("Playing");
    setLoading(false);
    setTimerActive(true);
  }, []);

  useEffect(() => {
    initGame(6);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (timerActive && !solved) {
      timerRef.current = setInterval(() => {
        setTimeSeconds((s) => {
          const next = s + 1;
          timeSecondsRef.current = next;
          return next;
        });
      }, 1000);
    } else if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [timerActive, solved]);

  const formatTime = (sec: number) => {
    const m = Math.floor(sec / 60);
    const s = sec % 60;
    return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
  };

  const getGridPos = useCallback(
    (clientX: number, clientY: number): PathPoint | null => {
      const canvas = canvasRef.current;
      if (!canvas || spacing <= 0) return null;
      const rect = canvas.getBoundingClientRect();
      // 表示サイズとcanvas内部サイズが異なる場合の座標変換（HTML版と同様に正しくマス判定）
      const scaleX = canvas.width / rect.width;
      const scaleY = canvas.height / rect.height;
      const canvasX = (clientX - rect.left) * scaleX;
      const canvasY = (clientY - rect.top) * scaleY;
      const x = Math.round((canvasX - PADDING) / spacing);
      const y = Math.round((canvasY - PADDING) / spacing);
      if (x >= 0 && x < gridSize && y >= 0 && y < gridSize) return { x, y };
      return null;
    },
    [gridSize, spacing]
  );

  const checkClear = useCallback(async () => {
    // ローディング中（次へ押下後の探索中など）は前パズルの paths が残っており誤検知するためスキップ
    if (loading || solved || pairs.length === 0 || hasTriggeredClearRef.current)
      return;
    const result = await validatePathsAction(paths, pairs, gridSize);
    if (result.ok) {
      hasTriggeredClearRef.current = true;
      setSolved(true);
      setTimerActive(false);
      setShowClearOverlay(true);
      try {
        const prev = JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]");
        prev.push({
          gridSize,
          timeSeconds: timeSecondsRef.current,
          completedAt: new Date().toISOString(),
        });
        localStorage.setItem(STORAGE_KEY, JSON.stringify(prev));
      } catch {
        /* ignore */
      }
    }
  }, [paths, pairs, gridSize, solved, loading]);

  // クリア画面ポップアップ時のみ紙吹雪を1回発火（showClearOverlay の遷移で確実に1回に限定）
  useEffect(() => {
    if (!showClearOverlay) return;
    const defaults = { origin: { y: 0.6 }, zIndex: 9999 };
    confetti({ ...defaults, particleCount: 150, spread: 100 });
    confetti({ ...defaults, particleCount: 75, angle: 60, spread: 55 });
    confetti({ ...defaults, particleCount: 75, angle: 120, spread: 55 });
    const t = setTimeout(() => {
      confetti({ ...defaults, particleCount: 50, scalar: 1.2, spread: 80 });
    }, 200);
    return () => clearTimeout(t);
  }, [showClearOverlay]);

  // --- Draw canvas ---
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !numbers.length || spacing <= 0) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const w = canvas.width;
    const h = canvas.height;
    ctx.clearRect(0, 0, w, h);

    ctx.fillStyle = "rgba(148, 163, 184, 0.4)";
    for (let i = 0; i < gridSize; i++) {
      for (let j = 0; j < gridSize; j++) {
        ctx.beginPath();
        ctx.arc(
          PADDING + i * spacing,
          PADDING + j * spacing,
          2,
          0,
          Math.PI * 2
        );
        ctx.fill();
      }
    }

    Object.entries(paths).forEach(([v, pathList]) => {
      const color = numbers.find((n) => String(n.val) === v)?.color ?? "#10b981";
      pathList.forEach((path, idx) => {
        const isActive =
          isDrawing && activeVal === v && activePathIdx === idx;
        ctx.strokeStyle = color;
        ctx.lineWidth = spacing * (isActive ? 0.55 : 0.45);
        ctx.lineCap = "round";
        ctx.lineJoin = "round";
        ctx.globalAlpha = isActive ? 0.7 : 1;
        ctx.beginPath();
        path.forEach((p, i) => {
          const px = PADDING + p.x * spacing;
          const py = PADDING + p.y * spacing;
          if (i === 0) ctx.moveTo(px, py);
          else ctx.lineTo(px, py);
        });
        ctx.stroke();
        const last = path[path.length - 1];
        ctx.fillStyle = color;
        ctx.globalAlpha = 0.2;
        ctx.beginPath();
        ctx.arc(
          PADDING + last.x * spacing,
          PADDING + last.y * spacing,
          spacing * 0.4,
          0,
          Math.PI * 2
        );
        ctx.fill();
      });
    });

    ctx.globalAlpha = 1;
    const r = spacing * 0.35;
    ctx.font = `bold ${r}px Arial`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    numbers.forEach((n) => {
      const x = PADDING + n.x * spacing;
      const y = PADDING + n.y * spacing;
      ctx.fillStyle = n.color;
      ctx.beginPath();
      ctx.arc(x, y, r, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = "white";
      ctx.fillText(String(n.val), x, y);
    });
  }, [paths, numbers, gridSize, spacing, isDrawing, activeVal, activePathIdx]);

  const handlePointerDown = useCallback(
    (e: React.PointerEvent) => {
      e.preventDefault();
      if (solved || hasTriggeredClearRef.current) return;
      const p = getGridPos(e.clientX, e.clientY);
      if (!p) return;

      for (const [v, pathList] of Object.entries(paths)) {
        for (let i = 0; i < pathList.length; i++) {
          const path = pathList[i];
          const last = path[path.length - 1];
          const first = path[0];
          if (p.x === last.x && p.y === last.y) {
            activeValRef.current = v;
            activePathIdxRef.current = i;
            isDrawingRef.current = true;
            setActiveVal(v);
            setActivePathIdx(i);
            setIsDrawing(true);
            (e.target as HTMLElement).setPointerCapture?.(e.pointerId);
            return;
          }
          if (p.x === first.x && p.y === first.y) {
            setPaths((prev) => {
              const next = { ...prev };
              const seg = [...next[v]].map((s) => [...s]);
              seg[i] = [...path].reverse();
              next[v] = seg;
              return next;
            });
            activeValRef.current = v;
            activePathIdxRef.current = i;
            isDrawingRef.current = true;
            setActiveVal(v);
            setActivePathIdx(i);
            setIsDrawing(true);
            (e.target as HTMLElement).setPointerCapture?.(e.pointerId);
            return;
          }
        }
      }

      const num = numbers.find((n) => n.x === p.x && n.y === p.y);
      if (num) {
        const v = String(num.val);
        setPaths((prev) => {
          const next = { ...prev };
          if (!next[v]) next[v] = [];
          next[v] = [...(next[v] ?? []), [{ x: num.x, y: num.y }]];
          return next;
        });
        const pathIdx = (paths[v]?.length ?? 1) - 1;
        activeValRef.current = v;
        activePathIdxRef.current = pathIdx;
        isDrawingRef.current = true;
        setActiveVal(v);
        setActivePathIdx(pathIdx);
        setIsDrawing(true);
        (e.target as HTMLElement).setPointerCapture?.(e.pointerId);
      }
    },
    [paths, numbers, solved, getGridPos]
  );

  const handlePointerMove = useCallback(
    (e: React.PointerEvent) => {
      // refs を参照（window listener から呼ばれたとき、描画開始直後の React 再描画前でも正しく動作）
      const av = activeValRef.current;
      const api = activePathIdxRef.current;
      if (hasTriggeredClearRef.current || !isDrawingRef.current || av === null || api === null) return;
      e.preventDefault();
      const p = getGridPos(e.clientX, e.clientY);
      if (!p) return;

      let didMerge = false;
      let reachedGoal = false;

      setPaths((prev) => {
        const path = prev[av]?.[api];
        if (!path) return prev;
        const last = path[path.length - 1];
        if (p.x === last.x && p.y === last.y) return prev;

        const manhattan =
          Math.abs(p.x - last.x) + Math.abs(p.y - last.y);
        if (manhattan !== 1) return prev;

        if (
          path.length > 1 &&
          p.x === path[path.length - 2].x &&
          p.y === path[path.length - 2].y
        ) {
          const next = { ...prev };
          const seg = next[av].map((s) => [...s]);
          seg[api] = path.slice(0, -1);
          next[av] = seg;
          return next;
        }

        const oIdx = 1 - api;
        const oPath = prev[av]?.[oIdx];
        if (
          oPath &&
          oPath.length > 0 &&
          p.x === oPath[oPath.length - 1].x &&
          p.y === oPath[oPath.length - 1].y
        ) {
          didMerge = true;
          const merged = [...path, ...[...oPath].reverse()];
          const seg = prev[av].filter((_, i) => i !== oIdx);
          seg[0] = merged;
          const next = { ...prev };
          next[av] = seg;
          return next;
        }

        const tNum = numbers.find((n) => n.x === p.x && n.y === p.y);
        if (tNum) {
          if (tNum.val !== Number(av)) return prev;
          reachedGoal = true;
          const next = { ...prev };
          const seg = next[av].map((s) => [...s]);
          seg[api] = [...path, p];
          next[av] = seg;
          return next;
        }

        const occupied = Object.values(prev)
          .flat()
          .some((pa) => pa.some((pt) => pt.x === p.x && pt.y === p.y));
        if (occupied) return prev;

        const next = { ...prev };
        const seg = next[av].map((s) => [...s]);
        seg[api] = [...path, p];
        next[av] = seg;
        return next;
      });

      if (didMerge || reachedGoal) {
        isDrawingRef.current = false;
        activeValRef.current = null;
        activePathIdxRef.current = null;
        setIsDrawing(false);
        setActiveVal(null);
        setActivePathIdx(null);
      }
    },
    [numbers, getGridPos]
  );

  const handlePointerUp = useCallback(() => {
    isDrawingRef.current = false;
    activeValRef.current = null;
    activePathIdxRef.current = null;
    setIsDrawing(false);
    setActiveVal(null);
    setActivePathIdx(null);
    checkClear();
  }, [checkClear]);

  // HTML版と同様に window で pointermove/up を受信（指が canvas 外に出てもドラッグ継続）
  const handlePointerMoveRef = useRef(handlePointerMove);
  const handlePointerUpRef = useRef(handlePointerUp);
  handlePointerMoveRef.current = handlePointerMove;
  handlePointerUpRef.current = handlePointerUp;

  useEffect(() => {
    const onMove = (e: PointerEvent) => {
      const synthetic = {
        clientX: e.clientX,
        clientY: e.clientY,
        preventDefault: () => e.preventDefault(),
      } as React.PointerEvent;
      handlePointerMoveRef.current(synthetic);
    };
    const onUp = () => handlePointerUpRef.current?.();

    window.addEventListener("pointermove", onMove, {
      capture: true,
      passive: false,
    });
    window.addEventListener("pointerup", onUp, { capture: true });
    window.addEventListener("pointercancel", onUp, { capture: true });
    return () => {
      window.removeEventListener("pointermove", onMove, { capture: true });
      window.removeEventListener("pointerup", onUp, { capture: true });
      window.removeEventListener("pointercancel", onUp, { capture: true });
    };
  }, []);

  if (loading || !numbers.length) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-wit-bg text-wit-text">
        <p className="text-wit-muted">
          {status === "探索中" ? `${status}…` : "パズルを読み込み中…"}
        </p>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-[1080px] w-full px-4 py-6">
      <header className="flex justify-between items-center mb-6">
        <Link
          href="/"
          className="flex items-center gap-3 text-xl sm:text-2xl font-black tracking-wider text-wit-text no-underline hover:opacity-90"
        >
          <span className="block w-8 h-8 rounded-lg bg-gradient-to-br from-wit-emerald to-teal-600" />
          WIT PORT
        </Link>
        <div className="flex items-center gap-2 text-wit-muted text-sm">
          <span className="tabular-nums">{formatTime(timeSeconds)}</span>
          {solved && <span className="text-wit-emerald">クリア</span>}
        </div>
      </header>

      <section className="rounded-2xl p-4 sm:p-6 mb-4 border border-white/10 bg-white/5 backdrop-blur">
        <h2 className="text-lg font-bold mb-4 text-wit-text">
          ペアリンク（ナンバーリンク）
        </h2>
        <div className="flex flex-wrap gap-4 items-end mb-4">
          <div>
            <label className="block text-xs text-wit-muted mb-1">サイズ</label>
            <select
              value={gridSize}
              onChange={(e) => initGame(Number(e.target.value))}
              className="px-3 py-2 rounded-lg bg-slate-800 border border-slate-600 text-wit-text text-sm"
            >
              <option value={4}>4×4（ペア3）</option>
              <option value={6}>6×6（ペア5）</option>
              <option value={8}>8×8（ペア7）</option>
              <option value={10}>10×10（ペア9）</option>
            </select>
          </div>
          <button
            onClick={() => initGame(gridSize)}
            disabled={loading}
            className="px-4 py-2 rounded-lg bg-wit-emerald text-white text-sm font-medium hover:bg-emerald-600 disabled:opacity-50"
          >
            新規生成
          </button>
        </div>
        <div className="flex flex-col items-center">
          <div className="flex justify-between w-full max-w-[520px] mb-2 font-semibold text-wit-text text-sm">
            <span>{status}</span>
            <span className="tabular-nums">{formatTime(timeSeconds)}</span>
          </div>
          <div
            className="w-full max-w-[520px] touch-none select-none"
            style={{ minHeight: canvasSize, WebkitTapHighlightColor: "transparent" }}
          >
            <canvas
              ref={canvasRef}
              width={canvasSize}
              height={canvasSize}
              className="w-full max-w-[500px] border-2 border-slate-600 rounded-xl shadow-lg cursor-crosshair block mx-auto bg-slate-900"
              style={{ touchAction: "none" }}
              onPointerDown={handlePointerDown}
              onPointerMove={handlePointerMove}
              onPointerUp={handlePointerUp}
              onPointerLeave={handlePointerUp}
              onPointerCancel={handlePointerUp}
            />
          </div>
        </div>
        <p className="text-xs text-wit-muted mt-3">
          同じ数字をドラッグで線で繋ぎ、全マスを埋めましょう。サイズが大きいと生成に数秒かかることがあります。
        </p>
      </section>

      {showClearOverlay && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60"
          role="dialog"
          aria-modal="true"
          aria-labelledby="clear-title"
        >
          <div className="rounded-2xl p-8 bg-slate-800 border border-slate-600 text-center shadow-2xl max-w-sm mx-4">
            <h2
              id="clear-title"
              className="text-2xl font-bold text-wit-emerald mb-2"
            >
              Perfect!
            </h2>
            <p className="text-wit-muted mb-4">
              パズルを解き明かしました。（{formatTime(timeSeconds)}）
            </p>
            <button
              onClick={() => {
                setShowClearOverlay(false);
                initGame(gridSize);
              }}
              className="px-6 py-3 rounded-lg bg-slate-700 text-wit-text font-medium hover:bg-slate-600"
            >
              次へ
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
