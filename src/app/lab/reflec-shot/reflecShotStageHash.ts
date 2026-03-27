import {
  BUMPER_KINDS,
  type BumperCell,
  type BumperKind,
  type CellCoord,
  type GridStage,
} from "./gridTypes";

const PREFIX = "rs1.";

type PayloadV1 = {
  v: 1;
  grade: number;
  seed: number;
  width: number;
  height: number;
  pathable: boolean[][];
  start: CellCoord;
  goal: CellCoord;
  startPad: CellCoord;
  goalPad: CellCoord;
  solutionPath: CellCoord[];
  bumpers: Record<string, { display: BumperKind; solution: BumperKind }>;
};

function toBase64Url(json: string): string {
  const b64 = btoa(unescape(encodeURIComponent(json)));
  return b64.replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function fromBase64Url(b64url: string): string | null {
  try {
    const b64 = b64url.replace(/-/g, "+").replace(/_/g, "/");
    const pad = b64.length % 4 === 0 ? "" : "=".repeat(4 - (b64.length % 4));
    return decodeURIComponent(escape(atob(b64 + pad)));
  } catch {
    return null;
  }
}

function isBumperKind(x: unknown): x is BumperKind {
  return typeof x === "string" && (BUMPER_KINDS as readonly string[]).includes(x);
}

function isCellCoord(x: unknown): x is CellCoord {
  return (
    !!x &&
    typeof x === "object" &&
    typeof (x as CellCoord).c === "number" &&
    typeof (x as CellCoord).r === "number"
  );
}

/** 盤面・パッド・経路・各バンパーの display（プレイ中）/ solution を含む再現用ハッシュ */
export function encodeReflecStageHash(st: GridStage): string {
  const bumpers: PayloadV1["bumpers"] = {};
  st.bumpers.forEach((cell, k) => {
    bumpers[k] = { display: cell.display, solution: cell.solution };
  });
  const payload: PayloadV1 = {
    v: 1,
    grade: st.grade,
    seed: st.seed,
    width: st.width,
    height: st.height,
    pathable: st.pathable,
    start: st.start,
    goal: st.goal,
    startPad: st.startPad,
    goalPad: st.goalPad,
    solutionPath: st.solutionPath,
    bumpers,
  };
  return PREFIX + toBase64Url(JSON.stringify(payload));
}

export function decodeReflecStageHash(raw: string): GridStage | null {
  const t = raw.trim();
  if (!t.startsWith(PREFIX)) return null;
  const json = fromBase64Url(t.slice(PREFIX.length));
  if (!json) return null;
  let parsed: unknown;
  try {
    parsed = JSON.parse(json);
  } catch {
    return null;
  }
  if (!parsed || typeof parsed !== "object") return null;
  const p = parsed as Record<string, unknown>;
  if (p.v !== 1) return null;
  const { grade, seed, width, height, pathable, start, goal, startPad, goalPad, solutionPath, bumpers } = p;

  const gw = typeof width === "number" ? width : NaN;
  const gh = typeof height === "number" ? height : NaN;
  if (!(gw > 0 && gh > 0 && Number.isInteger(gw) && Number.isInteger(gh))) return null;
  if (!Array.isArray(pathable) || pathable.length !== gw) return null;
  for (let c = 0; c < gw; c++) {
    const col = pathable[c];
    if (!Array.isArray(col) || col.length !== gh) return null;
    for (let r = 0; r < gh; r++) {
      if (typeof col[r] !== "boolean") return null;
    }
  }
  if (!isCellCoord(start) || !isCellCoord(goal) || !isCellCoord(startPad) || !isCellCoord(goalPad)) return null;
  if (!Array.isArray(solutionPath) || solutionPath.length < 2) return null;
  for (const cell of solutionPath) {
    if (!isCellCoord(cell)) return null;
  }
  if (!bumpers || typeof bumpers !== "object") return null;
  const map = new Map<string, BumperCell>();
  for (const [k, cell] of Object.entries(bumpers)) {
    if (!cell || typeof cell !== "object") return null;
    const d = (cell as { display?: unknown; solution?: unknown }).display;
    const s = (cell as { display?: unknown; solution?: unknown }).solution;
    if (!isBumperKind(d) || !isBumperKind(s)) return null;
    map.set(k, { display: d, solution: s });
  }

  const gi = typeof grade === "number" ? Math.floor(grade) : 1;
  const si = typeof seed === "number" ? (seed >>> 0) : 0;

  return {
    width: gw,
    height: gh,
    pathable: pathable as boolean[][],
    start,
    goal,
    startPad,
    goalPad,
    bumpers: map,
    solutionPath: solutionPath as CellCoord[],
    grade: gi,
    seed: si,
  };
}
