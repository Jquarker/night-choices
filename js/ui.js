/* ============================================
   ui.js - UI 渲染与交互
   统计条、伴侣渲染、弹窗、历史记录、疾病科普
   ============================================ */

// ==========================================
// 统计条更新
// ==========================================

function updateStatsUI() {
    const fBar = document.getElementById('frustration-bar');
    const aBar = document.getElementById('anxiety-bar');
    const gameContent = document.getElementById('game-content');
    if (!fBar || !aBar || !gameContent) return;

    fBar.style.width = `${STATE.frustration}%`;
    document.getElementById('frustration-val').innerText = `${STATE.frustration}%`;

    aBar.style.width = `${STATE.anxiety}%`;
    document.getElementById('anxiety-val').innerText = `${STATE.anxiety}%`;

    const panicWarn = document.getElementById('panic-warning');

    if (STATE.anxiety >= 80) {
        gameContent.classList.add('panic-mode');
        panicWarn.classList.remove('hidden');
        aBar.classList.add('bg-violet-500');
        aBar.classList.remove('bg-gradient-to-r');
    } else {
        gameContent.classList.remove('panic-mode');
        panicWarn.classList.add('hidden');
        aBar.classList.remove('bg-violet-500');
        aBar.classList.add('bg-gradient-to-r');
    }

    const turnCount = document.getElementById('turn-count');
    const kitEl = document.getElementById('item-testkit');
    if (turnCount) turnCount.innerText = STATE.turn.toString().padStart(2, '0');
    if (kitEl) {
        kitEl.innerText = `x${STATE.items.testkit}`;
        kitEl.className = STATE.items.testkit === 0
            ? "text-xs font-bold text-slate-600"
            : "text-xs font-bold text-sky-400";
    }
}

// ==========================================
// 伴侣渲染
// ==========================================

/**
 * 格式化调情台词：在句末标点处换行，配合 CSS text-wrap:pretty 避免孤字
 * @param {string} text - 原始台词
 * @returns {string} 带 <br> 的 HTML
 */
function formatFlirtText(text) {
    // 在句末标点后插入换行（。！？… ~  —）
    var html = '"' + text.replace(/([。！？…])(?!$)/g, '$1<br>') + '"';
    return html;
}

