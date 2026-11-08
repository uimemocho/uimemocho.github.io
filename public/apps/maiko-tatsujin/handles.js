// 対戦相手の表示名ジェネレーター（8文字以内・言語によって傾向を変える）
const pick = (a) => a[Math.floor(Math.random() * a.length)];
const num = () => pick([String(Math.floor(Math.random() * 90) + 10), String(Math.floor(Math.random() * 900) + 100), pick(['01', '07', '22', '88', '99', '0412', '1123', '2525'])]);

const HIRA = ['ゆず', 'もち', 'こはる', 'みたらし', 'あんこ', 'さくら', 'ここあ', 'まめ', 'すず', 'りん', 'かえで', 'ほたる', 'つばき', 'なつめ', 'ひより', 'みお', 'あおい', 'ゆき', 'くるみ', 'しずく', 'ちゃこ', 'ぽぽ', 'はるな', 'いちご', 'まりも', 'こむぎ', 'わかば', 'のえる'];
const SUF = ['', '', '', 'ちゃん', 'ぽん', 'まる', 'っち', '丸', '姫', '屋', 'さん'];
const PHRASE = ['京都のたぬき', '抹茶ラテ', '祇園の風', 'タピオカ大臣', 'ねこ舞妓', '回転おばけ', '帯ひっぱり隊', 'だらり帯', '夜桜', '月見だんご', 'わらび餅', '八ツ橋', 'おこぼ職人', '花かんざし', '白玉ぜんざい', 'ほうじ茶', '鴨川デルタ', '三条大橋', '紅葉狩り', '朝ドラ民', '寝起きの鬼', '通勤中', 'ゆるゆる勢', '回る人', '目が回る', '帯の達人', 'たこ焼き', 'カフェオレ', 'のり弁', '定時退社', 'もふもふ', '雨女'];
const KATA = ['ミカン', 'ユズ', 'モモ', 'ハル', 'リオ', 'ナナ', 'ルナ', 'ソラ', 'レイ', 'ミク', 'カイ', 'ノア', 'リク', 'サラ', 'ユウ', 'ジン'];
const KANJI = ['小梅', '千鶴', '葉月', '菊乃', '鈴音', '紗月', '詩織', '琴葉', '彩花', '結衣', '美桜', '凛', '蓮', '湊', '陽向', '颯'];
const ROMA = ['koharu', 'yuzu', 'mochi', 'sakura', 'momo', 'rin', 'hana', 'kaede', 'aoi', 'miyu', 'nana', 'riku', 'sora', 'ren', 'yui', 'mei', 'haru', 'kei', 'shun', 'tama'];
const INTL = ['Luna', 'Mika', 'Zoe', 'Kai', 'Noah', 'Emma', 'Leo', 'Mila', 'Ivan', 'Chloe', 'Marco', 'Sofia', 'Lena', 'Yuki', 'Hana', 'Elif', 'Omar', 'Nina', 'Tom', 'Ava', 'Finn', 'Lou', 'Max', 'Ines', 'Jade', 'Theo', 'Anya', 'Dani', 'Rosa', 'Pim'];
const INTL_WORD = ['Spin', 'Obi', 'Twirl', 'Fan', 'Sakura', 'Kyoto', 'Petal', 'Dizzy', 'Swirl', 'Lotus', 'Geta', 'Moon'];
const INTL_TAIL = ['GG', 'TV', 'x', 'jr', 'pro', 'kun', 'chan', 'yt', 'ow', 'z'];
const ZH = ['小龙', '阿花', '团子', '糯米', '小樱', '花花', '星辰', '月饼'];
const KO = ['민지', '하루', '서연', '지우', '하늘', '예린', '도윤', '보라'];

const JP = [
  () => pick(HIRA) + pick(SUF),
  () => pick(PHRASE),
  () => pick(KATA) + pick(['', '', num()]),
  () => pick(KANJI) + pick(['', '', 'ちゃん', '@舞', num()]),
  () => pick(HIRA) + num(),
  () => pick(ROMA) + pick(['_', '', '.']) + num(),
  () => pick(ROMA).toUpperCase(),
];
const WORLD = [
  () => pick(INTL) + num(),
  () => pick(INTL).toLowerCase() + pick(['_', '.', '']) + pick(INTL_WORD).toLowerCase(),
  () => pick(INTL_WORD) + pick(INTL),
  () => pick(INTL) + pick(INTL_TAIL),
  () => pick(INTL_WORD) + pick(['Queen', 'King', 'Cat', 'Bean', 'Kid', 'Fox']),
  () => pick(ROMA) + pick(['_', '']) + num(),
  () => (Math.random() < 0.5 ? pick(ZH) : pick(KO)) + pick(['', num()]),
  () => pick(INTL).toLowerCase(),
];

export function makeHandle(lang = 'ja', avoid = '') {
  const jpBias = lang === 'ja' ? 0.72 : 0.25;
  for (let i = 0; i < 30; i++) {
    const n = (Math.random() < jpBias ? pick(JP) : pick(WORLD))();
    if (n && [...n].length <= 8 && n !== avoid) return n;
  }
  return pick(KANJI);
}
