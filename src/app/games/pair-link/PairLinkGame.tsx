"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import { DevLink } from "@/components/DevLink";
import confetti from "canvas-confetti";
import { validatePathsAction, solvePathsAction } from "./actions";
import { usePuzzleStock } from "@/hooks/usePuzzleStock";
import { refreshAds, getAdsRefreshState, AD_REFRESH_EVENT, AD_REFRESH_STATE_CHANGED } from "@/lib/ads";
import { PairLinkAdSlot } from "@/components/PairLinkAdSlots";
import { useUserSyncContext } from "@/components/UserSyncProvider";
import { DevDebugUserStats } from "@/components/DevDebugUserStats";
import { recordPuzzleClear } from "@/lib/wispo-user-data";
import type { Pair } from "@/lib/puzzle-engine/pair-link";

type NumberCell = { x: number; y: number; val: number; color: string };
type PathPoint = { x: number; y: number };

const PADDING = 50;
const HIT_RADIUS_FACTOR = 0.55; // 数字・端点の当たり判定半径（spacing に対する倍率）

type HitTarget =
  | { type: "endpoint"; val: string; pathIdx: number; point: PathPoint; isFirst: boolean }
  | { type: "number"; x: number; y: number; val: number };

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
  const [puzzleKey, setPuzzleKey] = useState(0);
  const [isDebugMode, setIsDebugMode] = useState(false);
  const [isDebugPanelExpanded, setIsDebugPanelExpanded] = useState(true);
  const [forcedWidth, setForcedWidth] = useState<number | null>(null);
  const [adsRefreshState, setAdsRefreshState] = useState(() => getAdsRefreshState());
  const [countFlashing, setCountFlashing] = useState(false);
  const [tick, setTick] = useState(0);
  const [currentSeed, setCurrentSeed] = useState<string | null>(null);
  const [hashInput, setHashInput] = useState("");
  const countFlashTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [windowWidth, setWindowWidth] = useState(
    () => (typeof window !== "undefined" ? window.innerWidth : 500)
  );

  const searchParams = useSearchParams();
  const isDevTj = searchParams.get("devtj") === "true";
  const userSync = useUserSyncContext();

  useEffect(() => {
    if (isDevTj) setIsDebugMode(true);
  }, [isDevTj]);

  useEffect(() => {
    if (!isDebugMode) return;
    const id = setInterval(() => setTick((t) => t + 1), 1000);
    return () => clearInterval(id);
  }, [isDebugMode]);

  useEffect(() => {
    if (!isDebugMode) return;
    const onStateChanged = () => setAdsRefreshState(getAdsRefreshState());
    const onRefreshSuccess = () => {
      setAdsRefreshState(getAdsRefreshState());
      setCountFlashing(true);
      if (countFlashTimeoutRef.current) clearTimeout(countFlashTimeoutRef.current);
      countFlashTimeoutRef.current = setTimeout(() => {
        setCountFlashing(false);
        countFlashTimeoutRef.current = null;
      }, 450);
    };
    window.addEventListener(AD_REFRESH_STATE_CHANGED, onStateChanged);
    window.addEventListener(AD_REFRESH_EVENT, onRefreshSuccess);
    return () => {
      window.removeEventListener(AD_REFRESH_STATE_CHANGED, onStateChanged);
      window.removeEventListener(AD_REFRESH_EVENT, onRefreshSuccess);
      if (countFlashTimeoutRef.current) clearTimeout(countFlashTimeoutRef.current);
    };
  }, [isDebugMode]);

  useEffect(() => {
    if (forcedWidth != null) return;
    const update = () => setWindowWidth(window.innerWidth);
    update();
    window.addEventListener("resize", update);
    return () => window.removeEventListener("resize", update);
  }, [forcedWidth]);

  const effectiveViewportWidth = forcedWidth ?? windowWidth - 40;
  const isMobile =
    forcedWidth === 375 || (forcedWidth == null && windowWidth < 768);
  const canvasPixelSize = Math.min(500, Math.max(300, effectiveViewportWidth));

  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const timeSecondsRef = useRef(0);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const isDrawingRef = useRef(false);
  const activeValRef = useRef<string | null>(null);
  const activePathIdxRef = useRef<number | null>(null);
  const hasTriggeredClearRef = useRef(false);
  const isCheckingClearRef = useRef(false);
  const currentSolutionPathsRef = useRef<Record<string, { x: number; y: number }[][]> | null>(null);
  const mergeIndexRef = useRef<number | null>(null);
  const mergeJustHappenedRef = useRef(false);

  useEffect(() => {
    isDrawingRef.current = isDrawing;
    activeValRef.current = activeVal;
    activePathIdxRef.current = activePathIdx;
  }, [isDrawing, activeVal, activePathIdx]);

  const spacing =
    gridSize > 1 ? (canvasPixelSize - PADDING * 2) / (gridSize - 1) : 0;
  const canvasSize = Math.round(PADDING * 2 + (gridSize - 1) * spacing) || 420;

  const { getPuzzle, stockCount, prefetch, manualPrefetch, isPrefetching, lastGenerationTimeMs, lastProfile, lastAttempts, lastTotalMs } = usePuzzleStock({ gridSize, persist: true });

  const initGame = useCallback(
    async (size: number, seed?: string) => {
      hasTriggeredClearRef.current = false;
      isCheckingClearRef.current = false;
      setSolved(false);
      setShowClearOverlay(false);
      setTimeSeconds(0);
      setTimerActive(false);

      const hasStock = size === gridSize && stockCount > 0 && !seed;
      if (!hasStock) {
        setLoading(true);
        setStatus(seed ? "ハッシュから生成中" : "探索中");
      }

      try {
        const result = await getPuzzle(size, seed);
        if (result.error) {
          setStatus(result.error ?? "生成に失敗しました");
          return;
        }
        setGridSize(result.gridSize);
        setNumbers(result.numbers);
        setPairs(result.pairs);
        setPaths(emptyPaths(result.pairs));
        setStatus("Playing");
        setTimerActive(true);
        setPuzzleKey((k) => k + 1);
        setCurrentSeed(result.seed ?? null);
        currentSolutionPathsRef.current = result.solutionPaths ?? null;
      } catch (err) {
        setStatus(
          err instanceof Error ? err.message : "生成に失敗しました。もう一度お試しください。"
        );
      } finally {
        setLoading(false);
      }
    },
    [getPuzzle, gridSize, stockCount]
  );

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

  // 表示サイズと内部サイズが異なる場合の座標変換（拡縮時もタップずれなし）
  const getGridPos = useCallback(
    (clientX: number, clientY: number): PathPoint | null => {
      const canvas = canvasRef.current;
      if (!canvas || spacing <= 0) return null;
      const rect = canvas.getBoundingClientRect();
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

  const getCanvasPos = useCallback(
    (clientX: number, clientY: number): { x: number; y: number } | null => {
      const canvas = canvasRef.current;
      if (!canvas || spacing <= 0) return null;
      const rect = canvas.getBoundingClientRect();
      const scaleX = canvas.width / rect.width;
      const scaleY = canvas.height / rect.height;
      return {
        x: (clientX - rect.left) * scaleX,
        y: (clientY - rect.top) * scaleY,
      };
    },
    [spacing]
  );

  const findNearestHit = useCallback(
    (clientX: number, clientY: number): HitTarget | null => {
      const canvasPos = getCanvasPos(clientX, clientY);
      if (!canvasPos) return null;

      const hitRadius = spacing * HIT_RADIUS_FACTOR;
      let best: { target: HitTarget; distSq: number } | null = null;

      const consider = (target: HitTarget, px: number, py: number) => {
        const dx = canvasPos.x - px;
        const dy = canvasPos.y - py;
        const distSq = dx * dx + dy * dy;
        if (distSq <= hitRadius * hitRadius) {
          if (!best || distSq < best.distSq) best = { target, distSq };
        }
      };

      for (const [v, pathList] of Object.entries(paths)) {
        for (let i = 0; i < pathList.length; i++) {
          const path = pathList[i];
          const first = path[0];
          const last = path[path.length - 1];
          const firstPx = PADDING + first.x * spacing;
          const firstPy = PADDING + first.y * spacing;
          consider(
            { type: "endpoint", val: v, pathIdx: i, point: first, isFirst: true },
            firstPx,
            firstPy
          );
          if (first.x !== last.x || first.y !== last.y) {
            const lastPx = PADDING + last.x * spacing;
            const lastPy = PADDING + last.y * spacing;
            consider(
              { type: "endpoint", val: v, pathIdx: i, point: last, isFirst: false },
              lastPx,
              lastPy
            );
          }
        }
      }

      for (const n of numbers) {
        const px = PADDING + n.x * spacing;
        const py = PADDING + n.y * spacing;
        consider({ type: "number", x: n.x, y: n.y, val: n.val }, px, py);
      }

      return (best as { target: HitTarget } | null)?.target ?? null;
    },
    [paths, numbers, spacing, getCanvasPos]
  );

  const checkClear = useCallback(async () => {
    // ローディング中（次へ押下後の探索中など）は前パズルの paths が残っており誤検知するためスキップ
    if (loading || solved || pairs.length === 0 || hasTriggeredClearRef.current)
      return;
    // pointerup/pointercancel の両発火や StrictMode による二重実行を防ぐため、処理開始直後にフラグを立てる
    hasTriggeredClearRef.current = true;
    isCheckingClearRef.current = true;
    try {
      const result = await validatePathsAction(paths, pairs, gridSize);
      if (result.ok) {
        setSolved(true);
        setTimerActive(false);
        setShowClearOverlay(true);
        try {
          recordPuzzleClear("pairLink");
          if (userSync?.saveProgressAndSync) {
            userSync.saveProgressAndSync(() => {}).catch(() => {});
          }
        } catch {
          /* ignore */
        }
      } else {
        hasTriggeredClearRef.current = false;
      }
    } catch {
      hasTriggeredClearRef.current = false;
    } finally {
      isCheckingClearRef.current = false;
    }
  }, [paths, pairs, gridSize, solved, loading, userSync]);

  const triggerDebugSolve = useCallback(async () => {
    if (typeof window !== "undefined" && window.location.search.includes("devtj=true")) {
      console.log("[強制クリア] 呼び出し", {
        loading,
        solved,
        pairsLen: pairs.length,
        hasTriggered: hasTriggeredClearRef.current,
      });
    }
    if (loading || solved || pairs.length === 0 || hasTriggeredClearRef.current) return;
    hasTriggeredClearRef.current = true;
    try {
      let solvedPaths: Record<string, { x: number; y: number }[][]> | null =
        currentSolutionPathsRef.current;
      if (typeof window !== "undefined" && window.location.search.includes("devtj=true")) {
        console.log("[強制クリア] currentSolutionPathsRef:", solvedPaths ? `${Object.keys(solvedPaths).length} keys` : "null");
      }
      if (!solvedPaths || Object.keys(solvedPaths).length === 0) {
        if (typeof window !== "undefined" && window.location.search.includes("devtj=true")) {
          console.log("[強制クリア] solvePathsAction を呼び出し");
        }
        const result = await solvePathsAction(pairs, gridSize);
        if (result.error || !result.paths || Object.keys(result.paths).length === 0) {
          const msg = result.error ?? "解の取得に失敗しました";
          setStatus(msg);
          if (typeof window !== "undefined" && window.location.search.includes("devtj=true")) {
            console.warn("[強制クリア] solvePathsAction 失敗:", msg);
          }
          hasTriggeredClearRef.current = false;
          return;
        }
        solvedPaths = result.paths;
      }
      if (typeof window !== "undefined" && window.location.search.includes("devtj=true")) {
        console.log("[強制クリア] setPaths 実行, keys:", Object.keys(solvedPaths).length);
      }
      setPaths(solvedPaths);
      setSolved(true);
      setTimerActive(false);
      setShowClearOverlay(true);
      recordPuzzleClear("pairLink");
      if (userSync?.saveProgressAndSync) {
        userSync.saveProgressAndSync(() => {}).catch(() => {});
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : "強制クリアに失敗しました";
      setStatus(msg);
      if (typeof window !== "undefined" && window.location.search.includes("devtj=true")) {
        console.error("[強制クリア] 例外:", err);
      }
      hasTriggeredClearRef.current = false;
    }
  }, [pairs, gridSize, loading, solved, userSync]);

  // トリガーA: クリア判定され正解演出開始時に広告リフレッシュ
  useEffect(() => {
    if (!showClearOverlay) return;
    refreshAds();
  }, [showClearOverlay]);

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
        ctx.fillStyle = color;
        ctx.globalAlpha = 0.2;
        const drawEndpointCircle = (pt: PathPoint) => {
          ctx.beginPath();
          ctx.arc(
            PADDING + pt.x * spacing,
            PADDING + pt.y * spacing,
            spacing * 0.4,
            0,
            Math.PI * 2
          );
          ctx.fill();
        };
        drawEndpointCircle(path[path.length - 1]);
        if (path.length > 1) drawEndpointCircle(path[0]);
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
      if (solved || hasTriggeredClearRef.current || isCheckingClearRef.current) return;
      const hit = findNearestHit(e.clientX, e.clientY);
      if (!hit) return;

      if (hit.type === "endpoint") {
        const { val: v, pathIdx: i, isFirst } = hit;
        const path = paths[v]?.[i];
        if (!path) return;
        if (isFirst) {
          setPaths((prev) => {
            const next = { ...prev };
            const seg = [...next[v]].map((s) => [...s]);
            seg[i] = [...path].reverse();
            next[v] = seg;
            return next;
          });
        }
        activeValRef.current = v;
        activePathIdxRef.current = i;
        isDrawingRef.current = true;
        setActiveVal(v);
        setActivePathIdx(i);
        setIsDrawing(true);
        (e.target as HTMLElement).setPointerCapture?.(e.pointerId);
        return;
      }

      if (hit.type === "number") {
        const { x, y, val } = hit;
        const v = String(val);
        const alreadyEndpoint = (paths[v] ?? []).some(
          (path) =>
            (path[0]?.x === x && path[0]?.y === y) ||
            (path[path.length - 1]?.x === x && path[path.length - 1]?.y === y)
        );
        if (alreadyEndpoint) return;
        setPaths((prev) => {
          const next = { ...prev };
          if (!next[v]) next[v] = [];
          next[v] = [...(next[v] ?? []), [{ x, y }]];
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
    [paths, numbers, solved, findNearestHit]
  );

  const handlePointerMove = useCallback(
    (e: React.PointerEvent) => {
      // refs を参照（window listener から呼ばれたとき、描画開始直後の React 再描画前でも正しく動作）
      const av = activeValRef.current;
      const api = activePathIdxRef.current;
      if (hasTriggeredClearRef.current || isCheckingClearRef.current || !isDrawingRef.current || av === null || api === null) return;
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
          if (mergeJustHappenedRef.current) return prev;
          const mergeIdx = mergeIndexRef.current;
          const popped = path.slice(0, -1);
          const firstIsNum = numbers.some(
            (n) =>
              n.x === popped[0].x &&
              n.y === popped[0].y &&
              n.val === Number(av)
          );
          const lastIsNum = numbers.some(
            (n) =>
              n.x === popped[popped.length - 1].x &&
              n.y === popped[popped.length - 1].y &&
              n.val === Number(av)
          );
          if (!firstIsNum && !lastIsNum) return prev;
          if (mergeIdx !== null && popped.length === mergeIdx) {
            mergeIndexRef.current = null;
            const ourPath = path.slice(0, mergeIdx);
            const otherPath = path.slice(mergeIdx).reverse();
            const next = { ...prev };
            next[av] = [ourPath, otherPath];
            return next;
          }
          const next = { ...prev };
          const seg = next[av].map((s) => [...s]);
          seg[api] = popped;
          next[av] = seg;
          return next;
        }

        // 数字の端点からは別方向に伸ばせない（戻すのみ）。path.length===1は開始点からの初回伸ばしなので許可
        const lastIsNumber = numbers.some(
          (n) => n.x === last.x && n.y === last.y && n.val === Number(av)
        );
        if (lastIsNumber && path.length > 1) return prev;

        // 自分の開始数字へ戻る（ループ生成・2本目防止）
        if (
          path.length > 2 &&
          p.x === path[0].x &&
          p.y === path[0].y
        )
          return prev;

        const oIdx = 1 - api;
        const oPath = prev[av]?.[oIdx];
        if (
          oPath &&
          oPath.length > 0 &&
          p.x === oPath[oPath.length - 1].x &&
          p.y === oPath[oPath.length - 1].y
        ) {
          // 数字から伸びる線は1方向に限定：マージ後の経路は「数字-数字」でなければならない
          // path[0] と oPath[0] が両方数字で、かつ異なるときのみマージ許可
          const pathStart = path[0];
          const oPathStart = oPath[0];
          const pathStartIsNum = numbers.some(
            (n) => n.x === pathStart.x && n.y === pathStart.y && n.val === Number(av)
          );
          const oPathStartIsNum = numbers.some(
            (n) => n.x === oPathStart.x && n.y === oPathStart.y && n.val === Number(av)
          );
          if (
            !pathStartIsNum ||
            !oPathStartIsNum ||
            (pathStart.x === oPathStart.x && pathStart.y === oPathStart.y)
          )
            return prev;
          didMerge = true;
          mergeJustHappenedRef.current = true;
          mergeIndexRef.current = path.length;
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

      if (didMerge) {
        activePathIdxRef.current = 0;
        setActivePathIdx(0);
      }
    },
    [numbers, getGridPos]
  );

  const handlePointerUp = useCallback(() => {
    mergeIndexRef.current = null;
    mergeJustHappenedRef.current = false;
    isDrawingRef.current = false;
    activeValRef.current = null;
    activePathIdxRef.current = null;
    setIsDrawing(false);
    setActiveVal(null);
    setActivePathIdx(null);

    // 線を戻して数字が孤立した場合、その数字に path=[その数字] を与える
    // （スプリットは mergeIndexRef が pointerUp で null になるため別セッションでは発生しない）
    setPaths((prev) => {
      let changed = false;
      const next = { ...prev };
      for (const n of numbers) {
        const v = String(n.val);
        const pathList = next[v] ?? [];
        const isEndpoint = pathList.some(
          (path) =>
            (path[0]?.x === n.x && path[0]?.y === n.y) ||
            (path[path.length - 1]?.x === n.x && path[path.length - 1]?.y === n.y)
        );
        if (!isEndpoint) {
          if (!next[v]) next[v] = [];
          next[v] = [...next[v], [{ x: n.x, y: n.y }]];
          changed = true;
        }
      }
      return changed ? next : prev;
    });

    checkClear();
  }, [checkClear, numbers]);

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
      {isDevTj && !isDebugMode && (
        <div className="fixed right-4 top-4 z-50">
          <button
            onClick={() => setIsDebugMode(true)}
            className="px-2 py-1 rounded border border-white/20 text-xs font-mono"
            style={{ background: "#334155" }}
          >
            DEBUG OFF
          </button>
        </div>
      )}
      {isDebugMode && (
        <div className="fixed right-4 top-4 z-50 max-h-[90vh] overflow-y-auto rounded-lg border border-white/20 bg-black/80 p-3 text-xs font-mono">
          <div className="flex items-center justify-between gap-2">
            {isDebugPanelExpanded && (
              <span className="font-bold text-emerald-400 shrink-0">デバッグパネル</span>
            )}
            <div className="flex items-center gap-1 shrink-0 ml-auto">
              <button
                onClick={() => setIsDebugMode(false)}
                className="px-2 py-1 rounded border border-white/20"
                style={{ background: "#10b981" }}
              >
                DEBUG ON
              </button>
              <button
                onClick={() => setIsDebugPanelExpanded((v) => !v)}
                className="p-1 rounded border border-white/20 hover:bg-white/10 text-white/80"
                title={isDebugPanelExpanded ? "パネルを閉じる" : "パネルを開く"}
              >
                {isDebugPanelExpanded ? "▲" : "▼"}
              </button>
            </div>
          </div>
          {isDebugPanelExpanded && (
            <>
              <div className="mt-2 space-y-0.5 text-slate-400/90 text-[10px]">
                <div>
                  プリフェッチ状態:{" "}
                  <span className={isPrefetching ? "text-amber-400" : ""}>
                    {isPrefetching ? "生成中...（Running）" : "待機中（Idle）"}
                  </span>
                </div>
                <div>
                  プリフェッチ済みストック数:{" "}
                  <span className="tabular-nums">{stockCount}</span>
                </div>
                <div>
                  最終生成時間:{" "}
                  <span className="tabular-nums">{lastGenerationTimeMs != null ? `${lastGenerationTimeMs}ms` : "—"}</span>
                </div>
                {lastAttempts != null && (
                  <div>
                    Attempts:{" "}
                    <span className="tabular-nums">{lastAttempts} 回</span>
                  </div>
                )}
                {lastTotalMs != null && (
                  <div>
                    全体:{" "}
                    <span className="tabular-nums">{lastTotalMs} ms</span>
                  </div>
                )}
                {lastProfile && Object.keys(lastProfile).length > 0 && (
                  <div className="mt-1 pt-1 border-t border-white/10">
                    <div className="font-semibold text-slate-300 mb-0.5">[累計内訳]（ループ全回分合計）</div>
                    {Object.entries(lastProfile).map(([step, ms]) => {
                      const cn = ms > 100 ? "text-red-400 font-bold" : ms > 16.7 ? "text-amber-400" : "";
                      return (
                        <div key={step} className="flex justify-between gap-2">
                          <span>{step}:</span>
                          <span className={`tabular-nums shrink-0 ${cn}`}>{ms} ms</span>
                        </div>
                      );
                    })}
                  </div>
                )}
                <div>
                  リフレッシュ試行:{" "}
                  最終トライ{" "}
                  {adsRefreshState.lastTryTime
                    ? new Date(adsRefreshState.lastTryTime).toLocaleTimeString("ja-JP")
                    : "—"}
                  {adsRefreshState.lastTryTime ? (
                    <span
                      className={`tabular-nums ml-1 ${
                        Math.floor((Date.now() - adsRefreshState.lastRefreshAt) / 1000) >= 30
                          ? "text-emerald-400"
                          : ""
                      }`}
                    >
                      ({Math.floor((Date.now() - adsRefreshState.lastTryTime) / 1000)}秒前)
                    </span>
                  ) : null}
                </div>
                <div>
                  リフレッシュ成功:{" "}
                  最終更新{" "}
                  {adsRefreshState.lastRefreshAt
                    ? new Date(adsRefreshState.lastRefreshAt).toLocaleTimeString("ja-JP")
                    : "—"}
                  {adsRefreshState.lastRefreshAt ? (
                    <span
                      className={`tabular-nums ml-1 ${
                        Math.floor((Date.now() - adsRefreshState.lastRefreshAt) / 1000) >= 30
                          ? "text-emerald-400"
                          : ""
                      }`}
                    >
                      ({Math.floor((Date.now() - adsRefreshState.lastRefreshAt) / 1000)}秒前)
                    </span>
                  ) : null}
                </div>
                {isDevTj && (
                  <>
                  <DevDebugUserStats />
                  <div className="mt-1 pt-1 border-t border-white/10 space-y-1">
                    <div className="font-semibold text-slate-300">進捗同期</div>
                    <div className="flex items-center gap-1">
                      <span className="text-slate-400 shrink-0">anon_id:</span>
                      <code className="text-[9px] truncate max-w-[120px] bg-black/40 px-1 rounded" title={userSync?.anonId ?? ""}>
                        {userSync?.anonId ?? "—"}
                      </code>
                      <button
                        onClick={() => userSync?.syncNow()}
                        className="px-1 py-0.5 rounded text-[9px] border border-sky-500/50 bg-sky-500/20 text-sky-400 hover:bg-sky-500/30"
                      >
                        同期
                      </button>
                    </div>
                    <div className="font-semibold text-slate-300 mt-1">シード（再現用）</div>
                    <div className="flex items-center gap-1">
                      <span className="text-slate-400 shrink-0">Current Hash:</span>
                      <code className="text-[9px] truncate max-w-[140px] bg-black/40 px-1 rounded" title={currentSeed ?? ""}>
                        {currentSeed ?? "—"}
                      </code>
                      <button
                        onClick={() => {
                          if (currentSeed && navigator.clipboard) {
                            navigator.clipboard.writeText(currentSeed);
                          }
                        }}
                        disabled={!currentSeed}
                        className="px-1 py-0.5 rounded text-[9px] border border-white/20 bg-white/10 hover:bg-white/20 disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        コピー
                      </button>
                    </div>
                    <div className="flex items-center gap-1 flex-wrap">
                      <span className="text-slate-400 shrink-0">Input Hash:</span>
                      <input
                        type="text"
                        value={hashInput}
                        onChange={(e) => setHashInput(e.target.value)}
                        placeholder="ハッシュを入力"
                        className="flex-1 min-w-0 px-1.5 py-0.5 rounded text-[10px] bg-black/60 border border-white/20 text-slate-200"
                      />
                      <button
                        onClick={() => {
                          const s = hashInput.trim();
                          if (s) initGame(gridSize, s);
                        }}
                        disabled={!hashInput.trim() || loading}
                        className="px-2 py-0.5 rounded text-[10px] border border-emerald-500/50 bg-emerald-500/20 text-emerald-400 hover:bg-emerald-500/30 disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        ハッシュから生成
                      </button>
                    </div>
                  </div>
                  </>
                )}
                <div>
                  リフレッシュ回数:{" "}
                  <span
                    className={`tabular-nums transition-colors duration-200 ${
                      countFlashing ? "text-amber-400 font-bold" : ""
                    }`}
                  >
                    {adsRefreshState.refreshCount}
                  </span>
                </div>
              </div>
              <div className="mt-2 flex gap-1">
                {([{ label: "PC", value: null }, { label: "Mobile", value: 375 }, { label: "Tablet", value: 768 }] as const).map(
                  ({ label, value }) => (
                    <button
                      key={label}
                      onClick={() => setForcedWidth(value)}
                      className={`px-2 py-0.5 rounded text-[10px] border border-white/20 transition-colors ${
                        forcedWidth === value ? "bg-emerald-600/80 border-emerald-400" : "bg-black/60 hover:bg-white/10"
                      }`}
                    >
                      {label}
                    </button>
                  )
                )}
              </div>
              <div className="mt-2 flex flex-wrap gap-1">
                <button
                  onClick={() => triggerDebugSolve()}
                  disabled={solved || loading || pairs.length === 0}
                  className="px-2 py-0.5 rounded text-[10px] border border-emerald-500/50 bg-emerald-500/20 text-emerald-400 hover:bg-emerald-500/30 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  強制クリア (Solve & Sync)
                </button>
                <button
                  onClick={() => manualPrefetch()}
                  disabled={isPrefetching}
                  className="px-2 py-0.5 rounded text-[10px] border border-sky-500/50 bg-sky-500/20 text-sky-400 hover:bg-sky-500/30 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  手動プリフェッチ実行
                </button>
                <button
                  onClick={() => refreshAds()}
                  className="px-2 py-0.5 rounded text-[10px] border border-amber-500/50 bg-amber-500/20 text-amber-400 hover:bg-amber-500/30"
                >
                  フラッシュテスト
                </button>
              </div>
            </>
          )}
        </div>
      )}
      <div
        style={
          forcedWidth != null && isDevTj
            ? { width: `${forcedWidth}px`, margin: "0 auto", maxWidth: "100%" }
            : undefined
        }
      >
        <header className="flex justify-between items-center mb-6">
        <DevLink
          href="/"
          className="flex items-center gap-3 text-xl sm:text-2xl font-black tracking-wider text-wit-text no-underline hover:opacity-90"
        >
          <span className="block w-8 h-8 rounded-lg bg-gradient-to-br from-wit-emerald to-teal-600" />
          Wispo
        </DevLink>
        <div className="flex items-center gap-2 text-wit-muted text-sm">
          <span className="tabular-nums">{formatTime(timeSeconds)}</span>
          {solved && <span className="text-wit-emerald">クリア</span>}
        </div>
      </header>

      {/* 広告枠1: PCは上部、モバイルでは盤面直下へ配置（Switching Logic） */}
      <div className={isMobile ? "hidden" : "mb-4"}>
        <PairLinkAdSlot slotIndex={1} isDebugMode={isDebugMode} />
      </div>

      <section className="rounded-2xl p-4 sm:p-6 mb-4 border border-white/10 bg-white/5 backdrop-blur">
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
          {/* 広告枠1（モバイルのみ）: 盤面直下・操作UIの上に配置 */}
          {isMobile && (
            <div className="mt-4 w-full max-w-[520px] mx-auto" style={{ minHeight: 100 }}>
              <PairLinkAdSlot slotIndex={1} isDebugMode={isDebugMode} />
            </div>
          )}
        </div>
        <div className="flex flex-wrap gap-4 items-end justify-center mt-4">
          <div>
            <label className="block text-xs text-wit-muted mb-1">サイズ</label>
            <select
              value={gridSize}
              onChange={(e) => {
                refreshAds();
                initGame(Number(e.target.value));
              }}
              className="px-3 py-2 rounded-lg bg-slate-800 border border-slate-600 text-wit-text text-sm"
            >
              <option value={4}>4×4（ペア3）</option>
              <option value={6}>6×6（ペア5）</option>
              <option value={8}>8×8（ペア7）</option>
              <option value={10}>10×10（ペア9）</option>
            </select>
          </div>
          <button
            onClick={() => {
              refreshAds();
              initGame(gridSize);
            }}
            disabled={loading}
            className="px-4 py-2 rounded-lg bg-wit-emerald text-white text-sm font-medium hover:bg-emerald-600 disabled:opacity-50"
          >
            新規生成
          </button>
        </div>
        {/* 広告枠2（AD-UNIT-B）: サイズ/新規作成の直下 */}
        <div className="mt-4 w-full max-w-[520px] mx-auto" style={{ minHeight: 100 }}>
          <PairLinkAdSlot slotIndex={2} isDebugMode={isDebugMode} />
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
            <div className="flex gap-2 justify-center">
              <button
                onClick={() => setShowClearOverlay(false)}
                className="px-6 py-3 rounded-lg bg-slate-700 text-wit-text font-medium hover:bg-slate-600"
              >
                戻る
              </button>
              <button
                onClick={() => {
                  refreshAds();
                  setShowClearOverlay(false);
                  initGame(gridSize);
                }}
                className="px-6 py-3 rounded-lg bg-wit-emerald text-white font-medium hover:bg-emerald-600"
              >
                次に進む
              </button>
            </div>
          </div>
        </div>
      )}
      </div>
    </div>
  );
}