function renderPartner() {
    const p = STATE.currentPartner;
    document.getElementById('avatar-emoji').innerText = p.avatar;
    // 仅在新伴侣（未检测过）时隐藏警告；试纸阳性后保持显示
    if (!p._statusShown) {
        document.getElementById('partner-status').classList.add('hidden');
    }
    const rawLine = FLIRT_LINES[Math.floor(Math.random() * FLIRT_LINES.length)];
    document.getElementById('flirt-text').innerHTML = formatFlirtText(rawLine);

    const container = document.getElementById('tags-container');
    container.innerHTML = '';

    let constraints = [];
    let hiddenCount = 0;
    const isPanic = STATE.anxiety >= 80;

    p.tags.forEach((tag) => {
        const div = document.createElement('div');
        const forceHide = isPanic && Math.random() < 0.5;
        if (!tag.revealed || forceHide) {
            hiddenCount++;
            div.className = `tag-badge px-2 py-1 rounded-lg text-[10px] lg:text-xs font-bold text-slate-500 bg-slate-900 border border-slate-700 shadow-sm flex items-center gap-1 cursor-help`;
            div.innerHTML = isPanic ? `<span class="blur-sm">???</span>` : `<span>❓</span> 隐藏信息`;
        } else {
            if (tag.constraint) constraints.push(tag.constraint);
            div.className = `tag-badge tag-reveal px-2 py-1 rounded-lg text-[10px] lg:text-xs font-bold text-white shadow-lg flex items-center gap-1 border border-white/10 ${tag.color}`;
            let icon = '⏺';
            if (tag.color.includes('red')) icon = '⚠️';
            else if (tag.constraint) icon = '🚫';
            else if (tag.color.includes('emerald')) icon = '🛡️';
            div.innerHTML = `<span class="opacity-75">${icon}</span> ${tag.text}`;
        }
        container.appendChild(div);
    });

    resetButtons();

    // ---- 动态计算压力倍率（体征缩放 + 试纸清零） ----
    const visibleSigns = p.tags.filter(function(t) {
        if (!t.revealed) return false;
        var c = t.color || '';
        return c.indexOf('red') !== -1 || c.indexOf('purple') !== -1;
    }).length;

    var signMult = 1;
    if (visibleSigns > 0) {
        signMult = Math.min(1 + visibleSigns * CONFIG.ANXIETY_SIGN.perSignMultiplier, CONFIG.ANXIETY_SIGN.maxMultiplier);
    }
    var tested = p.testedNegative;

    // ---- 更新四个性行为按钮标签 ----
    var actionDefs = [
        { id: 'btn-oral-condom', emoji: '🍬', name: '戴套口交', action: 'oral_condom' },
        { id: 'btn-sex-condom',  emoji: '🛡️', name: '戴套性交', action: 'sex_condom' },
        { id: 'btn-oral-raw',    emoji: '🍭', name: '无套口交', action: 'oral_raw' },
        { id: 'btn-sex-raw',     emoji: '🔥', name: '无套性交', action: 'sex_raw' }
    ];

    for (var i = 0; i < actionDefs.length; i++) {
        var def = actionDefs[i];
        var btn = document.getElementById(def.id);
        if (!btn) continue;

        var reward = CONFIG.rewards[def.action];
        var stress = CONFIG.stress[def.action];
        var rewardRange = reward.min + '~' + reward.max;
        var stressRange;
        if (tested) {
            stressRange = '0';
        } else if (signMult > 1) {
            stressRange = Math.round(stress.min * signMult) + '~' + Math.round(stress.max * signMult);
        } else {
            stressRange = stress.min + '~' + stress.max;
        }

        btn.innerHTML = def.emoji + ' ' + def.name +
            '<span class="block text-[8px] lg:text-[9px] opacity-60 mt-0.5">收益 ' + rewardRange + ' | 压力 +' + stressRange + '</span>';
    }

    // ---- 换一个按钮 ----
    var refuseBtn = document.getElementById('btn-refuse');
    if (refuseBtn) {
        var pg = CONFIG.passiveGain;
        refuseBtn.innerHTML = '<span>👋</span> 换一个 (压抑值+' + pg.min + '~' + pg.max + ')';
    }

    // ---- 聊天按钮 ----
    var chatBtn = document.getElementById('btn-chat');
    var chatRange = CONFIG.chatCost.min + '~' + CONFIG.chatCost.max;
    if (hiddenCount === 0 && !isPanic) {
        chatBtn.classList.add('opacity-50', 'cursor-not-allowed');
        chatBtn.disabled = true;
        chatBtn.innerHTML = '<span>💬</span> 已完全了解';
    } else {
        chatBtn.classList.remove('opacity-50', 'cursor-not-allowed');
        chatBtn.disabled = false;
        chatBtn.innerHTML = '<span>💬</span> 试探 / 聊天 <span class="opacity-50 text-[10px] font-normal ml-1">(压抑值+' + chatRange + ')</span>';
    }

    if (constraints.length > 0) applyConstraints(constraints);
}

// ==========================================
// 按钮状态管理
// ==========================================

function resetButtons() {
    const ids = ['btn-oral-condom', 'btn-oral-raw', 'btn-sex-condom', 'btn-sex-raw'];
    ids.forEach(id => {
        const btn = document.getElementById(id);
        btn.disabled = false;
        btn.classList.remove('btn-disabled');
        const overlay = btn.querySelector('.disabled-overlay');
        if (overlay) overlay.remove();
    });
}

function applyConstraints(constraints) {
    constraints.forEach(c => {
        if (c === 'no_condom') {
            disableBtn('btn-oral-condom');
            disableBtn('btn-sex-condom');
        } else if (c === 'condom_only') {
            disableBtn('btn-oral-raw');
            disableBtn('btn-sex-raw');
        } else if (c === 'no_oral') {
            disableBtn('btn-oral-condom');
            disableBtn('btn-oral-raw');
        } else if (c === 'oral_only') {
            disableBtn('btn-sex-condom');
            disableBtn('btn-sex-raw');
        }
    });
}

function disableBtn(id) {
    const btn = document.getElementById(id);
    if (!btn.disabled) {
        btn.disabled = true;
        btn.classList.add('btn-disabled');
        const span = document.createElement('div');
        span.className = 'disabled-overlay absolute inset-0 flex items-center justify-center bg-black/60 text-rose-500 font-bold rotate-[-3deg] text-[10px] uppercase border border-rose-500/30 rounded-xl backdrop-blur-[1px]';
        span.innerText = "对方拒绝";
        btn.appendChild(span);
    }
}

