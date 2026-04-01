"use strict";
(() => {
  var __defProp = Object.defineProperty;
  var __defProps = Object.defineProperties;
  var __getOwnPropDescs = Object.getOwnPropertyDescriptors;
  var __getOwnPropSymbols = Object.getOwnPropertySymbols;
  var __hasOwnProp = Object.prototype.hasOwnProperty;
  var __propIsEnum = Object.prototype.propertyIsEnumerable;
  var __defNormalProp = (obj, key2, value) => key2 in obj ? __defProp(obj, key2, { enumerable: true, configurable: true, writable: true, value }) : obj[key2] = value;
  var __spreadValues = (a, b) => {
    for (var prop in b || (b = {}))
      if (__hasOwnProp.call(b, prop))
        __defNormalProp(a, prop, b[prop]);
    if (__getOwnPropSymbols)
      for (var prop of __getOwnPropSymbols(b)) {
        if (__propIsEnum.call(b, prop))
          __defNormalProp(a, prop, b[prop]);
      }
    return a;
  };
  var __spreadProps = (a, b) => __defProps(a, __getOwnPropDescs(b));

  // src/app/lab/reflec-shot/gridTypes.ts
  var DIR = {
    U: { dx: 0, dy: 1 },
    D: { dx: 0, dy: -1 },
    L: { dx: -1, dy: 0 },
    R: { dx: 1, dy: 0 }
  };
  function keyCell(c, r) {
    return `${c},${r}`;
  }
  function dirsEqual(a, b) {
    return a.dx === b.dx && a.dy === b.dy;
  }
  function negateDir(d) {
    return { dx: -d.dx, dy: -d.dy };
  }
  function addCell(a, d) {
    return { c: a.c + d.dx, r: a.r - d.dy };
  }
  function gridDeltaToScreenDir(grid) {
    return { dx: grid.dx, dy: -grid.dy };
  }
  function unitOrthoDirBetween(a, b) {
    const dc = Math.sign(b.c - a.c);
    const dr = Math.sign(b.r - a.r);
    if (dc !== 0 && dr !== 0) return null;
    if (dc === 0 && dr === 0) return null;
    return gridDeltaToScreenDir({ dx: dc, dy: dr });
  }

  // src/app/lab/reflec-shot/bumperRules.ts
  var key = (d) => `${d.dx},${d.dy}`;
  var SLASH_MAP = {
    [key(DIR.U)]: DIR.R,
    [key(DIR.D)]: DIR.L,
    [key(DIR.L)]: DIR.D,
    [key(DIR.R)]: DIR.U
  };
  var BACKSLASH_MAP = {
    [key(DIR.U)]: DIR.L,
    [key(DIR.D)]: DIR.R,
    [key(DIR.L)]: DIR.U,
    [key(DIR.R)]: DIR.D
  };
  var HYPHEN_MAP = {
    [key(DIR.D)]: DIR.U,
    [key(DIR.U)]: DIR.D,
    [key(DIR.L)]: DIR.L,
    [key(DIR.R)]: DIR.R
  };
  var PIPE_MAP = {
    [key(DIR.D)]: DIR.D,
    [key(DIR.U)]: DIR.U,
    [key(DIR.L)]: DIR.R,
    [key(DIR.R)]: DIR.L
  };
  function applyBumper(inDir, kind) {
    var _a, _b, _c, _d;
    const k = key(inDir);
    switch (kind) {
      case "SLASH":
        return (_a = SLASH_MAP[k]) != null ? _a : inDir;
      case "BACKSLASH":
        return (_b = BACKSLASH_MAP[k]) != null ? _b : inDir;
      case "HYPHEN":
        return (_c = HYPHEN_MAP[k]) != null ? _c : inDir;
      case "PIPE":
        return (_d = PIPE_MAP[k]) != null ? _d : inDir;
      default:
        return inDir;
    }
  }
  function diagonalBumperForTurn(dIn, dOut) {
    for (const kind of ["SLASH", "BACKSLASH"]) {
      if (dirsEqual(applyBumper(dIn, kind), dOut)) return kind;
    }
    return null;
  }

  // src/app/lab/reflec-shot/gridStageGen.ts
  function inBounds(c, r, w, h) {
    return c >= 0 && c < w && r >= 0 && r < h;
  }
  function boardSizeForGrade(grade) {
    const g = Math.max(1, Math.min(5, Math.floor(grade)));
    switch (g) {
      case 1:
      case 2:
        return { w: 4, h: 4 };
      case 3:
      case 4:
      case 5:
        return { w: 5, h: 5 };
      default:
        return { w: 5, h: 5 };
    }
  }
  function makeRect(w, h) {
    return Array.from({ length: w }, () => Array(h).fill(true));
  }
  function bottomCandidates(pathable) {
    var _a, _b;
    const w = pathable.length;
    const h = (_b = (_a = pathable[0]) == null ? void 0 : _a.length) != null ? _b : 0;
    let maxR = -1;
    for (let c = 0; c < w; c++) {
      for (let r = 0; r < h; r++) {
        if (pathable[c][r]) maxR = Math.max(maxR, r);
      }
    }
    const out = [];
    for (let c = 0; c < w; c++) {
      if (maxR < 0 || !pathable[c][maxR]) continue;
      if (maxR > 0 && pathable[c][maxR - 1]) out.push({ c, r: maxR });
    }
    return out.length ? out : [];
  }
  function topCandidates(pathable) {
    var _a, _b;
    const w = pathable.length;
    const h = (_b = (_a = pathable[0]) == null ? void 0 : _a.length) != null ? _b : 0;
    let minR = 999;
    for (let c = 0; c < w; c++) {
      for (let r = 0; r < h; r++) {
        if (pathable[c][r]) minR = Math.min(minR, r);
      }
    }
    const out = [];
    for (let c = 0; c < w; c++) {
      if (minR > 900 || !pathable[c][minR]) continue;
      if (minR + 1 < h && pathable[c][minR + 1]) out.push({ c, r: minR });
    }
    return out.length ? out : [];
  }
  function leftEdgeGoalCandidates(pathable) {
    var _a, _b;
    const w = pathable.length;
    const h = (_b = (_a = pathable[0]) == null ? void 0 : _a.length) != null ? _b : 0;
    const out = [];
    if (w < 2) return out;
    for (let r = 0; r < h; r++) {
      if (!pathable[0][r] || !pathable[1][r]) continue;
      out.push({ c: 0, r });
    }
    return out;
  }
  function rightEdgeGoalCandidates(pathable) {
    var _a, _b;
    const w = pathable.length;
    const h = (_b = (_a = pathable[0]) == null ? void 0 : _a.length) != null ? _b : 0;
    const out = [];
    if (w < 2) return out;
    const c = w - 1;
    for (let r = 0; r < h; r++) {
      if (!pathable[c][r] || !pathable[c - 1][r]) continue;
      out.push({ c, r });
    }
    return out;
  }
  function rSecondEdgeGoalPoolAll(pathable) {
    const tops = topCandidates(pathable);
    const lefts = leftEdgeGoalCandidates(pathable);
    const rights = rightEdgeGoalCandidates(pathable);
    const seen = /* @__PURE__ */ new Set();
    const out = [];
    for (const p of [...tops, ...lefts, ...rights]) {
      const k = keyCell(p.c, p.r);
      if (seen.has(k)) continue;
      seen.add(k);
      out.push(p);
    }
    return out;
  }
  function rSecondFeasibleEdgeGoalsForS2(pathable, S2, b2) {
    const pool = rSecondEdgeGoalPoolAll(pathable);
    return pool.filter(
      (g) => [true, false].some((fh) => !orthoPolylineSplitImpossible(S2, g, b2, fh))
    );
  }
  function rSecondExitLegHardViolation(prefixPath, seg2, pathable, w, h) {
    const prefixKeys = new Set(prefixPath.map((p) => keyCell(p.c, p.r)));
    const bendKeys = new Set(
      bendVertexIndices(prefixPath).map((i) => keyCell(prefixPath[i].c, prefixPath[i].r))
    );
    for (let i = 0; i < seg2.length; i++) {
      const p = seg2[i];
      if (!inBounds(p.c, p.r, w, h) || !pathable[p.c][p.r]) return true;
      if (p.r > h - 1 || p.r < 0 || p.c < 0 || p.c > w - 1) return true;
      const k = keyCell(p.c, p.r);
      if (prefixKeys.has(k)) return true;
      if (i >= 1 && bendKeys.has(k)) return true;
    }
    return false;
  }
  function rSecondGoalOnTopLeftOrRightEdge(goal, w, h) {
    return goal.r === 0 || goal.c === 0 || goal.c === w - 1;
  }
  function createStageRng(seed) {
    let s = seed >>> 0;
    return () => {
      s = s * 1664525 + 1013904223 >>> 0;
      return s / 4294967296;
    };
  }
  function minOrthoBends(a, b) {
    if (a.c === b.c && a.r === b.r) return 0;
    if (a.c === b.c || a.r === b.r) return 0;
    return 1;
  }
  function orthoPolylineSplitImpossible(start, goal, bends, firstHorizontal) {
    if (bends < minOrthoBends(start, goal)) return true;
    const dc = goal.c - start.c;
    const dr = goal.r - start.r;
    const nSeg = bends + 1;
    let hCount = 0;
    let vCount = 0;
    for (let i = 0; i < nSeg; i++) {
      const isH = firstHorizontal ? i % 2 === 0 : i % 2 === 1;
      if (isH) hCount++;
      else vCount++;
    }
    if (hCount === 0 && dc !== 0) return true;
    if (vCount === 0 && dr !== 0) return true;
    if (hCount === 1 && dc === 0) return true;
    if (vCount === 1 && dr === 0) return true;
    return false;
  }
  function randomNonZeroSplit(target, parts, rng, maxAttempts = 120) {
    if (parts === 0) return target === 0 ? [] : null;
    if (parts === 1) return target !== 0 ? [target] : null;
    for (let attempt = 0; attempt < maxAttempts; attempt++) {
      const a = [];
      let s = 0;
      for (let i = 0; i < parts - 1; i++) {
        const sign = rng() < 0.5 ? -1 : 1;
        const mag = 1 + Math.floor(rng() * 10);
        const v = sign * mag;
        a.push(v);
        s += v;
      }
      const last = target - s;
      if (last !== 0 && Math.abs(last) >= 1) {
        a.push(last);
        return a;
      }
    }
    return null;
  }
  function listNonZeroSplitsCapped(target, parts, bound, cap) {
    const acc = [];
    const rec = (rem, k, prefix) => {
      if (acc.length >= cap) return;
      if (k === 0) {
        if (rem === 0) acc.push([...prefix]);
        return;
      }
      if (k === 1) {
        if (rem !== 0 && Math.abs(rem) <= bound) acc.push([...prefix, rem]);
        return;
      }
      for (let v = -bound; v <= bound; v++) {
        if (v === 0 || acc.length >= cap) continue;
        prefix.push(v);
        rec(rem - v, k - 1, prefix);
        prefix.pop();
      }
    };
    rec(target, parts, []);
    return acc.length ? acc : null;
  }
  function shuffleArrayInPlace(arr, rng) {
    for (let i = arr.length - 1; i > 0; i--) {
      const j = Math.floor(rng() * (i + 1));
      const t = arr[i];
      arr[i] = arr[j];
      arr[j] = t;
    }
  }
  function orthoReachableInPathable(pathable, w, h, start, goal, maxDepth) {
    if (start.c === goal.c && start.r === goal.r) return true;
    const seen = /* @__PURE__ */ new Set();
    const q = [{ c: start.c, r: start.r, d: 0 }];
    seen.add(keyCell(start.c, start.r));
    let qi = 0;
    while (qi < q.length) {
      const u = q[qi++];
      if (u.c === goal.c && u.r === goal.r) return true;
      if (u.d >= maxDepth) continue;
      for (const dir of [DIR.U, DIR.D, DIR.L, DIR.R]) {
        const v = addCell({ c: u.c, r: u.r }, dir);
        if (!inBounds(v.c, v.r, w, h) || !pathable[v.c][v.r]) continue;
        const vk = keyCell(v.c, v.r);
        if (seen.has(vk)) continue;
        seen.add(vk);
        q.push({ c: v.c, r: v.r, d: u.d + 1 });
      }
    }
    return false;
  }
  function dirKeyShort(d) {
    if (dirsEqual(d, DIR.U)) return "U";
    if (dirsEqual(d, DIR.D)) return "D";
    if (dirsEqual(d, DIR.L)) return "L";
    return "R";
  }
  function walkOrthogonalFromLens(start, goal, lens, firstHorizontal, pathable, w, h) {
    const nSeg = lens.length;
    const path = [];
    let cur = __spreadValues({}, start);
    path.push(cur);
    for (let i = 0; i < nSeg; i++) {
      const isH = firstHorizontal ? i % 2 === 0 : i % 2 === 1;
      let d;
      if (isH) d = lens[i] > 0 ? DIR.R : DIR.L;
      else d = lens[i] > 0 ? DIR.D : DIR.U;
      const steps = Math.abs(lens[i]);
      for (let s = 0; s < steps; s++) {
        cur = addCell(cur, d);
        if (!inBounds(cur.c, cur.r, w, h) || !pathable[cur.c][cur.r]) return null;
        path.push(cur);
      }
    }
    if (cur.c !== goal.c || cur.r !== goal.r) return null;
    return path;
  }
  function pathFirstStepMatchesForcedSecond(path, forcedSecond) {
    if (!forcedSecond) return true;
    if (path.length < 2) return false;
    const q = forcedSecond;
    return path[1].c === q.c && path[1].r === q.r;
  }
  function tryOrthogonalPolylineRFirst(start, goal, bends, firstHorizontal, pathable, rng, ctx, opts) {
    const w = pathable.length;
    const h = pathable[0].length;
    if (orthoPolylineSplitImpossible(start, goal, bends, firstHorizontal)) return null;
    const manhattan = Math.abs(goal.c - start.c) + Math.abs(goal.r - start.r);
    const maxDepth = manhattan + bends * 2 + 4;
    if (!orthoReachableInPathable(pathable, w, h, start, goal, maxDepth)) {
      ctx.bfsPruned++;
      return null;
    }
    const nSeg = bends + 1;
    const dc = goal.c - start.c;
    const dr = goal.r - start.r;
    const hIdx = [];
    const vIdx = [];
    for (let i = 0; i < nSeg; i++) {
      const isH = firstHorizontal ? i % 2 === 0 : i % 2 === 1;
      if (isH) hIdx.push(i);
      else vIdx.push(i);
    }
    const tryEnumerate = w <= 6 && h <= 6 && bends <= 4 && (() => {
      const hsList = listNonZeroSplitsCapped(dc, hIdx.length, 8, 120);
      const vsList = listNonZeroSplitsCapped(dr, vIdx.length, 8, 120);
      if (!hsList || !vsList) return null;
      if (hsList.length * vsList.length > 350) return null;
      const pairs = [];
      for (const hs2 of hsList) {
        for (const vs2 of vsList) {
          pairs.push([hs2, vs2]);
        }
      }
      shuffleArrayInPlace(pairs, rng);
      for (const [hs2, vs2] of pairs) {
        if (ctx.polyBudget <= 0) {
          ctx.budgetHit = true;
          return null;
        }
        ctx.polyBudget--;
        ctx.polyCalls++;
        const lens2 = new Array(nSeg);
        hIdx.forEach((idx, j) => {
          lens2[idx] = hs2[j];
        });
        vIdx.forEach((idx, j) => {
          lens2[idx] = vs2[j];
        });
        const path2 = walkOrthogonalFromLens(start, goal, lens2, firstHorizontal, pathable, w, h);
        if (path2 && pathFirstStepMatchesForcedSecond(path2, opts == null ? void 0 : opts.forcedSecond)) return path2;
      }
      return null;
    })();
    if (tryEnumerate && pathFirstStepMatchesForcedSecond(tryEnumerate, opts == null ? void 0 : opts.forcedSecond)) return tryEnumerate;
    if (ctx.polyBudget <= 0) {
      ctx.budgetHit = true;
      return null;
    }
    ctx.polyBudget--;
    ctx.polyCalls++;
    const hs = randomNonZeroSplit(dc, hIdx.length, rng, 44);
    const vs = randomNonZeroSplit(dr, vIdx.length, rng, 44);
    if (!hs || !vs) return null;
    const lens = new Array(nSeg);
    hIdx.forEach((idx, j) => {
      lens[idx] = hs[j];
    });
    vIdx.forEach((idx, j) => {
      lens[idx] = vs[j];
    });
    const path = walkOrthogonalFromLens(start, goal, lens, firstHorizontal, pathable, w, h);
    if (!path || !pathFirstStepMatchesForcedSecond(path, opts == null ? void 0 : opts.forcedSecond)) return null;
    return path;
  }
  function tryOrthogonalRSecondLegFromR(R, armTip, goal, b, pathable, rng, ctx, nextAttempts) {
    const manRArm = Math.abs(armTip.c - R.c) + Math.abs(armTip.r - R.r);
    if (manRArm !== 1) return null;
    let firstHArm = rng() < 0.5;
    if (orthoPolylineSplitImpossible(armTip, goal, b, firstHArm)) firstHArm = !firstHArm;
    if (orthoPolylineSplitImpossible(armTip, goal, b, firstHArm)) return null;
    for (const forcedSecond of nextAttempts) {
      const tailPath = tryOrthogonalPolylineRFirst(
        armTip,
        goal,
        b,
        firstHArm,
        pathable,
        rng,
        ctx,
        forcedSecond !== void 0 ? { forcedSecond } : void 0
      );
      if (ctx.budgetHit) return null;
      if (!tailPath || tailPath.length < 1) continue;
      if (tailPath[0].c !== armTip.c || tailPath[0].r !== armTip.r) continue;
      const full = [R, ...tailPath];
      if (full.length < 2 || full[1].c !== armTip.c || full[1].r !== armTip.r) continue;
      return full;
    }
    return null;
  }
  function unitStepDir(deltaC, deltaR) {
    if (!(Math.abs(deltaC) === 1 && deltaR === 0 || deltaC === 0 && Math.abs(deltaR) === 1)) return null;
    return gridDeltaToScreenDir({ dx: deltaC, dy: deltaR });
  }
  function orthogonalDirs(a, b) {
    return a.dx * b.dx + a.dy * b.dy === 0 && a.dx * a.dx + a.dy * a.dy === 1 && b.dx * b.dx + b.dy * b.dy === 1;
  }
  function interiorPassageKind(path, i) {
    if (i <= 0 || i >= path.length - 1) return "invalid";
    const d0 = unitStepDir(path[i].c - path[i - 1].c, path[i].r - path[i - 1].r);
    const d1 = unitStepDir(path[i + 1].c - path[i].c, path[i + 1].r - path[i].r);
    if (!d0 || !d1) return "invalid";
    if (orthogonalDirs(d0, d1)) return "bend";
    if (d0.dx === 0 && d1.dx === 0) return "vertical";
    if (d0.dy === 0 && d1.dy === 0) return "horizontal";
    return "invalid";
  }
  function pathHasOrthogonalCrossCell(path) {
    var _a, _b;
    if (path.length < 3) return false;
    const visitCount = /* @__PURE__ */ new Map();
    for (const p of path) {
      const k = keyCell(p.c, p.r);
      visitCount.set(k, ((_a = visitCount.get(k)) != null ? _a : 0) + 1);
    }
    const acc = /* @__PURE__ */ new Map();
    for (let i = 1; i <= path.length - 2; i++) {
      const k = keyCell(path[i].c, path[i].r);
      const kind = interiorPassageKind(path, i);
      let r = acc.get(k);
      if (!r) {
        r = { horizontal: false, vertical: false, hasBendOrInvalid: false };
        acc.set(k, r);
      }
      if (kind === "bend" || kind === "invalid") r.hasBendOrInvalid = true;
      if (kind === "horizontal") r.horizontal = true;
      if (kind === "vertical") r.vertical = true;
    }
    for (const [k, r] of Array.from(acc.entries())) {
      if (((_b = visitCount.get(k)) != null ? _b : 0) < 2) continue;
      if (r.hasBendOrInvalid) continue;
      if (r.horizontal && r.vertical) return true;
    }
    return false;
  }
  function bendCellsInPath(path) {
    const s = /* @__PURE__ */ new Set();
    for (let i = 1; i < path.length - 1; i++) {
      const d0 = unitStepDir(path[i].c - path[i - 1].c, path[i].r - path[i - 1].r);
      const d1 = unitStepDir(path[i + 1].c - path[i].c, path[i + 1].r - path[i].r);
      if (d0 && d1 && orthogonalDirs(d0, d1)) s.add(keyCell(path[i].c, path[i].r));
    }
    return s;
  }
  function pathFirstStepDir(path) {
    if (path.length < 2) return null;
    return unitStepDir(path[1].c - path[0].c, path[1].r - path[0].r);
  }
  function isStrictlyOutsideBoard(c, r, w, h) {
    return c < 0 || c >= w || r < 0 || r >= h;
  }
  function applyQuarterCCWPathable(pathable, path, w, h) {
    const nw = h;
    const nh = w;
    const newPath = path.map(({ c, r }) => ({ c: r, r: w - 1 - c }));
    const newPathable = Array.from({ length: nw }, () => Array(nh).fill(false));
    for (let c = 0; c < w; c++) {
      for (let r = 0; r < h; r++) {
        newPathable[r][w - 1 - c] = pathable[c][r];
      }
    }
    return { path: newPath, pathable: newPathable, w: nw, h: nh };
  }
  function transformCellByKQuarters(cell, k, w0, h0) {
    let c = cell.c;
    let r = cell.r;
    let w = w0;
    let h = h0;
    for (let i = 0; i < k; i++) {
      const nc = r;
      const nr = w - 1 - c;
      c = nc;
      r = nr;
      const nw = h;
      const nh = w;
      w = nw;
      h = nh;
    }
    return { c, r };
  }
  function grade1NoRevisit(path) {
    const seen = /* @__PURE__ */ new Set();
    for (const p of path) {
      const k = keyCell(p.c, p.r);
      if (seen.has(k)) return false;
      seen.add(k);
    }
    return true;
  }
  function grade2BendNoRevisit(path, bends) {
    var _a;
    const counts = /* @__PURE__ */ new Map();
    for (const p of path) {
      const k = keyCell(p.c, p.r);
      counts.set(k, ((_a = counts.get(k)) != null ? _a : 0) + 1);
    }
    let bad = false;
    counts.forEach((n, k) => {
      if (bends.has(k) && n !== 1) bad = true;
    });
    return !bad;
  }
  function grade3RevisitOneCellRule(path, opts) {
    if (path.length < 4) return false;
    const keyToIndices = /* @__PURE__ */ new Map();
    path.forEach((p, i) => {
      const k = keyCell(p.c, p.r);
      let arr = keyToIndices.get(k);
      if (!arr) {
        arr = [];
        keyToIndices.set(k, arr);
      }
      arr.push(i);
    });
    let doubleKey = null;
    for (const [k, arr] of Array.from(keyToIndices.entries())) {
      if (arr.length === 2) {
        if (doubleKey !== null) return false;
        doubleKey = k;
      } else if (arr.length !== 1) return false;
    }
    if (!doubleKey) return false;
    const pair = keyToIndices.get(doubleKey);
    const i0 = Math.min(pair[0], pair[1]);
    const i1 = Math.max(pair[0], pair[1]);
    if (i1 >= path.length - 1) return false;
    if (i0 === 0) {
      if (!(opts == null ? void 0 : opts.implicitBeforeFirstR)) return false;
    } else if (i0 <= 0) return false;
    const bendAtFirst = i0 === 0 ? (() => {
      const p0 = path[i0];
      const prev = opts.implicitBeforeFirstR;
      const d0 = unitStepDir(p0.c - prev.c, p0.r - prev.r);
      const d1 = unitStepDir(path[i0 + 1].c - p0.c, path[i0 + 1].r - p0.r);
      if (!d0 || !d1) return false;
      return orthogonalDirs(d0, d1);
    })() : interiorPassageKind(path, i0) === "bend";
    if (!bendAtFirst) return false;
    if (interiorPassageKind(path, i1) !== "bend") return false;
    const cellBeforeFirst = i0 === 0 ? opts.implicitBeforeFirstR : path[i0 - 1];
    const dIn1 = unitStepDir(path[i0].c - cellBeforeFirst.c, path[i0].r - cellBeforeFirst.r);
    const dOut1 = unitStepDir(path[i0 + 1].c - path[i0].c, path[i0 + 1].r - path[i0].r);
    const dIn2 = unitStepDir(path[i1].c - path[i1 - 1].c, path[i1].r - path[i1 - 1].r);
    if (!dIn1 || !dOut1 || !dIn2) return false;
    const okIn2 = dirsEqual(dIn2, negateDir(dIn1)) || dirsEqual(dIn2, dOut1);
    if (!okIn2) return false;
    const nb = (p) => keyCell(p.c, p.r);
    const neigh = /* @__PURE__ */ new Set([
      nb(cellBeforeFirst),
      nb(path[i0 + 1]),
      nb(path[i1 - 1]),
      nb(path[i1 + 1])
    ]);
    if (neigh.size !== 4) return false;
    return true;
  }
  function tryConstructGrade3Path(pathable, start, goal, rng) {
    const w = pathable.length;
    const h = pathable[0].length;
    const invEnter = (R, dIn) => ({
      c: R.c - dIn.dx,
      r: R.r + dIn.dy
    });
    const step = (from, d) => addCell(from, d);
    const tryRLimit = w <= 5 && h <= 5 ? 55 : 40;
    for (let tryR = 0; tryR < tryRLimit; tryR++) {
      const rc = 1 + Math.floor(rng() * Math.max(1, w - 2));
      const rr = 1 + Math.floor(rng() * Math.max(1, h - 2));
      const R = { c: rc, r: rr };
      if (!pathable[rc][rr]) continue;
      const dirOrder = [DIR.U, DIR.D, DIR.L, DIR.R].sort(() => rng() - 0.5);
      for (const dIn1 of dirOrder) {
        const outs = [DIR.U, DIR.D, DIR.L, DIR.R].filter((d) => orthogonalDirs(dIn1, d)).sort(() => rng() - 0.5);
        for (const dOut1 of outs) {
          const sol = diagonalBumperForTurn(dIn1, dOut1);
          if (!sol) continue;
          const dIn2opts = [negateDir(dIn1), dOut1];
          for (let oi = 0; oi < dIn2opts.length; oi++) {
            const dIn2 = dIn2opts[oi];
            if (oi > 0 && dirsEqual(dIn2, dIn2opts[0])) continue;
            const dOut2 = applyBumper(dIn2, sol);
            if (!orthogonalDirs(dIn2, dOut2)) continue;
            const P1 = invEnter(R, dIn1);
            const S1 = step(R, dOut1);
            const P2 = invEnter(R, dIn2);
            const S2 = step(R, dOut2);
            const pts = [P1, S1, P2, S2];
            let okPts = true;
            for (const q of pts) {
              if (!inBounds(q.c, q.r, w, h) || !pathable[q.c][q.r]) {
                okPts = false;
                break;
              }
            }
            if (!okPts) continue;
            const nset = new Set(pts.map((q) => keyCell(q.c, q.r)));
            if (nset.size !== 4) continue;
            const splits = [];
            for (let a = 0; a <= 4; a++) {
              for (let b = 0; b <= 4 - a; b++) {
                splits.push([a, b, 4 - a - b]);
              }
            }
            for (let si = splits.length - 1; si > 0; si--) {
              const j = Math.floor(rng() * (si + 1));
              const tmp = splits[si];
              splits[si] = splits[j];
              splits[j] = tmp;
            }
            for (let t = 0; t < 8; t++) {
              const firstH = rng() < 0.5;
              for (const [b0, b1, b2] of splits) {
                const seg0 = tryOrthogonalPolyline(start, P1, b0, firstH, pathable, rng);
                if (!seg0) continue;
                const seg1 = tryOrthogonalPolyline(S1, P2, b1, rng() < 0.5, pathable, rng);
                if (!seg1) continue;
                const seg2 = tryOrthogonalPolyline(S2, goal, b2, rng() < 0.5, pathable, rng);
                if (!seg2) continue;
                const path = [...seg0, R, ...seg1, R, ...seg2];
                if (countRightAngles(path) !== 6) continue;
                if (!grade3RevisitOneCellRule(path)) continue;
                return path;
              }
            }
          }
        }
      }
    }
    return null;
  }
  function findGrade3SixBendPath(pathable, start, goal, rng) {
    return tryConstructGrade3Path(pathable, start, goal, rng);
  }
  function tryConstructGrade3PathRFirstN1(pathable, goal, rng, bench) {
    var _a;
    const w = pathable.length;
    const h = pathable[0].length;
    const invEnter = (Rcell, dIn) => ({
      c: Rcell.c - dIn.dx,
      r: Rcell.r + dIn.dy
    });
    const step = (from, d) => addCell(from, d);
    const bottoms = bottomCandidates(pathable);
    if (!bottoms.length) return null;
    const splitsAll = [];
    for (let a = 0; a <= 4; a++) {
      for (let b = 0; b <= 4 - a; b++) {
        splitsAll.push([a, b, 4 - a - b]);
      }
    }
    const shuffleSplitsPreferLowMax = (arr, start, p1, s1, p2, s2, g, onBottomRow) => {
      const copy = [...arr];
      copy.sort((u, v) => {
        const mu = Math.max(u[0], u[1], u[2]);
        const mv = Math.max(v[0], v[1], v[2]);
        if (mu !== mv) return mu - mv;
        const du = Math.abs(u[1] - minOrthoBends(s1, p2)) + Math.abs(u[2] - minOrthoBends(s2, g)) + (onBottomRow ? 0 : Math.abs(u[0] - minOrthoBends(start, p1)));
        const dv = Math.abs(v[1] - minOrthoBends(s1, p2)) + Math.abs(v[2] - minOrthoBends(s2, g)) + (onBottomRow ? 0 : Math.abs(v[0] - minOrthoBends(start, p1)));
        if (du !== dv) return du - dv;
        return u[0] + u[1] + u[2] - (v[0] + v[1] + v[2]);
      });
      for (let si = copy.length - 1; si > 0; si--) {
        const j = Math.floor(rng() * (si + 1));
        const tmp = copy[si];
        copy[si] = copy[j];
        copy[j] = tmp;
      }
      return copy;
    };
    const ctx = {
      polyBudget: 12e3,
      polyCalls: 0,
      bfsPruned: 0,
      budgetHit: false
    };
    const failedCombo = /* @__PURE__ */ new Set();
    const writeBench = (lastTryR) => {
      if (!bench) return;
      bench.rFirstPolyCalls = ctx.polyCalls;
      bench.rFirstBfsPruned = ctx.bfsPruned;
      bench.rFirstBudgetExhausted = ctx.budgetHit ? 1 : 0;
      bench.rFirstLastTryR = lastTryR;
    };
    const tryRLimit = w <= 5 && h <= 5 ? 55 : 40;
    let lastTryRAt = -1;
    outerR: for (let tryR = 0; tryR < tryRLimit; tryR++) {
      lastTryRAt = tryR;
      if (ctx.budgetHit) break;
      const rc = 1 + Math.floor(rng() * Math.max(1, w - 2));
      const rr = 1 + Math.floor(rng() * Math.max(1, h - 2));
      const R = { c: rc, r: rr };
      if (!pathable[rc][rr]) continue;
      const onBottomRow = rr === h - 1;
      const dirOrder = [DIR.U, DIR.D, DIR.L, DIR.R].sort(() => rng() - 0.5);
      for (const dIn1 of dirOrder) {
        if (ctx.budgetHit) break outerR;
        if (onBottomRow && !dirsEqual(dIn1, DIR.U)) continue;
        const outs = [DIR.U, DIR.D, DIR.L, DIR.R].filter((d) => orthogonalDirs(dIn1, d)).sort(() => rng() - 0.5);
        for (const dOut1 of outs) {
          if (ctx.budgetHit) break outerR;
          const sol = diagonalBumperForTurn(dIn1, dOut1);
          if (!sol) continue;
          const dIn2opts = [negateDir(dIn1), dOut1];
          for (let oi = 0; oi < dIn2opts.length; oi++) {
            if (ctx.budgetHit) break outerR;
            const dIn2 = dIn2opts[oi];
            if (oi > 0 && dirsEqual(dIn2, dIn2opts[0])) continue;
            const dOut2 = applyBumper(dIn2, sol);
            if (!orthogonalDirs(dIn2, dOut2)) continue;
            const P1 = invEnter(R, dIn1);
            const S1 = step(R, dOut1);
            const P2 = invEnter(R, dIn2);
            const S2 = step(R, dOut2);
            if (onBottomRow) {
              if (inBounds(P1.c, P1.r, w, h)) continue;
            } else if (!inBounds(P1.c, P1.r, w, h) || !pathable[P1.c][P1.r]) continue;
            let okPts = true;
            for (const q of [S1, P2, S2]) {
              if (!inBounds(q.c, q.r, w, h) || !pathable[q.c][q.r]) {
                okPts = false;
                break;
              }
            }
            if (!okPts) continue;
            const nset = new Set([P1, S1, P2, S2].map((q) => keyCell(q.c, q.r)));
            if (nset.size !== 4) continue;
            const comboKey = `${rc},${rr}|${dirKeyShort(dIn1)}|${dirKeyShort(dOut1)}|${oi}`;
            if (failedCombo.has(comboKey)) {
              if (bench) bench.rFirstComboCacheSkips = ((_a = bench.rFirstComboCacheSkips) != null ? _a : 0) + 1;
              continue;
            }
            const startPool = onBottomRow ? [R] : bottoms;
            const startOrder = [...startPool].sort(() => rng() - 0.5);
            for (const start of startOrder) {
              if (ctx.budgetHit) break outerR;
              if (!onBottomRow && start.c === R.c && start.r === R.r) continue;
              const splitsBase = onBottomRow ? splitsAll.filter(([b0]) => b0 === 0) : splitsAll;
              if (!splitsBase.length) continue;
              const splits = shuffleSplitsPreferLowMax(
                splitsBase,
                start,
                P1,
                S1,
                P2,
                S2,
                goal,
                onBottomRow
              );
              for (let pass = 0; pass < 6; pass++) {
                if (ctx.budgetHit) break outerR;
                const firstH0 = pass % 2 === 0;
                for (const [b0, b1, b2] of splits) {
                  if (ctx.budgetHit) break outerR;
                  let seg0 = null;
                  if (onBottomRow) {
                    if (b0 !== 0) continue;
                  } else {
                    if (orthoPolylineSplitImpossible(start, P1, b0, firstH0)) continue;
                    seg0 = tryOrthogonalPolylineRFirst(start, P1, b0, firstH0, pathable, rng, ctx);
                    if (ctx.budgetHit) break outerR;
                    if (!seg0) continue;
                  }
                  let firstH1 = rng() < 0.5;
                  if (orthoPolylineSplitImpossible(S1, P2, b1, firstH1)) firstH1 = !firstH1;
                  if (orthoPolylineSplitImpossible(S1, P2, b1, firstH1)) continue;
                  let firstH2 = rng() < 0.5;
                  if (orthoPolylineSplitImpossible(S2, goal, b2, firstH2)) firstH2 = !firstH2;
                  if (orthoPolylineSplitImpossible(S2, goal, b2, firstH2)) continue;
                  const seg1 = tryOrthogonalPolylineRFirst(S1, P2, b1, firstH1, pathable, rng, ctx);
                  if (ctx.budgetHit) break outerR;
                  if (!seg1) continue;
                  const seg2 = tryOrthogonalPolylineRFirst(S2, goal, b2, firstH2, pathable, rng, ctx);
                  if (ctx.budgetHit) break outerR;
                  if (!seg2) continue;
                  let path;
                  if (onBottomRow) path = [R, ...seg1, R, ...seg2];
                  else {
                    if (!seg0) continue;
                    path = [...seg0, R, ...seg1, R, ...seg2];
                  }
                  if (countRightAngles(path) !== 6) continue;
                  if (!grade3RevisitOneCellRule(path, onBottomRow ? { implicitBeforeFirstR: P1 } : void 0))
                    continue;
                  writeBench(tryR);
                  return { path, start: onBottomRow ? R : start };
                }
              }
            }
            if (!ctx.budgetHit) failedCombo.add(comboKey);
          }
        }
      }
    }
    writeBench(Math.max(0, lastTryRAt));
    return null;
  }
  function rSecondPairMidBendsOk(b1, dOut1, dIn2) {
    if (dirsEqual(dOut1, dIn2)) return b1 >= 2 && b1 % 2 === 0;
    if (dirsEqual(dOut1, negateDir(dIn2))) return b1 >= 4 && b1 % 2 === 0;
    if (orthogonalDirs(dOut1, dIn2)) return b1 >= 3 && b1 % 2 === 1;
    return false;
  }
  function rSecondArmTipNextAttempts(armTip, R, dAlongFromR, pathable, w, h, rng) {
    const neighbors = [DIR.U, DIR.D, DIR.L, DIR.R].map((d) => addCell(armTip, d)).filter(
      (q) => inBounds(q.c, q.r, w, h) && pathable[q.c][q.r] && !(q.c === R.c && q.r === R.r)
    );
    const perp = neighbors.filter((q) => {
      const d = unitStepDir(q.c - armTip.c, q.r - armTip.r);
      return d && orthogonalDirs(d, dAlongFromR);
    });
    const forward = neighbors.filter((q) => {
      const d = unitStepDir(q.c - armTip.c, q.r - armTip.r);
      return d && dirsEqual(d, dAlongFromR);
    });
    shuffleArrayInPlace(perp, rng);
    shuffleArrayInPlace(forward, rng);
    return [...perp, ...forward, void 0];
  }
  function tryConstructGrade3PathRSecondN1(pathable, rng, bench, trace) {
    var _a;
    const w = pathable.length;
    const h = pathable[0].length;
    const invEnter = (Rcell, dIn) => ({
      c: Rcell.c - dIn.dx,
      r: Rcell.r + dIn.dy
    });
    const step = (from, d) => addCell(from, d);
    const bottoms = bottomCandidates(pathable);
    if (!bottoms.length) return null;
    const splitsAll = [];
    for (let a = 0; a <= 4; a++) {
      for (let b = 0; b <= 4 - a; b++) {
        splitsAll.push([a, b, 4 - a - b]);
      }
    }
    const ctx = {
      polyBudget: 12e3,
      polyCalls: 0,
      bfsPruned: 0,
      budgetHit: false
    };
    const failedCombo = /* @__PURE__ */ new Set();
    const writeBench = (lastTryR) => {
      if (!bench) return;
      bench.rFirstPolyCalls = ctx.polyCalls;
      bench.rFirstBfsPruned = ctx.bfsPruned;
      bench.rFirstBudgetExhausted = ctx.budgetHit ? 1 : 0;
      bench.rFirstLastTryR = lastTryR;
    };
    const tryRLimit = w <= 5 && h <= 5 ? 55 : 40;
    let lastTryRAt = -1;
    outerR: for (let tryR = 0; tryR < tryRLimit; tryR++) {
      lastTryRAt = tryR;
      if (ctx.budgetHit) break;
      const rc = 1 + Math.floor(rng() * Math.max(1, w - 2));
      const rr = 1 + Math.floor(rng() * Math.max(1, h - 2));
      const R = { c: rc, r: rr };
      if (!pathable[rc][rr]) continue;
      const onBottomRow = rr === h - 1;
      const dirOrder = [DIR.U, DIR.D, DIR.L, DIR.R].sort(() => rng() - 0.5);
      for (const dIn1 of dirOrder) {
        if (ctx.budgetHit) break outerR;
        if (onBottomRow && !dirsEqual(dIn1, DIR.U)) continue;
        const outs = [DIR.U, DIR.D, DIR.L, DIR.R].filter((d) => orthogonalDirs(dIn1, d)).sort(() => rng() - 0.5);
        for (const dOut1 of outs) {
          if (ctx.budgetHit) break outerR;
          const sol = diagonalBumperForTurn(dIn1, dOut1);
          if (!sol) continue;
          const dIn2opts = [negateDir(dIn1), dOut1];
          const oiOrder = rng() < 0.5 ? [0, 1] : [1, 0];
          for (const oi of oiOrder) {
            if (ctx.budgetHit) break outerR;
            const dIn2 = dIn2opts[oi];
            if (oi > 0 && dirsEqual(dIn2, dIn2opts[0])) continue;
            const dOut2 = applyBumper(dIn2, sol);
            if (!orthogonalDirs(dIn2, dOut2)) continue;
            const P1 = invEnter(R, dIn1);
            const S1 = step(R, dOut1);
            const P2 = invEnter(R, dIn2);
            const S2 = step(R, dOut2);
            if (onBottomRow) {
              if (inBounds(P1.c, P1.r, w, h)) continue;
            } else if (!inBounds(P1.c, P1.r, w, h) || !pathable[P1.c][P1.r]) continue;
            let okPts = true;
            for (const q of [S1, P2, S2]) {
              if (!inBounds(q.c, q.r, w, h) || !pathable[q.c][q.r]) {
                okPts = false;
                break;
              }
            }
            if (!okPts) continue;
            const nset = new Set([P1, S1, P2, S2].map((q) => keyCell(q.c, q.r)));
            if (nset.size !== 4) continue;
            const comboKey = `${rc},${rr}|${dirKeyShort(dIn1)}|${dirKeyShort(dOut1)}|${oi}`;
            if (failedCombo.has(comboKey)) {
              if (bench) bench.rFirstComboCacheSkips = ((_a = bench.rFirstComboCacheSkips) != null ? _a : 0) + 1;
              continue;
            }
            const splitsValid = splitsAll.filter(([b0, b1, b2]) => {
              if (b0 + b1 + b2 !== 4) return false;
              return rSecondPairMidBendsOk(b1, dOut1, dIn2);
            });
            if (!splitsValid.length) continue;
            const splits = [...splitsValid];
            shuffleArrayInPlace(splits, rng);
            const startPool = onBottomRow ? [R] : bottoms;
            const startOrder = [...startPool].sort(() => rng() - 0.5);
            for (const start of startOrder) {
              if (ctx.budgetHit) break outerR;
              if (!onBottomRow && start.c === R.c && start.r === R.r) continue;
              const splitsBase = onBottomRow ? splits.filter(([b0]) => b0 === 0) : splits;
              if (!splitsBase.length) continue;
              for (let pass = 0; pass < 6; pass++) {
                if (ctx.budgetHit) break outerR;
                const firstH0 = pass % 2 === 0;
                for (const [b0, b1, b2] of splitsBase) {
                  if (ctx.budgetHit) break outerR;
                  let seg0 = null;
                  if (onBottomRow) {
                    if (b0 !== 0) continue;
                  } else {
                    if (orthoPolylineSplitImpossible(start, P1, b0, firstH0)) continue;
                    seg0 = tryOrthogonalPolylineRFirst(start, P1, b0, firstH0, pathable, rng, ctx);
                    if (ctx.budgetHit) break outerR;
                    if (!seg0) continue;
                  }
                  let okLeg1 = false;
                  for (const fh of [true, false]) {
                    if (!orthoPolylineSplitImpossible(S1, P2, b1, fh)) {
                      okLeg1 = true;
                      break;
                    }
                  }
                  if (!okLeg1) continue;
                  const nextAttempts1 = rSecondArmTipNextAttempts(S1, R, dOut1, pathable, w, h, rng);
                  const seg1u = tryOrthogonalRSecondLegFromR(
                    R,
                    S1,
                    P2,
                    b1,
                    pathable,
                    rng,
                    ctx,
                    nextAttempts1
                  );
                  if (ctx.budgetHit) break outerR;
                  if (!seg1u) continue;
                  const seg1 = seg1u.slice(1);
                  const prefixPathCanonical = onBottomRow ? [R, ...seg1, R] : [...seg0, R, ...seg1, R];
                  const boardW = w;
                  const boardH = h;
                  const ks = [0, 1, 2, 3].sort(() => rng() - 0.5);
                  let orientSnap = null;
                  orientK: for (const k of ks) {
                    let pb = pathable.map((col) => [...col]);
                    let pref = prefixPathCanonical.map((x) => __spreadValues({}, x));
                    let pw = boardW;
                    let ph = boardH;
                    for (let i = 0; i < k; i++) {
                      const nx = applyQuarterCCWPathable(pb, pref, pw, ph);
                      pb = nx.pathable;
                      pref = nx.path;
                      pw = nx.w;
                      ph = nx.h;
                    }
                    const fsK = pathFirstStepDir(pref);
                    if (!fsK || !dirsEqual(fsK, DIR.U)) continue orientK;
                    const Rt = pref[pref.length - 1];
                    const S2t = transformCellByKQuarters(S2, k, boardW, boardH);
                    const dArm = unitStepDir(S2t.c - Rt.c, S2t.r - Rt.r);
                    if (!dArm) continue orientK;
                    const edgeGoals = rSecondFeasibleEdgeGoalsForS2(pb, S2t, b2);
                    if (!edgeGoals.length) continue orientK;
                    const edgeOrder = [...edgeGoals];
                    shuffleArrayInPlace(edgeOrder, rng);
                    const nextAttempts2 = rSecondArmTipNextAttempts(S2t, Rt, dArm, pb, pw, ph, rng);
                    for (const gCell of edgeOrder) {
                      if (ctx.budgetHit) break outerR;
                      const seg2u = tryOrthogonalRSecondLegFromR(Rt, S2t, gCell, b2, pb, rng, ctx, nextAttempts2);
                      if (ctx.budgetHit) break outerR;
                      if (!seg2u) continue;
                      const seg2cand = seg2u.slice(1);
                      if (rSecondExitLegHardViolation(pref, seg2cand, pb, pw, ph)) {
                        if (trace) {
                          trace.push(
                            `RSecond seg2 hard violation \u2192 redo from next R (prefix\u2194exit or bend/bottom), tried edge goal=(${gCell.c},${gCell.r}) k=${k}`
                          );
                        }
                        continue outerR;
                      }
                      const gEnd = seg2cand[seg2cand.length - 1];
                      if (gEnd.c !== gCell.c || gEnd.r !== gCell.r) continue;
                      if (!rSecondGoalOnTopLeftOrRightEdge(gEnd, pw, ph)) continue;
                      const fullPathT = [...pref, ...seg2cand];
                      if (countRightAngles(fullPathT) !== 6) continue;
                      const implicitP1 = onBottomRow ? transformCellByKQuarters(P1, k, boardW, boardH) : void 0;
                      if (!grade3RevisitOneCellRule(
                        fullPathT,
                        implicitP1 ? { implicitBeforeFirstR: implicitP1 } : void 0
                      ))
                        continue;
                      const snap = finalizeGrade2OrientedAfterRotation(pb, fullPathT, pw, ph, 6, {
                        relaxBendVisit: true,
                        requireGoalOnTopLeftRight: true
                      });
                      if (!snap) continue;
                      orientSnap = snap;
                      if (trace) {
                        trace.push(
                          `RSecond seg2 in oriented frame: goal candidate (${gEnd.c},${gEnd.r}) k=${k} before pad norm`
                        );
                      }
                      break orientK;
                    }
                  }
                  if (!orientSnap) continue;
                  writeBench(tryR);
                  if (trace) {
                    const pairKind = dirsEqual(dOut1, dIn2) ? "same-axis(2+2t)" : dirsEqual(dOut1, negateDir(dIn2)) ? "opposite(4+2t)" : orthogonalDirs(dOut1, dIn2) ? "orthogonal(3+2t)" : "?";
                    trace.push(
                      `RSecond path OK: tryR=${tryR} R=(${R.c},${R.r}) onBottomRow=${onBottomRow} dIn1=${dirKeyShort(dIn1)} dOut1=${dirKeyShort(dOut1)} dIn2=${dirKeyShort(dIn2)} dOut2=${dirKeyShort(dOut2)} oi=${oi} pairRS21=${pairKind} bumper=${sol}`
                    );
                    trace.push(
                      `  RS2 splits allowed (b0+b1+b2=4, RS2-1 on b1): ${splitsValid.map((t) => `(${t[0]},${t[1]},${t[2]})`).join(" ")} (count=${splitsValid.length})`
                    );
                    trace.push(
                      `  P1=(${P1.c},${P1.r}) S1=(${S1.c},${S1.r}) P2=(${P2.c},${P2.r}) S2=(${S2.c},${S2.r}) oddG=S2`
                    );
                    trace.push(
                      `  split (b0,b1,b2)=(${b0},${b1},${b2}) pass=${pass} firstH0(seg0)=${firstH0} RS2 legs=middle+exit via R prefix start=(${start.c},${start.r})`
                    );
                    trace.push(
                      `  polyAttemptsThisConstruction=${ctx.polyCalls} failedComboSizeBeforeAdd=${failedCombo.size}`
                    );
                    trace.push(
                      `  finalized goal (top/left/right on final board)=(${orientSnap.goal.c},${orientSnap.goal.r})`
                    );
                  }
                  return orientSnap;
                }
              }
            }
            if (!ctx.budgetHit) failedCombo.add(comboKey);
          }
        }
      }
    }
    writeBench(Math.max(0, lastTryRAt));
    if (trace) {
      trace.push(
        `tryConstructGrade3PathRSecondN1 end: no path. lastTryR=${lastTryRAt}/${tryRLimit - 1} failedComboKeys=${failedCombo.size} budgetHit=${ctx.budgetHit} polyCalls=${ctx.polyCalls}`
      );
    }
    return null;
  }
  function tryOrthogonalPolyline(start, goal, bends, firstHorizontal, pathable, rng) {
    const w = pathable.length;
    const h = pathable[0].length;
    const nSeg = bends + 1;
    const dc = goal.c - start.c;
    const dr = goal.r - start.r;
    const hIdx = [];
    const vIdx = [];
    for (let i = 0; i < nSeg; i++) {
      const isH = firstHorizontal ? i % 2 === 0 : i % 2 === 1;
      if (isH) hIdx.push(i);
      else vIdx.push(i);
    }
    const hs = randomNonZeroSplit(dc, hIdx.length, rng);
    const vs = randomNonZeroSplit(dr, vIdx.length, rng);
    if (!hs || !vs) return null;
    const lens = new Array(nSeg);
    hIdx.forEach((idx, j) => {
      lens[idx] = hs[j];
    });
    vIdx.forEach((idx, j) => {
      lens[idx] = vs[j];
    });
    return walkOrthogonalFromLens(start, goal, lens, firstHorizontal, pathable, w, h);
  }
  function countRightAngles(path) {
    let n = 0;
    for (let i = 1; i < path.length - 1; i++) {
      const d0 = unitStepDir(path[i].c - path[i - 1].c, path[i].r - path[i - 1].r);
      const d1 = unitStepDir(path[i + 1].c - path[i].c, path[i + 1].r - path[i].r);
      if (d0 && d1 && orthogonalDirs(d0, d1)) n++;
    }
    return n;
  }
  function unitDirBetween(a, b) {
    const dx = Math.sign(b.c - a.c);
    const dy = Math.sign(b.r - a.r);
    if (dx !== 0 && dy !== 0) return null;
    if (dx === 0 && dy === 0) return null;
    return { dx, dy };
  }
  function portalBendAtStart(path, startPad) {
    if (path.length < 2) return false;
    const dIn = unitDirBetween(startPad, path[0]);
    const dOut = unitDirBetween(path[0], path[1]);
    return !!(dIn && dOut && orthogonalDirs(dIn, dOut));
  }
  function portalBendAtGoal(path, goalPad) {
    if (path.length < 2) return false;
    const g = path[path.length - 1];
    const prev = path[path.length - 2];
    const dIn = unitDirBetween(prev, g);
    const dOut = unitDirBetween(g, goalPad);
    return !!(dIn && dOut && orthogonalDirs(dIn, dOut));
  }
  function totalDiagonalTurnCount(path, startPad, goalPad) {
    let n = countRightAngles(path);
    if (portalBendAtStart(path, startPad)) n++;
    if (portalBendAtGoal(path, goalPad)) n++;
    return n;
  }
  function placeDiagonalBumpers(path, startPad, goalPad) {
    const bumpers = /* @__PURE__ */ new Map();
    if (path.length >= 2 && portalBendAtStart(path, startPad)) {
      const gIn = unitDirBetween(startPad, path[0]);
      const gOut = unitDirBetween(path[0], path[1]);
      const dIn = unitStepDir(gIn.dx, gIn.dy);
      const dOut = unitStepDir(gOut.dx, gOut.dy);
      const sol = diagonalBumperForTurn(dIn, dOut);
      if (sol) bumpers.set(keyCell(path[0].c, path[0].r), { display: sol, solution: sol });
    }
    for (let i = 1; i < path.length - 1; i++) {
      const prev = path[i - 1];
      const cur = path[i];
      const next = path[i + 1];
      const dIn = unitStepDir(cur.c - prev.c, cur.r - prev.r);
      const dOut = unitStepDir(next.c - cur.c, next.r - cur.r);
      if (!dIn || !dOut) continue;
      const sol = diagonalBumperForTurn(dIn, dOut);
      if (sol == null) continue;
      bumpers.set(keyCell(cur.c, cur.r), { display: sol, solution: sol });
    }
    if (path.length >= 2 && portalBendAtGoal(path, goalPad)) {
      const g = path[path.length - 1];
      const prev = path[path.length - 2];
      const gIn = unitDirBetween(prev, g);
      const gOut = unitDirBetween(g, goalPad);
      const dIn = unitStepDir(gIn.dx, gIn.dy);
      const dOut = unitStepDir(gOut.dx, gOut.dy);
      const sol = diagonalBumperForTurn(dIn, dOut);
      if (sol) bumpers.set(keyCell(g.c, g.r), { display: sol, solution: sol });
    }
    const expected = totalDiagonalTurnCount(path, startPad, goalPad);
    const ok = bumpers.size === expected && expected > 0;
    return { bumpers, ok };
  }
  function placeDiagonalBumpersInterior(path) {
    const bumpers = /* @__PURE__ */ new Map();
    for (let i = 1; i < path.length - 1; i++) {
      const prev = path[i - 1];
      const cur = path[i];
      const next = path[i + 1];
      const dIn = unitStepDir(cur.c - prev.c, cur.r - prev.r);
      const dOut = unitStepDir(next.c - cur.c, next.r - cur.r);
      if (!dIn || !dOut) continue;
      const sol = diagonalBumperForTurn(dIn, dOut);
      if (sol == null) continue;
      const k = keyCell(cur.c, cur.r);
      const existing = bumpers.get(k);
      if (existing && existing.solution !== sol) return { bumpers, ok: false };
      bumpers.set(k, { display: sol, solution: sol });
    }
    const uniqBendCells = bendCellsInPath(path).size;
    const ok = bumpers.size === uniqBendCells && uniqBendCells > 0;
    return { bumpers, ok };
  }
  function pathVisitCount(path, c, r) {
    const k = keyCell(c, r);
    let n = 0;
    for (const p of path) {
      if (keyCell(p.c, p.r) === k) n++;
    }
    return n;
  }
  function bendVertexIndices(path) {
    const idx = [];
    for (let i = 1; i < path.length - 1; i++) {
      const d0 = unitStepDir(path[i].c - path[i - 1].c, path[i].r - path[i - 1].r);
      const d1 = unitStepDir(path[i + 1].c - path[i].c, path[i + 1].r - path[i].r);
      if (d0 && d1 && orthogonalDirs(d0, d1)) idx.push(i);
    }
    return idx;
  }
  function flipSubpathVerticalR(path, lo, hi, pivotR) {
    const out = path.map((q) => __spreadValues({}, q));
    for (let j = lo; j <= hi; j++) {
      out[j] = { c: path[j].c, r: 2 * pivotR - path[j].r };
    }
    return out;
  }
  function grade2VerticalFlipPivotCandidates(bendR, endR) {
    const s = /* @__PURE__ */ new Set();
    const add = (v) => {
      if (Number.isFinite(v)) s.add(Math.trunc(v));
    };
    add(bendR);
    add(Math.floor(endR / 2));
    add(Math.ceil(endR / 2));
    add(bendR + endR >> 1);
    add(bendR + endR + 1 >> 1);
    const lo = Math.min(bendR, endR);
    const hi = Math.max(bendR, endR);
    for (let t = lo; t <= hi; t++) add(t);
    return Array.from(s.values()).sort((a, b) => a - b);
  }
  function grade2GoalPadIsGridAboveGoal(goal, prevOnPath) {
    return goal.r < prevOnPath.r;
  }
  function grade2Bend6GoalPad(goal) {
    return { c: goal.c, r: goal.r - 1 };
  }
  function pathOrthStepValid(path, pathable, w, h) {
    for (const cell of path) {
      if (!inBounds(cell.c, cell.r, w, h) || !pathable[cell.c][cell.r]) return false;
    }
    for (let i = 1; i < path.length; i++) {
      if (!unitStepDir(path[i].c - path[i - 1].c, path[i].r - path[i - 1].r)) return false;
    }
    return true;
  }
  function validateGrade2RotatedPorts(p, w, h, opts) {
    const fs = pathFirstStepDir(p);
    if (!fs || !dirsEqual(fs, DIR.U)) return false;
    const start = p[0];
    const goal = p[p.length - 1];
    const startPad = { c: start.c, r: start.r + 1 };
    const goalPad = (opts == null ? void 0 : opts.bend6GoalPadAbove) ? { c: goal.c, r: goal.r - 1 } : (() => {
      const prev = p[p.length - 2];
      const dLast = unitDirBetween(prev, goal);
      if (!dLast) return null;
      return { c: goal.c + dLast.dx, r: goal.r + dLast.dy };
    })();
    if (!goalPad || !isStrictlyOutsideBoard(goalPad.c, goalPad.r, w, h)) return false;
    const dEntry = unitOrthoDirBetween(startPad, start);
    if (!dEntry || !dirsEqual(dEntry, DIR.U)) return false;
    return true;
  }
  function normalizeGrade2OppositePadPolyline(p, pathable, w, h, opts) {
    const start = p[0];
    const goal = p[p.length - 1];
    const startPad = { c: start.c, r: start.r + 1 };
    const goalPad = (opts == null ? void 0 : opts.grade2Bend6FixedGoalPad) ? { c: goal.c, r: goal.r - 1 } : (() => {
      const prev = p[p.length - 2];
      const dLast = unitDirBetween(prev, goal);
      if (!dLast) return null;
      return { c: goal.c + dLast.dx, r: goal.r + dLast.dy };
    })();
    if (!goalPad) return { kind: "ok", path: p };
    if ((opts == null ? void 0 : opts.grade2Bend6FixedGoalPad) && !isStrictlyOutsideBoard(goalPad.c, goalPad.r, w, h)) {
      return { kind: "ok", path: p };
    }
    const dStart = unitOrthoDirBetween(startPad, start);
    const dGoal = unitOrthoDirBetween(goalPad, goal);
    if (!dStart || !dGoal) return { kind: "ok", path: p };
    const padsOpposite = dirsEqual(dStart, negateDir(dGoal));
    const canonicalEnds = start.r === h - 1 && goal.r === 0;
    if (!padsOpposite || canonicalEnds) return { kind: "ok", path: p };
    const bends = bendVertexIndices(p);
    if (!bends.length) return { kind: "retry" };
    const pIdx = bends[bends.length - 1];
    const qIdx = bends[0];
    const pCell = p[pIdx];
    const qCell = p[qIdx];
    const revisitP = pathVisitCount(p, pCell.c, pCell.r) >= 2;
    if (!revisitP) {
      for (const pivotR of grade2VerticalFlipPivotCandidates(pCell.r, goal.r)) {
        const p2 = flipSubpathVerticalR(p, pIdx, p.length - 1, pivotR);
        if (!pathOrthStepValid(p2, pathable, w, h) || !validateGrade2RotatedPorts(p2, w, h, { bend6GoalPadAbove: !!(opts == null ? void 0 : opts.grade2Bend6FixedGoalPad) })) {
          continue;
        }
        const gN = p2[p2.length - 1];
        const prevN = p2[p2.length - 2];
        const padAboveOk = (opts == null ? void 0 : opts.grade2Bend6FixedGoalPad) ? isStrictlyOutsideBoard(gN.c, gN.r - 1, w, h) : grade2GoalPadIsGridAboveGoal(gN, prevN);
        if (!padAboveOk) continue;
        return { kind: "ok", path: p2, label: "goal->upside down" };
      }
      return { kind: "retry" };
    }
    const revisitQ = pathVisitCount(p, qCell.c, qCell.r) >= 2;
    if (revisitQ) return { kind: "retry" };
    const startR = start.r;
    for (const pivotR of grade2VerticalFlipPivotCandidates(qCell.r, startR)) {
      const p2 = flipSubpathVerticalR(p, 0, qIdx, pivotR);
      if (!pathOrthStepValid(p2, pathable, w, h)) continue;
      const p3 = p2.slice().reverse();
      if (!pathOrthStepValid(p3, pathable, w, h) || !validateGrade2RotatedPorts(p3, w, h, { bend6GoalPadAbove: !!(opts == null ? void 0 : opts.grade2Bend6FixedGoalPad) })) {
        continue;
      }
      const gN = p3[p3.length - 1];
      const prevN = p3[p3.length - 2];
      const padAboveOk3 = (opts == null ? void 0 : opts.grade2Bend6FixedGoalPad) ? isStrictlyOutsideBoard(gN.c, gN.r - 1, w, h) : grade2GoalPadIsGridAboveGoal(gN, prevN);
      if (!padAboveOk3) continue;
      return { kind: "ok", path: p3, label: "start->upside down" };
    }
    return { kind: "retry" };
  }
  function maybeExtendStartForGoalUpsideDown(path0, start, startPad, label, pathable, w, h, debugLog) {
    if (label !== "goal->upside down" || path0.length < 2) return { kind: "unchanged" };
    let B = path0[0];
    let maxR = B.r;
    for (const p of path0) {
      if (p.r > maxR) {
        maxR = p.r;
        B = p;
      }
    }
    const S0 = __spreadValues({}, start);
    const y_b = B.r - S0.r;
    if (y_b <= 0) return { kind: "unchanged" };
    const newStart = { c: S0.c, r: S0.r + y_b };
    const newStartPad = { c: startPad.c, r: startPad.r + y_b };
    if (!inBounds(newStart.c, newStart.r, w, h) || !pathable[newStart.c][newStart.r]) {
      if (debugLog) {
        console.warn(
          "[ReflecShot] goal->upside down start extend: \u7834\u68C4 extended start \u304C\u76E4\u5916\uFF0F\u975E pathable",
          { newStart, S0, y_b }
        );
      }
      return { kind: "discard", reason: "extended_start_not_pathable" };
    }
    const pathKeys = new Set(path0.map((p) => keyCell(p.c, p.r)));
    const pathS = [];
    for (let r = newStart.r; r >= S0.r; r--) {
      const cell = { c: S0.c, r };
      if (!inBounds(cell.c, cell.r, w, h) || !pathable[cell.c][cell.r]) {
        if (debugLog) {
          console.warn("[ReflecShot] goal->upside down start extend: \u7834\u68C4 Path_S \u304C pathable \u3067\u306A\u3044", {
            cell,
            S0,
            y_b
          });
        }
        return { kind: "discard", reason: "path_s_not_pathable" };
      }
      pathS.push(cell);
    }
    for (let i = 0; i < pathS.length - 1; i++) {
      const c = pathS[i];
      const k = keyCell(c.c, c.r);
      if (pathKeys.has(k)) {
        if (debugLog) {
          console.warn("[ReflecShot] goal->upside down start extend: \u7834\u68C4 Path_S \u304C Path_0 \u3068\u518D\u8A2A", {
            cell: c,
            S0,
            y_b
          });
        }
        return { kind: "discard", reason: "path_s_revisit" };
      }
    }
    const merged = pathS.concat(path0.slice(1));
    return { kind: "extended", path: merged, start: newStart, startPad: newStartPad };
  }
  function finalizeGrade2OrientedAfterRotation(pb, p, w, h, bends, opts) {
    const norm = normalizeGrade2OppositePadPolyline(p, pb, w, h);
    if (norm.kind === "retry") return null;
    const pN = norm.path;
    const padAdjustLabel = norm.label;
    const start = pN[0];
    const goal = pN[pN.length - 1];
    if ((opts == null ? void 0 : opts.requireGoalOnTopLeftRight) && !rSecondGoalOnTopLeftOrRightEdge(goal, w, h)) return null;
    const startPad = { c: start.c, r: start.r + 1 };
    const prev = pN[pN.length - 2];
    const dLast = unitDirBetween(prev, goal);
    if (!dLast) return null;
    const goalPad = { c: goal.c + dLast.dx, r: goal.r + dLast.dy };
    if (!isStrictlyOutsideBoard(goalPad.c, goalPad.r, w, h)) return null;
    const dEntry = unitOrthoDirBetween(startPad, start);
    if (!dEntry || !dirsEqual(dEntry, DIR.U)) return null;
    const bendSet = bendCellsInPath(pN);
    if (!(opts == null ? void 0 : opts.relaxBendVisit) && !grade2BendNoRevisit(pN, bendSet)) return null;
    const { bumpers, ok } = placeDiagonalBumpersInterior(pN);
    const needBumpers = (opts == null ? void 0 : opts.relaxBendVisit) ? bendSet.size : bends;
    if (!ok || bumpers.size !== needBumpers) return null;
    return {
      width: w,
      height: h,
      pathable: pb,
      start,
      goal,
      startPad,
      goalPad,
      solutionPath: pN,
      bumpers: new Map(bumpers),
      grade2PadAdjustLabel: padAdjustLabel
    };
  }
  function pickGrade2OrientedStage(pathable, path, w0, h0, bends, rng, opts) {
    const winners = [];
    for (let k = 0; k < 4; k++) {
      let p = path.map((x) => __spreadValues({}, x));
      let pb = pathable.map((col) => [...col]);
      let w = w0;
      let h = h0;
      for (let i = 0; i < k; i++) {
        const nx = applyQuarterCCWPathable(pb, p, w, h);
        p = nx.path;
        pb = nx.pathable;
        w = nx.w;
        h = nx.h;
      }
      const fs = pathFirstStepDir(p);
      if (!fs || !dirsEqual(fs, DIR.U)) continue;
      const snap = finalizeGrade2OrientedAfterRotation(pb, p, w, h, bends, opts);
      if (snap) winners.push(snap);
    }
    if (!winners.length) return null;
    return winners[Math.floor(rng() * winners.length)];
  }
  var lastGrade2Bend6Trace = null;
  function horizontalRunSameRowInclusive(a, b) {
    if (a.r !== b.r) return null;
    if (a.c === b.c) return [__spreadValues({}, a)];
    const step = Math.sign(b.c - a.c);
    const out = [];
    for (let c = a.c; ; c += step) {
      out.push({ c, r: a.r });
      if (c === b.c) break;
    }
    return out;
  }
  function horizontalRunPathable(run, pathable, w, h) {
    for (const cell of run) {
      if (!inBounds(cell.c, cell.r, w, h) || !pathable[cell.c][cell.r]) return false;
    }
    return true;
  }
  function tryGrade2Bend6Path(pathable, w, h, start, goal, rng, traceOut, outerAttempt, genOpts) {
    const pickSignedMag = (maxMag) => {
      const m = Math.max(1, Math.min(maxMag, 4));
      const mag = 1 + Math.floor(rng() * m);
      return rng() < 0.5 ? mag : -mag;
    };
    const dfsTail = (tailTarget, cur, prev, bendsLeft, visited, stack) => {
      stack.push(cur);
      visited.add(keyCell(cur.c, cur.r));
      if (cur.c === tailTarget.c && cur.r === tailTarget.r) {
        if (bendsLeft === 0) return true;
        stack.pop();
        visited.delete(keyCell(cur.c, cur.r));
        return false;
      }
      const dPrev = unitStepDir(cur.c - prev.c, cur.r - prev.r);
      if (!dPrev) {
        stack.pop();
        visited.delete(keyCell(cur.c, cur.r));
        return false;
      }
      const opts = [DIR.U, DIR.D, DIR.L, DIR.R];
      for (let i = opts.length - 1; i > 0; i--) {
        const j = Math.floor(rng() * (i + 1));
        [opts[i], opts[j]] = [opts[j], opts[i]];
      }
      for (const d of opts) {
        const next = addCell(cur, d);
        if (next.c === prev.c && next.r === prev.r) continue;
        if (!inBounds(next.c, next.r, w, h) || !pathable[next.c][next.r]) continue;
        const nk = keyCell(next.c, next.r);
        if (visited.has(nk)) continue;
        let newBL = bendsLeft;
        if (!dirsEqual(dPrev, d)) {
          if (!orthogonalDirs(dPrev, d)) continue;
          newBL -= 1;
        }
        if (newBL < 0) continue;
        const mh = Math.abs(next.c - tailTarget.c) + Math.abs(next.r - tailTarget.r);
        if (newBL > mh + 4) {
          continue;
        }
        if (dfsTail(tailTarget, next, cur, newBL, visited, stack)) return true;
      }
      stack.pop();
      visited.delete(keyCell(cur.c, cur.r));
      return false;
    };
    for (let attempt = 0; attempt < 48; attempt++) {
      const variantA = rng() < 0.5;
      const maxHorizA = Math.max(start.c, w - 1 - start.c) || 1;
      const maxHorizB = Math.max(goal.c, w - 1 - goal.c) || 1;
      const ds = variantA ? pickSignedMag(maxHorizA) : pickSignedMag(maxHorizB);
      const targetBends = (genOpts == null ? void 0 : genOpts.grade2Bend6TotalBends) != null ? Math.max(6, Math.min(8, genOpts.grade2Bend6TotalBends)) : 6 + Math.floor(rng() * 3);
      if (variantA) {
        const S1 = { c: start.c + ds, r: start.r };
        const horiz = horizontalRunSameRowInclusive(start, S1);
        if (!horiz || !horizontalRunPathable(horiz, pathable, w, h)) continue;
        const S2 = { c: S1.c, r: S1.r - 1 };
        if (!inBounds(S2.c, S2.r, w, h) || !pathable[S2.c][S2.r]) continue;
        const preHook = [...horiz, S2];
        const preBends = countRightAngles(preHook);
        if (preBends > targetBends) continue;
        const bendsLeft = targetBends - preBends;
        if (bendsLeft < 0) continue;
        const visited2 = new Set(horiz.map((cell) => keyCell(cell.c, cell.r)));
        const stack = [...horiz];
        if (!dfsTail(goal, S2, S1, bendsLeft, visited2, stack)) continue;
        const full2 = stack;
        if (!grade1NoRevisit(full2)) continue;
        const cra = countRightAngles(full2);
        if (cra < 6 || cra > 8) continue;
        if (traceOut) {
          const Q = full2[full2.length - 2];
          Object.assign(traceOut, {
            outerAttempt: outerAttempt != null ? outerAttempt : -1,
            innerAttempt: attempt,
            variantA: true,
            ds,
            S1: __spreadValues({}, S1),
            S2: __spreadValues({}, S2),
            tailPolyline: full2.slice(horiz.length).map((x) => __spreadValues({}, x)),
            Q: __spreadValues({}, Q)
          });
        }
        return full2;
      }
      const G1 = { c: goal.c + ds, r: goal.r };
      const horizG = horizontalRunSameRowInclusive(goal, G1);
      if (!horizG || !horizontalRunPathable(horizG, pathable, w, h)) continue;
      if (G1.c === goal.c && G1.r === goal.r) continue;
      const G2 = { c: G1.c, r: G1.r + 1 };
      if (!inBounds(G2.c, G2.r, w, h) || !pathable[G2.c][G2.r]) continue;
      const preHookB = [...horizG, G2];
      const preBendsB = countRightAngles(preHookB);
      if (preBendsB > targetBends) continue;
      const bendsLeftB = targetBends - preBendsB;
      if (bendsLeftB < 0) continue;
      const visited = new Set(horizG.map((cell) => keyCell(cell.c, cell.r)));
      const hookStack = [...horizG];
      if (!dfsTail(start, G2, G1, bendsLeftB, visited, hookStack)) continue;
      const mid = hookStack;
      if (mid[mid.length - 1].c !== start.c || mid[mid.length - 1].r !== start.r) continue;
      const full = mid.slice().reverse();
      if (!grade1NoRevisit(full)) continue;
      const crb = countRightAngles(full);
      if (crb < 6 || crb > 8) continue;
      if (traceOut) {
        const tailForward = mid.slice(horizG.length).map((x) => __spreadValues({}, x));
        const Q = full[full.length - 2];
        Object.assign(traceOut, {
          outerAttempt: outerAttempt != null ? outerAttempt : -1,
          innerAttempt: attempt,
          variantA: false,
          ds,
          G1: __spreadValues({}, G1),
          G2: __spreadValues({}, G2),
          tailPolyline: tailForward,
          Q: __spreadValues({}, Q)
        });
      }
      return full;
    }
    return null;
  }
  function placeGrade2Bend6Bumpers(path, w, h) {
    const cra = countRightAngles(path);
    if (cra < 6 || cra > 8) return null;
    const start = path[0];
    const goal = path[path.length - 1];
    const startPad = { c: start.c, r: start.r + 1 };
    const goalPad = grade2Bend6GoalPad(goal);
    if (!isStrictlyOutsideBoard(goalPad.c, goalPad.r, w, h)) return null;
    const { bumpers, ok } = placeDiagonalBumpers(path, startPad, goalPad);
    if (!ok) return null;
    return bumpers;
  }
  function pickGrade2Bend6OrientedStage(pathable, path, w0, h0, rng) {
    const winners = [];
    for (let k = 0; k < 4; k++) {
      let p = path.map((x) => __spreadValues({}, x));
      let pb = pathable.map((col) => [...col]);
      let w = w0;
      let h = h0;
      for (let i = 0; i < k; i++) {
        const nx = applyQuarterCCWPathable(pb, p, w, h);
        p = nx.path;
        pb = nx.pathable;
        w = nx.w;
        h = nx.h;
      }
      const fs = pathFirstStepDir(p);
      if (!fs) continue;
      const norm = normalizeGrade2OppositePadPolyline(p, pb, w, h, {
        grade2Bend6FixedGoalPad: true
      });
      if (norm.kind === "retry") continue;
      p = norm.path;
      const padAdjustLabel = norm.label;
      const bumpers = placeGrade2Bend6Bumpers(p, w, h);
      if (!bumpers) continue;
      const start = p[0];
      const goal = p[p.length - 1];
      const startPad = { c: start.c, r: start.r + 1 };
      const goalPad = grade2Bend6GoalPad(goal);
      if (!isStrictlyOutsideBoard(goalPad.c, goalPad.r, w, h)) continue;
      const dEntry = unitOrthoDirBetween(startPad, start);
      if (!dEntry || !dirsEqual(dEntry, DIR.U)) continue;
      const bendSet = bendCellsInPath(p);
      if (!grade2BendNoRevisit(p, bendSet)) continue;
      const expectedBumpers = totalDiagonalTurnCount(p, startPad, goalPad);
      if (bumpers.size !== expectedBumpers) continue;
      winners.push({
        width: w,
        height: h,
        pathable: pb,
        start,
        goal,
        startPad,
        goalPad,
        solutionPath: p,
        bumpers: new Map(bumpers),
        grade2PadAdjustLabel: padAdjustLabel
      });
    }
    if (!winners.length) return null;
    return winners[Math.floor(rng() * winners.length)];
  }
  function generateBoardLv4Stage(seed, genOpts) {
    var _a, _b, _c, _d, _e, _f;
    const rng = createStageRng(seed);
    const { w: W, h: H } = boardSizeForGrade(5);
    const pathable = makeRect(W, H);
    const maxAttempts = 220;
    const lv4Mode = (_a = genOpts == null ? void 0 : genOpts.lv4GenMode) != null ? _a : "rSecond";
    const rFirst = lv4Mode === "rFirst";
    const rSecond = lv4Mode === "rSecond";
    const bench = genOpts == null ? void 0 : genOpts.lv4BenchStats;
    if (bench) {
      bench.outerAttemptsUsed = maxAttempts;
      bench.rejectedNoPath = 0;
      bench.rejectedPickOrient = 0;
      bench.rejectedExtendDiscard = 0;
      bench.rejectedAfterExtend = 0;
    }
    const markBenchSuccess = (attempt) => {
      if (bench) bench.outerAttemptsUsed = attempt + 1;
    };
    const rSecondTrace = genOpts == null ? void 0 : genOpts.lv4RSecondTrace;
    if (rSecondTrace) rSecondTrace.length = 0;
    for (let attempt = 0; attempt < maxAttempts; attempt++) {
      const bottoms = bottomCandidates(pathable);
      const tops = topCandidates(pathable);
      if (!bottoms.length) return null;
      if (!rSecond && !tops.length) return null;
      let picked = null;
      if (rSecond) {
        if (rSecondTrace) {
          rSecondTrace.push(
            `=== Lv4 outer attempt ${attempt + 1}/${maxAttempts} (rejectedNoPath=${(_b = bench == null ? void 0 : bench.rejectedNoPath) != null ? _b : 0} rejectedPick=${(_c = bench == null ? void 0 : bench.rejectedPickOrient) != null ? _c : 0}) ===`
          );
        }
        if (bench) {
          bench.rFirstPolyCalls = 0;
          bench.rFirstBfsPruned = 0;
          bench.rFirstComboCacheSkips = 0;
          bench.rFirstBudgetExhausted = 0;
          bench.rFirstLastTryR = 0;
        }
        picked = tryConstructGrade3PathRSecondN1(pathable, rng, bench, rSecondTrace);
        if (picked && rSecondTrace) {
          rSecondTrace.push(
            `polyline OK: len=${picked.solutionPath.length} start=(${picked.start.c},${picked.start.r}) rightAngles=${countRightAngles(picked.solutionPath)}`
          );
        }
        if (!picked && rSecondTrace) {
          rSecondTrace.push(`polyline construction \u2192 null (goal deferred to RS2 exit; or hard rollback)`);
        }
      } else {
        const topGoal = rFirst ? (() => {
          const cx = (W - 1) / 2;
          const ord = [...tops].sort((a, b) => Math.abs(a.c - cx) - Math.abs(b.c - cx));
          return ord[attempt % ord.length];
        })() : tops[Math.floor(rng() * tops.length)];
        if (bench && rFirst) {
          bench.rFirstPolyCalls = 0;
          bench.rFirstBfsPruned = 0;
          bench.rFirstComboCacheSkips = 0;
          bench.rFirstBudgetExhausted = 0;
          bench.rFirstLastTryR = 0;
        }
        const path = rFirst ? (_e = (_d = tryConstructGrade3PathRFirstN1(pathable, topGoal, rng, bench)) == null ? void 0 : _d.path) != null ? _e : null : findGrade3SixBendPath(pathable, bottoms[Math.floor(rng() * bottoms.length)], topGoal, rng);
        if (!path) {
          if (bench) bench.rejectedNoPath++;
          continue;
        }
        picked = pickGrade2OrientedStage(pathable, path, W, H, 6, rng, { relaxBendVisit: true });
        if (!picked) {
          if (bench) bench.rejectedPickOrient++;
          continue;
        }
      }
      if (!picked) {
        if (bench) bench.rejectedNoPath++;
        continue;
      }
      if (rSecond && rSecondTrace) {
        rSecondTrace.push(
          `RSecond oriented OK: start=(${picked.start.c},${picked.start.r}) goal=(${picked.goal.c},${picked.goal.r}) padLabel=${(_f = picked.grade2PadAdjustLabel) != null ? _f : "none"}`
        );
      }
      let solutionPath = picked.solutionPath;
      let start = picked.start;
      let startPad = picked.startPad;
      const goal = picked.goal;
      const ge = maybeExtendStartForGoalUpsideDown(
        solutionPath,
        start,
        startPad,
        picked.grade2PadAdjustLabel,
        picked.pathable,
        picked.width,
        picked.height,
        genOpts == null ? void 0 : genOpts.debugReflecShotConsole
      );
      if (ge.kind === "discard") {
        if (bench) bench.rejectedExtendDiscard++;
        if (rSecond && rSecondTrace) rSecondTrace.push("maybeExtendStartForGoalUpsideDown: discard");
        continue;
      }
      if (ge.kind === "extended") {
        solutionPath = ge.path;
        start = ge.start;
        startPad = ge.startPad;
        if (!pathOrthStepValid(solutionPath, picked.pathable, picked.width, picked.height)) {
          if (bench) bench.rejectedAfterExtend++;
          continue;
        }
        if (!grade3RevisitOneCellRule(solutionPath)) {
          if (bench) bench.rejectedAfterExtend++;
          continue;
        }
        const fs = pathFirstStepDir(solutionPath);
        if (!fs || !dirsEqual(fs, DIR.U)) {
          if (bench) bench.rejectedAfterExtend++;
          continue;
        }
        if (countRightAngles(solutionPath) !== 6) {
          if (bench) bench.rejectedAfterExtend++;
          continue;
        }
        const prev = solutionPath[solutionPath.length - 2];
        const dLast = unitDirBetween(prev, goal);
        if (!dLast) {
          if (bench) bench.rejectedAfterExtend++;
          continue;
        }
        const goalPad = { c: goal.c + dLast.dx, r: goal.r + dLast.dy };
        if (!isStrictlyOutsideBoard(goalPad.c, goalPad.r, picked.width, picked.height)) {
          if (bench) bench.rejectedAfterExtend++;
          continue;
        }
        const dEntry = unitOrthoDirBetween(startPad, start);
        if (!dEntry || !dirsEqual(dEntry, DIR.U)) {
          if (bench) bench.rejectedAfterExtend++;
          continue;
        }
        const bendSet = bendCellsInPath(solutionPath);
        const { bumpers, ok } = placeDiagonalBumpersInterior(solutionPath);
        if (!ok || bumpers.size !== bendSet.size) {
          if (bench) bench.rejectedAfterExtend++;
          continue;
        }
        const dup2 = /* @__PURE__ */ new Map();
        bumpers.forEach((v, k) => dup2.set(k, { display: v.display, solution: v.solution }));
        shuffleWrongDisplay(dup2, rng);
        markBenchSuccess(attempt);
        if (rSecond && rSecondTrace) {
          rSecondTrace.push(
            `FINAL BOARD: extended start path len=${solutionPath.length} reflecSourceStartExtended=true outerAttemptsUsed=${attempt + 1}`
          );
        }
        return {
          width: picked.width,
          height: picked.height,
          pathable: picked.pathable,
          start,
          goal,
          startPad,
          goalPad,
          bumpers: dup2,
          solutionPath,
          grade: 5,
          seed,
          grade2PadAdjustLabel: picked.grade2PadAdjustLabel,
          reflecSourceStartExtended: true
        };
      }
      const dup = /* @__PURE__ */ new Map();
      picked.bumpers.forEach((v, k) => dup.set(k, { display: v.display, solution: v.solution }));
      shuffleWrongDisplay(dup, rng);
      markBenchSuccess(attempt);
      if (rSecond && rSecondTrace) {
        rSecondTrace.push(
          `FINAL BOARD: no start extend path len=${picked.solutionPath.length} outerAttemptsUsed=${attempt + 1}`
        );
      }
      return {
        width: picked.width,
        height: picked.height,
        pathable: picked.pathable,
        start: picked.start,
        goal: picked.goal,
        startPad: picked.startPad,
        goalPad: picked.goalPad,
        bumpers: dup,
        solutionPath: picked.solutionPath,
        grade: 5,
        seed,
        grade2PadAdjustLabel: picked.grade2PadAdjustLabel
      };
    }
    return null;
  }
  function wrongDiagonal(sol) {
    return sol === "SLASH" ? "BACKSLASH" : "SLASH";
  }
  function shuffleWrongDisplay(bumpers, rng) {
    let hasWrong = false;
    bumpers.forEach((cell) => {
      if (rng() < 0.55) {
        cell.display = wrongDiagonal(cell.solution);
        hasWrong = true;
      }
    });
    if (!hasWrong && bumpers.size) {
      const first = bumpers.keys().next().value;
      const c = bumpers.get(first);
      c.display = wrongDiagonal(c.solution);
    }
  }
  function generateBoardLv1Stage(consumerGrade, seed) {
    const rng = createStageRng(seed);
    const { w: W, h: H } = boardSizeForGrade(consumerGrade);
    const pathable = makeRect(W, H);
    const maxAttempts = consumerGrade === 2 ? 3500 : 1500;
    for (let attempt = 0; attempt < maxAttempts; attempt++) {
      const bottoms = bottomCandidates(pathable);
      const tops = topCandidates(pathable);
      if (!bottoms.length || !tops.length) return null;
      const start = bottoms[Math.floor(rng() * bottoms.length)];
      const goal = tops[Math.floor(rng() * tops.length)];
      const bends = Math.floor(rng() * 4) + 1;
      let path = null;
      for (let t = 0; t < 24; t++) {
        const firstH = rng() < 0.5;
        path = tryOrthogonalPolyline(start, goal, bends, firstH, pathable, rng);
        if (path) break;
      }
      if (!path) continue;
      if (countRightAngles(path) !== bends) continue;
      if (!grade1NoRevisit(path)) continue;
      const startPad = { c: start.c, r: start.r + 1 };
      const goalPad = { c: goal.c, r: goal.r - 1 };
      const { bumpers, ok } = placeDiagonalBumpers(path, startPad, goalPad);
      if (!ok || bumpers.size === 0) continue;
      if (consumerGrade === 1) {
        if (bumpers.size !== 2) continue;
      } else if (bumpers.size < 4) continue;
      const dup = /* @__PURE__ */ new Map();
      bumpers.forEach((v, k) => dup.set(k, { display: v.display, solution: v.solution }));
      shuffleWrongDisplay(dup, rng);
      return {
        width: W,
        height: H,
        pathable,
        start,
        goal,
        startPad,
        goalPad,
        bumpers: dup,
        solutionPath: path,
        grade: consumerGrade,
        seed
      };
    }
    return null;
  }
  function generateBoardLv2Stage(seed, genOpts) {
    const rng = createStageRng(seed);
    const W = 5;
    const H = 5;
    const pathable = makeRect(W, H);
    const maxAttempts = 1200;
    for (let attempt = 0; attempt < maxAttempts; attempt++) {
      const bottoms = bottomCandidates(pathable);
      const tops = topCandidates(pathable);
      if (!bottoms.length || !tops.length) return null;
      const polyStart = bottoms[Math.floor(rng() * bottoms.length)];
      const polyGoal = tops[Math.floor(rng() * tops.length)];
      const dc = polyGoal.c - polyStart.c;
      const dr = polyGoal.r - polyStart.r;
      const bends = 4;
      if (dc === 0 || dr === 0) continue;
      let path = null;
      for (let t = 0; t < 40; t++) {
        const firstH = t < 2 ? t % 2 === 0 : rng() < 0.5;
        path = tryOrthogonalPolyline(polyStart, polyGoal, bends, firstH, pathable, rng);
        if (path) break;
      }
      if (!path) continue;
      if (countRightAngles(path) !== bends) continue;
      if (!pathHasOrthogonalCrossCell(path)) continue;
      const picked = pickGrade2OrientedStage(pathable, path, W, H, bends, rng);
      if (!picked) continue;
      let solutionPath = picked.solutionPath;
      let start = picked.start;
      let startPad = picked.startPad;
      let reflecSourceStartExtended = false;
      const ge = maybeExtendStartForGoalUpsideDown(
        solutionPath,
        start,
        startPad,
        picked.grade2PadAdjustLabel,
        picked.pathable,
        picked.width,
        picked.height,
        genOpts == null ? void 0 : genOpts.debugReflecShotConsole
      );
      if (ge.kind === "discard") continue;
      if (ge.kind === "extended") {
        solutionPath = ge.path;
        start = ge.start;
        startPad = ge.startPad;
        reflecSourceStartExtended = true;
        if (!pathOrthStepValid(solutionPath, picked.pathable, picked.width, picked.height)) continue;
        if (countRightAngles(solutionPath) !== bends) continue;
        if (!pathHasOrthogonalCrossCell(solutionPath)) continue;
        const bendSet = bendCellsInPath(solutionPath);
        if (!grade2BendNoRevisit(solutionPath, bendSet)) continue;
        const { bumpers, ok } = placeDiagonalBumpersInterior(solutionPath);
        if (!ok || bumpers.size !== bends) continue;
        const dup2 = /* @__PURE__ */ new Map();
        bumpers.forEach((v, k) => dup2.set(k, { display: v.display, solution: v.solution }));
        shuffleWrongDisplay(dup2, rng);
        return {
          width: picked.width,
          height: picked.height,
          pathable: picked.pathable,
          start,
          goal: picked.goal,
          startPad,
          goalPad: picked.goalPad,
          bumpers: dup2,
          solutionPath,
          grade: 3,
          seed,
          grade2PadAdjustLabel: picked.grade2PadAdjustLabel,
          reflecSourceStartExtended: true
        };
      }
      const dup = /* @__PURE__ */ new Map();
      picked.bumpers.forEach((v, k) => dup.set(k, { display: v.display, solution: v.solution }));
      shuffleWrongDisplay(dup, rng);
      return {
        width: picked.width,
        height: picked.height,
        pathable: picked.pathable,
        start: picked.start,
        goal: picked.goal,
        startPad: picked.startPad,
        goalPad: picked.goalPad,
        bumpers: dup,
        solutionPath: picked.solutionPath,
        grade: 3,
        seed,
        grade2PadAdjustLabel: picked.grade2PadAdjustLabel
      };
    }
    return null;
  }
  function generateBoardLv3Stage(seed, polyOpts) {
    const rng = createStageRng(seed);
    const W = 5;
    const H = 5;
    const pathable = makeRect(W, H);
    lastGrade2Bend6Trace = null;
    const maxAttempts = 1200;
    for (let attempt = 0; attempt < maxAttempts; attempt++) {
      const bottoms = bottomCandidates(pathable);
      const tops = topCandidates(pathable);
      if (!bottoms.length || !tops.length) return null;
      const bend6Start = bottoms[Math.floor(rng() * bottoms.length)];
      const bend6Goal = tops[Math.floor(rng() * tops.length)];
      const bend6Trace = {
        outerAttempt: attempt,
        innerAttempt: -1,
        variantA: true,
        ds: 0,
        tailPolyline: [],
        Q: { c: -1, r: -1 }
      };
      const path = tryGrade2Bend6Path(pathable, W, H, bend6Start, bend6Goal, rng, bend6Trace, attempt, polyOpts);
      if (!path || !pathOrthStepValid(path, pathable, W, H)) continue;
      const pathCr = countRightAngles(path);
      if (pathCr < 6 || pathCr > 8) continue;
      if (!grade1NoRevisit(path)) continue;
      const picked = pickGrade2Bend6OrientedStage(pathable, path, W, H, rng);
      if (!picked) continue;
      let solutionPath = picked.solutionPath;
      let start = picked.start;
      let startPad = picked.startPad;
      const goal = picked.goal;
      const ge = maybeExtendStartForGoalUpsideDown(
        solutionPath,
        start,
        startPad,
        picked.grade2PadAdjustLabel,
        picked.pathable,
        picked.width,
        picked.height,
        polyOpts == null ? void 0 : polyOpts.debugReflecShotConsole
      );
      if (ge.kind === "discard") continue;
      if (ge.kind === "extended") {
        solutionPath = ge.path;
        start = ge.start;
        startPad = ge.startPad;
        if (!pathOrthStepValid(solutionPath, picked.pathable, W, H)) continue;
        const pcra = countRightAngles(solutionPath);
        if (pcra < 6 || pcra > 8) continue;
        if (!grade1NoRevisit(solutionPath)) continue;
        const bendSet = bendCellsInPath(solutionPath);
        if (!grade2BendNoRevisit(solutionPath, bendSet)) continue;
        const goalPad = grade2Bend6GoalPad(goal);
        const bump6 = placeGrade2Bend6Bumpers(solutionPath, picked.width, picked.height);
        if (!bump6 || bump6.size !== totalDiagonalTurnCount(solutionPath, startPad, goalPad)) continue;
        const dup2 = /* @__PURE__ */ new Map();
        bump6.forEach((v, k) => dup2.set(k, { display: v.display, solution: v.solution }));
        lastGrade2Bend6Trace = { trace: bend6Trace, rawPath: path.map((x) => __spreadValues({}, x)) };
        shuffleWrongDisplay(dup2, rng);
        return {
          width: picked.width,
          height: picked.height,
          pathable: picked.pathable,
          start,
          goal,
          startPad,
          goalPad,
          bumpers: dup2,
          solutionPath,
          grade: 4,
          seed,
          grade2PadAdjustLabel: picked.grade2PadAdjustLabel,
          reflecSourceStartExtended: true
        };
      }
      const dup = /* @__PURE__ */ new Map();
      picked.bumpers.forEach((v, k) => dup.set(k, { display: v.display, solution: v.solution }));
      lastGrade2Bend6Trace = { trace: bend6Trace, rawPath: path.map((x) => __spreadValues({}, x)) };
      shuffleWrongDisplay(dup, rng);
      return {
        width: picked.width,
        height: picked.height,
        pathable: picked.pathable,
        start: picked.start,
        goal: picked.goal,
        startPad: picked.startPad,
        goalPad: picked.goalPad,
        bumpers: dup,
        solutionPath: picked.solutionPath,
        grade: 4,
        seed,
        grade2PadAdjustLabel: picked.grade2PadAdjustLabel
      };
    }
    return null;
  }
  function generateGridStage(grade, seed, polyOpts) {
    const g = Math.max(1, Math.min(5, Math.floor(grade)));
    if (g === 1 || g === 2) return generateBoardLv1Stage(g, seed);
    if (g === 3) return generateBoardLv2Stage(seed, polyOpts);
    if (g === 4) return generateBoardLv3Stage(seed, polyOpts);
    return generateBoardLv4Stage(seed, polyOpts);
  }
  function fallbackGridStage(grade, seed) {
    const g = Math.max(1, Math.min(5, Math.floor(grade)));
    if (g === 1) {
      for (let t = 0; t < 500; t++) {
        const st = generateBoardLv1Stage(1, seed + t * 2654435769 >>> 0);
        if (st) return __spreadProps(__spreadValues({}, st), { grade: g, seed });
      }
      throw new Error("fallbackGridStage(1): Lv.1\u30FB\u30D0\u30F3\u30D1\u30FC2 \u306E\u751F\u6210\u306B\u5931\u6557");
    }
    if (g === 2) {
      for (let t = 0; t < 500; t++) {
        const st = generateBoardLv1Stage(2, seed + t * 2654435769 >>> 0);
        if (st) return __spreadProps(__spreadValues({}, st), { grade: g, seed });
      }
      throw new Error("fallbackGridStage(2): Lv.1\u30FB\u30D0\u30F3\u30D1\u30FC4+ \u306E\u751F\u6210\u306B\u5931\u6557");
    }
    if (g === 3) {
      for (let t = 0; t < 200; t++) {
        const st = generateBoardLv2Stage(seed + t * 130051 >>> 0);
        if (st) return __spreadProps(__spreadValues({}, st), { grade: g, seed });
      }
      throw new Error("fallbackGridStage(3): Lv.2 \u306E\u751F\u6210\u306B\u5931\u6557");
    }
    if (g === 4) {
      for (let t = 0; t < 200; t++) {
        const st = generateBoardLv3Stage(seed + t * 130051 >>> 0);
        if (st) return __spreadProps(__spreadValues({}, st), { grade: g, seed });
      }
      throw new Error("fallbackGridStage(4): Lv.3 \u306E\u751F\u6210\u306B\u5931\u6557");
    }
    for (let t = 0; t < 500; t++) {
      const st = generateBoardLv4Stage(seed + t * 130051 >>> 0);
      if (st) return __spreadProps(__spreadValues({}, st), { grade: g, seed });
    }
    throw new Error("fallbackGridStage(5): Lv.4 \u306E\u751F\u6210\u306B\u5931\u6557");
  }
  function generateGridStageWithFallback(grade, seed, polyOpts) {
    var _a;
    return (_a = generateGridStage(grade, seed, polyOpts)) != null ? _a : fallbackGridStage(grade, seed);
  }

  // src/app/lab/reflec-shot/reflectShotWorkerTypes.ts
  function serializeGridStageForWorker(st) {
    return __spreadProps(__spreadValues({}, st), {
      bumpers: Array.from(st.bumpers.entries())
    });
  }

  // src/workers/reflect-shot.worker.entry.ts
  function post(data) {
    self.postMessage(data);
  }
  self.onmessage = (ev) => {
    const msg = ev.data;
    if (!msg || msg.type !== "GENERATE") return;
    const { requestId, grade, seed, grade2Bend6TotalBends, debugReflecShotConsole, lv4GenMode } = msg;
    post({ type: "STATUS", status: "RUNNING", requestId });
    try {
      const t0 = performance.now();
      const genOpts = grade === 4 && grade2Bend6TotalBends != null || debugReflecShotConsole || lv4GenMode != null ? __spreadValues(__spreadValues(__spreadValues({}, grade === 4 && grade2Bend6TotalBends != null ? { grade2Bend6TotalBends } : {}), debugReflecShotConsole ? { debugReflecShotConsole: true } : {}), lv4GenMode != null ? { lv4GenMode } : {}) : void 0;
      const board = generateGridStageWithFallback(grade, seed, genOpts);
      const totalMs = performance.now() - t0;
      post({
        type: "SUCCESS",
        requestId,
        board: serializeGridStageForWorker(board),
        metrics: { totalMs }
      });
    } catch (e) {
      post({
        type: "ERROR",
        requestId,
        error: e instanceof Error ? e.message : String(e)
      });
    }
  };
})();
