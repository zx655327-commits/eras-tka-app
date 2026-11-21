/*
 * Teach-back 理解查核表（ERAS 個管師使用）＋研究編號
 * 依 11/19 論文計畫書（APP 版）第一章第五節、第三章第六節之三、第七節之三：
 *   五個衛教階段各 3 項核心確認項目，共 15 項；各項評為已理解、部分理解、尚未理解或未評估（記錄原因）。
 *   部分理解或尚未理解者，以標準化補充說明再次澄清並提供再次觀看，之後重新評估。
 *   衛教理解達成率：首次通過率＝首次評為已理解之項目數 ÷ 應評估項目數（15）× 100%；
 *                   再次衛教後達成率＝最後評估為已理解之項目數 ÷ 15 × 100%；
 *                   未評估項目不視為已理解、不自分母排除，另列數量與原因。
 *   App 內病人的勾選式自我檢核屬病人自評，不納入本達成率。
 * ※ 每階段第 1 項為計畫書所列核心問題舉例；第 2、3 項計畫書尚未列出，待專家內容效度審查（CVI）後填入。
 */
(function () {
  var KEY = 'eras_teachback_v1';
  var CFG = window.ERAS_CONFIG || {}, STAGES = window.ERAS_EDU_STAGES || [];
  var PENDING = '（待訂：專家內容效度審查後填入）';
  var Q1 = {
    s1: '手術前為什麼需要禁食禁飲？',
    s2: '進入手術室後大概會經歷哪些流程？',
    s3: '您知道有哪些止痛方式可以選擇嗎？如果術後疼痛，您可以如何告訴醫護人員？',
    s4: '術後早期下床與使用助行器時需要注意什麼？',
    s5: '出院後出現哪些情形需要回診或求助？'
  };
  var ITEMS = [];
  STAGES.forEach(function (s) {
    [1, 2, 3].forEach(function (n) {
      ITEMS.push({ id: s.id + '_' + n, stage: s.id, no: n, text: n === 1 ? (Q1[s.id] || PENDING) : PENDING, pending: n !== 1 || !Q1[s.id] });
    });
  });
  var RESULTS = ['已理解', '部分理解', '尚未理解', '未評估'];

  function load() { try { return JSON.parse(localStorage.getItem(KEY)) || {}; } catch (e) { return {}; } }
  function save(all) { try { localStorage.setItem(KEY, JSON.stringify(all)); return true; } catch (e) { return false; } }
  function rec(all, mrn) { return all[mrn] || (all[mrn] = { studyId: '', items: {} }); }

  var T = {
    ITEMS: ITEMS, RESULTS: RESULTS,
    get: function (mrn) { var a = load(); return a[mrn] || { studyId: '', items: {} }; },
    all: function () { return load(); },
    setStudyId: function (mrn, id) { var a = load(); rec(a, mrn).studyId = id; save(a); },
    setItem: function (mrn, itemId, round, data) {
      var a = load(), r = rec(a, mrn); var it = r.items[itemId] || (r.items[itemId] = {});
      if (!data || !data.result) delete it[round]; else it[round] = data;
      if (round === 'first' && (!it.first || it.first.result === '已理解' || it.first.result === '未評估')) delete it.second;
      r.simulated = !!CFG.demo; save(a);
    },
    latest: function (it) { return it ? (it.second && it.second.result ? it.second : it.first) : null; },
    /* 衛教理解達成率 */
    summary: function (mrn) {
      var r = T.get(mrn), n = ITEMS.length, first = 0, fin = 0, na = 0, blank = 0, reedu = 0, assessed = 0;
      ITEMS.forEach(function (x) {
        var it = r.items[x.id], last = T.latest(it);
        if (it && it.first && it.first.result === '已理解') first++;
        if (last && last.result === '已理解') fin++;
        if (!last) blank++; else if (last.result === '未評估') na++;
        if (it && it.second && it.second.result) reedu++;
        if (it && it.first && it.first.result) assessed++;
      });
      return { n: n, first: first, final: fin, notAssessed: na, blank: blank, reedu: reedu, assessed: assessed,
        firstRate: n ? first / n : 0, finalRate: n ? fin / n : 0 };
    },
    /* 展示用模擬資料（僅 SIM 病歷號，標示為模擬） */
    seedSim: function () {
      var a = load(); if (a.SIM0001) return;
      var at = new Date().toISOString(), res = {};
      ITEMS.forEach(function (x, i) {
        var f = i % 5 === 3 ? '部分理解' : (i === 14 ? '未評估' : '已理解');
        res[x.id] = { first: { result: f, note: f === '未評估' ? '模擬：病人疲倦，改日評估' : '', at: at, by: 'ERAS 個管師' } };
        if (f === '部分理解') res[x.id].second = { result: '已理解', note: '', at: at, by: 'ERAS 個管師' };
      });
      a.SIM0001 = { studyId: 'E001（模擬）', items: res, simulated: true };
      save(a);
    },
    removeSimulated: function () { var a = load(); Object.keys(a).forEach(function (k) { if (a[k].simulated) delete a[k]; }); save(a); }
  };
  window.ERAS_TEACHBACK = T;

  /* ───────── 團隊端畫面：照護紀錄頁（個管師）內的查核表 ───────── */
  var box = document.getElementById('tbCard');
  if (!box) return;
  var $ = function (id) { return document.getElementById(id); };
  function roleName() {
    var id = null; try { id = sessionStorage.getItem('eras_team_role'); } catch (e) {}
    var r = (window.ERAS_ROLES || []).filter(function (x) { return x.id === id; })[0]; return r ? r.name : '';
  }
  function pct(x) { return Math.round(x * 1000) / 10 + '%'; }
  function el(tag, cls, text) { var e = document.createElement(tag); if (cls) e.className = cls; if (text !== undefined) e.textContent = text; return e; }
  function sel(val, disabled) {
    var s = el('select', 'select'); s.disabled = !!disabled;
    var o = el('option', '', '—'); o.value = ''; s.appendChild(o);
    RESULTS.forEach(function (x) { var op = el('option', '', x); op.value = x; if (x === val) op.selected = true; s.appendChild(op); });
    return s;
  }

  function render(mrn) {
    box.innerHTML = '';
    var r = T.get(mrn), sm = T.summary(mrn);
    box.appendChild(el('h3', 'sec-h', 'Teach-back 理解查核表（ERAS 個管師）'));
    box.appendChild(el('p', 'hint', '各衛教階段完成後，請病人（必要時含主要照顧者）以自己的話說明，依判準評為已理解、部分理解或尚未理解。部分理解或尚未理解者，以標準化補充說明並提供再次觀看後，填寫「再次評估」。無法評估者選「未評估」並填寫原因。病人在 App 內的自我檢核不列入本達成率。'));

    var idRow = el('div', 'ci-form');
    idRow.appendChild(el('span', 'ci-time-label', '研究編號'));
    var sid = el('input'); sid.type = 'text'; sid.maxLength = 20; sid.value = r.studyId || ''; sid.placeholder = '例如 E001（匯出時取代可辨識資料）';
    var sidSave = el('button', 'btn ghost', '儲存編號'); sidSave.type = 'button';
    var sidMsg = el('span', 'hint');
    sidSave.addEventListener('click', function () { T.setStudyId(mrn, sid.value.trim()); sidMsg.textContent = '已儲存'; setTimeout(function () { sidMsg.textContent = ''; }, 2000); });
    idRow.appendChild(sid); idRow.appendChild(sidSave); idRow.appendChild(sidMsg);
    box.appendChild(idRow);

    var kp = el('div', 'tb-kpis');
    [['首次通過率', pct(sm.firstRate) + '（' + sm.first + ' / ' + sm.n + '）'], ['再次衛教後達成率', pct(sm.finalRate) + '（' + sm.final + ' / ' + sm.n + '）'],
     ['未評估（已記錄原因）', sm.notAssessed + ' 項'], ['尚未填寫', sm.blank + ' 項'], ['再次衛教', sm.reedu + ' 項']].forEach(function (x) {
      var d = el('div', 'kpi'); d.appendChild(el('div', 'v', x[1])); d.appendChild(el('div', 'l', x[0])); kp.appendChild(d);
    });
    box.appendChild(kp);

    var wrap = el('div', 'table-wrap'); var tbl = el('table', 'grid tb-table');
    var thead = el('thead'); var hr = el('tr');
    ['階段', '核心確認項目', '首次評估', '再次評估', '未評估原因／備註', '紀錄'].forEach(function (h) { hr.appendChild(el('th', '', h)); });
    thead.appendChild(hr); tbl.appendChild(thead);
    var tb = el('tbody');
    STAGES.forEach(function (s, si) {
      ITEMS.filter(function (x) { return x.stage === s.id; }).forEach(function (x, i) {
        var it = r.items[x.id] || {}, tr = el('tr');
        if (i === 0) { var c = el('td', 'tb-stage', '第' + '一二三四五'[si] + '階段\n' + s.name); c.rowSpan = 3; tr.appendChild(c); }
        tr.appendChild(el('td', 'wrap' + (x.pending ? ' tb-pending' : ''), x.no + '. ' + x.text));
        var f = sel(it.first && it.first.result), needSecond = function () { return f.value === '部分理解' || f.value === '尚未理解'; };
        var sc = sel(it.second && it.second.result, !needSecond());
        var note = el('input'); note.type = 'text'; note.maxLength = 100; note.value = (it.second && it.second.note) || (it.first && it.first.note) || '';
        note.placeholder = '選「未評估」時必填原因';
        var info = el('td', 'tb-log');
        var log = [];
        if (it.first) log.push('首次 ' + (it.first.at || '').slice(0, 16).replace('T', ' ') + ' ' + (it.first.by || ''));
        if (it.second) log.push('再次 ' + (it.second.at || '').slice(0, 16).replace('T', ' ') + ' ' + (it.second.by || ''));
        info.textContent = log.join('\n');
        function commit(round, s2) {
          var v = s2.value;
          if (v === '未評估' && !note.value.trim()) { note.focus(); note.classList.add('tb-miss'); return false; }
          note.classList.remove('tb-miss');
          T.setItem(mrn, x.id, round, v ? { result: v, note: note.value.trim(), at: new Date().toISOString(), by: roleName() } : null);
          return true;
        }
        f.addEventListener('change', function () { if (commit('first', f)) render(mrn); });
        sc.addEventListener('change', function () { if (commit('second', sc)) render(mrn); });
        note.addEventListener('change', function () {
          var round = sc.value ? 'second' : 'first', s2 = round === 'second' ? sc : f;
          if (s2.value) commit(round, s2);
        });
        [f, sc, note].forEach(function (e, k) { var c = el('td'); c.appendChild(e); tr.appendChild(c); });
        tr.appendChild(info);
        tb.appendChild(tr);
      });
    });
    tbl.appendChild(tb); wrap.appendChild(tbl); box.appendChild(wrap);
  }
  T.render = function (mrn, isAdmin) {
    box.classList.toggle('hidden', !isAdmin || !mrn);
    if (isAdmin && mrn) render(mrn);
  };
})();