// ==========================================
// Modal 管理
// ==========================================

function toggleHelp() {
    const modal = document.getElementById('help-modal');
    modal.classList.toggle('hidden');
}

function toggleHistoryView(show) {
    const summaryView = document.getElementById('summary-view');
    const historyView = document.getElementById('history-view');

    if (show) {
        summaryView.classList.add('hidden');
        historyView.classList.remove('hidden');
    } else {
        summaryView.classList.remove('hidden');
        historyView.classList.add('hidden');
    }
}

function toggleDisclaimerConsent() {
    const consent = document.getElementById('disclaimer-consent');
    const continueBtn = document.getElementById('continue-intro-btn');
    continueBtn.disabled = !consent.checked;
    continueBtn.classList.toggle('opacity-50', !consent.checked);
    continueBtn.classList.toggle('cursor-not-allowed', !consent.checked);
    continueBtn.classList.toggle('hover:bg-rose-500', consent.checked);
}

function enterGameIntro() {
    const consent = document.getElementById('disclaimer-consent');
    if (!consent.checked) return;
    document.getElementById('compliance-modal').classList.add('hidden');
    document.getElementById('intro-modal').classList.remove('hidden');
    document.getElementById('intro-modal').classList.add('flex');
}

function startGame() {
    document.getElementById('intro-modal').classList.add('hidden');
    document.getElementById('game-container').classList.remove('hidden');
    initGame();
}

function returnToIntro() {
    document.getElementById('feedback-overlay').classList.add('hidden');
    document.getElementById('game-container').classList.add('hidden');
    document.getElementById('intro-modal').classList.remove('hidden');
    document.getElementById('intro-modal').classList.add('flex');
}

// ==========================================
// 历史记录列表渲染
// ==========================================

// 当前展开的伴侣详情索引（-1 = 无展开）
let _expandedPartnerIndex = -1;

function renderHistoryList() {
    const list = document.getElementById('history-list');
    if (!list) return;
    list.innerHTML = '';
    _expandedPartnerIndex = -1;

    if (STATE.history.length === 0) {
        list.innerHTML = '<div class="text-center text-slate-500 text-xs py-8">暂无约会记录</div>';
        return;
    }

    STATE.history.forEach((item, index) => {
        const div = document.createElement('div');
        const hasDiseases = item.diseases.length > 0;
        const clickableClass = hasDiseases ? 'cursor-pointer hover:bg-slate-700/50 transition-colors' : '';

        div.className = `history-entry flex items-start gap-3 p-3 bg-slate-800/50 rounded-lg border border-white/5 ${clickableClass}`;
        div.setAttribute('data-history-index', index);

        let statusIcon = hasDiseases ? "<span class='absolute -bottom-1 -right-1 text-[10px]'>🦠</span>" : "";

        let tagHTML = item.tags.map(t => `<span class='inline-block px-1.5 py-0.5 rounded bg-slate-700 text-[10px] text-slate-300 mr-1 mb-1'>${t.text}</span>`).join("");
        if (hasDiseases) {
            tagHTML += `<br><span class='text-[10px] text-rose-400 font-bold cursor-pointer hover:underline'>🔍 携带: ${item.diseases.map(d => DISEASES[d].name).join(", ")}</span>`;
        } else {
            tagHTML += `<br><span class='text-[10px] text-emerald-500/50'>健康</span>`;
        }

        div.innerHTML = `
            <div class="relative text-2xl bg-slate-900 rounded-full w-10 h-10 flex items-center justify-center border border-white/10 flex-shrink-0">
                ${item.avatar} ${statusIcon}
            </div>
            <div class="flex-1 min-w-0">
                <div class="mb-1 leading-tight">${tagHTML}</div>
            </div>
            <div class="flex-shrink-0 ml-2">
                <span class="px-2 py-1 rounded text-[10px] font-bold border ${item.outcomeClass}">${item.outcomeLabel}</span>
            </div>
        `;

        // 点击携带疾病的伴侣条目 → 展开/收起疾病详情
        if (hasDiseases) {
            div.addEventListener('click', function(e) {
                togglePartnerDiseaseDetail(item, index);
            });
        }

        list.appendChild(div);
    });
}

