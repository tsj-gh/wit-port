"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";
import {
  DndContext,
  DragEndEvent,
  DragOverlay,
  DragStartEvent,
  PointerSensor,
  TouchSensor,
  pointerWithin,
  useSensor,
  useSensors,
  useDraggable,
  useDroppable,
} from "@dnd-kit/core";

const BALANCE_LIMIT = 100;
const NPC_WEIGHT_MIN = 10;
const NPC_WEIGHT_MAX = 50;
const INITIAL_TIMER = 10;
const WEIGHT_VALUES = [1, 3, 5, 10, 20];
const INVENTORY_COUNT = 8;
const PAN_MAX_VISIBLE_HEIGHT = 120;
const BLOCK_HEIGHT = 28;

type Phase = "ready" | "npc" | "user" | "gameover" | "result";

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

function getRotation(balance: number, collapsed: boolean): number {
  if (collapsed) return balance > 0 ? -90 : 90;
  const clamped = Math.max(-BALANCE_LIMIT, Math.min(BALANCE_LIMIT, balance));
  return -clamped * 0.25;
}

function generateRoundInventory(): WeightItem[] {
  const pool = [...WEIGHT_VALUES, ...WEIGHT_VALUES].sort(() => Math.random() - 0.5);
  return pool.slice(0, INVENTORY_COUNT).map((v) => createWeightItem(v));
}

function DraggableWeightBlock({ item }: { item: WeightItem }) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: item.id,
    data: { item },
  });
  return (
    <motion.div
      ref={setNodeRef}
      {...listeners}
      {...attributes}
      layout
      className={`flex items-center justify-center rounded-lg border-2 font-bold text-white text-sm select-none cursor-grab active:cursor-grabbing ${getBlockSize(
        item.visual.size
      )} ${item.visual.bgClass} ${item.visual.borderClass}`}
      style={{
        opacity: isDragging ? 0.5 : 1,
        boxShadow: "0 2px 8px rgba(0,0,0,0.3)",
        touchAction: "none",
      }}
    >
      {item.value}
    </motion.div>
  );
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

function RightPanDroppable({ weights }: { weights: WeightItem[] }) {
  const { setNodeRef, isOver } = useDroppable({ id: "right-pan" });
  return (
    <div
      ref={setNodeRef}
      className={`min-h-[80px] w-28 rounded-b-xl border-2 flex flex-col-reverse items-center justify-end gap-1 px-2 py-2 transition-colors ${
        isOver ? "border-blue-400 bg-blue-500/25" : "border-blue-500/50 bg-blue-500/10"
      }`}
      style={{
        maxHeight: PAN_MAX_VISIBLE_HEIGHT,
        overflow: "hidden",
      }}
    >
      {weights.map((w) => (
        <WeightBlockStatic key={w.id} item={w} />
      ))}
    </div>
  );
}

