(() => {
    const ROUTE_TEXT = '· · · · · · · · · · · · · · · ·';
    let areaObserver = null;

    function targetPreview(target, left = target.count) {
        const item = document.createElement('span');
        item.className = 'target-item' + (left <= 0 ? ' done' : '');
        item.style.color = target.color;
        const char = document.createElement('span');
        char.className = 'target-char';
        char.textContent = target.char;
        if (left > 0 && target.special === 'rainbow') char.classList.add('rainbow-anim');
        else if (left > 0 && target.special !== 'normal') {
            char.style.setProperty('--piece-color', target.color);
            char.classList.add('special-anim');
        }
        const count = document.createElement('span');
        count.className = 'target-count';
        count.textContent = toFullWidth(String(Math.max(0, left)).padStart(2, '0'));
        item.append(char, count);
        return item;
    }

    function renderEnemyPreview(holder, enemyList) {
        holder.innerHTML = '';
        holder.classList.add('enemy-preview-grid');
        holder.style.setProperty('--preview-count', enemyList.length);
        enemyList.forEach(enemy => {
            const item = document.createElement('div');
            item.className = 'enemy-preview';
            const name = document.createElement('span');
            name.className = 'enemy-preview-name';
            name.textContent = enemy.name;
            const face = document.createElement('span');
            face.className = 'enemy-preview-face';
            face.textContent = enemy.face;
            const targets = document.createElement('span');
            targets.className = 'enemy-preview-targets';
            enemy.targets.forEach(target => targets.appendChild(targetPreview(
                target,
                enemy.remaining?.[target.char] ?? target.count
            )));
            item.append(name, face, targets);
            holder.appendChild(item);
        });
    }

    function renderAreaBackground(track, area) {
        const section = document.createElement('div');
        section.className = 'map-area';
        section.dataset.area = area;
        section.style.top = `${(MatchTextStages.AREA_COUNT - area) * MatchTextStages.AREA_HEIGHT}px`;
        section.style.setProperty('--area-color', MatchTextStages.AREA_COLORS[area - 1]);
        const faces = getAreaEnemyDefinitions(area * MatchTextStages.AREA_SIZE).map(enemy => enemy.face);
        const asciiChars = [...'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789+-*/=<>[]{}!?#%&'];
        const count = innerWidth <= 360 ? 9 : 13;
        for (let index = 0; index < count; index++) {
            const char = document.createElement('span');
            char.className = 'map-ambient-char';
            char.textContent = index < Math.min(4, count) || Math.random() < .58
                ? (faces[Math.floor(Math.random() * faces.length)] || '(･_･)')
                : asciiChars[Math.floor(Math.random() * asciiChars.length)];
            char.style.left = `${4 + Math.random() * 86}%`;
            char.style.top = `${-100 + Math.random() * 920}px`;
            char.style.setProperty('--fall-time', `${11 + Math.random() * 8}s`);
            char.style.setProperty('--fall-delay', `${-Math.random() * 16}s`);
            char.style.setProperty('--area-rot', Math.random() < .5 ? '-1' : '1');
            section.appendChild(char);
        }
        track.appendChild(section);
    }

    function stageStarElements(stageId, visibleStars) {
        const wrap = document.createElement('span');
        wrap.className = 'stage-node-stars';
        wrap.setAttribute('aria-label', `星${visibleStars}個`);
        for (let index = 0; index < 3; index++) {
            const star = document.createElement('span');
            star.className = 'stage-star' + (index < visibleStars ? ' earned' : '');
            star.textContent = index < visibleStars ? '★' : '☆';
            star.dataset.starIndex = index;
            wrap.appendChild(star);
        }
        return wrap;
    }

    function renderStageMap(reward = null) {
        const track = document.getElementById('map-track');
        const progress = MatchTextStages.readProgress();
        const current = reward?.stageId || MatchTextStages.currentStage(progress);
        track.innerHTML = '';
        track.style.minHeight = `${MatchTextStages.AREA_COUNT * MatchTextStages.AREA_HEIGHT}px`;

        for (let area = 1; area <= MatchTextStages.AREA_COUNT; area++) renderAreaBackground(track, area);
        areaObserver?.disconnect();
        if ('IntersectionObserver' in window) {
            areaObserver = new IntersectionObserver(entries => {
                entries.forEach(entry => entry.target.classList.toggle('in-view', entry.isIntersecting));
            }, { root: document.getElementById('map-screen'), rootMargin: '160px 0px' });
            track.querySelectorAll('.map-area').forEach(area => areaObserver.observe(area));
        } else {
            track.querySelectorAll('.map-area').forEach(area => area.classList.add('in-view'));
        }

        for (let stageId = 1; stageId < MatchTextStages.STAGE_COUNT; stageId++) {
            const route = document.createElement('div');
            route.className = 'stage-route';
            route.dataset.from = stageId;
            route.dataset.to = stageId + 1;
            route.textContent = ROUTE_TEXT;
            const nextUnlocked = MatchTextStages.isUnlocked(stageId + 1, progress);
            if (nextUnlocked && !(reward?.unlockedNext && reward.nextStageId === stageId + 1)) route.classList.add('active');
            track.appendChild(route);
        }

        for (let stageId = 1; stageId <= MatchTextStages.STAGE_COUNT; stageId++) {
            const data = MatchTextStages.getStage(stageId);
            const unlocked = MatchTextStages.isUnlocked(stageId, progress);
            const pendingLock = Boolean(reward?.unlockedNext && reward.nextStageId === stageId);
            const storedStars = MatchTextStages.getStars(stageId, progress);
            const visibleStars = reward?.stageId === stageId ? reward.previous : storedStars;
            const node = document.createElement('button');
            node.type = 'button';
            node.className = `stage-node${unlocked ? '' : ' locked'}${pendingLock ? ' pending-lock' : ''}${stageId === current ? ' current' : ''}`;
            node.dataset.stageId = stageId;
            node.style.left = `${data.x}%`;
            node.style.top = `${data.y}px`;
            node.style.setProperty('--area-color', data.color);
            node.disabled = !unlocked || pendingLock;
            node.setAttribute('aria-label', `${data.name} ${unlocked ? `星${storedStars}個` : '未解放'}`);
            ['tl', 'tr', 'bl', 'br'].forEach(position => {
                const corner = document.createElement('span');
                corner.className = `stage-current-corner ${position}`;
                corner.textContent = '＋';
                corner.setAttribute('aria-hidden', 'true');
                node.appendChild(corner);
            });
            const label = document.createElement('span');
            label.className = 'stage-node-label';
            label.textContent = `〈${data.label}〉`;
            node.append(label, stageStarElements(stageId, visibleStars));
            node.addEventListener('click', () => openStageDetail(stageId));
            track.appendChild(node);
        }

        requestAnimationFrame(() => {
            layoutMapRoutes();
            updateMapAreaLabel();
        });
    }

    function layoutMapRoutes() {
        const track = document.getElementById('map-track');
        if (!track) return;
        track.querySelectorAll('.stage-route').forEach(route => {
            const from = track.querySelector(`.stage-node[data-stage-id="${route.dataset.from}"]`);
            const to = track.querySelector(`.stage-node[data-stage-id="${route.dataset.to}"]`);
            if (!from || !to) return;
            const x1 = from.offsetLeft;
            const y1 = from.offsetTop;
            const x2 = to.offsetLeft;
            const y2 = to.offsetTop;
            const dx = x2 - x1;
            const dy = y2 - y1;
            route.style.width = `${Math.hypot(dx, dy)}px`;
            route.style.left = `${(x1 + x2) / 2}px`;
            route.style.top = `${(y1 + y2) / 2}px`;
            route.style.transform = `translate(-50%,-50%) rotate(${Math.atan2(dy, dx) * 180 / Math.PI}deg)`;
        });
    }

    function updateMapAreaLabel() {
        const screen = document.getElementById('map-screen');
        const label = document.getElementById('map-area-label');
        if (!screen || !label) return;
        const visualArea = Math.floor((screen.scrollTop + innerHeight * .36) / MatchTextStages.AREA_HEIGHT);
        const area = Math.max(1, Math.min(MatchTextStages.AREA_COUNT, MatchTextStages.AREA_COUNT - visualArea));
        label.textContent = `エリア${toFullWidth(area)}`;
        label.style.setProperty('--area-color', MatchTextStages.AREA_COLORS[area - 1]);
    }

    function scrollMapToStage(stageId, behavior = 'auto') {
        const screen = document.getElementById('map-screen');
        const node = document.querySelector(`.stage-node[data-stage-id="${stageId}"]`);
        if (!screen || !node) return;
        const target = Math.max(0, node.offsetTop - innerHeight * .48);
        screen.scrollTo({ top: target, behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : behavior });
    }

    function openStageMap(reward = null) {
        ensureAudio();
        showScreen('map-screen');
        renderStageMap(reward);
        const focusStage = reward?.stageId || MatchTextStages.currentStage();
        requestAnimationFrame(() => scrollMapToStage(focusStage));
        if (reward) setTimeout(() => playMapReward(reward), 360);
    }

    function openStageDetail(stageId) {
        if (!MatchTextStages.isUnlocked(stageId)) return;
        selectedStageId = stageId;
        const data = MatchTextStages.getStage(stageId);
        selectedStageEncounter = createEnemyEncounter(data.difficulty);
        document.getElementById('stage-detail-title').textContent = data.name;
        document.getElementById('stage-detail-name').textContent = data.title;
        const stars = MatchTextStages.getStars(stageId);
        document.getElementById('stage-detail-stars').textContent = `${'★'.repeat(stars)}${'☆'.repeat(3 - stars)}`;
        renderEnemyPreview(document.getElementById('stage-detail-enemies'), selectedStageEncounter);
        openDialog('stage-detail-dialog');
    }

    function startSelectedSoloStage() {
        const data = MatchTextStages.getStage(selectedStageId);
        STAGE.turns = data.turns;
        STAGE.starScores = [...data.starScores];
        STAGE.stageId = data.id;
        currentMode = 'solo';
        closeDialog('stage-detail-dialog');
        showScreen('game-screen');
        initGame(null, selectedStageEncounter);
    }

    function createMapUnlockParticles(node, color) {
        const rect = node.getBoundingClientRect();
        const chars = ['＋', '＊', '·', '／', '＼', '☆'];
        const count = innerWidth <= 360 ? 9 : 14;
        for (let index = 0; index < count; index++) {
            const particle = document.createElement('span');
            particle.className = 'map-unlock-particle';
            particle.textContent = chars[index % chars.length];
            particle.style.left = `${rect.left + rect.width / 2}px`;
            particle.style.top = `${rect.top + rect.height / 2}px`;
            particle.style.setProperty('--area-color', color);
            document.body.appendChild(particle);
            const angle = Math.PI * 2 * index / count + Math.random() * .35;
            const distance = 32 + Math.random() * 42;
            particle.animate([
                { transform: 'translate(-50%,-50%) scale(.3)', opacity: 0 },
                { transform: `translate(calc(-50% + ${Math.cos(angle) * distance * .35}px),calc(-50% + ${Math.sin(angle) * distance * .35}px)) scale(1.2)`, opacity: 1, offset: .32 },
                { transform: `translate(calc(-50% + ${Math.cos(angle) * distance}px),calc(-50% + ${Math.sin(angle) * distance}px)) rotate(${index * 38}deg) scale(.45)`, opacity: 0 }
            ], { duration: 680 + Math.random() * 260, easing: 'ease-out' }).finished.finally(() => particle.remove());
        }
    }

    async function playMapReward(reward) {
        const completed = document.querySelector(`.stage-node[data-stage-id="${reward.stageId}"]`);
        if (!completed) return;
        const stars = [...completed.querySelectorAll('.stage-star')];
        for (let index = reward.previous; index < reward.stars; index++) {
            const star = stars[index];
            if (!star) continue;
            star.textContent = '★';
            star.classList.add('earned', 'star-award');
            playSE(720 + index * 130, .14, 'sine');
            await wait(260);
        }
        if (!reward.unlockedNext) return;
        const route = document.querySelector(`.stage-route[data-to="${reward.nextStageId}"]`);
        await wait(220);
        route?.classList.add('active', 'route-awake');
        playSE(540, .24, 'square');
        await wait(620);
        const next = document.querySelector(`.stage-node[data-stage-id="${reward.nextStageId}"]`);
        if (!next) return;
        next.disabled = false;
        next.classList.remove('locked', 'pending-lock');
        next.classList.add('unlocking');
        completed.classList.remove('current');
        next.classList.add('current');
        next.setAttribute('aria-label', `${MatchTextStages.getStage(reward.nextStageId).name} 星0個`);
        createMapUnlockParticles(next, MatchTextStages.getStage(reward.nextStageId).color);
        playSE(960, .28, 'sine');
        await wait(680);
        next.classList.remove('unlocking');
        scrollMapToStage(reward.nextStageId, 'smooth');
    }

    function recordSoloStageResult(stars) {
        pendingMapReward = MatchTextStages.recordStars(selectedStageId, stars);
        return pendingMapReward;
    }

    function returnToMapWithReward() {
        resultSequenceToken++;
        const reward = pendingMapReward;
        pendingMapReward = null;
        openStageMap(reward);
    }

    function initStageMap() {
        const map = document.getElementById('map-screen');
        map.addEventListener('scroll', updateMapAreaLabel, { passive: true });
        window.addEventListener('resize', layoutMapRoutes, { passive: true });
        document.getElementById('map-back-btn').addEventListener('click', () => showScreen('title-screen'));
        document.getElementById('stage-detail-close').addEventListener('click', () => closeDialog('stage-detail-dialog'));
        document.getElementById('stage-detail-start').addEventListener('click', startSelectedSoloStage);
        document.getElementById('next-stage-btn').addEventListener('click', returnToMapWithReward);
        renderStageMap();
    }

    window.renderEnemyPreview = renderEnemyPreview;
    window.openStageMap = openStageMap;
    window.recordSoloStageResult = recordSoloStageResult;
    window.initStageMap = initStageMap;
})();