/**
 * 切换伴侣疾病详情面板：展开/收起
 * - 点击同一伴侣 → 收起
 * - 点击不同伴侣 → 切换到该伴侣
 */
function togglePartnerDiseaseDetail(historyItem, index) {
    if (!historyItem.diseases || historyItem.diseases.length === 0) return;

    // 点击已展开的伴侣 → 收起
    if (_expandedPartnerIndex === index) {
        closePartnerDiseaseDetail();
        return;
    }

    // 先移除旧面板（如果有）
    removeDetailPanel();

    const list = document.getElementById('history-list');
    if (!list) return;

    // 取消所有高亮
    list.querySelectorAll('.ring-2').forEach(el => el.classList.remove('ring-2', 'ring-rose-500/50'));

    // 高亮当前条目
    const entries = list.querySelectorAll('.history-entry');
    if (entries[index]) {
        entries[index].classList.add('ring-2', 'ring-rose-500/50');
    }

    // 动态创建详情面板
    const diseaseNames = historyItem.diseases.map(d => DISEASES[d].name).join('、');
    const detailHTML = `
        <div id="partner-disease-detail" class="history-detail mt-1 bg-rose-950/30 border border-rose-500/30 rounded-xl p-4">
            <h4 class="text-sm font-bold text-rose-300 mb-3">🦠 该伴侣携带病原体：<span class="text-rose-200">${diseaseNames}</span></h4>
            <div class="text-xs text-rose-100/80">${buildMultiDiseaseHTML(historyItem.diseases)}</div>
        </div>
    `;

    // 插入到选中的伴侣条目之后
    const detailDiv = document.createElement('div');
    detailDiv.innerHTML = detailHTML;
    const panelEl = detailDiv.firstElementChild;

    if (entries[index]) {
        entries[index].after(panelEl);
    } else {
        list.appendChild(panelEl);
    }

    _expandedPartnerIndex = index;

    // 滚动面板到可见位置
    panelEl.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
}

/**
 * 移除动态插入的疾病详情面板
 */
function removeDetailPanel() {
    const panel = document.getElementById('partner-disease-detail');
    if (panel) panel.remove();
}

/**
 * 关闭伴侣疾病详情面板
 */
function closePartnerDiseaseDetail() {
    removeDetailPanel();
    _expandedPartnerIndex = -1;

    // 取消高亮
    const list = document.getElementById('history-list');
    if (list) {
        list.querySelectorAll('.ring-2').forEach(el => el.classList.remove('ring-2', 'ring-rose-500/50'));
    }
}

// ==========================================
// 统计信息 HTML 生成
// ==========================================

