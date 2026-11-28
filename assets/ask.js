/* 病人端「我有疑問」：文字或語音提問，必填電話或 Email */
(function () {
  var Q = window.ERAS_QUESTIONS, Store = window.ERAS_STORE, CFG = window.ERAS_CONFIG, NODES = window.ERAS_NODES;
  var $ = function (id) { return document.getElementById(id); };
  var MAX_AUDIO = 2 * 1024 * 1024; // 語音檔上限 2 MB（約 1～2 分鐘）
  var MAX_REC_SEC = 90;
  var audio = null; // { data, mime, sec, from }
  var rec = { mr: null, chunks: [], timer: null, sec: 0, stream: null };

  function pad(n) { return String(n).padStart(2, '0'); }
  function showIso(iso) { var d = new Date(iso); return d.getFullYear() + '/' + pad(d.getMonth() + 1) + '/' + pad(d.getDate()) + ' ' + pad(d.getHours()) + ':' + pad(d.getMinutes()); }
  function mine() {
    var p = Store.current(); if (!p) return [];
    return Q.list().filter(function (q) { return q.patientKey === p.key; });
  }

  /* ───────── 開關 ───────── */
  function open() {
    if (!Store.current()) return;
    if (window.ERAS_APP && window.ERAS_APP.stopMedia) window.ERAS_APP.stopMedia();
    /* 記住這位病人上次填的聯絡資料（電話、Email、提問者、聯絡時段），不必每次重填 */
    var last = mine().slice(-1)[0] || {}, saved = {};
    try { saved = (JSON.parse(localStorage.getItem('eras_ask_contact')) || {})[Store.current().key] || {}; } catch (e) {}
    if (!$('askPhone').value) $('askPhone').value = saved.phone || last.phone || '';
    if (!$('askEmail').value) $('askEmail').value = saved.email || last.email || '';
    if (saved.who) $('askWho').value = saved.who;
    if (saved.time) $('askTime').value = saved.time;
    var id = window.ERAS_APP && window.ERAS_APP.currentNode();
    $('askAbout').textContent = id && NODES[id] ? '目前觀看：' + NODES[id].title : '';
    $('askErr').textContent = '';
    showForm(true);
    renderMine();
    $('askOverlay').classList.remove('hidden');
    setTimeout(function () { $('askText').focus(); }, 50);
  }
  function close() { stopRec(true); $('askOverlay').classList.add('hidden'); }
  function showForm(on) { $('askFormWrap').classList.toggle('hidden', !on); $('askDone').classList.toggle('hidden', on); }

  $('btnAsk').addEventListener('click', open);
  $('askClose').addEventListener('click', close);
  $('askDoneClose').addEventListener('click', close);
  $('askOverlay').addEventListener('click', function (e) { if (e.target === this) close(); });
  document.addEventListener('keydown', function (e) { if (e.key === 'Escape' && !$('askOverlay').classList.contains('hidden')) close(); });

  /* ───────── 錄音 ───────── */
  var canRecord = !!(navigator.mediaDevices && navigator.mediaDevices.getUserMedia && window.MediaRecorder);
  /* 網頁被嵌在不允許麥克風的框架中（例如展示版），或瀏覽器不支援錄音時，改用「手機錄音後上傳」 */
  var policy = document.permissionsPolicy || document.featurePolicy;
  var micBlocked = !canRecord || !window.isSecureContext ||
    !!(policy && policy.allowsFeature && !policy.allowsFeature('microphone'));
  function useFileMode(msg) {
    micBlocked = true;
    $('btnRec').classList.add('hidden');
    $('btnDictate').classList.add('hidden');
    $('askFileWrap').classList.add('ask-file-main');
    /* 無法直接錄音時，手機錄音是唯一方式 → 移出「其他方式」並隱藏折疊區 */
    var more = $('askMore'); if (more) { more.parentNode.insertBefore($('askFileWrap'), more); more.classList.add('hidden'); }
    $('askRecHint').textContent = msg || '請按下方按鈕，用手機錄一段話（或選擇已錄好的語音檔），個管師可以直接聽您的聲音。';
  }
  function setAudio(a) {
    audio = a;
    var box = $('askAudioBox'); box.innerHTML = '';
    if (!a) { box.classList.add('hidden'); return; }
    var el = document.createElement('audio'); el.controls = true; el.src = a.data; el.preload = 'metadata';
    var del = document.createElement('button'); del.type = 'button'; del.className = 'ask-mini'; del.textContent = '刪除錄音';
    del.addEventListener('click', function () { setAudio(null); $('askFile').value = ''; });
    var t = document.createElement('span'); t.className = 'ask-note'; t.textContent = a.sec ? '錄音 ' + a.sec + ' 秒' : '已附加語音檔';
    box.appendChild(el); box.appendChild(t); box.appendChild(del); box.classList.remove('hidden');
  }
  function readBlob(blob, sec, from) {
    if (blob.size > MAX_AUDIO) { $('askErr').textContent = '語音檔太大（上限 2 MB），請錄短一點，或改用文字。'; return; }
    var fr = new FileReader();
    fr.onload = function () { setAudio({ data: fr.result, mime: blob.type || 'audio/*', sec: sec || 0, from: from }); };
    fr.readAsDataURL(blob);
  }
  function showFileFallback(msg) { useFileMode(msg); }
  function stopRec(discard) {
    if (!rec.mr) return;
    rec.discard = !!discard;
    try { rec.mr.stop(); } catch (e) {}
  }
  function recUi(on) {
    $('btnRec').textContent = on ? '■ 停止錄音' : '🎤 按此錄音';
    $('btnRec').classList.toggle('on', on);
  }
  $('btnRec').addEventListener('click', function () {
    $('askErr').textContent = '';
    if (rec.mr) { stopRec(false); return; }
    if (!canRecord) { useFileMode(); return; }
    navigator.mediaDevices.getUserMedia({ audio: true }).then(function (stream) {
      rec.stream = stream; rec.chunks = []; rec.sec = 0; rec.discard = false;
      var mr; try { mr = new MediaRecorder(stream); } catch (e) { stream.getTracks().forEach(function (t) { t.stop(); }); useFileMode(); return; }
      rec.mr = mr;
      mr.ondataavailable = function (e) { if (e.data && e.data.size) rec.chunks.push(e.data); };
      mr.onstop = function () {
        clearInterval(rec.timer); rec.stream.getTracks().forEach(function (t) { t.stop(); });
        var blob = new Blob(rec.chunks, { type: mr.mimeType || 'audio/webm' });
        rec.mr = null; recUi(false); $('askRecTime').textContent = '';
        if (!rec.discard && blob.size) readBlob(blob, rec.sec, 'record');
      };
      mr.start();
      recUi(true);
      rec.timer = setInterval(function () {
        rec.sec++; $('askRecTime').textContent = rec.sec + ' / ' + MAX_REC_SEC + ' 秒';
        if (rec.sec >= MAX_REC_SEC) stopRec(false);
      }, 1000);
    }, function () {
      useFileMode('無法使用麥克風（可能未允許）。請按下方按鈕用手機錄音，或直接打字。');
    });
  });
  $('askFile').addEventListener('change', function () {
    var f = this.files && this.files[0]; if (!f) return;
    if (!/^audio\//.test(f.type) && !/\.(m4a|mp3|wav|aac|amr|ogg|webm|3gp)$/i.test(f.name)) { $('askErr').textContent = '請選擇語音檔。'; this.value = ''; return; }
    readBlob(f, 0, 'file');
  });

  /* 語音轉文字（瀏覽器支援時才顯示） */
  var SR = window.SpeechRecognition || window.webkitSpeechRecognition;
  if (micBlocked) useFileMode();
  if (SR && !micBlocked) {
    $('btnDictate').classList.remove('hidden');
    var sr = null;
    $('btnDictate').addEventListener('click', function () {
      if (sr) { sr.stop(); return; }
      sr = new SR(); sr.lang = 'zh-TW'; sr.interimResults = false; sr.continuous = true;
      var btn = this; btn.textContent = '■ 停止語音輸入'; btn.classList.add('on');
      sr.onresult = function (e) {
        var t = '';
        for (var i = e.resultIndex; i < e.results.length; i++) if (e.results[i].isFinal) t += e.results[i][0].transcript;
        if (t) $('askText').value = ($('askText').value ? $('askText').value + ' ' : '') + t;
      };
      sr.onerror = function (e) { if (e.error === 'not-allowed' || e.error === 'service-not-allowed') useFileMode('無法使用麥克風，請按下方按鈕用手機錄音，或直接打字。'); };
      sr.onend = function () { sr = null; btn.textContent = '🗣 語音轉文字'; btn.classList.remove('on'); };
      try { sr.start(); } catch (e) { sr = null; btn.textContent = '🗣 語音轉文字'; btn.classList.remove('on'); }
    });
  }

  /* ───────── 送出 ───────── */
  function normPhone(v) { return v.replace(/[\s\-()（）]/g, ''); }
  function validPhone(v) { return /^(\+?886|0)\d{8,9}(#\d{1,6})?$/.test(v); }
  function validEmail(v) { return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(v); }

  $('askForm').addEventListener('submit', function (e) {
    e.preventDefault();
    var err = $('askErr'); err.textContent = '';
    var text = $('askText').value.trim();
    var phone = normPhone($('askPhone').value.trim()), email = $('askEmail').value.trim();
    if (rec.mr) { err.textContent = '請先按「停止錄音」。'; return; }
    if (!text && !audio) { err.textContent = '請輸入您的問題，或錄一段語音。'; return; }
    if (!phone && !email) { err.textContent = '請至少留下電話或 Email 其中一項，方便個管師與您聯絡。'; return; }
    if (phone && !validPhone(phone)) { err.textContent = '電話格式不正確，例如 0912345678 或 07-1234567。'; return; }
    if (email && !validEmail(email)) { err.textContent = 'Email 格式不正確。'; return; }
    if (!$('askAgree').checked) { err.textContent = '請勾選同意個管師以您留下的方式聯絡。'; return; }
    var p = Store.current(); if (!p) return;
    var id = window.ERAS_APP && window.ERAS_APP.currentNode();
    var q = Q.add({
      patientKey: p.key, name: p.name, mrn: p.mrn, clinicDate: p.clinicDate,
      who: $('askWho').value, phone: phone, email: email, contactTime: $('askTime').value,
      node: id || '', nodeTitle: id && NODES[id] ? NODES[id].title : '',
      text: text, audio: audio ? audio.data : '', audioSec: audio ? audio.sec : 0, audioFrom: audio ? audio.from : '',
      simulated: !!(CFG.demo || p.simulated)
    });
    if (!q) { err.textContent = '儲存失敗（可能是語音檔太大），請刪除錄音或錄短一點再送出。'; return; }
    try { var c = JSON.parse(localStorage.getItem('eras_ask_contact')) || {}; c[p.key] = { phone: phone, email: email, who: $('askWho').value, time: $('askTime').value }; localStorage.setItem('eras_ask_contact', JSON.stringify(c)); } catch (e) {}
    if (window.ERAS_CLOUD) window.ERAS_CLOUD.sync();   // 送出後立即傳給個管師
    $('askText').value = ''; setAudio(null); $('askFile').value = '';
    showForm(false);
    renderMine();
  });
  $('askAgain').addEventListener('click', function () { showForm(true); $('askText').focus(); });

  function renderMine() {
    var list = mine().slice().reverse(), ul = $('askMine'); ul.innerHTML = '';
    $('askMineWrap').classList.toggle('hidden', !list.length);
    list.forEach(function (q) {
      var li = document.createElement('li');
      var a = document.createElement('span'); a.className = 'ask-when'; a.textContent = showIso(q.createdAt);
      var b = document.createElement('span'); b.className = 'ask-q'; b.textContent = q.text || '（語音提問）';
      var c = document.createElement('span'); c.className = 'ask-st st-' + Q.STATUS.indexOf(q.status); c.textContent = q.status;
      li.appendChild(a); li.appendChild(c); li.appendChild(b);
      /* 個管師的回覆（不顯示「狀態改為…」系統紀錄） */
      (q.replies || []).filter(function (r) { return r.note && !/^狀態改為/.test(r.note); }).forEach(function (r) {
        var d = document.createElement('div'); d.className = 'ask-reply';
        d.textContent = '💬 ' + (r.role || '個管師') + ' 回覆（' + showIso(r.at) + '）：' + r.note;
        li.appendChild(d);
      });
      ul.appendChild(li);
    });
    try { var seen = JSON.parse(localStorage.getItem('eras_ask_seen')) || {}; var p = Store.current(); if (p) { seen[p.key] = replyCount(); localStorage.setItem('eras_ask_seen', JSON.stringify(seen)); } } catch (e) {}
    updateBadge();
  }
  function replyCount() {
    return mine().reduce(function (s, q) { return s + (q.replies || []).filter(function (r) { return r.note && !/^狀態改為/.test(r.note); }).length; }, 0);
  }
  /* 有新回覆時，「我有疑問」按鈕顯示提醒 */
  function updateBadge() {
    var p = Store.current(), fab = $('btnAsk'); if (!fab) return;
    var seen = 0; try { seen = (JSON.parse(localStorage.getItem('eras_ask_seen')) || {})[p && p.key] || 0; } catch (e) {}
    var n = p ? replyCount() - seen : 0;
    var b = $('askBadge');
    if (!b) { b = document.createElement('span'); b.id = 'askBadge'; b.className = 'ask-badge hidden'; fab.appendChild(b); }
    b.textContent = n > 0 ? '有新回覆' : ''; b.classList.toggle('hidden', !(n > 0));
  }
  document.addEventListener('eras-cloud', function () { updateBadge(); if (!$('askMineWrap').closest('.hidden')) renderMine(); });
  setTimeout(updateBadge, 500);
})();
