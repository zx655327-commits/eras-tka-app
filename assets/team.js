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

  /* ───────── 登入 ───────── */
  ROLES.forEach(function (r) {
    var o = document.createElement('option'); o.value = r.id; o.textContent = r.name; $('role').appendChild(o);
  });
  if (CFG.demo) {
    var h = $('pinHint');
    h.innerHTML = '<strong>展示版各職類密碼</strong>';
    var ul = document.createElement('div'); ul.className = 'pin-list';
    ROLES.forEach(function (r) { var s = document.createElement('span'); s.textContent = r.name + '：' + r.pin; ul.appendChild(s); });
    h.appendChild(ul); h.classList.remove('hidden');
  }
  $('pinForm').addEventListener('submit', function (e) {
    e.preventDefault();
    var r = roleById($('role').value);
    if (!r || $('pin').value !== r.pin) { $('pinErr').textContent = '密碼與職類不符，請再確認。'; return; }
    $('pinErr').textContent = ''; $('pin').value = '';
    var ss = sid(); if (ss) ss.setItem(ROLE_KEY, r.id);
    enter(r);
  });
  $('btnTeamLogout').addEventListener('click', function () {
    var ss = sid(); if (ss) ss.removeItem(ROLE_KEY);
    state.role = null; state.mrn = null;
    $('careMrn').value = ''; $('careBody').classList.add('hidden'); $('careEmpty').classList.remove('hidden');
    $('pinOverlay').classList.remove('hidden');
  });

  function enter(r) {
    state.role = r;
    $('pinOverlay').classList.add('hidden');
    $('whoRole').textContent = '目前職類：' + r.name;
    document.querySelectorAll('.tab.adm').forEach(function (t) { t.classList.toggle('hidden', !r.admin); });
    var careTab = document.querySelector('.tab[data-tab=care]');
    if (careTab) careTab.click();
    if (CFG.demo) seedCare();
    if (state.mrn) renderPatient();
    if (r.admin && window.ERAS_ADMIN_REFRESH) window.ERAS_ADMIN_REFRESH();
    if (r.admin && window.ERAS_QADMIN) window.ERAS_QADMIN.refresh();
    if (r.admin && window.ERAS_SADMIN) window.ERAS_SADMIN.refresh();
    setTimeout(function () { $('careMrn').focus(); }, 50);
  }

  /* ───────── 病歷號查詢 ───────── */
  $('mrnForm').addEventListener('submit', function (e) {
    e.preventDefault();
    var m = $('careMrn').value.trim().toUpperCase();
    if (!/^[A-Z0-9-]{4,20}$/.test(m)) { $('mrnErr').textContent = '請輸入正確的病歷號（英文字母或數字）。'; return; }
    $('mrnErr').textContent = '';
    state.mrn = m;
    renderPatient();
  });

  function renderPatient() {
    $('careEmpty').classList.add('hidden');
    $('careBody').classList.remove('hidden');
    var visits = Store.listPatients().filter(function (p) { return p.mrn === state.mrn; });
    var card = $('ptCard'); card.innerHTML = '';
    var h = document.createElement('div'); h.className = 'pt-main';
    var name = visits.length ? visits[0].name : '（尚無衛教觀看資料）';
    h.innerHTML = '<span class="pt-mrn"></span><span class="pt-name"></span>';
    h.firstChild.textContent = '病歷號 ' + state.mrn;
    h.lastChild.textContent = name + (visits.some(function (v) { return v.simulated; }) ? '［模擬］' : '');
    card.appendChild(h);
    var info = document.createElement('div'); info.className = 'pt-info';
    if (visits.length) {
      var seen = {}, total = 0;
      visits.forEach(function (v) {
        total += Store.totalSeconds(v);
        MAINS.forEach(function (k) { if (v.nodes[k] && v.nodes[k].views > 0) seen[k] = 1; });
      });
      info.textContent = '門診日期 ' + visits.map(function (v) { return v.clinicDate; }).join('、') +
        '｜衛教主要項目已看 ' + Object.keys(seen).length + ' / ' + MAINS.length +
        '｜總觀看時間 ' + Math.round(total / 60) + ' 分鐘';
    } else info.textContent = '這台裝置上沒有此病歷號的衛教觀看紀錄。';
    card.appendChild(info);
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
    renderItems();
    renderTimeline();
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
    var shown = 0;
    PHASES.forEach(function (ph) {
      var list = LIST.filter(function (it) { return it.phase === ph && (all || it.roles.indexOf(state.role.id) >= 0); });
      if (!list.length) return;
      var g = document.createElement('div'); g.className = 'phase-group';
      var t = document.createElement('div'); t.className = 'phase-title'; t.textContent = '◎' + ph; g.appendChild(t);
      list.forEach(function (it) { shown++; g.appendChild(itemRow(it, records.filter(function (x) { return x.item === it.id; }))); });
      box.appendChild(g);
    });
    if (!shown) { var e = document.createElement('p'); e.className = 'empty'; e.textContent = '此職類沒有暫定負責的項目，可勾選「顯示全部項目」。'; box.appendChild(e); }
    renderRate();
  }

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
    var row = document.createElement('div'); row.className = 'care-item';
    var top = document.createElement('div'); top.className = 'ci-top';
    var lab = document.createElement('div'); lab.className = 'ci-label'; lab.textContent = it.label;
    var last = latestByItem(recs)[it.id];
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

    save.addEventListener('click', function () {
      var status = form.querySelector('input[name=' + name + ']:checked').value;
      var opts = [], fields = {};
      optBox.querySelectorAll('input:checked').forEach(function (c) { opts.push(c.value); });
      var n = note.value.trim();
      if (status === 'done') {
        if (it.opts.length && !opts.length) { msg.textContent = '請勾選已執行的內容'; return; }
        for (var i = 0; i < it.fields.length; i++) {
          var f = it.fields[i], val = String(fEls[f.k].value || '').trim();
          if (val === '') continue;
          if (f.type === 'number') {
            var x = Number(val);
            if (isNaN(x) || x < f.min || x > f.max) { msg.textContent = f.label + '需在 ' + f.min + '～' + f.max + ' 之間'; return; }
          }
          fields[f.k] = val;
        }
      } else if (!n) { msg.textContent = '未執行／未達成時請填寫說明'; return; }
      if (!time.value) { msg.textContent = '請填寫執行時間'; return; }
      var all = loadCare();
      all.push({ id: Date.now().toString(36) + Math.random().toString(36).slice(2, 6), mrn: state.mrn, role: state.role.id,
        item: it.id, status: status, opts: opts, fields: fields, note: n,
        value: summarize(status, opts, fields, it, n), execAt: time.value, recordedAt: new Date().toISOString(), simulated: !!CFG.demo });
      saveCare(all);
      renderItems(); renderTimeline();
    });
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
  if (scopeBox) scopeBox.addEventListener('change', function () { if (state.mrn) renderItems(); });

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
    clearSimCare: function () { saveCare(loadCare().filter(function (r) { return !r.simulated; })); }
  };

  /* 重新整理頁面時保留登入職類（同一分頁） */
  var ss = sid(), saved = ss && ss.getItem(ROLE_KEY);
  if (saved && roleById(saved)) enter(roleById(saved));
})();