function getStatsHTML() {
    let counts = { enjoy: 0, escape: 0, leave: 0, miss: 0, infected: 0 };
    let actionCounts = {
        sex_raw: 0,
        sex_condom: 0,
        oral_raw: 0,
        oral_condom: 0,
        refuse: 0
    };

    STATE.history.forEach(h => {
        if (h.outcomeLabel.includes("理智享受")) counts.enjoy++;
        if (h.outcomeLabel.includes("死里逃生")) counts.escape++;
        if (h.outcomeLabel.includes("正确离开")) counts.leave++;
        if (h.outcomeLabel.includes("遗憾错过")) counts.miss++;
        if (h.outcomeLabel.includes("被ta感染")) counts.infected++;

        if (actionCounts[h.action] !== undefined) {
            actionCounts[h.action]++;
        }
    });

    return `
        <div class="mt-4 bg-slate-950/50 rounded-xl p-3 border border-white/5 text-xs">
            <h4 class="text-slate-500 font-bold uppercase tracking-widest mb-2 text-center text-[10px]">生涯结果</h4>
            <div class="grid grid-cols-2 gap-y-2 gap-x-4 mb-4">
                <div class="flex justify-between items-center border-b border-white/5 pb-1">
                    <span class="text-blue-300">✅ 理智享受</span>
                    <span class="font-mono font-bold text-white text-sm">${counts.enjoy}</span>
                </div>
                <div class="flex justify-between items-center border-b border-white/5 pb-1">
                    <span class="text-emerald-300">🛡️ 正确离开</span>
                    <span class="font-mono font-bold text-white text-sm">${counts.leave}</span>
                </div>
                <div class="flex justify-between items-center border-b border-white/5 pb-1">
                    <span class="text-amber-300">😰 死里逃生</span>
                    <span class="font-mono font-bold text-white text-sm">${counts.escape}</span>
                </div>
                <div class="flex justify-between items-center border-b border-white/5 pb-1">
                    <span class="text-slate-400">👋 遗憾错过</span>
                    <span class="font-mono font-bold text-white text-sm">${counts.miss}</span>
                </div>
                <div class="col-span-2 flex justify-between items-center border-b border-white/5 pb-1 bg-rose-950/20 px-1 -mx-1 rounded">
                    <span class="text-rose-400 font-bold">💀 被感染次数</span>
                    <span class="font-mono font-black text-rose-400 text-sm">${counts.infected}</span>
                </div>
            </div>

            <h4 class="text-slate-500 font-bold uppercase tracking-widest mb-2 text-center text-[10px]">行为统计 (次数)</h4>
            <div class="grid grid-cols-2 gap-2 mb-2">
                <div class="bg-rose-900/20 border border-rose-500/20 rounded p-1 text-center">
                    <div class="text-[9px] text-rose-300 opacity-70">无套性交</div>
                    <div class="font-mono font-bold text-rose-200">${actionCounts.sex_raw}</div>
                </div>
                <div class="bg-amber-900/20 border border-amber-500/20 rounded p-1 text-center">
                    <div class="text-[9px] text-amber-300 opacity-70">无套口交</div>
                    <div class="font-mono font-bold text-amber-200">${actionCounts.oral_raw}</div>
                </div>
                <div class="bg-emerald-900/20 border border-emerald-500/20 rounded p-1 text-center">
                    <div class="text-[9px] text-emerald-300 opacity-70">戴套性交</div>
                    <div class="font-mono font-bold text-emerald-200">${actionCounts.sex_condom}</div>
                </div>
                <div class="bg-slate-800/50 border border-white/10 rounded p-1 text-center">
                    <div class="text-[9px] text-slate-400 opacity-70">戴套口交</div>
                    <div class="font-mono font-bold text-slate-300">${actionCounts.oral_condom}</div>
                </div>
                <div class="col-span-2 bg-slate-800 border border-white/5 rounded p-1 flex justify-between px-3 items-center">
                    <div class="text-[9px] text-slate-400">👋 拒绝/离开</div>
                    <div class="font-mono font-bold text-white">${actionCounts.refuse}</div>
                </div>
            </div>

            <div class="mt-2 pt-2 border-t border-white/10 flex justify-between items-center">
                <span class="font-bold text-slate-300">⏱️ 存活回合</span>
                <span class="font-mono font-black text-xl text-white">${STATE.turn - 1}</span>
            </div>
        </div>
    `;
}

// ==========================================
// 弹窗宽度切换
// ==========================================

const FEEDBACK_PANEL = document.getElementById('feedback-panel');

/** 切换结算弹窗宽度：窄（提示）/ 宽（结算+科普） */
function setFeedbackWide(wide) {
    if (!FEEDBACK_PANEL) return;
    if (wide) {
        FEEDBACK_PANEL.classList.remove('lg:max-w-lg');
        FEEDBACK_PANEL.classList.add('lg:max-w-4xl');
    } else {
        FEEDBACK_PANEL.classList.add('lg:max-w-lg');
        FEEDBACK_PANEL.classList.remove('lg:max-w-4xl');
    }
}

// ==========================================
// 按钮状态同步（手机端 + 桌面端）
// ==========================================

const END_BUTTONS = {
    next:       { m: 'next-btn',           d: 'next-btn-desk' },
    restart:    { m: 'restart-btn',        d: 'restart-btn-desk' },
    history:    { m: 'view-history-btn',   d: 'view-history-btn-desk' },
    returnHome: { m: 'return-home-btn',    d: 'return-home-btn-desk' }
};

/** 统一更新结算弹窗的按钮状态（手机端+桌面端同步生效） */
function updateEndButtons(config) {
    for (const [role, ids] of Object.entries(END_BUTTONS)) {
        const cfg = config[role];
        if (!cfg) continue;
        const mobile = document.getElementById(ids.m);
        const desk = document.getElementById(ids.d);
        [mobile, desk].forEach(function(btn) {
            if (!btn) return;
            if (cfg.show !== undefined) btn.classList.toggle('hidden', !cfg.show);
            if (cfg.text !== undefined) btn.innerText = cfg.text;
            if (cfg.click !== undefined) btn.onclick = cfg.click;
        });
    }
}

