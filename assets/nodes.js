/*
 * 膝關節置換 ERAS 互動影音衛教：節點資料
 * 主線依影片 1–20 的時序排列；停藥、禁食、疼痛分級、頭暈為分流支線。
 * review: 'pending' 表示內容依步驟 1 待確認清單修改，尚待麻醉科／骨科／藥劑部確認。
 * 影片檔與 index.html 放在同一個資料夾。
 */
window.ERAS_STAGES = [
  { id: 'intro',   name: '認識手術' },
  { id: 'preop',   name: '術前準備' },
  { id: 'day',     name: '手術當日' },
  { id: 'intraop', name: '手術中' },
  { id: 'postop',  name: '術後恢復' },
  { id: 'home',    name: '出院' }
];

window.ERAS_NODES = {
  /* ───────── 認識手術 ───────── */
  welcome: {
    stage: 'intro', main: true, title: '歡迎觀看人工膝關節置換術前衛教',
    videos: ['v/01.mp4'],
    corePoint: '歡迎您與家屬一起觀看，了解從術前到出院的照護重點。',
    next: 'opening'
  },
  opening: {
    stage: 'intro', main: true, title: '開場：手術前先了解流程',
    videos: ['v/02.mp4'],
    corePoint: '手術前先了解流程，會讓您更安心。',
    next: 'reason'
  },
  reason: {
    stage: 'intro', main: true, title: '為什麼建議做人工膝關節置換',
    videos: ['v/03.mp4', 'v/04.mp4', 'v/05.mp4'],
    corePoint: '膝痛影響生活品質時，手術是替換磨損的關節表面，幫助您恢復活動力。',
    checklist: [
      '了解膝關節置換是替換磨損的關節表面，目的是恢復行走與活動力',
      '了解「術後加速康復」不是趕出院，而是安全、有計畫地恢復'
    ],
    next: 'eras_flow'
  },
  eras_flow: {
    stage: 'intro', main: true, title: 'ERAS 照護流程簡介',
    videos: ['v/06.mp4'],
    corePoint: '接下來會依序說明：術前準備、麻醉、疼痛控制、早期活動與出院後追蹤。',
    next: 'history'
  },

  /* ───────── 術前準備 ───────── */
  history: {
    stage: 'preop', main: true, title: '過敏史與噁心嘔吐經驗要先說',
    videos: ['v/07.mp4'],
    corePoint: '過去對藥物或食物過敏、以前麻醉後有噁心嘔吐，請主動告訴醫師。',
    checklist: [
      '主動告知藥物、食物過敏史',
      '告知以前手術或麻醉後是否有噁心嘔吐、暈車體質',
      '告知是否有打呼或睡眠呼吸中止症'
    ],
    next: 'meds'
  },
  meds: {
    stage: 'preop', main: true, title: '主動告知用藥、保健品與慢性病',
    videos: ['v/08.mp4'],
    corePoint: '抗凝血藥、糖尿病藥物不可自行停用，請依醫師給您的指示。',
    checklist: [
      '備妥所有醫院與診所的藥袋或藥單，交給醫護人員核對',
      '告知正在吃的保健品（魚油、銀杏、人參、紅麴、維生素 E 等）',
      '依醫師指示決定哪些藥要停、哪些照吃，不自行停藥'
    ],
    question: '您平時有吃以下哪一類藥物嗎？（可以每一項都點進去看）',
    options: [
      { label: '抗凝血劑或抗血小板藥（如阿斯匹靈、保栓通）', target: 'med_anticoag', danger: true },
      { label: '降血糖藥、排糖藥或腸泌素針劑', target: 'med_diabetes', danger: true },
      { label: '降血壓藥', target: 'med_bp' },
      { label: '以上都沒有，繼續下一步', target: 'resp', primary: true }
    ],
    next: 'resp'
  },
  med_anticoag: {
    stage: 'preop', branch: true, review: 'pending',
    title: '抗凝血劑與抗血小板藥物：依停藥單執行',
    script: '阿斯匹靈、保栓通，或新型抗凝血劑，會影響血液凝固。每一種藥需要停藥的天數都不一樣，有些甚至不需要停。請不要自己停藥，也不要自己決定繼續吃，一定要依照醫師給您的停藥指示。如果您還沒有拿到停藥指示，請立刻聯絡個管師。',
    corePoint: '每種抗凝血藥停藥天數不同，有些不用停；一定依醫師的停藥單執行。',
    redFlag: '若您還沒拿到停藥指示，或不確定自己是否該停藥，請立即聯絡個管師或門診護理師。曾放心臟支架的病人，切勿自行停用阿斯匹靈。',
    checklist: [
      '確認已拿到醫師開立的「術前停藥指示」',
      '記下最後一次服藥的日期與時間，入院時告訴護理師',
      '魚油、銀杏、納豆激酶等保健品依醫師指示停用'
    ],
    options: [
      { label: '我也有吃降血糖藥或排糖藥', target: 'med_diabetes' },
      { label: '我也有吃降血壓藥', target: 'med_bp' },
      { label: '回到主線，繼續下一步', target: 'resp', primary: true }
    ]
  },
  med_diabetes: {
    stage: 'preop', branch: true, review: 'pending',
    title: '糖尿病藥物、排糖藥與腸泌素針劑',
    script: '有糖尿病的長輩請注意，手術當天早上因為開始禁食，口服降血糖藥通常要暫停，避免低血糖。如果您吃的是福適佳、恩排糖這類排糖藥，通常要在手術前三天或更早停用，這類藥也常用在心臟衰竭或腎臟病。如果您有打腸泌素針劑，請一定先告訴麻醉科醫師，醫師會依您的狀況決定是否停針，或請您手術前一天改吃流質。',
    corePoint: '排糖藥通常需提前停用；腸泌素針劑請先告訴麻醉科，依醫師指示處理。',
    redFlag: '若您吃排糖藥（如福適佳 Forxiga、恩排糖 Jardiance）或施打腸泌素針劑（如胰妥讚 Ozempic、易週糖 Trulicity、猛健樂 Mounjaro），卻還沒有收到醫師的停藥或飲食指示，請立即聯絡個管師。',
    checklist: [
      '手術當日早上口服降血糖藥依醫師指示暫停',
      '排糖藥依醫師指示提前停用',
      '施打胰島素者，依麻醉科醫師指示調整劑量',
      '術前是否喝碳水飲品，請依個管師指示'
    ],
    options: [
      { label: '我也有吃抗凝血劑', target: 'med_anticoag' },
      { label: '我也有吃降血壓藥', target: 'med_bp' },
      { label: '回到主線，繼續下一步', target: 'resp', primary: true }
    ]
  },
  med_bp: {
    stage: 'preop', branch: true, review: 'pending',
    title: '降血壓藥：依麻醉科服藥單',
    script: '大部分降血壓藥，手術當天早上可以配一小口水照常服用。但是有些種類需要暫停，例如部分血管張力素類藥物與利尿劑。請依照麻醉科醫師給您的服藥單決定哪些照吃、哪些暫停。',
    corePoint: '大部分降血壓藥當天配一小口水照吃，但有些種類要暫停，請依服藥單。',
    checklist: [
      '確認麻醉科給的服藥單上，哪些降血壓藥照吃、哪些暫停',
      '需要照吃的藥，手術當日早上配一小口水（約 30 mL）吞服'
    ],
    options: [
      { label: '我也有吃抗凝血劑', target: 'med_anticoag' },
      { label: '我也有吃降血糖藥或排糖藥', target: 'med_diabetes' },
      { label: '回到主線，繼續下一步', target: 'resp', primary: true }
    ]
  },
  resp: {
    stage: 'preop', main: true, review: 'pending',
    title: '戒菸、口腔清潔與深呼吸咳嗽',
    script: '手術前請盡早戒菸，並做好口腔清潔，刷牙、使用牙線。請每天練習深呼吸與咳嗽：用鼻子慢慢吸氣，停三到五秒，再用嘴巴慢慢吐氣，這能幫助手術後肺部張開，預防肺炎。',
    corePoint: '戒菸、口腔清潔與深呼吸咳嗽練習，可降低術後感染與肺部併發症。',
    checklist: [
      '開始戒菸，並維持刷牙與牙線清潔',
      '每天練習深呼吸咳嗽（吸氣停 3～5 秒再吐氣）'
    ],
    next: 'exam'
  },
  exam: {
    stage: 'preop', main: true, title: '術前檢查是為了安全',
    videos: ['v/09.mp4'],
    corePoint: '手術前，醫療團隊會安排必要檢查與評估，確認您的身體狀況，讓手術與麻醉更安全。',
    next: 'fasting'
  },
  fasting: {
    stage: 'preop', main: true, review: 'pending',
    title: 'ERAS 術前禁食與補水（8-2 原則）',
    tool: 'fasting',
    script: '以前手術常從半夜就不吃不喝。現在 ERAS 流程更人性化：手術前 8 小時停止吃固體食物、牛奶和豆漿；手術前 2 小時以前，可以喝清澈無渣的液體，例如醫院提供的術前碳水飲品或白開水。糖尿病人是否喝碳水飲品，請依個管師指示。請在右側輸入手術時間，看看您的截止時間。',
    corePoint: '固體食物與奶類：術前 8 小時停止；清澈無渣液體：術前 2 小時前喝完。',
    checklist: [
      '用「禁食試算器」輸入手術時間，記下兩個截止時間',
      '術前 8 小時起：不吃便當、稀飯、肉類、牛奶、豆漿、含渣果汁',
      '術前 2 小時起：完全不吃不喝（含白開水、口香糖、檳榔）'
    ],
    question: '想再確認哪一部分？',
    options: [
      { label: '術前 2～8 小時可以喝什麼？', target: 'fasting_clear' },
      { label: '我不小心在禁食時間吃了東西', target: 'fasting_violation', danger: true },
      { label: '我已清楚，繼續下一步', target: 'identity', primary: true }
    ],
    next: 'identity'
  },
  fasting_clear: {
    stage: 'preop', branch: true, review: 'pending',
    title: '術前 2～8 小時可飲用的清流質',
    script: '手術前 2 到 8 小時之間，可以喝倒在透明杯子裡看得到杯底、沒有渣的液體，例如醫院提供的術前碳水飲品、白開水、無果粒的清果汁，總量建議在 400 毫升以內。牛奶、豆漿、米漿和拿鐵進到胃裡會結塊，要和固體食物一樣，在 8 小時前停止。',
    corePoint: '可喝：術前碳水飲、白開水、無果粒清果汁；不可喝：牛奶、豆漿、米漿、拿鐵。',
    checklist: [
      '確認飲品透明無渣（看得到杯底）',
      '在「手術前滿 2 小時」之前喝完，總量約 400 mL 以內',
      '刷牙漱口的水要吐掉，不要吞下'
    ],
    options: [ { label: '回到主線，繼續下一步', target: 'identity', primary: true } ]
  },
  fasting_violation: {
    stage: 'preop', branch: true,
    title: '禁食期間不小心吃東西怎麼辦',
    script: '如果您在禁食時間內不小心吃了東西，或喝了牛奶、豆漿，請不要緊張，也不要因為怕手術延期而隱瞞。麻醉時胃裡還有食物，可能逆流嗆進肺部。請立刻告訴護理師您幾點吃了什麼、吃了多少，我們會幫您安全調整手術時間。',
    corePoint: '請立即告知護理師或麻醉團隊，切勿因擔心延期而隱瞞。',
    redFlag: '若在術前 8 小時內吃到固體食物或牛奶豆漿，或在術前 2 小時內喝水，請立即告知護理師「幾點幾分吃了什麼、大約多少量」。在家請聯絡個管師，住院中請按呼叫鈴。',
    checklist: [ '立即停止繼續進食或喝水', '誠實告知進食時間、種類與份量' ],
    options: [ { label: '回到主線，繼續下一步', target: 'identity', primary: true } ]
  },

  /* ───────── 手術當日 ───────── */
  identity: {
    stage: 'day', main: true, title: '多次核對身分與手術部位',
    videos: ['v/10.mp4'],
    corePoint: '入院後與手術當日，醫護人員會多次核對您的姓名、手術部位與相關資料，這是保障安全的重要步驟。',
    next: 'surgery_day'
  },
  surgery_day: {
    stage: 'day', main: true, title: '手術當日準備',
    videos: ['v/11.mp4'],
    corePoint: '手術當日請更換病人服，取下假牙、飾品與指甲油。接近手術時間時，工作人員會協助您前往手術室。',
    checklist: [ '更換病人服', '取下假牙、飾品，卸除指甲油' ],
    next: 'ponv'
  },
  ponv: {
    stage: 'day', main: true, title: '預防噁心嘔吐與保溫',
    videos: ['v/12.mp4'],
    corePoint: '麻醉團隊會依您的風險安排保溫、止吐與止痛，讓您在安全中完成手術。',
    next: 'intraop'
  },

  /* ───────── 手術中 ───────── */
  intraop: {
    stage: 'intraop', main: true, title: '手術中的麻醉監測',
    videos: ['v/13.mp4'],
    corePoint: '手術中，麻醉團隊會持續監測血壓、心跳、血氧與體溫，並依您的狀況調整照護。',
    next: 'discomfort'
  },
  discomfort: {
    stage: 'intraop', main: true, title: '不舒服請主動告知',
    videos: ['v/14.mp4'],
    corePoint: '如果您感到緊張、冷、噁心、疼痛或任何不舒服，請主動告訴醫護人員，我們會協助您處理。',
    next: 'pain_intro'
  },

  /* ───────── 術後恢復 ───────── */
  pain_intro: {
    stage: 'postop', main: true, title: '止痛是為了能活動：多模式止痛',
    videos: ['v/15.mp4', 'v/16.mp4'],
    corePoint: '止痛的目的是讓您能翻身、起床與活動。我們會合併多種止痛方式，減少副作用。',
    checklist: [
      '了解止痛是為了能活動，不需要忍痛',
      '依醫囑按時服用常規止痛藥，不等到很痛才吃'
    ],
    next: 'pain_assess'
  },
  pain_assess: {
    stage: 'postop', main: true, title: '術後疼痛評估：0～10 分',
    videos: ['v/17.mp4'],
    corePoint: '用 0～10 分告訴護理師您的疼痛：0 分是不痛，10 分是最痛。',
    question: '請點選您目前（或想了解）的疼痛分數：',
    options: [
      { label: '輕度 0～3 分：可以休息與活動', target: 'pain_mild' },
      { label: '中度 4～6 分：影響睡眠或不敢動', target: 'pain_moderate' },
      { label: '7～10 分劇痛，或小腿腫痛、腳麻、胸悶喘', target: 'pain_severe', danger: true }
    ],
    next: 'rehab'
  },
  pain_mild: {
    stage: 'postop', branch: true, title: '輕度疼痛：維持規律用藥，把握復健時機',
    script: '您的疼痛控制在 3 分以下，代表多模式止痛效果很好。就算現在不太痛，常規止痛藥還是要依醫囑按時吃，才能維持穩定的止痛效果。現在正是練習勾腳踝與準備下床的好時機。',
    corePoint: '不太痛也要依醫囑按時吃常規止痛藥，把握時機開始活動。',
    checklist: [ '依醫囑按時服用常規止痛藥，不自行停藥', '活動後可冰敷膝關節周圍 15～20 分鐘' ],
    options: [ { label: '回到主線：復健運動', target: 'rehab', primary: true } ]
  },
  pain_moderate: {
    stage: 'postop', branch: true, review: 'pending', title: '中度疼痛：請護理師評估追加止痛',
    script: '如果疼痛到 4 到 6 分，已經影響睡覺或不敢彎膝蓋，請不要忍耐，請告訴護理師評估給予備用止痛藥，或依指導使用自控式止痛。在物理治療師帶您下床前，先處理好疼痛，復健會輕鬆很多。冰敷時請用乾毛巾包住冰袋，不要弄濕傷口敷料。',
    corePoint: '請告訴護理師評估備用止痛藥，特別是在下床復健前。',
    checklist: [
      '告知護理師目前疼痛約 4～6 分',
      '冰袋以乾毛巾包覆，敷膝關節周圍 15～20 分鐘',
      '腳踝處微微墊高消腫，不要墊在膝窩下方'
    ],
    options: [ { label: '回到主線：復健運動', target: 'rehab', primary: true } ]
  },
  pain_severe: {
    stage: 'postop', branch: true, review: 'pending', title: '劇痛或異常症狀：立即求助',
    script: '如果膝蓋痛到 7 分以上無法休息，或小腿肚單側腫脹劇痛、腳趾麻木動不了、傷口大量滲血，或突然胸痛、喘、呼吸急促，請先不要下床。住院中請立刻按呼叫鈴；如果已經出院，請立即撥打 119 或到急診。',
    corePoint: '先不要下床，住院中立即按鈴；出院後請撥 119 或立即就醫。',
    redFlag: '出現 7～10 分劇痛、小腿肚單側腫脹壓痛、腳背無法上勾或腳趾麻木冰冷、傷口大量滲血，或突然胸痛、喘、呼吸急促：住院中請立即按呼叫鈴；出院後請撥打 119 或立即到急診。',
    checklist: [ '立即告知醫護人員疼痛分數與伴隨症狀', '暫停下床，待醫護人員確認安全後再活動' ],
    options: [ { label: '了解了，回到主線：復健運動', target: 'rehab', primary: true } ]
  },
  rehab: {
    stage: 'postop', main: true, review: 'pending', title: '床上復健運動與漸進式下床',
    videos: ['v/18.mp4'],
    tool: 'ankle',
    corePoint: '床上勤做踝幫浦運動預防血栓；下床前先坐床邊，確認不頭暈再站起來。',
    checklist: [
      '每小時做 10～20 下踝幫浦運動（勾腳尖 5 秒、壓腳背 5 秒）',
      '下床時有家屬或醫護人員陪同，穿防滑鞋',
      '下床三部曲：搖高床頭 → 坐床邊雙腳下垂 5 分鐘 → 扶助行器站立，不暈再走'
    ],
    question: '坐在床邊 5 分鐘後，身體感覺如何？',
    options: [
      { label: '不頭暈，準備用助行器走路', target: 'walker', primary: true },
      { label: '頭暈、冒冷汗或眼前發黑', target: 'dizzy', danger: true }
    ],
    next: 'walker'
  },
  dizzy: {
    stage: 'postop', branch: true, review: 'pending', title: '術後頭暈：先躺下，防跌倒',
    script: '坐起來覺得頭暈或冒冷汗，是手術後不少病人第一次下床時會遇到的情形。請不要勉強站起來，請家屬扶您慢慢躺回床上，把腳稍微墊高，深呼吸休息，並告訴護理師幫您量血壓。等完全不暈了，再請護理師陪您試一次。',
    corePoint: '立即躺回床上休息並告訴護理師量血壓，切勿勉強站立或獨自如廁。',
    redFlag: '坐起時若出現頭暈、冒冷汗、眼前發黑或噁心想吐，請勿勉強下床，立即躺下並通知護理師。',
    checklist: [ '躺回床上，稍微抬高雙腿休息', '通知護理師測量血壓', '在床上持續做踝幫浦運動' ],
    options: [
      { label: '已經不暈了，繼續：使用助行器', target: 'walker', primary: true },
      { label: '回到復健運動', target: 'rehab' }
    ]
  },
  walker: {
    stage: 'postop', main: true, title: '使用助行器安全行走',
    videos: ['v/19.mp4'],
    corePoint: '口訣：助行器先往前放穩 → 開刀腳跨出 → 好腳跟上。轉彎用小碎步。',
    checklist: [
      '助行器高度約與手腕橫紋齊平，握把時手肘微彎',
      '依口訣行走：助行器先走 → 開刀腳 → 好腳',
      '平躺時膝蓋正下方不墊枕頭，保持膝蓋能完全伸直'
    ],
    next: 'discharge'
  },

  /* ───────── 出院 ───────── */
  discharge: {
    stage: 'home', main: true, title: '出院衛教與傷口照護',
    videos: ['v/20.mp4'],
    corePoint: '出院前，護理師會說明傷口照護、居家活動與回診追蹤。',
    redFlag: '出院後若傷口紅腫熱痛、流膿、發燒，或小腿單側腫痛、突然胸痛或呼吸喘，請立即回診或到急診。',
    survey: true,
    next: 'closing'
  },
  closing: {
    stage: 'home', main: true, title: '一起邁向安全的康復',
    videos: ['v/21.mp4'],
    corePoint: '恭喜您看完全部衛教內容。醫療團隊會陪伴您安全、有計畫地恢復。',
    survey: true,
    end: true
  }
};

/* 主線順序（供進度、後台統計、目錄使用） */
window.ERAS_ORDER = Object.keys(window.ERAS_NODES);
