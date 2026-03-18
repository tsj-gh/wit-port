"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";

const BALANCE_LIMIT = 100;
const NPC_WEIGHT_MIN = 10;
const NPC_WEIGHT_MAX = 50;
const INITIAL_TIMER = 10;
const WEIGHT_VALUES = [1, 3, 5, 10, 20];
const INVENTORY_COUNT = 8;
const PAN_MAX_VISIBLE_HEIGHT = 120;
/** 器のコンテンツ領域の下端（py-2で上下8pxあるため） */
const PAN_CONTENT_BOTTOM = PAN_MAX_VISIBLE_HEIGHT - 16;
const BLOCK_HEIGHT = 28;
const VIEW_HEIGHT = 360;
const MIN_ZOOM_SCALE = 0.5;
const ZOOM_MARGIN = 80;
const OFFSCREEN_INDICATOR_THRESHOLD = 180;
const DEFAULT_P1_OFFSET_Y = -350; // P1.y = P0.y + p1OffsetY
const DURATION_MIN = 0.3;
const DURATION_MAX = 0.8;
const DEBUG_OVERLAY_DURATION_MS = 3000;
const FIXED_P2_Y_RATIO = 0.45; // P2 at 45% from top of viewport (stable target)
const DEFAULT_DOUBLE_CLICK_VX = 800;
const DEFAULT_DOUBLE_CLICK_VY = -200;
const IMPACT_DURATION = 0.4; // seconds
const FALL_DURATION = 0.6; // Miss shot: fall off screen
const DEBUG = false;

const NPC_ITEM_APPEAR_DELAY_MS = 300;
const NPC_ITEM_FLY_DELAY_MS = 500;
const NPC_LEFT_SINK_WAIT_MS = 400;

// 天秤位置デバッグ用デフォルト値
type LayoutParams = {
  scaleWrapperTopOffset: number;
  scaleWrapperMaxOffset: number;
  scaleAreaMinHeight: number;
  armHeight: number;
  gameGap: number;
  headerHeightRem: number;
};
const DEBUG_LAYOUT_DEFAULTS: LayoutParams = {
  scaleWrapperTopOffset: 100,
  scaleWrapperMaxOffset: 200,
  scaleAreaMinHeight: 200,
  armHeight: 256,
  gameGap: 12,
  headerHeightRem: 96,
};

const DEBUG_ITEM: WeightItem = (() => {
  const w = createWeightItem(0, "debug-item");
  w.visual = { bgClass: "bg-emerald-600", borderClass: "border-emerald-400", size: "md" };
  return w;
})();

type DebugOverlay = {
  p0: { x: number; y: number };
  p1: { x: number; y: number };
  p2: { x: number; y: number };
  vx: number;
  vy: number;
};

function bezier2(t: number, P0: { x: number; y: number }, P1: { x: number; y: number }, P2: { x: number; y: number }) {
  const mt = 1 - t;
  return {
    x: mt * mt * P0.x + 2 * mt * t * P1.x + t * t * P2.x,
    y: mt * mt * P0.y + 2 * mt * t * P1.y + t * t * P2.y,
  };
}

type Phase = "ready" | "npc" | "transition" | "user" | "gameover" | "result";

type WeightItem = {
  id: string;
  value: number;
  visual: {
    bgClass: string;
    borderClass: string;
    size: "sm" | "md" | "lg";
  };
  position: { x: number; y: number };
};

type HistoryEntry = {
  round: number;
  left: number;
  right: number;
  diff: number;
};

type PlacedWeight = {
  id: string;
  side: "left" | "right";
  value: number;
  x: number;
  y: number;
};

function getWeightHeight(value: number, side: "left" | "right"): number {
  if (side === "left") return value <= 20 ? 40 : 44;
  return value <= 3 ? 28 : value <= 10 ? 32 : 36;
}

function createWeightItem(value: number, id?: string): WeightItem {
  const sizes = value <= 3 ? "sm" : value <= 10 ? "md" : "lg";
  const palettes: Record<string, { bg: string; border: string }> = {
    sm: { bg: "bg-slate-600", border: "border-slate-400" },
    md: { bg: "bg-blue-600", border: "border-blue-400" },
    lg: { bg: "bg-indigo-600", border: "border-indigo-400" },
  };
  const p = palettes[sizes] || palettes.md;
  return {
    id: id ?? `w-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
    value,
    visual: { bgClass: p.bg, borderClass: p.border, size: sizes },
    position: { x: 0, y: 0 },
  };
}

function createNPCWeightItem(value: number): WeightItem {
  const size = value <= 20 ? "md" : "lg";
  return {
    id: `npc-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
    value,
    visual: {
      bgClass: "bg-gradient-to-br from-amber-600 to-orange-700",
      borderClass: "border-amber-400",
      size,
    },
    position: { x: 0, y: 0 },
  };
}

function getBlockSize(size: "sm" | "md" | "lg") {
  return size === "sm" ? "w-10 h-7" : size === "md" ? "w-12 h-8" : "w-14 h-9";
}

function PlacedWeightBlock({ w }: { w: PlacedWeight }) {
  const size: "sm" | "md" | "lg" =
    w.side === "left" ? (w.value <= 20 ? "md" : "lg") : w.value <= 3 ? "sm" : w.value <= 10 ? "md" : "lg";
  const blockSize =
    w.side === "left"
      ? size === "sm"
        ? "w-12 h-9"
        : size === "md"
          ? "w-14 h-10"
          : "w-16 h-11"
      : getBlockSize(size);
  const bgClass =
    w.side === "left"
      ? "bg-gradient-to-br from-amber-600 to-orange-700"
      : size === "sm"
        ? "bg-slate-600"
        : size === "md"
          ? "bg-blue-600"
          : "bg-indigo-600";
  const borderClass =
    w.side === "left" ? "border-amber-400" : size === "sm" ? "border-slate-400" : size === "md" ? "border-blue-400" : "border-indigo-400";
  return (
    <motion.div
      layout
      initial={{ scale: 0.8, opacity: 0 }}
      animate={{ scale: 1, opacity: 1 }}
      className={`flex items-center justify-center rounded-lg border-2 font-bold text-white text-sm shrink-0 ${blockSize} ${bgClass} ${borderClass}`}
      style={{
        boxShadow: "0 2px 8px rgba(0,0,0,0.3)",
        position: "absolute",
        left: "50%",
        transform: "translateX(-50%)",
        top: `${w.y}px`,
      }}
    >
      {w.value}
    </motion.div>
  );
}

function getRotation(balance: number, collapsed: boolean): number {
  if (collapsed) return balance > 0 ? -90 : 90;
  const clamped = Math.max(-BALANCE_LIMIT, Math.min(BALANCE_LIMIT, balance));
  return -clamped * 0.25;
}

function generateRoundInventory(): WeightItem[] {
  const pool = [...WEIGHT_VALUES, ...WEIGHT_VALUES].sort(() => Math.random() - 0.5);
  return pool.slice(0, INVENTORY_COUNT).map((v) => createWeightItem(v));
}

function isPointInRect(px: number, py: number, rect: DOMRect): boolean {
  return px >= rect.left && px <= rect.right && py >= rect.top && py <= rect.bottom;
}

function WeightBlockStatic({ item }: { item: WeightItem }) {
  return (
    <motion.div
      layout
      initial={{ scale: 0.8, opacity: 0 }}
      animate={{ scale: 1, opacity: 1 }}
      className={`flex items-center justify-center rounded-lg border-2 font-bold text-white text-sm shrink-0 ${getBlockSize(
        item.visual.size
      )} ${item.visual.bgClass} ${item.visual.borderClass}`}
      style={{ boxShadow: "0 2px 8px rgba(0,0,0,0.3)" }}
    >
      {item.value}
    </motion.div>
  );
}