// ==========================================
// 普通反馈弹窗
// ==========================================

function showFeedback(title, msg, icon, isSimpleAlert = false, diseases = null) {
    // 有疾病科普时用宽幅，否则窄幅
    setFeedbackWide(diseases && diseases.length > 0);
    const el = document.getElementById('feedback-overlay');
    el.classList.remove('hidden');
    const titleEl = document.getElementById('feedback-title');
    titleEl.innerText = title;
    titleEl.className = "text-2xl lg:text-3xl font-black text-white uppercase tracking-tight";
    document.getElementById('feedback-icon').innerText = icon;
    document.getElementById('feedback-message').innerHTML = msg;

    // 疾病科普
    if (diseases && diseases.length > 0) {
        const report = document.getElementById('disease-report');
        report.classList.remove('hidden');
        document.getElementById('disease-content').innerHTML = buildMultiDiseaseHTML(diseases);
    } else {
        document.getElementById('disease-report').classList.add('hidden');
    }

    toggleHistoryView(false);

    if (isSimpleAlert) {
        updateEndButtons({
            next:       { show: true, text: '关闭', click: function() { el.classList.add('hidden'); } },
            restart:    { show: false },
            history:    { show: false },
            returnHome: { show: false }
        });
    } else {
        updateEndButtons({
            next:       { show: true, text: '继续', click: nextTurn },
            restart:    { show: false },
            history:    { show: false },
            returnHome: { show: false }
        });
    }
}

// ==========================================
// 游戏结束弹窗（含疾病科普）
// ==========================================

function showGameOver(title, msg, icon, infectionKeys = null) {
    setFeedbackWide(true);  // 宽幅：结算+科普两栏
    STATE.isGameOver = true;
    const el = document.getElementById('feedback-overlay');
    el.classList.remove('hidden');

    const titleEl = document.getElementById('feedback-title');
    titleEl.innerText = title;
    titleEl.className = "text-3xl font-black text-rose-500 uppercase tracking-tighter animate-pulse";
    document.getElementById('feedback-icon').innerText = icon;

    document.getElementById('feedback-message').innerHTML = msg + getStatsHTML();

    if (infectionKeys && infectionKeys.length > 0) {
        const report = document.getElementById('disease-report');
        report.classList.remove('hidden');
        document.getElementById('disease-content').innerHTML = buildMultiDiseaseHTML(infectionKeys);
    } else {
        document.getElementById('disease-report').classList.add('hidden');
    }

    renderHistoryList();
    toggleHistoryView(false);

    updateEndButtons({
        next:       { show: false },
        restart:    { show: true, text: '再来一局', click: restartGame },
        history:    { show: true },
        returnHome: { show: true }
    });
}

// ==========================================
// 胜利弹窗
// ==========================================

function showWin() {
    setFeedbackWide(true);  // 宽幅：结算两栏（无疾病科普时仍较窄，但保持一致性）
    STATE.isGameOver = true;
    const el = document.getElementById('feedback-overlay');
    el.classList.remove('hidden');

    const titleEl = document.getElementById('feedback-title');
    titleEl.innerText = "幸存者";
    titleEl.className = "text-3xl font-black text-emerald-400 uppercase tracking-tighter";
    document.getElementById('feedback-icon').innerText = "✨";

    document.getElementById('feedback-message').innerHTML =
        `你成功清零了压抑值，且身体健康。<br><br>在这场充满迷雾和风险的游戏中，你靠着谨慎、策略和一点运气活了下来。` + getStatsHTML();

    document.getElementById('disease-report').classList.add('hidden');

    renderHistoryList();
    toggleHistoryView(false);

    updateEndButtons({
        next:       { show: false },
        restart:    { show: true, text: '再来一局', click: restartGame },
        history:    { show: true },
        returnHome: { show: true }
    });
}

// ==========================================
// ★ 多疾病切换展示（结算界面）
// ==========================================

/**
 * 构建多疾病切换面板
 * @param {string[]} diseaseKeys - 疾病 key 数组，如 ["HIV", "SYPHILIS"]
 */
