/* ERAS 團隊登入：職類密碼、病歷號查詢、照護項目紀錄與執行時間 */
(function () {
  var ROLES = window.ERAS_ROLES, PHASES = window.ERAS_PHASES;
  var NODES = window.ERAS_NODES, ORDER = window.ERAS_ORDER;
  var Store = window.ERAS_STORE, CFG = window.ERAS_CONFIG;
  var $ = function (id) { return document.getElementById(id); };
  var CARE_KEY = 'eras_care_records_v1', ROLE_KEY = 'eras_team_role';
  var MAINS = ORDER.filter(function (k) { return NODES[k].main; });

  var state = { role: null, mrn: null };

  /* ───────── 儲存 ───────── */
  function loadCare() { try { return JSON.parse(localStorage.getItem(CARE_KEY)) || []; } catch (e) { return []; } }
  function saveCare(list) { try { localStorage.setItem(CARE_KEY, JSON.stringify(list)); } catch (e) {} }
  function roleById(id) {
    if (id === 'patient') return { id: 'patient', name: '病人／家屬（網頁填寫）' };
    return ROLES.filter(function (r) { return r.id === id; })[0];
  }
  function itemById(id) {
    var L = window.ERAS_CARE_LIST;
    for (var i = 0; i < L.length; i++) if (L[i].id === id) return L[i];
    return null;
  }
  function pad(n) { return String(n).padStart(2, '0'); }
  function localNow() { var d = new Date(); return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate()) + 'T' + pad(d.getHours()) + ':' + pad(d.getMinutes()); }
  function showLocal(s) { return s ? s.replace('T', ' ').replace(/-/g, '/') : ''; }
  function showIso(iso) { if (!iso) return ''; var d = new Date(iso); return d.getFullYear() + '/' + pad(d.getMonth() + 1) + '/' + pad(d.getDate()) + ' ' + pad(d.getHours()) + ':' + pad(d.getMinutes()); }
  function td(text, cls) { var c = document.createElement('td'); c.textContent = text; if (cls) c.className = cls; return c; }
  function sid() { try { return sessionStorage; } catch (e) { return null; } }

  /* ───────── 病人手術資料（手術日期時間、手術側、床號；團隊共用，會同步） ───────── */
  var PROF_KEY = 'eras_pt_profile_v1';
  function loadProf() { try { return JSON.parse(localStorage.getItem(PROF_KEY)) || {}; } catch (e) { return {}; } }
  function profOf(m) {
    var p = loadProf()[m] || {}, o = {}; for (var k in p) o[k] = p[k];
    if (!o.side) { var op1 = latestByItem(loadCare().filter(function (x) { return x.mrn === m && x.item === 'op1'; })).op1; if (op1 && op1.fields && op1.fields.site) o.side = op1.fields.site; }
    if (!o.side && window.ERAS_NOTICES) { var n = window.ERAS_NOTICES.list().filter(function (x) { return x.mrn === m && x.site; })[0]; if (n) o.side = n.site; }
    return o;
  }
  function saveProf(m, d) {
    var all = loadProf(); d.by = state.role.id; d.at = new Date().toISOString(); all[m] = d;
    try { localStorage.setItem(PROF_KEY, JSON.stringify(all)); } catch (e) {}
    if (Cloud && Cloud.sync) Cloud.sync();
  }
  function nameOf(m) {
    var pf = loadProf()[m]; if (pf && pf.name) return pf.name;
    var v = Store.listPatients().filter(function (p) { return p.mrn === m && p.name; })[0];
    if (v) return v.name;
    var op1 = loadCare().filter(function (x) { return x.mrn === m && x.fields && x.fields.pname; })[0];
    if (op1) return op1.fields.pname;
    var n = window.ERAS_NOTICES && window.ERAS_NOTICES.list().filter(function (x) { return x.mrn === m && x.name; })[0];
    return n ? n.name : '';
  }
  function surgAt(p) { if (!p.surgDate) return null; var d = new Date(p.surgDate + 'T' + (p.surgTime || CFG.earliestSurgery || '08:00')); return isNaN(d) ? null : d; }
  function md(d) { return (d.getMonth() + 1) + '/' + d.getDate(); }
  function mdhm(d) { return md(d) + ' ' + pad(d.getHours()) + ':' + pad(d.getMinutes()); }

  /* 麻醉科醫師與麻醉專科護理師常互相代填 → 預設顯示麻醉團隊全部項目 */
  var ROLE_GROUP = { anesmd: ['anesmd', 'anesnp'], anesnp: ['anesmd', 'anesnp'] };
  function mine(it, roleId) {
    var g = ROLE_GROUP[roleId] || [roleId];
    return it.roles.some(function (r) { return g.indexOf(r) >= 0; });
  }

  /* ───────── 登入 ───────── */
  ROLES.forEach(function (r) {
    var o = document.createElement('option'); o.value = r.id; o.textContent = r.name; $('role').appendChild(o);
  });
  if (CFG.demo && !CFG.hidePins) {
    var h = $('pinHint');
    h.innerHTML = '<strong>展示版各職類密碼</strong>';
    var ul = document.createElement('div'); ul.className = 'pin-list';
    ROLES.forEach(function (r) { var s = document.createElement('span'); s.textContent = r.name + '：' + r.pin; ul.appendChild(s); });
    h.appendChild(ul); h.classList.remove('hidden');
  }
  /* 密碼由後台（Google 試算表「帳號密碼」工作表）驗證，程式碼中不存密碼 */
  var Cloud = window.ERAS_CLOUD;
  /* super＝後台管理者（帳號管理）；admin＝可看各管理分頁（後台管理者與 ERAS 個管師） */
  var MANAGER_ROLES = { cm: 1 };
  function withAdmin(r, admin) { var o = {}; for (var k in r) o[k] = r[k]; o.super = !!admin; o.admin = !!admin || !!MANAGER_ROLES[r.id]; return o; }
  $('pinForm').addEventListener('submit', function (e) {
    e.preventDefault();
    var r = roleById($('role').value), pin = $('pin').value;
    if (!r || !pin) { $('pinErr').textContent = '請選擇職類並輸入密碼。'; return; }
    if (!Cloud || !Cloud.enabled) { $('pinErr').textContent = '尚未設定後台網址（store.js 的 cloudUrl），無法登入。'; return; }
    var btn = this.querySelector('button[type=submit]'); btn.disabled = true; btn.textContent = '驗證中…';
    $('pinErr').textContent = '';
    Cloud.auth(r.id, pin).then(function (res) {
      btn.disabled = false; btn.textContent = '登入';
      if (!res || !res.ok) { $('pinErr').textContent = (res && res.msg) || '密碼與職類不符，請再確認。'; return; }
      $('pin').value = '';
      var ss = sid(); if (ss) { ss.setItem(ROLE_KEY, r.id); ss.setItem('eras_team_admin', res.admin ? '1' : ''); }
      enter(withAdmin(r, res.admin));
      Cloud.sync();
    }).catch(function () {
      btn.disabled = false; btn.textContent = '登入';
      $('pinErr').textContent = '無法連線到後台，請確認網路後再試。';
    });
  });
  /* 其他裝置的資料同步回來後，更新畫面 */
  document.addEventListener('eras-cloud', function (ev) {
    var b = $('modeBanner');
    if (b && Cloud) { var s = Cloud.status(); b.textContent = s.lastErr ? s.lastErr : '已連線後台，最後同步 ' + (s.lastOk ? s.lastOk.toLocaleTimeString() : ''); b.classList.toggle('warn', !!s.lastErr); }
    if (!ev.detail || !ev.detail.changed || !state.role) return;
    if (window.ERAS_NOTICES) window.ERAS_NOTICES.refresh();
    /* 正在填寫（有未儲存的項目）時不重畫，以免輸入內容消失 */
    if (state.mrn) { if (!Object.keys(dirty).length) renderPatient(); } else renderWorklist();
    if (state.role.admin) {
      if (window.ERAS_ADMIN_REFRESH) window.ERAS_ADMIN_REFRESH();
      if (window.ERAS_QADMIN) window.ERAS_QADMIN.refresh();
      if (window.ERAS_SADMIN) window.ERAS_SADMIN.refresh();
      if (window.ERAS_RESEARCH) window.ERAS_RESEARCH.refresh();
    }
  });
  /* 帳號被鎖定或密碼被重設時，後台拒絕同步 → 回到登入畫面 */
  document.addEventListener('eras-cloud', function () {
    if (state.role && Cloud && !Cloud.teamWho()) {
      $('btnTeamLogout').click();
      $('pinErr').textContent = '登入已失效（帳號可能被鎖定或密碼已變更），請重新登入或洽管理者。';
    }
  });
  $('btnTeamLogout').addEventListener('click', function (e) {
    if (e && e.isTrusted && !confirmLeave()) return;
    dirty = {}; updateSaveBar();
    if (Cloud) { Cloud.sync(); Cloud.signOut(); }
    var ss = sid(); if (ss) { ss.removeItem(ROLE_KEY); ss.removeItem('eras_team_admin'); }
    state.role = null; state.mrn = null;
    if (window.ERAS_NOTICES) window.ERAS_NOTICES.refresh();
    $('careMrn').value = ''; $('careBody').classList.add('hidden'); $('careEmpty').classList.remove('hidden');
    $('pinOverlay').classList.remove('hidden');
  });
  window.addEventListener('beforeunload', function (e) {
    if (Object.keys(dirty).length) { e.preventDefault(); e.returnValue = ''; }
  });

  function enter(r) {
    state.role = r;
    $('pinOverlay').classList.add('hidden');
    $('whoRole').textContent = '目前職類：' + r.name;
    $('lnkPatient').classList.toggle('hidden', !r.admin);   // 臨床職類用不到，避免誤按
    $('wlMine').checked = !r.admin;
    document.querySelectorAll('.tab.adm').forEach(function (t) { t.classList.toggle('hidden', !r.admin || t.classList.contains('off') || (t.classList.contains('super') && !r.super)); });
    var careTab = document.querySelector('.tab[data-tab=care]');
    if (careTab) careTab.click();
    if (CFG.demo) seedCare();
    if (window.ERAS_NOTICES) { if (CFG.demo) window.ERAS_NOTICES.seed(); window.ERAS_NOTICES.refresh(); }
    if (state.mrn) renderPatient(); else renderWorklist();
    if (r.admin && window.ERAS_ADMIN_REFRESH) window.ERAS_ADMIN_REFRESH();
    if (r.admin && window.ERAS_QADMIN) window.ERAS_QADMIN.refresh();
    if (r.admin && window.ERAS_SADMIN) window.ERAS_SADMIN.refresh();
    if (r.admin && window.ERAS_APADMIN) window.ERAS_APADMIN.refresh();
    if (r.admin && window.ERAS_RESEARCH) window.ERAS_RESEARCH.refresh();
    if (r.super && window.ERAS_ACCOUNTS) window.ERAS_ACCOUNTS.refresh();
    setTimeout(function () { $('careMrn').focus(); }, 50);
  }

  /* ───────── 病歷號查詢 ───────── */
  $('mrnForm').addEventListener('submit', function (e) {
    e.preventDefault();
    /* 與病人端相同的整理規則：全形轉半形、去掉空格與減號、轉大寫 */
    var m = $('careMrn').value.replace(/[！-～]/g, function (c) { return String.fromCharCode(c.charCodeAt(0) - 0xFEE0); })
      .replace(/[\s\-－—_]/g, '').toUpperCase();
    $('careMrn').value = m;
    if (!/^[A-Z0-9]{4,20}$/.test(m)) { $('mrnErr').textContent = '請輸入正確的病歷號（英文字母或數字）。'; return; }
    $('mrnErr').textContent = '';
    openPatient(m);
  });

  /* ───────── 未儲存提醒、全部儲存 ───────── */
  var dirty = {};   // 項目 id → 儲存函式
  function confirmLeave() {
    var n = Object.keys(dirty).length;
    return !n || window.confirm('還有 ' + n + ' 個項目尚未儲存，確定要離開嗎？（按「取消」回去儲存）');
  }
  function updateSaveBar() {
    var n = Object.keys(dirty).length, bar = $('saveBar'); if (!bar) return;
    bar.classList.toggle('hidden', !n);
    $('saveBarTxt').textContent = '已修改 ' + n + ' 個項目，尚未儲存';
  }
  $('btnSaveAll').addEventListener('click', function () {
    var ids = Object.keys(dirty), ok = 0, bad = 0;
    ids.forEach(function (id) { if (dirty[id](true)) { ok++; delete dirty[id]; } else bad++; });
    if (bad) {
      updateSaveBar();
      $('saveBarTxt').textContent = '已儲存 ' + ok + ' 項；另有 ' + bad + ' 項需補填（看紅字），補好後再按一次';
      var first = document.querySelector('.care-item.dirty .err:not(:empty)');
      if (first) first.closest('.care-item').scrollIntoView({ behavior: 'smooth', block: 'center' });
      return;
    }
    renderPatient();
  });

  function openPatient(m) {
    if (m !== state.mrn && !confirmLeave()) return;
    dirty = {}; updateSaveBar();
    state.mrn = m; $('careMrn').value = m;
    renderPatient();
    window.scrollTo(0, 0);
  }
  $('btnBackList').addEventListener('click', function () {
    if (!confirmLeave()) return;
    dirty = {}; updateSaveBar();
    state.mrn = null; $('careMrn').value = '';
    $('careBody').classList.add('hidden'); $('careEmpty').classList.remove('hidden');
    renderWorklist();
  });

  /* ───────── 單一病人執行項目清單：列印／PDF、CSV ───────── */
  function ptSheet(m) {
    var recs = loadCare().filter(function (x) { return x.mrn === m; }), last = latestByItem(recs);
    return LIST.map(function (it) {
      var r = last[it.id], n = recs.filter(function (x) { return x.item === it.id; }).length;
      return { phase: it.phase, label: it.label, roles: roleNames(it),
        status: !r ? '未紀錄' : (isDone(r) ? '已執行' : '未執行／未達成'),
        exec: r ? showLocal(r.execAt) : '', by: r ? (roleById(r.role) || { name: r.role }).name : '',
        value: r ? r.value : '', count: n };
    });
  }
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }
  function printDoc(title, body) {
    var h = '<!doctype html><html lang="zh-TW"><head><meta charset="utf-8"><title>' + esc(title) + '</title><style>' +
      'body{font-family:"Microsoft JhengHei","Noto Sans TC",sans-serif;font-size:12px;margin:16px;color:#000}' +
      'h1{font-size:18px;margin:0 0 6px}.info{display:flex;flex-wrap:wrap;gap:4px 18px;margin:6px 0 10px;font-size:13px}' +
      'table{width:100%;border-collapse:collapse}th,td{border:1px solid #555;padding:4px 5px;vertical-align:top;text-align:left}' +
      'th{background:#e5e5e5}tr.ph td{background:#f2f2f2;font-weight:bold}td.st{white-space:nowrap;font-weight:bold}' +
      '.not{color:#b00}.none{color:#777}tr{page-break-inside:avoid}.sign{margin-top:18px;display:flex;gap:40px;font-size:13px}' +
      '.btns{margin-bottom:10px}.pt+.pt{page-break-before:always}@media print{.btns{display:none}@page{size:A4;margin:12mm}}</style></head><body>' +
      '<div class="btns"><button onclick="window.print()">列印／另存 PDF</button></div>' + body +
      '<script>setTimeout(function(){window.print()},300)<\/script></body></html>';
    var w = window.open('', '_blank');
    if (!w) { alert('瀏覽器擋住了新視窗，請允許此網站開啟彈出視窗後再按一次。'); return; }
    w.document.open(); w.document.write(h); w.document.close();
  }
  function ptSection(m) {
    var p = profOf(m), R = rateOf(m), rows = ptSheet(m), sa = surgAt(p);
    var ci = Store.clinicInfo(m, (Store.listPatients().filter(function (v) { return v.mrn === m; })[0] || {}).clinicDate);
    var h = '<div class="pt"><h1>人工膝關節置換 ERAS 個案照護執行項目清單</h1><div class="info">' +
      '<span>病歷號：<b>' + esc(m) + '</b></span><span>姓名：' + esc(nameOf(m) || '') + '</span>' +
      '<span>手術日期：' + esc(sa ? (p.surgTime ? mdhm(sa) : md(sa)) + '（' + sa.getFullYear() + '）' : '未填') + '</span>' +
      '<span>手術側：' + esc(p.side || '—') + '</span><span>床號：' + esc(p.bed || '—') + '</span>' +
      '<span>門診日期：' + esc(ci.date || '—') + (ci.confirmed ? '' : '（待確認）') + '</span>' +
      '<span>清單執行率：<b>' + (Math.round(R.rate * 1000) / 10) + '%</b>（已執行 ' + R.done + ' / ' + R.total + '，' + (R.rate >= TH ? '已達' : '未達') + '支付規範 60%）</span>' +
      '<span>列印時間：' + esc(showIso(new Date().toISOString())) + '</span></div>' +
      '<table><thead><tr><th style="width:26%">照護項目</th><th style="width:8%">狀態</th><th style="width:12%">執行時間</th><th style="width:11%">紀錄職類</th><th>內容</th><th style="width:11%">暫定負責</th></tr></thead><tbody>';
    var ph = '';
    rows.forEach(function (r) {
      if (r.phase !== ph) { ph = r.phase; h += '<tr class="ph"><td colspan="6">◎' + esc(ph) + '</td></tr>'; }
      h += '<tr><td>' + esc(r.label) + '</td><td class="st ' + (r.status === '已執行' ? '' : r.status === '未紀錄' ? 'none' : 'not') + '">' + esc(r.status) +
        '</td><td>' + esc(r.exec) + '</td><td>' + esc(r.by) + '</td><td>' + esc(r.value) + (r.count > 1 ? '（共 ' + r.count + ' 筆，列最新）' : '') +
        '</td><td>' + esc(r.roles) + '</td></tr>';
    });
    h += '</tbody></table><div class="sign"><span>ERAS 個管師簽名：＿＿＿＿＿＿＿＿</span><span>日期：＿＿＿＿＿＿</span></div></div>';
    return h;
  }
  function downloadCsv(out, fname) {
    var csv = '﻿' + out.map(function (row) { return row.map(function (c) { return '"' + String(c == null ? '' : c).replace(/"/g, '""') + '"'; }).join(','); }).join('\r\n');
    var a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
    a.download = fname;
    document.body.appendChild(a); a.click(); setTimeout(function () { URL.revokeObjectURL(a.href); a.remove(); }, 1000);
  }
  $('btnPrintPt').addEventListener('click', function () {
    if (state.mrn) printDoc('ERAS 執行項目清單_' + state.mrn, ptSection(state.mrn));
  });
  $('btnCsvPt').addEventListener('click', function () {
    var m = state.mrn; if (!m) return;
    var p = profOf(m), R = rateOf(m);
    var out = [['病歷號', m], ['姓名', nameOf(m)], ['手術日期', (p.surgDate || '') + ' ' + (p.surgTime || '')], ['手術側', p.side || ''], ['床號', p.bed || ''],
      ['清單執行率', (Math.round(R.rate * 1000) / 10) + '%（' + R.done + '/' + R.total + '）'], [],
      ['階段', '照護項目', '狀態', '執行時間', '紀錄職類', '內容', '紀錄筆數', '暫定負責']];
    ptSheet(m).forEach(function (r) { out.push([r.phase, r.label, r.status, r.exec, r.by, r.value, r.count, r.roles]); });
    downloadCsv(out, 'ERAS執行項目清單_' + m + '_' + localNow().slice(0, 10) + '.csv');
  });

  /* 全部病人：依目前清單（含搜尋條件；取消「只顯示待我填寫」即為全部）一次下載／列印 */
  function listedMrns() {
    return [].map.call($('tblWork').querySelectorAll('tbody tr'), function (tr) { return tr.dataset.mrn; }).filter(Boolean);
  }
  $('btnCsvAll').addEventListener('click', function () {
    var ms = listedMrns(); if (!ms.length) { alert('清單中沒有病人。'); return; }
    var out = [['病歷號', '姓名', '手術日期', '手術時間', '手術側', '床號', '清單執行率', '是否達 60%', '階段', '照護項目', '狀態', '執行時間', '紀錄職類', '內容', '紀錄筆數', '暫定負責']];
    ms.forEach(function (m) {
      var p = profOf(m), R = rateOf(m), nm = nameOf(m), rate = (Math.round(R.rate * 1000) / 10) + '%', ok = R.rate >= TH ? '已達' : '未達';
      ptSheet(m).forEach(function (r) { out.push([m, nm, p.surgDate || '', p.surgTime || '', p.side || '', p.bed || '', rate, ok, r.phase, r.label, r.status, r.exec, r.by, r.value, r.count, r.roles]); });
    });
    downloadCsv(out, 'ERAS執行項目清單_全部' + ms.length + '位_' + localNow().slice(0, 10) + '.csv');
  });
  $('btnPrintAll').addEventListener('click', function () {
    var ms = listedMrns(); if (!ms.length) { alert('清單中沒有病人。'); return; }
    printDoc('ERAS 執行項目清單_全部' + ms.length + '位', ms.map(ptSection).join(''));
  });

  /* ───────── 收案中的病人清單 ───────── */
  function allMrns() {
    var s = {};
    Store.listPatients().forEach(function (p) { if (p.mrn) s[p.mrn] = s[p.mrn] || !!p.simulated; });
    loadCare().forEach(function (r) { if (r.mrn) s[r.mrn] = s[r.mrn] || !!r.simulated; });
    if (window.ERAS_NOTICES) window.ERAS_NOTICES.list().forEach(function (n) { if (n.mrn) s[n.mrn] = s[n.mrn] || !!n.simulated; });
    Object.keys(loadProf()).forEach(function (m) { if (!(m in s)) s[m] = false; });
    return s;
  }
  function pendingFor(m) {
    var last = latestByItem(loadCare().filter(function (x) { return x.mrn === m; }));
    return LIST.filter(function (it) { return (state.role.admin || mine(it, state.role.id)) && !last[it.id]; }).length;
  }
  function renderWorklist() {
    if (!state.role) return;
    var tb = $('tblWork').querySelector('tbody'); tb.innerHTML = '';
    var q = $('wlQ').value.trim().toUpperCase(), onlyMine = $('wlMine').checked;
    var ms = allMrns(), rows = Object.keys(ms).map(function (m) {
      var p = profOf(m); return { m: m, sim: ms[m], name: nameOf(m), p: p, at: surgAt(p), pend: pendingFor(m), R: rateOf(m) };
    }).filter(function (x) {
      if (q && (x.m + ' ' + x.name).toUpperCase().indexOf(q) < 0) return false;
      return !onlyMine || x.pend > 0;
    }).sort(function (a, b) {
      if (a.at && b.at) return a.at - b.at; if (a.at) return -1; if (b.at) return 1;
      return b.pend - a.pend || (a.m < b.m ? -1 : 1);
    });
    rows.forEach(function (x) {
      var tr = document.createElement('tr'); tr.className = 'wl-row'; tr.dataset.mrn = x.m;
      tr.appendChild(td(x.m + (x.sim ? '（模擬）' : '')));
      tr.appendChild(td(x.name || '—'));
      tr.appendChild(td(x.at ? (x.p.surgTime ? mdhm(x.at) : md(x.at) + '（時間未定）') : '未填'));
      tr.appendChild(td(x.p.side || '—'));
      tr.appendChild(td(x.p.bed || '—'));
      var pc = td(x.pend ? x.pend + ' 項' : '✓ 已填完', 'num'); if (x.pend) pc.classList.add('wl-pend'); tr.appendChild(pc);
      tr.appendChild(td((Math.round(x.R.rate * 1000) / 10) + '%', 'num'));
      var c = document.createElement('td'), b = document.createElement('button');
      b.type = 'button'; b.className = 'btn'; b.textContent = '開啟填寫';
      b.addEventListener('click', function (e) { e.stopPropagation(); openPatient(x.m); });
      c.appendChild(b); tr.appendChild(c);
      tr.addEventListener('click', function () { openPatient(x.m); });
      tb.appendChild(tr);
    });
    $('wlEmpty').classList.toggle('hidden', rows.length > 0);
    $('wlEmpty').textContent = onlyMine ? '目前沒有待您填寫的病人。取消勾選「只顯示還有待我填寫的病人」可看全部。' : '目前沒有符合的病人。';
    renderTodo(ms);
  }
  $('wlQ').addEventListener('input', renderWorklist);
  /* 從其他分頁（例如回覆提問、確認門診日期）回到照護紀錄時，更新病人清單與今日待辦 */
  var careTabBtn = document.querySelector('.tab[data-tab=care]');
  if (careTabBtn) careTabBtn.addEventListener('click', function () { if (state.role && !state.mrn) renderWorklist(); });
  $('wlMine').addEventListener('change', renderWorklist);

  /* ───────── 個管師「今日待辦」 ───────── */
  function renderTodo(ms) {
    var box = $('cmTodo');
    box.classList.toggle('hidden', !state.role.admin);
    if (!state.role.admin) return;
    box.innerHTML = '';
    var real = Object.keys(ms);
    var visits = Store.listPatients();
    var groups = [];
    if (window.ERAS_QUESTIONS) {
      var qs = window.ERAS_QUESTIONS.list().filter(function (q) { return q.status === '待回覆'; });
      groups.push({ t: '病人提問待回覆', n: qs.length, mrns: qs.map(function (q) { return q.mrn; }), tab: 'questions' });
    }
    var unconf = {}; visits.forEach(function (v) { if (!Store.clinicInfo(v.mrn, v.clinicDate).confirmed) unconf[v.mrn] = 1; });
    groups.push({ t: '門診日期待確認', n: Object.keys(unconf).length, mrns: Object.keys(unconf), tab: 'records' });
    var noSurg = real.filter(function (m) { return !loadProf()[m] || !loadProf()[m].surgDate; });
    groups.push({ t: '手術日期未填', n: noSurg.length, mrns: noSurg });
    var low = real.filter(function (m) { return rateOf(m).rate < TH; });
    groups.push({ t: 'ERAS 清單執行率未達 60%', n: low.length, mrns: low });
    /* teach-back 與滿意度問卷要等到該做的時候才列入：
       teach-back＝已到手術日（術前衛教應已完成）；滿意度＝術後第 2 天起（出院前填寫） */
    var today = new Date(); today.setHours(0, 0, 0, 0);
    function daysFromSurg(m) { var p = loadProf()[m]; if (!p || !p.surgDate) return null; var s = new Date(p.surgDate + 'T00:00'); return Math.round((today - s) / 864e5); }
    var vm = visits.map(function (v) { return v.mrn; });
    if (window.ERAS_TEACHBACK && window.ERAS_TEACHBACK.summary) {
      var tbx = vm.filter(function (m) { var d = daysFromSurg(m); return d !== null && d >= 0 && window.ERAS_TEACHBACK.summary(m).blank > 0; });
      groups.push({ t: 'Teach-back 未評估完（已到手術日）', n: tbx.length, mrns: tbx });
    }
    var sv = []; try { sv = JSON.parse(localStorage.getItem('eras_survey_v2')) || []; } catch (e) {}
    var done = {}; sv.forEach(function (s) { if (s.mrn) done[String(s.mrn).toUpperCase()] = 1; });
    var nos = vm.filter(function (m) { var d = daysFromSurg(m); return d !== null && d >= 2 && !done[m]; });
    groups.push({ t: '滿意度問卷未填（術後第 2 天起）', n: nos.length, mrns: nos, tab: 'survey' });

    var h = document.createElement('h3'); h.className = 'sec-h'; h.style.marginTop = '0'; h.textContent = '今日待辦'; box.appendChild(h);
    var g = document.createElement('div'); g.className = 'todo-grid';
    groups.forEach(function (x) {
      var c = document.createElement('div'); c.className = 'todo-item' + (x.n ? ' has' : '');
      var b = document.createElement('b'); b.textContent = x.n; c.appendChild(b);
      var s = document.createElement('span'); s.textContent = x.t; c.appendChild(s);
      var uniq = x.mrns.filter(function (m, i, a) { return m && a.indexOf(m) === i; });
      if (uniq.length) {
        var l = document.createElement('div'); l.className = 'todo-mrns';
        uniq.slice(0, 6).forEach(function (m) {
          var a = document.createElement('button'); a.type = 'button'; a.className = 'link-btn'; a.textContent = m;
          a.addEventListener('click', function () { openPatient(m); }); l.appendChild(a);
        });
        if (uniq.length > 6) l.appendChild(document.createTextNode('…等 ' + uniq.length + ' 位'));
        c.appendChild(l);
      }
      if (x.tab && x.n) {
        var go = document.createElement('button'); go.type = 'button'; go.className = 'link-btn'; go.textContent = '前往分頁 →';
        go.addEventListener('click', function () { var t = document.querySelector('.tab[data-tab=' + x.tab + ']'); if (t) t.click(); });
        c.appendChild(go);
      }
      g.appendChild(c);
    });
    box.appendChild(g);
  }

  /* ───────── 病人卡片：手術資料（可編輯） ───────── */
  function profEditor(card) {
    var p = profOf(state.mrn), saved = loadProf()[state.mrn];
    var f = document.createElement('div'); f.className = 'prof-edit';
    function fld(label, el) { var l = document.createElement('label'); l.textContent = label; l.appendChild(el); f.appendChild(l); return el; }
    var d = document.createElement('input'); d.type = 'date'; d.value = p.surgDate || '';
    var t = document.createElement('input'); t.type = 'time'; t.value = p.surgTime || '';
    var s = document.createElement('select'); s.className = 'select';
    ['', '右膝', '左膝', '雙膝'].forEach(function (v) { var o = document.createElement('option'); o.value = v; o.textContent = v || '—'; s.appendChild(o); });
    var sideMap = { '右邊': '右膝', '左邊': '左膝', '雙邊': '雙膝' };
    s.value = sideMap[p.side] || p.side || '';
    var b = document.createElement('input'); b.type = 'text'; b.maxLength = 12; b.placeholder = '例：12A-05'; b.value = p.bed || '';
    var nm = document.createElement('input'); nm.type = 'text'; nm.maxLength = 20; nm.value = nameOf(state.mrn);
    var pv = Store.listPatients().filter(function (x) { return x.mrn === state.mrn; })[0];
    if (pv && pv.users && pv.users.length > 1) nm.title = '曾用來登入的姓名：' + pv.users.join('、');
    fld('病人姓名（可更正）', nm);
    fld('手術日期', d); fld('手術時間', t); fld('手術側', s); fld('病房床號', b);
    var btn = document.createElement('button'); btn.type = 'button'; btn.className = 'btn'; btn.textContent = '儲存手術資料';
    var m = document.createElement('span'); m.className = 'cd-st';
    m.textContent = saved && saved.at ? '最後更新：' + ((roleById(saved.by) || { name: saved.by }).name) + ' ' + showIso(saved.at) : '尚未填寫；病房護理師的時限提醒會依手術時間計算';
    btn.addEventListener('click', function () {
      var keepName = nm.value.trim(), orig = pv && pv.name;
      saveProf(state.mrn, { name: keepName && keepName !== orig ? keepName : '', surgDate: d.value, surgTime: t.value, side: s.value, bed: b.value.trim() });
      renderPatient();
    });
    f.appendChild(btn); f.appendChild(m);
    card.appendChild(f);
  }

  function renderPatient() {
    $('careEmpty').classList.add('hidden');
    $('careBody').classList.remove('hidden');
    var visits = Store.listPatients().filter(function (p) { return p.mrn === state.mrn; });
    var card = $('ptCard'); card.innerHTML = '';
    var h = document.createElement('div'); h.className = 'pt-main';
    var name = nameOf(state.mrn) || '（姓名未知）';
    h.innerHTML = '<span class="pt-mrn"></span><span class="pt-name"></span>';
    h.firstChild.textContent = '病歷號 ' + state.mrn;
    h.lastChild.textContent = name + (visits.some(function (v) { return v.simulated; }) ? '［模擬］' : '');
    card.appendChild(h);
    var info = document.createElement('div'); info.className = 'pt-info';
    if (visits.length) {
      var seen = {}, fin = {}, total = 0;
      visits.forEach(function (v) {
        total += Store.totalSeconds(v);
        MAINS.forEach(function (k) { if (v.nodes[k] && v.nodes[k].views > 0) seen[k] = 1; if (v.nodes[k] && v.nodes[k].done) fin[k] = 1; });
      });
      var ci = Store.clinicInfo(state.mrn, visits[0].clinicDate);
      info.textContent = '門診日期 ' + (ci.date || '—') + (ci.confirmed ? '（已確認）' : '（待確認，請在「觀看紀錄」病人明細確認）') +
        '｜衛教主要項目已看 ' + Object.keys(seen).length + '、已完成（影片＋自我檢核）' + Object.keys(fin).length + ' / ' + MAINS.length +
        '｜總觀看時間 ' + Math.round(total / 60) + ' 分鐘';
    } else info.textContent = '此病人尚未使用衛教 App（或病人手機尚未連線同步）。';
    card.appendChild(info);
    profEditor(card);
    if (window.ERAS_QUESTIONS) {
      var qs = window.ERAS_QUESTIONS.list().filter(function (q) { return q.mrn === state.mrn; });
      if (qs.length) {
        var qi = document.createElement('div'); qi.className = 'pt-info';
        var pend = qs.filter(function (q) { return q.status === '待回覆'; }).length;
        qi.textContent = '病人提問 ' + qs.length + ' 則' + (pend ? '（待回覆 ' + pend + ' 則，請個管師至「病人提問」查看）' : '');
        if (pend) qi.style.color = 'var(--red)';
        card.appendChild(qi);
      }
    }
    $('careHead').textContent = state.role.name + '｜ERAS 個案照護執行項目';
    var sc = $('careScopeWrap'); if (sc) sc.classList.toggle('hidden', !!state.role.admin);
    if (ROLE_GROUP[state.role.id]) $('careHead').textContent = '麻醉團隊（麻醉科醫師＋麻醉專科護理師）｜ERAS 個案照護執行項目';
    renderItems();
    renderTimeline();
    /* 只負責 1～2 項的職類（物理治療師、營養師、藥師）：收合執行率與說明，直接看到要填的項目 */
    var few = !state.role.admin && !($('careScope') && $('careScope').checked) &&
      LIST.filter(function (it) { return mine(it, state.role.id); }).length <= 2;
    $('careBody').classList.toggle('compact', few);
    if (few) setTimeout(function () { $('careHead').scrollIntoView({ block: 'start' }); }, 30);
    if (window.ERAS_TEACHBACK && window.ERAS_TEACHBACK.render) window.ERAS_TEACHBACK.render(state.mrn, !!state.role.admin);
  }

  /* ───────── 照護項目（健保 ERAS 執行項目清單） ───────── */
  var LIST = window.ERAS_CARE_LIST, TH = window.ERAS_PAY_THRESHOLD || 0.6;
  function isDone(r) { return r.status ? r.status === 'done' : !/^未/.test(r.value || ''); }
  function latestByItem(recs) {
    var m = {};
    recs.forEach(function (r) {
      var o = m[r.item];
      if (!o || r.execAt > o.execAt || (r.execAt === o.execAt && r.recordedAt > o.recordedAt)) m[r.item] = r;
    });
    return m;
  }
  function rateOf(mrn) {
    var last = latestByItem(loadCare().filter(function (x) { return x.mrn === mrn; }));
    var by = {}, done = 0, rec = 0;
    PHASES.forEach(function (p) { by[p] = { n: 0, d: 0 }; });
    LIST.forEach(function (it) {
      by[it.phase].n++;
      var r = last[it.id];
      if (r) { rec++; if (isDone(r)) { done++; by[it.phase].d++; } }
    });
    return { done: done, recorded: rec, total: LIST.length, rate: done / LIST.length, by: by };
  }
  function roleNames(it) { return it.roles.map(function (id) { return (roleById(id) || { name: id }).name; }).join('、'); }

  function renderRate() {
    var box = $('careRate'); if (!box) return;
    var R = rateOf(state.mrn), pct = Math.round(R.rate * 1000) / 10;
    box.innerHTML = '';
    var h = document.createElement('div'); h.className = 'rate-main';
    var v = document.createElement('span'); v.className = 'rate-v'; v.textContent = pct + '%';
    var l = document.createElement('span'); l.className = 'rate-l';
    l.textContent = 'ERAS 執行項目清單執行率｜已執行 ' + R.done + ' / ' + R.total + ' 項（已紀錄 ' + R.recorded + ' 項）';
    var b = document.createElement('span'); b.className = 'pill ' + (R.rate >= TH ? 'ok' : 'pend');
    b.textContent = R.rate >= TH ? '已達支付規範 60%' : '未達 60%';
    h.appendChild(v); h.appendChild(l); h.appendChild(b); box.appendChild(h);
    var g = document.createElement('div'); g.className = 'rate-phases';
    PHASES.forEach(function (p) {
      var c = document.createElement('div'); c.className = 'rate-ph';
      c.innerHTML = '<b></b><span></span>';
      c.firstChild.textContent = p; c.lastChild.textContent = R.by[p].d + ' / ' + R.by[p].n;
      if (R.by[p].d === R.by[p].n) c.classList.add('full');
      g.appendChild(c);
    });
    box.appendChild(g);
  }

  function renderItems() {
    var box = $('careItems'); box.innerHTML = '';
    var scopeEl = $('careScope'), all = state.role.admin || (scopeEl && scopeEl.checked);
    var records = loadCare().filter(function (x) { return x.mrn === state.mrn; });
    var shown = 0, sa = surgAt(profOf(state.mrn));
    dirty = {}; updateSaveBar();
    PHASES.forEach(function (ph) {
      var list = LIST.filter(function (it) { return it.phase === ph && (all || mine(it, state.role.id)); });
      if (!list.length) return;
      /* 會發出收案通知的項目（骨科醫師說明 ERAS 療程）放在最前面 */
      list.sort(function (a, b) { return (b.notify ? 1 : 0) - (a.notify ? 1 : 0); });
      var g = document.createElement('div'); g.className = 'phase-group';
      var t = document.createElement('div'); t.className = 'phase-title';
      var when = '';
      if (sa && (ph === '手術當天' || ph === '手術中')) when = '（手術 ' + mdhm(sa) + '）';
      if (sa && ph === '手術後') { var d1 = new Date(sa); d1.setDate(d1.getDate() + 1); when = '（OP Day ' + md(sa) + '、POD1 ' + md(d1) + '）'; }
      t.textContent = '◎' + ph + when; g.appendChild(t);
      list.forEach(function (it) { shown++; g.appendChild(itemRow(it, records.filter(function (x) { return x.item === it.id; }))); });
      box.appendChild(g);
    });
    if (!shown) { var e = document.createElement('p'); e.className = 'empty'; e.textContent = '此職類沒有暫定負責的項目，可勾選「顯示全部項目」。'; box.appendChild(e); }
    renderRate();
  }

  /* 有時限的項目：依手術時間顯示截止時間（小時＝手術後幾小時內） */
  var DUE_HOURS = { po9: 24 };

  function fieldInput(f, id) {
    var el;
    if (f.type === 'select') {
      el = document.createElement('select'); el.className = 'select';
      var o0 = document.createElement('option'); o0.value = ''; o0.textContent = '—'; el.appendChild(o0);
      f.options.forEach(function (op) { var o = document.createElement('option'); o.value = op; o.textContent = op; el.appendChild(o); });
    } else {
      el = document.createElement('input');
      el.type = f.type === 'number' ? 'number' : (f.type === 'date' ? 'date' : 'text');
      if (f.type === 'number') { el.inputMode = 'decimal'; el.min = f.min; el.max = f.max; el.step = f.step; }
      if (f.type === 'text') el.maxLength = 60;
    }
    el.id = id; return el;
  }

  function summarize(status, opts, fields, it, note) {
    var parts = [];
    if (status === 'done') {
      parts.push('已執行' + (opts.length ? '：' + opts.join('、') : ''));
      it.fields.forEach(function (f) { if (fields[f.k] !== undefined && fields[f.k] !== '') parts.push(f.label + ' ' + fields[f.k] + (f.unit ? ' ' + f.unit : '')); });
    } else parts.push('未執行／未達成');
    if (note) parts.push('說明：' + note);
    return parts.join('；');
  }

  function itemRow(it, recs) {
    var row = document.createElement('div'); row.className = 'care-item' + (it.notify ? ' ci-notify' : '');
    var top = document.createElement('div'); top.className = 'ci-top';
    var lab = document.createElement('div'); lab.className = 'ci-label'; lab.textContent = (it.notify ? '★ ' : '') + it.label;
    var last = latestByItem(recs)[it.id];
    var sa = surgAt(profOf(state.mrn));
    if (DUE_HOURS[it.id] && sa && !(last && isDone(last))) {
      var due = new Date(sa.getTime() + DUE_HOURS[it.id] * 3600e3), late = Date.now() > due.getTime();
      var dp = document.createElement('span'); dp.className = 'pill ' + (late ? 'late-pill' : 'due-pill');
      dp.textContent = (late ? '⚠ 已逾時：' : '截止 ') + mdhm(due) + (late ? '' : ' 前');
      lab.appendChild(dp);
    }
    var st = document.createElement('span');
    st.className = 'pill ' + (!last ? 'pend' : (isDone(last) ? 'ok' : 'warn-pill'));
    st.textContent = !last ? '未紀錄' : (isDone(last) ? '已執行' : '未執行／未達成') + (recs.length > 1 ? '（' + recs.length + ' 筆）' : '');
    lab.appendChild(st);
    var who = document.createElement('span'); who.className = 'ci-role'; who.textContent = '暫定負責：' + roleNames(it);
    top.appendChild(lab); top.appendChild(who);
    row.appendChild(top);

    var form = document.createElement('div'); form.className = 'ci-body';
    var name = 'st_' + it.id;
    var sw = document.createElement('div'); sw.className = 'ci-status';
    [['done', '已執行'], ['not', '未執行／未達成']].forEach(function (x, i) {
      var l = document.createElement('label'); var r = document.createElement('input');
      r.type = 'radio'; r.name = name; r.value = x[0]; if (!i) r.checked = true;
      l.appendChild(r); l.appendChild(document.createTextNode(' ' + x[1])); sw.appendChild(l);
    });
    form.appendChild(sw);
    var optBox = document.createElement('div'); optBox.className = 'ci-opts';
    it.opts.forEach(function (op, i) {
      var l = document.createElement('label'); var c = document.createElement('input');
      c.type = 'checkbox'; c.value = op; c.id = 'co_' + it.id + '_' + i;
      l.appendChild(c); l.appendChild(document.createTextNode(' ' + op)); optBox.appendChild(l);
    });
    form.appendChild(optBox);
    var fBox = document.createElement('div'); fBox.className = 'ci-form';
    var fEls = {};
    it.fields.forEach(function (f) {
      var l = document.createElement('label'); l.className = 'ci-time-label'; l.textContent = f.label;
      var el = fieldInput(f, 'cf_' + it.id + '_' + f.k); l.htmlFor = el.id; fEls[f.k] = el;
      fBox.appendChild(l); fBox.appendChild(el);
      if (f.unit) { var u = document.createElement('span'); u.className = 'ci-unit'; u.textContent = f.unit; fBox.appendChild(u); }
    });
    if (fEls.pname && !fEls.pname.value) {
      var known = nameOf(state.mrn);
      if (known && known !== '測試病人') fEls.pname.value = known;
    }
    if (it.notify) {
      var nh = document.createElement('p'); nh.className = 'hint'; nh.style.margin = '6px 0 0';
      nh.textContent = '勾選已執行並儲存後，會發出「ERAS 個案收案通知」給各職類（病歷號、姓名、手術部位、手術醫師）。';
      form.appendChild(nh);
    }
    /* 填了某時間點的分數（例如「POD2 疼痛」）→ 自動勾選該時間點（POD2） */
    it.fields.forEach(function (f) {
      var opt = it.opts.filter(function (op) { return f.label.indexOf(op + ' ') === 0; })[0];
      if (!opt) return;
      var ev = function () {
        if (String(fEls[f.k].value).trim() === '') return;
        optBox.querySelectorAll('input').forEach(function (c) { if (c.value === opt) c.checked = true; });
      };
      fEls[f.k].addEventListener('input', ev); fEls[f.k].addEventListener('change', ev);
    });
    if (fEls.h && fEls.w && fEls.bmi) {
      var calc = function () { var h = Number(fEls.h.value) / 100, w = Number(fEls.w.value); if (h > 0 && w > 0) fEls.bmi.value = (w / (h * h)).toFixed(1); };
      fEls.h.addEventListener('input', calc); fEls.w.addEventListener('input', calc);
    }
    var nl = document.createElement('label'); nl.className = 'ci-time-label'; nl.textContent = '說明';
    var note = document.createElement('input'); note.type = 'text'; note.maxLength = 100; note.id = 'cn_' + it.id; note.placeholder = '未執行時必填';
    nl.htmlFor = note.id;
    var tl = document.createElement('label'); tl.className = 'ci-time-label'; tl.textContent = '執行時間';
    var time = document.createElement('input'); time.type = 'datetime-local'; time.value = localNow(); time.id = 'ct_' + it.id;
    tl.htmlFor = time.id;
    var save = document.createElement('button'); save.type = 'button'; save.className = 'btn'; save.textContent = '儲存';
    var msg = document.createElement('span'); msg.className = 'err';
    fBox.appendChild(nl); fBox.appendChild(note); fBox.appendChild(tl); fBox.appendChild(time); fBox.appendChild(save); fBox.appendChild(msg);
    form.appendChild(fBox);
    var sync = function () {
      var done = form.querySelector('input[name=' + name + ']:checked').value === 'done';
      optBox.classList.toggle('off', !done);
      optBox.querySelectorAll('input').forEach(function (c) { c.disabled = !done; });
      Object.keys(fEls).forEach(function (k) { fEls[k].disabled = !done; });
      note.placeholder = done ? '選填' : '未執行時必填';
    };
    sw.addEventListener('change', sync); sync();

    /* 有修改 → 列入「全部儲存」；執行時間若沒手動改過，更新為開始填寫的時間 */
    var timeTouched = false;
    time.addEventListener('input', function () { timeTouched = true; });
    var markDirty = function () {
      if (!dirty[it.id]) { if (!timeTouched) time.value = localNow(); dirty[it.id] = doSave; row.classList.add('dirty'); updateSaveBar(); }
    };
    form.addEventListener('input', markDirty); form.addEventListener('change', markDirty);

    function doSave(batch) {
      msg.textContent = '';
      var status = form.querySelector('input[name=' + name + ']:checked').value;
      var opts = [], fields = {};
      optBox.querySelectorAll('input:checked').forEach(function (c) { opts.push(c.value); });
      var n = note.value.trim();
      if (status === 'done') {
        if (it.opts.length && !opts.length) { msg.textContent = '請勾選已執行的內容'; return false; }
        for (var i = 0; i < it.fields.length; i++) {
          var f = it.fields[i], val = String(fEls[f.k].value || '').trim();
          if (val === '') { if (f.req) { msg.textContent = '請填寫' + f.label; return false; } continue; }
          if (f.type === 'number') {
            var x = Number(val);
            if (isNaN(x) || x < f.min || x > f.max) { msg.textContent = f.label + '需在 ' + f.min + '～' + f.max + ' 之間'; return false; }
          }
          fields[f.k] = val;
        }
      } else if (!n) { msg.textContent = '未執行／未達成時請填寫說明'; return false; }
      if (!time.value) { msg.textContent = '請填寫執行時間'; return false; }
      var all = loadCare();
      all.push({ id: Date.now().toString(36) + Math.random().toString(36).slice(2, 6), mrn: state.mrn, role: state.role.id,
        item: it.id, status: status, opts: opts, fields: fields, note: n,
        value: summarize(status, opts, fields, it, n), execAt: time.value, recordedAt: new Date().toISOString(), simulated: !!CFG.demo });
      saveCare(all);
      if (it.notify && status === 'done' && window.ERAS_NOTICES) {
        window.ERAS_NOTICES.add({ mrn: state.mrn, name: fields.pname, site: fields.site, surgeon: fields.surgeon, by: state.role.id, simulated: !!CFG.demo });
      }
      delete dirty[it.id]; row.classList.remove('dirty');
      if (!batch) {
        /* 單項儲存：保留其他尚未儲存項目的輸入，只重畫時間軸與執行率 */
        if (Object.keys(dirty).length) { row.classList.remove('dirty'); msg.textContent = ''; save.textContent = '已儲存 ✓'; updateSaveBar(); renderTimeline(); renderRate(); }
        else if (it.notify) renderPatient();   // 收案資料（手術側、姓名）會影響病人卡片
        else { renderItems(); renderTimeline(); }
      }
      return true;
    }
    save.addEventListener('click', function () { doSave(false); });
    row.appendChild(form);

    if (recs.length) {
      var hist = document.createElement('ul'); hist.className = 'ci-hist';
      recs.slice().sort(function (a, b) { return a.execAt < b.execAt ? 1 : -1; }).forEach(function (r) {
        var li = document.createElement('li');
        var a = document.createElement('span'); a.className = 'ci-exec'; a.textContent = showLocal(r.execAt);
        var b = document.createElement('span'); b.className = 'ci-val'; b.textContent = r.value;
        var c = document.createElement('span'); c.className = 'ci-rec'; c.textContent = (roleById(r.role) || { name: r.role }).name + '｜紀錄於 ' + showIso(r.recordedAt);
        li.appendChild(a); li.appendChild(b); li.appendChild(c);
        if (r.role === state.role.id) {
          var d = document.createElement('button'); d.type = 'button'; d.className = 'link-btn'; d.textContent = '刪除';
          d.addEventListener('click', function () {
            if (d.dataset.armed) { saveCare(loadCare().filter(function (x) { return x.id !== r.id; })); renderItems(); renderTimeline(); return; }
            d.dataset.armed = '1'; d.textContent = '再按一次刪除';
            setTimeout(function () { d.dataset.armed = ''; d.textContent = '刪除'; }, 4000);
          });
          li.appendChild(d);
        }
        hist.appendChild(li);
      });
      row.appendChild(hist);
    }
    return row;
  }
  var scopeBox = $('careScope');
  if (scopeBox) scopeBox.addEventListener('change', function () {
    if (!confirmLeave()) { scopeBox.checked = !scopeBox.checked; return; }
    if (state.mrn) renderItems();
  });

  /* ───────── 時間軸與總表 ───────── */
  function careRow(r, withMrn) {
    var it = itemById(r.item) || { label: r.item, phase: '' }, ro = roleById(r.role) || { name: r.role };
    var tr = document.createElement('tr');
    if (withMrn) tr.appendChild(td(r.mrn + (r.simulated ? '（模擬）' : '')));
    tr.appendChild(td(showLocal(r.execAt)));
    tr.appendChild(td(it.phase));
    tr.appendChild(td(ro.name));
    tr.appendChild(td(it.label));
    tr.appendChild(td(r.value));
    tr.appendChild(td(showIso(r.recordedAt)));
    return tr;
  }
  function renderTimeline() {
    var recs = loadCare().filter(function (x) { return x.mrn === state.mrn; }).sort(function (a, b) { return a.execAt < b.execAt ? -1 : 1; });
    var tb = $('tblTimeline').querySelector('tbody'); tb.innerHTML = '';
    recs.forEach(function (r) { tb.appendChild(careRow(r, false)); });
    $('tlEmpty').classList.toggle('hidden', recs.length > 0);
  }
  function careAllFiltered() {
    var q = $('cq').value.trim().toUpperCase();
    return loadCare().filter(function (r) {
      if (!q) return true;
      var it = itemById(r.item) || {}, ro = roleById(r.role) || {};
      return (r.mrn + ' ' + (it.label || '') + ' ' + (ro.name || '')).toUpperCase().indexOf(q) >= 0;
    }).sort(function (a, b) { return a.mrn === b.mrn ? (a.execAt < b.execAt ? -1 : 1) : (a.mrn < b.mrn ? -1 : 1); });
  }
  function renderCareAll() {
    var list = careAllFiltered();
    var rb = $('tblRate').querySelector('tbody'); rb.innerHTML = '';
    var mrns = {}; list.forEach(function (r) { mrns[r.mrn] = mrns[r.mrn] || r.simulated; });
    Object.keys(mrns).sort().forEach(function (m) {
      var R = rateOf(m), tr = document.createElement('tr');
      tr.appendChild(td(m + (mrns[m] ? '（模擬）' : '')));
      tr.appendChild(td(R.recorded + ' / ' + R.total, 'num'));
      tr.appendChild(td(R.done + ' / ' + R.total, 'num'));
      tr.appendChild(td((Math.round(R.rate * 1000) / 10) + '%', 'num'));
      tr.appendChild(td(R.rate >= TH ? '已達' : '未達'));
      rb.appendChild(tr);
    });
    var tb = $('tblCareAll').querySelector('tbody'); tb.innerHTML = '';
    list.forEach(function (r) { tb.appendChild(careRow(r, true)); });
    $('careAllEmpty').classList.toggle('hidden', list.length > 0);
  }
  $('cq').addEventListener('input', renderCareAll);
  var tabAll = document.querySelector('.tab[data-tab=careall]');
  if (tabAll) tabAll.addEventListener('click', renderCareAll);
  $('btnCopyCare').addEventListener('click', function () {
    var rows = [['病歷號', '執行時間', '階段', '職類', '照護項目', '內容', '紀錄時間', '模擬資料']];
    careAllFiltered().forEach(function (r) {
      var it = itemById(r.item) || { label: r.item, phase: '' }, ro = roleById(r.role) || { name: r.role };
      rows.push([r.mrn, showLocal(r.execAt), it.phase, ro.name, it.label, r.value, showIso(r.recordedAt), r.simulated ? '是' : '否']);
    });
    var text = rows.map(function (x) { return x.map(function (c) { return String(c).replace(/[\t\n]/g, ' '); }).join('\t'); }).join('\n');
    var btn = this, orig = btn.textContent;
    var done = function (m) { btn.textContent = m; setTimeout(function () { btn.textContent = orig; }, 2500); };
    var fallback = function () { var ta = $('copyBoxCare'); ta.value = text; ta.classList.remove('hidden'); ta.select(); done('請按 Ctrl+C 複製下方內容'); };
    if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(text).then(function () { done('已複製，可貼到 Excel'); }, fallback);
    else fallback();
  });

  /* ───────── 展示用模擬照護紀錄 ───────── */
  function seedCare() {
    var all = loadCare();
    var sims = all.filter(function (r) { return r.simulated; });
    if (sims.length && sims.every(function (r) { return itemById(r.item); })) return;
    all = all.filter(function (r) { return !r.simulated; }); // 移除舊版範例項目的模擬紀錄
    function day(off, hm) { var d = new Date(); d.setDate(d.getDate() + off); return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate()) + 'T' + hm; }
    // [病歷號, 項目, 天數偏移, 時間, 已執行內容, 欄位, 未執行說明]
    var seed = [
      ['SIM0001', 'op1', -14, '09:10', ['說明解釋', '手術風險評估']], ['SIM0001', 'op2', -14, '09:40', ['完成說明流程']],
      ['SIM0001', 'op3', -14, '10:00', ['CxR', 'EKG']], ['SIM0001', 'op4', -14, '10:05', ['CBC、BCS、PT、PTT、Albumin、HbA1C']],
      ['SIM0001', 'op5', -14, '10:30', ['術前物理治療諮詢衛教']], ['SIM0001', 'op6', -14, '10:50', ['營養諮詢衛教'], { h: '158', w: '66', bmi: '26.4', alb: '4.1' }],
      ['SIM0001', 'op7', -14, '11:10', ['用藥評估', '抗凝血用藥評估']], ['SIM0001', 'op8', -14, '09:45', ['無抽菸']],
      ['SIM0001', 'op9', -14, '09:46', ['無酗酒']], ['SIM0001', 'op10', -14, '10:05', ['Hb 檢驗']],
      ['SIM0001', 'op11', -10, '14:00', ['麻醉風險評估', '術前 PONV 評估', '多模止痛計畫'], { asa: 'III' }],
      ['SIM0001', 'ad2', -2, '20:00', ['肥皂或含抗菌劑']], ['SIM0001', 'ad3', -2, '19:00', ['避免常規使用 BZDs']],
      ['SIM0001', 'ad5', -2, '16:00', ['入院護理衛教', '術前護理衛教']],
      ['SIM0001', 'sd1', -1, '06:00', ['澄清液體禁食兩小時']], ['SIM0001', 'sd2', -1, '07:55', ['劃刀前 60 分鐘內投予']],
      ['SIM0001', 'sd4', -1, '07:30', ['PONV 風險／用藥評估']],
      ['SIM0001', 'io1', -1, '08:20', ['nerve block', 'LIA']], ['SIM0001', 'io2', -1, '08:10', ['至少 2 類具實證效果止吐藥']],
      ['SIM0001', 'io3', -1, '08:05', ['體溫量測', '主動保溫']], ['SIM0001', 'io4', -1, '09:30', ['避免過度輸液']],
      ['SIM0001', 'io6', -1, '08:40', ['術中 Tranexamic acid 使用']],
      ['SIM0001', 'po1', -1, '10:30', ['口服止痛藥', 'nerve block']], ['SIM0001', 'po2', -1, '20:00', ['OP Day']],
      ['SIM0001', 'po3', -1, '20:00', ['OP Day']], ['SIM0001', 'po4', -1, '10:40', ['未放置']],
      ['SIM0001', 'po7', -1, '16:30', ['物理治療師術後訪視', '協助下床']], ['SIM0001', 'po8', -1, '13:00', ['術後及早進食']],
      ['SIM0001', 'po9', -1, '16:35', ['床邊站立', '下床走動']], ['SIM0001', 'po10', -1, '16:40', ['及早下床活動', '機械式預防措施']],
      ['SIM0001', 'ad4', -2, '19:05', null, null, '依病況給予術前輸液'],
      ['SIM0002', 'op1', -3, '14:00', ['說明解釋']], ['SIM0002', 'op2', -3, '14:30', ['完成說明流程']],
      ['SIM0002', 'op8', -3, '14:35', ['戒菸諮詢衛教']]
    ];
    var who = {};
    window.ERAS_CARE_LIST.forEach(function (it) { who[it.id] = it.roles[0]; });
    seed.forEach(function (s, i) {
      var it = itemById(s[1]), status = s[4] ? 'done' : 'not', opts = s[4] || [], fields = s[5] || {}, note = s[6] || '';
      var at = day(s[2], s[3]);
      all.push({ id: 'sim' + i, mrn: s[0], role: who[s[1]], item: s[1], status: status, opts: opts, fields: fields, note: note,
        value: summarize(status, opts, fields, it, note), execAt: at, recordedAt: new Date(at).toISOString(), simulated: true });
    });
    saveCare(all);
  }

  window.ERAS_TEAM = {
    isAdmin: function () { return !!(state.role && state.role.admin); },
    isSuper: function () { return !!(state.role && state.role.super); },
    clearSimCare: function () { saveCare(loadCare().filter(function (r) { return !r.simulated; })); },
    /* 從收案通知等處直接開啟某位病人的照護紀錄 */
    openPatient: function (m) {
      if (!state.role || !m) return;
      var t = document.querySelector('.tab[data-tab=care]'); if (t) t.click();
      openPatient(String(m).toUpperCase());
    }
  };

  /* 重新整理頁面時保留登入職類（同一分頁） */
  var ss = sid(), saved = ss && ss.getItem(ROLE_KEY);
  if (saved && roleById(saved) && Cloud && Cloud.teamWho()) { enter(withAdmin(roleById(saved), !!ss.getItem('eras_team_admin'))); Cloud.sync(); }
})();
