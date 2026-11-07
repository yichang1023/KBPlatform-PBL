/* =====================================================================
 *  KB Forest — 知識森林(想法櫻花樹)
 *  把每一個討論區(組別)的討論串,畫成一棵櫻花樹:
 *    - 主貼文 = 種子/樹幹;每一則回應 = 一段枝條末端的一叢櫻花;分岔越多,樹冠越茂密
 *    - 播放時從「起點」(只有一顆種子)開始,依發文日逐步長出樹苗、樹枝、花苞,最後盛開
 *    - 樹幹與枝條會隨著長出來的貼文變粗,整棵樹也會慢慢長大
 *  純 SVG,不需要任何外部套件。
 *  依賴:頁面內的 kbMakeDays、kbThreadPos(時間軸)。
 * ===================================================================== */
(function (global) {
  'use strict';
  var doc = global.document, NS = 'http://www.w3.org/2000/svg';
  var W = 400, H = 470, BX = 200, BY = 444, TRUNK = 100, CX = 200, CY = BY - TRUNK, R = 172, SPREAD = 116 * Math.PI / 180, D0 = 9;
  var TYPE_TXT = { question: '提問', extend: '延伸', improve: '改進', counter: '反駁', riseabove: '整合' };
  var PALETTE = {
    question: ['#f48fb1', '#f8a5c2', '#f06292'],
    extend: ['#f8bbd0', '#fbd0df', '#f6a9c3'],
    improve: ['#f06292', '#f48fb1', '#ec7fa4'],
    counter: ['#e8508d', '#ef7aa5', '#f48fb1'],
    riseabove: ['#ffffff', '#ffeef4', '#ffd9e5']
  };

  /* ---------- 小工具 ---------- */
  function h32(str) { var h = 2166136261; str = String(str); for (var i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; }
  function rng(seed) { var a = seed >>> 0; return function () { a = (a + 0x6D2B79F5) | 0; var t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
  function el(name, attrs, parent) { var e = doc.createElementNS(NS, name); if (attrs) for (var k in attrs) e.setAttribute(k, attrs[k]); if (parent) parent.appendChild(e); return e; }
  function f1(v) { return Math.round(v * 10) / 10; }

  var cssDone = false;
  function injectCSS() {
    if (cssDone || doc.getElementById('kb-forest-style')) { cssDone = true; return; }
    var s = doc.createElement('style'); s.id = 'kb-forest-style';
    s.textContent = [
      '.kf-wrap{display:grid;grid-template-columns:repeat(auto-fit,minmax(290px,1fr));gap:14px}',
      '.kf-card{position:relative;background:linear-gradient(180deg,#fff7fa 0%,#fffdfd 55%,#fdf1f5 100%);border:1px solid #fbd3e0;border-radius:16px;padding:8px 8px 4px;overflow:hidden}',
      '.kf-head{display:flex;justify-content:space-between;align-items:flex-start;gap:6px;padding:2px 6px}',
      '.kf-name{font-weight:800;font-size:12px;color:#9d174d;line-height:1.35}',
      '.kf-stage{font-size:10px;font-weight:800;color:#fff;background:linear-gradient(135deg,#f472b6,#ec4899);border-radius:999px;padding:2px 9px;white-space:nowrap}',
      '.kf-meta{font-size:10px;color:#9f7a89;padding:0 6px 2px}',
      '.kf-svg{width:100%;height:auto;display:block}',
      '.kf-b{opacity:0;transform:scale(.15);transform-box:fill-box;transform-origin:center;transition:opacity .55s ease,transform .7s cubic-bezier(.2,1.5,.4,1);cursor:pointer}',
      '.kf-b.on{opacity:1;transform:scale(1)}',
      '.kf-b:hover circle{filter:brightness(1.08)}',
      '.kf-e{transition:stroke-dashoffset .8s ease,opacity .4s ease}',
      '.kf-m{opacity:0;transform:scale(.2);transform-box:fill-box;transform-origin:center;transition:opacity .8s ease,transform 1s ease}.kf-m.on{opacity:1}',
      '.kf-tree{transition:transform 1s ease}',
      '.kf-fp{opacity:0;transition:opacity .6s}.kf-fp.on{opacity:.95}',
      '.kf-fall{opacity:0}.kf-fall.on{opacity:.9;animation:kf-fall 9s linear infinite}',
      '@keyframes kf-fall{0%{transform:translate(0,-20px) rotate(0deg);opacity:0}10%{opacity:.9}100%{transform:translate(var(--dx,20px),360px) rotate(300deg);opacity:0}}',
      '.kf-seed{transition:opacity .5s}',
      '.kf-tip{position:fixed;z-index:10050;pointer-events:none;background:rgba(15,23,42,.92);color:#fff;border-radius:10px;padding:8px 10px;font-size:11px;line-height:1.55;max-width:240px;box-shadow:0 12px 30px -10px rgba(0,0,0,.6);display:none}',
      '.kf-legend{display:flex;flex-wrap:wrap;gap:10px;align-items:center;font-size:10px;color:#7c5a69;margin-top:8px}',
      '.kf-dot{display:inline-block;width:10px;height:10px;border-radius:50%;margin-right:3px;vertical-align:-1px;border:1px solid rgba(0,0,0,.08)}'
    ].join('\n');
    (doc.head || doc.documentElement).appendChild(s); cssDone = true;
  }

  /* ---------- 排版:把討論串排成一棵樹 ---------- */
  // 以「放射狀樹」排出樹冠:樹根在樹幹頂端,往上往外展開;很深的討論串半徑會慢慢收斂,自然聚成濃密的花叢
  function layoutTree(nodes, rankOf) {
    var byId = {}, kids = {}, roots = [];
    nodes.forEach(function (n) { byId[n.id] = n; });
    nodes.forEach(function (n) { if (n.parentId && byId[n.parentId]) (kids[n.parentId] = kids[n.parentId] || []).push(n); else roots.push(n); });
    roots.sort(function (a, b) { return a.date - b.date; });
    var root = roots[0]; if (!root) return null;
    for (var i = 1; i < roots.length; i++) (kids[root.id] = kids[root.id] || []).push(roots[i]);
    var info = {}, order = [];
    (function size(n) { var s = 1; (kids[n.id] || []).forEach(function (k) { s += size(k); }); info[n.id] = { n: n, size: s, kids: kids[n.id] || [] }; return s; })(root);
    var maxDepth = 0;
    (function place(n, depth, a0, a1, parentId) {
      var inf = info[n.id], rg = rng(h32(n.id)), width = a1 - a0, mid = (a0 + a1) / 2;
      var wob = Math.sin(depth * 1.9 + rg() * 6.28) * Math.min(width * 0.16, 0.30) * Math.min(1, depth / 3);
      var ang = depth === 0 ? 0 : mid + wob;
      // 半徑依「發文先後」由內往外:早期的想法靠近樹幹、後來的往外長,整個樹冠就會慢慢被花填滿(密度均勻,像向日葵的排法)
      var rk = (rankOf ? rankOf(n.id) : depth) / Math.max(1, nodes.length - 1);
      var rad = depth === 0 ? 7 : R * (0.10 + 0.90 * Math.sqrt(rk));
      rad *= 1 + (rg() - 0.5) * 0.18;
      ang += (rg() - 0.5) * 0.62 * (0.25 + rad / R) * (depth === 0 ? 0 : 1);   // 越外圈,散開越寬,避免變成一條條的輻條
      inf.x = CX + Math.sin(ang) * rad; inf.y = CY - Math.cos(ang) * rad * 0.97; inf.depth = depth; inf.parent = parentId || null; inf.ang = ang;
      maxDepth = Math.max(maxDepth, depth); order.push(n.id);
      var ks = (kids[n.id] || []).slice(); if (!ks.length) return;
      ks.sort(function (a, b) { return h32(a.id) - h32(b.id); });
      var tot = 0, ws = ks.map(function (k) { var w = info[k.id].size + 0.3; tot += w; return w; }), cur = a0;
      ks.forEach(function (k, idx) { var span = (a1 - a0) * ws[idx] / tot; place(k, depth + 1, cur, cur + span, n.id); cur += span; });
    })(root, 0, -SPREAD, SPREAD, null);
    // 每個子樹的重心,以及「分枝骨架」(子樹夠大的節點):樹枝畫在骨架上,粗細依子樹大小,看起來像真正一層一層分枝的樹
    (function cen(n) {
      var inf = info[n.id], sx = inf.x, sy = inf.y, c = 1;
      inf.kids.forEach(function (k) { var r = cen(k); sx += r.sx; sy += r.sy; c += r.c; });
      inf.cx = sx / c; inf.cy = sy / c; inf.sx = sx; inf.sy = sy; inf.c = c; return { sx: sx, sy: sy, c: c };
    })(root);
    var SK = 8, skel = [];
    (function mark(n, skParent) {
      var inf = info[n.id], isSk = (n === root) || inf.size >= SK;
      if (isSk) { inf.skParent = skParent; skel.push(n.id); }
      inf.kids.forEach(function (k) { mark(k, isSk ? n.id : skParent); });
    })(root, null);
    return { root: root, info: info, order: order, skel: skel, total: nodes.length, forks: nodes.filter(function (n) { return (kids[n.id] || []).length >= 2; }).length };
  }

  /* ---------- 畫一棵樹 ---------- */
  function drawTree(host, lay, ctx) {
    var uid = 'kf' + Math.random().toString(36).slice(2, 7);
    var bs = Math.max(0.95, Math.min(1.9, Math.sqrt(1.3 * R * R * 0.85 / (Math.max(20, lay.total) * 100))));
    var svg = el('svg', { viewBox: '0 120 ' + W + ' ' + (H - 120), class: 'kf-svg', role: 'img', 'aria-label': ctx.name + ' 的想法櫻花樹' }, host);
    var defs = el('defs', null, svg);
    var gSky = el('linearGradient', { id: uid + 's', x1: '0', y1: '0', x2: '0', y2: '1' }, defs);
    el('stop', { offset: '0', 'stop-color': '#fff5f9' }, gSky); el('stop', { offset: '1', 'stop-color': '#fffdfe' }, gSky);
    var gBark = el('linearGradient', { id: uid + 'b', x1: '0', y1: '0', x2: '1', y2: '0' }, defs);
    el('stop', { offset: '0', 'stop-color': '#5b3a36' }, gBark); el('stop', { offset: '.45', 'stop-color': '#8a5c55' }, gBark); el('stop', { offset: '1', 'stop-color': '#4a2f2c' }, gBark);
    var gGround = el('radialGradient', { id: uid + 'g', cx: '.5', cy: '.5', r: '.5' }, defs);
    el('stop', { offset: '0', 'stop-color': '#c98a8f', 'stop-opacity': '.85' }, gGround); el('stop', { offset: '.6', 'stop-color': '#f2c0cf', 'stop-opacity': '.55' }, gGround); el('stop', { offset: '1', 'stop-color': '#fde7ee', 'stop-opacity': '0' }, gGround);
    // 水彩感:花叢邊緣略帶不規則暈染
    var flt = el('filter', { id: uid + 'w', x: '-8%', y: '-8%', width: '116%', height: '116%' }, defs);
    el('feTurbulence', { type: 'fractalNoise', baseFrequency: '0.045', numOctaves: '2', seed: String(h32(ctx.name) % 90), result: 'n' }, flt);
    el('feDisplacementMap', { in: 'SourceGraphic', in2: 'n', scale: '4.5', result: 'd' }, flt);
    el('feGaussianBlur', { in: 'd', stdDeviation: '0.55' }, flt);
    var fltM = el('filter', { id: uid + 'm', x: '-30%', y: '-30%', width: '160%', height: '160%' }, defs);
    el('feGaussianBlur', { stdDeviation: '9' }, fltM);
    el('rect', { x: 0, y: 0, width: W, height: H, fill: 'url(#' + uid + 's)' }, svg);

    // 地面與落花
    el('ellipse', { cx: BX, cy: BY + 4, rx: 150, ry: 22, fill: 'url(#' + uid + 'g)' }, svg);
    var fpLayer = el('g', null, svg), fps = [], rf = rng(h32(ctx.name + 'fp'));
    for (var i = 0; i < 70; i++) {
      var a = rf() * 6.283, d = Math.sqrt(rf()) * 128;
      fps.push(el('ellipse', { cx: f1(BX + Math.cos(a) * d), cy: f1(BY + 6 + Math.sin(a) * d * 0.15), rx: f1(2 + rf() * 1.6), ry: f1(1 + rf() * .9), fill: PALETTE.extend[i % 3], class: 'kf-fp', transform: 'rotate(' + Math.round(rf() * 180) + ' ' + f1(BX + Math.cos(a) * d) + ' ' + f1(BY + 6 + Math.sin(a) * d * 0.15) + ')' }, fpLayer));
    }
    // 種子(起點)
    var seed = el('g', { class: 'kf-seed' }, svg);
    el('ellipse', { cx: BX, cy: BY - 3, rx: 7, ry: 4.4, fill: '#7a4b3d' }, seed);
    el('ellipse', { cx: BX - 2, cy: BY - 4.5, rx: 3, ry: 1.4, fill: '#a9735f' }, seed);
    el('path', { d: 'M' + BX + ' ' + (BY - 6) + ' q-1 -9 -6 -13 M' + BX + ' ' + (BY - 6) + ' q1 -9 6 -13', stroke: '#7cb342', 'stroke-width': 2, fill: 'none', 'stroke-linecap': 'round' }, seed);

    // 樹(整棵會隨成長慢慢放大)
    var tree = el('g', { class: 'kf-tree' }, svg); tree.style.transformOrigin = BX + 'px ' + BY + 'px';
    var trunk = el('path', { fill: 'url(#' + uid + 'b)' }, tree);
    var trunkHi = el('path', { fill: 'none', stroke: '#b98a80', 'stroke-opacity': '.45', 'stroke-linecap': 'round' }, tree);
    var roots = el('path', { fill: '#5b3a36' }, tree);
    var massLayer = el('g', { filter: 'url(#' + uid + 'm)' }, tree);
    var edgeLayer = el('g', { fill: 'none', 'stroke-linecap': 'round' }, tree);
    var edges = {}, skels = {}, masses = {};
    lay.skel.forEach(function (id) {
      var inf = lay.info[id], r0 = rng(h32(id + 'm'));
      var m = el('circle', { cx: f1(inf.cx), cy: f1(inf.cy), r: f1(Math.min(46, 4.2 * Math.sqrt(inf.size) + 6)), fill: PALETTE.question[1 + (r0() > .5 ? 1 : 0)], 'fill-opacity': '.30', class: 'kf-m' }, massLayer);
      masses[id] = m;
      var p = inf.skParent ? lay.info[inf.skParent] : null, x0 = p ? p.cx : CX, y0 = p ? p.cy : CY;
      var dx = inf.cx - x0, dy = inf.cy - y0, dist = Math.sqrt(dx * dx + dy * dy) || 1, bend = (r0() - 0.5) * 0.3 * dist;
      var qx = x0 + dx * 0.5 + (-dy / dist) * bend, qy = y0 + dy * 0.5 + (dx / dist) * bend - dist * 0.08;
      var path = el('path', { d: 'M' + f1(x0) + ' ' + f1(y0) + ' Q' + f1(qx) + ' ' + f1(qy) + ' ' + f1(inf.cx) + ' ' + f1(inf.cy), class: 'kf-e', stroke: '#6f433d' }, edgeLayer);
      var len = Math.ceil(dist * 1.12) + 2; path.setAttribute('stroke-dasharray', len); path.setAttribute('stroke-dashoffset', len);
      skels[id] = { el: path, len: len };
    });
    lay.order.forEach(function (id) {
      var inf = lay.info[id]; if (!inf.parent) return;
      var p = lay.info[inf.parent], dx = inf.x - p.x, dy = inf.y - p.y, dist = Math.sqrt(dx * dx + dy * dy) || 1, r = rng(h32(id + 'e'));
      if (dist > 26) return;   // 太長的連線不畫(像蜘蛛絲),只畫短短的小枝
      var bend = (r() - 0.5) * 0.34 * dist, nx = -dy / dist, ny = dx / dist;
      var qx = p.x + dx * 0.5 + nx * bend, qy = p.y + dy * 0.5 + ny * bend - dist * 0.10;
      var path = el('path', { d: 'M' + f1(p.x) + ' ' + f1(p.y) + ' Q' + f1(qx) + ' ' + f1(qy) + ' ' + f1(inf.x) + ' ' + f1(inf.y), class: 'kf-e', stroke: '#7a4a44' }, edgeLayer);
      var len = Math.ceil(dist * 1.12) + 2; path.setAttribute('stroke-dasharray', len); path.setAttribute('stroke-dashoffset', len);
      edges[id] = { el: path, len: len };
    });
    var rootInf = lay.info[lay.root.id];
    var rootEdge = el('path', { d: 'M' + CX + ' ' + CY + ' L' + f1(rootInf.x) + ' ' + f1(rootInf.y), fill: 'none', stroke: '#6a413c', 'stroke-linecap': 'round' }, edgeLayer);
    // 花
    var bloomLayer = el('g', { filter: 'url(#' + uid + 'w)' }, tree);
    var blooms = {};
    lay.order.slice().sort(function (a, b) { return lay.info[a].depth - lay.info[b].depth; }).forEach(function (id) {
      var inf = lay.info[id], n = inf.n, pal = PALETTE[n.type] || PALETTE.extend, r = rng(h32(id + 'b'));
      var g = el('g', { class: 'kf-b', 'data-id': id }, bloomLayer);
      var big = (1 + Math.min(3, inf.kids.length) * 0.18) * bs;
      el('circle', { cx: f1(inf.x), cy: f1(inf.y), r: f1(8.5 * big), fill: pal[1], 'fill-opacity': '.30' }, g);
      for (var k = 0; k < 9; k++) {
        var a = (k / 9) * 6.283 + r() * 0.9, d = (2.2 + r() * 4.6) * big;
        el('circle', { cx: f1(inf.x + Math.cos(a) * d), cy: f1(inf.y + Math.sin(a) * d), r: f1((2.3 + r() * 2.2) * big), fill: pal[Math.floor(r() * 3)], 'fill-opacity': f1(0.78 + r() * 0.2) }, g);
      }
      el('circle', { cx: f1(inf.x - 1.5), cy: f1(inf.y - 1.5), r: f1(1.7 * big), fill: '#fff', 'fill-opacity': '.8' }, g);
      el('circle', { cx: f1(inf.x), cy: f1(inf.y), r: f1(1.2 * big), fill: n.type === 'riseabove' ? '#ffd54f' : '#e84a82', 'fill-opacity': '.75' }, g);
      blooms[id] = g;
    });
    // 飄落的花瓣
    var falls = [], rl = rng(h32(ctx.name + 'fl'));
    for (var q = 0; q < 9; q++) {
      var fx = 40 + rl() * 320, fy = 70 + rl() * 120;
      var pg = el('path', { d: 'M0 0 q3 -4 6 0 q-1 5 -6 0z', fill: PALETTE.extend[q % 3], class: 'kf-fall', transform: 'translate(' + f1(fx) + ' ' + f1(fy) + ')' }, svg);
      var wrap = el('g', { transform: 'translate(' + f1(fx) + ' ' + f1(fy) + ')' }, svg);
      svg.removeChild(pg); wrap.appendChild(pg); pg.setAttribute('transform', ''); pg.style.animationDelay = (-rl() * 9).toFixed(1) + 's'; pg.style.animationDuration = (7 + rl() * 5).toFixed(1) + 's'; pg.style.setProperty('--dx', (rl() * 60 - 20).toFixed(0) + 'px');
      falls.push(pg);
    }
    return { svg: svg, tree: tree, trunk: trunk, trunkHi: trunkHi, roots: roots, rootEdge: rootEdge, edges: edges, skels: skels, masses: masses, blooms: blooms, fps: fps, seed: seed, falls: falls };
  }

  function stageOf(visible, total) {
    if (visible === 0) return '種子';
    var f = visible / total;
    if (f >= 1) return '盛開';
    if (f < 0.08) return '樹苗';
    if (f < 0.30) return '長出枝條';
    if (f < 0.65) return '花苞滿枝';
    return '花開了';
  }

  /* ---------- 森林 ---------- */
  // opts = { nodes:[{id,topicId,author,parentId,type,title,date}], topics:[{id,name}], userList:{}, topicFilter, nameOf?(authorId) }
  var forests = new WeakMap();
  global.KBForest = {
    mount: function (container, opts) {
      injectCSS();
      var prev = forests.get(container); if (prev) prev.destroy();
      container.innerHTML = '';
      var nodes = (opts.nodes || []).filter(function (n) { return n && n.id !== undefined; });
      var topics = (opts.topics || []).slice();
      var byTopic = {}; nodes.forEach(function (n) { (byTopic[n.topicId] = byTopic[n.topicId] || []).push(n); });
      var topicList = Object.keys(byTopic).map(function (id) { var t = topics.filter(function (x) { return String(x.id) === String(id); })[0]; return { id: id, name: (t && t.name) || ('討論區 ' + id) }; });
      if (opts.topicFilter && opts.topicFilter !== 'all') topicList = topicList.filter(function (t) { return String(t.id) === String(opts.topicFilter); });
      topicList.sort(function (a, b) { return a.name < b.name ? -1 : 1; });
      // 時間軸:全部貼文共用,所有的樹同時依日期長大
      var days = global.kbMakeDays(nodes.map(function (n) { return n.date; }));
      var pos = global.kbThreadPos(nodes, function (n) { return n.date; });
      var stepOf = {}; nodes.forEach(function (n) { stepOf[n.id] = days.index(n.date, pos(n.id)); });
      var nameOf = opts.nameOf || function (id) { var u = (opts.userList || {})[id] || Object.values(opts.userList || {}).filter(function (x) { return String(x.id) === String(id); })[0]; return (u && u.name) || String(id); };

      var wrap = doc.createElement('div'); wrap.className = 'kf-wrap'; container.appendChild(wrap);
      var tip = doc.createElement('div'); tip.className = 'kf-tip'; doc.body.appendChild(tip);
      var trees = [];
      topicList.forEach(function (tp) {
        var tnodes = byTopic[tp.id], rank = {};
        tnodes.slice().sort(function (a, b) { return (stepOf[a.id] - stepOf[b.id]) || (String(a.id) < String(b.id) ? -1 : 1); }).forEach(function (n, i) { rank[n.id] = i; });
        var lay = layoutTree(tnodes, function (id) { return rank[id]; }); if (!lay) return;
        var card = doc.createElement('div'); card.className = 'kf-card';
        var short = String(tp.name).replace(/\s*KF論壇[:：]?\s*/, ':').replace(/^(第.組):?/, '$1 ');
        card.innerHTML = '<div class="kf-head"><div class="kf-name"></div><div class="kf-stage">種子</div></div><div class="kf-meta"></div>';
        card.querySelector('.kf-name').textContent = short;
        wrap.appendChild(card);
        var d = drawTree(card, lay, { name: tp.name });
        var authors = {}; tnodes.forEach(function (n) { authors[n.author] = 1; });
        var t = { topic: tp, lay: lay, d: d, card: card, stageEl: card.querySelector('.kf-stage'), metaEl: card.querySelector('.kf-meta'), nodes: tnodes, people: Object.keys(authors).length, vis: 0 };
        // 子樹的大小(給枝條粗細用),由深到淺累加
        t.order = lay.order.slice().sort(function (a, b) { return lay.info[b].depth - lay.info[a].depth; });
        trees.push(t);
        d.svg.addEventListener('mousemove', function (e) {
          var g = e.target.closest ? e.target.closest('.kf-b') : null;
          if (!g || !g.classList.contains('on')) { tip.style.display = 'none'; return; }
          var n = lay.info[g.getAttribute('data-id')].n;
          tip.innerHTML = '<b></b><div></div>';
          tip.firstChild.textContent = n.title || '(無標題)';
          tip.lastChild.textContent = nameOf(n.author) + ' · ' + new Date(n.date).toLocaleDateString('zh-TW') + ' · ' + (TYPE_TXT[n.type] || n.type) + ' · 引來 ' + lay.info[n.id].kids.length + ' 則回應';
          tip.style.display = 'block'; tip.style.left = Math.min(e.clientX + 14, global.innerWidth - 250) + 'px'; tip.style.top = (e.clientY + 14) + 'px';
        });
        d.svg.addEventListener('mouseleave', function () { tip.style.display = 'none'; });
      });

      var legend = doc.createElement('div'); legend.className = 'kf-legend';
      legend.innerHTML = ['question', 'extend', 'improve', 'counter', 'riseabove'].map(function (k) { return '<span><i class="kf-dot" style="background:' + PALETTE[k][0] + '"></i>' + TYPE_TXT[k] + (k === 'riseabove' ? '(白櫻、金色花心)' : '') + '</span>'; }).join('') + '<span style="margin-left:auto">一朵花 = 一則貼文;分岔越多,樹冠越茂密;滑鼠移到花上可以看內容</span>';
      container.appendChild(legend);

      function setStepValue(sv) {
        trees.forEach(function (t) {
          var lay = t.lay, d = t.d, visCount = {}, total = lay.total, vis = 0;
          t.order.forEach(function (id) { var inf = lay.info[id], on = stepOf[id] <= sv; visCount[id] = (visCount[id] || 0) + (on ? 1 : 0); if (on) vis++; if (inf.parent) visCount[inf.parent] = (visCount[inf.parent] || 0) + visCount[id]; });
          t.vis = vis; var frac = total ? vis / total : 0;
          lay.order.forEach(function (id) {
            var on = stepOf[id] <= sv, b = d.blooms[id]; if (b) b.classList.toggle('on', on);
            var e = d.edges[id]; if (e) { e.el.setAttribute('stroke-dashoffset', on ? 0 : e.len); e.el.setAttribute('stroke-width', f1(0.6 + 1.2 * Math.pow((visCount[id] || 0) / total, 0.5))); e.el.style.opacity = on ? 1 : 0; }
            var sk = d.skels[id]; if (sk) { var vc = visCount[id] || 0, inf2 = lay.info[id]; sk.el.setAttribute('stroke-dashoffset', vc > 0 ? 0 : sk.len); sk.el.setAttribute('stroke-width', f1(0.9 + 7 * Math.pow(vc / total, 0.62))); sk.el.style.opacity = vc > 0 ? 1 : 0; var mm = d.masses[id]; if (mm) { mm.classList.toggle('on', vc > 0); mm.style.transform = 'scale(' + f1(Math.min(1, Math.sqrt(vc / inf2.size))) + ')'; } }
          });
          // 樹幹:隨長出的貼文越來越粗;整棵樹也慢慢長大
          var g = Math.sqrt(frac), wb = 5 + 15 * g, wt = 2.2 + 6 * g, th = TRUNK * (vis === 0 ? 0.1 : (0.45 + 0.55 * Math.sqrt(frac)));
          var ty = BY - th, sway = 5;
          d.trunk.setAttribute('d', 'M' + f1(BX - wb) + ' ' + BY + ' C' + f1(BX - wb * 0.55) + ' ' + f1(BY - th * 0.35) + ' ' + f1(BX - wt - sway) + ' ' + f1(BY - th * 0.7) + ' ' + f1(BX - wt) + ' ' + f1(ty) + ' L' + f1(BX + wt) + ' ' + f1(ty) + ' C' + f1(BX + wt - sway) + ' ' + f1(BY - th * 0.7) + ' ' + f1(BX + wb * 0.55) + ' ' + f1(BY - th * 0.35) + ' ' + f1(BX + wb) + ' ' + BY + ' Z');
          d.trunkHi.setAttribute('d', 'M' + f1(BX + wb * 0.25) + ' ' + (BY - 4) + ' C' + f1(BX + wb * 0.2) + ' ' + f1(BY - th * 0.4) + ' ' + f1(BX + wt * 0.4) + ' ' + f1(BY - th * 0.7) + ' ' + f1(BX + wt * 0.3) + ' ' + f1(ty + 4));
          d.trunkHi.setAttribute('stroke-width', f1(1 + 2 * g));
          d.roots.setAttribute('d', 'M' + f1(BX - wb) + ' ' + BY + ' q' + f1(-wb * 0.9) + ' 4 ' + f1(-wb * 1.6) + ' 9 q' + f1(wb * 0.9) + ' -2 ' + f1(wb * 1.7) + ' -7z M' + f1(BX + wb) + ' ' + BY + ' q' + f1(wb * 0.9) + ' 4 ' + f1(wb * 1.6) + ' 9 q' + f1(-wb * 0.9) + ' -2 ' + f1(-wb * 1.7) + ' -7z');
          d.roots.style.opacity = vis === 0 ? 0 : 1; d.trunk.style.opacity = vis === 0 ? 0 : 1; d.trunkHi.style.opacity = vis === 0 ? 0 : 1;
          d.rootEdge.setAttribute('stroke-width', f1(Math.max(1.4, wt * 0.9)));
          d.rootEdge.setAttribute('d', 'M' + CX + ' ' + f1(ty) + ' L' + f1(lay.info[lay.root.id].x) + ' ' + f1(lay.info[lay.root.id].y));
          d.rootEdge.style.opacity = vis === 0 ? 0 : 1;
          var sc = vis === 0 ? 0.5 : (0.5 + 0.5 * Math.pow(frac, 0.45));
          d.tree.style.transform = 'scale(' + f1(sc) + ')';
          d.seed.style.opacity = vis === 0 ? 1 : 0;
          var nf = Math.round(Math.min(70, vis * 0.35));
          d.fps.forEach(function (f, i) { f.classList.toggle('on', i < nf); });
          d.falls.forEach(function (f) { f.classList.toggle('on', frac > 0.35); });
          var st = stageOf(vis, total); t.stageEl.textContent = st;
          t.metaEl.textContent = '貼文 ' + vis + ' / ' + total + ' 則 · ' + t.people + ' 位同學 · ' + lay.forks + ' 個分岔';
        });
      }
      var ctl = {
        labels: days.stepLabels, steps: days.steps, trees: trees,
        setStep: function (i) { setStepValue(days.steps[Math.max(0, Math.min(days.steps.length - 1, i))]); },
        valuesAt: function (i, scrub) {
          var sv = days.steps[Math.max(0, Math.min(days.steps.length - 1, i))];
          return trees.map(function (t) {
            var vis = t.nodes.filter(function (n) { return stepOf[n.id] <= sv; }).length;
            return (scrub ? scrub(t.topic.name) : t.topic.name).replace(/\s*KF論壇[:：]?.*$/, '') + ' ' + vis + '/' + t.lay.total + ' 則(' + stageOf(vis, t.lay.total) + ')';
          }).join(';');
        },
        // 給 AI 的資料:每個發文日結束時,每棵樹長到什麼程度
        table: function (scrub) {
          var rows = [];
          for (var i = 0; i < days.stepLabels.length; i++) {
            if (i > 0 && /\(/.test(days.stepLabels[i])) continue;
            var sv = days.steps[i], parts = trees.map(function (t) {
              var vis = t.nodes.filter(function (n) { return stepOf[n.id] <= sv; }).length;
              return (scrub ? scrub(t.topic.name) : t.topic.name).replace(/\s*KF論壇[:：]?.*$/, '') + ' ' + vis + '/' + t.lay.total + ' 則(' + stageOf(vis, t.lay.total) + ')';
            });
            rows.push(days.stepLabels[i] + ':' + parts.join(';'));
          }
          return rows.join(String.fromCharCode(10));
        },
        destroy: function () { try { tip.remove(); } catch (e) {} forests.delete(container); }
      };
      forests.set(container, ctl);
      ctl.setStep(days.steps.length - 1);   // 預設顯示完整盛開的樣子
      return ctl;
    }
  };
})(typeof window !== 'undefined' ? window : globalThis);
