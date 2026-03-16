"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";

const BALANCE_LIMIT = 100;
const NPC_WEIGHT_MIN = 10;
const NPC_WEIGHT_MAX = 50;
const INITIAL_TIMER = 10;
const AVAILABLE_WEIGHTS = [1, 3, 5, 10, 20];

type Phase = "ready" | "npc" | "user" | "gameover" | "result";

type HistoryEntry = {
  round: number;
  left: number;
  right: number;
  diff: number;
};

function getRotation(balance: number, collapsed: boolean): number {
  if (collapsed) return balance > 0 ? -90 : 90;
  const clamped = Math.max(-BALANCE_LIMIT, Math.min(BALANCE_LIMIT, balance));
  return -clamped * 0.25;
}

export default function PresSureJudgeGame() {
  const [phase, setPhase] = useState<Phase>("ready");
  const [totalBalance, setTotalBalance] = useState(0);
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [currentNPCWeight, setCurrentNPCWeight] = useState(0);
  const [currentUserWeight, setCurrentUserWeight] = useState(0);
  const [round, setRound] = useState(0);
  const [timer, setTimer] = useState(INITIAL_TIMER);
  const [collapseAnimDone, setCollapseAnimDone] = useState(false);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const scrollContainerRef = useRef<HTMLDivElement>(null);

  const totalBalanceRef = useRef(totalBalance);
  const currentUserWeightRef = useRef(currentUserWeight);
  const currentNPCWeightRef = useRef(currentNPCWeight);
  const roundRef = useRef(round);

  totalBalanceRef.current = totalBalance;
  currentUserWeightRef.current = currentUserWeight;
  currentNPCWeightRef.current = currentNPCWeight;
  roundRef.current = round;

  const effectiveBalance = phase === "user" ? totalBalance - currentUserWeight : totalBalance;
  const isCollapsed = phase === "gameover" && collapseAnimDone;

  const startGame = useCallback(() => {
    setPhase("npc");
    setTotalBalance(0);
    setHistory([]);
    setCurrentNPCWeight(0);
    setCurrentUserWeight(0);
    setRound(0);
    setTimer(INITIAL_TIMER);
    setCollapseAnimDone(false);
  }, []);

  const runNPCTurn = useCallback(() => {
    const weight = Math.floor(Math.random() * (NPC_WEIGHT_MAX - NPC_WEIGHT_MIN + 1)) + NPC_WEIGHT_MIN;
    setCurrentNPCWeight(weight);
    setCurrentUserWeight(0);
    setTotalBalance((b) => b + weight);
    setRound((r) => r + 1);
    setPhase("user");
    setTimer(INITIAL_TIMER);
  }, []);

  const performResolution = useCallback(() => {
    const balance = totalBalanceRef.current;
    const userW = currentUserWeightRef.current;
    const npcW = currentNPCWeightRef.current;
    const r = roundRef.current;

    const newBalance = balance - userW;
    setTotalBalance(newBalance);

    const entry: HistoryEntry = {
      round: r,
      left: npcW,
      right: userW,
      diff: npcW - userW,
    };
    setHistory((h) => [...h, entry]);

    if (Math.abs(newBalance) > BALANCE_LIMIT) {
      setPhase("gameover");
      return;
    }
    setPhase("npc");
    setCurrentNPCWeight(0);
    setCurrentUserWeight(0);
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

  const handleWeightClick = (w: number) => {
    if (phase !== "user") return;
    setCurrentUserWeight((c) => c + w);
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
  const leftTotal = history.reduce((s, e) => s + e.left, 0) + (phase !== "ready" ? currentNPCWeight : 0);
  const rightTotal = history.reduce((s, e) => s + e.right, 0) + currentUserWeight;

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
                NPCが重りを載せるたびに天秤が傾く。10秒以内にあなたの重りで均衡を保て。判定ミスは累積するサバイバルゲーム。
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
                <motion.div
                  className="relative w-full max-w-md h-52 flex items-center justify-center"
                  style={{ transformOrigin: "center center" }}
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
                  <div
                    className="absolute left-1/2 top-1/2 w-[90%] h-1 -translate-x-1/2 -translate-y-1/2 rounded-full bg-gradient-to-r from-transparent via-slate-500 to-transparent"
                    style={{ transformOrigin: "center center" }}
                  />
                  <div
                    className="absolute left-1/2 top-1/2 w-5 h-5 rounded-full bg-amber-500 border-2 border-amber-300 -translate-x-1/2 -translate-y-1/2 z-10 shadow-[0_0_16px_rgba(245,158,11,0.7)]"
                    style={{ transformOrigin: "center center" }}
                  />
                  <div
                    className="absolute left-[8%] top-1/2 w-24 h-20 -translate-y-1/2 rounded-xl border-2 border-amber-500/60 bg-amber-500/15 flex flex-col items-center justify-center gap-1 backdrop-blur"
                    style={{ transformOrigin: "center center" }}
                  >
                    <span className="text-[10px] text-amber-400/90 font-medium">NPC</span>
                    <span className="text-sm font-bold tabular-nums text-amber-200">{leftTotal}</span>
                    <div className="flex gap-1 flex-wrap justify-center max-w-[70px]">
                      {history.slice(-6).map((e, i) => (
                        <span
                          key={i}
                          className="w-1.5 h-1.5 rounded-full bg-amber-500/70"
                          title={`R${e.round}: +${e.left}`}
                        />
                      ))}
                    </div>
                  </div>
                  <div
                    className="absolute right-[8%] top-1/2 w-24 h-20 -translate-y-1/2 rounded-xl border-2 border-blue-500/60 bg-blue-500/15 flex flex-col items-center justify-center gap-1 backdrop-blur"
                    style={{ transformOrigin: "center center" }}
                  >
                    <span className="text-[10px] text-blue-400/90 font-medium">You</span>
                    <span className="text-sm font-bold tabular-nums text-blue-200">{rightTotal}</span>
                    <div className="flex gap-1 flex-wrap justify-center max-w-[70px]">
                      {history.slice(-6).map((e, i) => (
                        <span
                          key={i}
                          className="w-1.5 h-1.5 rounded-full bg-blue-500/70"
                          title={`R${e.round}: +${e.right}`}
                        />
                      ))}
                    </div>
                  </div>
                </motion.div>
              </div>

              <div className="text-center py-2 rounded-xl bg-white/5 border border-white/10">
                <span className="text-wit-muted text-xs">有効傾き </span>
                <span
                  className={`font-mono font-bold tabular-nums text-lg ${
                    Math.abs(effectiveBalance) > 80
                      ? "text-red-400"
                      : Math.abs(effectiveBalance) > 50
                        ? "text-amber-400"
                        : "text-wit-text"
                  }`}
                >
                  {effectiveBalance}
                </span>
              </div>

              {phase === "user" && (
                <div className="space-y-4 p-4 rounded-2xl border border-white/10 bg-white/5">
                  <div className="flex items-center justify-between">
                    <span className="text-wit-muted text-sm">重りをクリックして追加</span>
                    <span
                      className={`font-mono font-bold tabular-nums text-xl ${
                        timer <= 3 ? "text-red-400 animate-pulse" : "text-amber-400"
                      }`}
                    >
                      {timer}s
                    </span>
                  </div>
                  <div className="flex flex-wrap gap-3 justify-center">
                    {AVAILABLE_WEIGHTS.map((w) => (
                      <button
                        key={w}
                        onClick={() => handleWeightClick(w)}
                        className="w-14 h-14 rounded-xl border-2 border-blue-500/50 bg-blue-500/20 hover:bg-blue-500/40 hover:border-blue-400/70 font-bold text-lg transition-all active:scale-95"
                      >
                        +{w}
                      </button>
                    ))}
                  </div>
                  <p className="text-wit-muted text-xs text-center">
                    現在の追加: <span className="font-bold text-blue-300">{currentUserWeight}</span>
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
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="text-center space-y-4"
                >
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
            <motion.div
              key="result"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="py-8"
            >
              <h2 className="text-xl font-bold mb-6 text-center">積み上がった判断の軌跡</h2>
              <p className="text-wit-muted text-xs text-center mb-4">
                地面（R1）から上空へ — 全{history.length}ターンの履歴
              </p>
              <div
                ref={scrollContainerRef}
                className="relative h-[360px] overflow-y-auto overflow-x-hidden rounded-xl border border-white/10 bg-black/40"
              >
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
                      <span
                        className={`shrink-0 font-mono ${
                          e.diff >= 0 ? "text-amber-400" : "text-blue-400"
                        }`}
                      >
                        Δ{e.diff}
                      </span>
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
                <Link
                  href="/"
                  className="px-6 py-3 rounded-xl bg-white/10 hover:bg-white/20 border border-white/20 font-medium transition-colors no-underline inline-block"
                >
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
