/*
 * ERAS 團隊端：個案收案通知
 * 骨科醫師在「1.醫師說明 ERAS 療程」勾選已執行並儲存後，發出收案通知給所有職類。
 * 通知內容：病歷號、姓名、手術部位、手術醫師。
 *
 * ※ 目前資料存在瀏覽器（localStorage），通知只會出現在「同一台裝置」上登入的各職類。
 *   要讓不同人的手機都收到，須接院內伺服器（ERAS_CONFIG.apiBase）或院內通訊系統。
 */
(function () {
  var KEY = 'eras_notices_v1';
  var CFG = window.ERAS_CONFIG || {}, ROLES = window.ERAS_ROLES || [];
  var $ = function (id) { return document.getElementById(id); };
  function load() { try { return JSON.parse(localStorage.getItem(KEY)) || []; } catch (e) { return []; } }
  function save(list) { try { localStorage.setItem(KEY, JSON.stringify(list)); return true; } catch (e) { return false; } }
  function pad(n) { return String(n).padStart(2, '0'); }
  function showIso(iso) { var d = new Date(iso); return d.getFullYear() + '/' + pad(d.getMonth() + 1) + '/' + pad(d.getDate()) + ' ' + pad(d.getHours()) + ':' + pad(d.getMinutes()); }
  function roleName(id) { var r = ROLES.filter(function (x) { return x.id === id; })[0]; return r ? r.name : id; }
  function currentRole() { try { return sessionStorage.getItem('eras_team_role'); } catch (e) { return null; } }

  var N = {
    list: function () { return load().sort(function (a, b) { return a.at < b.at ? 1 : -1; }); },
    /* n = { mrn, name, site, surgeon, by, simulated } */
    add: function (n) {
      var list = load(), prev = list.filter(function (x) { return x.mrn === n.mrn; });
      var item = { id: Date.now().toString(36) + Math.random().toString(36).slice(2, 6), kind: prev.length ? '收案資料更新' : 'ERAS 個案收案',
        mrn: n.mrn, name: n.name, site: n.site, surgeon: n.surgeon, by: n.by, at: new Date().toISOString(), readBy: {}, simulated: !!n.simulated };
      item.readBy[n.by] = item.at; // 發出者本人視為已讀
      list.push(item); save(list);
      if (CFG.apiBase) { try { fetch(CFG.apiBase + '/notices', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(item) }); } catch (e) {} }
      refresh();
      return item;
    },
    unread: function (role) { return load().filter(function (x) { return !x.readBy[role]; }); },
    markRead: function (id, role) {
      var list = load(); list.forEach(function (x) { if ((id === '*' || x.id === id) && !x.readBy[role]) x.readBy[role] = new Date().toISOString(); }); save(list);
    },
    removeSimulated: function () { save(load().filter(function (x) { return !x.simulated; })); refresh(); },
    seed: function () {
      if (!CFG.demo || load().some(function (x) { return x.seed; })) return;
      var list = load();
      list.push({ id: 'seed1', kind: 'ERAS 個案收案', mrn: 'SIM0002', name: '模擬病人乙', site: '右膝', surgeon: '模擬骨科醫師',
        by: 'ortho', at: new Date(Date.now() - 2 * 3600e3).toISOString(), readBy: { ortho: '1' }, simulated: true, seed: true });
      save(list);
    }
  };
  window.ERAS_NOTICES = N;

  /* ───────── 介面：鈴鐺＋通知清單 ───────── */
  var bell = document.createElement('button');
  bell.type = 'button'; bell.className = 'tb-btn hidden'; bell.id = 'btnNotice';
  bell.innerHTML = '🔔 收案通知 <span class="badge hidden" id="noticeBadge"></span>';
  var top = document.querySelector('.topbar-inner'), lo = $('btnTeamLogout');
  if (top) top.insertBefore(bell, lo || null);

  var ov = document.createElement('div');
  ov.className = 'overlay hidden'; ov.id = 'noticeOverlay'; ov.setAttribute('role', 'dialog');
  ov.innerHTML = '<div class="login notice-box"><h1>ERAS 個案收案通知</h1>' +
    '<p class="sub">骨科醫師完成「醫師說明 ERAS 療程」並儲存後，各職類會收到通知。</p>' +
    '<p class="privacy" id="noticeLimit"></p>' +
    '<ul class="notice-list" id="noticeList"></ul>' +
    '<div class="notice-act"><button type="button" class="btn" id="noticeAllRead">全部標示已讀</button>' +
    '<button type="button" class="btn-wide" id="noticeClose">關閉</button></div></div>';
  document.body.appendChild(ov);
  $('noticeLimit').textContent = CFG.apiBase ? '' : '試用版：通知只會出現在同一台裝置上登入的職類；不同手機之間不會互相通知。';

  var toast = document.createElement('div'); toast.className = 'notice-toast hidden'; toast.id = 'noticeToast';
  toast.addEventListener('click', function () { toast.classList.add('hidden'); open(); });
  document.body.appendChild(toast);

  function render() {
    var role = currentRole(), ul = $('noticeList'); ul.innerHTML = '';
    var list = N.list();
    if (!list.length) { var e = document.createElement('li'); e.className = 'notice-empty'; e.textContent = '目前沒有收案通知。'; ul.appendChild(e); }
    list.forEach(function (x) {
      var li = document.createElement('li'); li.className = 'notice-item' + (role && !x.readBy[role] ? ' unread' : '');
      var h = document.createElement('div'); h.className = 'notice-head';
      var k = document.createElement('b'); k.textContent = x.kind + (x.simulated ? '［模擬］' : '');
      var t = document.createElement('span'); t.className = 'notice-when'; t.textContent = showIso(x.at);
      h.appendChild(k); h.appendChild(t); li.appendChild(h);
      var dl = document.createElement('div'); dl.className = 'notice-body';
      [['病歷號', x.mrn], ['姓名', x.name], ['手術部位', x.site], ['手術醫師', x.surgeon]].forEach(function (p) {
        var s = document.createElement('span'); var a = document.createElement('i'); a.textContent = p[0];
        s.appendChild(a); s.appendChild(document.createTextNode(p[1] || '—')); dl.appendChild(s);
      });
      li.appendChild(dl);
      var f = document.createElement('div'); f.className = 'notice-foot';
      f.textContent = '發出：' + roleName(x.by) + '｜已讀：' + (Object.keys(x.readBy).map(roleName).join('、') || '—');
      li.appendChild(f);
      if (role && !x.readBy[role]) {
        var b = document.createElement('button'); b.type = 'button'; b.className = 'ask-mini'; b.textContent = '標示已讀';
        b.addEventListener('click', function () { N.markRead(x.id, role); refresh(); render(); });
        li.appendChild(b);
      }
      ul.appendChild(li);
    });
  }
  function open() { render(); ov.classList.remove('hidden'); }
  function close() { ov.classList.add('hidden'); }
  bell.addEventListener('click', open);
  $('noticeClose').addEventListener('click', close);
  ov.addEventListener('click', function (e) { if (e.target === ov) close(); });
  $('noticeAllRead').addEventListener('click', function () { var r = currentRole(); if (r) { N.markRead('*', r); refresh(); render(); } });

  var shown = {};
  function refresh() {
    var role = currentRole();
    bell.classList.toggle('hidden', !role);
    if (!role) { toast.classList.add('hidden'); return; }
    var un = N.unread(role), b = $('noticeBadge');
    b.textContent = un.length; b.classList.toggle('hidden', !un.length);
    var fresh = un.filter(function (x) { return !shown[role + x.id]; });
    if (fresh.length) {
      var x = fresh[0];
      toast.textContent = '🔔 ' + x.kind + '：' + x.mrn + ' ' + (x.name || '') + '｜' + (x.site || '') + '｜' + (x.surgeon || '') +
        (fresh.length > 1 ? '（另有 ' + (fresh.length - 1) + ' 則）' : '') + '　點此查看';
      toast.classList.remove('hidden');
      fresh.forEach(function (y) { shown[role + y.id] = 1; });
      setTimeout(function () { toast.classList.add('hidden'); }, 8000);
    }
    if (!ov.classList.contains('hidden')) render();
  }
  N.refresh = refresh;
  /* 同一台裝置的其他分頁有新通知時即時更新 */
  window.addEventListener('storage', function (e) { if (e.key === KEY) refresh(); });
  refresh();
})();