function NPCDropBlock({ item }: { item: WeightItem }) {
  const blockSize = item.visual.size === "sm" ? "w-12 h-9" : item.visual.size === "md" ? "w-14 h-10" : "w-16 h-11";
  return (
    <motion.div
      initial={{ y: -100, opacity: 0, scale: 0.3 }}
      animate={{
        y: 0,
        opacity: 1,
        scale: 1,
        transition: {
          type: "spring",
          stiffness: 180,
          damping: 15,
        },
      }}
      className={`flex items-center justify-center rounded-xl border-2 font-bold text-amber-100 text-lg shrink-0 ${blockSize} ${item.visual.bgClass} ${item.visual.borderClass}`}
      style={{
        boxShadow:
          "0 6px 16px rgba(0,0,0,0.5), inset 0 2px 0 rgba(255,255,255,0.3), inset 0 -2px 0 rgba(0,0,0,0.3)",
      }}
    >
      <span className="drop-shadow-sm">{item.value}</span>
    </motion.div>
  );
}

type FlyingItem = {
  item: WeightItem;
  p0: { x: number; y: number };
  p1: { x: number; y: number };
  p2: { x: number; y: number };
  duration: number;
  startTime: number;
  vx?: number;
  vy?: number;
  launchSource?: "double-click" | "flick";
};

type FallingItem = { item: WeightItem; startX: number; startY: number };

function FlyingWeightBlock({ fly, onLanding }: { fly: FlyingItem; onLanding: (item: WeightItem) => void }) {
  const [pos, setPos] = useState(fly.p0);
  const rafRef = useRef<number | null>(null);

  useEffect(() => {
    const { item, p0, p1, p2, duration, startTime } = fly;
    const durationMs = duration * 1000;
    const tick = () => {
      const elapsed = performance.now() - startTime;
      const t = Math.min(1, elapsed / durationMs);
      setPos(bezier2(t, p0, p1, p2));
      if (t >= 1) {
        rafRef.current = null;
        onLanding(item);
        return;
      }
      rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, [fly, onLanding]);

  return (
    <motion.div
      className={`flex items-center justify-center rounded-lg border-2 font-bold text-white text-sm shrink-0 pointer-events-none ${getBlockSize(
        fly.item.visual.size
      )} ${fly.item.visual.bgClass} ${fly.item.visual.borderClass}`}
      style={{
        position: "fixed",
        left: pos.x,
        top: pos.y,
        transform: "translate(-50%, -50%)",
        boxShadow: "0 4px 16px rgba(0,0,0,0.4)",
        zIndex: 100,
      }}
    >
      {fly.item.id === "debug-item" ? "DEBUG" : fly.item.value}
    </motion.div>
  );
}

function FallingWeightBlock({ fall, onComplete }: { fall: FallingItem; onComplete: () => void }) {
  return (
    <motion.div
      className={`flex items-center justify-center rounded-lg border-2 font-bold text-white text-sm shrink-0 pointer-events-none ${getBlockSize(
        fall.item.visual.size
      )} ${fall.item.visual.bgClass} ${fall.item.visual.borderClass}`}
      style={{
        position: "fixed",
        left: fall.startX,
        top: fall.startY,
        transform: "translate(-50%, -50%)",
        boxShadow: "0 2px 8px rgba(0,0,0,0.3)",
        zIndex: 100,
      }}
      initial={{ y: 0, opacity: 1 }}
      animate={{ y: "100vh", opacity: 0 }}
      transition={{ duration: FALL_DURATION, ease: "easeIn" }}
      onAnimationComplete={onComplete}
    >
      {fall.item.value}
    </motion.div>
  );
}

type DraggableWeightBlockProps = {
  item: WeightItem;
  onLaunch: (item: WeightItem, flyData: Omit<FlyingItem, "item">) => void;
  onDragCancel: (item: WeightItem) => void;
  dropZoneRef: React.RefObject<HTMLDivElement | null>;
  rightPanConnectionRef: React.RefObject<HTMLDivElement | null>;
  inventoryContainerRef: React.RefObject<HTMLDivElement | null>;
  dragConstraintRef: React.RefObject<HTMLDivElement | null>;
  p1OffsetY: number;
  velocityMultiplier: number;
};

function isOutsideRect(px: number, py: number, rect: DOMRect): boolean {
  return px < rect.left || px > rect.right || py < rect.top || py > rect.bottom;
}

/** オブジェクトの中心が在庫枠の上端を超えた時 true（上方向へのドラッグでベジエ発射） */
function isObjectExitedFromTop(objectRect: DOMRect, frameRect: DOMRect): boolean {
  const centerY = objectRect.top + objectRect.height / 2;
  return objectRect.top < frameRect.top;// テスト用：中心ではなく上端で判定
}

function getP2(
  rightPanConnectionRef: React.RefObject<HTMLDivElement | null>,
  dropZoneRef: React.RefObject<HTMLDivElement | null>
) {
  if (rightPanConnectionRef?.current) {
    const r = rightPanConnectionRef.current.getBoundingClientRect();
    return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
  }
  if (dropZoneRef?.current) {
    const r = dropZoneRef.current.getBoundingClientRect();
    const fixedY = typeof window !== "undefined" ? window.innerHeight * FIXED_P2_Y_RATIO : r.top + r.height / 2;
    return { x: r.left + r.width / 2, y: fixedY };
  }
  return null;
}

function getLeftP2(leftPanConnectionRef: React.RefObject<HTMLDivElement | null>) {
  if (leftPanConnectionRef?.current) {
    const r = leftPanConnectionRef.current.getBoundingClientRect();
    return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
  }
  return null;
}

function DraggableWeightBlock({ item, onLaunch, onDragCancel, dropZoneRef, rightPanConnectionRef, inventoryContainerRef, dragConstraintRef, p1OffsetY, velocityMultiplier }: DraggableWeightBlockProps) {
  const hasLaunchedRef = useRef(false);
  const blockRef = useRef<HTMLDivElement>(null);
  const dragStartP0Ref = useRef<{ x: number; y: number } | null>(null);

  const tryLaunch = useCallback(
    (p0: { x: number; y: number }, rawVx: number, rawVy: number, launchSource: "double-click" | "flick") => {
      const p2 = getP2(rightPanConnectionRef, dropZoneRef);
      if (hasLaunchedRef.current || !p2) return;
      hasLaunchedRef.current = true;
      const vx = rawVx * velocityMultiplier;
      const vy = rawVy * velocityMultiplier;
      const p1 = {
        x: (p0.x + p2.x) / 2,
        y: p0.y + p1OffsetY,
      };
      const duration = Math.max(DURATION_MIN, Math.min(DURATION_MAX, 800 / Math.max(Math.abs(vx), 50)));
      onLaunch(item, { p0, p1, p2, duration, startTime: performance.now(), vx, vy, launchSource });
    },
    [item, dropZoneRef, rightPanConnectionRef, onLaunch, p1OffsetY, velocityMultiplier]
  );

  const handleDoubleClick = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault();
      if (hasLaunchedRef.current) return;
      const el = blockRef.current || (e.currentTarget as HTMLDivElement);
      const rect = el.getBoundingClientRect();
      const p0 = { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 };
      tryLaunch(p0, DEFAULT_DOUBLE_CLICK_VX, DEFAULT_DOUBLE_CLICK_VY, "double-click");
    },
    [tryLaunch]
  );

  return (
    <motion.div
      ref={blockRef}
      drag
      dragConstraints={dragConstraintRef}
      dragElastic={0}
      dragMomentum={false}
      onDragStart={() => {
        if (blockRef.current) {
          const r = blockRef.current.getBoundingClientRect();
          dragStartP0Ref.current = { x: r.left + r.width / 2, y: r.top + r.height / 2 };
        }
      }}
      onDrag={(_, info) => {
        if (hasLaunchedRef.current) return;
        if (!blockRef.current || !inventoryContainerRef.current || !getP2(rightPanConnectionRef, dropZoneRef)) return;
        const objectRect = blockRef.current.getBoundingClientRect();
        const frameRect = inventoryContainerRef.current.getBoundingClientRect();
        if (isObjectExitedFromTop(objectRect, frameRect)) {
          const p0 = { x: objectRect.left + objectRect.width / 2, y: objectRect.top + objectRect.height / 2 };
          const vx = info.velocity?.x ?? 300;
          const vy = info.velocity?.y ?? 0;
          tryLaunch(p0, vx, vy, "flick");
        }
      }}
      onDoubleClick={handleDoubleClick}
      onDragEnd={(_, info) => {
        if (hasLaunchedRef.current) return;
        if (!inventoryContainerRef.current) return;
        const rect = inventoryContainerRef.current.getBoundingClientRect();
        const { x, y } = info.point;
        if (!isOutsideRect(x, y, rect)) {
          dragStartP0Ref.current = null;
          onDragCancel(item);
        }
      }}
      className={`flex items-center justify-center rounded-lg border-2 font-bold text-white text-sm select-none cursor-grab active:cursor-grabbing shrink-0 ${getBlockSize(
        item.visual.size
      )} ${item.visual.bgClass} ${item.visual.borderClass}`}
      style={{
        boxShadow: "0 2px 8px rgba(0,0,0,0.3)",
        touchAction: "none",
        pointerEvents: "auto",
        zIndex: 10,
      }}
      whileDrag={{
        scale: 1.15,
        opacity: 0.9,
        zIndex: 50,
        boxShadow: "0 8px 24px rgba(0,0,0,0.5)",
      }}
    >
      {item.value}
    </motion.div>
  );
}

