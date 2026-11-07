(function () {
  var NODES = window.ERAS_NODES, STAGES = window.ERAS_STAGES, ORDER = window.ERAS_ORDER;
  var Store = window.ERAS_STORE, CFG = window.ERAS_CONFIG;
  var $ = function (id) { return document.getElementById(id); };
  var MAINS = ORDER.filter(function (k) { return NODES[k].main; });
  var stageName = function (id) { var s = STAGES.filter(function (x) { return x.id === id; })[0]; return s ? s.name : id; };
  var selected = null;

  /* 兩段式確認（展示網頁不支援 confirm 對話框） */
  function twoStep(btn, ask, action) {
    var orig = btn.textContent;
    if (btn.dataset.armed === '1') { btn.dataset.armed = ''; btn.textContent = orig; action(); return; }
    btn.dataset.armed = '1'; btn.dataset.orig = orig; btn.textContent = ask;
    setTimeout(function () { if (btn.dataset.armed === '1') { btn.dataset.armed = ''; btn.textContent = btn.dataset.orig; } }, 4000);
  }

  /* 登入由 team.js（ERAS 團隊登入）處理；只有個管師職類可看全部病人資料 */
  var authed = function () { return !!(window.ERAS_TEAM && window.ERAS_TEAM.isAdmin()); };

  if (CFG.demo) {
    // 展示網頁不允許下載檔案，改用「複製」貼到 Excel
    $('btnCsvSum').classList.add('hidden'); $('btnCsvDetail').classList.add('hidden');
    seedIfEmpty();
  }

  $('modeBanner').textContent = CFG.demo
    ? '展示版：資料皆為模擬，只存在您這台裝置的瀏覽器。'
    : CFG.apiBase
    ? '資料來源：院內伺服器（' + CFG.apiBase + '）'
    : '測試版：只顯示「這台裝置」上的紀錄。正式上線需接院內伺服器，才能彙整所有病人與所有職類的紀錄。';

  /* 分頁 */
  document.querySelectorAll('.tab').forEach(function (t) {
    t.addEventListener('click', function () {
      document.querySelectorAll('.tab').forEach(function (x) { x.classList.toggle('on', x === t); });
      document.querySelectorAll('.pane').forEach(function (p) { p.classList.toggle('hidden', p.id !== 'pane-' + t.dataset.tab); });
      if (t.dataset.tab === 'share') renderQr();
    });
  });

  /* 工具 */
  function mmss(sec) {
    sec = Math.round(sec || 0);
    var h = Math.floor(sec / 3600), m = Math.floor((sec % 3600) / 60), s = sec % 60;
    return (h ? h + ':' + String(m).padStart(2, '0') : m) + ':' + String(s).padStart(2, '0');
  }
  function dt(iso) {
    if (!iso) return '';
    var d = new Date(iso);
    return d.getFullYear() + '/' + String(d.getMonth() + 1).padStart(2, '0') + '/' + String(d.getDate()).padStart(2, '0') + ' ' +
      String(d.getHours()).padStart(2, '0') + ':' + String(d.getMinutes()).padStart(2, '0');
  }
  function seenMains(p) { return MAINS.filter(function (k) { return p.nodes[k] && p.nodes[k].views > 0; }).length; }
  function td(text, cls) { var c = document.createElement('td'); c.textContent = text; if (cls) c.className = cls; return c; }

  function filtered() {
    var q = $('q').value.trim().toUpperCase(), f = $('from').value, t = $('to').value;
    return Store.listPatients().filter(function (p) {
      if (q && p.name.toUpperCase().indexOf(q) < 0 && p.mrn.indexOf(q) < 0) return false;
      if (f && p.clinicDate < f) return false;
      if (t && p.clinicDate > t) return false;
      return true;
    }).sort(function (a, b) { return a.lastSeen < b.lastSeen ? 1 : -1; });
  }

  /* 總表 */
  function renderPatients() {
    var list = filtered();
    var tb = $('tblPatients').querySelector('tbody'); tb.innerHTML = '';
    $('emptyMsg').classList.toggle('hidden', list.length > 0);
    list.forEach(function (p) {
      var tr = document.createElement('tr'); tr.className = 'click' + (selected === p.key ? ' sel' : '');
      var nameTd = td(p.name);
      if (p.simulated) { var s = document.createElement('span'); s.className = 'pill sim'; s.textContent = '模擬'; nameTd.append(' ', s); }
      tr.appendChild(nameTd);
      tr.appendChild(td(p.mrn));
      tr.appendChild(td(p.clinicDate));
      tr.appendChild(td(dt(p.firstSeen)));
      tr.appendChild(td(dt(p.lastSeen)));
      tr.appendChild(td(p.logins, 'num'));
      tr.appendChild(td(seenMains(p) + ' / ' + MAINS.length, 'num'));
      tr.appendChild(td(mmss(Store.totalSeconds(p)), 'num'));
      var act = document.createElement('td');
      var del = document.createElement('button'); del.className = 'btn ghost'; del.textContent = '刪除'; del.type = 'button';
      del.addEventListener('click', function (e) {
        e.stopPropagation();
        twoStep(del, '再按一次刪除', function () { Store.deletePatient(p.key); if (selected === p.key) closeDetail(); renderAll(); });
      });
      act.appendChild(del); tr.appendChild(act);
      tr.addEventListener('click', function () { selected = p.key; renderPatients(); renderDetail(p); });
      tb.appendChild(tr);
    });
    renderKpis(list);
  }

  function renderKpis(list) {
    var total = list.reduce(function (s, p) { return s + Store.totalSeconds(p); }, 0);
    var complete = list.filter(function (p) { return seenMains(p) === MAINS.length; }).length;
    var items = [
      ['病人數', list.length],
      ['看完全部主要項目', list.length ? complete + '（' + Math.round(complete / list.length * 100) + '%）' : '—'],
      ['平均總觀看時間', list.length ? mmss(total / list.length) : '—'],
      ['主要項目數', MAINS.length]
    ];
    $('kpis').innerHTML = '';
    items.forEach(function (it) {
      var d = document.createElement('div'); d.className = 'kpi';
      d.innerHTML = '<div class="v"></div><div class="l"></div>';
      d.firstChild.textContent = it[1]; d.lastChild.textContent = it[0];
      $('kpis').appendChild(d);
    });
  }

  /* 明細 */
  function renderDetail(p) {
    $('detailCard').classList.remove('hidden');
    $('detailTitle').textContent = p.name + '（' + p.mrn + '）門診日期 ' + p.clinicDate + (p.simulated ? '［模擬資料］' : '');
    var tb = $('tblDetail').querySelector('tbody'); tb.innerHTML = '';
    var sum = { v: 0, s: 0, vs: 0 };
    ORDER.forEach(function (k) {
      var n = NODES[k], r = p.nodes[k] || { views: 0, seconds: 0, videoSeconds: 0 };
      var tr = document.createElement('tr'); if (!r.views) tr.className = 'zero';
      tr.appendChild(td(stageName(n.stage)));
      tr.appendChild(td(n.title));
      tr.appendChild(td(n.branch ? '補充說明' : '主線'));
      tr.appendChild(td(r.views, 'num'));
      tr.appendChild(td(mmss(r.seconds), 'num'));
      tr.appendChild(td(n.videos ? mmss(r.videoSeconds) : '無影片', 'num'));
      tr.appendChild(td(dt(r.last)));
      tb.appendChild(tr);
      sum.v += r.views; sum.s += r.seconds; sum.vs += r.videoSeconds;
    });
    var tf = $('tblDetail').querySelector('tfoot'); tf.innerHTML = '';
    var tr = document.createElement('tr');
    [ '合計', '', '', sum.v, mmss(sum.s), mmss(sum.vs), '' ].forEach(function (x, i) { tr.appendChild(td(x, i >= 3 && i <= 5 ? 'num' : '')); });
    tf.appendChild(tr);
    $('detailCard').scrollIntoView({ behavior: 'smooth', block: 'start' });
  }
  function closeDetail() { selected = null; $('detailCard').classList.add('hidden'); }
  $('btnCloseDetail').addEventListener('click', function () { closeDetail(); renderPatients(); });

  ['q', 'from', 'to'].forEach(function (id) { $(id).addEventListener('input', renderPatients); });

  /* 匯出（CSV，含 BOM，Excel 可直接開啟中文） */
  function csv(rows, name) {
    var text = rows.map(function (r) {
      return r.map(function (c) { c = c === null || c === undefined ? '' : String(c); return /[",\n]/.test(c) ? '"' + c.replace(/"/g, '""') + '"' : c; }).join(',');
    }).join('\r\n');
    var blob = new Blob(['﻿' + text], { type: 'text/csv;charset=utf-8' });
    var a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = name;
    document.body.appendChild(a); a.click(); a.remove();
  }
  function stamp() { var d = new Date(); return d.getFullYear() + String(d.getMonth() + 1).padStart(2, '0') + String(d.getDate()).padStart(2, '0'); }
  function sumRows() {
    var rows = [[ '姓名', '病歷號', '門診日期', '首次觀看', '最後觀看', '登入次數', '主要項目已看數', '主要項目總數', '總觀看時間(秒)', '模擬資料' ]];
    filtered().forEach(function (p) {
      rows.push([ p.name, p.mrn, p.clinicDate, dt(p.firstSeen), dt(p.lastSeen), p.logins, seenMains(p), MAINS.length, Math.round(Store.totalSeconds(p)), p.simulated ? '是' : '否' ]);
    });
    return rows;
  }
  function detailRows() {
    var rows = [[ '姓名', '病歷號', '門診日期', '階段', '項目代碼', '項目', '類型', '觀看次數', '觀看時間(秒)', '影片播放時間(秒)', '最後觀看', '模擬資料' ]];
    filtered().forEach(function (p) {
      ORDER.forEach(function (k) {
        var n = NODES[k], r = p.nodes[k] || { views: 0, seconds: 0, videoSeconds: 0 };
        rows.push([ p.name, p.mrn, p.clinicDate, stageName(n.stage), k, n.title, n.branch ? '補充說明' : '主線', r.views, Math.round(r.seconds), Math.round(r.videoSeconds), dt(r.last), p.simulated ? '是' : '否' ]);
      });
    });
    return rows;
  }
  /* 複製成以 Tab 分隔的表格，可直接貼到 Excel */
  function copyRows(rows, btn) {
    var text = rows.map(function (r) { return r.map(function (c) { return String(c === null || c === undefined ? '' : c).replace(/[\t\n]/g, ' '); }).join('\t'); }).join('\n');
    var orig = btn.textContent;
    var done = function (msg) { btn.textContent = msg; setTimeout(function () { btn.textContent = orig; }, 2500); };
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text).then(function () { done('已複製，可貼到 Excel'); }, function () { fallback(); });
    } else fallback();
    function fallback() {
      var ta = $('copyBox'); ta.value = text; ta.classList.remove('hidden'); ta.select();
      done('請按 Ctrl+C 複製下方內容');
    }
  }
  $('btnCsvSum').addEventListener('click', function () { csv(sumRows(), 'ERAS衛教觀看總表_' + stamp() + '.csv'); });
  $('btnCsvDetail').addEventListener('click', function () { csv(detailRows(), 'ERAS衛教觀看明細_' + stamp() + '.csv'); });
  $('btnCopySum').addEventListener('click', function () { copyRows(sumRows(), this); });
  $('btnCopyDetail').addEventListener('click', function () { copyRows(detailRows(), this); });

  /* 模擬資料（明確標示，僅供預覽畫面） */
  function seedIfEmpty() {
    if (!Store.listPatients().some(function (p) { return p.simulated; })) seedSim();
  }
  $('btnSim').addEventListener('click', function () { seedSim(); renderAll(); });
  function seedSim() {
    var seedNames = [ ['模擬病人甲', 'SIM0001'], ['模擬病人乙', 'SIM0002'], ['模擬病人丙', 'SIM0003'] ];
    var day = new Date();
    var recs = seedNames.map(function (sn, i) {
      var rnd = mulberry(i + 7);
      var date = new Date(day.getTime() - i * 86400000).toISOString().slice(0, 10);
      var p = { key: sn[1] + '|' + date, name: sn[0], mrn: sn[1], clinicDate: date, logins: 1 + i,
        firstSeen: new Date(Date.now() - (i + 1) * 7200000).toISOString(), lastSeen: new Date(Date.now() - i * 3600000).toISOString(),
        nodes: {}, path: [] };
      var cut = i === 2 ? 10 : ORDER.length;
      ORDER.slice(0, cut).forEach(function (k) {
        if (NODES[k].branch && rnd() < 0.5) return;
        var views = 1 + (rnd() < 0.25 ? 1 : 0);
        var vlen = NODES[k].videos ? NODES[k].videos.length * 10 : 0;
        p.nodes[k] = { views: views, seconds: Math.round(15 + rnd() * 40) * views, videoSeconds: Math.round(vlen * (0.6 + rnd() * 0.4)) * views, first: p.firstSeen, last: p.lastSeen };
      });
      return p;
    });
    Store.importSimulated(recs);
  }
  function mulberry(a) { return function () { a |= 0; a = a + 0x6D2B79F5 | 0; var t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
  $('btnDelSim').addEventListener('click', function () {
    Store.listPatients().forEach(function (p) { if (p.simulated) Store.deletePatient(p.key); });
    if (window.ERAS_TEAM) window.ERAS_TEAM.clearSimCare();
    if (window.ERAS_QUESTIONS) window.ERAS_QUESTIONS.removeSimulated();
    if (window.ERAS_SURVEY) window.ERAS_SURVEY.removeSimulated();
    if (window.ERAS_SADMIN) window.ERAS_SADMIN.refresh();
    if (window.ERAS_QADMIN) window.ERAS_QADMIN.refresh();
    closeDetail(); renderAll();
  });
  $('btnClear').addEventListener('click', function () {
    var b = this;
    twoStep(b, '再按一次清除全部（無法復原）', function () { Store.clearAll(); closeDetail(); renderAll(); });
  });

  /* 內容審核 */
  function renderReview() {
    var tb = $('tblReview').querySelector('tbody'); tb.innerHTML = '';
    ORDER.forEach(function (k) {
      var n = NODES[k];
      var tr = document.createElement('tr');
      tr.appendChild(td(stageName(n.stage)));
      tr.appendChild(td(n.title));
      tr.appendChild(td(n.branch ? '補充說明' : '主線'));
      tr.appendChild(td(n.videos ? n.videos.length + ' 段' : '語音朗讀'));
      var st = document.createElement('td'), pill = document.createElement('span');
      pill.className = 'pill ' + (n.review === 'pending' ? 'pend' : 'ok');
      pill.textContent = n.review === 'pending' ? '待確認' : '沿用原內容';
      st.appendChild(pill); tr.appendChild(st);
      tb.appendChild(tr);
    });
  }

  /* QR */
  var defaultUrl = CFG.shareUrl || location.href.replace(/admin\.html.*$/, 'index.html').replace(/#.*$/, '');
  $('shareUrl').value = defaultUrl;
  $('shareUrl').addEventListener('change', renderQr);
  $('btnCopy').addEventListener('click', function () {
    var v = $('shareUrl').value;
    if (navigator.clipboard) navigator.clipboard.writeText(v).then(function () { $('btnCopy').textContent = '已複製'; });
  });
  function renderQr() {
    $('qr').innerHTML = '';
    if (window.QRCode) new QRCode($('qr'), { text: $('shareUrl').value, width: 220, height: 220 });
    else $('qr').textContent = 'QR Code 元件載入失敗（需要網路），請直接複製網址。';
  }

  function renderAll() { renderPatients(); renderReview(); }
  window.ERAS_ADMIN_REFRESH = function () { if (authed()) renderAll(); };
  if (authed()) renderAll();
})();
