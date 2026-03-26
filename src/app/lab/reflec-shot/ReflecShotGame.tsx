"use client";

import { useCallback, useEffect, useRef, useState, type PointerEvent } from "react";
import { useSearchParams } from "next/navigation";
import { applyBumper, swipeToBumperKind } from "./bumperRules";
import { generateGridStageWithFallback } from "./gridStageGen";
import {
  DIR,
  isAgentCell,
  keyCell,
  negateDir,
  stageRowRange,
  type BumperKind,
  type CellCoord,
  type Dir,
  type GridStage,
} from "./gridTypes";

const CELL_TRAVEL_MS = 280;
const CHARGE_MS = 520;
const SWIPE_MIN = 12;

type Phase = "edit" | "move" | "won" | "lost";

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

/** 最上段・最下段の「開口」（壁の一部を描かない） */
function strokeRectWithEdgeGaps(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  s: number,
  gapTop: boolean,
  gapBottom: boolean,
  openLen: number
) {
  const mid = x + s / 2;
  const gap = openLen;
  const lo = mid - gap / 2;
  const hi = mid + gap / 2;
  ctx.beginPath();
  ctx.strokeStyle = "rgba(148, 163, 184, 0.35)";
  // left
  ctx.moveTo(x, y);
  ctx.lineTo(x, y + s);
  // bottom
  if (gapBottom) {
    ctx.lineTo(lo, y + s);
    ctx.moveTo(hi, y + s);
    ctx.lineTo(x + s, y + s);
  } else {
    ctx.lineTo(x + s, y + s);
  }
  // right
  ctx.lineTo(x + s, y);
  // top
  if (gapTop) {
    ctx.lineTo(hi, y);
    ctx.moveTo(lo, y);
    ctx.lineTo(x, y);
  } else {
    ctx.lineTo(x, y);
  }
  ctx.stroke();
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

  const simRef = useRef({
    logicalCell: { c: 0, r: 0 } as CellCoord,
    travelDir: DIR.U as Dir,
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

  const roll = useCallback((g: number, s: number) => {
    const st = generateGridStageWithFallback(g, s);
    setStage(st);
    setPhase("edit");
    setStatusMsg("");
    simRef.current = {
      logicalCell: { ...st.launch },
      travelDir: DIR.U,
      fromCell: { ...st.launch },
      toCell: { ...st.launch },
      lerp01: 0,
      leftStart: false,
    };
  }, []);

  useEffect(() => {
    roll(grade, seed);
  }, [grade, seed, roll]);

  const beginShot = useCallback(() => {
    const st = stage;
    if (!st || phase !== "edit") return;
    simRef.current = {
      logicalCell: { ...st.launch },
      travelDir: DIR.U,
      fromCell: { ...st.launch },
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
      if (B.c === st.launch.c && B.r === st.launch.r && sim.leftStart) return "lost";

      if (B.c !== st.launch.c || B.r !== st.launch.r) sim.leftStart = true;

      let dOut = incomingDir;
      const bk = keyCell(B.c, B.r);
      const bump = st.bumpers.get(bk);
      if (bump) dOut = applyBumper(incomingDir, bump.display);

      let next = { c: B.c + dOut.dx, r: B.r + dOut.dy };
      if (!isAgentCell(st, next.c, next.r)) {
        dOut = negateDir(dOut);
        next = { c: B.c + dOut.dx, r: B.r + dOut.dy };
      }
      if (!isAgentCell(st, next.c, next.r)) return "lost";
      return { next, outDir: dOut };
    },
    []
  );

  const tickSim = useCallback(
    (dtMs: number) => {
      const st = stage;
      if (!st || phase !== "move") return;

      const sim = simRef.current;
      sim.lerp01 += dtMs / CELL_TRAVEL_MS;
      if (sim.lerp01 < 1) return;

      sim.lerp01 = 0;
      const B = { ...sim.toCell };
      sim.logicalCell = B;
      const incoming: Dir = {
        dx: B.c - sim.fromCell.c,
        dy: B.r - sim.fromCell.r,
      };
      const res = applyArrival(st, B, incoming);
      if (res === "goal") {
        setPhase("won");
        setStatusMsg("ゴール到達！");
        return;
      }
      if (res === "lost") {
        setPhase("lost");
        setStatusMsg("射出位置に戻りました。バンパーを調整して再チャレンジしてください。");
        sim.leftStart = false;
        return;
      }
      sim.fromCell = B;
      sim.toCell = res.next;
      sim.travelDir = res.outDir;
    },
    [applyArrival, phase, stage]
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
        const isLaunch = c === st.launch.c && r === st.launch.r;
        const isGoalPad = c === st.goalPad.c && r === st.goalPad.r;
        const inArr = r >= 0 && r < st.height;
        const onPadRow = r === st.launch.r || r === st.goalPad.r;

        // パッド行は射出／ゴールの1マスのみ描画。他はキャンバス背景と同化（マス無し）
        if (onPadRow && !isLaunch && !isGoalPad) {
          ctx.fillStyle = "#020617";
          ctx.fillRect(x, y, cellPx, cellPx);
          continue;
        }

        if (isLaunch) {
          ctx.fillStyle = "#1e293b";
          ctx.fillRect(x + 0.5, y + 0.5, cellPx - 1, cellPx - 1);
          ctx.lineWidth = 1;
          strokeRectWithEdgeGaps(ctx, x, y, cellPx, true, false, openLenDraw);
          continue;
        }
        if (isGoalPad) {
          ctx.fillStyle = "#1e293b";
          ctx.fillRect(x + 0.5, y + 0.5, cellPx - 1, cellPx - 1);
          ctx.lineWidth = 1;
          strokeRectWithEdgeGaps(ctx, x, y, cellPx, false, true, openLenDraw);
          continue;
        }

        if (!inArr || !st.pathable[c]![r]) {
          ctx.fillStyle = "#0f172a";
          ctx.fillRect(x, y, cellPx, cellPx);
          continue;
        }

        const isStartEnt = c === st.start.c && r === st.start.r;
        const isGoalEnt = c === st.goal.c && r === st.goal.r;
        ctx.fillStyle = "#1e293b";
        ctx.fillRect(x + 0.5, y + 0.5, cellPx - 1, cellPx - 1);
        ctx.lineWidth = 1;
        if (isStartEnt) {
          strokeRectWithEdgeGaps(ctx, x, y, cellPx, false, true, openLenDraw);
        } else if (isGoalEnt) {
          strokeRectWithEdgeGaps(ctx, x, y, cellPx, true, false, openLenDraw);
        } else {
          ctx.strokeStyle = "rgba(148, 163, 184, 0.25)";
          ctx.strokeRect(x, y, cellPx, cellPx);
        }

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
      const pL = cellCenterPx(st.launch.c, st.launch.r, cellPx, ox, oy, rMin);
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
      logicalCell: { ...stage.launch },
      travelDir: DIR.U,
      fromCell: { ...stage.launch },
      toCell: { ...stage.launch },
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
              <div className="mt-2 border-t border-white/10 pt-2 space-y-0.5 text-slate-400/90 text-[10px]">
                <div>
                  Build:{" "}
                  {typeof window !== "undefined" && window.location.hostname === "localhost"
                    ? "LOCAL"
                    : process.env.NEXT_PUBLIC_VERCEL_GIT_COMMIT_SHA || "-"}
                </div>
                <div>Time: {process.env.NEXT_PUBLIC_BUILD_DATE || "-"}</div>
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
            onChange={(e) => {
              setGrade(Number(e.target.value));
              setSeed((Date.now() ^ (Math.random() * 0x7fffffff)) >>> 0);
            }}
          >
            {[1, 2, 3, 4, 5].map((g) => (
              <option key={g} value={g}>
                {g}（バンパー {g <= 2 ? 1 : g <= 4 ? 2 : 3}）
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
          射出（上方向）
        </button>
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

      {statusMsg && (
        <p className={`text-sm ${phase === "won" ? "text-emerald-400" : phase === "lost" ? "text-amber-300" : "text-wit-muted"}`}>
          {statusMsg}
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
            className="rounded-lg border border-white/15 bg-white/5 px-3 py-2 text-wit-text text-sm hover:bg-white/10"
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
            className="rounded-lg border border-white/15 bg-white/5 px-3 py-2 text-wit-text text-sm hover:bg-white/10"
            onClick={regen}
          >
            ステージ再生成
          </button>
        </div>
      )}

      <ul className="text-wit-muted text-xs leading-relaxed space-y-1 list-disc pl-5">
        <li>グリッド論理パズル：マス中心からマス中心へ等速移動。壁（外縁・Void）で180°反転。</li>
        <li>バンパーは長押し（約{CHARGE_MS}ms）後にスワイプで ／ ＼ － ｜ にスナップ。</li>
        <li>一段下の射出マスに戻ると失敗。最上段の一段上のゴールマスに入るとクリア。</li>
        <li>開発用: <code className="text-slate-500">?devtj=true</code> でデバッグと下部の再生成・自動解答。</li>
      </ul>
    </div>
  );
}
