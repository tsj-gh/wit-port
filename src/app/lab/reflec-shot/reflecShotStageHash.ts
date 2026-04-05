import {
  BUMPER_KINDS,
  type BumperCell,
  type BumperKind,
  type CellCoord,
  type GridStage,
} from "./gridTypes";

const PREFIX_V1 = "rs1.";
const PREFIX_V2 = "rs2.";

export type ParsedReflecHashRs1 = { kind: "rs1"; fullInput: string };
export type ParsedReflecHashRs2 = { kind: "rs2"; grade: number; seed: number };
export type ParsedReflecHash = ParsedReflecHashRs1 | ParsedReflecHashRs2;

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

/** `rs2.{grade}.{hex}` または `rs1....` を判別（生成は行わない） */
export function parseReflecHash(raw: string): ParsedReflecHash | null {
  const t = raw.trim();
  if (!t) return null;
  if (t.toLowerCase().startsWith(PREFIX_V2)) {
    const rest = t.slice(PREFIX_V2.length);
    const dot = rest.indexOf(".");
    if (dot < 0) return null;
    const gradeStr = rest.slice(0, dot);
    const hexStr = rest.slice(dot + 1).trim();
    if (!gradeStr || !hexStr) return null;
    const grade = Math.floor(Number(gradeStr));
    if (!Number.isFinite(grade) || grade < 1) return null;
    if (!/^[0-9a-f]+$/i.test(hexStr) || hexStr.length > 8) return null;
    const seed = parseInt(hexStr, 16) >>> 0;
    if (!Number.isFinite(seed)) return null;
    return { kind: "rs2", grade, seed };
  }
  if (t.startsWith(PREFIX_V1)) {
    return { kind: "rs1", fullInput: t };
  }
  return null;
}

function decodeRs1Payload(t: string): GridStage | null {
  if (!t.startsWith(PREFIX_V1)) return null;
  const json = fromBase64Url(t.slice(PREFIX_V1.length));
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
    const isDummy = (cell as { isDummy?: unknown }).isDummy === true;
    if (!isBumperKind(d) || !isBumperKind(s)) return null;
    map.set(k, isDummy ? { display: d, solution: s, isDummy: true } : { display: d, solution: s });
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

/**
 * Pair-link のシード表示に近い **グレード + seed（hex）** の短い文字列。
 * 盤面復元（rs2）は Worker 側の `generateGridStageWithFallback` を利用すること。
 */
export function encodeReflecStageHash(st: GridStage): string {
  const g = Math.floor(st.grade);
  const s = st.seed >>> 0;
  return `${PREFIX_V2}${g}.${s.toString(16)}`;
}

/**
 * `rs1.` + Base64 JSON のみ同期的に復号。`rs2.` は `parseReflecHash` + Worker 生成を利用。
 */
export function decodeReflecStageHash(raw: string): GridStage | null {
  const p = parseReflecHash(raw);
  if (!p) return null;
  if (p.kind === "rs1") return decodeRs1Payload(p.fullInput);
  return null;
}
