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
  /* 收案版後台：Google Apps Script 部署後的「網頁應用程式網址」（…/exec）。
     填入後病人端觀看紀錄會自動傳回後台，團隊端密碼改由後台「帳號密碼」工作表驗證。
     設定步驟見「後台_GoogleAppsScript/後台設定步驟.md」。 */
  cloudUrl: 'https://script.google.com/macros/s/AKfycbzz8l7kjHdWbLpiohRCA2XXGOiC9R85kNs6MsXDuj0Phg2cSv1c_Uf_uc2DTd07n9m3bQ/exec',
  apiBase: '',          // 舊版院內伺服器介面（未使用）
  idleSeconds: 180,
  earliestSurgery: '08:00', // 手術時間未確定時，禁食試算器採用的「最早可能手術時間」（請依院內第一台刀時間調整）     // 超過這段時間沒有操作且影片未播放，就不再累計觀看時間
  apais: false          // 11/19 計畫書改以紙本 VAS-A 於 T0／T1 由施測人員測量，App 不再施測 APAIS；設 true 可恢復
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

  /* 2026-11-28：以「病歷號」辨識同一位病人（原為病歷號＋門診日期，隔天以不同日期登入會被拆成兩筆、進度歸零）。
     門診日期仍記錄：clinicDate＝第一次登入填的日期，clinicDates＝曾填過的所有日期。 */
  function patientKey(mrn) {
    return String(mrn).trim().toUpperCase();
  }

  function nowIso() { return new Date().toISOString(); }

  var Store = {
    /* 登入：同一病歷號視為同一位病人，紀錄會累加 */
    login: function (name, mrn, clinicDate) {
      var all = loadAll();
      var key = patientKey(mrn);
      var p = all[key];
      if (!p) {
        p = { key: key, name: name.trim(), mrn: String(mrn).trim().toUpperCase(), clinicDate: clinicDate, clinicDates: [clinicDate],
              firstSeen: nowIso(), lastSeen: nowIso(), logins: 0, simulated: false, nodes: {}, path: [] };
      }
      p.clinicDates = p.clinicDates || [p.clinicDate];
      if (clinicDate && p.clinicDates.indexOf(clinicDate) < 0) p.clinicDates.push(clinicDate);
      /* 姓名以第一次登入為準（家屬代為登入時不覆蓋病人姓名）；每次操作者另記 */
      if (!p.name) p.name = name.trim();
      p.lastUser = name.trim();
      p.users = p.users || [];
      if (name.trim() && p.users.indexOf(name.trim()) < 0) p.users.push(name.trim());
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
    /* 完成判定：看完影片（或無影片）＋理解自我檢核全部打勾（病人自評） */
    setProgress: function (nodeId, fn) {
      this._mutate(function (p) {
        var n = p.nodes[nodeId] || (p.nodes[nodeId] = { views: 0, seconds: 0, videoSeconds: 0, first: nowIso(), last: null });
        fn(n);
        var need = (window.ERAS_NODES[nodeId] || {}).checklist || [];
        var checksOk = need.every(function (_, i) { return n.checks && n.checks[i]; });
        var done = !!n.videoDone && checksOk;
        if (done && !n.done) n.doneAt = nowIso();
        if (!done) n.doneAt = null;
        n.done = done;
      });
    },
    /* 影片續看位置（不更新最後觀看時間） */
    setResume: function (m) {
      var key = safeGet(SESSION_KEY); if (!key) return;
      var all = loadAll(); if (!all[key]) return;
      all[key].resume = m; saveAll(all);
    },
    isDone: function (p, nodeId) { return !!(p && p.nodes[nodeId] && p.nodes[nodeId].done); },
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
    /* 門診日期（個管師確認）：病人不再輸入門診日期，App 自動記第一次登入日；
       真正的門診日由個管師在團隊端確認，另存一份（團隊資料，病人端同步不會覆蓋）。 */
    clinicInfo: function (mrn, fallback) {
      var m = {}; try { m = JSON.parse(safeGet('eras_clinic_dates_v1')) || {}; } catch (e) {}
      var r = m[String(mrn || '').toUpperCase()];
      return r && r.date ? { date: r.date, confirmed: true, by: r.by, at: r.at } : { date: fallback || '', confirmed: false };
    },
    /* 病人姓名：團隊更正過（病人手術資料）優先，否則用第一次登入的姓名 */
    nameOf: function (mrn, fallback) {
      var m = {}; try { m = JSON.parse(safeGet('eras_pt_profile_v1')) || {}; } catch (e) {}
      var r = m[String(mrn || '').toUpperCase()];
      return (r && r.name) || fallback || '';
    },
    clinicDateOf: function (mrn, fallback) { return this.clinicInfo(mrn, fallback).date; },
    setClinicDate: function (mrn, date, by) {
      var m = {}; try { m = JSON.parse(safeGet('eras_clinic_dates_v1')) || {}; } catch (e) {}
      var k = String(mrn || '').toUpperCase(); if (!k) return;
      if (date) m[k] = { date: date, by: by || '', at: nowIso() }; else delete m[k];
      safeSet('eras_clinic_dates_v1', JSON.stringify(m));
      if (window.ERAS_CLOUD && window.ERAS_CLOUD.sync) window.ERAS_CLOUD.sync();
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
      if (window.ERAS_CLOUD) window.ERAS_CLOUD.flush();
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