type DebugThrowBlockProps = {
  item: WeightItem;
  onDebugLaunch: (item: WeightItem, flyData: Omit<FlyingItem, "item">) => void;
  dropZoneRef: React.RefObject<HTMLDivElement | null>;
  rightPanConnectionRef: React.RefObject<HTMLDivElement | null>;
  inventoryContainerRef: React.RefObject<HTMLDivElement | null>;
  dragConstraintRef: React.RefObject<HTMLDivElement | null>;
  p1OffsetY: number;
  velocityMultiplier: number;
};

function DebugThrowBlock({
  item,
  onDebugLaunch,
  dropZoneRef,
  rightPanConnectionRef,
  inventoryContainerRef,
  dragConstraintRef,
  p1OffsetY,
  velocityMultiplier,
}: DebugThrowBlockProps) {
  const hasLaunchedRef = useRef(false);
  const blockRef = useRef<HTMLDivElement>(null);
  const dragStartP0Ref = useRef<{ x: number; y: number } | null>(null);

  const tryLaunch = useCallback(
    (p0: { x: number; y: number }, rawVx: number, rawVy: number, launchSource: "double-click" | "flick") => {
      const p2 = getP2(rightPanConnectionRef, dropZoneRef);
      if (hasLaunchedRef.current || !p2) return;
      hasLaunchedRef.current = true;
      const vx = rawVx * velocityMultiplier;
      const vy = rawVy * velocityMultiplier;
      const p1 = {
        x: (p0.x + p2.x) / 2,
        y: p0.y + p1OffsetY,
      };
      const duration = Math.max(DURATION_MIN, Math.min(DURATION_MAX, 800 / Math.max(Math.abs(vx), 50)));
      onDebugLaunch(item, { p0, p1, p2, duration, startTime: performance.now(), vx, vy, launchSource });
    },
    [item, dropZoneRef, rightPanConnectionRef, onDebugLaunch, p1OffsetY, velocityMultiplier]
  );

  const handleDoubleClick = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault();
      if (hasLaunchedRef.current) return;
      const el = blockRef.current || (e.currentTarget as HTMLDivElement);
      const rect = el.getBoundingClientRect();
      const p0 = { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 };
      tryLaunch(p0, DEFAULT_DOUBLE_CLICK_VX, DEFAULT_DOUBLE_CLICK_VY, "double-click");
    },
    [tryLaunch]
  );

  return (
    <motion.div
      drag
      dragConstraints={dragConstraintRef}
      dragElastic={0}
      dragMomentum={false}
      onDragStart={() => {
        if (blockRef.current) {
          const r = blockRef.current.getBoundingClientRect();
          dragStartP0Ref.current = { x: r.left + r.width / 2, y: r.top + r.height / 2 };
        }
      }}
      onDrag={(_, info) => {
        if (hasLaunchedRef.current) return;
        if (!blockRef.current || !inventoryContainerRef.current || !getP2(rightPanConnectionRef, dropZoneRef)) return;
        const objectRect = blockRef.current.getBoundingClientRect();
        const frameRect = inventoryContainerRef.current.getBoundingClientRect();
        if (isObjectExitedFromTop(objectRect, frameRect)) {
          const p0 = { x: objectRect.left + objectRect.width / 2, y: objectRect.top + objectRect.height / 2 };
          const vx = info.velocity?.x ?? 300;
          const vy = info.velocity?.y ?? 0;
          tryLaunch(p0, vx, vy, "flick");
        }
      }}
      onDoubleClick={handleDoubleClick}
      onDragEnd={(_, info) => {
        if (hasLaunchedRef.current) return;
        if (!inventoryContainerRef.current) return;
        const rect = inventoryContainerRef.current.getBoundingClientRect();
        const { x, y } = info.point;
        if (!isOutsideRect(x, y, rect)) {
          dragStartP0Ref.current = null;
          hasLaunchedRef.current = false;
        }
      }}
      ref={blockRef}
      className={`flex items-center justify-center rounded-lg border-2 font-bold text-white text-sm select-none cursor-grab active:cursor-grabbing shrink-0 ${getBlockSize(
        item.visual.size
      )} ${item.visual.bgClass} ${item.visual.borderClass}`}
      style={{
        boxShadow: "0 2px 8px rgba(0,0,0,0.3)",
        touchAction: "none",
        pointerEvents: "auto",
        zIndex: 10,
      }}
      whileDrag={{
        scale: 1.15,
        opacity: 0.9,
        zIndex: 50,
        boxShadow: "0 8px 24px rgba(0,0,0,0.5)",
      }}
    >
      DEBUG
    </motion.div>
  );
}

