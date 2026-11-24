// 居合切り i18n
const I18N = {
  ja: {
    name: ['居合', '切り'], sub: 'I A I - G I R I',
    start: 'はじめる', howto: '遊び方', settings: '設定', best: '自己ベスト', unit: '本',
    ready: '構える', hold: 'スマホを刀のように構えて静止', qi: '気', draw: '振り抜け',
    swipeHold: '画面を長押しして気を溜め、素早くスワイプで斬る',
    warn: '周囲に人や物がないことを確認し、スマホをしっかり握って振ってください。',
    ok: 'わかった', retry: 'もう一度', share: 'Xに投稿', save: '画像を保存', newBest: '自己ベスト更新', rank: 'ランク',
    how: ['スマホを刀のように両手で構え、静かに静止して「気」を溜める。', '気が満ちて光った瞬間に、スマホを勢いよく振り抜く。', '振りが鋭いほど、斬撃は竹林の奥まで届く。光っている間に振れば「一閃」。'],
    sound: '音', on: 'オン', off: 'オフ', lang: '言語', close: '閉じる', back: 'タイトルへ',
    motionOff: 'モーションセンサーが使えないため、指モードで遊べます',
    shareText: (n, r, t) => `居合切りで竹を${n}本斬った！\nランク${r}「${t}」\n#居合切り`,
    titles: ['素振り見習い', '竹取りの翁', '竹林の門下生', '一刀の剣士', '月下の剣豪', '竹林無双', '剣聖', '月をも断つ者'],
    cuts: n => `${n}本`
  },
  en: {
    name: ['IAI', 'GIRI'], sub: 'B A M B O O   D R A W - C U T',
    start: 'START', howto: 'HOW TO PLAY', settings: 'SETTINGS', best: 'BEST', unit: 'CUTS',
    ready: 'READY', hold: 'Hold your phone like a sword and stay still', qi: 'FOCUS', draw: 'SWING',
    swipeHold: 'Press and hold to focus, then swipe fast to slash',
    warn: 'Make sure the area around you is clear, and grip your phone firmly before swinging.',
    ok: 'GOT IT', retry: 'RETRY', share: 'POST TO X', save: 'SAVE IMAGE', newBest: 'NEW BEST', rank: 'RANK',
    how: ['Hold your phone with both hands like a sword. Stay still to build focus.', 'The moment the focus glows, swing your phone hard.', 'The sharper the swing, the deeper the slash travels. Swing while it glows for a perfect cut.'],
    sound: 'SOUND', on: 'ON', off: 'OFF', lang: 'LANGUAGE', close: 'CLOSE', back: 'TITLE',
    motionOff: 'Motion sensors are unavailable. Swipe mode is on.',
    shareText: (n, r, t) => `I cut ${n} bamboo in one draw!\nRank ${r} "${t}"\n#居合切り #IAIGIRI`,
    titles: ['Practice Swinger', 'Old Bamboo Cutter', 'Grove Apprentice', 'One-Stroke Swordsman', 'Moonlit Master', 'Peerless of the Grove', 'Grandmaster of the Blade', 'Cleaver of the Moon'],
    cuts: n => `${n} CUTS`
  },
  'zh-Hans': {
    name: ['居合', '斩'], sub: 'I A I - G I R I',
    start: '开始', howto: '玩法', settings: '设置', best: '最佳纪录', unit: '根',
    ready: '架势', hold: '像握刀一样握住手机并保持静止', qi: '气', draw: '挥刀',
    swipeHold: '长按屏幕蓄气，然后快速滑动斩击',
    warn: '请确认周围没有人或物品，并紧握手机后再挥动。',
    ok: '知道了', retry: '再来一次', share: '发布到X', save: '保存图片', newBest: '刷新纪录', rank: '等级',
    how: ['双手像握刀一样握住手机，保持静止来蓄“气”。', '气满发光的瞬间，用力挥动手机。', '挥得越快，斩击越能深入竹林。发光时挥动即为“一闪”。'],
    sound: '声音', on: '开', off: '关', lang: '语言', close: '关闭', back: '返回标题',
    motionOff: '无法使用动作传感器，已切换为手指模式',
    shareText: (n, r, t) => `我用居合斩斩断了${n}根竹子！\n等级${r}「${t}」\n#居合切り`,
    titles: ['挥空见习生', '伐竹老翁', '竹林门生', '一刀剑士', '月下剑豪', '竹林无双', '剑道宗师', '斩月之人'],
    cuts: n => `${n}根`
  },
  'zh-Hant': {
    name: ['居合', '斬'], sub: 'I A I - G I R I',
    start: '開始', howto: '玩法', settings: '設定', best: '最佳紀錄', unit: '根',
    ready: '架勢', hold: '像握刀一樣握住手機並保持靜止', qi: '氣', draw: '揮刀',
    swipeHold: '長按螢幕蓄氣，然後快速滑動斬擊',
    warn: '請確認周圍沒有人或物品，並緊握手機後再揮動。',
    ok: '知道了', retry: '再來一次', share: '發佈到X', save: '儲存圖片', newBest: '刷新紀錄', rank: '等級',
    how: ['雙手像握刀一樣握住手機，保持靜止來蓄「氣」。', '氣滿發光的瞬間，用力揮動手機。', '揮得越快，斬擊越能深入竹林。發光時揮動即為「一閃」。'],
    sound: '聲音', on: '開', off: '關', lang: '語言', close: '關閉', back: '返回標題',
    motionOff: '無法使用動作感測器，已切換為手指模式',
    shareText: (n, r, t) => `我用居合斬斬斷了${n}根竹子！\n等級${r}「${t}」\n#居合切り`,
    titles: ['揮空見習生', '伐竹老翁', '竹林門生', '一刀劍士', '月下劍豪', '竹林無雙', '劍道宗師', '斬月之人'],
    cuts: n => `${n}根`
  },
  ko: {
    name: ['이아이', '기리'], sub: 'I A I - G I R I',
    start: '시작', howto: '플레이 방법', settings: '설정', best: '최고 기록', unit: '그루',
    ready: '자세', hold: '휴대폰을 칼처럼 쥐고 가만히 멈추세요', qi: '기', draw: '베어라',
    swipeHold: '화면을 길게 눌러 기를 모으고 빠르게 스와이프해 베세요',
    warn: '주변에 사람이나 물건이 없는지 확인하고 휴대폰을 꽉 쥔 채 휘두르세요.',
    ok: '알겠어요', retry: '다시 하기', share: 'X에 게시', save: '이미지 저장', newBest: '최고 기록 갱신', rank: '랭크',
    how: ['휴대폰을 두 손으로 칼처럼 쥐고 가만히 멈춰 기를 모으세요.', '기가 가득 차 빛나는 순간, 휴대폰을 힘차게 휘두르세요.', '빠르게 휘두를수록 참격이 대숲 깊이 닿습니다. 빛날 때 휘두르면 일섬.'],
    sound: '소리', on: '켜기', off: '끄기', lang: '언어', close: '닫기', back: '타이틀로',
    motionOff: '모션 센서를 사용할 수 없어 손가락 모드로 플레이합니다',
    shareText: (n, r, t) => `이아이기리로 대나무 ${n}그루를 베었다!\n랭크 ${r} 「${t}」\n#居合切り`,
    titles: ['헛스윙 수련생', '대나무 베는 노인', '죽림의 문하생', '일도의 검사', '월하의 검호', '죽림무쌍', '검의 대가', '달마저 베는 자'],
    cuts: n => `${n}그루`
  },
  fr: {
    name: ['IAI', 'GIRI'], sub: 'B A M B O U   D É G A I N É',
    start: 'JOUER', howto: 'COMMENT JOUER', settings: 'RÉGLAGES', best: 'RECORD', unit: 'COUPES',
    ready: 'EN GARDE', hold: 'Tenez votre téléphone comme un sabre et restez immobile', qi: 'CONCENTRATION', draw: 'TRANCHEZ',
    swipeHold: 'Maintenez appuyé pour vous concentrer, puis balayez vite pour trancher',
    warn: 'Vérifiez que personne ni rien ne se trouve autour de vous et tenez fermement votre téléphone.',
    ok: 'COMPRIS', retry: 'REJOUER', share: 'PUBLIER SUR X', save: 'ENREGISTRER', newBest: 'NOUVEAU RECORD', rank: 'RANG',
    how: ['Tenez le téléphone à deux mains comme un sabre et restez immobile.', 'Dès que la concentration brille, balancez le téléphone avec force.', 'Plus le geste est vif, plus la coupe va loin. Pendant la lueur : coupe parfaite.'],
    sound: 'SON', on: 'OUI', off: 'NON', lang: 'LANGUE', close: 'FERMER', back: 'TITRE',
    motionOff: 'Capteurs de mouvement indisponibles. Mode tactile activé.',
    shareText: (n, r, t) => `J'ai tranché ${n} bambous d'un seul coup !\nRang ${r} « ${t} »\n#居合切り #IAIGIRI`,
    titles: ['Apprenti du vent', 'Vieux coupeur de bambou', 'Disciple du bosquet', "Sabreur d'un trait", 'Maître au clair de lune', 'Sans égal du bosquet', 'Grand maître de la lame', 'Celui qui tranche la lune'],
    cuts: n => `${n} COUPES`
  },
  de: {
    name: ['IAI', 'GIRI'], sub: 'B A M B U S - S C H N I T T',
    start: 'START', howto: 'SPIELANLEITUNG', settings: 'EINSTELLUNGEN', best: 'BESTWERT', unit: 'SCHNITTE',
    ready: 'BEREIT', hold: 'Halte dein Handy wie ein Schwert und bleib ganz ruhig', qi: 'FOKUS', draw: 'ZIEH DURCH',
    swipeHold: 'Gedrückt halten zum Fokussieren, dann schnell wischen',
    warn: 'Achte darauf, dass niemand und nichts in der Nähe ist, und halte dein Handy gut fest.',
    ok: 'VERSTANDEN', retry: 'NOCHMAL', share: 'AUF X POSTEN', save: 'BILD SPEICHERN', newBest: 'NEUER BESTWERT', rank: 'RANG',
    how: ['Halte das Handy mit beiden Händen wie ein Schwert und bleib ruhig.', 'Sobald der Fokus leuchtet, schwing das Handy kräftig durch.', 'Je schärfer der Schwung, desto weiter reicht der Schnitt. Beim Leuchten: perfekter Schnitt.'],
    sound: 'TON', on: 'AN', off: 'AUS', lang: 'SPRACHE', close: 'SCHLIESSEN', back: 'TITEL',
    motionOff: 'Bewegungssensoren nicht verfügbar. Wischmodus aktiv.',
    shareText: (n, r, t) => `Ich habe ${n} Bambusrohre mit einem Hieb geschnitten!\nRang ${r} „${t}“\n#居合切り #IAIGIRI`,
    titles: ['Luftschlag-Lehrling', 'Alter Bambusschneider', 'Schüler des Hains', 'Schwertkämpfer des einen Hiebs', 'Meister im Mondlicht', 'Unbesiegt im Hain', 'Großmeister der Klinge', 'Der den Mond zerteilt'],
    cuts: n => `${n} SCHNITTE`
  },
  ru: {
    name: ['ИАЙ', 'ГИРИ'], sub: 'I A I - G I R I',
    start: 'НАЧАТЬ', howto: 'КАК ИГРАТЬ', settings: 'НАСТРОЙКИ', best: 'РЕКОРД', unit: 'СТЕБЛЕЙ',
    ready: 'СТОЙКА', hold: 'Держите телефон как меч и замрите', qi: 'ФОКУС', draw: 'РУБИ',
    swipeHold: 'Удерживайте палец для фокуса, затем быстро проведите',
    warn: 'Убедитесь, что рядом нет людей и предметов, и крепко держите телефон.',
    ok: 'ПОНЯТНО', retry: 'ЕЩЁ РАЗ', share: 'ОПУБЛИКОВАТЬ В X', save: 'СОХРАНИТЬ', newBest: 'НОВЫЙ РЕКОРД', rank: 'РАНГ',
    how: ['Держите телефон двумя руками как меч и замрите, чтобы набрать фокус.', 'Когда фокус засияет, резко взмахните телефоном.', 'Чем резче взмах, тем дальше удар. Взмах во время сияния — идеальный удар.'],
    sound: 'ЗВУК', on: 'ВКЛ', off: 'ВЫКЛ', lang: 'ЯЗЫК', close: 'ЗАКРЫТЬ', back: 'В МЕНЮ',
    motionOff: 'Датчики движения недоступны. Включён режим касания.',
    shareText: (n, r, t) => `Я срубил ${n} стеблей бамбука одним ударом!\nРанг ${r} «${t}»\n#居合切り #IAIGIRI`,
    titles: ['Ученик взмаха', 'Старый резчик бамбука', 'Ученик рощи', 'Мечник одного удара', 'Мастер под луной', 'Непревзойдённый в роще', 'Великий мастер клинка', 'Рассекающий луну'],
    cuts: n => `${n} СТЕБЛЕЙ`
  },
  it: {
    name: ['IAI', 'GIRI'], sub: 'T A G L I O   D I   B A M B Ù',
    start: 'GIOCA', howto: 'COME SI GIOCA', settings: 'IMPOSTAZIONI', best: 'RECORD', unit: 'TAGLI',
    ready: 'IN GUARDIA', hold: 'Impugna il telefono come una spada e resta immobile', qi: 'CONCENTRAZIONE', draw: 'COLPISCI',
    swipeHold: 'Tieni premuto per concentrarti, poi scorri veloce per tagliare',
    warn: 'Assicurati che intorno a te non ci siano persone o oggetti e stringi bene il telefono.',
    ok: 'HO CAPITO', retry: 'RIPROVA', share: 'PUBBLICA SU X', save: 'SALVA IMMAGINE', newBest: 'NUOVO RECORD', rank: 'GRADO',
    how: ['Impugna il telefono con due mani come una spada e resta immobile.', 'Appena la concentrazione brilla, fendi l’aria con forza.', 'Più il colpo è rapido, più lontano arriva il taglio. Durante il bagliore: taglio perfetto.'],
    sound: 'AUDIO', on: 'SÌ', off: 'NO', lang: 'LINGUA', close: 'CHIUDI', back: 'TITOLO',
    motionOff: 'Sensori di movimento non disponibili. Modalità tocco attiva.',
    shareText: (n, r, t) => `Ho tagliato ${n} bambù con un solo colpo!\nGrado ${r} «${t}»\n#居合切り #IAIGIRI`,
    titles: ['Apprendista del vento', 'Vecchio tagliatore di bambù', 'Discepolo del boschetto', 'Spadaccino del colpo unico', 'Maestro al chiaro di luna', 'Imbattibile del boschetto', 'Gran maestro della lama', 'Colui che fende la luna'],
    cuts: n => `${n} TAGLI`
  }
};
const LANG_NAMES = { ja: '日本語', en: 'English', 'zh-Hans': '简体中文', 'zh-Hant': '繁體中文', ko: '한국어', fr: 'Français', de: 'Deutsch', ru: 'Русский', it: 'Italiano' };
function detectLang() {
  try { const s = localStorage.getItem('iai_lang'); if (s && I18N[s]) return s; } catch (e) {}
  const n = (navigator.language || 'ja').toLowerCase();
  if (n.startsWith('ja')) return 'ja';
  if (n.startsWith('zh')) return (n.includes('tw') || n.includes('hk') || n.includes('hant') || n.includes('mo')) ? 'zh-Hant' : 'zh-Hans';
  for (const k of ['ko', 'fr', 'de', 'ru', 'it', 'en']) if (n.startsWith(k)) return k;
  return 'en';
}
