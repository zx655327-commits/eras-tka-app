/*
 * 膝關節置換 ERAS 互動影音衛教：節點資料
 * 主線依影片 1–20 的時序排列；停藥、禁食、疼痛分級、頭暈為分流支線。
 * review: 'pending' 表示內容依步驟 1 待確認清單修改，尚待麻醉科／骨科／藥劑部確認。
 * 影片檔與 index.html 放在同一個資料夾。
 */
window.ERAS_STAGES = [
  /* 依 11/19 論文計畫書（APP 版）之五個衛教階段；開場與結語不屬五個衛教階段（extra），不列入進度條、完成階段數與 teach-back */
  { id: 'intro', name: 'ERAS 簡介', short: '簡介', extra: true },
  { id: 's1', name: '術前準備', short: '術前準備' },          // 門診評估、居家準備、禁食禁飲、入院準備與手術前注意事項
  { id: 's2', name: '麻醉與手術流程', short: '麻醉手術' },    // 麻醉評估、進入手術室、監測、麻醉方式、安全查核
  { id: 's3', name: '術後疼痛控制', short: '疼痛控制' },      // NRS 回報、多模式止痛、止痛藥物與副作用
  { id: 's4', name: '早期活動', short: '早期活動' },          // 早期下床、CPM、助行器、部分負重、跌倒預防
  { id: 's5', name: '復健及出院照護', short: '出院照護' },    // 居家復健、傷口照護、併發症警訊、求助與回診
  { id: 'end', name: '結語', extra: true }
]
window.ERAS_EDU_STAGES = window.ERAS_STAGES.filter(function (s) { return !s.extra; });

