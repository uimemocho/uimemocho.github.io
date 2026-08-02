(() => {
    const AREA_SIZE = 10;
    const AREA_COUNT = 3;
    const STAGE_COUNT = AREA_SIZE * AREA_COUNT;
    const AREA_HEIGHT = 1000;
    const NODE_X = [50, 24, 68, 35, 76, 26, 64, 38, 72, 50];
    const AREA_COLORS = ['#54d8a0', '#66a8ff', '#cf79ff'];
    const STORAGE_KEY = 'matchTextStageProgressV1';
    const STAGE_TITLES = [
        '文字の目覚め', '赤青黄の道', 'はじめての群れ', 'つながる言葉', '五色の門',
        '二つの影', '横の試練', '縦の試練', '爆ぜる文字', '緑の関門',
        '蒼い通路', '絡まる記号', '二重の呼吸', '飛び交う文字', '色変わりの塔',
        '石の言葉', '揺らぐ盤面', '三つの気配', '爆音の回廊', '蒼の番人',
        '紫煙の道', '虹の欠片', '崩れる配列', '三重の関門', '文字の迷宮',
        '黒い波形', '黙示録の文字', '王城への道', '最後の門', '魔王の文字'
    ];

    function getDifficulty(stageId) {
        const id = Math.max(1, Math.min(STAGE_COUNT, Number(stageId) || 1));
        let profile;
        if (id <= 2) profile = { enemyCount: 1, targetsPerEnemy: 2, specialEnemies: 0, normalMin: 4, normalMax: 5, specialMax: 1, enemyTierMin: 1, enemyTierMax: 1 };
        else if (id <= 4) profile = { enemyCount: 1, targetsPerEnemy: id === 3 ? 2 : 3, specialEnemies: 0, normalMin: 5, normalMax: 6, specialMax: 1, enemyTierMin: 1, enemyTierMax: 1 };
        else if (id <= 6) profile = { enemyCount: id === 5 ? 1 : 2, targetsPerEnemy: 2, specialEnemies: 0, normalMin: 5, normalMax: 6, specialMax: 1, enemyTierMin: 1, enemyTierMax: 1 };
        else if (id <= 9) profile = { enemyCount: 2, targetsPerEnemy: id < 9 ? 2 : 3, specialEnemies: 1, normalMin: 4, normalMax: 6, specialMax: 1, enemyTierMin: 1, enemyTierMax: 2 };
        else if (id === 10) profile = { enemyCount: 2, targetsPerEnemy: 3, specialEnemies: 1, normalMin: 5, normalMax: 6, specialMax: 1, enemyTierMin: 1, enemyTierMax: 2, featuredEnemy: 'オーク' };
        else if (id <= 14) profile = { enemyCount: 2, targetsPerEnemy: 2, specialEnemies: 1, normalMin: 5, normalMax: 7, specialMax: 1, enemyTierMin: 1, enemyTierMax: 2 };
        else if (id <= 19) profile = { enemyCount: 2, targetsPerEnemy: 3, specialEnemies: id >= 17 ? 2 : 1, normalMin: 5, normalMax: 7, specialMax: 1, enemyTierMin: 2, enemyTierMax: 2 };
        else if (id === 20) profile = { enemyCount: 3, targetsPerEnemy: 2, specialEnemies: 2, normalMin: 5, normalMax: 6, specialMax: 1, enemyTierMin: 2, enemyTierMax: 3, featuredEnemy: '騎士' };
        else if (id <= 24) profile = { enemyCount: 2, targetsPerEnemy: 3, specialEnemies: 2, normalMin: 6, normalMax: 8, specialMax: 1, enemyTierMin: 2, enemyTierMax: 3 };
        else if (id <= 27) profile = { enemyCount: 3, targetsPerEnemy: 2, specialEnemies: 2, normalMin: 5, normalMax: 7, specialMax: 1, enemyTierMin: 2, enemyTierMax: 3 };
        else if (id <= 29) profile = { enemyCount: 3, targetsPerEnemy: 3, specialEnemies: 2, normalMin: 5, normalMax: 7, specialMax: 1, enemyTierMin: 3, enemyTierMax: 3, featuredEnemy: id === 29 ? '黒騎士' : null };
        else profile = { enemyCount: 3, targetsPerEnemy: 3, specialEnemies: 3, normalMin: 6, normalMax: 8, specialMax: 1, enemyTierMin: 3, enemyTierMax: 3, forceBoss: true };
        return { ...profile, stageId: id };
    }

    function readProgress() {
        try {
            const value = JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}');
            return value && typeof value === 'object' ? value : {};
        } catch (_) {
            return {};
        }
    }

    function writeProgress(progress) {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(progress));
    }

    function getStars(stageId, progress = readProgress()) {
        return Math.max(0, Math.min(3, Number(progress[stageId]) || 0));
    }

    function isUnlocked(stageId, progress = readProgress()) {
        if (stageId === 1) return true;
        return getStars(stageId - 1, progress) > 0;
    }

    function currentStage(progress = readProgress()) {
        for (let stageId = 1; stageId <= STAGE_COUNT; stageId++) {
            if (isUnlocked(stageId, progress) && getStars(stageId, progress) === 0) return stageId;
        }
        return STAGE_COUNT;
    }

    function recordStars(stageId, stars) {
        const progress = readProgress();
        const previous = getStars(stageId, progress);
        const next = Math.max(previous, Math.max(0, Math.min(3, stars)));
        progress[stageId] = next;
        writeProgress(progress);
        return {
            stageId,
            previous,
            stars: next,
            unlockedNext: stageId < STAGE_COUNT && previous === 0 && next > 0,
            nextStageId: Math.min(STAGE_COUNT, stageId + 1)
        };
    }

    function getStage(stageId) {
        const safeId = Math.max(1, Math.min(STAGE_COUNT, Number(stageId) || 1));
        const area = Math.ceil(safeId / AREA_SIZE);
        const localIndex = (safeId - 1) % AREA_SIZE;
        return {
            id: safeId,
            label: String(safeId).padStart(3, '0'),
            name: `ステージ${String(safeId).padStart(3, '0')}`,
            title: STAGE_TITLES[safeId - 1],
            area,
            color: AREA_COLORS[area - 1],
            turns: Math.max(18, 24 - (area - 1) * 2),
            starScores: [4000, 8000, 12000].map(value => value + (safeId - 1) * 180),
            x: NODE_X[localIndex],
            y: (AREA_COUNT - area) * AREA_HEIGHT + 895 - localIndex * 88,
            difficulty: getDifficulty(safeId)
        };
    }

    window.MatchTextStages = {
        AREA_SIZE,
        AREA_COUNT,
        STAGE_COUNT,
        AREA_HEIGHT,
        AREA_COLORS,
        readProgress,
        getStars,
        getDifficulty,
        isUnlocked,
        currentStage,
        recordStars,
        getStage
    };
})();
