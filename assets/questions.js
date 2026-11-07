/*
 * 病人提問：儲存層（病人端與 ERAS 團隊端共用）
 * 測試版存在這台裝置的瀏覽器；正式上線需改存院內伺服器，個管師才能收到所有病人的提問。
 */
(function () {
  var KEY = 'eras_questions_v1';
  function load() { try { return JSON.parse(localStorage.getItem(KEY)) || []; } catch (e) { return []; } }
  function save(list) {
    try { localStorage.setItem(KEY, JSON.stringify(list)); return true; }
    catch (e) { return false; } // 例如語音檔太大、儲存空間不足
  }
  window.ERAS_QUESTIONS = {
    STATUS: ['待回覆', '已聯絡', '已結案'],
    list: function () { return load(); },
    add: function (q) {
      var list = load();
      q.id = Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
      q.createdAt = new Date().toISOString();
      q.status = '待回覆';
      q.replies = [];
      list.push(q);
      return save(list) ? q : null;
    },
    update: function (id, fn) {
      var list = load();
      list.forEach(function (q) { if (q.id === id) fn(q); });
      return save(list);
    },
    remove: function (id) { save(load().filter(function (q) { return q.id !== id; })); },
    removeSimulated: function () { save(load().filter(function (q) { return !q.simulated; })); }
  };
})();
