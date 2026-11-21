/*
 * 研究資料（ERAS 個管師）：依 11/19 論文計畫書第三章第七節之三
 *   App 使用情形（T0–T1）：各衛教階段影片播放次數、觀看日期數、首次／最後觀看、完成單元數、再次衛教次數
 *   衛教理解達成率：首次通過率、再次衛教後達成率（teach-back 查核表，分母 15）
 * 一列＝一個病歷號（同病歷號多次登入合併）。去識別化版本只輸出研究編號。
 * ※ 資料僅存在本裝置 localStorage；正式收案需院內伺服器（資訊室／IRB 核准）。
 * ※ T0–T1 期間的切點（手術日麻醉前）App 無法自動判定，目前輸出全部紀錄，並列出最後觀看時間供研究者核對。
 */
(function () {
  var $ = function (id) { return document.getElementById(id); };
  if (!$('tblRs')) return;
  var NODES = window.ERAS_NODES, STAGES = window.ERAS_EDU_STAGES, ORDER = window.ERAS_ORDER;
  var Store = window.ERAS_STORE, TB = window.ERAS_TEACHBACK;
  var MAINS = ORDER.filter(function (k) { return NODES[k].main; });
  function pad(n) { return String(n).padStart(2, '0'); }
  function showIso(iso) { if (!iso) return ''; var d = new Date(iso); return d.getFullYear() + '/' + pad(d.getMonth() + 1) + '/' + pad(d.getDate()) + ' ' + pad(d.getHours()) + ':' + pad(d.getMinutes()); }
  function pct(x) { return Math.round(x * 1000) / 10; }
  function authed() { return window.ERAS_TEAM && window.ERAS_TEAM.isAdmin(); }

  function rows() {
    var by = {};
    Store.listPatients().forEach(function (p) { (by[p.mrn] = by[p.mrn] || []).push(p); });
    var tball = TB ? TB.all() : {};
    Object.keys(tball).forEach(function (m) { if (!by[m]) by[m] = []; });
    return Object.keys(by).sort().map(function (mrn) {
      var vs = by[mrn], plays = {}, dates = {}, done = {}, first = '', last = '', sim = false, name = '';
      STAGES.forEach(function (s) { plays[s.id] = 0; });
      vs.forEach(function (v) {
        name = name || v.name; sim = sim || !!v.simulated;
        if (!first || v.firstSeen < first) first = v.firstSeen;
        if (!last || v.lastSeen > last) last = v.lastSeen;
        Object.keys(v.nodes || {}).forEach(function (k) {
          var r = v.nodes[k], n = NODES[k]; if (!r || !n) return;
          if (plays[n.stage] != null) plays[n.stage] += (r.plays || 0);
          (r.playDates || []).forEach(function (d) { dates[d] = 1; });
          if (n.main && r.done) done[k] = 1;
        });
      });
      var stDone = STAGES.filter(function (s) {
        var ms = MAINS.filter(function (k) { return NODES[k].stage === s.id; });
        return ms.length && ms.every(function (k) { return done[k]; });
      }).length;
      var t = TB ? TB.get(mrn) : { studyId: '', items: {} }, sm = TB ? TB.summary(mrn) : null;
      if (tball[mrn] && tball[mrn].simulated) sim = true;
      return { mrn: mrn, name: name, studyId: t.studyId || '', plays: plays, nDates: Object.keys(dates).length,
        first: first, last: last, doneItems: Object.keys(done).length, doneStages: stDone, sm: sm, sim: sim };
    });
  }

  function head(withId) {
    var h = withId ? ['病歷號', '姓名', '研究編號'] : ['研究編號'];
    STAGES.forEach(function (s, i) { h.push('第' + (i + 1) + '階段影片播放次數'); });
    return h.concat(['影片播放總次數', '觀看日期數', '首次觀看', '最後觀看', '完成主要項目數(/' + MAINS.length + ')', '完成衛教階段數(/' + STAGES.length + ')',
      'teach-back 已評估項目數(/15)', '首次通過項目數', '首次通過率(%)', '再次衛教後已理解項目數', '再次衛教後達成率(%)', '未評估項目數', '尚未填寫項目數', '再次衛教次數', '模擬資料']);
  }
  function line(r, withId) {
    var a = withId ? [r.mrn, r.name, r.studyId] : [r.studyId || '（未填）'];
    var tot = 0; STAGES.forEach(function (s) { a.push(r.plays[s.id]); tot += r.plays[s.id]; });
    var sm = r.sm || {};
    return a.concat([tot, r.nDates, showIso(r.first), showIso(r.last), r.doneItems, r.doneStages,
      sm.assessed || 0, sm.first || 0, sm.n ? pct(sm.firstRate) : '', sm.final || 0, sm.n ? pct(sm.finalRate) : '', sm.notAssessed || 0, sm.blank == null ? '' : sm.blank, sm.reedu || 0, r.sim ? '是' : '否']);
  }

  function render() {
    if (!authed()) return;
    var list = rows(), hr = $('tblRs').querySelector('thead tr'), tb = $('tblRs').querySelector('tbody');
    hr.innerHTML = ''; tb.innerHTML = '';
    head(true).forEach(function (h, i) { var c = document.createElement('th'); c.textContent = h; if (i > 2) c.className = 'num'; hr.appendChild(c); });
    list.forEach(function (r) {
      var tr = document.createElement('tr');
      line(r, true).forEach(function (v, i) {
        var c = document.createElement('td'); c.textContent = v == null ? '' : v; if (i > 2) c.className = 'num';
        if (i === 1 && r.sim) c.textContent += '［模擬］';
        if (i === 2 && !v) { c.textContent = '未填'; c.className = 'sv-low'; }
        tr.appendChild(c);
      });
      tb.appendChild(tr);
    });
    $('rsEmpty').classList.toggle('hidden', list.length > 0);
  }

  function copy(btn, table) {
    var text = table.map(function (x) { return x.map(function (c) { return String(c == null ? '' : c).replace(/[\t\n\r]/g, ' '); }).join('\t'); }).join('\n');
    var orig = btn.textContent, done = function (m) { btn.textContent = m; setTimeout(function () { btn.textContent = orig; }, 2500); };
    var fallback = function () { var ta = $('copyBoxRs'); ta.value = text; ta.classList.remove('hidden'); ta.select(); done('請按 Ctrl+C 複製下方內容'); };
    if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(text).then(function () { done('已複製，可貼到 Excel'); }, fallback);
    else fallback();
  }
  $('btnRsCopyId').addEventListener('click', function () { copy(this, [head(false)].concat(rows().map(function (r) { return line(r, false); }))); });
  $('btnRsCopy').addEventListener('click', function () { copy(this, [head(true)].concat(rows().map(function (r) { return line(r, true); }))); });
  /* teach-back 長格式：一列＝一位病人的一個核心確認項目 */
  $('btnRsCopyTb').addEventListener('click', function () {
    var t = [['研究編號', '階段', '項目代碼', '核心確認項目', '首次評估', '首次評估時間', '再次評估', '再次評估時間', '最後評估', '未評估原因／備註', '模擬資料']];
    if (TB) Object.keys(TB.all()).sort().forEach(function (mrn) {
      var r = TB.get(mrn);
      TB.ITEMS.forEach(function (x) {
        var it = r.items[x.id] || {}, f = it.first || {}, s = it.second || {}, l = TB.latest(it) || {};
        var st = STAGES.filter(function (z) { return z.id === x.stage; })[0];
        t.push([r.studyId || '（未填）', st ? st.name : x.stage, x.id, x.text, f.result || '', showIso(f.at), s.result || '', showIso(s.at), l.result || '', l.note || '', r.simulated ? '是' : '否']);
      });
    });
    copy(this, t);
  });

  var tab = document.querySelector('.tab[data-tab=research]');
  if (tab) tab.addEventListener('click', render);
  window.ERAS_RESEARCH = { refresh: render };
  if (authed()) render();
})();