export default function PresSureJudgeGame() {
  const [phase, setPhase] = useState<Phase>("ready");
  const [totalBalance, setTotalBalance] = useState(0);
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [leftPanWeights, setLeftPanWeights] = useState<WeightItem[]>([]);
  const [rightPanWeights, setRightPanWeights] = useState<WeightItem[]>([]);
  const [inventoryWeights, setInventoryWeights] = useState<WeightItem[]>([]);
  const [round, setRound] = useState(0);
  const [timer, setTimer] = useState(INITIAL_TIMER);
  const [collapseAnimDone, setCollapseAnimDone] = useState(false);
  const [activeDragItem, setActiveDragItem] = useState<WeightItem | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const scrollContainerRef = useRef<HTMLDivElement>(null);

  const totalBalanceRef = useRef(totalBalance);
  const rightPanWeightsRef = useRef(rightPanWeights);
  const leftPanWeightsRef = useRef(leftPanWeights);
  const roundRef = useRef(round);
  const inventoryWeightsRef = useRef(inventoryWeights);

  totalBalanceRef.current = totalBalance;
  rightPanWeightsRef.current = rightPanWeights;
  leftPanWeightsRef.current = leftPanWeights;
  roundRef.current = round;
  inventoryWeightsRef.current = inventoryWeights;

  const currentUserWeight = rightPanWeights.reduce((s, w) => s + w.value, 0);
  const currentNPCWeight = leftPanWeights.reduce((s, w) => s + w.value, 0);
  const effectiveBalance = phase === "user" ? totalBalance - currentUserWeight : totalBalance;
  const isCollapsed = phase === "gameover" && collapseAnimDone;
  const leftTotal = history.reduce((s, e) => s + e.left, 0) + currentNPCWeight;
  const rightTotal = history.reduce((s, e) => s + e.right, 0) + currentUserWeight;

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { distance: 5 },
    }),
    useSensor(TouchSensor, {
      activationConstraint: { delay: 150, tolerance: 8 },
    })
  );

  const startGame = useCallback(() => {
    setPhase("npc");
    setTotalBalance(0);
    setHistory([]);
    setLeftPanWeights([]);
    setRightPanWeights([]);
    setInventoryWeights([]);
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
    setInventoryWeights(generateRoundInventory());
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

    if (Math.abs(newBalance) > BALANCE_LIMIT) {
      setPhase("gameover");
      return;
    }
    setLeftPanWeights([]);
    setRightPanWeights([]);
    setPhase("npc");
  }, []);

  useEffect(() => {
    if (phase !== "npc") return;
    const delay = round === 0 ? 300 : 600;
    const id = setTimeout(runNPCTurn, delay);
    return () => clearTimeout(id);
  }, [phase, round, runNPCTurn]);

  useEffect(() => {
    if (phase !== "user") return;
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
  }, [phase, performResolution]);

  const handleJudge = () => {
    if (phase !== "user") return;
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
    performResolution();
  };

  const handleDragStart = (event: DragStartEvent) => {
    const data = event.active.data.current;
    if (data?.item) setActiveDragItem(data.item as WeightItem);
  };

  const handleDragEnd = (event: DragEndEvent) => {
    setActiveDragItem(null);
    const { active, over } = event;
    if (!over || over.id !== "right-pan") return;
    const data = active.data.current;
    if (!data?.item) return;
    const item = data.item as WeightItem;
    if (!inventoryWeightsRef.current.some((w) => w.id === item.id)) return;

    setInventoryWeights((inv) => inv.filter((w) => w.id !== item.id));
    setRightPanWeights((pan) => {
      const stackIndex = pan.length;
      return [
        ...pan,
        { ...item, position: { x: 0, y: stackIndex * BLOCK_HEIGHT } },
      ];
    });
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

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#0a0e18] to-[#0f172a] text-wit-text">
      <header className="flex justify-between items-center px-6 py-6 border-b border-white/10">
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

      <main className="mx-auto max-w-[640px] px-4 py-8">
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
              className="space-y-8"
            >
              <div className="flex justify-center">
                <DndContext
                  sensors={sensors}
                  collisionDetection={pointerWithin}
                  onDragStart={handleDragStart}
                  onDragEnd={handleDragEnd}
                >
                  <motion.div
                    className="relative w-full max-w-lg h-56 flex items-end justify-center pb-4"
                    style={{ transformOrigin: "center bottom" }}
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

                    <div
                      className="absolute left-[5%] bottom-8 w-28 flex flex-col items-center"
                      style={{ transformOrigin: "left bottom" }}
                    >
                      <span className="text-[10px] text-amber-400/90 font-medium mb-1">NPC</span>
                      <div className="min-h-[80px] w-28 rounded-b-xl border-2 border-amber-500/50 bg-amber-500/10 flex flex-col-reverse items-center justify-end gap-1 px-2 py-2 overflow-hidden"
                        style={{ maxHeight: PAN_MAX_VISIBLE_HEIGHT }}
                      >
                        {leftPanWeights.map((w) => (
                          <NPCDropBlock key={w.id} item={w} />
                        ))}
                      </div>
                      <span className="text-xs font-bold tabular-nums text-amber-200 mt-1">{leftTotal}</span>
                    </div>

                    <div
                      className="absolute right-[5%] bottom-8 w-28 flex flex-col items-center"
                      style={{ transformOrigin: "right bottom" }}
                    >
                      <span className="text-[10px] text-blue-400/90 font-medium mb-1">You</span>
                      <RightPanDroppable weights={rightPanWeights} />
                      <span className="text-xs font-bold tabular-nums text-blue-200 mt-1">{rightTotal}</span>
                    </div>
                  </motion.div>

                  <DragOverlay>
                    {activeDragItem ? (
                      <div
                        className={`flex items-center justify-center rounded-lg border-2 font-bold text-white text-sm ${getBlockSize(
                          activeDragItem.visual.size
                        )} ${activeDragItem.visual.bgClass} ${activeDragItem.visual.borderClass}`}
                        style={{ boxShadow: "0 8px 24px rgba(0,0,0,0.5)" }}
                      >
                        {activeDragItem.value}
                      </div>
                    ) : null}
                  </DragOverlay>
                </DndContext>
              </div>

              <div className="text-center py-2 rounded-xl bg-white/5 border border-white/10">
                <span className="text-wit-muted text-xs">有効傾き </span>
                <span
                  className={`font-mono font-bold tabular-nums text-lg ${
                    Math.abs(effectiveBalance) > 80 ? "text-red-400" : Math.abs(effectiveBalance) > 50 ? "text-amber-400" : "text-wit-text"
                  }`}
                >
                  {effectiveBalance}
                </span>
              </div>

              {phase === "user" && (
                <div className="space-y-4 p-4 rounded-2xl border border-white/10 bg-white/5">
                  <div className="flex items-center justify-between">
                    <span className="text-wit-muted text-sm">在庫から皿へドラッグ</span>
                    <span
                      className={`font-mono font-bold tabular-nums text-xl ${
                        timer <= 3 ? "text-red-400 animate-pulse" : "text-amber-400"
                      }`}
                    >
                      {timer}s
                    </span>
                  </div>
                  <div className="min-h-[72px] p-4 rounded-xl border-2 border-dashed border-blue-500/30 bg-blue-500/5 flex flex-wrap gap-3 items-center justify-center">
                    {inventoryWeights.length === 0 ? (
                      <span className="text-wit-muted text-sm">在庫なし</span>
                    ) : (
                      inventoryWeights.map((item) => <DraggableWeightBlock key={item.id} item={item} />)
                    )}
                  </div>
                  <p className="text-wit-muted text-xs text-center">
                    皿の合計: <span className="font-bold text-blue-300">{currentUserWeight}</span>
                  </p>
                  <button
                    onClick={handleJudge}
                    className="w-full py-3 rounded-xl bg-amber-500 hover:bg-amber-600 text-black font-bold transition-colors border-2 border-amber-400/50"
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
