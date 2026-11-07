/*
 * 觀看紀錄儲存層
 *
 * 目前模式：local（測試用）
 *   紀錄存在「這台裝置的瀏覽器」裡，後台只看得到同一台裝置的紀錄。
 *   正式上線前，請由資訊室提供院內核准的伺服器 API，把 apiBase 填入下方設定，
 *   並取得 IRB 與資訊室同意後才可收集真實病人資料。
 *
 * API 介面（給資訊室參考，尚未實作伺服器端）：
 *   POST {apiBase}/visits        body: 一筆病人紀錄（格式同 local 的 patient 物件）
 *   GET  {apiBase}/visits        回傳: patient 物件陣列（後台用，需另行驗證管理者身分）
 */
window.ERAS_CONFIG = {
  apiBase: '',          // 例：'https://院內伺服器/eras-api'；空白＝只存本機
  adminPin: '0000',     // 測試用後台密碼，正式上線前務必改由伺服器驗證
  idleSeconds: 180      // 超過這段時間沒有操作且影片未播放，就不再累計觀看時間
};

(function () {
  var KEY = 'eras_tka_records_v1';
  var SESSION_KEY = 'eras_tka_current_v1';

  function safeGet(k) { try { return localStorage.getItem(k); } catch (e) { return null; } }
  function safeSet(k, v) { try { localStorage.setItem(k, v); return true; } catch (e) { return false; } }
  function safeDel(k) { try { localStorage.removeItem(k); } catch (e) {} }

  function loadAll() {
    try { return JSON.parse(safeGet(KEY)) || {}; } catch (e) { return {}; }
  }
  function saveAll(all) { safeSet(KEY, JSON.stringify(all)); }

  function patientKey(mrn, clinicDate) {
    return String(mrn).trim().toUpperCase() + '|' + clinicDate;
  }

  function nowIso() { return new Date().toISOString(); }

  var Store = {
    /* 登入：同一病歷號＋門診日期視為同一位病人，紀錄會累加 */
    login: function (name, mrn, clinicDate) {
      var all = loadAll();
      var key = patientKey(mrn, clinicDate);
      var p = all[key];
      if (!p) {
        p = { key: key, name: name.trim(), mrn: String(mrn).trim().toUpperCase(), clinicDate: clinicDate,
              firstSeen: nowIso(), lastSeen: nowIso(), logins: 0, simulated: false, nodes: {}, path: [] };
      }
      p.name = name.trim();
      if (window.ERAS_CONFIG.demo) p.simulated = true;
      p.logins += 1;
      p.lastSeen = nowIso();
      all[key] = p;
      saveAll(all);
      safeSet(SESSION_KEY, key);
      return p;
    },
    logout: function () { safeDel(SESSION_KEY); },
    current: function () {
      var key = safeGet(SESSION_KEY);
      if (!key) return null;
      return loadAll()[key] || null;
    },
    /* 進入一個項目：觀看次數 +1 */
    enterNode: function (nodeId) {
      this._mutate(function (p) {
        var n = p.nodes[nodeId] || (p.nodes[nodeId] = { views: 0, seconds: 0, videoSeconds: 0, first: nowIso(), last: null });
        n.views += 1;
        n.last = nowIso();
        p.path.push({ node: nodeId, at: nowIso() });
        if (p.path.length > 500) p.path = p.path.slice(-500);
      });
    },
    /* 累加觀看秒數 */
    addTime: function (nodeId, seconds, videoSeconds) {
      if (seconds <= 0 && videoSeconds <= 0) return;
      this._mutate(function (p) {
        var n = p.nodes[nodeId] || (p.nodes[nodeId] = { views: 0, seconds: 0, videoSeconds: 0, first: nowIso(), last: null });
        n.seconds = Math.round((n.seconds + seconds) * 10) / 10;
        n.videoSeconds = Math.round((n.videoSeconds + (videoSeconds || 0)) * 10) / 10;
        n.last = nowIso();
      });
    },
    _mutate: function (fn) {
      var key = safeGet(SESSION_KEY);
      if (!key) return;
      var all = loadAll();
      var p = all[key];
      if (!p) return;
      fn(p);
      p.lastSeen = nowIso();
      all[key] = p;
      saveAll(all);
      Store._queueSync(p);
    },
    /* 後台 */
    listPatients: function () {
      var all = loadAll();
      return Object.keys(all).map(function (k) { return all[k]; });
    },
    deletePatient: function (key) { var all = loadAll(); delete all[key]; saveAll(all); },
    clearAll: function () { saveAll({}); },
    importSimulated: function (records) {
      var all = loadAll();
      records.forEach(function (r) { r.simulated = true; all[r.key] = r; });
      saveAll(all);
    },
    totalSeconds: function (p) {
      return Object.keys(p.nodes || {}).reduce(function (s, k) { return s + (p.nodes[k].seconds || 0); }, 0);
    },

    /* 伺服器同步（apiBase 有設定才會執行） */
    _pending: null,
    _timer: null,
    _queueSync: function (p) {
      if (!window.ERAS_CONFIG.apiBase) return;
      Store._pending = p;
      if (Store._timer) return;
      Store._timer = setTimeout(Store.flush, 15000);
    },
    flush: function () {
      clearTimeout(Store._timer); Store._timer = null;
      var p = Store._pending; Store._pending = null;
      if (!p || !window.ERAS_CONFIG.apiBase) return;
      var url = window.ERAS_CONFIG.apiBase.replace(/\/$/, '') + '/visits';
      var body = JSON.stringify(p);
      if (navigator.sendBeacon && document.visibilityState === 'hidden') {
        navigator.sendBeacon(url, new Blob([body], { type: 'application/json' }));
      } else {
        fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: body, keepalive: true })
          .catch(function () { Store._pending = Store._pending || p; });
      }
    }
  };

  window.ERAS_STORE = Store;
})();
