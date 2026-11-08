/* ERAS 團隊端：APAIS 術前心情量表結果（個管師） */
(function () {
  var A = window.ERAS_APAIS, CFG = window.ERAS_CONFIG;
  var $ = function (id) { return document.getElementById(id); };
  if (!A || !$('tblApSum')) return;
  function pad(n) { return String(n).padStart(2, '0'); }
  function showIso(iso) { if (!iso) return ''; var d = new Date(iso); return d.getFullYear() + '/' + pad(d.getMonth() + 1) + '/' + pad(d.getDate()) + ' ' + pad(d.getHours()) + ':' + pad(d.getMinutes()); }
  function td(t, cls) { var c = document.createElement('td'); c.textContent = t == null ? '' : t; if (cls) c.className = cls; return c; }
  function th(t, cls) { var c = document.createElement('th'); c.textContent = t; if (cls) c.className = cls; return c; }
  function authed() { return window.ERAS_TEAM && window.ERAS_TEAM.isAdmin(); }
  function tpName(id) { var t = A.POINTS.filter(function (x) { return x.id === id; })[0]; return t ? t.name : id; }
  function msd(v) {
    if (!v.length) return '—';
    var m = v.reduce(function (a, b) { return a + b; }, 0) / v.length;
    if (v.length < 2) return m.toFixed(2);
    var sd = Math.sqrt(v.reduce(function (a, b) { return a + (b - m) * (b - m); }, 0) / (v.length - 1));
    return m.toFixed(2) + ' ± ' + sd.toFixed(2);
  }

  function filtered() {
    var q = $('apq').value.trim().toUpperCase();
    return A.list().filter(function (r) { return !q || (r.name + ' ' + r.mrn).toUpperCase().indexOf(q) >= 0; });
  }

  function render() {
    if (!authed()) return;
    var list = filtered();
    /* 各時間點統計 */
    var sb = $('tblApSum').querySelector('tbody'); sb.innerHTML = '';
    A.POINTS.forEach(function (t) {
      var rs = list.filter(function (r) { return r.tp === t.id; });
      var anx = rs.map(A.anxiety).filter(function (x) { return x != null; }), inf = rs.map(A.info).filter(function (x) { return x != null; });
      var hi = anx.filter(function (x) { return x >= A.CUT; }).length;
      var tr = document.createElement('tr');
      tr.appendChild(td(t.name)); tr.appendChild(td(rs.length, 'num'));
      tr.appendChild(td(msd(anx), 'num'));
      tr.appendChild(td(anx.length ? hi + '（' + Math.round(hi / anx.length * 100) + '%）' : '—', 'num'));
      tr.appendChild(td(msd(inf), 'num'));
      sb.appendChild(tr);
    });

    /* 每位病人：三個時間點並列 */
    var hr = $('tblAp').querySelector('thead tr'); hr.innerHTML = '';
    ['病歷號', '姓名', '門診日期'].forEach(function (h) { hr.appendChild(th(h)); });
    A.POINTS.forEach(function (t) { hr.appendChild(th(t.name + ' 焦慮', 'num')); hr.appendChild(th(t.name + ' 資訊', 'num')); hr.appendChild(th(t.name + ' 填寫時間')); });
    var by = {};
    list.forEach(function (r) { (by[r.patientKey] = by[r.patientKey] || { r: r, tp: {} }).tp[r.tp] = r; });
    var tb = $('tblAp').querySelector('tbody'); tb.innerHTML = '';
    Object.keys(by).sort(function (a, b) { return by[a].r.mrn < by[b].r.mrn ? -1 : 1; }).forEach(function (k) {
      var g = by[k], tr = document.createElement('tr');
      tr.appendChild(td(g.r.mrn)); tr.appendChild(td(g.r.name + (g.r.simulated ? '［模擬］' : ''))); tr.appendChild(td(g.r.clinicDate || ''));
      A.POINTS.forEach(function (t) {
        var r = g.tp[t.id];
        var a = r ? A.anxiety(r) : null, c = td(a, 'num');
        if (a != null && a >= A.CUT) c.className += ' sv-low';
        tr.appendChild(c); tr.appendChild(td(r ? A.info(r) : '', 'num')); tr.appendChild(td(r ? showIso(r.submittedAt) : '未填'));
      });
      tb.appendChild(tr);
    });
    $('apEmpty').classList.toggle('hidden', list.length > 0);
  }

  $('apq').addEventListener('input', render);
  var tab = document.querySelector('.tab[data-tab=apais]');
  if (tab) tab.addEventListener('click', render);

  /* 匯出：一列＝一位病人的一個時間點（長格式，方便統計軟體做重複測量分析） */
  $('btnCopyAp').addEventListener('click', function () {
    var head = ['病歷號', '姓名', '門診日期', '時間點代碼', '時間點', '填寫時間'];
    A.ITEMS.forEach(function (it) { head.push('第' + it.no + '題'); });
    head = head.concat(['焦慮分數(1,2,4,5)', '資訊需求分數(3,6)', '焦慮≥' + A.CUT, '模擬資料']);
    var rows = [head];
    filtered().sort(function (a, b) { return a.mrn === b.mrn ? (a.tp < b.tp ? -1 : 1) : (a.mrn < b.mrn ? -1 : 1); }).forEach(function (r) {
      var row = [r.mrn, r.name, r.clinicDate, r.tp, tpName(r.tp), showIso(r.submittedAt)];
      A.ITEMS.forEach(function (it) { row.push(r.answers[it.id] || ''); });
      var a = A.anxiety(r);
      rows.push(row.concat([a, A.info(r), a == null ? '' : (a >= A.CUT ? '是' : '否'), r.simulated ? '是' : '否']));
    });
    var text = rows.map(function (x) { return x.map(function (c) { return String(c == null ? '' : c).replace(/[\t\n\r]/g, ' '); }).join('\t'); }).join('\n');
    var btn = this, orig = btn.textContent;
    var done = function (m) { btn.textContent = m; setTimeout(function () { btn.textContent = orig; }, 2500); };
    var fallback = function () { var ta = $('copyBoxAp'); ta.value = text; ta.classList.remove('hidden'); ta.select(); done('請按 Ctrl+C 複製下方內容'); };
    if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(text).then(function () { done('已複製，可貼到 Excel'); }, fallback);
    else fallback();
  });

  /* 展示用模擬資料 */
  function seed() {
    if (!CFG.demo || A.list().some(function (r) { return r.seed; })) return;
    var list = A.list(), now = Date.now();
    [
      ['SIM0001', '模擬病人甲', 'T1', [3, 3, 4, 4, 3, 5], 400], ['SIM0001', '模擬病人甲', 'T2', [2, 2, 3, 3, 2, 3], 200], ['SIM0001', '模擬病人甲', 'T3', [1, 1, 2, 2, 1, 2], 20],
      ['SIM0002', '模擬病人乙', 'T1', [4, 3, 5, 4, 4, 5], 300], ['SIM0002', '模擬病人乙', 'T2', [3, 3, 4, 4, 3, 4], 100]
    ].forEach(function (d) {
      var ans = {}; A.ITEMS.forEach(function (it, i) { ans[it.id] = d[3][i]; });
      list.push({ patientKey: d[0] + '|sim', name: d[1], mrn: d[0], clinicDate: '', tp: d[2], answers: ans,
        submittedAt: new Date(now - d[4] * 3600e3).toISOString(), simulated: true, seed: true });
    });
    A._save(list);
  }

  window.ERAS_APADMIN = { refresh: function () { seed(); render(); } };
  if (authed()) window.ERAS_APADMIN.refresh();
})();
