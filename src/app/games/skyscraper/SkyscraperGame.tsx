"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import { DevLink } from "@/components/DevLink";
import confetti from "canvas-confetti";
import {
  generatePuzzleAction,
  validateAnswerAction,
  hintAction,
  solveAction,
  checkProgressAction,
} from "./actions";
import { useUserSyncContext } from "@/components/UserSyncProvider";
import { DevDebugUserStats } from "@/components/DevDebugUserStats";
import { recordPuzzleClear } from "@/lib/wispo-user-data";

type Clues = {
  top: (number | null)[];
  bottom: (number | null)[];
  left: (number | null)[];
  right: (number | null)[];
};

type MaybeHistoryEntry = { r: number; c: number; prevVal: number };

function emptyGrid(n: number): number[][] {
  return Array.from({ length: n }, () => Array(n).fill(0));
}

function cloneGrid(grid: number[][]): number[][] {
  return grid.map((row) => [...row]);
}

export default function SkyscraperGame() {
  const [n, setN] = useState(5);
  const [difficulty, setDifficulty] = useState<"easy" | "normal" | "hard">("normal");
  const [clues, setClues] = useState<Clues | null>(null);
  const [grid, setGrid] = useState<number[][]>([]);
  const [solved, setSolved] = useState(false);
  const [showClearOverlay, setShowClearOverlay] = useState(false);
  const [status, setStatus] = useState("");
  const [maybeMode, setMaybeMode] = useState(false);
  const [maybeGridSnapshot, setMaybeGridSnapshot] = useState<number[][] | null>(null);
  const [sinceMaybeHistory, setSinceMaybeHistory] = useState<MaybeHistoryEntry[]>([]);
  const [firstDeterminedCell, setFirstDeterminedCell] = useState<{ r: number; c: number } | null>(null);
  const [isRewinding, setIsRewinding] = useState(false);
  const [loading, setLoading] = useState(true);
  const [timeSeconds, setTimeSeconds] = useState(0);
  const [timerActive, setTimerActive] = useState(false);
  const [currentSeed, setCurrentSeed] = useState<string | null>(null);
  const [randomSequenceId, setRandomSequenceId] = useState<number | null>(null);
  const [coreGridHash, setCoreGridHash] = useState<string | null>(null);
  const [hashInput, setHashInput] = useState("");
  const searchParams = useSearchParams();
  const isDevTj = searchParams.get("devtj") === "true";
  const userSync = useUserSyncContext();
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const timeSecondsRef = useRef(0);
  const selectedCellRef = useRef<{ r: number; c: number } | null>(null);
  const touchStartYRef = useRef<number | null>(null);
  const swipeHandledRef = useRef(false);

  const loadPuzzle = useCallback(
    async (size: number, diff: "easy" | "normal" | "hard", seed?: string) => {
      setLoading(true);
      setSolved(false);
      setShowClearOverlay(false);
      setN(size);
      setDifficulty(diff);
      setTimeSeconds(0);
      timeSecondsRef.current = 0;
      setTimerActive(false);
      setMaybeMode(false);
      setMaybeGridSnapshot(null);
      setSinceMaybeHistory([]);
      setFirstDeterminedCell(null);
      const result = await generatePuzzleAction(size, diff, seed);
      if (result.error) {
        setStatus(result.error);
        setLoading(false);
        return;
      }
      setClues(result.clues);
      setN(result.n);
      setGrid(emptyGrid(result.n));
      setStatus("");
      setCurrentSeed(result.seed ?? null);
      setRandomSequenceId(result.randomSequenceId ?? null);
      setCoreGridHash(result.coreGridHash ?? null);
      setLoading(false);
      setTimerActive(true);
    },
    []
  );

  useEffect(() => {
    loadPuzzle(n, difficulty);
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

  const checkWin = useCallback(async () => {
    if (solved || !clues) return;
    const filled = grid.every((row) => row.every((v) => v > 0));
    if (!filled) return;
    setTimerActive(false);
    const result = await validateAnswerAction(grid, n);
    if (result.ok) {
      setSolved(true);
      setShowClearOverlay(true);
      try {
        recordPuzzleClear("skyscraper");
        if (userSync?.saveProgressAndSync) {
          userSync.saveProgressAndSync(() => {}).catch(() => {});
        }
      } catch {
        /* ignore */
      }
    } else {
      setStatus(result.msg);
    }
  }, [grid, n, difficulty, clues, solved, userSync]);

  useEffect(() => {
    checkWin();
  }, [grid, checkWin]);

  // クリア画面ポップアップ時のみ紙吹雪を1回発火
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

  const cycleCell = useCallback(
    (r: number, c: number) => {
      if (solved || !clues) return;
      const cur = grid[r]?.[c] ?? 0;
      const next = cur >= n ? 0 : cur + 1;

      if (maybeMode) {
        setSinceMaybeHistory((h) => [...h, { r, c, prevVal: cur }]);
      }

      setGrid((g) => {
        const nextGrid = cloneGrid(g);
        nextGrid[r][c] = next;
        return nextGrid;
      });
    },
    [grid, n, clues, solved, maybeMode, sinceMaybeHistory, maybeGridSnapshot]
  );

  const setCellValue = useCallback(
    (r: number, c: number, val: number) => {
      if (solved || !clues) return;
      const cur = grid[r]?.[c] ?? 0;

      if (maybeMode) {
        setSinceMaybeHistory((h) => [...h, { r, c, prevVal: cur }]);
      }

      setGrid((g) => {
        const nextGrid = cloneGrid(g);
        nextGrid[r][c] = val;
        return nextGrid;
      });
    },
    [grid, clues, solved, maybeMode, sinceMaybeHistory, maybeGridSnapshot]
  );

  const incrementCell = useCallback(
    (r: number, c: number) => {
      const cur = grid[r]?.[c] ?? 0;
      if (cur < n) setCellValue(r, c, cur + 1);
    },
    [grid, n, setCellValue]
  );

  const decrementCell = useCallback(
    (r: number, c: number) => {
      const cur = grid[r]?.[c] ?? 0;
      if (cur > 0) setCellValue(r, c, cur - 1);
    },
    [grid, setCellValue]
  );

  const handleHint = async () => {
    if (solved || !clues) return;
    const result = await hintAction(grid, n);
    if ("error" in result) {
      setStatus(result.error ?? "");
      return;
    }
    setCellValue(result.r, result.c, result.val);
    setStatus(`ヒント: (${result.r + 1}, ${result.c + 1}) = ${result.val}`);
    selectedCellRef.current = { r: result.r, c: result.c };
  };

  const handleCheck = async () => {
    if (!clues) return;
    const result = await checkProgressAction(grid, clues, n);
    setStatus(result.msg);
  };

  const handleClear = () => {
    if (!clues) return;
    setGrid(emptyGrid(n));
    setStatus("盤面をリセットしました。");
    setMaybeMode(false);
    setMaybeGridSnapshot(null);
    setSinceMaybeHistory([]);
    setFirstDeterminedCell(null);
  };

  const handleSolve = async () => {
    const result = await solveAction(n);
    if (result.error) {
      setStatus(result.error);
      return;
    }
    setGrid(result.solution.map((r) => [...r]));
    setSolved(true);
    setTimerActive(false);
    setShowClearOverlay(true);
    setStatus("解答を表示しました。");
  };

  const triggerDebugSolve = useCallback(async () => {
    if (solved || !clues) return;
    const result = await solveAction(n);
    if (result.error) {
      setStatus(result.error);
      return;
    }
    setGrid(result.solution.map((r) => [...r]));
    setSolved(true);
    setTimerActive(false);
    setShowClearOverlay(true);
    setStatus("強制クリア（デバッグ）");
    try {
      recordPuzzleClear("skyscraper");
      if (userSync?.saveProgressAndSync) {
        userSync.saveProgressAndSync(() => {}).catch(() => {});
      }
    } catch {
      /* ignore */
    }
  }, [n, clues, solved, userSync]);

  const handleMaybeEnter = () => {
    const snapshot = cloneGrid(grid);
    setMaybeMode(true);
    setMaybeGridSnapshot(snapshot);
    setSinceMaybeHistory([]);
    // メイビー時点で最初に数字が入っていたマスを探す（行優先）
    let first: { r: number; c: number } | null = null;
    for (let r = 0; r < n; r++) {
      for (let c = 0; c < n; c++) {
        if (snapshot[r]?.[c]) {
          first = { r, c };
          break;
        }
      }
      if (first) break;
    }
    setFirstDeterminedCell(first);
    setStatus("メイビーモード：仮の入力が可能です。");
  };

  const handleMaybeConfirm = () => {
    setMaybeMode(false);
    setMaybeGridSnapshot(null);
    setSinceMaybeHistory([]);
    setFirstDeterminedCell(null);
    setStatus("メイビーモードを終了しました。");
  };

  const handleMaybeRewind = () => {
    if (!maybeGridSnapshot) return;
    setIsRewinding(true);
    setGrid(cloneGrid(maybeGridSnapshot));
    setMaybeMode(false);
    setMaybeGridSnapshot(null);
    setSinceMaybeHistory([]);
    setFirstDeterminedCell(null);
    setStatus("巻き戻ししました。");
    setTimeout(() => setIsRewinding(false), 200);
  };

  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (!clues || solved) return;
      const sel = selectedCellRef.current;
      if (!sel) return;
      const { r, c } = sel;
      if (e.key === "Backspace") {
        e.preventDefault();
        setCellValue(r, c, 0);
        return;
      }
      const num = parseInt(e.key, 10);
      if (num >= 1 && num <= n) {
        e.preventDefault();
        setCellValue(r, c, num);
      }
    },
    [clues, solved, n, setCellValue]
  );

  useEffect(() => {
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [handleKeyDown]);

  if (loading || !clues) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-wit-bg text-wit-text">
        <p className="text-wit-muted">パズルを読み込み中...</p>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-[1080px] w-full px-4 py-6">
      {isDevTj && (
        <div className="fixed right-4 top-4 z-50 max-h-[90vh] overflow-y-auto rounded-lg border border-white/20 bg-black/80 p-3 text-xs font-mono">
          <div className="font-bold text-emerald-400 mb-2">デバッグパネル</div>
          <div className="space-y-2 text-slate-400/90 text-[10px]">
            <DevDebugUserStats />
            <div className="flex flex-wrap gap-1">
              <button
                onClick={() => triggerDebugSolve()}
                disabled={solved || !clues}
                className="px-2 py-0.5 rounded text-[9px] border border-emerald-500/50 bg-emerald-500/20 text-emerald-400 hover:bg-emerald-500/30 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                強制クリア (Solve & Sync)
              </button>
            </div>
            <div className="flex items-center gap-1">
              <span className="shrink-0">anon_id:</span>
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
            <div className="flex items-center gap-1">
              <span className="shrink-0">Current Hash:</span>
              <code className="text-[9px] truncate max-w-[140px] bg-black/40 px-1 rounded" title={currentSeed ?? ""}>
                {currentSeed ?? "—"}
              </code>
              <button
                onClick={() => currentSeed && navigator.clipboard?.writeText(currentSeed)}
                disabled={!currentSeed}
                className="px-1 py-0.5 rounded text-[9px] border border-white/20 bg-white/10 hover:bg-white/20 disabled:opacity-50"
              >
                コピー
              </button>
            </div>
            <div>
              <span className="shrink-0 text-slate-500">Random Sequence ID:</span>{" "}
              <span className="tabular-nums">{randomSequenceId ?? "—"}</span>
            </div>
            <div>
              <span className="shrink-0 text-slate-500">Core Grid Hash:</span>{" "}
              <code className="text-[9px] truncate max-w-[120px] block">{coreGridHash ?? "—"}</code>
            </div>
            <div className="flex items-center gap-1 flex-wrap pt-1 border-t border-white/10">
              <span className="shrink-0">Input Hash:</span>
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
                  if (s) loadPuzzle(n, difficulty, s);
                }}
                disabled={!hashInput.trim() || loading}
                className="px-2 py-0.5 rounded text-[10px] border border-emerald-500/50 bg-emerald-500/20 text-emerald-400 hover:bg-emerald-500/30 disabled:opacity-50"
              >
                ハッシュから生成
              </button>
            </div>
          </div>
        </div>
      )}
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

      <section className="rounded-2xl p-4 sm:p-6 mb-4 border border-white/10 bg-white/5 backdrop-blur">
        <h2 className="text-lg font-bold mb-4 text-wit-text">設定</h2>
        <div className="flex flex-wrap gap-4 items-end">
          <div>
            <label className="block text-xs text-wit-muted mb-1">サイズ（N×N）</label>
            <select
              value={n}
              onChange={(e) => loadPuzzle(Number(e.target.value), difficulty)}
              className="px-3 py-2 rounded-lg bg-slate-800 border border-slate-600 text-wit-text text-sm"
            >
              <option value={4}>4×4（入門）</option>
              <option value={5}>5×5（標準）</option>
              <option value={6}>6×6（上級）</option>
            </select>
          </div>
          <div>
            <label className="block text-xs text-wit-muted mb-1">難易度</label>
            <select
              value={difficulty}
              onChange={(e) => loadPuzzle(n, e.target.value as "easy" | "normal" | "hard")}
              className="px-3 py-2 rounded-lg bg-slate-800 border border-slate-600 text-wit-text text-sm"
            >
              <option value="easy">かんたん（多め）</option>
              <option value="normal">ふつう</option>
              <option value="hard">むずかしい（少なめ）</option>
            </select>
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              onClick={handleHint}
              disabled={solved}
              className="px-3 py-2 rounded-lg bg-slate-700 border border-slate-600 text-wit-text text-sm hover:bg-slate-600 disabled:opacity-50"
            >
              ヒント
            </button>
            <button
              onClick={handleCheck}
              className="px-3 py-2 rounded-lg bg-slate-700 border border-slate-600 text-wit-text text-sm hover:bg-slate-600"
            >
              途中判定
            </button>
            <button
              onClick={handleClear}
              disabled={solved}
              className="px-3 py-2 rounded-lg bg-slate-700 border border-slate-600 text-wit-text text-sm hover:bg-slate-600 disabled:opacity-50"
            >
              リセット
            </button>
            <button
              onClick={handleSolve}
              className="px-3 py-2 rounded-lg bg-wit-emerald text-white text-sm hover:bg-emerald-600"
            >
              自動解答
            </button>
          </div>
        </div>
        <p className="text-xs text-wit-muted mt-2">
          マスをタップ/クリックで 1→2→…→N→空白 と巡回。数字キー(1〜N)/Backspace可。上スワイプで増、下スワイプで減。
        </p>
      </section>

      <section className="rounded-2xl p-4 sm:p-6 mb-4 border border-white/10 bg-white/5 backdrop-blur">
        <div className="flex flex-col sm:flex-row gap-6 justify-center items-center">
          <div className="flex flex-col gap-2 items-center">
            <div className="grid gap-1 justify-items-center" style={{ gridTemplateColumns: `repeat(${n + 2}, auto)` }}>
              <div />
              {clues.top.map((v, i) => (
                <div
                  key={`t-${i}`}
                  className="w-10 h-10 sm:w-12 sm:h-12 flex items-center justify-center text-wit-muted font-semibold text-sm"
                >
                  {v ?? "—"}
                </div>
              ))}
              <div />
            </div>

            <div className={`flex gap-2 items-stretch transition-opacity duration-200 ${isRewinding ? "opacity-60" : "opacity-100"}`}>
              <div className="flex flex-col justify-between">
                {clues.left.map((v, i) => (
                  <div
                    key={`l-${i}`}
                    className="w-10 h-10 sm:w-12 sm:h-12 flex items-center justify-center text-wit-muted font-semibold text-sm"
                  >
                    {v ?? "—"}
                  </div>
                ))}
              </div>
              <div
                className={`border-2 border-slate-600 rounded-xl overflow-hidden transition-opacity duration-200 ${isRewinding ? "opacity-50" : "opacity-100"}`}
                style={{ display: "grid", gridTemplateColumns: `repeat(${n}, 1fr)` }}
              >
                {Array.from({ length: n * n }, (_, i) => {
                  const r = Math.floor(i / n);
                  const c = i % n;
                  const val = grid[r]?.[c] ?? 0;
                  const isMaybe = maybeMode;
                  const isPin = firstDeterminedCell?.r === r && firstDeterminedCell?.c === c;

                  return (
                    <div
                      key={`${r}-${c}`}
                      role="button"
                      tabIndex={0}
                      className={`w-10 h-10 sm:w-12 sm:h-12 flex items-center justify-center border border-slate-600 cursor-pointer font-bold text-base sm:text-lg select-none touch-none
                        ${solved ? "cursor-default bg-slate-700/50" : "hover:bg-slate-700/50"}
                        ${val ? "text-wit-text" : "text-slate-500"}
                        ${isMaybe ? "text-slate-400" : ""}
                        ${isPin ? "relative after:content-[''] after:absolute after:bottom-1 after:left-1/2 after:-translate-x-1/2 after:w-0 after:h-0 after:border-l-[5px] after:border-r-[5px] after:border-l-transparent after:border-r-transparent after:border-t-[8px] after:border-t-amber-600" : ""}`}
                      style={
                        val
                          ? {
                              background: `linear-gradient(to top, rgba(16, 185, 129, 0.4) ${(val / n) * 100}%, transparent ${(val / n) * 100}%)`,
                            }
                          : {}
                      }
                      onClick={() => {
                        if (solved) return;
                        if (swipeHandledRef.current) {
                          swipeHandledRef.current = false;
                          return;
                        }
                        selectedCellRef.current = { r, c };
                        cycleCell(r, c);
                      }}
                      onFocus={() => {
                        selectedCellRef.current = { r, c };
                      }}
                      onTouchStart={(e) => {
                        touchStartYRef.current = e.touches[0].clientY;
                      }}
                      onTouchEnd={(e) => {
                        const start = touchStartYRef.current;
                        if (start == null) return;
                        const end = e.changedTouches[0].clientY;
                        const delta = start - end;
                        if (delta > 15) {
                          incrementCell(r, c);
                          swipeHandledRef.current = true;
                        } else if (delta < -15) {
                          decrementCell(r, c);
                          swipeHandledRef.current = true;
                        }
                        touchStartYRef.current = null;
                      }}
                      onMouseDown={(e) => {
                        if (e.button !== 0) return;
                        touchStartYRef.current = e.clientY;
                        swipeHandledRef.current = false;
                      }}
                      onMouseUp={(e) => {
                        if (e.button !== 0) return;
                        const start = touchStartYRef.current;
                        if (start == null) return;
                        const end = e.clientY;
                        const delta = start - end;
                        if (delta > 15) {
                          incrementCell(r, c);
                          swipeHandledRef.current = true;
                        } else if (delta < -15) {
                          decrementCell(r, c);
                          swipeHandledRef.current = true;
                        }
                        touchStartYRef.current = null;
                      }}
                    >
                      {val || ""}
                    </div>
                  );
                })}
              </div>
              <div className="flex flex-col justify-between">
                {clues.right.map((v, i) => (
                  <div
                    key={`r-${i}`}
                    className="w-10 h-10 sm:w-12 sm:h-12 flex items-center justify-center text-wit-muted font-semibold text-sm"
                  >
                    {v ?? "—"}
                  </div>
                ))}
              </div>
            </div>

            <div className="grid gap-1 justify-items-center" style={{ gridTemplateColumns: `repeat(${n + 2}, auto)` }}>
              <div />
              {clues.bottom.map((v, i) => (
                <div
                  key={`b-${i}`}
                  className="w-10 h-10 sm:w-12 sm:h-12 flex items-center justify-center text-wit-muted font-semibold text-sm"
                >
                  {v ?? "—"}
                </div>
              ))}
              <div />
            </div>
          </div>

          <div className="flex flex-col gap-2 items-center maybe-panel">
            <span className="text-sm text-wit-muted font-medium">メイビー</span>
            <div className="flex flex-col gap-2">
              <button
                onClick={handleMaybeEnter}
                disabled={solved || maybeMode}
                className="px-4 py-2 rounded-lg bg-amber-600/80 text-white text-sm font-medium hover:bg-amber-600 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                🐝 入る
              </button>
              <button
                onClick={handleMaybeConfirm}
                disabled={!maybeMode}
                className="px-4 py-2 rounded-lg bg-slate-700 border border-slate-600 text-wit-text text-sm hover:bg-slate-600 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                確定
              </button>
              <button
                onClick={handleMaybeRewind}
                disabled={!maybeMode}
                className="px-4 py-2 rounded-lg bg-slate-700 border border-slate-600 text-wit-text text-sm hover:bg-slate-600 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                巻き戻し
              </button>
            </div>
          </div>
        </div>

        <div className="mt-4 flex justify-between items-center">
          <button
            onClick={() => loadPuzzle(n, difficulty)}
            className="px-4 py-2 rounded-lg bg-wit-emerald text-white text-sm font-medium hover:bg-emerald-600"
          >
            新規生成
          </button>
          <div className="text-sm text-wit-muted min-h-[1.5em] font-medium">{status}</div>
        </div>
      </section>

      <section className="rounded-2xl p-4 sm:p-6 border border-white/10 bg-white/5 backdrop-blur">
        <h2 className="text-lg font-bold mb-3 text-wit-text">ルール（要点）</h2>
        <ol className="list-decimal list-inside space-y-2 text-wit-muted text-sm leading-relaxed">
          <li>各マスは「ビルの高さ」を表し、1〜N の数字を入れます。</li>
          <li>各行・各列には 1〜N が 1つずつ（重複なし）入ります。</li>
          <li>4辺の数字（手がかり）は、その方向から見えるビルの本数（手前から順により高いビルが現れるたびに +1）。</li>
          <li>すべての手がかりを満たすように数字を配置すると完成です。</li>
        </ol>
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
                  setShowClearOverlay(false);
                  loadPuzzle(n, difficulty);
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
  );
}
