#!/usr/bin/env node
/**
 * シード mn2btf4i-a6i9fcdi1 で 8x8 8ペア盤面を生成し、
 * パス2がパス3を囲み込もうとする際の判定をシミュレートする。
 * board-worker.js のロジックを Node で再現（軽量版）。
 */
import { createRequire } from "module";
const require = createRequire(import.meta.url);

// Worker を eval して generate を呼び出すのは難しいため、
// 盤面データを直接埋め込む（画像・先の議論から）
// パス2: 添付画像2の経路（青2）
// 緑3の「囲まれる」端点: (行5,列4) = {x:4, y:5}

const path2 = [
  { x: 2, y: 4 }, { x: 3, y: 4 }, { x: 4, y: 4 }, { x: 5, y: 4 }, { x: 6, y: 4 },
  { x: 6, y: 5 }, { x: 6, y: 6 }, { x: 5, y: 6 }, { x: 4, y: 6 }, { x: 4, y: 7 }, { x: 5, y: 7 }
];

function horizontalScreenArmAtVerticalBracket(path, ib, nc, isUpperBracket) {
  const len = path.length;
  if (!path || ib < 0 || ib >= len) return null;
  const b = path[ib];
  if (b.x !== nc) return null;
  let hasR = false, hasL = false;
  if (ib > 0 && path[ib - 1].y === b.y) {
    const dx = path[ib].x - path[ib - 1].x;
    if (dx > 0) hasR = true; else if (dx < 0) hasL = true;
  }
  if (ib + 1 < len && path[ib + 1].y === b.y) {
    const dx = path[ib + 1].x - path[ib].x;
    if (dx > 0) hasR = true; else if (dx < 0) hasL = true;
  }
  if (isUpperBracket) return hasR ? 1 : (hasL ? -1 : null);
  return hasL ? -1 : (hasR ? 1 : null);
}

function verticalPseudoHorizontalKickback(path, nc, iBracket, K, lateralIsEast, wantR, skipFirstAdvance) {
  const len = path.length;
  if (!path || len < 2 || iBracket < 0 || iBracket >= len || K < 1) return false;
  const b = path[iBracket];
  if (b.x !== nc) return false;
  let lateralI = -1;
  if (iBracket > 0 && path[iBracket - 1].y === b.y) {
    const lx = path[iBracket - 1].x;
    if (lateralIsEast && lx > b.x) lateralI = iBracket - 1;
    if (!lateralIsEast && lx < b.x) lateralI = iBracket - 1;
  }
  if (lateralI < 0 && iBracket + 1 < len && path[iBracket + 1].y === b.y) {
    const lx = path[iBracket + 1].x;
    if (lateralIsEast && lx > b.x) lateralI = iBracket + 1;
    if (!lateralIsEast && lx < b.x) lateralI = iBracket + 1;
  }
  if (lateralI < 0) return false;
  const otherI = lateralI === iBracket - 1 ? iBracket + 1 : iBracket - 1;
  if (otherI < 0 || otherI >= len) return false;
  let prev = iBracket, cur = otherI;
  if (skipFirstAdvance) {
    const dir0 = cur - prev, nxt0 = cur + dir0;
    if (nxt0 < 0 || nxt0 >= len) return false;
    prev = cur; cur = nxt0;
  }
  for (let e = 0; e < K; e++) {
    const pa = path[prev], pb = path[cur];
    if (pa.y === pb.y) {
      const dx = pb.x - pa.x;
      if (wantR && dx > 0) return true;
      if (!wantR && dx < 0) return true;
    }
    const dir = cur - prev, nxt = cur + dir;
    if (nxt < 0 || nxt >= len) break;
    prev = cur; cur = nxt;
  }
  return false;
}

const K = 4;

