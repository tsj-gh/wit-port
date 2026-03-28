"use client";

import { useCallback, useEffect, useMemo, useRef, useState, type PointerEvent } from "react";
import { useSearchParams } from "next/navigation";
import { applyBumper, swipeToBumperKind } from "./bumperRules";
import {
  MAX_STOCK_SIZE,
  REFLECT_SHOT_STOCK_GRADES,
  useReflectShotBoardStock,
} from "@/hooks/useReflectShotBoardStock";
import { useReflectShotWorker } from "@/hooks/useReflectShotWorker";
import { bendOrBumperHint } from "./gridStageGen";
import {
  addCell,
  DIR,
  isAgentCell,
  keyCell,
  stageRowRange,
  unitOrthoDirBetween,
  type BumperKind,
  type CellCoord,
  type Dir,
  type GridStage,
  cloneGridStageForRestore,
} from "./gridTypes";
import { decodeReflecStageHash, encodeReflecStageHash, parseReflecHash } from "./reflecShotStageHash";

/** 1マス移動の基準時間（ms）。実効速度はこれを速度倍率で除算。 */
const BASE_CELL_TRAVEL_MS = 280;
const CHARGE_MS = 520;
const SWIPE_MIN = 12;

type Phase = "edit" | "move" | "won" | "lost";

type BoardSurfaceSource = "stock" | "generated";

function shotEntryDir(st: GridStage): Dir {
  return unitOrthoDirBetween(st.startPad, st.start) ?? DIR.D;
}

function pathableAt(st: GridStage, c: number, r: number) {
  if (c < 0 || r < 0 || c >= st.width || r >= st.height) return false;
  return st.pathable[c]![r]!;
}

function cellCenterPx(
  c: number,
  r: number,
  cellPx: number,
  ox: number,
  oy: number,
  rMin: number
) {
  const yRow = r - rMin;
  return { x: ox + c * cellPx + cellPx / 2, y: oy + yRow * cellPx + cellPx / 2 };
}

/** 辺の欠け長 = (マス1辺 + 射出体直径) / 2 付近にクランプ */
function portalGapLengthPx(cellPx: number) {
  const diam = 2 * Math.max(6, cellPx * 0.22);
  const mid = (cellPx + diam) / 2;
  return Math.min(cellPx * 0.92, Math.max(mid, diam * 1.05));
}

/**
 * マス四辺すべてで線を中央付近で分断し、欠けに fillColor（マス背景と同色）を塗る
 */
function drawCellGappedBorder(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  s: number,
  fillColor: string,
  openLen: number
) {
  const g = Math.min(openLen, s * 0.92);
  const midX = x + s / 2;
  const midY = y + s / 2;
  const loX = midX - g / 2;
  const hiX = midX + g / 2;
  const loY = midY - g / 2;
  const hiY = midY + g / 2;
  const stripeW = 3.5;

  ctx.strokeStyle = "rgba(148, 163, 184, 0.25)";
  ctx.lineWidth = 1;

  ctx.beginPath();
  ctx.moveTo(x, y);
  ctx.lineTo(loX, y);
  ctx.moveTo(hiX, y);
  ctx.lineTo(x + s, y);
  ctx.stroke();
  ctx.fillStyle = fillColor;
  ctx.fillRect(loX, y - stripeW / 2, hiX - loX, stripeW);

  ctx.beginPath();
  ctx.moveTo(x, y + s);
  ctx.lineTo(loX, y + s);
  ctx.moveTo(hiX, y + s);
  ctx.lineTo(x + s, y + s);
  ctx.stroke();
  ctx.fillStyle = fillColor;
  ctx.fillRect(loX, y + s - stripeW / 2, hiX - loX, stripeW);

  ctx.beginPath();
  ctx.moveTo(x, y);
  ctx.lineTo(x, loY);
  ctx.moveTo(x, hiY);
  ctx.lineTo(x, y + s);
  ctx.stroke();
  ctx.fillStyle = fillColor;
  ctx.fillRect(x - stripeW / 2, loY, stripeW, hiY - loY);

  ctx.beginPath();
  ctx.moveTo(x + s, y);
  ctx.lineTo(x + s, loY);
  ctx.moveTo(x + s, hiY);
  ctx.lineTo(x + s, y + s);
  ctx.stroke();
  ctx.fillStyle = fillColor;
  ctx.fillRect(x + s - stripeW / 2, loY, stripeW, hiY - loY);
}