function buildMultiDiseaseHTML(diseaseKeys) {
    if (!diseaseKeys || diseaseKeys.length === 0) return '';

    // 单疾病：直接展示
    if (diseaseKeys.length === 1) {
        return buildDiseaseEducationHTML(DISEASES[diseaseKeys[0]]);
    }

    // 多疾病：标签切换 + 内容区
    const uniqueId = 'multi-disease-' + Date.now();
    let html = '';

    // ---- 疾病标签栏（手机横向滑动，桌面自动换行） ----
    html += `<div class="flex gap-2 mb-4 overflow-x-auto custom-scroll pb-1 lg:flex-wrap lg:overflow-visible" id="${uniqueId}-tabs">`;
    diseaseKeys.forEach((dKey, idx) => {
        const d = DISEASES[dKey];
        const activeClass = idx === 0 ? 'bg-rose-600/40 border-rose-400 text-rose-200' : 'bg-slate-800/50 border-white/10 text-slate-400 hover:bg-slate-700/50';
        html += `
        <button onclick="switchDiseaseTab('${uniqueId}', '${dKey}', this)"
                class="disease-tab px-3 py-2 rounded-lg text-xs font-bold border transition-colors whitespace-nowrap flex-shrink-0 ${activeClass}"
                data-dkey="${dKey}">
            🦠 ${d.name}
        </button>`;
    });
    html += `</div>`;

    // ---- 疾病内容区（初始显示第一个） ----
    html += `<div id="${uniqueId}-content">`;
    html += buildDiseaseEducationHTML(DISEASES[diseaseKeys[0]]);
    html += `</div>`;

    return html;
}

/**
 * 切换疾病标签
 */
function switchDiseaseTab(uniqueId, dKey, btn) {
    const ACTIVE = ['bg-rose-600/40', 'border-rose-400', 'text-rose-200'];
    const INACTIVE = ['bg-slate-800/50', 'border-white/10', 'text-slate-400', 'hover:bg-slate-700/50'];

    // 重置所有标签样式
    const tabs = document.getElementById(uniqueId + '-tabs');
    if (tabs) {
        tabs.querySelectorAll('.disease-tab').forEach(t => {
            t.classList.remove(...ACTIVE);
            t.classList.add(...INACTIVE);
        });
    }

    // 激活当前标签
    btn.classList.remove(...INACTIVE);
    btn.classList.add(...ACTIVE);

    // 切换内容
    const container = document.getElementById(uniqueId + '-content');
    const dInfo = DISEASES[dKey];
    if (container && dInfo) {
        container.innerHTML = buildDiseaseEducationHTML(dInfo);
    }
}

