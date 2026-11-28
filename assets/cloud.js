/*
 * 雲端同步（Google 試算表後台）
 *
 * 原本各模組把資料存在本機 localStorage；本程式定時把變更送到後台，並把其他裝置的資料拉回本機，
 * 因此其他模組不必改寫。設定方式：在 store.js 的 ERAS_CONFIG.cloudUrl 填入 Apps Script 網址。
 *
 *  病人端：只上傳／下載自己的觀看紀錄、提問、滿意度問卷（每 15 秒、離開頁面時）。
 *  團隊端：以職類密碼（後台驗證）同步所有資料（登入時、每 30 秒、資料變更時）。
 *
 * 同步單位為「一筆資料」（一位病人的觀看紀錄、一筆照護登錄、一則提問…），
 * 不同人同時修改不同筆資料不會互相覆蓋；同一筆資料以最後送到後台者為準。
 */
(function () {
  var CFG = window.ERAS_CONFIG || {};
  var URL = CFG.cloudUrl || '';
  var META_KEY = 'eras_cloud_meta_v1', WHO_KEY = 'eras_cloud_who';

  function idOf(f) { return function (x) { return x && x[f] != null ? String(x[f]) : null; }; }
  var COLLS = [
    { name: 'records', key: 'eras_tka_records_v1', obj: true, mrn: function (x) { return x.mrn; } },
    { name: 'care', key: 'eras_care_records_v1', id: idOf('id'), mrn: function (x) { return x.mrn; } },
    { name: 'questions', key: 'eras_questions_v1', id: idOf('id'), mrn: function (x) { return x.mrn; } },
    { name: 'survey', key: 'eras_survey_v2', id: idOf('patientKey'), mrn: function (x) { return x.mrn; } },
    { name: 'teachback', key: 'eras_teachback_v1', obj: true, team: true, mrn: function (x, id) { return id; } },
    { name: 'notices', key: 'eras_notices_v1', id: idOf('id'), team: true, mrn: function (x) { return x.mrn; } },
    /* 個管師確認的真正門診日期（團隊資料） */
    { name: 'clinicdates', key: 'eras_clinic_dates_v1', obj: true, team: true, mrn: function (x, id) { return id; } },
    /* 病人手術資料：手術日期時間、手術側、病房床號（團隊資料） */
    { name: 'profiles', key: 'eras_pt_profile_v1', obj: true, team: true, mrn: function (x, id) { return id; } }
  ];

  function ls() { try { return window.localStorage; } catch (e) { return null; } }
  function readRaw(k) { var s = ls(); try { return s ? JSON.parse(s.getItem(k)) : null; } catch (e) { return null; } }
  function writeRaw(k, v) { var s = ls(); try { if (s) s.setItem(k, JSON.stringify(v)); return true; } catch (e) { return false; } }
  function hash(str) { var h = 5381; for (var i = 0; i < str.length; i++) h = ((h << 5) + h + str.charCodeAt(i)) | 0; return (h >>> 0).toString(36) + ':' + str.length; }

  /* 讀成 { id: 物件 } */
  function readColl(c) {
    var v = readRaw(c.key), m = {};
    if (c.obj) { if (v && typeof v === 'object' && !Array.isArray(v)) Object.keys(v).forEach(function (k) { m[k] = v[k]; }); }
    else if (Array.isArray(v)) v.forEach(function (x) { var id = c.id(x); if (id) m[id] = x; });
    return m;
  }
  function writeColl(c, m, orig) {
    if (c.obj) return writeRaw(c.key, m);
    /* 陣列：保留原本順序，新資料接在後面 */
    var out = [], used = {};
    (Array.isArray(orig) ? orig : []).forEach(function (x) { var id = c.id(x); if (id && m[id] && !used[id]) { out.push(m[id]); used[id] = 1; } });
    Object.keys(m).forEach(function (id) { if (!used[id]) out.push(m[id]); });
    return writeRaw(c.key, out);
  }

  function who() {
    try { var w = JSON.parse(sessionStorage.getItem(WHO_KEY)); if (w) return w; } catch (e) {}
    return null;
  }
  function patientWho() {
    var st = window.ERAS_STORE, p = st && st.current && st.current();
    return p ? { patient: { key: p.key, mrn: p.mrn } } : null;
  }
  function currentWho() { return MODE === 'team' ? who() : patientWho(); }

  var MODE = document.body && document.body.classList.contains('admin-root') ? 'team' : 'patient';
  var busy = false, again = false, lastOk = null, lastErr = '', listeners = [];

  function filterForPatient(c, id, x, w) {
    if (c.team) return false;
    if (c.name === 'records') return id === w.patient.key;
    if (c.name === 'care') return x.role === 'patient' && String(x.mrn).toUpperCase() === w.patient.mrn;
    return String(c.mrn(x, id) || '').toUpperCase() === w.patient.mrn;
  }

  function buildRequest(w) {
    var meta = readRaw(META_KEY) || {};
    var reqColls = [], sent = {};
    COLLS.forEach(function (c) {
      if (MODE === 'patient' && c.team) return;
      var m = readColl(c), cm = meta[c.name] || { since: 0, h: {} }, changes = [];
      sent[c.name] = {};
      Object.keys(m).forEach(function (id) {
        if (MODE === 'patient' && !filterForPatient(c, id, m[id], w)) return;
        var js = JSON.stringify(m[id]), h = hash(js);
        if (cm.h[id] !== h) { changes.push({ id: id, json: js, mrn: c.mrn(m[id], id) || '' }); sent[c.name][id] = h; }
      });
      if (MODE === 'team') Object.keys(cm.h).forEach(function (id) {
        if (!m[id] && cm.h[id] !== 'del') { changes.push({ id: id, del: true }); sent[c.name][id] = 'del'; }
      });
      reqColls.push({ coll: c.name, since: cm.since || 0, changes: changes });
    });
    return { req: { action: 'sync', who: w, colls: reqColls }, sent: sent };
  }

  function applyResponse(res, sent) {
    var meta = readRaw(META_KEY) || {}, changed = false;
    COLLS.forEach(function (c) {
      var rows = (res.colls || {})[c.name];
      if (!rows) return;
      var cm = meta[c.name] || (meta[c.name] = { since: 0, h: {} });
      var orig = readRaw(c.key), m = readColl(c), s = sent[c.name] || {};
      /* 先記下這次成功送出的資料 */
      Object.keys(s).forEach(function (id) { cm.h[id] = s[id]; });
      var touched = false;
      rows.forEach(function (r) {
        var localNow = m[r.id] ? hash(JSON.stringify(m[r.id])) : null;
        /* 送出後本機又改過 → 保留本機，下次再送 */
        if (localNow && cm.h[r.id] && localNow !== cm.h[r.id] && !s[r.id]) return;
        if (r.del) { if (m[r.id]) { delete m[r.id]; touched = true; } cm.h[r.id] = 'del'; return; }
        if (!r.json) return;
        var h = hash(r.json);
        if (localNow === h) { cm.h[r.id] = h; return; }
        try { m[r.id] = JSON.parse(r.json); cm.h[r.id] = h; touched = true; } catch (e) {}
      });
      if (touched) { writeColl(c, m, orig); changed = true; }
      cm.since = res.now || cm.since;
    });
    writeRaw(META_KEY, meta);
    return changed;
  }

  function post(body) {
    return fetch(URL, { method: 'POST', headers: { 'Content-Type': 'text/plain;charset=utf-8' }, body: JSON.stringify(body), redirect: 'follow' })
      .then(function (r) { return r.json(); });
  }

  function sync() {
    if (!URL) return Promise.resolve(false);
    var w = currentWho();
    if (!w) return Promise.resolve(false);
    if (busy) { again = true; return Promise.resolve(false); }
    busy = true;
    var b = buildRequest(w);
    return post(b.req).then(function (res) {
      busy = false;
      if (!res || !res.ok) {
        lastErr = res && res.err === 'auth' ? '後台驗證失敗，請重新登入' : '同步失敗：' + ((res && res.err) || '');
        if (res && res.err === 'auth' && MODE === 'team') { try { sessionStorage.removeItem(WHO_KEY); } catch (e) {} }
        notify(false); return false;
      }
      var changed = applyResponse(res, b.sent);
      lastOk = new Date(); lastErr = '';
      notify(changed);
      if (again) { again = false; setTimeout(sync, 300); }
      return changed;
    }).catch(function (e) {
      busy = false; lastErr = '無法連線到後台（' + (e && e.message ? e.message : '網路') + '），資料先存在本機，連線後會自動補送';
      notify(false); return false;
    });
  }

  /* 離開頁面時用 sendBeacon 送出（不等回應；下次開啟時會再確認一次） */
  function beacon() {
    if (!URL || !navigator.sendBeacon) return;
    var w = currentWho(); if (!w) return;
    var b = buildRequest(w);
    var any = b.req.colls.some(function (c) { return c.changes.length; });
    if (any) navigator.sendBeacon(URL, new Blob([JSON.stringify(b.req)], { type: 'text/plain;charset=utf-8' }));
  }

  function notify(changed) {
    listeners.forEach(function (fn) { try { fn(changed); } catch (e) {} });
    try { document.dispatchEvent(new CustomEvent('eras-cloud', { detail: { changed: changed } })); } catch (e) {}
  }

  var timer = null;
  function startLoop() {
    if (!URL || timer) return;
    timer = setInterval(sync, MODE === 'team' ? 30000 : 15000);
    document.addEventListener('visibilitychange', function () {
      if (document.visibilityState === 'hidden') beacon(); else sync();
    });
    window.addEventListener('pagehide', beacon);
    window.addEventListener('online', sync);
  }

  window.ERAS_CLOUD = {
    enabled: !!URL,
    mode: MODE,
    /* 團隊登入：由後台比對密碼，程式碼中不存密碼 */
    auth: function (role, pin) {
      if (!URL) return Promise.reject(new Error('尚未設定後台網址（store.js 的 cloudUrl）'));
      return post({ action: 'auth', role: role, pin: pin }).then(function (res) {
        if (res && res.ok) { try { sessionStorage.setItem(WHO_KEY, JSON.stringify({ role: role, pin: pin })); } catch (e) {} }
        return res;
      });
    },
    /* 管理者帳號管理：op = list／lock／unlock／setpin */
    admin: function (op, target, pin) {
      var w = who();
      if (!URL || !w) return Promise.reject(new Error('尚未登入'));
      return post({ action: 'admin', who: w, op: op, target: target, pin: pin });
    },
    signOut: function () { try { sessionStorage.removeItem(WHO_KEY); } catch (e) {} },
    teamWho: who,
    /* 病人登入前先把這位病人在其他裝置的紀錄拉回來（換手機也能接續進度） */
    pullPatient: function (key, mrn) {
      if (!URL) return Promise.resolve(false);
      var req = { action: 'sync', who: { patient: { key: key, mrn: String(mrn).toUpperCase() } },
        colls: [{ coll: 'records', since: 0, changes: [] }, { coll: 'survey', since: 0, changes: [] }] };
      var t = new Promise(function (ok) { setTimeout(function () { ok(null); }, 8000); });
      return Promise.race([post(req), t]).then(function (res) {
        if (!res || !res.ok) return false;
        var rows = (res.colls.records || []).filter(function (r) { return r.id === key && r.json; });
        if (rows.length) {
          var all = readRaw('eras_tka_records_v1') || {};
          try { all[key] = JSON.parse(rows[0].json); writeRaw('eras_tka_records_v1', all); } catch (e) {}
        }
        (res.colls.survey || []).forEach(function (r) {
          if (!r.json) return;
          var list = readRaw('eras_survey_v2') || [];
          try { var s = JSON.parse(r.json); list = list.filter(function (x) { return x.patientKey !== s.patientKey; }); list.push(s); writeRaw('eras_survey_v2', list); } catch (e) {}
        });
        return true;
      }).catch(function () { return false; });
    },
    sync: sync,
    flush: beacon,
    start: startLoop,
    onChange: function (fn) { listeners.push(fn); },
    status: function () { return { enabled: !!URL, lastOk: lastOk, lastErr: lastErr }; }
  };

  if (URL) startLoop();
})();
