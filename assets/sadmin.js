/* ERAS 團隊端：ERAS 病人滿意度調查結果（個管師） */
(function () {
  var S = window.ERAS_SURVEY, CFG = window.ERAS_CONFIG;
  var $ = function (id) { return document.getElementById(id); };
  function pad(n) { return String(n).padStart(2, '0'); }
  function showIso(iso) { if (!iso) return ''; var d = new Date(iso); return d.getFullYear() + '/' + pad(d.getMonth() + 1) + '/' + pad(d.getDate()) + ' ' + pad(d.getHours()) + ':' + pad(d.getMinutes()); }
  function td(t, cls) { var c = document.createElement('td'); c.textContent = t; if (cls) c.className = cls; return c; }
  function th(t, cls) { var c = document.createElement('th'); c.textContent = t; if (cls) c.className = cls; return c; }
  function authed() { return window.ERAS_TEAM && window.ERAS_TEAM.isAdmin(); }
  function pct(a, b) { return b ? Math.round(a / b * 100) + '%' : '—'; }
  function src(s) { return (s.basic.source || []).map(function (x) { return x === '其他' && s.basic.sourceOther ? '其他：' + s.basic.sourceOther : x; }).join('、'); }

  function filtered() {
    var q = $('svq').value.trim().toUpperCase();
    return S.list().filter(function (s) { return !q || (s.name + ' ' + s.mrn).toUpperCase().indexOf(q) >= 0; })
      .sort(function (a, b) { return a.createdAt < b.createdAt ? 1 : -1; });
  }

  function render() {
    if (!authed()) return;
    var list = filtered();
    /* 各題統計 */
    var sb = $('tblSvSum').querySelector('tbody'); sb.innerHTML = '';
    S.LIKERT.forEach(function (it) {
      var v = list.map(function (s) { return S.score(s, it.id); }).filter(function (x) { return x; });
      var tr = document.createElement('tr');
      tr.appendChild(td(it.no + '. ' + it.text, 'wrap'));
      tr.appendChild(td(v.length, 'num'));
      tr.appendChild(td(v.length ? (v.reduce(function (a, b) { return a + b; }, 0) / v.length).toFixed(2) : '—', 'num'));
      var hi = v.filter(function (x) { return x >= 4; }).length, lo = v.filter(function (x) { return x <= 2; }).length;
      tr.appendChild(td(v.length ? hi + '（' + pct(hi, v.length) + '）' : '—', 'num'));
      tr.appendChild(td(v.length ? lo + '（' + pct(lo, v.length) + '）' : '—', 'num'));
      sb.appendChild(tr);
    });

    /* 每位病人 */
    var hr = $('tblSv').querySelector('thead tr'); hr.innerHTML = '';
    ['填寫時間', '姓名', '病歷號', '門診日期', '院區', '年齡', '教育程度', '手術', '得知來源'].forEach(function (h) { hr.appendChild(th(h)); });
    S.LIKERT.forEach(function (it) { var h = th('第' + it.no + '題', 'num'); h.title = it.text; hr.appendChild(h); });
    ['曾有手術經驗', '第1–14題平均', '意見或建議'].forEach(function (h) { hr.appendChild(th(h)); });
    var tb = $('tblSv').querySelector('tbody'); tb.innerHTML = '';
    list.forEach(function (s) {
      var tr = document.createElement('tr');
      tr.appendChild(td(showIso(s.createdAt) + (s.updatedAt ? '（修改 ' + showIso(s.updatedAt) + '）' : '')));
      tr.appendChild(td(s.name + (s.simulated ? '［模擬］' : '')));
      tr.appendChild(td(s.mrn)); tr.appendChild(td(s.clinicDate || ''));
      tr.appendChild(td(s.basic.campus)); tr.appendChild(td(s.basic.age, 'num')); tr.appendChild(td(s.basic.edu));
      tr.appendChild(td(s.basic.surgery)); tr.appendChild(td(src(s)));
      S.LIKERT.forEach(function (it) {
        var a = s.answers[it.id] || '', c = td(a ? S.SCORE[a] : '', 'num');
        c.title = a; if (a && S.SCORE[a] <= 2) c.className += ' sv-low';
        tr.appendChild(c);
      });
      tr.appendChild(td(s.prior));
      tr.appendChild(td(S.mean(s).toFixed(2), 'num'));
      var cm = td(s.comment || ''); cm.className = 'wrap'; tr.appendChild(cm);
      tb.appendChild(tr);
    });
    $('svEmpty').classList.toggle('hidden', list.length > 0);
  }

  $('svq').addEventListener('input', render);
  var tab = document.querySelector('.tab[data-tab=survey]');
  if (tab) tab.addEventListener('click', render);

  $('btnCopySv').addEventListener('click', function () {
    var head = ['填寫時間', '修改時間', '姓名', '病歷號', '門診日期', '1.院區', '2.年齡', '3.教育程度', '4.手術', '5.得知來源'];
    S.LIKERT.forEach(function (it) { if (it.id === 'q16') head.push('15.曾有手術經驗'); head.push(it.no + '.' + it.text + '（分數）'); });
    head = head.concat(['17.意見或建議', '第1–14題平均', '模擬資料']);
    var rows = [head];
    filtered().forEach(function (s) {
      var r = [showIso(s.createdAt), showIso(s.updatedAt), s.name, s.mrn, s.clinicDate, s.basic.campus, s.basic.age, s.basic.edu, s.basic.surgery, src(s)];
      S.LIKERT.forEach(function (it) { if (it.id === 'q16') r.push(s.prior); r.push(S.score(s, it.id) || ''); });
      rows.push(r.concat([s.comment, S.mean(s).toFixed(2), s.simulated ? '是' : '否']));
    });
    var text = rows.map(function (x) { return x.map(function (c) { return String(c == null ? '' : c).replace(/[\t\n\r]/g, ' '); }).join('\t'); }).join('\n');
    var btn = this, orig = btn.textContent;
    var done = function (m) { btn.textContent = m; setTimeout(function () { btn.textContent = orig; }, 2500); };
    var fallback = function () { var ta = $('copyBoxSv'); ta.value = text; ta.classList.remove('hidden'); ta.select(); done('請按 Ctrl+C 複製下方內容'); };
    if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(text).then(function () { done('已複製，可貼到 Excel'); }, fallback);
    else fallback();
  });

  /* 展示用模擬問卷 */
  function seed() {
    if (!CFG.demo || S.list().some(function (s) { return s.simulated && s.seed; })) return;
    var list = S.list(), now = Date.now(), L = S.SCALE; // 0 非常滿意 … 4 非常不滿意
    [
      { name: '模擬病人甲', mrn: 'SIM0001', age: 72, edu: '國小', src: ['醫師建議'], a: [0, 0, 1, 0, 1, 0, 0, 0, 1, 0, 1, 0, 0, 0], prior: '有', q16: 0, cm: '影片很清楚，家人也一起看。', h: 20 },
      { name: '模擬病人乙', mrn: 'SIM0002', age: 78, edu: '國中', src: ['護理人員建議', '親友推薦'], a: [1, 1, 1, 1, 1, 1, 0, 1, 1, 2, 1, 1, 1, 3], prior: '沒有', cm: '手術當晚比較痛。', h: 30 },
      { name: '模擬病人丙', mrn: 'SIM0003', age: 70, edu: '高中職', src: ['醫師建議'], a: [0, 1, 1, 1, 0, 0, 0, 0, 0, 1, 1, 0, 0, 1], prior: '有', q16: 1, cm: '', h: 50 }
    ].forEach(function (d) {
      var answers = {};
      S.LIKERT.forEach(function (it, i) { if (it.id !== 'q16') answers[it.id] = L[d.a[i]]; });
      if (d.prior === '有') answers.q16 = L[d.q16];
      list.push({ patientKey: d.mrn + '|sim', name: d.name, mrn: d.mrn, clinicDate: '', simulated: true, seed: true,
        basic: { campus: '高雄', age: d.age, edu: d.edu, surgery: '關節置換手術', source: d.src, sourceOther: '' },
        answers: answers, prior: d.prior, comment: d.cm, createdAt: new Date(now - d.h * 3600e3).toISOString(), updatedAt: '' });
    });
    S._save(list);
  }

  window.ERAS_SADMIN = { refresh: function () { seed(); render(); } };
  if (authed()) window.ERAS_SADMIN.refresh();
})();