export default function PresSureJudgeGame() {
  const [phase, setPhase] = useState<Phase>("ready");
  const [totalBalance, setTotalBalance] = useState(0);
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [leftPanWeights, setLeftPanWeights] = useState<WeightItem[]>([]);
  const [rightPanWeights, setRightPanWeights] = useState<WeightItem[]>([]);
  const [inventorySlots, setInventorySlots] = useState<(WeightItem | null)[]>(
    () => Array.from<WeightItem | null>({ length: INVENTORY_COUNT }).fill(null)
  );
  const [flyingItems, setFlyingItems] = useState<FlyingItem[]>([]);
  const [fallingItems, setFallingItems] = useState<FallingItem[]>([]);
  const [placedWeights, setPlacedWeights] = useState<PlacedWeight[]>([]);
  const [round, setRound] = useState(0);
  const [timer, setTimer] = useState(INITIAL_TIMER);
  const [collapseAnimDone, setCollapseAnimDone] = useState(false);
  const searchParams = useSearchParams();
  const [isDebugMode, setIsDebugMode] = useState(false);

  useEffect(() => {
    if (searchParams.get("devtj") === "true") {
      setIsDebugMode(true);
    }
  }, [searchParams]);

  useEffect(() => {
    if (!isDebugMode) {
      setDebugFlyingItem(null);
      setDebugOverlay(null);
    }
  }, [isDebugMode]);
  const [debugOverlay, setDebugOverlay] = useState<{
    p0: { x: number; y: number };
    p1: { x: number; y: number };
    p2: { x: number; y: number };
    vx: number;
    vy: number;
    p1OffsetY: number;
    launchSource?: "double-click" | "flick";
  } | null>(null);
  const [debugFlyingItem, setDebugFlyingItem] = useState<FlyingItem | null>(null);
  const [p1OffsetY, setP1OffsetY] = useState(DEFAULT_P1_OFFSET_Y);
  const [velocityMultiplier, setVelocityMultiplier] = useState(2.25);
  const [showConnectionPoints, setShowConnectionPoints] = useState(false);

  // 天秤位置デバッグ用（反映済み）
  const [layoutParams, setLayoutParams] = useState<LayoutParams>(DEBUG_LAYOUT_DEFAULTS);
  // 天秤位置デバッグ用（入力中・未反映）
  const [layoutParamsDraft, setLayoutParamsDraft] = useState<LayoutParams>(DEBUG_LAYOUT_DEFAULTS);
  const [npcItemAppearDelayMs, setNpcItemAppearDelayMs] = useState(NPC_ITEM_APPEAR_DELAY_MS);
  const [npcItemFlyDelayMs, setNpcItemFlyDelayMs] = useState(NPC_ITEM_FLY_DELAY_MS);
  const [transitionNpcItem, setTransitionNpcItem] = useState<WeightItem | null>(null);
  const [transitionNpcItemVisible, setTransitionNpcItemVisible] = useState(false);
  const [npcFlyingToLeft, setNpcFlyingToLeft] = useState<FlyingItem | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const scaleContainerRef = useRef<HTMLDivElement>(null);
  const [scaleContainerWidth, setScaleContainerWidth] = useState(512);
  const rightPanRef = useRef<HTMLDivElement>(null);
  const rightPanConnectionRef = useRef<HTMLDivElement>(null);
  const leftPanConnectionRef = useRef<HTMLDivElement>(null);
  const inventoryContainerRef = useRef<HTMLDivElement>(null);
  const dragConstraintRef = useRef<HTMLDivElement>(null);
  const [dragResetKey, setDragResetKey] = useState(0);
  const sinkTargetRef = useRef<{ itemId: string; targetY: number } | null>(null);

  useEffect(() => {
    const el = scaleContainerRef.current;
    if (!el) return;
    const ro = new ResizeObserver((entries) => {
      for (const e of entries) {
        const w = e.contentRect.width;
        if (w > 0) setScaleContainerWidth(w);
      }
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  useEffect(() => {
    const pending = sinkTargetRef.current;
    if (!pending) return;
    const id = requestAnimationFrame(() => {
      sinkTargetRef.current = null;
      setRightPanWeights((pan) =>
        pan.map((w) =>
          w.id === pending.itemId
            ? { ...w, position: { ...w.position, y: pending.targetY } }
            : w
        )
      );
    });
    return () => cancelAnimationFrame(id);
  }, [rightPanWeights]);

  const totalBalanceRef = useRef(totalBalance);
  const placedWeightsRef = useRef(placedWeights);
  const rightPanWeightsRef = useRef(rightPanWeights);
  const leftPanWeightsRef = useRef(leftPanWeights);
  const roundRef = useRef(round);
  const inventorySlotsRef = useRef(inventorySlots);

  totalBalanceRef.current = totalBalance;
  placedWeightsRef.current = placedWeights;
  rightPanWeightsRef.current = rightPanWeights;
  leftPanWeightsRef.current = leftPanWeights;
  roundRef.current = round;
  inventorySlotsRef.current = inventorySlots;

  const currentUserWeight = rightPanWeights.reduce((s, w) => s + w.value, 0);
  const currentNPCWeight = leftPanWeights.reduce((s, w) => s + w.value, 0);
  const effectiveBalance = phase === "user" ? totalBalance - currentUserWeight : totalBalance;
  const isCollapsed = phase === "gameover" && collapseAnimDone;
  const leftTotal = history.reduce((s, e) => s + e.left, 0) + currentNPCWeight;
  const rightTotal = history.reduce((s, e) => s + e.right, 0) + currentUserWeight;

  const startGame = useCallback(() => {
    setPhase("npc");
    setTotalBalance(0);
    setHistory([]);
    setPlacedWeights([]);
    setLeftPanWeights([]);
    setRightPanWeights([]);
    setInventorySlots(Array.from<WeightItem | null>({ length: INVENTORY_COUNT }).fill(null));
    setRound(0);
    setTimer(INITIAL_TIMER);
    setCollapseAnimDone(false);
  }, []);

  const runNPCTurn = useCallback(() => {
    const value = Math.floor(Math.random() * (NPC_WEIGHT_MAX - NPC_WEIGHT_MIN + 1)) + NPC_WEIGHT_MIN;
    const npcItem = createNPCWeightItem(value);
    setLeftPanWeights([npcItem]);
    setRightPanWeights([]);
    setTotalBalance((b) => b + value);
    setRound((r) => r + 1);
    setInventorySlots(generateRoundInventory());
    setPhase("user");
    setTimer(INITIAL_TIMER);
  }, []);

  const performResolution = useCallback(() => {
    const balance = totalBalanceRef.current;
    const rightItems = rightPanWeightsRef.current;
    const leftItems = leftPanWeightsRef.current;
    const userW = rightItems.reduce((s, w) => s + w.value, 0);
    const npcW = leftItems.reduce((s, w) => s + w.value, 0);
    const r = roundRef.current;

    const newBalance = balance - userW;
    setTotalBalance(newBalance);

    setHistory((h) => [...h, { round: r, left: npcW, right: userW, diff: npcW - userW }]);

    setPlacedWeights((prev) => {
      const leftPlaced = prev.filter((w) => w.side === "left");
      const rightPlaced = prev.filter((w) => w.side === "right");
      const leftNewTotalHeight = leftItems.reduce((s, w) => s + getWeightHeight(w.value, "left"), 0);
      const rightNewTotalHeight = rightItems.reduce((s, w) => s + getWeightHeight(w.value, "right"), 0);
      // 既存あり: 頂上(min y)の上に積む（0クランプしない・applySinkIfNeededが伸びを維持）。既存なし: 器の底から
      const leftBottomOffset =
        leftPlaced.length > 0
          ? Math.min(...leftPlaced.map((w) => w.y)) - leftNewTotalHeight
          : Math.max(0, PAN_MAX_VISIBLE_HEIGHT - leftNewTotalHeight);
      const rightBottomOffset =
        rightPlaced.length > 0
          ? Math.min(...rightPlaced.map((w) => w.y)) - rightNewTotalHeight
          : Math.max(0, PAN_MAX_VISIBLE_HEIGHT - rightNewTotalHeight);

      let curLeftBottom = leftBottomOffset;
      let curRightBottom = rightBottomOffset;
      const newPlaced: PlacedWeight[] = [];

      // leftPanWeights/rightPanWeights は [底, …, 上] の順。底に大きいyを割り当てるため逆順で処理
      for (const w of [...leftItems].reverse()) {
        const h = getWeightHeight(w.value, "left");
        newPlaced.push({ id: w.id, side: "left", value: w.value, x: 0, y: curLeftBottom });
        curLeftBottom += h;
      }
      for (const w of [...rightItems].reverse()) {
        const h = getWeightHeight(w.value, "right");
        newPlaced.push({ id: w.id, side: "right", value: w.value, x: 0, y: curRightBottom });
        curRightBottom += h;
      }
      return [...prev, ...newPlaced];
    });

    if (Math.abs(newBalance) > BALANCE_LIMIT) {
      setPhase("gameover");
      return;
    }
    setLeftPanWeights([]);
    setRightPanWeights([]);
    setFlyingItems([]);
    const npcValue = Math.floor(Math.random() * (NPC_WEIGHT_MAX - NPC_WEIGHT_MIN + 1)) + NPC_WEIGHT_MIN;
    const npcItem = createNPCWeightItem(npcValue);
    setTransitionNpcItem(npcItem);
    setInventorySlots(Array.from<WeightItem | null>({ length: INVENTORY_COUNT }).fill(null));
    setPhase("transition");
  }, []);

  const handleLaunch = useCallback(
    (item: WeightItem, flyData: Omit<FlyingItem, "item">) => {
      setInventorySlots((slots) =>
        slots.map((s) => (s?.id === item.id ? null : s))
      );
      setFlyingItems((prev) => [...prev, { item, ...flyData }]);
      if (isDebugMode && flyData.vx != null && flyData.vy != null) {
        setDebugOverlay({
          p0: flyData.p0,
          p1: flyData.p1,
          p2: flyData.p2,
          vx: flyData.vx,
          vy: flyData.vy,
          p1OffsetY,
          launchSource: flyData.launchSource,
        });
        if (!isDebugMode) setTimeout(() => setDebugOverlay(null), DEBUG_OVERLAY_DURATION_MS);
      }
    },
    [isDebugMode, p1OffsetY]
  );

  const handleDragCancel = useCallback((item: WeightItem) => {
    setDragResetKey((k) => k + 1);
  }, []);

  const handleLanding = useCallback(
    (item: WeightItem) => {
      if (!isDebugMode) setDebugOverlay(null);
      setFlyingItems((prev) => prev.filter((f) => f.item.id !== item.id));
      const newHeight = getWeightHeight(item.value, "right");
      setRightPanWeights((pan) => {
        const rightPlaced = placedWeightsRef.current.filter((w) => w.side === "right");
        if (pan.length === 0) {
          // 1個目：既存あれば頂上(min y)の上に、なければ器の底に
          const baseY =
            rightPlaced.length > 0
              ? Math.max(0, Math.min(...rightPlaced.map((w) => w.y)) - newHeight)
              : Math.max(0, PAN_MAX_VISIBLE_HEIGHT - newHeight);
          return [{ ...item, position: { x: 0, y: baseY } }];
        }
        // 2個目以降：既存の上に積む（シフトなしで全員が沈み込まないよう上に配置）
        const rightContentTop = Math.min(...pan.map((w) => w.position.y));
        const newY = rightContentTop - newHeight;
        sinkTargetRef.current = { itemId: item.id, targetY: newY };
        return [...pan, { ...item, position: { x: 0, y: newY } }];
      });
    },
    [isDebugMode]
  );

  const handleFallComplete = useCallback((item: WeightItem) => {
    setFallingItems((prev) => prev.filter((f) => f.item.id !== item.id));
  }, []);

  const handleDebugLaunch = useCallback(
    (item: WeightItem, flyData: Omit<FlyingItem, "item">) => {
      setDebugFlyingItem({ item, ...flyData });
      if (isDebugMode && flyData.vx != null && flyData.vy != null) {
        setDebugOverlay({
          p0: flyData.p0,
          p1: flyData.p1,
          p2: flyData.p2,
          vx: flyData.vx,
          vy: flyData.vy,
          p1OffsetY,
          launchSource: flyData.launchSource,
        });
        if (!isDebugMode) setTimeout(() => setDebugOverlay(null), DEBUG_OVERLAY_DURATION_MS);
      }
    },
    [isDebugMode, p1OffsetY]
  );

  const handleDebugLanding = useCallback(() => {
    setDebugFlyingItem(null);
    if (!isDebugMode) setDebugOverlay(null);
  }, [isDebugMode]);

  useEffect(() => {
    if (phase !== "npc") return;
    const delay = round === 0 ? 300 : 600;
    const id = setTimeout(runNPCTurn, delay);
    return () => clearTimeout(id);
  }, [phase, round, runNPCTurn]);

  const completeTransition = useCallback(() => {
    setTransitionNpcItem(null);
    setInventorySlots(generateRoundInventory());
    setRound((r) => r + 1);
    setPhase("user");
    setTimer(INITIAL_TIMER);
  }, []);

  const handleNPCLanding = useCallback(
    (item: WeightItem) => {
      setNpcFlyingToLeft(null);
      setTotalBalance((b) => b + item.value);
      const newHeight = getWeightHeight(item.value, "left");
      setLeftPanWeights((pan) => {
        const leftPlaced = placedWeightsRef.current.filter((w) => w.side === "left");
        let baseY: number;
        if (leftPlaced.length > 0) {
          baseY = Math.min(...leftPlaced.map((w) => w.y)) - newHeight;
        } else if (pan.length > 0) {
          baseY = Math.min(...pan.map((w) => w.position.y)) - newHeight;
        } else {
          baseY = Math.max(0, PAN_MAX_VISIBLE_HEIGHT - newHeight);
        }
        return [...pan, { ...item, position: { x: 0, y: baseY } }];
      });
      setTimeout(completeTransition, NPC_LEFT_SINK_WAIT_MS);
    },
    [completeTransition]
  );

  useEffect(() => {
    if (phase !== "transition" || !transitionNpcItem) return;
    setTransitionNpcItemVisible(false);
    const appearTimer = setTimeout(() => {
      setTransitionNpcItemVisible(true);
    }, npcItemAppearDelayMs);
    const flyTimer = setTimeout(() => {
      const p2 = getLeftP2(leftPanConnectionRef);
      const inventoryRect = inventoryContainerRef.current?.getBoundingClientRect();
      if (p2 && inventoryRect) {
        setTransitionNpcItemVisible(false);
        const p0 = {
          x: inventoryRect.left + inventoryRect.width / 2,
          y: inventoryRect.top + inventoryRect.height / 2,
        };
        const p1 = {
          x: (p0.x + p2.x) / 2,
          y: p0.y + p1OffsetY, // 左右でYを揃える（右器投げと同様）
        };
        const duration = Math.max(DURATION_MIN, Math.min(DURATION_MAX, 800 / Math.max(Math.abs(DEFAULT_DOUBLE_CLICK_VX), 50)));
        setNpcFlyingToLeft({
          item: transitionNpcItem,
          p0,
          p1,
          p2,
          duration,
          startTime: performance.now(),
          vx: DEFAULT_DOUBLE_CLICK_VX,
          vy: DEFAULT_DOUBLE_CLICK_VY,
          launchSource: "double-click",
        });
      }
    }, npcItemAppearDelayMs + npcItemFlyDelayMs);
    return () => {
      clearTimeout(appearTimer);
      clearTimeout(flyTimer);
    };
  }, [phase, transitionNpcItem, npcItemAppearDelayMs, npcItemFlyDelayMs, p1OffsetY]);

  useEffect(() => {
    if (phase !== "user") return;
    if (isDebugMode) return; // Freeze timer in debug mode
    timerRef.current = setInterval(() => {
      setTimer((t) => {
        if (t <= 1) {
          if (timerRef.current) {
            clearInterval(timerRef.current);
            timerRef.current = null;
          }
          performResolution();
          return 0;
        }
        return t - 1;
      });
    }, 1000);
    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
    };
  }, [phase, performResolution, isDebugMode]);

  const handleJudge = () => {
    if (phase !== "user") return;
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
    performResolution();
  };

  const showResult = () => setPhase("result");

  useEffect(() => {
    if (phase === "gameover") {
      const id = setTimeout(() => setCollapseAnimDone(true), 1200);
      return () => clearTimeout(id);
    }
  }, [phase]);

  useEffect(() => {
    if (phase !== "result" || !scrollContainerRef.current || history.length === 0) return;
    const el = scrollContainerRef.current;
    const duration = 2500;
    const start = Date.now();
    const maxScroll = el.scrollHeight - el.clientHeight;
    if (maxScroll <= 0) return;
    const tick = () => {
      const elapsed = Date.now() - start;
      const progress = Math.min(elapsed / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 2);
      el.scrollTop = maxScroll * eased;
      if (progress < 1) requestAnimationFrame(tick);
    };
    const id = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(id);
  }, [phase, history.length]);

  const rotation = getRotation(effectiveBalance, isCollapsed);

  // アーム先端座標（皿を鉛直に保つため回転に追従して配置）
  const armHalf = scaleContainerWidth * 0.425;
  const rotRad = (rotation * Math.PI) / 180;
  const leftEndX = scaleContainerWidth / 2 - armHalf * Math.cos(rotRad);
  const leftEndY = -armHalf * Math.sin(rotRad);
  const rightEndX = scaleContainerWidth / 2 + armHalf * Math.cos(rotRad);
  const rightEndY = armHalf * Math.sin(rotRad);
  const panWidth = 128;
  const panBottomBase = 32;

  const leftPlaced = placedWeights.filter((w) => w.side === "left");
  const leftCurrentTotalHeight = leftPanWeights.reduce(
    (s, w) => s + getWeightHeight(w.value, "left"),
    0
  );
  // 既存あり: 0クランプしない（applySinkIfNeededで沈み込み）。既存なし: 器の底から
  let leftBottomOffset =
    leftPlaced.length > 0
      ? Math.min(...leftPlaced.map((w) => w.y)) - leftCurrentTotalHeight
      : Math.max(0, PAN_MAX_VISIBLE_HEIGHT - leftCurrentTotalHeight);
  // leftPanWeightsは[底,…,上]の順。底に大きいyを割り当てるため逆順で処理
  const leftCurrent: PlacedWeight[] = [...leftPanWeights].reverse().map((w) => {
    const h = getWeightHeight(w.value, "left");
    const y = leftBottomOffset;
    leftBottomOffset += h;
    return { id: w.id, side: "left" as const, value: w.value, x: 0, y };
  });
  const leftDisplayRaw = [...leftPlaced, ...leftCurrent].sort((a, b) => a.y - b.y);

  const rightPlaced = placedWeights.filter((w) => w.side === "right");
  const rightCurrent: PlacedWeight[] = rightPanWeights.map((w) => ({
    id: w.id,
    side: "right" as const,
    value: w.value,
    x: 0,
    y: w.position.y,
  }));
  const rightDisplayRaw = [...rightPlaced, ...rightCurrent].sort((a, b) => a.y - b.y);

  // 上辺を超えそう（min y < 0）なときはアイテム全体を沈み込み、器の下辺を伸ばす
  const applySinkIfNeeded = (display: PlacedWeight[]): PlacedWeight[] => {
    if (display.length === 0) return display;
    const topY = Math.min(...display.map((w) => w.y));
    if (topY >= 0) return display;
    const sinkOffset = -topY;
    return display.map((w) => ({ ...w, y: w.y + sinkOffset }));
  };
  const leftDisplay = applySinkIfNeeded(leftDisplayRaw);
  const rightDisplay = applySinkIfNeeded(rightDisplayRaw);

  // 左右の器のコンテンツ高さ（オフスクリーン判定用）
  const leftContentHeight =
    leftDisplay.length > 0
      ? Math.max(...leftDisplay.map((w) => w.y + getWeightHeight(w.value, "left")))
      : 0;
  const rightContentHeight =
    rightDisplay.length > 0
      ? Math.max(...rightDisplay.map((w) => w.y + getWeightHeight(w.value, "right")))
      : 0;
  const stackDiff = Math.max(leftContentHeight, rightContentHeight);

  // オフスクリーン判定（差が閾値超で片方が見えにくい）
  const showOffscreenIndicators = stackDiff > OFFSCREEN_INDICATOR_THRESHOLD;
  const leftIsHigher = leftContentHeight > rightContentHeight;

  return (
    <div className="min-h-screen flex flex-col bg-gradient-to-br from-[#0a0e18] to-[#0f172a] text-wit-text isolate">
      {isDebugMode && (
        <div className="fixed right-4 top-4 z-50 max-h-[90vh] overflow-y-auto rounded-lg border border-white/20 bg-black/80 p-3 text-xs font-mono">
          <div className="mb-2 flex items-center justify-between gap-2">
            <span className="font-bold text-emerald-400">天秤位置パラメータ</span>
            <button
              onClick={() => setIsDebugMode(false)}
              className="shrink-0 px-2 py-1 rounded border border-white/20"
              style={{ background: "#10b981" }}
            >
              DEBUG ON
            </button>
          </div>
          <div className="space-y-1.5">
            <label className="flex items-center justify-between gap-2">
              <span className="text-amber-300/90">scaleWrapperTopOffset:</span>
              <input
                type="number"
                value={layoutParamsDraft.scaleWrapperTopOffset}
                onChange={(e) =>
                  setLayoutParamsDraft((p) => ({ ...p, scaleWrapperTopOffset: Number(e.target.value) || 0 }))
                }
                className="w-14 px-1.5 py-0.5 rounded bg-black/60 border border-white/20 text-amber-300"
              />
              <span className="text-white/50">({DEBUG_LAYOUT_DEFAULTS.scaleWrapperTopOffset})</span>
            </label>
            <label className="flex items-center justify-between gap-2">
              <span className="text-amber-300/90">scaleWrapperMaxOffset:</span>
              <input
                type="number"
                value={layoutParamsDraft.scaleWrapperMaxOffset}
                onChange={(e) =>
                  setLayoutParamsDraft((p) => ({ ...p, scaleWrapperMaxOffset: Number(e.target.value) || 0 }))
                }
                className="w-14 px-1.5 py-0.5 rounded bg-black/60 border border-white/20 text-amber-300"
              />
              <span className="text-white/50">({DEBUG_LAYOUT_DEFAULTS.scaleWrapperMaxOffset})</span>
            </label>
          </div>
          <button
            onClick={() => setLayoutParams(layoutParamsDraft)}
            className="mt-2 w-full rounded border border-amber-500/50 bg-amber-500/20 py-1.5 text-amber-400 hover:bg-amber-500/30"
          >
            値を反映
          </button>
          <div className="mt-2 border-t border-white/10 pt-2">
            <label className="flex items-center gap-2">
              <span className="text-emerald-400">P1 offset Y:</span>
              <input
                type="number"
                value={p1OffsetY}
                onChange={(e) => setP1OffsetY(Number(e.target.value) || DEFAULT_P1_OFFSET_Y)}
                className="w-16 px-2 py-1 rounded bg-black/60 border border-white/20 text-emerald-300"
              />
            </label>
            <label className="mt-1 flex items-center gap-2">
              <input
                type="checkbox"
                checked={showConnectionPoints}
                onChange={(e) => setShowConnectionPoints(e.target.checked)}
              />
              <span className="text-amber-400">アームと器の接続位置を●で表示</span>
            </label>
            <label className="mt-1 flex items-center gap-2">
              <span className="text-amber-400">初速倍率:</span>
              <input
                type="number"
                step="0.1"
                min="0.1"
                max="5"
                value={velocityMultiplier}
                onChange={(e) => setVelocityMultiplier(Math.max(0.1, Math.min(5, Number(e.target.value) || 1)))}
                className="w-14 px-2 py-1 rounded bg-black/60 border border-white/20 text-amber-300"
              />
            </label>
            <div className="mt-2 border-t border-white/10 pt-2">
              <span className="text-emerald-400">ラウンド切替 NPC アイテム</span>
              <label className="mt-1 flex items-center justify-between gap-2">
                <span className="text-amber-300/90">出現遅延(ms):</span>
                <input
                  type="number"
                  value={npcItemAppearDelayMs}
                  onChange={(e) => setNpcItemAppearDelayMs(Math.max(0, Number(e.target.value) || NPC_ITEM_APPEAR_DELAY_MS))}
                  className="w-14 px-2 py-1 rounded bg-black/60 border border-white/20 text-amber-300"
                />
              </label>
              <label className="mt-1 flex items-center justify-between gap-2">
                <span className="text-amber-300/90">発射遅延(ms):</span>
                <input
                  type="number"
                  value={npcItemFlyDelayMs}
                  onChange={(e) => setNpcItemFlyDelayMs(Math.max(0, Number(e.target.value) || NPC_ITEM_FLY_DELAY_MS))}
                  className="w-14 px-2 py-1 rounded bg-black/60 border border-white/20 text-amber-300"
                />
              </label>
            </div>
          </div>
        </div>
      )}
      <header className="relative z-20 shrink-0 flex justify-between items-center px-4 py-4 md:px-6 md:py-6 border-b border-white/10">
        <Link
          href="/"
          className="flex items-center gap-3 text-xl font-black tracking-wider text-wit-text no-underline hover:opacity-90"
        >
          <span className="block w-8 h-8 rounded-lg bg-gradient-to-br from-amber-500 to-orange-600 shadow-[0_0_12px_rgba(245,158,11,0.4)]" />
          Pres-Sure Judge
        </Link>
        {phase !== "ready" && phase !== "result" && (
          <span className="text-wit-muted text-sm tabular-nums font-medium">Round {round}</span>
        )}
      </header>

      <main
        className="relative z-0 flex-1 min-h-0 mx-auto w-full max-w-[640px] px-4 py-2 md:py-4 flex flex-col overflow-hidden"
        style={{
          paddingBottom: "max(5rem, env(safe-area-inset-bottom, 0px) + 4rem)",
          minHeight: `calc(100dvh - ${layoutParams.headerHeightRem}px)`,
        }}
      >
        {flyingItems.map((fly) => (
          <FlyingWeightBlock key={fly.item.id} fly={fly} onLanding={handleLanding} />
        ))}
        {fallingItems.map((fall) => (
          <FallingWeightBlock key={fall.item.id} fall={fall} onComplete={() => handleFallComplete(fall.item)} />
        ))}
        {npcFlyingToLeft && (
          <FlyingWeightBlock key={npcFlyingToLeft.item.id} fly={npcFlyingToLeft} onLanding={handleNPCLanding} />
        )}
        {isDebugMode && debugFlyingItem && (
          <FlyingWeightBlock
            key="debug-fly"
            fly={debugFlyingItem}
            onLanding={handleDebugLanding}
          />
        )}
        {isDebugMode && debugOverlay && (
          <div
            className="fixed inset-0 pointer-events-none"
            style={{ zIndex: 90 }}
          >
            <svg width="100%" height="100%" className="absolute inset-0">
              <path
                d={`M ${debugOverlay.p0.x} ${debugOverlay.p0.y} Q ${debugOverlay.p1.x} ${debugOverlay.p1.y} ${debugOverlay.p2.x} ${debugOverlay.p2.y}`}
                fill="none"
                stroke="#10b981"
                strokeWidth="2"
                strokeDasharray="4 4"
              />
              {/* Velocity arrow (P0 → P0 + normalized v) */}
              <line
                x1={debugOverlay.p0.x}
                y1={debugOverlay.p0.y}
                x2={debugOverlay.p0.x + (debugOverlay.vx / Math.max(100, Math.hypot(debugOverlay.vx, debugOverlay.vy))) * 80}
                y2={debugOverlay.p0.y + (debugOverlay.vy / Math.max(100, Math.hypot(debugOverlay.vx, debugOverlay.vy))) * 80}
                stroke="#f59e0b"
                strokeWidth="2"
                markerEnd="url(#arrowhead)"
              />
              <defs>
                <marker id="arrowhead" markerWidth="10" markerHeight="7" refX="9" refY="3.5" orient="auto">
                  <polygon points="0 0, 10 3.5, 0 7" fill="#f59e0b" />
                </marker>
              </defs>
            </svg>
            <div
              className="absolute text-xs font-mono text-emerald-400"
              style={{ left: debugOverlay.p0.x + 8, top: debugOverlay.p0.y - 4 }}
            >
              <span className="block">適用初速: vx={debugOverlay.vx.toFixed(0)} vy={debugOverlay.vy.toFixed(0)}</span>
              <span className="block text-amber-400">
                発射: {debugOverlay.launchSource === "double-click" ? "ダブルクリック" : "フリック"}
              </span>
              {debugOverlay.p1OffsetY != null && (
                <span className="block text-emerald-500/80">p1OffsetY: {debugOverlay.p1OffsetY}</span>
              )}
            </div>
            <div
              className="absolute w-3 h-3 rounded-full bg-emerald-500 border-2 border-emerald-300"
              style={{ left: debugOverlay.p0.x - 6, top: debugOverlay.p0.y - 6 }}
              title="P0"
            />
            <div
              className="absolute w-3 h-3 rounded-full bg-amber-500 border-2 border-amber-300"
              style={{ left: debugOverlay.p1.x - 6, top: debugOverlay.p1.y - 6 }}
              title="P1"
            />
            <div
              className="absolute w-3 h-3 rounded-full bg-blue-500 border-2 border-blue-300"
              style={{ left: debugOverlay.p2.x - 6, top: debugOverlay.p2.y - 6 }}
              title="P2"
            />
          </div>
        )}
        <AnimatePresence mode="wait">
          {phase === "ready" && (
            <motion.div
              key="ready"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              className="flex flex-col items-center gap-8 py-16"
            >
              <h1 className="text-2xl font-bold text-center">Pres-Sure Judge</h1>
              <p className="text-wit-muted text-sm text-center max-w-md leading-relaxed">
                在庫から重りをドラッグして天秤の皿へ。10秒以内に均衡を保て。判定ミスは累積するサバイバルゲーム。
              </p>
              <button
                onClick={startGame}
                className="px-8 py-4 rounded-xl bg-amber-500 hover:bg-amber-600 text-black font-bold transition-colors shadow-[0_0_20px_rgba(245,158,11,0.3)]"
              >
                スタート
              </button>
            </motion.div>
          )}

          {phase !== "ready" && phase !== "result" && (
            <motion.div
              key="game"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="flex flex-col min-h-0 flex-1 max-h-[85vh] md:max-h-[85vh]"
              style={{
                gap: layoutParams.gameGap,
                height: `calc(100dvh - ${layoutParams.headerHeightRem}px)`,
                touchAction: "none",
              }}
            >
              {phase === "user" && (
                <div className="shrink-0 flex justify-center">
                  <span
                    className={`font-mono font-bold tabular-nums text-2xl md:text-3xl ${
                      timer <= 3 ? "text-red-400 animate-pulse" : "text-amber-400/90"
                    }`}
                  >
                    {timer}s
                  </span>
                </div>
              )}
              <div
                className="relative flex flex-1 min-h-0 justify-center overflow-hidden shrink-0"
                style={{ minHeight: layoutParams.scaleAreaMinHeight }}
              >
                {showOffscreenIndicators && (
                  <>
                    <div
                      className={`absolute left-1/2 -translate-x-1/2 top-0 z-30 flex items-center gap-1.5 px-3 py-1.5 rounded-b-lg text-xs font-bold tabular-nums ${
                        leftIsHigher ? "bg-amber-500/90 text-amber-100" : "bg-blue-500/90 text-blue-100"
                      }`}
                    >
                      <span>↑</span>
                      <span>{leftIsHigher ? `NPC +${leftTotal}` : `You +${rightTotal}`}</span>
                    </div>
                    <div
                      className={`absolute left-1/2 -translate-x-1/2 bottom-0 z-30 flex items-center gap-1.5 px-3 py-1.5 rounded-t-lg text-xs font-bold tabular-nums ${
                        leftIsHigher ? "bg-blue-500/90 text-blue-100" : "bg-amber-500/90 text-amber-100"
                      }`}
                    >
                      <span>↓</span>
                      <span>{leftIsHigher ? `You +${rightTotal}` : `NPC +${leftTotal}`}</span>
                    </div>
                  </>
                )}
                {/* ラッパー：中央寄せを担当（Framer Motion の transform 上書きを避ける） */}
                <div
                  ref={scaleContainerRef}
                  className="absolute left-1/2 w-full max-w-xl -translate-x-1/2"
                  style={{
                    top: `clamp(0px, calc(50% - ${layoutParams.scaleWrapperTopOffset}px), calc(100% - ${layoutParams.scaleWrapperMaxOffset}px))`,
                  }}
                >
                  <motion.div
                    className="relative w-full"
                    style={{ transformOrigin: "center center" }}
                  >
                  {/* アームと支点のみ回転（天秤は初期位置固定・回転のみ） */}
                  <motion.div
                    className="absolute left-0 right-0 bottom-0 flex items-end justify-center pb-2 pointer-events-none"
                    style={{ height: layoutParams.armHeight, transformOrigin: "center bottom" }}
                    animate={{
                      rotate: rotation,
                      scale: phase === "gameover" ? (collapseAnimDone ? 0.95 : 1) : 1,
                    }}
                    transition={{
                      type: "spring",
                      stiffness: phase === "gameover" ? 50 : 120,
                      damping: phase === "gameover" ? 15 : 20,
                    }}
                  >
                    <div className="absolute left-1/2 bottom-0 w-[85%] h-2 -translate-x-1/2 rounded-full bg-gradient-to-r from-transparent via-slate-500 to-transparent" />
                    <div
                      className="absolute left-1/2 bottom-0 w-6 h-6 rounded-full bg-amber-500 border-2 border-amber-300 -translate-x-1/2 translate-y-1/2 z-20 shadow-[0_0_16px_rgba(245,158,11,0.7)]"
                      style={{ transformOrigin: "center center" }}
                    />
                  </motion.div>

                  {/* 左皿：上辺でアームに接続・下へ伸びる器 */}
                  <div
                    className="absolute flex flex-col items-center pointer-events-none"
                    style={{
                      left: leftEndX - panWidth / 2,
                      top: panBottomBase + leftEndY,
                      width: panWidth,
                      transform: "rotate(0deg)",
                    }}
                  >
                    <span className="text-[10px] text-amber-400/90 font-medium mb-1">NPC</span>
                    <div
                      className="relative w-32 rounded-b-xl border-2 border-amber-500/50 bg-amber-500/10 px-2 py-2 overflow-visible"
                      style={{
                        minHeight: PAN_MAX_VISIBLE_HEIGHT,
                        height:
                          leftDisplay.length > 0
                            ? Math.max(
                                PAN_MAX_VISIBLE_HEIGHT,
                                Math.max(...leftDisplay.map((w) => w.y + getWeightHeight(w.value, "left")))
                              )
                            : PAN_MAX_VISIBLE_HEIGHT,
                      }}
                    >
                      {leftDisplay.map((w) => (
                        <PlacedWeightBlock key={w.id} w={w} />
                      ))}
                    </div>
                  </div>

                  {/* 右皿：上辺でアームに接続・下へ伸びる器 */}
                  <div
                    className="absolute flex flex-col items-center"
                    style={{
                      left: rightEndX - panWidth / 2,
                      top: panBottomBase + rightEndY,
                      width: panWidth,
                      transform: "rotate(0deg)",
                    }}
                  >
                    <span className="text-[10px] text-blue-400/90 font-medium mb-1">You</span>
                    <motion.div
                      ref={rightPanRef}
                      className="relative w-32 rounded-b-xl border-2 px-2 py-2 border-blue-500/50 bg-blue-500/10 transition-colors overflow-visible"
                      style={{
                        minHeight: PAN_MAX_VISIBLE_HEIGHT,
                        height:
                          rightDisplay.length > 0
                            ? Math.max(
                                PAN_MAX_VISIBLE_HEIGHT,
                                Math.max(...rightDisplay.map((w) => w.y + getWeightHeight(w.value, "right")))
                              )
                            : PAN_MAX_VISIBLE_HEIGHT,
                      }}
                      whileHover={{ borderColor: "rgba(96,165,250,0.9)", backgroundColor: "rgba(59,130,246,0.2)" }}
                    >
                      {rightDisplay.map((w) => (
                        <PlacedWeightBlock key={w.id} w={w} />
                      ))}
                    </motion.div>
                  </div>
                  {/* P2用：右器接続点（常に配置・getBoundingClientRectで座標取得） */}
                  <div
                    ref={rightPanConnectionRef}
                    aria-hidden
                    className="absolute w-1 h-1 pointer-events-none opacity-0"
                    style={{
                      left: rightEndX,
                      top: panBottomBase + rightEndY,
                      transform: "translate(-50%, -50%)",
                    }}
                  />
                  {/* P2用：左器接続点（NPCアイテム投入のベジエ終端） */}
                  <div
                    ref={leftPanConnectionRef}
                    aria-hidden
                    className="absolute w-1 h-1 pointer-events-none opacity-0"
                    style={{
                      left: leftEndX,
                      top: panBottomBase + leftEndY,
                      transform: "translate(-50%, -50%)",
                    }}
                  />
                  {isDebugMode && showConnectionPoints && (
                    <>
                      <div
                        className="absolute w-3 h-3 rounded-full border-2 border-amber-300 bg-amber-500 pointer-events-none z-30"
                        style={{
                          left: leftEndX,
                          top: panBottomBase + leftEndY,
                          transform: "translate(-50%, -50%)",
                        }}
                        title="NPC接続点"
                      />
                      <div
                        className="absolute w-3 h-3 rounded-full border-2 border-blue-300 bg-blue-500 pointer-events-none z-30"
                        style={{
                          left: rightEndX,
                          top: panBottomBase + rightEndY,
                          transform: "translate(-50%, -50%)",
                        }}
                        title="You接続点"
                      />
                    </>
                  )}
                </motion.div>
                </div>
              </div>

              {(phase === "user" || phase === "transition") && (
                <div className="relative z-10 mt-2 mb-2 space-y-3 p-3 rounded-2xl border border-white/10 bg-gradient-to-br from-[#0a0e18] to-[#0f172a] overflow-visible shrink-0">
                  <div ref={dragConstraintRef} className="relative min-w-0">
                    <div
                      ref={inventoryContainerRef}
                      className="min-h-[72px] p-3 rounded-xl border-2 border-dashed border-blue-500/30 bg-blue-500/5 flex flex-wrap gap-3 items-center justify-center overflow-visible shrink-0 relative"
                      style={{ touchAction: "none" }}
                    >
                    {phase === "user" && inventorySlots.every((s) => !s) ? (
                      <span className="text-wit-muted text-sm">在庫なし</span>
                    ) : phase === "user" ? (
                      inventorySlots.map((slot, i) =>
                        slot ? (
                          <DraggableWeightBlock
                            key={`${slot.id}-${dragResetKey}`}
                            item={slot}
                            onLaunch={handleLaunch}
                            onDragCancel={handleDragCancel}
                            dropZoneRef={rightPanRef}
                            rightPanConnectionRef={rightPanConnectionRef}
                            inventoryContainerRef={inventoryContainerRef}
                            dragConstraintRef={dragConstraintRef}
                            p1OffsetY={p1OffsetY}
                            velocityMultiplier={velocityMultiplier}
                          />
                        ) : (
                          <div
                            key={`empty-${i}`}
                            className="w-12 h-8 rounded-lg border-2 border-dashed border-white/20 bg-white/5 shrink-0"
                            aria-hidden
                          />
                        )
                      )
                    ) : phase === "transition" && transitionNpcItemVisible && transitionNpcItem ? (
                      <NPCDropBlock item={transitionNpcItem} />
                    ) : null}
                    {phase === "user" && isDebugMode && !debugFlyingItem && (
                      <DebugThrowBlock
                        item={DEBUG_ITEM}
                        onDebugLaunch={handleDebugLaunch}
                        dropZoneRef={rightPanRef}
                        rightPanConnectionRef={rightPanConnectionRef}
                        inventoryContainerRef={inventoryContainerRef}
                        dragConstraintRef={dragConstraintRef}
                        p1OffsetY={p1OffsetY}
                        velocityMultiplier={velocityMultiplier}
                      />
                    )}
                    </div>
                  </div>
                  <button
                    onClick={handleJudge}
                    disabled={phase === "transition"}
                    className={`w-full py-3 rounded-xl font-bold transition-colors border-2 border-amber-400/50 ${
                      phase === "transition"
                        ? "bg-amber-500/50 text-black/60 cursor-not-allowed"
                        : "bg-amber-500 hover:bg-amber-600 text-black"
                    }`}
                  >
                    Judge（確定）
                  </button>
                </div>
              )}

              {phase === "gameover" && collapseAnimDone && (
                <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="text-center space-y-4">
                  <p className="text-red-400 font-bold text-xl">Game Over</p>
                  <p className="text-wit-muted text-sm">天秤が崩壊しました</p>
                  <button
                    onClick={showResult}
                    className="px-6 py-3 rounded-xl bg-white/10 hover:bg-white/20 border border-white/20 font-medium transition-colors"
                  >
                    リザルトを見る
                  </button>
                </motion.div>
              )}
            </motion.div>
          )}

          {phase === "result" && (
            <motion.div key="result" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="py-8">
              <h2 className="text-xl font-bold mb-6 text-center">積み上がった判断の軌跡</h2>
              <p className="text-wit-muted text-xs text-center mb-4">地面（R1）から上空へ — 全{history.length}ターンの履歴</p>
              <div ref={scrollContainerRef} className="relative h-[360px] overflow-y-auto overflow-x-hidden rounded-xl border border-white/10 bg-black/40">
                <div className="flex flex-col-reverse gap-2 p-4 min-h-full">
                  {history.map((e) => (
                    <motion.div
                      key={e.round}
                      initial={{ opacity: 0, x: -10 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ duration: 0.2 }}
                      className="flex items-center gap-4 px-4 py-3 rounded-lg bg-white/5 border border-white/10 text-sm shrink-0"
                    >
                      <span className="text-wit-muted w-10 shrink-0">R{e.round}</span>
                      <span className="text-amber-400 shrink-0">NPC +{e.left}</span>
                      <span className="text-blue-400 shrink-0">You +{e.right}</span>
                      <span className={`shrink-0 font-mono ${e.diff >= 0 ? "text-amber-400" : "text-blue-400"}`}>Δ{e.diff}</span>
                    </motion.div>
                  ))}
                </div>
              </div>
              <div className="flex justify-center gap-4 mt-6">
                <button
                  onClick={startGame}
                  className="px-6 py-3 rounded-xl bg-amber-500 hover:bg-amber-600 text-black font-bold transition-colors"
                >
                  もう一度
                </button>
                <Link href="/" className="px-6 py-3 rounded-xl bg-white/10 hover:bg-white/20 border border-white/20 font-medium transition-colors no-underline inline-block">
                  トップへ
                </Link>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </main>
    </div>
  );
}
