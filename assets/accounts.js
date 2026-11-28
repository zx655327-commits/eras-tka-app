/* 帳號管理（僅管理者）：查看各職類狀態、鎖定、解鎖、重設密碼。密碼存在後台試算表，畫面不顯示現有密碼。 */
(function () {
  var $ = function (id) { return document.getElementById(id); };
  var Cloud = window.ERAS_CLOUD;
  function authed() { return window.ERAS_TEAM && window.ERAS_TEAM.isSuper(); }
  function msg(t, bad) { var m = $('accMsg'); m.textContent = t; m.style.color = bad ? '#c00000' : ''; }

  function btn(text, fn, cls) { var b = document.createElement('button'); b.type = 'button'; b.className = 'btn' + (cls ? ' ' + cls : ''); b.textContent = text; b.addEventListener('click', fn); return b; }

  function act(op, id, name, pin) {
    msg('處理中…');
    Cloud.admin(op, id, pin).then(function (res) {
      if (!res || !res.ok) { msg((res && (res.msg || res.err)) || '操作失敗', true); return; }
      msg(name + '：' + { lock: '已鎖定', unlock: '已解鎖（錯誤次數歸零）', setpin: '密碼已重設並解鎖' }[op]);
      render();
    }).catch(function () { msg('無法連線到後台', true); });
  }

  function render() {
    if (!authed() || !Cloud || !Cloud.enabled) return;
    var tb = $('tblAcc').querySelector('tbody');
    Cloud.admin('list').then(function (res) {
      if (!res || !res.ok) { msg((res && (res.msg || res.err)) || '讀取失敗', true); return; }
      tb.innerHTML = '';
      res.roles.forEach(function (r) {
        var tr = document.createElement('tr');
        function td(t, cls) { var c = document.createElement('td'); c.textContent = t; if (cls) c.className = cls; tr.appendChild(c); return c; }
        td(r.name);
        td(r.admin ? '管理者' : '一般');
        td(r.locked ? '已鎖定' : '正常', r.locked ? 'lock-on' : '');
        td(String(r.fails || 0));
        td(r.changed || '');
        var ops = td('');
        if (r.locked) ops.appendChild(btn('解鎖', function () { act('unlock', r.id, r.name); }));
        else ops.appendChild(btn('鎖定', function () { act('lock', r.id, r.name); }));
        var inp = document.createElement('input'); inp.type = 'password'; inp.inputMode = 'numeric'; inp.placeholder = '新密碼 6～12 位數字'; inp.style.width = '150px'; inp.style.marginLeft = '8px';
        ops.appendChild(inp);
        ops.appendChild(btn('重設密碼', function () {
          if (!/^\d{6,12}$/.test(inp.value)) { msg('新密碼需為 6～12 位數字', true); return; }
          act('setpin', r.id, r.name, inp.value); inp.value = '';
        }));
        tb.appendChild(tr);
      });
    }).catch(function () { msg('無法連線到後台', true); });
  }

  $('btnAccReload').addEventListener('click', render);

  /* 操作紀錄 */
  function pad(n) { return String(n).padStart(2, '0'); }
  function showIso(s) { var d = new Date(s); if (isNaN(d)) return s; return d.getFullYear() + '/' + pad(d.getMonth() + 1) + '/' + pad(d.getDate()) + ' ' + pad(d.getHours()) + ':' + pad(d.getMinutes()) + ':' + pad(d.getSeconds()); }
  var logBtn = $('btnLogLoad');
  if (logBtn) logBtn.addEventListener('click', function () {
    if (!authed() || !Cloud) return;
    var m = $('logMsg'); m.textContent = '讀取中…';
    Cloud.admin('log').then(function (res) {
      if (!res || !res.ok || !res.log) {
        var e = res && (res.msg || res.err);
        m.textContent = (!e || e === 'unknown op') ? '後台程式尚未更新：請把新版 Code.gs 貼到 Apps Script，並「管理部署作業 → 編輯 → 新版本」重新部署。' : e;
        return;
      }
      var tb = $('tblLog').querySelector('tbody'); tb.innerHTML = '';
      res.log.forEach(function (r) {
        var tr = document.createElement('tr');
        [showIso(r.at), r.role, r.action, r.detail].forEach(function (t) { var c = document.createElement('td'); c.textContent = t; tr.appendChild(c); });
        tb.appendChild(tr);
      });
      m.textContent = '共 ' + res.log.length + ' 筆';
    }).catch(function () { m.textContent = '無法連線到後台'; });
  });
  window.ERAS_ACCOUNTS = { refresh: render };
})();