function buildDiseaseEducationHTML(disease) {
    const edu = DISEASE_EDUCATION[disease.key];
    if (!edu) {
        return `<p><b>确诊：</b>${disease.name}</p><p><b>途径：</b>${disease.transmission}</p>`;
    }

    let html = '';

    // ---- 头部摘要卡片 ----
    html += `
    <div class="bg-rose-950/40 border border-rose-500/30 rounded-xl p-4 mb-4">
        <div class="flex items-center gap-3 mb-3">
            <span class="text-3xl">🦠</span>
            <div>
                <h3 class="text-lg font-black text-rose-300">${disease.name}</h3>
                <p class="text-xs text-rose-400/70 font-mono">病原体：${edu.pathogen.name}</p>
            </div>
        </div>
        <p class="text-sm text-slate-300 leading-relaxed">${edu.overview}</p>
    </div>`;

    // ---- 折叠面板：传播途径详解 ----
    html += buildAccordion("🔬 传播途径详解", "transmission", () => {
        let inner = `<p class="text-slate-400 text-xs mb-3">${edu.pathogen.description}</p>`;
        edu.transmissionRoutes.routes.forEach(r => {
            const badgeClass = r.riskLevel === 'high' ? 'edu-badge-danger' :
                              r.riskLevel === 'medium' ? 'edu-badge-warn' :
                              r.riskLevel === 'low' ? 'edu-badge-info' : 'edu-badge-safe';
            const badgeText = r.riskLevel === 'high' ? '高风险' :
                             r.riskLevel === 'medium' ? '中风险' :
                             r.riskLevel === 'low' ? '低风险' : '无风险';
            inner += `
            <div class="bg-slate-800/50 rounded-lg p-3 mb-2 border border-white/5">
                <p class="mb-1">
                    <span class="text-white font-bold text-sm">${r.route}</span>
                    <span class="edu-badge ${badgeClass} ml-2 whitespace-nowrap">${badgeText}</span>
                </p>
                <p class="text-slate-400 text-xs leading-relaxed">${r.detail}</p>
            </div>`;
        });
        return inner;
    });

    // ---- 折叠面板：潜伏期 ----
    html += buildAccordion("⏱️ 潜伏期与窗口期", "incubation", () => {
        return `<p class="text-slate-300 text-sm leading-relaxed">${edu.incubationPeriod}</p>`;
    });

    // ---- 折叠面板：临床症状 ----
    html += buildAccordion("🩺 临床症状分期", "symptoms", () => {
        let inner = '';
        edu.symptoms.stages.forEach(s => {
            inner += `
            <div class="bg-slate-800/50 rounded-lg p-3 mb-2 border border-white/5">
                <h4 class="text-white font-bold text-sm mb-1">${s.stage}</h4>
                <p class="text-slate-300 text-xs leading-relaxed">${s.symptoms}</p>
                ${s.note ? `<p class="text-amber-400/80 text-xs mt-1 italic">⚠️ ${s.note}</p>` : ''}
            </div>`;
        });
        return inner;
    });

    // ---- 折叠面板：并发症 ----
    html += buildAccordion("⚠️ 并发症与后果", "complications", () => {
        return `<p class="text-slate-300 text-sm leading-relaxed">${edu.complications}</p>`;
    });

    // ---- 折叠面板：诊断方法 ----
    html += buildAccordion("🔍 诊断方法", "diagnosis", () => {
        return `<p class="text-slate-300 text-sm leading-relaxed">${edu.diagnosis}</p>`;
    });

    // ---- 折叠面板：治疗方案 ----
    html += buildAccordion("💊 治疗与预后", "treatment", () => {
        return `<p class="text-slate-300 text-sm leading-relaxed">${edu.treatment}</p>`;
    });

    // ---- 折叠面板：预防措施 ----
    html += buildAccordion("🛡️ 预防措施", "prevention", () => {
        return `<p class="text-slate-300 text-sm leading-relaxed">${edu.prevention}</p>`;
    });

    // ---- 折叠面板：流行病学数据 ----
    html += buildAccordion("📊 流行病学数据", "epidemiology", () => {
        return `<p class="text-slate-300 text-sm leading-relaxed">${edu.epidemiology}</p>`;
    });

    // ---- 折叠面板：感染风险详解 ----
    html += buildAccordion("🎯 为什么你会被感染？", "riskFactors", () => {
        return `<p class="text-slate-300 text-sm leading-relaxed">${edu.riskFactors}</p>`;
    });

    // ---- 权威引用 ----
    html += `
    <div class="mt-4 pt-4 border-t border-white/10">
        <h4 class="text-xs font-bold text-slate-500 uppercase tracking-widest mb-3">📚 权威参考来源</h4>
        <div class="space-y-1">`;
    edu.references.forEach(ref => {
        html += `
            <a href="${ref.url}" target="_blank" rel="noopener noreferrer" class="edu-reference block">
                🔗 ${ref.source} — ${ref.title}
            </a>`;
    });
    html += `
        </div>
        <p class="text-[10px] text-slate-600 mt-3 italic">以上信息仅供参考和健康教育目的，不能替代专业医疗诊断和建议。如有疑虑，请前往正规医疗机构就诊。</p>
    </div>`;

    return html;
}

// ==========================================
// 折叠面板辅助函数
// ==========================================

function buildAccordion(title, id, contentFn) {
    const accordionId = `accordion-${id}`;
    return `
    <div class="edu-accordion" id="${accordionId}">
        <div class="edu-accordion-header" data-accordion="${accordionId}">
            <span class="text-sm font-bold text-slate-200">${title}</span>
            <span class="arrow">▼</span>
        </div>
        <div class="edu-accordion-body">
            <div class="edu-accordion-content">
                ${contentFn()}
            </div>
        </div>
    </div>`;
}

// ==========================================
// 折叠面板：事件委托（全局监听，可靠响应动态插入的 DOM）
// ==========================================
document.addEventListener('click', function(e) {
    const header = e.target.closest('.edu-accordion-header');
    if (!header) return;
    const accordion = header.closest('.edu-accordion');
    if (accordion) {
        e.stopPropagation();
        accordion.classList.toggle('open');
    }
});
