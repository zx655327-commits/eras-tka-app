/*
 * APAIS 術前焦慮與資訊需求量表（Amsterdam Preoperative Anxiety and Information Scale）
 *
 * 原始量表：Moerman, N., van Dam, F. S. A. M., Muller, M. J., & Oosting, H. (1996).
 *   The Amsterdam Preoperative Anxiety and Information Scale (APAIS). Anesthesia & Analgesia, 82(3), 445–451.
 * 中文題目：Wu, H., Zhao, X., Chu, S., et al. (2020). Validation of the Chinese version of the Amsterdam
 *   Preoperative Anxiety and Information Scale (APAIS). Health and Quality of Life Outcomes, 18, 66.
 *   https://doi.org/10.1186/s12955-020-01294-3（CC BY 4.0；作者表示中文版經原作者 Moerman 同意）
 *   ※ 原文為簡體字，此處只做簡轉繁字形轉換，未改寫用詞。臺灣繁體版的使用授權與用詞待確認。
 *   ※ 選項兩端文字「完全沒有」「非常強烈」為網頁暫譯（原文 not at all／extremely），待確認。
 *
 * 計分：每題 1–5 分。焦慮分量表＝第 1、2、4、5 題加總（4–20）；資訊需求分量表＝第 3、6 題加總（2–10）。
 *   焦慮 ≥ 11 分視為術前焦慮（Moerman 1996 建議；Wu 2020 沿用）。
 * 測量時間點（使用者 2026-11-08 指定，須與研究計畫核對）：門診後、手術前（2026-11-08 使用者改為兩個時間點，取消出院前）。
 * 前測（T1）須在研究衛教介入前完成，避免基線測量污染（2026-11-15 使用者指定）：
 *   病人登入後若尚未完成 T1，先強制填寫，填完才開始播放衛教影片。
 */
