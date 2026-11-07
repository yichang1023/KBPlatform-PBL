/* =====================================================================
 *  KB Replay — 各項目自己的「動態播放」(老師分析、學生分析共用)
 *  1) kbAttachSeriesPlayer:時間序列圖表(折線/面積)由左到右逐步長出來,從「起點」(空白)開始
 *  2) kbAttachReplay:累積型項目(分布圖、雷達圖、時間軸…)從「起點」(尚無任何貼文)開始,
 *     依發文日逐日累積,每個項目各自有播放鈕,只看想看的那一項。
 *  網路圖的播放(起點只有自己)在各頁面的 kbAttachPlayer。
 * ===================================================================== */
(function (global) {
  'use strict';
  var doc = global.document;
  var SPEEDS = [0.5, 1, 2, 4, 8];
  function lsGet(k, d) { try { var v = global.localStorage.getItem(k); return v === null ? d : v; } catch (e) { return d; } }
  function lsSet(k, v) { try { global.localStorage.setItem(k, v); } catch (e) {} }

  /* ---------- 共用:播放控制列 ---------- */
  function controls(opts) {
    var wrap = doc.createElement('div');
    wrap.setAttribute('data-kbnet', opts.id);
    wrap.addEventListener('click', function (e) { e.stopPropagation(); });
    wrap.style.cssText = opts.style || 'grid-column:1/-1;display:flex;align-items:center;gap:8px;flex-wrap:wrap;margin-top:6px;font-size:11px;color:#334155';
    var speed = Number(lsGet('kb_net_speed', '1')); if (SPEEDS.indexOf(speed) < 0) speed = 1;
    wrap.innerHTML = '<button type="button" data-a="play" style="padding:3px 10px;border-radius:6px;background:#4f46e5;color:#fff;font-weight:700;white-space:nowrap">▶ 播放</button>' +
      '<input type="range" data-a="seek" min="0" max="' + opts.max + '" value="' + opts.max + '" style="flex:1;min-width:90px">' +
      '<span data-a="label" style="min-width:' + (opts.labelWidth || 44) + 'px;font-weight:700;text-align:center"></span>' +
      '<label style="display:flex;align-items:center;gap:3px;white-space:nowrap">速度 <select data-a="speed" style="border:1px solid #cbd5e1;border-radius:4px;padding:1px 3px;background:#fff;color:#0f172a">' +
      SPEEDS.map(function (s) { return '<option value="' + s + '"' + (s === speed ? ' selected' : '') + '>' + s + 'x</option>'; }).join('') + '</select></label>';
    return { wrap: wrap, speed: function () { return Number(wrap.querySelector('[data-a=speed]').value) || 1; }, saveSpeed: function (v) { lsSet('kb_net_speed', String(v)); } };
  }

  /* ---------- 1) 時間序列圖表逐步長出來 ---------- */
  var seriesPlayers = {};
  global.kbAttachSeriesPlayer = function (o) {
    var chart = o.chart;
    if (global.__kbReplaying || !chart || !chart.data || !chart.canvas) return null;
    if (seriesPlayers[o.id]) seriesPlayers[o.id].destroy();
    var labels = (chart.data.labels || []).slice(), M = labels.length;
    if (M < 2) return null;
    var full = chart.data.datasets.map(function (d) { return d.data.slice(); });
    chart.data.datasets.forEach(function (d, i) { d.__full = full[i]; });   // 給 AI 解說用的完整資料
    // 先固定座標軸範圍,播放時圖才不會一直縮放跳動
    try {
      chart.options.scales = chart.options.scales || {};
      Object.keys(chart.scales).forEach(function (id) { var sc = chart.scales[id]; if (sc.type === 'linear') chart.options.scales[id] = Object.assign({}, chart.options.scales[id] || {}, { min: sc.min, max: sc.max }); });
    } catch (e) {}
    var st = { k: M, playing: false, timer: null, gone: false };
    var ui = controls({ id: o.id, max: M });
    var anchor = o.anchor || chart.canvas.parentElement;
    Array.prototype.forEach.call(doc.querySelectorAll('[data-kbnet="' + o.id + '"]'), function (x) { x.remove(); });
    anchor.insertAdjacentElement('afterend', ui.wrap);
    if (o.explainTitle && global.kbAddExplain) global.kbAddExplain(ui.wrap, { title: o.explainTitle, table: function () { return global.kbSeriesTable(chart); } }, o.id);
    var btn = ui.wrap.querySelector('[data-a=play]'), seek = ui.wrap.querySelector('[data-a=seek]'), label = ui.wrap.querySelector('[data-a=label]'), spSel = ui.wrap.querySelector('[data-a=speed]');
    function alive() { return !st.gone && chart.canvas && chart.canvas.isConnected !== false && chart.data; }
    function render(k) {
      if (!alive()) return;
      st.k = k;
      chart.data.datasets.forEach(function (ds, di) {
        var f = full[di];
        if (f.length && f[0] !== null && typeof f[0] === 'object' && f[0].x !== undefined) ds.data = f.filter(function (p) { return labels.indexOf(p.x) < k; }); // 散點(關鍵發言)
        else ds.data = f.map(function (v, j) { return j < k ? v : null; });
      });
      chart.update('none');
      seek.value = k; label.textContent = k === 0 ? '起點' : String(labels[k - 1]);
    }
    function delay() { return Math.max(150, Math.min(900, 16000 / M)) / ui.speed(); }
    function setPlaying(p) { st.playing = p; btn.textContent = p ? '⏸ 暫停' : '▶ 播放'; if (!p) { clearTimeout(st.timer); st.timer = null; } }
    function tick() { if (!st.playing || !alive()) { setPlaying(false); return; } if (st.k >= M) { setPlaying(false); return; } render(st.k + 1); if (st.k >= M) setPlaying(false); else st.timer = setTimeout(tick, delay()); }
    function play() { if (!alive()) return; if (st.k >= M) render(0); setPlaying(true); st.timer = setTimeout(tick, delay()); }
    btn.onclick = function () { if (st.playing) setPlaying(false); else play(); };
    seek.oninput = function () { setPlaying(false); render(Number(seek.value)); };
    spSel.onchange = function () { ui.saveSpeed(Number(spSel.value)); };
    label.textContent = String(labels[M - 1]);
    var api = { destroy: function () { st.gone = true; clearTimeout(st.timer); if (ui.wrap.parentNode) ui.wrap.parentNode.removeChild(ui.wrap); }, play: play, goto: render, state: st };
    seriesPlayers[o.id] = api;
    if (lsGet('kb_net_autoplay', '0') === '1' && !global.__kbReplayActive) setTimeout(function () { if (alive() && !st.playing) { render(0); play(); } }, 700);
    return api;
  };

  /* ---------- 2) 累積型項目:依發文日逐日累積 ---------- */
  var replayPlayers = {};
  // o: { id, anchor(控制列放在這個元素後面), labels:['起點', 第1天, 第2天…], render(step) }  step=0 是起點
  global.kbAttachReplay = function (o) {
    var L = o.labels.length; if (global.__kbReplaying || L < 2 || !o.anchor) return null;
    if (replayPlayers[o.id]) replayPlayers[o.id].destroy();
    var st = { k: L - 1, playing: false, timer: null, gone: false };
    var ui = controls({ id: o.id, max: L - 1, labelWidth: 54 });
    Array.prototype.forEach.call(doc.querySelectorAll('[data-kbnet="' + o.id + '"]'), function (x) { x.remove(); });
    if (o.inside) o.anchor.appendChild(ui.wrap); else o.anchor.insertAdjacentElement('afterend', ui.wrap);
    if (o.explainTitle && global.kbAddExplain) global.kbAddExplain(ui.wrap, { title: o.explainTitle, table: function () { return o.labels.map(function (lb, i) { var v = ''; try { v = o.values ? o.values(i) : ''; } catch (e) {} return lb + ':' + v; }).join(String.fromCharCode(10)); } }, o.id);
    var btn = ui.wrap.querySelector('[data-a=play]'), seek = ui.wrap.querySelector('[data-a=seek]'), label = ui.wrap.querySelector('[data-a=label]'), spSel = ui.wrap.querySelector('[data-a=speed]');
    function alive() { return !st.gone && o.anchor.isConnected !== false; }
    function render(k) { if (!alive()) return; st.k = k; try { o.render(k); } catch (e) { if (global.console) console.error(e); } seek.value = k; label.textContent = String(o.labels[k]); }
    function delay() { return Math.max(250, Math.min(900, 15000 / L)) / ui.speed(); }
    function setPlaying(p) { st.playing = p; btn.textContent = p ? '⏸ 暫停' : '▶ 播放'; if (!p) { clearTimeout(st.timer); st.timer = null; } }
    function tick() { if (!st.playing || !alive()) { setPlaying(false); return; } if (st.k >= L - 1) { setPlaying(false); return; } render(st.k + 1); if (st.k >= L - 1) setPlaying(false); else st.timer = setTimeout(tick, delay()); }
    function play() { if (!alive()) return; if (st.k >= L - 1) render(0); setPlaying(true); st.timer = setTimeout(tick, delay()); }
    btn.onclick = function () { if (st.playing) setPlaying(false); else play(); };
    seek.oninput = function () { setPlaying(false); render(Number(seek.value)); };
    spSel.onchange = function () { ui.saveSpeed(Number(spSel.value)); };
    label.textContent = String(o.labels[L - 1]);
    var api = { destroy: function () { st.gone = true; clearTimeout(st.timer); if (ui.wrap.parentNode) ui.wrap.parentNode.removeChild(ui.wrap); }, play: play, goto: render, state: st };
    replayPlayers[o.id] = api;
    if (lsGet('kb_net_autoplay', '0') === '1') setTimeout(function () { if (alive() && !st.playing) { render(0); play(); } }, 700);
    return api;
  };
  // 依時間戳建立「起點 + 每個發文日」的步驟;idx(ts) 是該時間所屬的步驟,貼文在 step >= idx(ts) 時才出現
  global.kbStepDays = function (timestamps) {
    var d = global.kbMakeDays(timestamps);
    return { labels: ['起點'].concat(d.labels), idx: function (ts) { return d.index(ts) + 1; } };
  };
})(typeof window !== 'undefined' ? window : globalThis);