function simulate() {
  const nc = 4;
  const tRow = 5;
  const path = path2;

  console.log("=== シード mn2btf4i-a6i9fcdi1 想定 8x8 盤面: パス2→パス3 囲い込み判定シミュレーション ===\n");
  console.log("■ 前提");
  console.log("  ターゲット（緑3の端点）: { x:4, y:5 }（列4, 行5）");
  console.log("  パス2（青）: ", JSON.stringify(path));
  console.log("  垂直囲い込みの候補: 列 nc=4 上でターゲットに最も近い上下の交差をブラケット\n");

  let yUpper = -Infinity, yLower = Infinity, iMin = -1, iMax = -1;
  for (let i = 0; i < path.length; i++) {
    if (path[i].x !== nc) continue;
    const y = path[i].y;
    if (y < tRow && y > yUpper) { yUpper = y; iMin = i; }
    if (y > tRow && y < yLower) { yLower = y; iMax = i; }
  }
  console.log("■ Step 1: 幾何的ブラケット（列 nc=4 上でターゲット y=5 に最も近い上下）");
  console.log("  上ブラケット（y < 5 で最大）: yUpper=" + yUpper + ", iMin=" + iMin + " → セル " + (iMin >= 0 ? JSON.stringify(path[iMin]) : "なし"));
  console.log("  下ブラケット（y > 5 で最小）: yLower=" + yLower + ", iMax=" + iMax + " → セル " + (iMax >= 0 ? JSON.stringify(path[iMax]) : "なし"));
  console.log("  ターゲット行 5: " + yUpper + " < 5 < " + yLower + " → " + (iMin >= 0 && iMax >= 0 && yUpper < tRow && tRow < yLower ? "✓ 満たす" : "✗ 不成立"));

  let armTop = horizontalScreenArmAtVerticalBracket(path, iMin, nc, true);
  let armBottom = horizontalScreenArmAtVerticalBracket(path, iMax, nc, false);
  console.log("\n■ Step 2: 画面上の水平腕（元パス）");
  console.log("  上ブラケット " + JSON.stringify(path[iMin]) + ": armTop = " + (armTop === 1 ? "R" : armTop === -1 ? "L" : "null"));
  console.log("  下ブラケット " + JSON.stringify(path[iMax]) + ": armBottom = " + (armBottom === 1 ? "R" : armBottom === -1 ? "L" : "null"));
  console.log("  積 armTop×armBottom = " + armTop + "×" + armBottom + " = " + (armTop * armBottom) + "（-1 なら成立）");

  if (armTop * armBottom !== -1) {
    const rev = path.slice().reverse();
    const len = path.length;
    armTop = horizontalScreenArmAtVerticalBracket(rev, len - 1 - iMin, nc, true);
    armBottom = horizontalScreenArmAtVerticalBracket(rev, len - 1 - iMax, nc, false);
    console.log("\n■ Step 2b: パス反転後の水平腕");
    console.log("  armTop = " + (armTop === 1 ? "R" : armTop === -1 ? "L" : "null") + ", armBottom = " + (armBottom === 1 ? "R" : armBottom === -1 ? "L" : "null"));
  }
  const armsOk = armTop != null && armBottom != null && armTop * armBottom === -1;
  console.log("  判定: " + (armsOk ? "✓ 逆向き成立" : "✗ same_horizontal_arm_direction で不成立"));

  console.log("\n■ Step 3: Pseudo（水平方向の引き返し）K=" + K);
  const pseudo1 = verticalPseudoHorizontalKickback(path, nc, iMax, K, true, true, false);
  console.log("  下ブラケット・東隣からの続きで水平 R: " + (pseudo1 ? "✓ 発見 → pseudo 棄却" : "なし"));
  const pseudo2 = verticalPseudoHorizontalKickback(path, nc, iMax, K, false, false, false);
  console.log("  下ブラケット・西隣からの続きで水平 L: " + (pseudo2 ? "✓ 発見 → pseudo 棄却" : "なし"));

  if (pseudo1) {
    console.log("\n  詳細（下・東側）: 下ブラケット " + JSON.stringify(path[iMax]) + " の東隣 = (5,6)");
    console.log("    other = (4,7)、続き: (4,7)→(5,7) が水平 R → pseudo 成立");
  }

  const pseudo = pseudo1 || pseudo2;
  console.log("\n=== 結論 ===");
  if (!armsOk) {
    console.log("  囲い込みは「水平腕が逆向き」を満たさず、カウントされない。");
  } else if (pseudo) {
    console.log("  囲い込みは幾何・腕とも成立するが、pseudo（水平Rの引き返し）により棄却される。");
  } else {
    console.log("  囲い込み成立、カウントされる。");
  }
}

simulate();
