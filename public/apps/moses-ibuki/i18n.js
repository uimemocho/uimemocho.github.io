// 9言語（日本語・英語・簡体字・繁体字・韓国語・フランス語・ドイツ語・ロシア語・イタリア語）
const D = {};
D.ja = {
  name: 'モーゼの息吹', tA: 'モーゼの', tB: '息吹', sub: 'BREATH OF MOSES',
  play: '海を割る', howto: '遊び方', settings: '設定', close: 'とじる', back: 'もどる', toTitle: 'タイトルへ', best: 'BEST',
  micNote: 'マイクで息の音を聞きます。録音・送信はしません', micAsk: 'マイクの使用を許可してください',
  calib: 'まわりの音を測っています。静かに', blowCut: '吹け', blowHint: 'スマホ下のマイクに、ひと息で長く強く', blowSub: '声ではなく、息の音で海が割れる',
  holdHint: '画面を連打して息を吹く', finger: '指連打モード', mic: 'マイク', input: '入力', noMic: 'マイクが使えないため、指連打モードで遊びます',
  noBreath: '息が聞こえません。マイクに口を近づけて', sustain: '持続', breath: '息', split: '割れた距離', limit: '残り',
  lead: 'ひと息で割れた海', statSec: '息の長さ', sec: '秒', statPeak: '最大の息圧', statMult: '最大倍率', share: 'Xに投稿', again: 'もう一度割る',
  newBest: '自己ベスト更新', shareSheet: '投稿用の画像', saveHint: '画像を長押しで保存して、投稿に添付してください', openX: 'Xの投稿画面を開く',
  copyText: '投稿文をコピー', copied: 'コピーしました', saved: '画像を保存しました。投稿に添付してください',
  shareText: 'モーゼの息吹で、ひと息で海を{dist}割った\nランク{rank}「{title}」／息{sec}秒{mode}',
  how1: 'スマホの下側にあるマイクに向かって、ひと息で吹きかけます。声や口笛ではなく、息の音で海が割れます。',
  how2: '強い息を長く保つほど「持続」の倍率が上がり、割れる速さが一気に伸びます。息が途切れたら終わりです。',
  how3: 'ランクはE〜SSS。最高ランクは対岸まで届いたときです。結果は画像つきでXに投稿できます。',
  how4: 'マイクが使えない環境では、画面を連打して遊ぶ指連打モードになります。速く連打し続けるほど強い息になります（記録に指連打モードと表示されます）。',
  se: '効果音', bgm: 'BGM', vib: '振動', quality: '高画質', lang: '言語', on: 'ON', off: 'OFF', pause: '一時停止',
  'r.E': '水たまり', 'r.D': '波打ちぎわ', 'r.C': '潮だまり', 'r.B': '浅瀬の道', 'r.A': '沖への道', 'r.S': '海峡越え', 'r.SS': '水平線の向こう', 'r.SSS': '対岸到達',
};
D.en = {
  name: 'Breath of Moses', tA: 'BREATH OF', tB: 'MOSES', sub: 'ONE BREATH · PART THE SEA',
  play: 'Part the sea', howto: 'How to play', settings: 'Settings', close: 'Close', back: 'Back', toTitle: 'Title', best: 'BEST',
  micNote: 'Listens to your breath. Nothing is recorded or sent.', micAsk: 'Please allow microphone access',
  calib: 'Measuring room noise. Stay quiet', blowCut: 'BLOW', blowHint: 'Blow into the mic at the bottom of your phone. One long, strong breath', blowSub: 'Breath parts the sea, not your voice',
  holdHint: 'Tap rapidly to blow', finger: 'Tap mode', mic: 'Mic', input: 'Input', noMic: 'Microphone unavailable. Playing in tap mode',
  noBreath: 'No breath heard. Bring the mic closer', sustain: 'SUSTAIN', breath: 'BREATH', split: 'Parted', limit: 'Left',
  lead: 'Sea parted in one breath', statSec: 'Breath length', sec: 's', statPeak: 'Peak breath', statMult: 'Max boost', share: 'Post on X', again: 'Part it again',
  newBest: 'New personal best', shareSheet: 'Image to post', saveHint: 'Long-press the image to save it, then attach it to your post', openX: 'Open X',
  copyText: 'Copy post text', copied: 'Copied', saved: 'Image saved. Attach it to your post',
  shareText: 'I parted the sea {dist} in one breath in Breath of Moses\nRank {rank} "{title}" / {sec}s breath{mode}',
  how1: 'Blow into the microphone at the bottom of your phone in a single breath. Breath noise parts the sea, not voice or whistling.',
  how2: 'Keep a strong breath going and the SUSTAIN boost climbs, speeding the split dramatically. It ends when your breath stops.',
  how3: 'Ranks go from E to SSS. The top rank means you reached the far shore. Post your result with an image on X.',
  how4: 'Without a microphone you play in tap mode: tap the screen rapidly. The faster you keep tapping, the stronger the breath (shown on your record).',
  se: 'Sound effects', bgm: 'Music', vib: 'Vibration', quality: 'High quality', lang: 'Language', on: 'ON', off: 'OFF', pause: 'Pause',
  'r.E': 'Puddle', 'r.D': 'Shoreline', 'r.C': 'Tide pool', 'r.B': 'Shallow path', 'r.A': 'Path offshore', 'r.S': 'Across the strait', 'r.SS': 'Beyond the horizon', 'r.SSS': 'Far shore reached',
};
D['zh-Hans'] = {
  name: '摩西之息', tA: '摩西之', tB: '息', sub: 'BREATH OF MOSES',
  play: '分开大海', howto: '玩法', settings: '设置', close: '关闭', back: '返回', toTitle: '标题', best: 'BEST',
  micNote: '通过麦克风听呼气声，不会录音或发送', micAsk: '请允许使用麦克风',
  calib: '正在测量环境声音，请保持安静', blowCut: '吹', blowHint: '对着手机底部的麦克风，一口气用力长吹', blowSub: '分开大海的是气息，不是声音',
  holdHint: '连续点击屏幕吹气', finger: '连打模式', mic: '麦克风', input: '输入', noMic: '无法使用麦克风，改用连打模式',
  noBreath: '听不到气息，请把嘴靠近麦克风', sustain: '持续', breath: '气息', split: '分开距离', limit: '剩余',
  lead: '一口气分开的大海', statSec: '气息长度', sec: '秒', statPeak: '最大气压', statMult: '最大倍率', share: '发布到X', again: '再分一次',
  newBest: '刷新个人最佳', shareSheet: '发布用图片', saveHint: '长按图片保存，然后附加到帖子中', openX: '打开X发布页面',
  copyText: '复制发布文字', copied: '已复制', saved: '图片已保存，请附加到帖子中',
  shareText: '在《摩西之息》中一口气把大海分开了{dist}\n等级{rank}「{title}」／气息{sec}秒{mode}',
  how1: '对着手机底部的麦克风一口气吹。分开大海的是呼气声，不是说话或口哨。',
  how2: '强劲的气息保持越久，“持续”倍率越高，分开速度急剧加快。气息一断就结束。',
  how3: '等级从E到SSS。最高等级代表到达对岸。结果可以带图片发布到X。',
  how4: '无法使用麦克风时，会进入连续点击屏幕的连打模式。点得越快越持久，气息越强（记录中会标注）。',
  se: '音效', bgm: '音乐', vib: '振动', quality: '高画质', lang: '语言', on: 'ON', off: 'OFF', pause: '暂停',
  'r.E': '水洼', 'r.D': '浪花边', 'r.C': '潮池', 'r.B': '浅滩之路', 'r.A': '通往远海', 'r.S': '跨越海峡', 'r.SS': '地平线彼方', 'r.SSS': '抵达对岸',
};
D['zh-Hant'] = {
  name: '摩西之息', tA: '摩西之', tB: '息', sub: 'BREATH OF MOSES',
  play: '分開大海', howto: '玩法', settings: '設定', close: '關閉', back: '返回', toTitle: '標題', best: 'BEST',
  micNote: '透過麥克風聽呼氣聲，不會錄音或傳送', micAsk: '請允許使用麥克風',
  calib: '正在測量環境聲音，請保持安靜', blowCut: '吹', blowHint: '對著手機底部的麥克風，一口氣用力長吹', blowSub: '分開大海的是氣息，不是聲音',
  holdHint: '連續點擊螢幕吹氣', finger: '連打模式', mic: '麥克風', input: '輸入', noMic: '無法使用麥克風，改用連打模式',
  noBreath: '聽不到氣息，請把嘴靠近麥克風', sustain: '持續', breath: '氣息', split: '分開距離', limit: '剩餘',
  lead: '一口氣分開的大海', statSec: '氣息長度', sec: '秒', statPeak: '最大氣壓', statMult: '最大倍率', share: '發布到X', again: '再分一次',
  newBest: '刷新個人最佳', shareSheet: '發布用圖片', saveHint: '長按圖片儲存，然後附加到貼文中', openX: '開啟X發文頁面',
  copyText: '複製貼文文字', copied: '已複製', saved: '圖片已儲存，請附加到貼文中',
  shareText: '在《摩西之息》中一口氣把大海分開了{dist}\n等級{rank}「{title}」／氣息{sec}秒{mode}',
  how1: '對著手機底部的麥克風一口氣吹。分開大海的是呼氣聲，不是說話或口哨。',
  how2: '強勁的氣息維持越久，「持續」倍率越高，分開速度急劇加快。氣息一斷就結束。',
  how3: '等級從E到SSS。最高等級代表抵達對岸。結果可以附圖片發布到X。',
  how4: '無法使用麥克風時，會進入連續點擊螢幕的連打模式。點得越快越持久，氣息越強（紀錄中會標示）。',
  se: '音效', bgm: '音樂', vib: '震動', quality: '高畫質', lang: '語言', on: 'ON', off: 'OFF', pause: '暫停',
  'r.E': '水窪', 'r.D': '浪花邊', 'r.C': '潮池', 'r.B': '淺灘之路', 'r.A': '通往遠海', 'r.S': '跨越海峽', 'r.SS': '地平線彼方', 'r.SSS': '抵達對岸',
};
D.ko = {
  name: '모세의 숨결', tA: '모세의', tB: '숨결', sub: 'BREATH OF MOSES',
  play: '바다 가르기', howto: '플레이 방법', settings: '설정', close: '닫기', back: '뒤로', toTitle: '타이틀로', best: 'BEST',
  micNote: '마이크로 숨소리를 듣습니다. 녹음이나 전송은 하지 않습니다', micAsk: '마이크 사용을 허용해 주세요',
  calib: '주변 소리를 측정 중입니다. 조용히', blowCut: '불어라', blowHint: '휴대폰 아래쪽 마이크에 한 번의 숨으로 길고 강하게', blowSub: '목소리가 아니라 숨소리로 바다가 갈라진다',
  holdHint: '화면을 연타해서 숨 불기', finger: '연타 모드', mic: '마이크', input: '입력', noMic: '마이크를 쓸 수 없어 연타 모드로 플레이합니다',
  noBreath: '숨소리가 들리지 않습니다. 마이크에 입을 가까이', sustain: '지속', breath: '숨', split: '갈라진 거리', limit: '남은 시간',
  lead: '한 번의 숨으로 갈라진 바다', statSec: '숨의 길이', sec: '초', statPeak: '최대 숨 세기', statMult: '최대 배율', share: 'X에 게시', again: '다시 가르기',
  newBest: '개인 최고 기록 갱신', shareSheet: '게시용 이미지', saveHint: '이미지를 길게 눌러 저장한 뒤 게시물에 첨부하세요', openX: 'X 게시 화면 열기',
  copyText: '게시 문구 복사', copied: '복사했습니다', saved: '이미지를 저장했습니다. 게시물에 첨부하세요',
  shareText: '모세의 숨결에서 한 번의 숨으로 바다를 {dist} 갈랐다\n랭크 {rank}「{title}」／숨 {sec}초{mode}',
  how1: '휴대폰 아래쪽 마이크를 향해 한 번의 숨으로 붑니다. 목소리나 휘파람이 아닌 숨소리로 바다가 갈라집니다.',
  how2: '강한 숨을 오래 유지할수록 지속 배율이 올라가 갈라지는 속도가 크게 늘어납니다. 숨이 끊기면 끝입니다.',
  how3: '랭크는 E~SSS. 최고 랭크는 건너편 해안에 닿았을 때입니다. 결과는 이미지와 함께 X에 게시할 수 있습니다.',
  how4: '마이크를 쓸 수 없는 환경에서는 화면을 연타하는 연타 모드가 됩니다. 빠르게 계속 연타할수록 숨이 강해집니다(기록에 표시됩니다).',
  se: '효과음', bgm: '음악', vib: '진동', quality: '고화질', lang: '언어', on: 'ON', off: 'OFF', pause: '일시정지',
  'r.E': '물웅덩이', 'r.D': '파도 끝자락', 'r.C': '조수 웅덩이', 'r.B': '여울길', 'r.A': '먼바다로 가는 길', 'r.S': '해협 너머', 'r.SS': '수평선 너머', 'r.SSS': '건너편 해안 도착',
};
D.fr = {
  name: 'Le Souffle de Moïse', tA: 'LE SOUFFLE DE', tB: 'MOÏSE', sub: 'UN SOUFFLE · OUVRIR LA MER',
  play: 'Ouvrir la mer', howto: 'Comment jouer', settings: 'Réglages', close: 'Fermer', back: 'Retour', toTitle: 'Titre', best: 'RECORD',
  micNote: 'Écoute votre souffle. Rien n’est enregistré ni envoyé.', micAsk: 'Autorisez l’accès au micro',
  calib: 'Mesure du bruit ambiant. Silence', blowCut: 'SOUFFLE', blowHint: 'Soufflez dans le micro en bas du téléphone, d’un seul souffle long et fort', blowSub: 'C’est le souffle qui ouvre la mer, pas la voix',
  holdHint: 'Tapotez vite pour souffler', finger: 'Mode tapotis', mic: 'Micro', input: 'Entrée', noMic: 'Micro indisponible. Mode tapotis activé',
  noBreath: 'Aucun souffle détecté. Approchez le micro', sustain: 'TENUE', breath: 'SOUFFLE', split: 'Ouverture', limit: 'Reste',
  lead: 'La mer ouverte d’un souffle', statSec: 'Durée du souffle', sec: 's', statPeak: 'Souffle max', statMult: 'Bonus max', share: 'Publier sur X', again: 'Rouvrir la mer',
  newBest: 'Nouveau record', shareSheet: 'Image à publier', saveHint: 'Appuyez longuement sur l’image pour l’enregistrer, puis joignez-la', openX: 'Ouvrir X',
  copyText: 'Copier le texte', copied: 'Copié', saved: 'Image enregistrée. Joignez-la à votre publication',
  shareText: 'J’ai ouvert la mer sur {dist} d’un seul souffle dans Le Souffle de Moïse\nRang {rank} « {title} » / souffle {sec} s{mode}',
  how1: 'Soufflez d’un seul trait dans le micro en bas du téléphone. C’est le bruit du souffle qui ouvre la mer, pas la voix ni le sifflement.',
  how2: 'Plus un souffle fort dure, plus le bonus de TENUE grimpe et l’ouverture accélère. Tout s’arrête quand le souffle cesse.',
  how3: 'Rangs de E à SSS. Le rang maximal signifie atteindre l’autre rive. Publiez votre résultat avec une image sur X.',
  how4: 'Sans micro, vous jouez en mode tapotis : tapotez l’écran très vite. Plus vous tapotez vite et longtemps, plus le souffle est fort (indiqué sur le résultat).',
  se: 'Effets sonores', bgm: 'Musique', vib: 'Vibration', quality: 'Haute qualité', lang: 'Langue', on: 'ON', off: 'OFF', pause: 'Pause',
  'r.E': 'Flaque', 'r.D': 'Bord de vague', 'r.C': 'Mare', 'r.B': 'Chemin des hauts-fonds', 'r.A': 'Vers le large', 'r.S': 'Par-delà le détroit', 'r.SS': 'Au-delà de l’horizon', 'r.SSS': 'Autre rive atteinte',
};
D.de = {
  name: 'Der Atem des Moses', tA: 'DER ATEM DES', tB: 'MOSES', sub: 'EIN ATEMZUG · DAS MEER TEILEN',
  play: 'Meer teilen', howto: 'Spielanleitung', settings: 'Einstellungen', close: 'Schließen', back: 'Zurück', toTitle: 'Titel', best: 'BEST',
  micNote: 'Hört deinen Atem. Nichts wird aufgenommen oder gesendet.', micAsk: 'Bitte Mikrofonzugriff erlauben',
  calib: 'Umgebungsgeräusch wird gemessen. Leise bitte', blowCut: 'PUSTE', blowHint: 'Puste in das Mikro unten am Handy. Ein langer, kräftiger Atemzug', blowSub: 'Der Atem teilt das Meer, nicht die Stimme',
  holdHint: 'Schnell tippen zum Pusten', finger: 'Tippmodus', mic: 'Mikro', input: 'Eingabe', noMic: 'Kein Mikrofon verfügbar. Tippmodus aktiv',
  noBreath: 'Kein Atem zu hören. Näher ans Mikro', sustain: 'AUSDAUER', breath: 'ATEM', split: 'Geteilt', limit: 'Rest',
  lead: 'Mit einem Atemzug geteilt', statSec: 'Atemdauer', sec: 's', statPeak: 'Max. Atem', statMult: 'Max. Bonus', share: 'Auf X posten', again: 'Nochmal teilen',
  newBest: 'Neuer Rekord', shareSheet: 'Bild zum Posten', saveHint: 'Bild lange drücken zum Speichern und an den Post anhängen', openX: 'X öffnen',
  copyText: 'Text kopieren', copied: 'Kopiert', saved: 'Bild gespeichert. Hänge es an deinen Post',
  shareText: 'Ich habe in Der Atem des Moses das Meer mit einem Atemzug {dist} weit geteilt\nRang {rank} „{title}“ / {sec} s Atem{mode}',
  how1: 'Puste mit einem Atemzug in das Mikrofon unten am Handy. Das Atemgeräusch teilt das Meer, nicht Stimme oder Pfeifen.',
  how2: 'Je länger ein kräftiger Atem anhält, desto höher steigt der AUSDAUER-Bonus und die Teilung beschleunigt sich. Ohne Atem ist Schluss.',
  how3: 'Ränge von E bis SSS. Der höchste Rang heißt: das andere Ufer erreicht. Poste dein Ergebnis mit Bild auf X.',
  how4: 'Ohne Mikrofon spielst du im Tippmodus: tippe schnell auf den Bildschirm. Je schneller und länger, desto stärker der Atem (wird im Ergebnis angezeigt).',
  se: 'Soundeffekte', bgm: 'Musik', vib: 'Vibration', quality: 'Hohe Qualität', lang: 'Sprache', on: 'AN', off: 'AUS', pause: 'Pause',
  'r.E': 'Pfütze', 'r.D': 'Brandungssaum', 'r.C': 'Gezeitentümpel', 'r.B': 'Pfad im Flachwasser', 'r.A': 'Weg aufs offene Meer', 'r.S': 'Über die Meerenge', 'r.SS': 'Hinter dem Horizont', 'r.SSS': 'Anderes Ufer erreicht',
};
D.ru = {
  name: 'Дыхание Моисея', tA: 'ДЫХАНИЕ', tB: 'МОИСЕЯ', sub: 'ОДИН ВЫДОХ · РАЗДЕЛИ МОРЕ',
  play: 'Разделить море', howto: 'Как играть', settings: 'Настройки', close: 'Закрыть', back: 'Назад', toTitle: 'В меню', best: 'РЕКОРД',
  micNote: 'Слушает ваше дыхание. Ничего не записывается и не отправляется.', micAsk: 'Разрешите доступ к микрофону',
  calib: 'Измеряем фоновый шум. Тише', blowCut: 'ДУЙ', blowHint: 'Подуйте в микрофон внизу телефона: один долгий сильный выдох', blowSub: 'Море разделяет дыхание, а не голос',
  holdHint: 'Быстро стучите по экрану, чтобы дуть', finger: 'Режим тапов', mic: 'Микрофон', input: 'Ввод', noMic: 'Микрофон недоступен. Включён режим тапов',
  noBreath: 'Дыхание не слышно. Поднесите микрофон ближе', sustain: 'ВЫДЕРЖКА', breath: 'ВЫДОХ', split: 'Разделено', limit: 'Осталось',
  lead: 'Море, разделённое одним выдохом', statSec: 'Длина выдоха', sec: 'с', statPeak: 'Макс. сила', statMult: 'Макс. бонус', share: 'Опубликовать в X', again: 'Ещё раз',
  newBest: 'Новый рекорд', shareSheet: 'Картинка для поста', saveHint: 'Нажмите и удерживайте картинку, чтобы сохранить, затем прикрепите к посту', openX: 'Открыть X',
  copyText: 'Скопировать текст', copied: 'Скопировано', saved: 'Картинка сохранена. Прикрепите её к посту',
  shareText: 'В «Дыхании Моисея» я разделил море на {dist} одним выдохом\nРанг {rank} «{title}» / выдох {sec} с{mode}',
  how1: 'Подуйте одним выдохом в микрофон внизу телефона. Море разделяет шум дыхания, а не голос или свист.',
  how2: 'Чем дольше держится сильный выдох, тем выше бонус ВЫДЕРЖКИ и тем быстрее расходится вода. Выдох закончился — конец.',
  how3: 'Ранги от E до SSS. Высший ранг — вы достигли другого берега. Результат с картинкой можно опубликовать в X.',
  how4: 'Без микрофона играйте в режиме тапов: часто стучите по экрану. Чем быстрее и дольше, тем сильнее выдох (это будет указано в результате).',
  se: 'Звуки', bgm: 'Музыка', vib: 'Вибрация', quality: 'Высокое качество', lang: 'Язык', on: 'ВКЛ', off: 'ВЫКЛ', pause: 'Пауза',
  'r.E': 'Лужа', 'r.D': 'Кромка прибоя', 'r.C': 'Приливная лужа', 'r.B': 'Тропа по отмели', 'r.A': 'Путь в открытое море', 'r.S': 'Через пролив', 'r.SS': 'За горизонтом', 'r.SSS': 'Другой берег',
};
D.it = {
  name: 'Il Soffio di Mosè', tA: 'IL SOFFIO DI', tB: 'MOSÈ', sub: 'UN SOFFIO · APRI IL MARE',
  play: 'Apri il mare', howto: 'Come si gioca', settings: 'Impostazioni', close: 'Chiudi', back: 'Indietro', toTitle: 'Titolo', best: 'RECORD',
  micNote: 'Ascolta il tuo respiro. Niente viene registrato o inviato.', micAsk: 'Consenti l’accesso al microfono',
  calib: 'Misuro il rumore ambientale. Silenzio', blowCut: 'SOFFIA', blowHint: 'Soffia nel microfono in basso sul telefono: un unico soffio lungo e forte', blowSub: 'È il soffio ad aprire il mare, non la voce',
  holdHint: 'Tocca rapidamente per soffiare', finger: 'Modalità tocco', mic: 'Microfono', input: 'Ingresso', noMic: 'Microfono non disponibile. Modalità tocco attiva',
  noBreath: 'Nessun soffio rilevato. Avvicina il microfono', sustain: 'TENUTA', breath: 'SOFFIO', split: 'Aperto', limit: 'Restano',
  lead: 'Il mare aperto in un soffio', statSec: 'Durata del soffio', sec: 's', statPeak: 'Soffio max', statMult: 'Bonus max', share: 'Pubblica su X', again: 'Riapri il mare',
  newBest: 'Nuovo record', shareSheet: 'Immagine da pubblicare', saveHint: 'Tieni premuta l’immagine per salvarla, poi allegala al post', openX: 'Apri X',
  copyText: 'Copia il testo', copied: 'Copiato', saved: 'Immagine salvata. Allegala al post',
  shareText: 'In Il Soffio di Mosè ho aperto il mare per {dist} con un solo soffio\nGrado {rank} «{title}» / soffio {sec} s{mode}',
  how1: 'Soffia in un unico respiro nel microfono in basso sul telefono. È il rumore del soffio ad aprire il mare, non la voce o il fischio.',
  how2: 'Più a lungo mantieni un soffio forte, più sale il bonus TENUTA e l’apertura accelera. Quando il soffio finisce, è finita.',
  how3: 'Gradi da E a SSS. Il grado massimo significa raggiungere l’altra riva. Pubblica il risultato con un’immagine su X.',
  how4: 'Senza microfono giochi in modalità tocco: tocca lo schermo rapidamente. Più tocchi veloce e a lungo, più forte è il soffio (indicato nel risultato).',
  se: 'Effetti sonori', bgm: 'Musica', vib: 'Vibrazione', quality: 'Alta qualità', lang: 'Lingua', on: 'ON', off: 'OFF', pause: 'Pausa',
  'r.E': 'Pozzanghera', 'r.D': 'Battigia', 'r.C': 'Pozza di marea', 'r.B': 'Sentiero nelle secche', 'r.A': 'Verso il largo', 'r.S': 'Oltre lo stretto', 'r.SS': 'Oltre l’orizzonte', 'r.SSS': 'Altra riva raggiunta',
};
export const LANGS = [['ja', '日本語'], ['en', 'English'], ['zh-Hans', '简体中文'], ['zh-Hant', '繁體中文'], ['ko', '한국어'], ['fr', 'Français'], ['de', 'Deutsch'], ['ru', 'Русский'], ['it', 'Italiano']];
let cur = 'ja';
export function detectLang() {
  const saved = (() => { try { return localStorage.getItem('moses.lang'); } catch { return null; } })();
  if (saved && D[saved]) return saved;
  const n = (navigator.language || 'ja').toLowerCase();
  if (n.startsWith('zh')) return /tw|hk|mo|hant/.test(n) ? 'zh-Hant' : 'zh-Hans';
  for (const k of ['ja', 'ko', 'fr', 'de', 'ru', 'it', 'en']) if (n.startsWith(k)) return k;
  return 'en';
}
export function setLang(l) { cur = D[l] ? l : 'en'; document.documentElement.lang = cur; try { localStorage.setItem('moses.lang', cur); } catch {} }
export function lang() { return cur; }
export function t(k, v) { let s = (D[cur] && D[cur][k]) ?? D.en[k] ?? D.ja[k] ?? k; if (v) for (const [a, b] of Object.entries(v)) s = s.split('{' + a + '}').join(b); return s; }
export function applyI18n(root = document) {
  root.querySelectorAll('[data-i18n]').forEach(e => { e.textContent = t(e.dataset.i18n); });
  root.querySelectorAll('[data-i18n-aria]').forEach(e => e.setAttribute('aria-label', t(e.dataset.i18nAria)));
}