window.ERAS_NODES = {
  /* ───────── 第一階段：術前準備 ───────── */
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
    videos: ['v/03.mp4', 'v/05.mp4', 'v/04.mp4']   /* 2026-11-28：先講手術（03 退化建議手術→05 替換磨損關節），再講 ERAS（04），銜接下一項 06 ERAS 流程 */,
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

  /* （術前準備：病史、用藥、檢查、禁食） */
  history: {
    stage: 's1', main: true, title: '過敏史與噁心嘔吐經驗要先說',
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
    stage: 's1', main: true, title: '主動告知用藥、保健品與慢性病',
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
    stage: 's1', branch: true, review: 'pending',
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
    stage: 's1', branch: true, review: 'pending',
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
    stage: 's1', branch: true, review: 'pending',
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
    stage: 's1', main: true, review: 'pending',
    title: '戒菸、戒酒、口腔清潔與深呼吸咳嗽',
    script: '手術前請盡早戒菸，並做好口腔清潔，刷牙、使用牙線。如果平常有喝酒的習慣，請在手術前減少或停止喝酒，並誠實告訴醫護人員您平常的飲酒量，需要時我們會提供戒菸或戒酒諮詢。請每天練習深呼吸與咳嗽：用鼻子慢慢吸氣，停三到五秒，再用嘴巴慢慢吐氣，這能幫助手術後肺部張開，預防肺炎。',
    corePoint: '戒菸、戒酒、口腔清潔與深呼吸咳嗽練習，可降低術後感染與肺部併發症。',
    checklist: [
      '開始戒菸，並維持刷牙與牙線清潔',
      '告知醫護人員平常的飲酒量，手術前減少或停止喝酒',
      '每天練習深呼吸咳嗽（吸氣停 3～5 秒再吐氣）'
    ],
    next: 'nutrition'
  },
  /* 2026-11-28 依健保 ERAS 推廣計畫附件七（門診 6 營養諮詢、手術後 8 術後營養照護）新增，待審 */
  nutrition: {
    stage: 's1', main: true, review: 'pending',
    title: '術前營養：吃得夠，術後才有體力復原',
    script: '手術前，營養師會量您的身高、體重，並參考抽血的白蛋白，評估您的營養狀況。手術前請三餐均衡，每餐都要有足夠的蛋白質，例如魚、肉、蛋、豆腐、豆漿或牛奶，幫助傷口癒合與肌肉恢復。有糖尿病的長輩，請依醫師與營養師的建議控制血糖。手術後，只要可以喝水、沒有噁心想吐，就會讓您及早開始喝水和進食，這有助於體力和腸胃功能恢復。',
    corePoint: '術前三餐均衡、蛋白質吃足夠；術後可以喝水、不噁心，就及早開始進食。',
    checklist: [
      '術前三餐均衡，每餐都有蛋白質（魚、肉、蛋、豆製品或奶類）',
      '有糖尿病者依醫師與營養師建議控制血糖',
      '了解術後可以喝水、不噁心就會及早開始進食'
    ],
    next: 'exam'
  },
  exam: {
    stage: 's1', main: true, review: 'pending', title: '術前檢查是為了安全',
    videos: ['v/09.mp4'],
    corePoint: '手術前，醫療團隊會安排胸部 X 光、心電圖與抽血（如血色素、凝血功能、血糖、白蛋白）等檢查，確認您的身體狀況。若發現貧血，醫師會在手術前先處理，讓手術與麻醉更安全。',
    checklist: [ '了解術前會做胸部 X 光、心電圖與抽血檢查', '了解若有貧血，醫師會在手術前先處理' ],
    next: 'fasting'
  },
  fasting: {
    stage: 's1', main: true, review: 'pending',
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
    stage: 's1', branch: true, review: 'pending',
    title: '術前 2～8 小時可飲用的清流質',
    script: '手術前 2 到 8 小時之間，可以喝倒在透明杯子裡看得到杯底、沒有渣的液體，例如醫院提供的術前碳水飲品、白開水、無果粒的清果汁，總量建議在 200 毫升以內。牛奶、豆漿、米漿和拿鐵進到胃裡會結塊，要和固體食物一樣，在 8 小時前停止。',
    corePoint: '可喝：術前碳水飲、白開水、無果粒清果汁；不可喝：牛奶、豆漿、米漿、拿鐵。',
    checklist: [
      '確認飲品透明無渣（看得到杯底）',
      '在「手術前滿 2 小時」之前喝完，總量約 200 mL 以內',
      '刷牙漱口的水要吐掉，不要吞下'
    ],
    options: [ { label: '回到主線，繼續下一步', target: 'identity', primary: true } ]
  },
  fasting_violation: {
    stage: 's1', branch: true,
    title: '禁食期間不小心吃東西怎麼辦',
    script: '如果您在禁食時間內不小心吃了東西，或喝了牛奶、豆漿，請不要緊張，也不要因為怕手術延期而隱瞞。麻醉時胃裡還有食物，可能逆流嗆進肺部。請立刻告訴護理師您幾點吃了什麼、吃了多少，我們會幫您安全調整手術時間。',
    corePoint: '請立即告知護理師或麻醉團隊，切勿因擔心延期而隱瞞。',
    redFlag: '若在術前 8 小時內吃到固體食物或牛奶豆漿，或在術前 2 小時內喝水，請立即告知護理師「幾點幾分吃了什麼、大約多少量」。在家請聯絡個管師，住院中請按呼叫鈴。',
    checklist: [ '立即停止繼續進食或喝水', '誠實告知進食時間、種類與份量' ],
    options: [ { label: '回到主線，繼續下一步', target: 'identity', primary: true } ]
  },

  /* ───────── 第二階段：麻醉與手術流程 ───────── */
  identity: {
    stage: 's2', main: true, title: '多次核對身分與手術部位',
    videos: ['v/10.mp4'],
    corePoint: '入院後與手術當日，醫護人員會多次核對您的姓名、手術部位與相關資料，這是保障安全的重要步驟。',
    next: 'surgery_day'
  },
  surgery_day: {
    stage: 's2', main: true, title: '手術當日準備',
    videos: ['v/11.mp4'],
    review: 'pending',
    corePoint: '手術前請依護理師指導，用肥皂或含抗菌劑的沐浴乳洗澡，降低傷口感染。手術當日請更換病人服，取下假牙、飾品與指甲油。接近手術時間時，工作人員會協助您前往手術室。',
    checklist: [ '依護理師指導，以肥皂或抗菌沐浴乳完成術前沐浴', '更換病人服', '取下假牙、飾品，卸除指甲油' ],
    next: 'ponv'
  },
  ponv: {
    stage: 's2', main: true, title: '預防噁心嘔吐與保溫',
    videos: ['v/12.mp4'],
    corePoint: '麻醉團隊會依您的風險安排保溫、止吐與止痛，讓您在安全中完成手術。',
    next: 'intraop'
  },

  intraop: {
    stage: 's2', main: true, title: '手術中的麻醉監測',
    videos: ['v/13.mp4'],
    corePoint: '手術中，麻醉團隊會持續監測血壓、心跳、血氧與體溫，並依您的狀況調整照護。',
    next: 'discomfort'
  },
  discomfort: {
    stage: 's2', main: true, title: '不舒服請主動告知',
    videos: ['v/14.mp4'],
    corePoint: '如果您感到緊張、冷、噁心、疼痛或任何不舒服，請主動告訴醫護人員，我們會協助您處理。',
    next: 'pain_intro'
  },

  /* ───────── 第三階段：術後疼痛控制（pain_*）／第四階段：早期活動（rehab、dizzy、walker） ───────── */
  pain_intro: {
    stage: 's3', main: true, title: '止痛是為了能活動：多模式止痛',
    videos: ['v/15.mp4', 'v/16.mp4'],
    review: 'pending',
    corePoint: '止痛的目的是讓您能翻身、起床與活動。我們會合併多種止痛方式，減少副作用。常見的方式有：按時口服止痛藥、止痛針劑、神經阻斷（在腿部神經旁打局部麻醉藥）、手術時在傷口周圍打局部麻醉藥，必要時使用自控式止痛（PCA，自己按按鈕給藥）。麻醉科醫師會依您的狀況選擇。',
    checklist: [
      '了解止痛是為了能活動，不需要忍痛',
      '知道止痛方式有：口服藥、針劑、神經阻斷、傷口局部麻醉、自控式止痛（PCA）',
      '依醫囑按時服用常規止痛藥，不等到很痛才吃'
    ],
    next: 'postop_care'
  },
  /* 2026-11-28 依健保 ERAS 推廣計畫附件七（手術後 2、4、5、6、8）新增，待審 */
  postop_care: {
    stage: 's3', main: true, review: 'pending',
    title: '術後管路、點滴與及早進食',
    script: '手術後，有些病人不會放尿管或引流管；如果有放，骨科醫師每天都會評估，盡早幫您拔除，方便您下床活動。手術後只要可以喝水，點滴就會盡早停止，不會一直打。不噁心時就可以開始喝水、進食。手術當天和術後第一天，護理師會詢問您有沒有噁心、想吐；如果覺得噁心或吐了，請馬上告訴護理師，可以給您止吐藥。',
    corePoint: '尿管、引流管不一定會放，有放會每天評估盡早拔除；可以喝水後點滴就盡早停；噁心想吐請馬上說。',
    checklist: [
      '了解尿管、引流管不一定會放，有放會每天評估盡早拔除',
      '了解可以喝水後點滴會盡早停止，並及早開始進食',
      '術後覺得噁心或嘔吐，馬上告訴護理師'
    ],
    next: 'pain_assess'
  },
  pain_assess: {
    stage: 's3', main: true, title: '術後疼痛評估：0～10 分',
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
    stage: 's3', branch: true, title: '輕度疼痛：維持規律用藥，把握復健時機',
    script: '您的疼痛控制在 3 分以下，代表多模式止痛效果很好。就算現在不太痛，常規止痛藥還是要依醫囑按時吃，才能維持穩定的止痛效果。現在正是練習勾腳踝與準備下床的好時機。',
    corePoint: '不太痛也要依醫囑按時吃常規止痛藥，把握時機開始活動。',
    checklist: [ '依醫囑按時服用常規止痛藥，不自行停藥', '活動後可冰敷膝關節周圍 15～20 分鐘' ],
    options: [ { label: '回到主線：復健運動', target: 'rehab', primary: true } ]
  },
  pain_moderate: {
    stage: 's3', branch: true, review: 'pending', title: '中度疼痛：請護理師評估追加止痛',
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
    stage: 's3', branch: true, review: 'pending', title: '劇痛或異常症狀：立即求助',
    script: '如果膝蓋痛到 7 分以上無法休息，或小腿肚單側腫脹劇痛、腳趾麻木動不了、傷口大量滲血，或突然胸痛、喘、呼吸急促，請先不要下床。住院中請立刻按呼叫鈴；如果已經出院，請立即撥打 119 或到急診。',
    corePoint: '先不要下床，住院中立即按鈴；出院後請撥 119 或立即就醫。',
    redFlag: '出現 7～10 分劇痛、小腿肚單側腫脹壓痛、腳背無法上勾或腳趾麻木冰冷、傷口大量滲血，或突然胸痛、喘、呼吸急促：住院中請立即按呼叫鈴；出院後請撥打 119 或立即到急診。',
    checklist: [ '立即告知醫護人員疼痛分數與伴隨症狀', '暫停下床，待醫護人員確認安全後再活動' ],
    options: [ { label: '了解了，回到主線：復健運動', target: 'rehab', primary: true } ]
  },
  rehab: {
    stage: 's4', main: true, review: 'pending', title: '床上復健運動與漸進式下床',
    videos: ['v/18.mp4'],
    tool: 'ankle',
    corePoint: '手術後 24 小時內，醫護人員會協助您床邊站立或下床走動。床上勤做踝幫浦運動預防血栓；醫師也可能依您的狀況使用抗血栓藥物，或彈性襪、腿部氣動加壓裝置。下床前先坐床邊，確認不頭暈再站起來。',
    checklist: [
      '了解手術後 24 小時內，會在醫護人員協助下站立或下床走動',
      '每小時做 10～20 下踝幫浦運動（勾腳尖 5 秒、壓腳背 5 秒）',
      '依醫囑使用抗血栓藥物、彈性襪或腿部氣動加壓裝置',
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
    stage: 's4', branch: true, review: 'pending', title: '術後頭暈：先躺下，防跌倒',
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
    stage: 's4', main: true, title: '使用助行器安全行走',
    videos: ['v/19.mp4'],
    corePoint: '口訣：助行器先往前放穩 → 開刀腳跨出 → 好腳跟上。轉彎用小碎步。',
    checklist: [
      '助行器高度約與手腕橫紋齊平，握把時手肘微彎',
      '依口訣行走：助行器先走 → 開刀腳 → 好腳',
      '平躺時膝蓋正下方不墊枕頭，保持膝蓋能完全伸直'
    ],
    next: 'cpm'
  },
  /* 2026-11-21 依 11/19 計畫書補充（尚無影片：先以文字＋語音朗讀；補拍影片後加入 videos）。
   * 實證依據見 ERAS APP 說明文件；臨床細節待骨科、物理治療師確認（review: 'pending'）。 */
  cpm: {
    stage: 's4', main: true, review: 'pending', title: '連續被動運動機（CPM）：依醫囑使用',
    script: '有些病人術後會由醫師安排使用連續被動運動機，簡稱 CPM。機器會帶著您的膝蓋慢慢彎曲、伸直，角度與使用時間由醫師或治療師設定，請不要自己調整。使用時腳要放正，膝蓋對準機器的關節位置。如果覺得劇痛、腳麻，或傷口滲血，請先按停止，並告訴護理師。要特別記得，CPM 只是輔助，研究發現它不能取代您自己主動做的復健運動。',
    corePoint: 'CPM 依醫師或治療師設定使用，不可自行調整角度；它只是輔助，自己主動做復健運動才是恢復關鍵。',
    checklist: [
      '不自行調整 CPM 的角度與速度',
      '腳放正，膝蓋對準機器關節位置',
      '劇痛、腳麻或傷口滲血時，先停機並告知護理師'
    ],
    next: 'weight_bearing'
  },
  weight_bearing: {
    stage: 's4', main: true, review: 'pending', title: '下床負重：依醫師指示踩多少重量',
    script: '手術後，多數病人在醫護人員評估後就能開始下床走路。開刀腳可以承受多少重量，要依照骨科醫師的指示：有的是「在可以忍受的範圍內踩地」，有的是「部分負重」，也就是開刀腳只踩一部分重量，其餘由助行器和雙手分擔。如果不確定自己是哪一種，請先問醫師或物理治療師，不要自己加重，也不要因為害怕而完全不敢踩。',
    corePoint: '負重程度依骨科醫師指示；部分負重時，用助行器和雙手分擔體重。不確定就先問。',
    checklist: [
      '知道醫師給我的負重指示（可忍受範圍內負重或部分負重）',
      '部分負重時，用助行器和雙手分擔體重',
      '走路時疼痛明顯加劇，先停下休息並告知醫護人員'
    ],
    next: 'fall_prevention'
  },
  fall_prevention: {
    stage: 's4', main: true, review: 'pending', title: '預防跌倒：住院與回家都要注意',
    script: '膝關節手術後，因為疼痛、肌力還沒恢復，加上部分止痛藥或安眠藥可能讓人頭暈、反應變慢，比較容易跌倒。住院時，第一次下床請醫護人員陪同；起身要慢，先坐一下，不暈再站；穿合腳的防滑鞋；晚上上廁所請開小燈，需要時請家屬或護理師協助。回家前，請家人把走道上的雜物、電線和地墊收好，浴室放止滑墊，最好加裝扶手。',
    corePoint: '起身慢、穿防滑鞋、夜間開燈；家中走道淨空、浴室防滑。吃了會頭暈的藥物後更要小心。',
    redFlag: '如果跌倒後開刀腳疼痛突然加劇、腫脹變形或無法站立，請不要勉強起身，立即通知醫護人員或就醫。',
    checklist: [
      '起身慢慢來：躺 → 坐 → 站，不暈再走',
      '穿合腳防滑鞋，夜間如廁開小燈',
      '家中走道淨空，浴室有止滑墊或扶手'
    ],
    next: 'discharge'
  },

  /* ───────── 第五階段：復健及出院照護 ───────── */
  discharge: {
    stage: 's5', main: true, title: '出院衛教與傷口照護',
    videos: ['v/20.mp4'],
    review: 'pending',
    corePoint: '出院前，護理師會說明傷口照護、居家活動與回診追蹤。出院時疼痛目標約在 3 分以下；出院後會安排 2 次門診追蹤。出院 30 天內如果到急診、再次住院或再次手術，請告訴 ERAS 個管師。',
    checklist: [
      '知道傷口怎麼照顧、什麼時候換藥',
      '出院時疼痛約 3 分以下，回家依醫囑服用止痛藥',
      '知道回診日期（出院後會安排 2 次門診追蹤）',
      '出院 30 天內若到急診、再住院或再手術，會告訴 ERAS 個管師'
    ],
    redFlag: '出院後若傷口紅腫熱痛、流膿、發燒，或小腿單側腫痛、突然胸痛或呼吸喘，請立即回診或到急診。',
    survey: true,
    next: 'home_rehab'
  },
  home_rehab: {
    stage: 's5', main: true, review: 'pending', title: '居家復健運動：每天持續做',
    script: '出院後的復健運動要每天持續做。常見的居家運動有：踝幫浦運動、大腿肌肉出力把膝蓋往下壓、直膝抬腿，以及坐著練習彎膝和伸直膝蓋。實際要做哪些運動、做幾下、什麼時候加量，請依照物理治療師給您的運動處方。研究發現，在專業指導下的居家復健，功能恢復和到門診復健相近。運動後輕微痠痛是常見的，但如果疼痛很劇烈，或腫脹越來越嚴重，請先暫停，並聯絡醫療團隊。',
    corePoint: '依物理治療師的處方每天做運動；平躺時膝蓋下不墊枕頭。疼痛劇烈或腫脹加劇先暫停並聯絡醫療團隊。',
    checklist: [
      '照物理治療師的運動處方每天做',
      '平躺時膝蓋下不墊枕頭，練習把膝蓋伸直',
      '疼痛劇烈或腫脹加劇時，先暫停並聯絡醫療團隊'
    ],
    next: 'warning_signs'
  },
  warning_signs: {
    stage: 's5', main: true, review: 'pending', title: '出院後的警訊：何時回診或立即求助',
    script: '回家後，請注意下面這些情形。第一，傷口紅、腫、熱、痛越來越嚴重，有分泌物、流膿，或是發燒，可能是感染，請盡快回診。第二，單側小腿腫脹、疼痛、發熱，可能是靜脈血栓，請盡快就醫。第三，突然胸痛、呼吸喘或咳血，請立即撥打 119。第四，跌倒後膝蓋不能踩地或變形，請就醫。第五，膝蓋疼痛或腫脹越來越厲害，吃止痛藥也沒有改善，請聯絡醫療團隊。回診時間與聯絡電話，請以出院衛教單為準。',
    corePoint: '傷口感染、小腿單側腫痛要盡快就醫；突然胸痛、呼吸喘或咳血請立即撥打 119。',
    redFlag: '突然胸痛、呼吸困難或咳血，請立即撥打 119。',
    checklist: [
      '知道傷口感染的徵象：紅腫熱痛加劇、流膿、發燒',
      '知道血栓的徵象：小腿單側腫痛；胸痛、呼吸喘要打 119',
      '知道回診時間與聯絡電話（依出院衛教單）'
    ],
    next: 'closing'
  },
  closing: {
    stage: 'end', main: true, title: '一起邁向安全的康復',
    videos: ['v/21.mp4'],
    corePoint: '恭喜您看完全部衛教內容。醫療團隊會陪伴您安全、有計畫地恢復。',
    survey: true,
    end: true
  }
};

/* 主線順序（供進度、後台統計、目錄使用） */
window.ERAS_ORDER = Object.keys(window.ERAS_NODES);

/* 2026-11-28 依健保 ERAS 推廣計畫附件七新增／修改的內容：團隊端「內容審核狀態」分頁以紅字粗體標示，供審查 */
window.ERAS_REVISED = {
  date: '2026-11-28',
  source: '健保 ERAS 推廣計畫（115/8/4 修正）附件七 關節置換術執行項目清單',
  items: {
    resp:        { type: '修改', basis: '門診 9 戒酒諮詢', text: ['標題加入「戒酒」', '說明：告知飲酒量，術前減少或停止喝酒，需要時提供戒菸或戒酒諮詢', '自我檢核新增：告知醫護人員平常的飲酒量，手術前減少或停止喝酒'] },
    nutrition:   { type: '新增', basis: '門診 6 營養諮詢；手術後 8 術後營養照護', text: ['整項新增：術前營養評估、三餐均衡與蛋白質、糖尿病控糖、術後及早進食（含 3 項自我檢核）'] },
    exam:        { type: '修改', basis: '門診 3 心肺功能評估、4 術前檢驗、10 術前貧血評估', text: ['重點改為：胸部 X 光、心電圖與抽血（血色素、凝血功能、血糖、白蛋白）；若有貧血，術前先處理', '自我檢核新增 2 項（檢查項目、貧血處理）'] },
    surgery_day: { type: '修改', basis: '住院當天 2 術前沐浴', text: ['重點新增：依護理師指導，用肥皂或含抗菌劑的沐浴乳術前沐浴', '自我檢核新增：完成術前沐浴'] },
    pain_intro:  { type: '修改', basis: '手術當天 3 術前止痛、手術中 1 麻醉止痛、手術後 1 術後藥物止痛', text: ['重點新增具體止痛方式：口服止痛藥、止痛針劑、神經阻斷、傷口局部麻醉、自控式止痛（PCA）', '自我檢核新增：知道有哪些止痛方式（對應 teach-back 第三階段第 1 題）'] },
    postop_care: { type: '新增', basis: '手術後 2 暈吐評估、4 拔除尿管、5 拔除引流管、6 減少術後過多輸液、8 術後及早進食', text: ['整項新增：尿管與引流管每日評估盡早拔除、可喝水後盡早停點滴、及早進食、噁心嘔吐評估（含 3 項自我檢核）'] },
    rehab:       { type: '修改', basis: '手術後 9 術後 24 小時內離床、10 血栓預防', text: ['重點新增：術後 24 小時內協助床邊站立或下床；可能使用抗血栓藥物、彈性襪或腿部氣動加壓', '自我檢核新增 2 項（24 小時內下床、血栓預防措施）'] },
    discharge:   { type: '修改', basis: '出院當天 1 傷口護理、2 疼痛 ≤3 分、3 返診；出院追蹤 1–5', text: ['重點新增：出院疼痛目標 3 分以下、出院後 2 次門診追蹤、30 天內急診／再住院／再手術告知個管師', '新增 4 項自我檢核（傷口照顧、疼痛、回診日期、30 天內告知）'] }
  }
};

/* 2026-11-28 衛教圖卡對應（禁食卡已改為 8 小時、劇痛卡已改為膝關節警訊、糖尿病卡背景海報已改為膝關節） */
(function () {
  var M = {
    welcome:           [['family_watch.gif', '和家屬一起看，了解每個階段的重點']],
    identity:          [['identity_check.webp', '多次核對，是為了安全']],
    surgery_day:       [['gown_dentures.webp', '換病人服、取下假牙飾品']],
    exam:              [['preop_exams.webp', '依約完成檢查：胸部X光、心電圖、抽血']],
    resp:              [['deep_breath.webp', '鼻子吸氣、停3～5秒、嘴巴吐氣']],
    fasting:           [['fasting_8h.webp', '不用從半夜就禁食：術前 8 小時停止固體食物、術前 2 小時停止清澈飲品']],
    med_diabetes:      [['dm_meds_knee.webp', '糖尿病用藥需要調整'], ['sglt2_glp1.webp', '排糖藥、腸泌素針要先告知']],
    fasting_clear:     [['clear_fluid.webp', '看得到杯底＝可以喝'], ['no_milk_soy.webp', '牛奶、豆漿、米漿、果粒飲料不可以']],
    fasting_violation: [['aspiration.webp', '食物可能嗆進肺部']],
    intraop:           [['monitor_warm.webp', '全程監測與保溫']],
    pain_intro:        [['multimodal_pain.webp', '多種止痛方式一起用：口服止痛藥、自控式止痛、大腿神經阻斷']],
    pain_assess:       [['pain_score.webp', '誠實說出分數，不要忍痛']],
    pain_mild:         [['pain_0_3.webp', '0～3分：把握時機下床']],
    pain_severe:       [['pain_7_knee.webp', '7分以上或小腿單側腫痛、腳趾麻木冰冷、傷口大量滲血、胸痛呼吸喘：立刻按鈴']],
    dizzy:             [['dizzy.webp', '第一次下床可能會頭暈']],
    discharge:         [['return_date.webp', '記下返診日期']],
    warning_signs:     [['chest_pain_119.webp', '胸痛、呼吸喘：撥119']]
  };
  Object.keys(M).forEach(function (k) {
    if (window.ERAS_NODES[k]) window.ERAS_NODES[k].images = M[k].map(function (x) { return { src: 'img/' + x[0], alt: x[1] }; });
  });
})();
/* 2026-11-28 依臨床流程調整順序：
   1. 術後疼痛控制：多模式止痛 → 疼痛評估（含輕／中／重度分支）→ 術後管路、點滴與及早進食
   2. 早期活動：床上復健與漸進式下床（含頭暈分支）→ 下床負重 → 助行器 → CPM → 預防跌倒 */
(function () {
  var N = window.ERAS_NODES;
  function retarget(id, from, to, label) {
    (N[id].options || []).forEach(function (o) { if (o.target === from) { o.target = to; if (label) o.label = label; } });
  }
  N.pain_intro.next = 'pain_assess';
  N.pain_assess.next = 'postop_care';
  retarget('pain_mild', 'rehab', 'postop_care', '回到主線：術後管路、點滴與進食');
  retarget('pain_moderate', 'rehab', 'postop_care', '回到主線：術後管路、點滴與進食');
  retarget('pain_severe', 'rehab', 'postop_care', '了解了，回到主線：術後管路、點滴與進食');
  N.postop_care.next = 'rehab';
  N.rehab.next = 'weight_bearing';
  retarget('rehab', 'walker', 'weight_bearing', '不頭暈，準備下床：先了解負重');
  retarget('dizzy', 'walker', 'weight_bearing', '已經不暈了，繼續：下床負重');
  N.weight_bearing.next = 'walker';
  N.walker.next = 'cpm';
  N.cpm.next = 'fall_prevention';
  window.ERAS_ORDER = [
    'welcome', 'opening', 'reason', 'eras_flow',
    'history', 'meds', 'med_anticoag', 'med_diabetes', 'med_bp', 'resp', 'nutrition', 'exam', 'fasting', 'fasting_clear', 'fasting_violation',
    'identity', 'surgery_day', 'ponv', 'intraop', 'discomfort',
    'pain_intro', 'pain_assess', 'pain_mild', 'pain_moderate', 'pain_severe', 'postop_care',
    'rehab', 'dizzy', 'weight_bearing', 'walker', 'cpm', 'fall_prevention',
    'discharge', 'home_rehab', 'warning_signs',
    'closing'
  ];
})();
/* 2026-11-28 ERAS 簡介合併為一項，6 段影片連續播放完畢（01 歡迎 → 02 開場 → 03 退化建議手術 → 05 替換磨損關節 → 04 ERAS 的意思 → 06 ERAS 流程） */
(function () {
  var N = window.ERAS_NODES;
  N.welcome.title = 'ERAS 簡介：從術前到出院的照護流程';
  N.welcome.videos = ['v/01.mp4', 'v/02.mp4', 'v/03.mp4', 'v/05.mp4', 'v/04.mp4', 'v/06.mp4'];
  N.welcome.corePoint = '歡迎您與家屬一起觀看。膝痛影響生活品質時，手術是替換磨損的關節表面，幫助您恢復活動力；ERAS 不是趕出院，而是由團隊安全、有計畫地陪您恢復。接下來會依序說明：術前準備、麻醉、疼痛控制、早期活動與出院後追蹤。';
  N.welcome.checklist = N.reason.checklist;
  N.welcome.next = 'history';
  ['opening', 'reason', 'eras_flow'].forEach(function (k) { delete N[k]; });
  window.ERAS_ORDER = window.ERAS_ORDER.filter(function (k) { return N[k]; });
})();
/* 圖卡與影片加上版本號：檔案更新後，避免手機或瀏覽器沿用舊的快取檔案。更新圖檔或影片時請把 ASSET_V 改成新的值 */
(function () {
  var ASSET_V = 'r20261128n';
  Object.keys(window.ERAS_NODES).forEach(function (k) {
    var n = window.ERAS_NODES[k];
    if (n.videos) n.videos = n.videos.map(function (v) { return v.split('?')[0] + '?v=' + ASSET_V; });
    if (n.images) n.images.forEach(function (im) { im.src = im.src.split('?')[0] + '?v=' + ASSET_V; });
  });
})();