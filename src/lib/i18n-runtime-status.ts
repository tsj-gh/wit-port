/**
 * サーバー／Worker が返す日本語メッセージを、クライアント locale に合わせて表示用に変換する。
 */

export function translatePairLinkStatus(raw: string, t: (key: string) => string): string {
  const map: Record<string, string> = {
    探索中: "games.pairLink.st.searching",
    "生成中...": "games.pairLink.st.generating",
    読み込み中: "games.pairLink.st.loading",
    ハッシュから生成中: "games.pairLink.st.fromHash",
    Playing: "games.pairLink.st.playing",
    生成に失敗しました: "games.pairLink.st.genFailed",
    解の取得に失敗しました: "games.pairLink.st.solveFailed",
    強制クリアに失敗しました: "games.pairLink.st.forceClearFailed",
    "タイムアウトしました。もう一度お試しください。": "games.pairLink.st.timeout",
    "生成に失敗しました。もう一度お試しください。": "games.pairLink.st.genFailedRetry",
  };
  const k = map[raw];
  return k ? t(k) : raw;
}

export function pairLinkLoadingLine(status: string, t: (key: string) => string): string {
  if (status === "探索中") return t("games.pairLink.loadLine.searching");
  if (status === "生成中...") return t("games.pairLink.loadLine.generating");
  if (status === "読み込み中") return t("games.pairLink.loadLine.loading");
  if (status && status !== "Playing") return `${translatePairLinkStatus(status, t)}…`;
  return t("games.pairLink.loadLine.puzzle");
}

export function translateSkyStatus(raw: string, t: (key: string) => string): string {
  if (!raw) return "";
  const staticMap: Record<string, string> = {
    "盤面をリセットしました。": "games.skyscraper.st.resetBoard",
    "解答を表示しました。": "games.skyscraper.st.showSolution",
    "強制クリア（デバッグ）": "games.skyscraper.st.debugClear",
    "メイビーモード：仮の入力が可能です。": "games.skyscraper.st.maybeEnter",
    "メイビーモードを終了しました。": "games.skyscraper.st.maybeExit",
    "巻き戻ししました。": "games.skyscraper.st.rewind",
    "ルールに矛盾は見つかりません。続けましょう。": "games.skyscraper.st.checkOk",
    "正解です！": "games.skyscraper.st.solvedMsg",
    "パズルの生成に失敗しました。": "games.skyscraper.err.genFailed",
    "パズルの有効期限が切れています。新規生成してください。": "games.skyscraper.err.expiredNew",
    "パズルが一致しません。新規生成してください。": "games.skyscraper.err.mismatchNew",
    "パズルの有効期限が切れています。": "games.skyscraper.err.expired",
    "パズルが一致しません。": "games.skyscraper.err.mismatch",
    "すべて埋まっています。": "games.skyscraper.err.allFilled",
  };
  if (staticMap[raw]) return t(staticMap[raw]);

  let m = /^行(\d+)で数字が重複しています。$/.exec(raw);
  if (m) return t("games.skyscraper.st.rowDup").replace("{n}", m[1]);
  m = /^列(\d+)で数字が重複しています。$/.exec(raw);
  if (m) return t("games.skyscraper.st.colDup").replace("{n}", m[1]);
  m = /^行(\d+)の可視数ヒントと一致しません。$/.exec(raw);
  if (m) return t("games.skyscraper.st.rowClueMismatch").replace("{n}", m[1]);
  m = /^列(\d+)の可視数ヒントと一致しません。$/.exec(raw);
  if (m) return t("games.skyscraper.st.colClueMismatch").replace("{n}", m[1]);
  m = /^\((\d+), (\d+)\) が正解と異なります。$/.exec(raw);
  if (m) return t("games.skyscraper.st.cellWrong").replace("{r}", m[1]).replace("{c}", m[2]);

  if (raw.startsWith("ヒント: ")) {
    const rest = raw.slice("ヒント: ".length);
    return `${t("games.skyscraper.st.hintPrefix")}: ${rest}`;
  }
  return raw;
}

export function translateReflecStatus(raw: string, t: (key: string) => string): string {
  if (!raw) return "";
  const map: Record<string, string> = {
    "盤面を準備中…": "games.reflecShot.st.preparing",
    "盤面の生成に失敗しました（Worker）": "games.reflecShot.st.genFailedWorker",
    "ハッシュの解析に失敗しました": "games.reflecShot.st.hashParseFailed",
    "ハッシュからの生成に失敗しました": "games.reflecShot.st.hashGenFailed",
    "ストックが空のため盤面を生成しています…": "games.reflecShot.st.stockEmptyGen",
    "次の盤面の生成に失敗しました（Worker）": "games.reflecShot.st.nextGenFailedWorker",
    "ゴール到達！": "games.reflecShot.st.goalReached",
    "失敗です。壁へ向かう進行・反射になったか、射出位置へ戻ってしまいました。バンパーを調整してください。":
      "games.reflecShot.st.failWallOrReturn",
  };
  const k = map[raw];
  return k ? t(k) : raw;
}