(function () {
  var KEY = 'eras_apais_v1';
  var CFG = window.ERAS_CONFIG || {};
  var ITEMS = [
    { id: 'a1', no: 1, text: '我對麻醉感到擔心', en: 'I am worried about the anesthetic.' },
    { id: 'a2', no: 2, text: '我一直在想麻醉這件事', en: 'The anesthetic is on my mind continually.' },
    { id: 'a3', no: 3, text: '我希望盡可能多地了解有關麻醉的事', en: 'I would like to know as much as possible about the anesthetic.' },
    { id: 'a4', no: 4, text: '我對手術感到擔心', en: 'I am worried about the procedure.' },
    { id: 'a5', no: 5, text: '我一直在想手術這件事', en: 'The procedure is on my mind continually.' },
    { id: 'a6', no: 6, text: '我希望盡可能多地了解有關手術的事', en: 'I would like to know as much as possible about the procedure.' }
  ];
  var ANX = ['a1', 'a2', 'a4', 'a5'], INFO = ['a3', 'a6'], CUT = 11;
  var POINTS = [
    { id: 'T1', name: '門診後（衛教前）', hint: '登入後、觀看衛教影片前填寫' },
    { id: 'T2', name: '手術前', hint: '住院後、進手術室前填寫' }
  ];
  function load() { try { return JSON.parse(localStorage.getItem(KEY)) || []; } catch (e) { return []; } }
  function save(list) { try { localStorage.setItem(KEY, JSON.stringify(list)); return true; } catch (e) { return false; } }
  function sum(rec, ids) { var t = 0; for (var i = 0; i < ids.length; i++) { var v = rec.answers[ids[i]]; if (!v) return null; t += v; } return t; }

  var A = {
    ITEMS: ITEMS, POINTS: POINTS, ANX: ANX, INFO: INFO, CUT: CUT,
    list: function () { return load(); },
    get: function (patientKey, tp) { return load().filter(function (r) { return r.patientKey === patientKey && r.tp === tp; })[0] || null; },
    /* 每位病人每個時間點只收一次，送出後不可修改（避免前後測被改動） */
    submit: function (p, tp, answers) {
      var list = load();
      if (list.some(function (r) { return r.patientKey === p.key && r.tp === tp; })) return false;
      var viewed = Object.keys(p.nodes || {}).some(function (k) { return p.nodes[k] && p.nodes[k].views > 0; });
      var rec = { patientKey: p.key, name: p.name, mrn: p.mrn, clinicDate: p.clinicDate, tp: tp, answers: answers,
        submittedAt: new Date().toISOString(), simulated: !!(CFG.demo || p.simulated) };
      rec.anxietyTotal = sum(rec, ANX); rec.infoScore = sum(rec, INFO);
      if (tp === 'T1') rec.preIntervention = !viewed; // 填寫前是否尚未觀看任何衛教
      list.push(rec);
      return save(list);
    },
    anxiety: function (r) { return sum(r, ANX); },
    info: function (r) { return sum(r, INFO); },
    removeSimulated: function () { save(load().filter(function (r) { return !r.simulated; })); },
    _save: save
  };
  window.ERAS_APAIS = A;

  /* ───────── 病人端（只有病人頁有 #apaisCard 時執行） ───────── */
  if (!document.getElementById('apaisCard')) return;
  var Store = window.ERAS_STORE;
  var $ = function (id) { return document.getElementById(id); };
  function mk(tag, cls, text) { var e = document.createElement(tag); if (cls) e.className = cls; if (text !== undefined) e.textContent = text; return e; }
  var cur = null;

  function renderCard() {
    var p = Store.current(), box = $('apaisPoints'); box.innerHTML = '';
    if (!p) return;
    POINTS.forEach(function (t) {
      var rec = A.get(p.key, t.id);
      var row = mk('div', 'ap-row' + (rec ? ' ap-done' : ''));
      var lab = mk('div', 'ap-lab'); lab.appendChild(mk('b', '', t.name)); lab.appendChild(mk('span', '', rec ? '已完成' : t.hint));
      row.appendChild(lab);
      if (!rec) {
        var b = mk('button', 'ask-mini', '填寫'); b.type = 'button';
        b.addEventListener('click', function () { open(t); });
        row.appendChild(b);
      } else row.appendChild(mk('span', 'ap-ok', '✓'));
      box.appendChild(row);
    });
  }

  function open(t) {
    cur = t;
    if (window.ERAS_APP && window.ERAS_APP.stopMedia) window.ERAS_APP.stopMedia();
    $('apTitle').textContent = '術前心情量表｜' + t.name;
    var f = $('apForm'); f.innerHTML = '';
    ITEMS.forEach(function (it) {
      var fs = mk('fieldset', 'sv-q'); fs.id = 'apq_' + it.id;
      fs.appendChild(mk('legend', '', it.no + '. ' + it.text));
      var row = mk('div', 'sv-scale');
      [1, 2, 3, 4, 5].forEach(function (v) {
        var l = mk('label'); var r = mk('input'); r.type = 'radio'; r.name = 'ap_' + it.id; r.value = v;
        l.appendChild(r); l.appendChild(mk('b', '', String(v)));
        l.appendChild(mk('span', '', v === 1 ? '完全沒有' : (v === 5 ? '非常強烈' : '')));
        row.appendChild(l);
      });
      fs.appendChild(row); f.appendChild(fs);
    });
    $('apErr').textContent = '';
    $('apIntro').textContent = '請依照您現在的感受，選出最符合的數字。\n1＝完全沒有，5＝非常強烈。答案沒有對錯，送出後無法修改。';
    $('apThanksClose').textContent = '回到衛教影片';
    $('apFormWrap').classList.remove('hidden'); $('apThanks').classList.add('hidden');
    $('apOverlay').classList.remove('hidden');
    $('apOverlay').querySelector('.ask-box').scrollTop = 0;
  }
  var gateDone = null; // 前測強制模式：填完才開始衛教
  function close() {
    if (gateDone && !A.get((Store.current() || {}).key, 'T1')) return; // 前測未完成不能關閉
    $('apOverlay').classList.add('hidden'); $('apClose').classList.remove('hidden');
    renderCard();
    if (gateDone) { var f = gateDone; gateDone = null; f(); }
  }
  /* 登入後若尚未完成前測，先填 APAIS，填完再執行 onDone（開始衛教） */
  A.needBaseline = function () { var p = Store.current(); return !!p && !A.get(p.key, 'T1'); };
  A.gate = function (onDone) {
    gateDone = onDone;
    open(POINTS[0]);
    $('apClose').classList.add('hidden');
    $('apIntro').textContent = '開始觀看衛教影片之前，請先填寫這 6 題。\n請依照您現在的感受，選出最符合的數字。1＝完全沒有，5＝非常強烈。答案沒有對錯，送出後無法修改。';
    $('apThanksClose').textContent = '開始觀看衛教影片';
  };

  $('apForm').addEventListener('change', function (e) { var fs = e.target.closest('.sv-q'); if (fs) fs.classList.remove('sv-miss'); $('apErr').textContent = ''; });
  $('apClose').addEventListener('click', close);
  $('apThanksClose').addEventListener('click', close);
  $('apOverlay').addEventListener('click', function (e) { if (e.target === this) close(); });
  $('apSubmit').addEventListener('click', function () {
    var p = Store.current(); if (!p || !cur) return;
    var answers = {}, miss = [];
    ITEMS.forEach(function (it) {
      var c = document.querySelector('input[name=ap_' + it.id + ']:checked');
      $('apq_' + it.id).classList.toggle('sv-miss', !c);
      if (c) answers[it.id] = Number(c.value); else miss.push(it.no);
    });
    if (miss.length) { $('apErr').textContent = '還有第 ' + miss.join('、') + ' 題沒有選。'; return; }
    if (!A.submit(p, cur.id, answers)) { $('apErr').textContent = '這個時間點已經填過，或儲存失敗。'; return; }
    $('apFormWrap').classList.add('hidden'); $('apThanks').classList.remove('hidden');
  });
  A.renderCard = renderCard;
  renderCard();
})();