function bumperSymbol(k: BumperKind): string {
  switch (k) {
    case "SLASH":
      return "／";
    case "BACKSLASH":
      return "＼";
    case "HYPHEN":
      return "－";
    case "PIPE":
      return "｜";
    default:
      return "?";
  }
}

export default function ReflecShotGame() {
  const searchParams = useSearchParams();
  const isDevTj = searchParams.get("devtj") === "true";

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [grade, setGrade] = useState(1);
  const [seed, setSeed] = useState(() => (Date.now() ^ (Math.random() * 0x7fffffff)) >>> 0);
  const [stage, setStage] = useState<GridStage | null>(null);
  const [phase, setPhase] = useState<Phase>("edit");
  const [statusMsg, setStatusMsg] = useState("");
  const [bumperTick, setBumperTick] = useState(0);
  const [isDebugMode, setIsDebugMode] = useState(false);
  const [isDebugPanelExpanded, setIsDebugPanelExpanded] = useState(true);
  const [showSolutionPath, setShowSolutionPath] = useState(false);
  /** デバッグ時のみスライダーで変更。非デバッグ・非 devtj 時は 3.5 固定。 */
  const [debugBallSpeedMult, setDebugBallSpeedMult] = useState(3.5);
  const [hashInput, setHashInput] = useState("");
  const [layoutNonce, setLayoutNonce] = useState(0);
  const [stockPrefetchPaused, setStockPrefetchPaused] = useState(false);
  const nextBoardSourceRef = useRef<BoardSurfaceSource | null>(null);
  const [boardDisplaySource, setBoardDisplaySource] = useState<BoardSurfaceSource | null>(null);
  const pendingRestoreRef = useRef<GridStage | null>(null);
  const { generate: generateStageInWorker, isGenerating, lastMetrics } = useReflectShotWorker();
  const { stockCounts, takeBoardForGrade } = useReflectShotBoardStock(
    generateStageInWorker,
    !stockPrefetchPaused
  );
  const [boardLoadWait, setBoardLoadWait] = useState(false);

  const simRef = useRef({
    logicalCell: { c: 0, r: 0 } as CellCoord,
    travelDir: DIR.D as Dir,
    fromCell: { c: 0, r: 0 } as CellCoord,
    toCell: { c: 0, r: 0 } as CellCoord,
    lerp01: 0,
    leftStart: false,
  });

  const chargeRef = useRef<{
    pointerId: number;
    t0: number;
    cellKey: string;
    originX: number;
    originY: number;
    curX: number;
    curY: number;
    hasSwipe: boolean;
  } | null>(null);

  useEffect(() => {
    const pending = pendingRestoreRef.current;
    if (pending) {
      pendingRestoreRef.current = null;
      const src: BoardSurfaceSource = nextBoardSourceRef.current ?? "generated";
      nextBoardSourceRef.current = null;
      setBoardDisplaySource(src);
      const cloned = cloneGridStageForRestore(pending);
      setStage(cloned);
      setPhase("edit");
      setStatusMsg("");
      setBumperTick((t) => t + 1);
      simRef.current = {
        logicalCell: { ...cloned.startPad },
        travelDir: shotEntryDir(cloned),
        fromCell: { ...cloned.startPad },
        toCell: { ...cloned.startPad },
        lerp01: 0,
        leftStart: false,
      };
      return;
    }

    const fromStock = takeBoardForGrade(grade);
    if (fromStock) {
      nextBoardSourceRef.current = "stock";
      pendingRestoreRef.current = fromStock;
      setSeed(fromStock.seed >>> 0);
      setLayoutNonce((n) => n + 1);
      return;
    }

    let cancelled = false;
    setBoardLoadWait(true);
    setStatusMsg("盤面を準備中…");
    (async () => {
      try {
        const { stage } = await generateStageInWorker(grade, seed);
        if (cancelled) return;
        const cloned = cloneGridStageForRestore(stage);
        setBoardDisplaySource("generated");
        setStage(cloned);
        setPhase("edit");
        setStatusMsg("");
        setBumperTick((t) => t + 1);
        simRef.current = {
          logicalCell: { ...cloned.startPad },
          travelDir: shotEntryDir(cloned),
          fromCell: { ...cloned.startPad },
          toCell: { ...cloned.startPad },
          lerp01: 0,
          leftStart: false,
        };
      } catch {
        if (!cancelled) setStatusMsg("盤面の生成に失敗しました（Worker）");
      } finally {
        if (!cancelled) setBoardLoadWait(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [grade, seed, layoutNonce, generateStageInWorker, takeBoardForGrade]);

  const currentStageHash = useMemo(
    () => (stage ? encodeReflecStageHash(stage) : ""),
    [stage?.grade, stage?.seed]
  );

  const applyStageFromHash = useCallback(
    (raw: string) => {
      const t = raw.trim();
      const parsed = parseReflecHash(t);
      if (!parsed) {
        setStatusMsg("ハッシュの解析に失敗しました");
        return;
      }
      if (parsed.kind === "rs1") {
        const st = decodeReflecStageHash(t);
        if (!st) {
          setStatusMsg("ハッシュの解析に失敗しました");
          return;
        }
        nextBoardSourceRef.current = "generated";
        pendingRestoreRef.current = st;
        setGrade(st.grade);
        setSeed(st.seed >>> 0);
        setLayoutNonce((n) => n + 1);
        return;
      }
      void (async () => {
        try {
          const { stage } = await generateStageInWorker(parsed.grade, parsed.seed);
          nextBoardSourceRef.current = "generated";
          pendingRestoreRef.current = cloneGridStageForRestore(stage);
          setGrade(stage.grade);
          setSeed(stage.seed >>> 0);
          setLayoutNonce((n) => n + 1);
        } catch {
          setStatusMsg("ハッシュからの生成に失敗しました");
        }
      })();
    },
    [generateStageInWorker]
  );

  const goNextProblem = useCallback(() => {
    if (phase !== "won") return;
    const next = takeBoardForGrade(grade);
    if (next) {
      nextBoardSourceRef.current = "stock";
      pendingRestoreRef.current = next;
      setSeed(next.seed >>> 0);
      setLayoutNonce((n) => n + 1);
      return;
    }
    setBoardLoadWait(true);
    setStatusMsg("ストックが空のため盤面を生成しています…");
    void (async () => {
      try {
        const { stage: st } = await generateStageInWorker(
          grade,
          (Date.now() ^ (Math.random() * 0x7fffffff)) >>> 0
        );
        nextBoardSourceRef.current = "generated";
        pendingRestoreRef.current = cloneGridStageForRestore(st);
        setSeed(st.seed >>> 0);
        setLayoutNonce((n) => n + 1);
        setStatusMsg("");
      } catch {
        setStatusMsg("次の盤面の生成に失敗しました（Worker）");
      } finally {
        setBoardLoadWait(false);
      }
    })();
  }, [phase, grade, takeBoardForGrade, generateStageInWorker]);

  const beginShot = useCallback(() => {
    const st = stage;
    if (!st || phase !== "edit") return;
    simRef.current = {
      logicalCell: { ...st.startPad },
      travelDir: shotEntryDir(st),
      fromCell: { ...st.startPad },
      toCell: { ...st.start },
      lerp01: 0,
      leftStart: false,
    };
    setPhase("move");
    setStatusMsg("");
  }, [phase, stage]);

  const applyArrival = useCallback(
    (st: GridStage, B: CellCoord, incomingDir: Dir): { next: CellCoord; outDir: Dir } | "goal" | "lost" => {
      const sim = simRef.current;
      if (B.c === st.goalPad.c && B.r === st.goalPad.r) return "goal";
      if (B.c === st.startPad.c && B.r === st.startPad.r && sim.leftStart) return "lost";

      if (B.c !== st.startPad.c || B.r !== st.startPad.r) sim.leftStart = true;

      let dOut = incomingDir;
      const bk = keyCell(B.c, B.r);
      const bump = st.bumpers.get(bk);
      if (bump) dOut = applyBumper(incomingDir, bump.display);

      const next = addCell(B, dOut);
      // 進行・跳ね返り後の隣マスが壁／盤外なら壁で追い返さず失敗（U ターンしない）
      if (!isAgentCell(st, next.c, next.r)) return "lost";
      return { next, outDir: dOut };
    },
    []
  );

  const tickSim = useCallback(
    (dtMs: number) => {
      const st = stage;
      if (!st || phase !== "move") return;

      const speedMult = isDevTj && isDebugMode ? debugBallSpeedMult : 3.5;
      const cellTravelMs = BASE_CELL_TRAVEL_MS / speedMult;

      const sim = simRef.current;
      sim.lerp01 += dtMs / cellTravelMs;
      if (sim.lerp01 < 1) return;

      sim.lerp01 = 0;
      const B = { ...sim.toCell };
      sim.logicalCell = B;
      const incoming: Dir = {
        dx: B.c - sim.fromCell.c,
        dy: sim.fromCell.r - B.r,
      };
      const res = applyArrival(st, B, incoming);
      if (res === "goal") {
        // 到達フレームで lerp=0 のとき描画は fromCell を参照するため、ゴールパッドにスナップする
        sim.fromCell = { ...B };
        sim.toCell = { ...B };
        setPhase("won");
        setStatusMsg("ゴール到達！");
        return;
      }
      if (res === "lost") {
        sim.fromCell = { ...B };
        sim.toCell = { ...B };
        sim.leftStart = false;
        setPhase("lost");
        setStatusMsg(
          "失敗です。壁へ向かう進行・反射になったか、射出位置へ戻ってしまいました。バンパーを調整してください。"
        );
        return;
      }
      sim.fromCell = B;
      sim.toCell = res.next;
      sim.travelDir = res.outDir;
    },
    [applyArrival, debugBallSpeedMult, isDebugMode, isDevTj, phase, stage]
  );

  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    const st = stage;
    if (!canvas || !st) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const rect = canvas.getBoundingClientRect();
    const wPx = Math.max(1, Math.floor(rect.width));
    const hPx = Math.max(1, Math.floor(rect.height));
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    canvas.width = Math.floor(wPx * dpr);
    canvas.height = Math.floor(hPx * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    const { rMin, rMax } = stageRowRange(st);
    const nRows = rMax - rMin + 1;
    const cellPx = Math.max(
      24,
      Math.floor(Math.min(wPx / st.width, hPx / nRows) * 0.92)
    );
    const gw = cellPx * st.width;
    const gh = cellPx * nRows;
    const ox = (wPx - gw) / 2;
    const oy = (hPx - gh) / 2;

    ctx.fillStyle = "#020617";
    ctx.fillRect(0, 0, wPx, hPx);

    const rowY = (r: number) => oy + (r - rMin) * cellPx;
    const openLenDraw = portalGapLengthPx(cellPx);

    for (let r = rMin; r <= rMax; r++) {
      for (let c = 0; c < st.width; c++) {
        const x = ox + c * cellPx;
        const y = rowY(r);
        const isStartPad = c === st.startPad.c && r === st.startPad.r;
        const isGoalPad = c === st.goalPad.c && r === st.goalPad.r;
        const inArr = r >= 0 && r < st.height;
        const onPadRow = r === st.startPad.r || r === st.goalPad.r;

        // パッド行は射出／ゴールの1マスのみ描画。他はキャンバス背景と同化（マス無し）
        if (onPadRow && !isStartPad && !isGoalPad) {
          ctx.fillStyle = "#020617";
          ctx.fillRect(x, y, cellPx, cellPx);
          continue;
        }

        if (isStartPad) {
          const padFill = "#1a2f3c";
          ctx.fillStyle = padFill;
          ctx.fillRect(x + 0.5, y + 0.5, cellPx - 1, cellPx - 1);
          ctx.lineWidth = 1;
          drawCellGappedBorder(ctx, x, y, cellPx, padFill, openLenDraw);
          continue;
        }
        if (isGoalPad) {
          const padFill = "#222038";
          ctx.fillStyle = padFill;
          ctx.fillRect(x + 0.5, y + 0.5, cellPx - 1, cellPx - 1);
          ctx.lineWidth = 1;
          drawCellGappedBorder(ctx, x, y, cellPx, padFill, openLenDraw);
          continue;
        }

        if (!inArr || !st.pathable[c]![r]) {
          const voidFill = "#0f172a";
          ctx.fillStyle = voidFill;
          ctx.fillRect(x, y, cellPx, cellPx);
          ctx.lineWidth = 1;
          drawCellGappedBorder(ctx, x, y, cellPx, voidFill, openLenDraw);
          continue;
        }

        const pathFill = "#1e293b";
        ctx.fillStyle = pathFill;
        ctx.fillRect(x + 0.5, y + 0.5, cellPx - 1, cellPx - 1);
        ctx.lineWidth = 1;
        drawCellGappedBorder(ctx, x, y, cellPx, pathFill, openLenDraw);

        const k = keyCell(c, r);
        const b = st.bumpers.get(k);
        if (b) {
          ctx.fillStyle = "rgba(56, 189, 248, 0.95)";
          ctx.font = `bold ${Math.floor(cellPx * 0.42)}px sans-serif`;
          ctx.textAlign = "center";
          ctx.textBaseline = "middle";
          ctx.fillText(bumperSymbol(b.display), x + cellPx / 2, y + cellPx / 2 + 1);
        }
      }
    }

    if (isDevTj && isDebugMode && showSolutionPath && st.solutionPath.length > 1) {
      ctx.strokeStyle = "rgba(244, 63, 94, 0.55)";
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      const pL = cellCenterPx(st.startPad.c, st.startPad.r, cellPx, ox, oy, rMin);
      const p0 = cellCenterPx(st.solutionPath[0]!.c, st.solutionPath[0]!.r, cellPx, ox, oy, rMin);
      ctx.moveTo(pL.x, pL.y);
      ctx.lineTo(p0.x, p0.y);
      for (let i = 1; i < st.solutionPath.length; i++) {
        const p = cellCenterPx(st.solutionPath[i]!.c, st.solutionPath[i]!.r, cellPx, ox, oy, rMin);
        ctx.lineTo(p.x, p.y);
      }
      const pG = cellCenterPx(st.goalPad.c, st.goalPad.r, cellPx, ox, oy, rMin);
      ctx.lineTo(pG.x, pG.y);
      ctx.stroke();
    }

    const sim = simRef.current;
    const f = sim.fromCell;
    const t = sim.toCell;
    const af = cellCenterPx(f.c, f.r, cellPx, ox, oy, rMin);
    const at = cellCenterPx(t.c, t.r, cellPx, ox, oy, rMin);
    const u = Math.min(1, sim.lerp01);
    const ax = af.x + (at.x - af.x) * u;
    const ay = af.y + (at.y - af.y) * u;
    const rad = Math.max(6, cellPx * 0.22);
    ctx.fillStyle = "#f8fafc";
    ctx.beginPath();
    ctx.arc(ax, ay, rad, 0, Math.PI * 2);
    ctx.fill();

    canvas.dataset.cellPx = String(cellPx);
    canvas.dataset.ox = String(ox);
    canvas.dataset.oy = String(oy);
    canvas.dataset.rMin = String(rMin);
  }, [isDebugMode, isDevTj, showSolutionPath, stage]);

  useEffect(() => {
    let raf = 0;
    let last = performance.now();
    const loop = (now: number) => {
      const dt = now - last;
      last = now;
      tickSim(dt);
      draw();
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [draw, tickSim]);

  useEffect(() => {
    draw();
  }, [bumperTick, draw, phase, stage]);

  const pixelToCell = (px: number, py: number): CellCoord | null => {
    const canvas = canvasRef.current;
    if (!canvas || !stage) return null;
    const cellPx = Number(canvas.dataset.cellPx) || 32;
    const ox = Number(canvas.dataset.ox) || 0;
    const oy = Number(canvas.dataset.oy) || 0;
    const rMin = Number(canvas.dataset.rMin) || stageRowRange(stage).rMin;
    const c = Math.floor((px - ox) / cellPx);
    const r = Math.floor((py - oy) / cellPx) + rMin;
    if (!pathableAt(stage, c, r)) return null;
    return { c, r };
  };

  const onPointerDown = (e: PointerEvent<HTMLCanvasElement>) => {
    if (phase !== "edit" || !stage) return;
    const rect = canvasRef.current?.getBoundingClientRect();
    if (!rect) return;
    const px = e.clientX - rect.left;
    const py = e.clientY - rect.top;
    const cell = pixelToCell(px, py);
    if (!cell) return;
    const k = keyCell(cell.c, cell.r);
    if (!stage.bumpers.has(k)) return;
    e.currentTarget.setPointerCapture(e.pointerId);
    chargeRef.current = {
      pointerId: e.pointerId,
      t0: performance.now(),
      cellKey: k,
      originX: px,
      originY: py,
      curX: px,
      curY: py,
      hasSwipe: false,
    };
  };

  const onPointerMove = (e: PointerEvent<HTMLCanvasElement>) => {
    const ch = chargeRef.current;
    if (!ch || ch.pointerId !== e.pointerId || !stage) return;
    const rect = canvasRef.current?.getBoundingClientRect();
    if (!rect) return;
    ch.curX = e.clientX - rect.left;
    ch.curY = e.clientY - rect.top;
    const dx = ch.curX - ch.originX;
    const dy = ch.curY - ch.originY;
    if (dx * dx + dy * dy >= SWIPE_MIN * SWIPE_MIN) ch.hasSwipe = true;
  };

  const onPointerUp = (e: PointerEvent<HTMLCanvasElement>) => {
    const ch = chargeRef.current;
    if (!ch || ch.pointerId !== e.pointerId || !stage) {
      try {
        e.currentTarget.releasePointerCapture(e.pointerId);
      } catch {
        /* ignore */
      }
      return;
    }
    const elapsed = performance.now() - ch.t0;
    chargeRef.current = null;
    try {
      e.currentTarget.releasePointerCapture(e.pointerId);
    } catch {
      /* ignore */
    }
    if (elapsed < CHARGE_MS) return;
    if (!ch.hasSwipe) return;
    const dx = ch.curX - ch.originX;
    const dy = ch.curY - ch.originY;
    const kind = swipeToBumperKind(dx, dy);
    const b = stage.bumpers.get(ch.cellKey);
    if (b) {
      b.display = kind;
      setBumperTick((t) => t + 1);
    }
  };

  const onPointerCancel = (e: PointerEvent<HTMLCanvasElement>) => {
    chargeRef.current = null;
    try {
      e.currentTarget.releasePointerCapture(e.pointerId);
    } catch {
      /* ignore */
    }
  };

  const regen = () => setSeed((Date.now() ^ (Math.random() * 0x7fffffff)) >>> 0);

  const autoSolve = () => {
    const st = stage;
    if (!st || phase !== "edit") return;
    st.bumpers.forEach((v) => {
      v.display = v.solution;
    });
    setBumperTick((t) => t + 1);
    setTimeout(() => beginShot(), 30);
  };

  const retryAfterLoss = () => {
    if (!stage) return;
    setPhase("edit");
    setStatusMsg("");
    simRef.current = {
      logicalCell: { ...stage.startPad },
      travelDir: shotEntryDir(stage),
      fromCell: { ...stage.startPad },
      toCell: { ...stage.startPad },
      lerp01: 0,
      leftStart: false,
    };
  };

  return (
    <div className="w-full max-w-lg mx-auto flex flex-col gap-3">
      {isDevTj && !isDebugMode && (
        <div className="fixed right-4 top-4 z-50">
          <button
            type="button"
            onClick={() => setIsDebugMode(true)}
            className="px-2 py-1 rounded border border-white/20 text-xs font-mono"
            style={{ background: "#334155" }}
          >
            DEBUG OFF
          </button>
        </div>
      )}
      {isDevTj && isDebugMode && (
        <div className="fixed right-4 top-4 z-50 max-h-[90vh] overflow-y-auto rounded-lg border border-white/20 bg-black/80 p-3 text-xs font-mono text-left">
          <div className="flex items-center justify-between gap-2">
            {isDebugPanelExpanded && <span className="font-bold text-emerald-400">デバッグ</span>}
            <div className="flex items-center gap-1 ml-auto">
              <button
                type="button"
                onClick={() => setIsDebugMode(false)}
                className="px-2 py-1 rounded border border-white/20"
                style={{ background: "#10b981" }}
              >
                DEBUG ON
              </button>
              <button
                type="button"
                onClick={() => setIsDebugPanelExpanded((v) => !v)}
                className="p-1 rounded border border-white/20 text-white/80"
              >
                {isDebugPanelExpanded ? "▲" : "▼"}
              </button>
            </div>
          </div>
          {isDebugPanelExpanded && (
            <>
              <label className="mt-2 flex items-center gap-2 text-slate-400 cursor-pointer">
                <input
                  type="checkbox"
                  checked={showSolutionPath}
                  onChange={(e) => setShowSolutionPath(e.target.checked)}
                  className="accent-rose-400"
                />
                正解経路（メインシーケンス・直線）
              </label>
              <div className="mt-2 flex items-center gap-2 text-slate-400">
                <span className="shrink-0 text-[10px]">球の速度</span>
                <input
                  type="range"
                  min={0.25}
                  max={4}
                  step={0.25}
                  value={debugBallSpeedMult}
                  onChange={(e) => setDebugBallSpeedMult(Number(e.target.value))}
                  className="flex-1 min-w-0 accent-sky-400"
                />
                <span className="tabular-nums w-10 text-right text-[10px] text-sky-200/90">{debugBallSpeedMult}×</span>
              </div>
              <div className="mt-2 border-t border-white/10 pt-2 space-y-0.5 text-slate-400/90 text-[10px]">
                <div>
                  Build:{" "}
                  {typeof window !== "undefined" && window.location.hostname === "localhost"
                    ? "LOCAL"
                    : process.env.NEXT_PUBLIC_VERCEL_GIT_COMMIT_SHA || "-"}
                </div>
                <div>Time: {process.env.NEXT_PUBLIC_BUILD_DATE || "-"}</div>
                <div>
                  盤面 Worker:{" "}
                  {isGenerating
                    ? "RUNNING"
                    : lastMetrics
                      ? `${lastMetrics.totalMs.toFixed(1)} ms`
                      : "—"}
                </div>
                <div className="text-sky-200/80">
                  Stock:{" "}
                  {REFLECT_SHOT_STOCK_GRADES.map((g) => (
                    <span key={g} className="mr-1.5">
                      G{g} {stockCounts[g]}/{MAX_STOCK_SIZE}
                    </span>
                  ))}
                </div>
                <div className="text-slate-300">
                  Source:{" "}
                  {boardDisplaySource === "stock"
                    ? "Stock"
                    : boardDisplaySource === "generated"
                      ? "Generated"
                      : "—"}
                  {stage?.grade === 2 && stage.grade2PadAdjustLabel && (
                    <span className="text-yellow-300"> {stage.grade2PadAdjustLabel}</span>
                  )}
                </div>
                <label className="flex items-center gap-2 text-slate-400 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={stockPrefetchPaused}
                    onChange={(e) => setStockPrefetchPaused(e.target.checked)}
                    className="accent-amber-400"
                  />
                  Stockの生成を停止
                </label>
              </div>
              <div className="mt-2 border-t border-white/10 pt-2 space-y-1.5">
                <div className="font-semibold text-slate-300 text-[10px]">シード（初期盤再現）</div>
                <div className="flex items-start gap-1 flex-wrap">
                  <span className="text-slate-400 shrink-0 text-[10px]">Current:</span>
                  <code
                    className="text-[9px] break-all flex-1 min-w-0 bg-black/40 px-1 rounded text-emerald-200/90 max-h-20 overflow-y-auto"
                    title={currentStageHash || "—"}
                  >
                    {currentStageHash || "—"}
                  </code>
                  <button
                    type="button"
                    onClick={() => {
                      if (currentStageHash && navigator.clipboard) {
                        navigator.clipboard.writeText(currentStageHash);
                      }
                    }}
                    disabled={!currentStageHash}
                    className="px-1.5 py-0.5 rounded text-[9px] border border-white/20 bg-white/10 hover:bg-white/20 disabled:opacity-40 shrink-0"
                  >
                    コピー
                  </button>
                </div>
                <div className="flex items-center gap-1 flex-wrap">
                  <span className="text-slate-400 shrink-0 text-[10px]">入力:</span>
                  <input
                    type="text"
                    value={hashInput}
                    onChange={(e) => setHashInput(e.target.value)}
                    placeholder="rs2.{grade}.{hex}"
                    className="flex-1 min-w-0 px-1.5 py-0.5 rounded text-[10px] bg-black/60 border border-white/20 text-slate-200"
                  />
                  <button
                    type="button"
                    onClick={() => {
                      const s = hashInput.trim();
                      if (s) applyStageFromHash(s);
                    }}
                    disabled={!hashInput.trim() || isGenerating || boardLoadWait}
                    className="px-2 py-0.5 rounded text-[10px] border border-emerald-500/50 bg-emerald-500/20 text-emerald-400 hover:bg-emerald-500/30 disabled:opacity-40"
                  >
                    ハッシュから生成
                  </button>
                </div>
                <p className="text-[9px] text-slate-500 leading-snug">
                  <code className="text-slate-400">rs2.</code> はグレードと seed のみ（生成と同じ初期盤）。旧{" "}
                  <code className="text-slate-400">rs1.</code> 長形式も解釈します。
                </p>
              </div>
            </>
          )}
        </div>
      )}

      <div className="flex flex-wrap items-center gap-2 text-sm">
        <label className="text-wit-muted flex items-center gap-2">
          Grade
          <select
            className="bg-slate-800 border border-white/15 rounded-lg px-2 py-1 text-wit-text"
            value={grade}
            disabled={isGenerating || boardLoadWait}
            onChange={(e) => {
              setGrade(Number(e.target.value));
              setSeed((Date.now() ^ (Math.random() * 0x7fffffff)) >>> 0);
            }}
          >
            {[1, 2, 3, 4, 5].map((g) => (
              <option key={g} value={g}>
                {g}（{bendOrBumperHint(g)}）
              </option>
            ))}
          </select>
        </label>
        <button
          type="button"
          className="rounded-lg border border-sky-500/40 bg-sky-500/15 px-3 py-1 text-sky-200 hover:bg-sky-500/25"
          onClick={beginShot}
          disabled={phase !== "edit" || !stage}
        >
          射出（start へ）
        </button>
        {phase === "won" && (
          <button
            type="button"
            className="rounded-lg border border-emerald-500/40 bg-emerald-500/15 px-3 py-1 text-emerald-200 hover:bg-emerald-500/25 disabled:opacity-40"
            onClick={goNextProblem}
            disabled={boardLoadWait}
          >
            次の問題へ
          </button>
        )}
        {phase === "lost" && (
          <button
            type="button"
            className="rounded-lg border border-amber-500/40 bg-amber-500/15 px-3 py-1 text-amber-200"
            onClick={retryAfterLoss}
          >
            再配置して再開
          </button>
        )}
      </div>

      {(statusMsg || boardLoadWait) && (
        <p
          className={`text-sm ${
            phase === "won"
              ? "text-emerald-400"
              : phase === "lost"
                ? "text-amber-300"
                : boardLoadWait
                  ? "text-sky-300"
                  : "text-wit-muted"
          }`}
        >
          {boardLoadWait && !statusMsg ? "盤面を準備中…" : statusMsg}
        </p>
      )}

      <canvas
        ref={canvasRef}
        className="w-full aspect-square max-h-[min(72vh,520px)] mx-auto rounded-2xl border border-white/10 bg-slate-950 touch-none select-none cursor-default"
        style={{ touchAction: "none" }}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerCancel}
      />

      {isDevTj && (
        <div className="flex flex-wrap gap-2 justify-center pb-2">
          <button
            type="button"
            disabled={isGenerating || boardLoadWait}
            className="rounded-lg border border-white/15 bg-white/5 px-3 py-2 text-wit-text text-sm hover:bg-white/10 disabled:opacity-40 disabled:pointer-events-none"
            onClick={regen}
          >
            ステージ再生成
          </button>
          <button
            type="button"
            className="rounded-lg border border-emerald-500/40 bg-emerald-500/15 px-3 py-2 text-emerald-300 text-sm hover:bg-emerald-500/25"
            onClick={autoSolve}
          >
            自動解答
          </button>
        </div>
      )}

      {!isDevTj && (
        <div className="flex justify-center pb-2">
          <button
            type="button"
            disabled={isGenerating || boardLoadWait}
            className="rounded-lg border border-white/15 bg-white/5 px-3 py-2 text-wit-text text-sm hover:bg-white/10 disabled:opacity-40 disabled:pointer-events-none"
            onClick={regen}
          >
            ステージ再生成
          </button>
        </div>
      )}

      <ul className="text-wit-muted text-xs leading-relaxed space-y-1 list-disc pl-5">
        <li>グリッド論理パズル：マス中心からマス中心へ等速移動。進行・バンパー反射の向きが壁（外縁・Void）へ向くと失敗。</li>
        <li>バンパーは長押し（約{CHARGE_MS}ms）後にスワイプで ／ ＼ － ｜ にスナップ。</li>
        <li>スタート側パッド（startPad）に戻ると失敗。ゴール側パッド（goalPad）に入るとクリア（グレードによりパッドの位置が異なります）。</li>
        <li>開発用: <code className="text-slate-500">?devtj=true</code> でデバッグと下部の再生成・自動解答。</li>
      </ul>
    </div>
  );
}
