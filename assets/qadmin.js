/* ERAS 團隊端：病人提問清單（個管師） */
(function () {
  var Q = window.ERAS_QUESTIONS, CFG = window.ERAS_CONFIG, ROLES = window.ERAS_ROLES;
  var $ = function (id) { return document.getElementById(id); };
  function pad(n) { return String(n).padStart(2, '0'); }
  function showIso(iso) { if (!iso) return ''; var d = new Date(iso); return d.getFullYear() + '/' + pad(d.getMonth() + 1) + '/' + pad(d.getDate()) + ' ' + pad(d.getHours()) + ':' + pad(d.getMinutes()); }
  function el(tag, cls, text) { var e = document.createElement(tag); if (cls) e.className = cls; if (text !== undefined) e.textContent = text; return e; }
  function roleName() {
    var id = null; try { id = sessionStorage.getItem('eras_team_role'); } catch (e) {}
    var r = ROLES.filter(function (x) { return x.id === id; })[0];
    return r ? r.name : 'ERAS 團隊';
  }
  function authed() { return window.ERAS_TEAM && window.ERAS_TEAM.isAdmin(); }

  function filtered() {
    var q = $('qq').value.trim().toUpperCase(), st = $('qStatus').value;
    return Q.list().filter(function (x) {
      if (st && x.status !== st) return false;
      if (!q) return true;
      return [x.name, x.mrn, x.phone, x.email, x.text, x.nodeTitle].join(' ').toUpperCase().indexOf(q) >= 0;
    }).sort(function (a, b) {
      var ra = a.status === '待回覆' ? 0 : 1, rb = b.status === '待回覆' ? 0 : 1;
      return ra !== rb ? ra - rb : (a.createdAt < b.createdAt ? 1 : -1);
    });
  }

  function badge() {
    var n = Q.list().filter(function (x) { return x.status === '待回覆'; }).length;
    var b = $('qBadge'); b.textContent = n; b.classList.toggle('hidden', !n);
  }

  function card(q) {
    var c = el('div', 'card q-card' + (q.status === '待回覆' ? ' q-new' : ''));
    var h = el('div', 'q-head');
    h.appendChild(el('span', 'q-when', showIso(q.createdAt)));
    h.appendChild(el('span', 'pt-mrn', q.mrn));
    h.appendChild(el('span', 'pt-name', q.name + (q.simulated ? '［模擬］' : '')));
    h.appendChild(el('span', 'q-meta', (q.clinicDate ? '門診 ' + q.clinicDate + '｜' : '') + (q.who || '') + (q.nodeTitle ? '｜提問時觀看：' + q.nodeTitle : '')));
    c.appendChild(h);

    var ct = el('div', 'q-contact');
    if (q.phone) { var a = el('a', 'q-link', '☎ ' + q.phone); a.href = 'tel:' + q.phone; ct.appendChild(a); }
    if (q.email) { var m = el('a', 'q-link', '✉ ' + q.email); m.href = 'mailto:' + q.email; ct.appendChild(m); }
    ct.appendChild(el('span', 'q-meta', '方便聯絡：' + (q.contactTime || '不限')));
    c.appendChild(ct);

    if (q.text) c.appendChild(el('p', 'q-text', q.text));
    if (q.audio) {
      var au = document.createElement('audio'); au.controls = true; au.preload = 'none'; au.src = q.audio; au.className = 'q-audio';
      c.appendChild(au);
      c.appendChild(el('span', 'q-meta', q.audioFrom === 'file' ? '病人上傳的語音檔' : '語音提問' + (q.audioSec ? ' ' + q.audioSec + ' 秒' : '')));
    }

    var act = el('div', 'ci-form');
    var sel = document.createElement('select'); sel.className = 'select'; sel.style.width = 'auto';
    Q.STATUS.forEach(function (s) { var o = el('option', '', s); o.value = s; if (s === q.status) o.selected = true; sel.appendChild(o); });
    var note = document.createElement('input'); note.type = 'text'; note.maxLength = 200; note.placeholder = '聯絡紀錄或回覆內容';
    var save = el('button', 'btn', '儲存'); save.type = 'button';
    var msg = el('span', 'err');
    save.addEventListener('click', function () {
      var n = note.value.trim(), s = sel.value;
      if (!n && s === q.status) { msg.textContent = '請填寫聯絡紀錄或變更狀態'; return; }
      Q.update(q.id, function (x) {
        if (s !== x.status) x.replies.push({ at: new Date().toISOString(), role: roleName(), note: '狀態改為「' + s + '」' });
        if (n) x.replies.push({ at: new Date().toISOString(), role: roleName(), note: n });
        x.status = s;
      });
      render();
    });
    act.appendChild(el('span', 'ci-time-label', '狀態')); act.appendChild(sel); act.appendChild(note); act.appendChild(save); act.appendChild(msg);
    c.appendChild(act);

    if (q.replies && q.replies.length) {
      var ul = el('ul', 'ci-hist');
      q.replies.forEach(function (r) {
        var li = el('li');
        li.appendChild(el('span', 'ci-exec', showIso(r.at)));
        li.appendChild(el('span', 'ci-val', r.note));
        li.appendChild(el('span', 'ci-rec', r.role));
        ul.appendChild(li);
      });
      c.appendChild(ul);
    }
    return c;
  }

  function render() {
    badge();
    if (!authed()) return;
    var list = filtered(), box = $('qList'); box.innerHTML = '';
    list.forEach(function (q) { box.appendChild(card(q)); });
    $('qEmpty').classList.toggle('hidden', list.length > 0);
  }

  $('qq').addEventListener('input', render);
  $('qStatus').addEventListener('change', render);
  var tab = document.querySelector('.tab[data-tab=questions]');
  if (tab) tab.addEventListener('click', render);

  $('btnCopyQ').addEventListener('click', function () {
    var rows = [['提問時間', '姓名', '病歷號', '門診日期', '提問者', '電話', 'Email', '方便聯絡時段', '提問時觀看項目', '問題', '語音', '狀態', '聯絡紀錄', '模擬資料']];
    filtered().forEach(function (q) {
      rows.push([showIso(q.createdAt), q.name, q.mrn, q.clinicDate, q.who, q.phone, q.email, q.contactTime, q.nodeTitle, q.text,
        q.audio ? '有' : '無', q.status, (q.replies || []).map(function (r) { return showIso(r.at) + ' ' + r.role + '：' + r.note; }).join('／'),
        q.simulated ? '是' : '否']);
    });
    var text = rows.map(function (x) { return x.map(function (c) { return String(c == null ? '' : c).replace(/[\t\n\r]/g, ' '); }).join('\t'); }).join('\n');
    var btn = this, orig = btn.textContent;
    var done = function (m) { btn.textContent = m; setTimeout(function () { btn.textContent = orig; }, 2500); };
    var fallback = function () { var ta = $('copyBoxQ'); ta.value = text; ta.classList.remove('hidden'); ta.select(); done('請按 Ctrl+C 複製下方內容'); };
    if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(text).then(function () { done('已複製，可貼到 Excel'); }, fallback);
    else fallback();
  });

  /* 展示用模擬提問 */
  function seed() {
    if (!CFG.demo || Q.list().some(function (q) { return q.simulated && q.seed; })) return;
    var now = Date.now();
    var demo = [
      { name: '模擬病人甲', mrn: 'SIM0001', who: '病人本人', phone: '0900000001', email: '', contactTime: '上午', nodeTitle: '主動告知用藥', text: '我每天吃阿斯匹靈，手術前需要停嗎？要停幾天？', h: 26, status: '待回覆' },
      { name: '模擬病人乙', mrn: 'SIM0002', who: '家屬或照顧者', phone: '', email: 'family.demo@example.com', contactTime: '晚上', nodeTitle: '術前禁食', text: '我媽媽有糖尿病，手術當天早上可以喝那個碳水飲品嗎？', h: 5, status: '已聯絡',
        replies: [{ h: 3, note: '已電話聯絡家屬，說明依麻醉科術前訪視指示，並請攜帶藥袋。' }] }
    ];
    demo.forEach(function (d) {
      var q = Q.add({ patientKey: d.mrn + '|sim', name: d.name, mrn: d.mrn, clinicDate: '', who: d.who, phone: d.phone, email: d.email,
        contactTime: d.contactTime, node: '', nodeTitle: d.nodeTitle, text: d.text, audio: '', audioSec: 0, audioFrom: '', simulated: true, seed: true });
      if (!q) return;
      Q.update(q.id, function (x) {
        x.createdAt = new Date(now - d.h * 3600e3).toISOString();
        x.status = d.status;
        x.replies = (d.replies || []).map(function (r) { return { at: new Date(now - r.h * 3600e3).toISOString(), role: 'ERAS 個管師', note: r.note }; });
      });
    });
  }

  window.ERAS_QADMIN = { refresh: function () { seed(); render(); } };
  if (authed()) window.ERAS_QADMIN.refresh();
})();
