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
  function bumperKindForTurn(dIn, dOut) {
    for (const kind of ["SLASH", "BACKSLASH", "HYPHEN", "PIPE"]) {
      if (dirsEqual(applyBumper(dIn, kind), dOut)) return kind;
    }
    return null;
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
  function bumpersForGrade(grade) {
    const g = Math.max(1, Math.min(5, Math.floor(grade)));
    if (g <= 2) return 0;
    if (g === 3) return 0;
    if (g === 4) return 2;
    return 3;
  }
  function boardSizeForGrade(grade) {
    const g = Math.max(1, Math.min(5, Math.floor(grade)));
    switch (g) {
      case 1:
        return { w: 4, h: 4 };
      case 2:
        return { w: 5, h: 5 };
      case 3:
        return { w: 6, h: 7 };
      case 4:
        return { w: 8, h: 9 };
      default:
        return { w: 10, h: 11 };
    }
  }
  function templatesForBoard(w, h, grade) {
    const g = Math.max(1, Math.min(5, Math.floor(grade)));
    const rect = () => makeRect(w, h);
    if (g <= 1) return [rect];
    if (g === 2) return [rect, () => templateL(w, h)];
    if (g === 3) return [rect];
    if (g === 4) return [rect, () => templateL(w, h), () => templateT(w, h)];
    return [rect, () => templateL(w, h), () => templateT(w, h), () => templateCross(w, h)];
  }
  function makeRect(w, h) {
    return Array.from({ length: w }, () => Array(h).fill(true));
  }
  function templateL(w, h) {
    const p = makeRect(w, h);
    const c0 = Math.ceil(w * 0.5);
    const r1 = Math.floor(h * 0.45);
    for (let c = c0; c < w; c++) {
      for (let r = 0; r < r1; r++) p[c][r] = false;
    }
    return p;
  }
  function templateT(w, h) {
    const p = makeRect(w, h);
    const mid = Math.floor(w / 2);
    const arm = Math.max(2, Math.floor(w * 0.22));
    const r0 = Math.floor(h * 0.38);
    const r2 = Math.floor(h * 0.62);
    for (let c = 0; c < w; c++) {
      if (Math.abs(c - mid) <= arm) continue;
      for (let r = r0; r <= r2; r++) p[c][r] = false;
    }
    return p;
  }
  function templateCross(w, h) {
    const p = makeRect(w, h);
    const mx = Math.floor(w / 2);
    const my = Math.floor(h / 2);
    const arm = Math.max(2, Math.min(mx, my) - 1);
    for (let c = 0; c < w; c++) {
      for (let r = 0; r < h; r++) {
        const onH = Math.abs(r - my) <= 1;
        const onV = Math.abs(c - mx) <= 1;
        if (onH || onV) continue;
        p[c][r] = false;
      }
    }
    return p;
  }
  function connected(pathable, a, b) {
    var _a, _b;
    const w = pathable.length;
    const h = (_b = (_a = pathable[0]) == null ? void 0 : _a.length) != null ? _b : 0;
    const vis = /* @__PURE__ */ new Set();
    const q = [a];
    vis.add(keyCell(a.c, a.r));
    const dirs = [DIR.U, DIR.D, DIR.L, DIR.R];
    while (q.length) {
      const u = q.shift();
      if (u.c === b.c && u.r === b.r) return true;
      for (const d of dirs) {
        const { c: nc, r: nr } = addCell(u, d);
        if (!inBounds(nc, nr, w, h) || !pathable[nc][nr]) continue;
        const k = keyCell(nc, nr);
        if (vis.has(k)) continue;
        vis.add(k);
        q.push({ c: nc, r: nr });
      }
    }
    return false;
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
  function findSimplePath(pathable, start, goal, rng, maxLen) {
    const w = pathable.length;
    const h = pathable[0].length;
    const path = [];
    const visited = /* @__PURE__ */ new Set();
    function neighbors(cell) {
      const n = [];
      for (const d of [DIR.U, DIR.D, DIR.L, DIR.R]) {
        const { c: nc, r: nr } = addCell(cell, d);
        if (inBounds(nc, nr, w, h) && pathable[nc][nr]) n.push({ c: nc, r: nr });
      }
      for (let i = n.length - 1; i > 0; i--) {
        const j = Math.floor(rng() * (i + 1));
        [n[i], n[j]] = [n[j], n[i]];
      }
      return n;
    }
    function dfs(cur) {
      if (path.length > maxLen) return false;
      visited.add(keyCell(cur.c, cur.r));
      path.push(cur);
      if (cur.c === goal.c && cur.r === goal.r) return true;
      for (const n of neighbors(cur)) {
        const k = keyCell(n.c, n.r);
        if (visited.has(k)) continue;
        if (dfs(n)) return true;
      }
      path.pop();
      visited.delete(keyCell(cur.c, cur.r));
      return false;
    }
    if (!dfs(start)) return null;
    return path;
  }
  function addDeadEndBranches(pathable, mainKeys, rng, budget) {
    const w = pathable.length;
    const h = pathable[0].length;
    let used = 0;
    const mainCells = Array.from(mainKeys).map((k) => {
      const [c, r] = k.split(",").map(Number);
      return { c, r };
    });
    for (const cell of mainCells.sort(() => rng() - 0.5)) {
      if (used >= budget) break;
      if (rng() > 0.4) continue;
      const dirs = [DIR.U, DIR.D, DIR.L, DIR.R].sort(() => rng() - 0.5);
      for (const d of dirs) {
        let cur = addCell(cell, d);
        let steps = 0;
        while (steps < 4 && inBounds(cur.c, cur.r, w, h) && !pathable[cur.c][cur.r] && used < budget) {
          pathable[cur.c][cur.r] = true;
          used++;
          steps++;
          if (rng() < 0.35) break;
          cur = addCell(cur, d);
        }
        if (steps) break;
      }
    }
  }
  function createStageRng(seed) {
    let s = seed >>> 0;
    return () => {
      s = s * 1664525 + 1013904223 >>> 0;
      return s / 4294967296;
    };
  }
  function randomNonZeroSplit(target, parts, rng) {
    if (parts === 0) return target === 0 ? [] : null;
    if (parts === 1) return target !== 0 ? [target] : null;
    for (let attempt = 0; attempt < 120; attempt++) {
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
  function grade3RevisitOneCellRule(path) {
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
    if (i0 <= 0 || i1 >= path.length - 1) return false;
    if (interiorPassageKind(path, i0) !== "bend") return false;
    if (interiorPassageKind(path, i1) !== "bend") return false;
    const dIn1 = unitStepDir(path[i0].c - path[i0 - 1].c, path[i0].r - path[i0 - 1].r);
    const dOut1 = unitStepDir(path[i0 + 1].c - path[i0].c, path[i0 + 1].r - path[i0].r);
    const dIn2 = unitStepDir(path[i1].c - path[i1 - 1].c, path[i1].r - path[i1 - 1].r);
    if (!dIn1 || !dOut1 || !dIn2) return false;
    const okIn2 = dirsEqual(dIn2, negateDir(dIn1)) || dirsEqual(dIn2, dOut1);
    if (!okIn2) return false;
    const nb = (p) => keyCell(p.c, p.r);
    const neigh = /* @__PURE__ */ new Set([
      nb(path[i0 - 1]),
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
    for (let tryR = 0; tryR < 40; tryR++) {
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
  function pathOrthStepValid(path, pathable, w, h) {
    for (const cell of path) {
      if (!inBounds(cell.c, cell.r, w, h) || !pathable[cell.c][cell.r]) return false;
    }
    for (let i = 1; i < path.length; i++) {
      if (!unitStepDir(path[i].c - path[i - 1].c, path[i].r - path[i - 1].r)) return false;
    }
    return true;
  }
  function validateGrade2RotatedPorts(p, w, h) {
    const fs = pathFirstStepDir(p);
    if (!fs || !dirsEqual(fs, DIR.U)) return false;
    const start = p[0];
    const goal = p[p.length - 1];
    const startPad = { c: start.c, r: start.r + 1 };
    const prev = p[p.length - 2];
    const dLast = unitDirBetween(prev, goal);
    if (!dLast) return false;
    const goalPad = { c: goal.c + dLast.dx, r: goal.r + dLast.dy };
    if (!isStrictlyOutsideBoard(goalPad.c, goalPad.r, w, h)) return false;
    const dEntry = unitOrthoDirBetween(startPad, start);
    if (!dEntry || !dirsEqual(dEntry, DIR.U)) return false;
    return true;
  }
  function normalizeGrade2OppositePadPolyline(p, pathable, w, h) {
    const start = p[0];
    const goal = p[p.length - 1];
    const startPad = { c: start.c, r: start.r + 1 };
    const prev = p[p.length - 2];
    const dLast = unitDirBetween(prev, goal);
    if (!dLast) return { kind: "ok", path: p };
    const goalPad = { c: goal.c + dLast.dx, r: goal.r + dLast.dy };
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
      const p22 = flipSubpathVerticalR(p, pIdx, p.length - 1, pCell.r);
      if (!pathOrthStepValid(p22, pathable, w, h) || !validateGrade2RotatedPorts(p22, w, h)) {
        return { kind: "retry" };
      }
      const k2 = keyCell(p22[pIdx].c, p22[pIdx].r);
      return { kind: "ok", path: p22, label: "goal->upside down", swapSlashKey: k2 };
    }
    const revisitQ = pathVisitCount(p, qCell.c, qCell.r) >= 2;
    if (revisitQ) return { kind: "retry" };
    const p2 = flipSubpathVerticalR(p, 0, qIdx, qCell.r);
    if (!pathOrthStepValid(p2, pathable, w, h)) return { kind: "retry" };
    const p3 = p2.slice().reverse();
    if (!pathOrthStepValid(p3, pathable, w, h) || !validateGrade2RotatedPorts(p3, w, h)) {
      return { kind: "retry" };
    }
    const k = keyCell(p3[p3.length - 1 - qIdx].c, p3[p3.length - 1 - qIdx].r);
    return { kind: "ok", path: p3, label: "start->upside down", swapSlashKey: k };
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
      const norm = normalizeGrade2OppositePadPolyline(p, pb, w, h);
      if (norm.kind === "retry") continue;
      p = norm.path;
      const padAdjustLabel = norm.label;
      const swapSlashKey = norm.swapSlashKey;
      const start = p[0];
      const goal = p[p.length - 1];
      const startPad = { c: start.c, r: start.r + 1 };
      const prev = p[p.length - 2];
      const dLast = unitDirBetween(prev, goal);
      if (!dLast) continue;
      const goalPad = { c: goal.c + dLast.dx, r: goal.r + dLast.dy };
      if (!isStrictlyOutsideBoard(goalPad.c, goalPad.r, w, h)) continue;
      const dEntry = unitOrthoDirBetween(startPad, start);
      if (!dEntry || !dirsEqual(dEntry, DIR.U)) continue;
      const bendSet = bendCellsInPath(p);
      if (!(opts == null ? void 0 : opts.relaxBendVisit) && !grade2BendNoRevisit(p, bendSet)) continue;
      const { bumpers, ok } = placeDiagonalBumpersInterior(p);
      const needBumpers = (opts == null ? void 0 : opts.relaxBendVisit) ? bendSet.size : bends;
      if (!ok || bumpers.size !== needBumpers) continue;
      const bumpDup = new Map(bumpers);
      if (swapSlashKey) {
        const cell = bumpDup.get(swapSlashKey);
        if (cell && (cell.solution === "SLASH" || cell.solution === "BACKSLASH")) {
          const sol = wrongDiagonal(cell.solution);
          bumpDup.set(swapSlashKey, { display: sol, solution: sol });
        }
      }
      winners.push({
        width: w,
        height: h,
        pathable: pb,
        start,
        goal,
        startPad,
        goalPad,
        solutionPath: p,
        bumpers: bumpDup,
        grade2PadAdjustLabel: padAdjustLabel
      });
    }
    if (!winners.length) return null;
    return winners[Math.floor(rng() * winners.length)];
  }
  function generateGrade3Stage(seed) {
    const rng = createStageRng(seed);
    const { w: W, h: H } = boardSizeForGrade(3);
    const pathable = makeRect(W, H);
    const maxAttempts = 160;
    for (let attempt = 0; attempt < maxAttempts; attempt++) {
      const bottoms = bottomCandidates(pathable);
      const tops = topCandidates(pathable);
      if (!bottoms.length || !tops.length) return null;
      const start = bottoms[Math.floor(rng() * bottoms.length)];
      const goal = tops[Math.floor(rng() * tops.length)];
      const path = findGrade3SixBendPath(pathable, start, goal, rng);
      if (!path) continue;
      const picked = pickGrade2OrientedStage(pathable, path, W, H, 6, rng, { relaxBendVisit: true });
      if (!picked) continue;
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
        seed
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
  function generatePolylineStage(grade, seed) {
    const rng = createStageRng(seed);
    const { w: W, h: H } = boardSizeForGrade(grade);
    const pathable = makeRect(W, H);
    const maxAttempts = grade === 2 ? 1200 : 350;
    for (let attempt = 0; attempt < maxAttempts; attempt++) {
      const bottoms = bottomCandidates(pathable);
      const tops = topCandidates(pathable);
      if (!bottoms.length || !tops.length) return null;
      const start = bottoms[Math.floor(rng() * bottoms.length)];
      const goal = tops[Math.floor(rng() * tops.length)];
      const dc = goal.c - start.c;
      const dr = goal.r - start.r;
      let bends;
      if (grade === 1) {
        bends = Math.floor(rng() * 4) + 1;
      } else {
        bends = rng() < 0.5 ? 4 : 6;
        if (bends === 4 && (dc === 0 || dr === 0)) continue;
      }
      let path = null;
      const polyTries = grade === 2 && bends === 4 ? 40 : 24;
      for (let t = 0; t < polyTries; t++) {
        const firstH = grade === 2 && bends === 4 && t < 2 ? t % 2 === 0 : rng() < 0.5;
        path = tryOrthogonalPolyline(start, goal, bends, firstH, pathable, rng);
        if (path) break;
      }
      if (!path) continue;
      if (countRightAngles(path) !== bends) continue;
      if (grade === 2) {
        if (bends === 6) {
          if (!grade1NoRevisit(path)) continue;
        } else if (!pathHasOrthogonalCrossCell(path)) {
          continue;
        }
      }
      if (grade === 2) {
        const picked = pickGrade2OrientedStage(pathable, path, W, H, bends, rng);
        if (!picked) continue;
        const dup2 = /* @__PURE__ */ new Map();
        picked.bumpers.forEach((v, k) => dup2.set(k, { display: v.display, solution: v.solution }));
        shuffleWrongDisplay(dup2, rng);
        return {
          width: picked.width,
          height: picked.height,
          pathable: picked.pathable,
          start: picked.start,
          goal: picked.goal,
          startPad: picked.startPad,
          goalPad: picked.goalPad,
          bumpers: dup2,
          solutionPath: picked.solutionPath,
          grade,
          seed,
          grade2PadAdjustLabel: picked.grade2PadAdjustLabel
        };
      }
      const startPad = { c: start.c, r: start.r + 1 };
      const goalPad = { c: goal.c, r: goal.r - 1 };
      if (grade === 1) {
        if (!grade1NoRevisit(path)) continue;
      }
      const { bumpers, ok } = placeDiagonalBumpers(path, startPad, goalPad);
      if (!ok || bumpers.size === 0) continue;
      if (bumpers.size >= 5) continue;
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
        grade,
        seed
      };
    }
    return null;
  }
  function generateGridStage(grade, seed) {
    var _a, _b, _c;
    const g = Math.max(1, Math.min(5, Math.floor(grade)));
    if (g <= 2) return generatePolylineStage(grade, seed);
    if (g === 3) return generateGrade3Stage(seed);
    const rng = createStageRng(seed);
    const bumperN = bumpersForGrade(grade);
    const { w: W, h: H } = boardSizeForGrade(grade);
    const templates = templatesForBoard(W, H, grade);
    for (let attempt = 0; attempt < 200; attempt++) {
      const tIdx = Math.floor(rng() * templates.length);
      let pathable = templates[tIdx]();
      const w = pathable.length;
      const h = (_b = (_a = pathable[0]) == null ? void 0 : _a.length) != null ? _b : 0;
      const bottoms = bottomCandidates(pathable);
      const tops = topCandidates(pathable);
      if (!bottoms.length || !tops.length) continue;
      const start = bottoms[Math.floor(rng() * bottoms.length)];
      const goal = tops[Math.floor(rng() * tops.length)];
      if (!connected(pathable, start, goal)) continue;
      const maxLen = w * h + 5;
      const path = findSimplePath(pathable, start, goal, rng, maxLen);
      if (!path || path.length < bumperN + 2) continue;
      const innerIndices = [];
      for (let i = 1; i < path.length - 1; i++) innerIndices.push(i);
      for (let i = innerIndices.length - 1; i > 0; i--) {
        const j = Math.floor(rng() * (i + 1));
        [innerIndices[i], innerIndices[j]] = [innerIndices[j], innerIndices[i]];
      }
      const chosen = innerIndices.slice(0, bumperN).sort((a, b) => a - b);
      const bumpers = /* @__PURE__ */ new Map();
      const solutionKinds = [];
      let ok = true;
      for (const idx of chosen) {
        const prev = path[idx - 1];
        const cur = path[idx];
        const next = path[idx + 1];
        const dIn = unitStepDir(cur.c - prev.c, cur.r - prev.r);
        const dOut = unitStepDir(next.c - cur.c, next.r - cur.r);
        if (!dIn || !dOut) {
          ok = false;
          break;
        }
        const sol = bumperKindForTurn(dIn, dOut);
        if (sol == null) {
          ok = false;
          break;
        }
        const k = keyCell(cur.c, cur.r);
        solutionKinds.push({ key: k, sol });
        bumpers.set(k, { display: sol, solution: sol });
      }
      if (!ok) continue;
      const mainKeys = new Set(path.map((p) => keyCell(p.c, p.r)));
      const branchBudget = Math.min(14, Math.max(2, Math.floor(w * h / 5)));
      addDeadEndBranches(pathable, mainKeys, rng, branchBudget);
      for (const { key: bk, sol } of solutionKinds) {
        const wrongPool = ["SLASH", "BACKSLASH", "HYPHEN", "PIPE"].filter((x) => x !== sol);
        const display = (_c = wrongPool[Math.floor(rng() * wrongPool.length)]) != null ? _c : sol;
        bumpers.set(bk, { display, solution: sol });
      }
      let hasWrong = false;
      for (const { key: bk, sol } of solutionKinds) {
        if (bumpers.get(bk).display !== sol) hasWrong = true;
      }
      if (!hasWrong && solutionKinds.length) {
        const first = solutionKinds[0];
        const alts = ["SLASH", "BACKSLASH", "HYPHEN", "PIPE"].filter((x) => x !== first.sol);
        bumpers.set(first.key, { display: alts[0], solution: first.sol });
      }
      return {
        width: w,
        height: h,
        pathable,
        start,
        goal,
        startPad: { c: start.c, r: start.r + 1 },
        goalPad: { c: goal.c, r: goal.r - 1 },
        bumpers,
        solutionPath: path,
        grade,
        seed
      };
    }
    return null;
  }
  function fallbackGridStage(grade, seed) {
    var _a;
    const g = Math.max(1, Math.min(5, Math.floor(grade)));
    if (g === 1) {
      const w2 = 5;
      const h2 = 5;
      const pathable2 = makeRect(w2, h2);
      const start2 = { c: 1, r: 4 };
      const goal2 = { c: 1, r: 0 };
      const path2 = [];
      for (let c = 1; c <= 4; c++) path2.push({ c, r: 4 });
      for (let r = 3; r >= 0; r--) path2.push({ c: 4, r });
      for (let c = 3; c >= 1; c--) path2.push({ c, r: 0 });
      const startPad = { c: start2.c, r: start2.r + 1 };
      const goalPad = { c: goal2.c, r: goal2.r - 1 };
      const { bumpers: bumpers2, ok } = placeDiagonalBumpers(path2, startPad, goalPad);
      const dup = /* @__PURE__ */ new Map();
      if (ok) bumpers2.forEach((v, k) => dup.set(k, { display: v.display, solution: v.solution }));
      if (dup.size) shuffleWrongDisplay(dup, createStageRng(seed));
      return {
        width: w2,
        height: h2,
        pathable: pathable2,
        start: start2,
        goal: goal2,
        startPad,
        goalPad,
        bumpers: dup,
        solutionPath: path2,
        grade,
        seed
      };
    }
    if (g === 2) {
      const w2 = 5;
      const h2 = 5;
      const pathable2 = makeRect(w2, h2);
      const path2 = [
        { c: 1, r: 4 },
        { c: 2, r: 4 },
        { c: 3, r: 4 },
        { c: 4, r: 4 },
        { c: 4, r: 3 },
        { c: 4, r: 2 },
        { c: 3, r: 2 },
        { c: 2, r: 2 },
        { c: 1, r: 2 },
        { c: 0, r: 2 },
        { c: 0, r: 1 },
        { c: 0, r: 0 },
        { c: 1, r: 0 },
        { c: 2, r: 0 },
        { c: 2, r: 1 },
        { c: 2, r: 2 },
        { c: 2, r: 3 },
        { c: 3, r: 3 },
        { c: 3, r: 2 },
        { c: 3, r: 1 },
        { c: 3, r: 0 }
      ];
      const bends = countRightAngles(path2);
      const rng = createStageRng(seed);
      const picked = pickGrade2OrientedStage(pathable2, path2, w2, h2, bends, rng);
      if (!picked) {
        throw new Error("fallbackGridStage(2): pickGrade2OrientedStage failed");
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
        grade,
        seed,
        grade2PadAdjustLabel: picked.grade2PadAdjustLabel
      };
    }
    if (g === 3) {
      for (let t = 0; t < 80; t++) {
        const st = generateGrade3Stage(seed + t * 130051 >>> 0);
        if (st) return __spreadProps(__spreadValues({}, st), { grade: g, seed });
      }
      throw new Error("fallbackGridStage(3): generateGrade3Stage failed");
    }
    const { w, h } = boardSizeForGrade(grade);
    const pathable = makeRect(w, h);
    const mid = Math.floor(w / 2);
    const start = { c: mid, r: h - 1 };
    const goal = { c: mid, r: 0 };
    const path = [];
    for (let r = h - 1; r >= 0; r--) path.push({ c: mid, r });
    const bumperR = Math.min(h - 2, Math.max(1, Math.floor(h / 2)));
    const bumperCell = { c: mid, r: bumperR };
    const dIn = unitStepDir(0, -1);
    const dOut = unitStepDir(0, -1);
    const sol = (_a = bumperKindForTurn(dIn, dOut)) != null ? _a : "PIPE";
    const bumpers = /* @__PURE__ */ new Map();
    bumpers.set(keyCell(bumperCell.c, bumperCell.r), { display: "HYPHEN", solution: sol });
    return {
      width: w,
      height: h,
      pathable,
      start,
      goal,
      startPad: { c: start.c, r: start.r + 1 },
      goalPad: { c: goal.c, r: goal.r - 1 },
      bumpers,
      solutionPath: path,
      grade,
      seed
    };
  }
  function generateGridStageWithFallback(grade, seed) {
    var _a;
    return (_a = generateGridStage(grade, seed)) != null ? _a : fallbackGridStage(grade, seed);
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
    const { requestId, grade, seed } = msg;
    post({ type: "STATUS", status: "RUNNING", requestId });
    try {
      const t0 = performance.now();
      const board = generateGridStageWithFallback(grade, seed);
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
