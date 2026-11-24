// 連続斬り i18n
const I18N = {
  ja: {
    name: ['連続', '斬り'], sub: 'R E N Z O K U - G I R I',
    start: 'はじめる', howto: '遊び方', settings: '設定', best: '自己ベスト', unit: '個',
    ready: '構え', hold: 'スマホを刀のように構えて静止。\n気が満ちたら始まります', qi: '気',
    swipeHold: '画面を長押しして気を溜めると始まります。\n指を左右に素早く往復させて斬る',
    warn: '周囲に人や物がないことを確認し、スマホをしっかり握って振ってください。',
    ok: 'わかった', retry: 'もう一度', share: 'Xに投稿', save: '画像を保存', newBest: '自己ベスト更新', rank: 'ランク',
    how: ["スマホを両手で刀のように構えて静止すると気が満ちます。気は一度満ちたら、時間切れまでそのままです。", "始めの合図から5秒間、振るたびに巻藁を上から輪切りにしていきます。", "往復させるように、細かく速く振り続けるのがコツです。", "一本の巻藁を何個に斬り分けられるかを競います。最後まで斬り切ると「全断」です。"],
    sound: 'サウンド', on: 'ON', off: 'OFF', lang: '言語', close: '閉じる', back: 'タイトルへ',
    motionOff: 'モーションセンサーが使えないため、指モードにしました',
    statCuts: '斬撃', statRate: '毎秒', time: 'TIME', combo: 'COMBO', perfects: '一閃', maxCombo: '最大連撃', shallow: '浅い',
    shareText: (n, r, t) => `夕暮れの道場で、一本の巻藁を5秒で${n}個に斬り分けた！\nランク${r}「${t}」\n#連続斬り`,
    titles: ["なまくら", "藁くず職人", "道場の稽古人", "輪切りの剣士", "夕凪の剣豪", "千切りの達人", "剣聖", "黄昏を刻む者"]
  },
  en: {
    name: ['RENZOKU', 'GIRI'], sub: 'R A P I D   S L A S H',
    start: 'START', howto: 'HOW TO PLAY', settings: 'SETTINGS', best: 'BEST', unit: 'PIECES',
    ready: 'STANCE', hold: 'Hold your phone like a sword and stay still.\nThe round starts when your focus is full.', qi: 'FOCUS',
    swipeHold: 'Press and hold to build focus and start.\nSwipe back and forth fast to cut.',
    warn: 'Make sure no people or objects are around you, and grip your phone firmly.',
    ok: 'GOT IT', retry: 'RETRY', share: 'POST TO X', save: 'SAVE IMAGE', newBest: 'NEW BEST', rank: 'RANK',
    how: ["Hold your phone with both hands like a sword and stay still. Once your focus is full, it stays full until time is up.", "For 5 seconds after the signal, every swing slices the straw target from the top down.", "Keep swinging short and fast, back and forth.", "How many pieces can you cut one target into? Slice it all the way down for ALL CUT."],
    sound: 'SOUND', on: 'ON', off: 'OFF', lang: 'LANGUAGE', close: 'CLOSE', back: 'TITLE',
    motionOff: 'Motion sensors are unavailable. Swipe mode is on.',
    statCuts: 'CUTS', statRate: 'PER SEC', time: 'TIME', combo: 'COMBO', perfects: 'PERFECT', maxCombo: 'MAX COMBO', shallow: 'SHALLOW',
    shareText: (n, r, t) => `I sliced one straw target into ${n} pieces in 5 seconds at a dojo at dusk!\nRank ${r} "${t}"\n#連続斬り #RENZOKUGIRI`,
    titles: ["Dull Blade", "Straw Shredder", "Dojo Trainee", "Ring Slicer", "Master of the Evening Calm", "Julienne Master", "Sword Saint", "Carver of Twilight"]
  },
  'zh-Hans': {
    name: ['连续', '斩'], sub: 'R E N Z O K U - G I R I',
    start: '开始', howto: '玩法', settings: '设置', best: '最佳纪录', unit: '块',
    ready: '架势', hold: '像握刀一样握住手机并保持静止。\n气满后开始', qi: '气',
    swipeHold: '长按屏幕蓄气即可开始。\n手指快速来回滑动斩击',
    warn: '请确认周围没有人或物品，并紧握手机后再挥动。',
    ok: '知道了', retry: '再来一次', share: '发布到X', save: '保存图片', newBest: '刷新纪录', rank: '等级',
    how: ["双手像握刀一样握住手机并保持静止，气就会蓄满。气一旦蓄满，会一直保持到时间结束。", "开始信号后的5秒内，每挥一次就从上往下切下一段草靶。", "诀窍是来回小幅快速地连续挥动。", "比一比能把一根草靶斩成多少块。斩到底就是“全断”。"],
    sound: '声音', on: '开', off: '关', lang: '语言', close: '关闭', back: '返回标题',
    motionOff: '无法使用动作传感器，已切换为手指模式',
    statCuts: '斩击', statRate: '每秒', time: 'TIME', combo: 'COMBO', perfects: '一闪', maxCombo: '最大连击', shallow: '太浅',
    shareText: (n, r, t) => `在黄昏的道场里，5秒内把一根草靶斩成了${n}块！\n等级${r}「${t}」\n#連続斬り`,
    titles: ["钝刀", "草屑匠", "道场练习生", "切片剑士", "夕凪剑豪", "细切达人", "剑圣", "刻断黄昏之人"]
  },
  'zh-Hant': {
    name: ['連續', '斬'], sub: 'R E N Z O K U - G I R I',
    start: '開始', howto: '玩法', settings: '設定', best: '最佳紀錄', unit: '塊',
    ready: '架勢', hold: '像握刀一樣握住手機並保持靜止。\n氣滿後開始', qi: '氣',
    swipeHold: '長按螢幕蓄氣即可開始。\n手指快速來回滑動斬擊',
    warn: '請確認周圍沒有人或物品，並緊握手機後再揮動。',
    ok: '知道了', retry: '再來一次', share: '發佈到X', save: '儲存圖片', newBest: '刷新紀錄', rank: '等級',
    how: ["雙手像握刀一樣握住手機並保持靜止，氣就會蓄滿。氣一旦蓄滿，會一直保持到時間結束。", "開始信號後的5秒內，每揮一次就從上往下切下一段草靶。", "訣竅是來回小幅快速地連續揮動。", "比一比能把一根草靶斬成多少塊。斬到底就是「全斷」。"],
    sound: '聲音', on: '開', off: '關', lang: '語言', close: '關閉', back: '返回標題',
    motionOff: '無法使用動作感測器，已切換為手指模式',
    statCuts: '斬擊', statRate: '每秒', time: 'TIME', combo: 'COMBO', perfects: '一閃', maxCombo: '最大連擊', shallow: '太淺',
    shareText: (n, r, t) => `在黃昏的道場裡，5秒內把一根草靶斬成了${n}塊！\n等級${r}「${t}」\n#連続斬り`,
    titles: ["鈍刀", "草屑匠", "道場練習生", "切片劍士", "夕凪劍豪", "細切達人", "劍聖", "刻斷黃昏之人"]
  },
  ko: {
    name: ['연속', '베기'], sub: 'R E N Z O K U - G I R I',
    start: '시작', howto: '플레이 방법', settings: '설정', best: '최고 기록', unit: '조각',
    ready: '자세', hold: '휴대폰을 칼처럼 쥐고 가만히 멈추세요.\n기가 가득 차면 시작합니다', qi: '기',
    swipeHold: '화면을 길게 눌러 기를 모으면 시작합니다.\n손가락을 좌우로 빠르게 왕복해 베세요',
    warn: '주변에 사람이나 물건이 없는지 확인하고 휴대폰을 꽉 쥔 채 휘두르세요.',
    ok: '알겠어요', retry: '다시 하기', share: 'X에 게시', save: '이미지 저장', newBest: '최고 기록 갱신', rank: '랭크',
    how: ["휴대폰을 두 손으로 칼처럼 쥐고 가만히 멈추면 기가 가득 찹니다. 한번 찬 기는 시간이 끝날 때까지 유지됩니다.", "시작 신호 후 5초 동안, 휘두를 때마다 짚단을 위에서부터 한 토막씩 벱니다.", "왕복하듯 짧고 빠르게 계속 휘두르는 것이 요령입니다.", "짚단 하나를 몇 조각으로 나눌 수 있는지 겨룹니다. 끝까지 베면 전단입니다."],
    sound: '사운드', on: '켜기', off: '끄기', lang: '언어', close: '닫기', back: '타이틀로',
    motionOff: '모션 센서를 사용할 수 없어 터치 모드로 전환했습니다',
    statCuts: '베기', statRate: '초당', time: 'TIME', combo: 'COMBO', perfects: '일섬', maxCombo: '최대 연격', shallow: '얕다',
    shareText: (n, r, t) => `해 질 녘 도장에서 짚단 하나를 5초 만에 ${n}조각으로 베었다!\n랭크 ${r} 「${t}」\n#連続斬り`,
    titles: ["무딘 칼", "짚 부스러기 장인", "도장 수련생", "토막 베기 검사", "저녁 바람의 검호", "채썰기 달인", "검성", "황혼을 새기는 자"]
  },
  fr: {
    name: ['RENZOKU', 'GIRI'], sub: 'C O U P E S   E N   S É R I E',
    start: 'JOUER', howto: 'COMMENT JOUER', settings: 'RÉGLAGES', best: 'RECORD', unit: 'MORCEAUX',
    ready: 'EN GARDE', hold: 'Tenez le téléphone comme un sabre et restez immobile.\nLa partie commence quand la concentration est pleine.', qi: 'CONCENTRATION',
    swipeHold: 'Restez appuyé pour vous concentrer et commencer.\nBalayez vite d’un côté à l’autre pour couper.',
    warn: 'Vérifiez qu’il n’y a personne ni aucun objet autour de vous et tenez fermement votre téléphone.',
    ok: 'COMPRIS', retry: 'REJOUER', share: 'PUBLIER SUR X', save: 'ENREGISTRER', newBest: 'NOUVEAU RECORD', rank: 'RANG',
    how: ["Tenez le téléphone à deux mains comme un sabre et restez immobile. Une fois pleine, la concentration le reste jusqu’à la fin.", "Pendant 5 secondes après le signal, chaque coup tranche la cible de paille de haut en bas.", "Enchaînez des coups courts et rapides, en va-et-vient.", "En combien de morceaux couperez-vous une seule cible ? Tranchez-la jusqu’au bout pour une COUPE TOTALE."],
    sound: 'SON', on: 'OUI', off: 'NON', lang: 'LANGUE', close: 'FERMER', back: 'TITRE',
    motionOff: 'Capteurs de mouvement indisponibles. Mode tactile activé.',
    statCuts: 'COUPES', statRate: 'PAR SEC', time: 'TEMPS', combo: 'COMBO', perfects: 'PARFAIT', maxCombo: 'COMBO MAX', shallow: 'TROP LÉGER',
    shareText: (n, r, t) => `J’ai tranché une cible de paille en ${n} morceaux en 5 secondes dans un dojo au crépuscule !\nRang ${r} « ${t} »\n#連続斬り #RENZOKUGIRI`,
    titles: ["Lame émoussée", "Broyeur de paille", "Élève du dojo", "Trancheur en rondelles", "Maître du calme du soir", "Maître de la julienne", "Saint du sabre", "Celui qui grave le crépuscule"]
  },
  de: {
    name: ['RENZOKU', 'GIRI'], sub: 'S C H N I T T S E R I E',
    start: 'START', howto: 'ANLEITUNG', settings: 'EINSTELLUNGEN', best: 'BESTWERT', unit: 'STÜCKE',
    ready: 'HALTUNG', hold: 'Halte das Handy wie ein Schwert und bleib ruhig.\nEs geht los, sobald der Fokus voll ist.', qi: 'FOKUS',
    swipeHold: 'Gedrückt halten, um Fokus zu sammeln und zu starten.\nSchnell hin und her wischen zum Schneiden.',
    warn: 'Achte darauf, dass keine Personen oder Gegenstände in der Nähe sind, und halte das Handy fest.',
    ok: 'VERSTANDEN', retry: 'NOCHMAL', share: 'AUF X POSTEN', save: 'BILD SPEICHERN', newBest: 'NEUER BESTWERT', rank: 'RANG',
    how: ["Halte das Handy mit beiden Händen wie ein Schwert und bleib ruhig. Ist der Fokus voll, bleibt er es bis zum Ende.", "5 Sekunden lang schneidet jeder Schwung die Strohmatte von oben nach unten in Scheiben.", "Schwinge kurz und schnell, immer hin und her.", "In wie viele Stücke schneidest du eine Matte? Bis ganz unten ergibt einen KOMPLETTSCHNITT."],
    sound: 'TON', on: 'AN', off: 'AUS', lang: 'SPRACHE', close: 'SCHLIESSEN', back: 'TITEL',
    motionOff: 'Bewegungssensoren nicht verfügbar. Wischmodus aktiv.',
    statCuts: 'SCHNITTE', statRate: 'PRO SEK', time: 'ZEIT', combo: 'COMBO', perfects: 'PERFEKT', maxCombo: 'MAX COMBO', shallow: 'ZU FLACH',
    shareText: (n, r, t) => `Ich habe eine Strohmatte in 5 Sekunden in ${n} Stücke geschnitten, im Dojo bei Abenddämmerung!\nRang ${r} „${t}“\n#連続斬り #RENZOKUGIRI`,
    titles: ["Stumpfe Klinge", "Strohhäcksler", "Dojo-Schüler", "Scheibenschneider", "Meister der Abendstille", "Meister der feinen Streifen", "Schwertheiliger", "Der die Dämmerung zerschneidet"]
  },
  ru: {
    name: ['РЭНДЗОКУ', 'ГИРИ'], sub: 'С Е Р И Я   У Д А Р О В',
    start: 'НАЧАТЬ', howto: 'КАК ИГРАТЬ', settings: 'НАСТРОЙКИ', best: 'РЕКОРД', unit: 'КУСКОВ',
    ready: 'СТОЙКА', hold: 'Держите телефон как меч и замрите.\nИгра начнётся, когда фокус наполнится.', qi: 'ФОКУС',
    swipeHold: 'Удерживайте палец, чтобы набрать фокус и начать.\nБыстро водите пальцем туда-обратно, чтобы рубить.',
    warn: 'Убедитесь, что рядом нет людей и предметов, и крепко держите телефон.',
    ok: 'ПОНЯТНО', retry: 'ЕЩЁ РАЗ', share: 'ОПУБЛИКОВАТЬ В X', save: 'СОХРАНИТЬ', newBest: 'НОВЫЙ РЕКОРД', rank: 'РАНГ',
    how: ["Держите телефон двумя руками как меч и замрите. Наполненный фокус сохраняется до конца времени.", "5 секунд после сигнала каждый взмах срезает кусок мишени сверху вниз.", "Машите коротко и быстро, туда и обратно.", "На сколько кусков вы разрубите одну мишень? Разрубите до конца — ПОЛНЫЙ РАЗРУБ."],
    sound: 'ЗВУК', on: 'ВКЛ', off: 'ВЫКЛ', lang: 'ЯЗЫК', close: 'ЗАКРЫТЬ', back: 'В МЕНЮ',
    motionOff: 'Датчики движения недоступны. Включён режим касания.',
    statCuts: 'УДАРЫ', statRate: 'В СЕК', time: 'ВРЕМЯ', combo: 'КОМБО', perfects: 'ИДЕАЛЬНО', maxCombo: 'МАКС. КОМБО', shallow: 'СЛАБО',
    shareText: (n, r, t) => `Я разрубил одну соломенную мишень на ${n} кусков за 5 секунд в додзё на закате!\nРанг ${r} «${t}»\n#連続斬り #RENZOKUGIRI`,
    titles: ["Тупой клинок", "Измельчитель соломы", "Ученик додзё", "Резчик кружков", "Мастер вечерней тишины", "Мастер соломки", "Святой меча", "Высекающий сумерки"]
  },
  it: {
    name: ['RENZOKU', 'GIRI'], sub: 'T A G L I   I N   S E R I E',
    start: 'GIOCA', howto: 'COME SI GIOCA', settings: 'IMPOSTAZIONI', best: 'RECORD', unit: 'PEZZI',
    ready: 'IN GUARDIA', hold: 'Impugna il telefono come una spada e resta immobile.\nSi parte quando la concentrazione è piena.', qi: 'CONCENTRAZIONE',
    swipeHold: 'Tieni premuto per concentrarti e iniziare.\nScorri veloce avanti e indietro per tagliare.',
    warn: 'Assicurati che intorno a te non ci siano persone o oggetti e stringi bene il telefono.',
    ok: 'HO CAPITO', retry: 'RIPROVA', share: 'PUBBLICA SU X', save: 'SALVA IMMAGINE', newBest: 'NUOVO RECORD', rank: 'GRADO',
    how: ["Impugna il telefono con due mani come una spada e resta immobile. Una volta piena, la concentrazione resta tale fino alla fine.", "Per 5 secondi dal segnale, ogni fendente affetta il bersaglio di paglia dall’alto verso il basso.", "Colpi brevi e rapidi, avanti e indietro.", "In quanti pezzi taglierai un solo bersaglio? Affettalo fino in fondo per un TAGLIO TOTALE."],
    sound: 'AUDIO', on: 'SÌ', off: 'NO', lang: 'LINGUA', close: 'CHIUDI', back: 'TITOLO',
    motionOff: 'Sensori di movimento non disponibili. Modalità tocco attiva.',
    statCuts: 'COLPI', statRate: 'AL SEC', time: 'TEMPO', combo: 'COMBO', perfects: 'PERFETTI', maxCombo: 'COMBO MAX', shallow: 'SUPERFICIALE',
    shareText: (n, r, t) => `Ho tagliato un bersaglio di paglia in ${n} pezzi in 5 secondi in un dojo al tramonto!\nGrado ${r} «${t}»\n#連続斬り #RENZOKUGIRI`,
    titles: ["Lama spuntata", "Trituratore di paglia", "Allievo del dojo", "Affettatore", "Maestro della quiete serale", "Maestro della julienne", "Santo della spada", "Colui che incide il crepuscolo"]
  }
};
const LANG_NAMES = { ja: '日本語', en: 'English', 'zh-Hans': '简体中文', 'zh-Hant': '繁體中文', ko: '한국어', fr: 'Français', de: 'Deutsch', ru: 'Русский', it: 'Italiano' };
function detectLang() {
  try { const s = localStorage.getItem('rz_lang'); if (s && I18N[s]) return s; } catch (e) {}
  const n = (navigator.language || 'ja').toLowerCase();
  if (n.startsWith('ja')) return 'ja';
  if (n.startsWith('zh')) return (n.includes('tw') || n.includes('hk') || n.includes('hant') || n.includes('mo')) ? 'zh-Hant' : 'zh-Hans';
  for (const k of ['ko', 'fr', 'de', 'ru', 'it', 'en']) if (n.startsWith(k)) return k;
  return 'en';
}
